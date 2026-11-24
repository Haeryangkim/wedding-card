#!/usr/bin/env python3
"""'chibi' 그림체(테스트 전용) 에셋 빌드 — MaelleMarylloup 의 손그림 CHIBI 팩(정면 한 자세)을 잘라
컷아웃 인형으로 만들고, 걷는 동작을 구워 아틀라스로 내보낸다.

    python -I art/chibi/build.py collect <src>   # 내려받아 푼 팩에서 쓰는 파일만 raw/ 로 복사 (아래 SRC_DIRS 참고)
    python -I art/chibi/build.py build           # atlas.png + atlas.json → web/src/guestbook/styles/chibi/assets/
                                                 # catalog.ts(이름·개수·치수, 이미지 없음) → web/src/guestbook/styles/chibi/
    python -I art/chibi/build.py preview [out]   # 아틀라스를 앱과 같은 규칙으로 조합한 확인용 시트 (기본 art/chibi/preview.png)
    python -I art/chibi/build.py proof <dir>     # 걷기 확인용 walk.png / walk.gif

(pillow · numpy · scipy 필요)

원본은 444x700 캔버스에 맞춰 그린 레이어(몸·옷·머리…)이고 자세는 비스듬한 정면 하나뿐이다.
 - 몸 팩의 body_layered.png(부위별 색칠)로 캔버스를 부위(머리·몸통·팔 둘·다리 둘)로 나눈다.
   옷 레이어의 픽셀은 "가장 가까운 몸 부위" 를 따라간다 (윗옷은 몸통/팔, 바지는 몸통/다리, 치마·원피스는 통째로 + 팔).
 - 팔다리 조각을 관절(어깨·골반) 기준으로 돌리거나 줄인 변형을 원본 해상도에서 만든 뒤 축소해 굽는다.
   자른 자리가 벌어지지 않게 아래에 깔리는 조각(몸통, 먼 쪽 다리)은 이웃 조각 쪽으로 조금 넓혀 둔다.
 - 치마·원피스는 통째로 두고 허리 아래를 좌우로 흔든 변형을 굽는다.
 - 머리(얼굴·머리카락·머리 장식)는 한 덩어리로 두고 앱이 걸음마다 위치만 옮긴다. 머리카락은 흑백 선화를 구워 앱에서 색을 입힌다.
 - 뒷모습(up)은 원본에 없다: 머리통을 머리카락으로 덮은 "뒤통수" 를 만들어 쓰고 몸은 좌우 반전한다.

라이선스: 개인·상업 이용은 허용되지만 재배포가 명시적으로 허용되지 않았다 — raw/ 와 assets/ 는 저장소에 올리지 않는다 (LICENSE.md).
"""
from __future__ import annotations

import json
import math
import os
import shutil
import sys

sys.dont_write_bytecode = True

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, "raw")
STYLE_DIR = os.path.join(ROOT, "web", "src", "guestbook", "styles", "chibi")
ASSETS = os.path.join(STYLE_DIR, "assets")

# 논리 경로의 첫 마디 → 내려받아 푼 팩 안의 폴더 (collect 가 여기서 찾는다)
SRC_DIRS = {
    "main": "raw/dl_14738387_x",  # CHIBI base + assets
    "masc": "raw-masc/x2",  # masculine pack
    "royal": "raw-royal/dl_14252253_x/assets color",  # fairy royal couple
}

SRC_W, SRC_H = 444, 700
# 프레임: 원본 캔버스에서 잘라 내는 범위(발 중심 CX 기준 좌우 대칭)와 축소 배율
CX = 226
HALF = 200
Y0, Y1 = 60, 675
SCALE = 0.4
W = round(2 * HALF * SCALE)  # 160
H = round((Y1 - Y0) * SCALE)  # 246
FOOT_SRC = 660
FOOT_Y = round((FOOT_SRC - Y0) * SCALE)
HEAD_TOP_SRC = 131

# 관절 (원본 좌표)
HIP = {"L": (203, 488), "R": (265, 484)}
SHOULDER = {"L": (203, 388), "R": (258, 390)}
LEG_SWING = 17  # 도
ARM_SWING = 13
LEG_LIFT = 0.78  # 정면 걷기: 다리를 세로로 줄여 발을 든다
SKIRT_SWAY = 11  # 치맛단이 좌우로 흔들리는 폭(원본 px)
WAIST_Y = 452
EXT_D = 3  # 아래 깔리는 조각을 이웃 쪽으로 넓히는 폭
EXT_R = 22  # 관절 둘레로는 더 넓게

# ── 카탈로그 ─────────────────────────────────────────────────────────

SKINS = [
    ("뽀얀 톤", 1),
    ("살구 톤", 17),
    ("베이지", 16),
    ("허니", 14),
    ("브라운", 5),
    ("딥 브라운", 6),
]

# (이름, 눈동자, 속눈썹, 눈썹, 입)
FACES = [
    ("순한 눈", 3, 3, 3, 7),
    ("또렷한 눈", 7, 4, 4, 1),
    ("속눈썹", 3, 1, 4, 2),
    ("파란 눈", 4, 3, 1, 14),
    ("초록 눈", 5, 4, 3, 9),
    ("시크", 1, 2, 5, 4),
    ("장난꾸러기", 9, 3, 4, 18),
    ("보라 눈", 11, 1, 1, 7),
]

M = "main/"
MA = "masc/9-"
# (이름, 앞머리, 윗머리, 뒷머리) — 흑백 선화. 앞쪽 SHORT_HAIRS 개가 짧은 머리
HAIRS = [
    ("댄디컷", MA + "bangs-bananas(bw).png", MA + "hair-short1(bw).png", None),
    ("울프컷", MA + "bangs-wolf(bw).png", MA + "hair-piques(bw).png", None),
    ("가르마", M + "bangs/4.png", M + "hair/1.png", None),
    ("곱슬 숏컷", M + "bangs/13.png", M + "hair/7.png", None),
    ("내린 앞머리", M + "bangs/9.png", M + "hair/3.png", None),
    ("삐죽 머리", MA + "bangs-pics(bw).png", MA + "hair-lisses(bw).png", None),
    ("포마드", M + "bangs/12.png", M + "hair/5.png", None),
    ("웨이브 숏", MA + "bangs-longswavy(bw).png", MA + "hair-short-wavy(bw).png", None),
    ("단발", M + "bangs/8.png", M + "hair/8.png", M + "hair_back/1.png"),
    ("긴 생머리", M + "bangs/6.png", M + "hair/10.png", M + "hair_back/10.png"),
    ("긴 웨이브", M + "bangs/5.png", M + "hair/4.png", M + "hair_back/4.png"),
    ("포니테일", M + "bangs/2.png", M + "hair/3.png", M + "hair_back/5.png"),
    ("올림머리", M + "bangs/1.png", M + "hair/6.png", M + "hair_back/7.png"),
    ("땋은 머리", M + "bangs/3.png", M + "hair/2.png", M + "hair_back/3.png"),
    ("아주 긴 머리", M + "bangs/10.png", M + "hair/1.png", M + "hair_back/11.png"),
    ("컬 포니테일", M + "bangs/11.png", M + "hair/9.png", M + "hair_back/9.png"),
    ("옆으로 넘긴 머리", M + "bangs/7.png", M + "hair/12.png", M + "hair_back/12.png"),
]
SHORT_HAIRS = 8

# (이름, 채움 색, 선 색) — 앞의 여덟은 팩의 색 변형(a~h)에서 그대로 읽은 값
HAIR_COLORS = [
    ("흑갈색", "#533028", "#200d09"),
    ("검정", "#292934", "#000000"),
    ("밤색", "#b86e40", "#853f13"),
    ("금발", "#ffd99d", "#d6ab64"),
    ("주황", "#db592e", "#a82b01"),
    ("와인", "#911714", "#5e0200"),
    ("회색", "#969696", "#585858"),
    ("은발", "#ffffff", "#d0d0d0"),
    ("로즈 핑크", "#f2a7b8", "#c26f85"),
    ("민트", "#9fd8cc", "#5fa596"),
]

BW = "bw"  # 흑백 선화를 (채움, 선) 색으로 칠한다


def bw(path: str, fill: str, line: str):
    return (BW, path, fill, line)


TOPC = M + "top/colors/"
BOTC = M + "bottom/color/"
DRC = M + "dress/COLORS/"
SHOE = M + "shoes/COLOR/"
# (이름, {top, bottom, skirt, dress, shoes}, 여자 옷인지) — 0 = 신랑, 1 = 신부
OUTFITS = [
    ("턱시도", dict(top=MA + "top-Kpop-suit(color).png", bottom=MA + "bottom-costume(color).png", shoes=SHOE + "2.png"), False),
    ("웨딩드레스", dict(dress=bw(M + "dress/3.png", "#ffffff", "#b9a8bd"), shoes=bw(M + "shoes/1.png", "#ffffff", "#b9a8bd")), True),
    ("멜빵 셔츠", dict(top=MA + "top-timber(color).png", bottom=MA + "bottom-jean(color).png", shoes=SHOE + "3.png"), False),
    ("후드 재킷", dict(top=MA + "top-sweatshirt(color).png", bottom=MA + "bottom-academic(color).png", shoes=SHOE + "2.png"), False),
    ("가죽 재킷", dict(top=MA + "top-blouson-shirt(color).png", bottom=MA + "bottom-greysweatpants.png", shoes=SHOE + "1.png"), False),
    ("셔츠와 슬랙스", dict(top=MA + "top-chemise1.png", bottom=BOTC + "8.png", shoes=SHOE + "2.png"), False),
    ("초록 니트", dict(top=MA + "top-polo(color).png", bottom=MA + "bottom-short(color).png", shoes=SHOE + "1.png"), False),
    ("왕자님", dict(top=MA + "top-royal-prince(color).png", bottom=MA + "bottom-costume(color).png", shoes=SHOE + "3.png"), False),
    ("검정 티셔츠", dict(top=MA + "top-tshirtXXL(color).png", bottom=BOTC + "1.png", shoes=SHOE + "1.png"), False),
    ("올리브 셔츠", dict(top=TOPC + "10.png", bottom=BOTC + "3.png", shoes=SHOE + "3.png"), False),
    ("민트 원피스", dict(dress=DRC + "1.png", shoes=SHOE + "1.png"), True),
    ("와인 드레스", dict(dress=DRC + "5.png", shoes=SHOE + "2.png"), True),
    ("핑크 원피스", dict(dress=DRC + "6.png", shoes=bw(M + "shoes/1.png", "#f6d3da", "#b96a7e")), True),
    ("하늘 블라우스와 치마", dict(top=TOPC + "2.png", skirt=BOTC + "2.png", shoes=SHOE + "1.png"), True),
    ("보라 홀터와 청바지", dict(top=TOPC + "11.png", bottom=BOTC + "6.png", shoes=SHOE + "2.png"), True),
    ("조끼와 랩스커트", dict(top=TOPC + "7.png", skirt=BOTC + "7.png", shoes=SHOE + "3.png"), True),
    ("흰 티셔츠와 청바지", dict(top=TOPC + "1.png", bottom=BOTC + "1.png", shoes=SHOE + "1.png"), True),
    ("하늘 원피스", dict(dress=bw(M + "dress/3.png", "#bcd9f2", "#5f86ad"), shoes=bw(M + "shoes/1.png", "#ffffff", "#8fa3b8")), True),
]

RY = "royal/"
# (이름, 종류) — 그림은 acc_layers() 가 만든다. 마지막(면사포)은 신부 몫
ACCESSORIES = [
    ("동그란 안경", "glasses"),
    ("화관", "flower"),
    ("리본", "ribbon"),
    ("나뭇가지 왕관", "crown"),
    ("귀걸이", "earrings"),
    ("볼터치", "blush"),
    ("요정 날개", "wings"),
    ("면사포", "veil"),
]

# 고정 캐릭터: 인덱스 (skin, hairStyle, hairColor, outfit, face, accessory(0 = 없음))
GROOM = dict(skin=1, hairStyle=0, hairColor=1, outfit=0, face=1, accessory=0)
BRIDE = dict(skin=0, hairStyle=12, hairColor=0, outfit=1, face=2, accessory=len(ACCESSORIES))

# 프레임별 자세: l = [왼다리, 오른다리] 변형, a = [왼팔, 오른팔] 변형, b = 치마 변형, dy = 상체 내림, hx/hy = 머리 이동 (구운 px)
#   다리 변형: 0 그대로 · 1 들기 · 2 앞으로(+x) · 3 뒤로(-x)   팔 변형: 0 · 1 앞으로(+x) · 2 뒤로(-x)   치마: 0 · 1 · 2
POSES = {
    "down": [
        dict(l=[0, 0], a=[0, 0], b=0, dy=0, hx=0, hy=0),
        dict(l=[1, 0], a=[2, 2], b=1, dy=1, hx=-1, hy=2),
        dict(l=[0, 1], a=[1, 1], b=2, dy=1, hx=1, hy=2),
    ],
    "side": [
        dict(l=[0, 0], a=[0, 0], b=0, dy=0, hx=0, hy=0),
        dict(l=[3, 2], a=[1, 2], b=1, dy=1, hx=1, hy=2),
        dict(l=[2, 3], a=[2, 1], b=2, dy=1, hx=1, hy=2),
    ],
}

# ── 원본 읽기 ────────────────────────────────────────────────────────

_collect_src: str | None = None
_used: set[str] = set()


def raw_path(logical: str) -> str:
    return os.path.join(RAW, logical)


def load(logical: str) -> np.ndarray:
    """원본 레이어 → float32 RGBA(0~1, 알파 곱하지 않음)"""
    _used.add(logical)
    p = raw_path(logical)
    if _collect_src is not None:
        head, rest = logical.split("/", 1)
        src = os.path.join(_collect_src, SRC_DIRS[head], rest)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        if not os.path.exists(p):
            shutil.copyfile(src, p)
    if not os.path.exists(p):
        raise SystemExit(f"원본이 없어요: {p}\n  → python -I art/chibi/build.py collect <내려받은 폴더> 를 먼저 실행하세요 (LICENSE.md)")
    im = Image.open(p).convert("RGBA")
    assert im.size == (SRC_W, SRC_H), (logical, im.size)
    return np.asarray(im, dtype=np.float32) / 255.0


def hexrgb(h: str) -> np.ndarray:
    return np.array([int(h[i : i + 2], 16) for i in (1, 3, 5)], dtype=np.float32) / 255.0


def layer(spec) -> np.ndarray:
    """경로 또는 bw(...) → RGBA. bw 는 밝기(1 = 채움, 0 = 선)로 두 색을 섞어 칠한다"""
    if isinstance(spec, tuple) and spec[0] == BW:
        a = load(spec[1]).copy()
        g = a[..., :3].mean(-1, keepdims=True)
        a[..., :3] = hexrgb(spec[3]) * (1 - g) + hexrgb(spec[2]) * g
        return a
    return load(spec)


def over(dst: np.ndarray, src: np.ndarray) -> np.ndarray:
    """알파 합성 (곱하지 않은 RGBA)"""
    sa = src[..., 3:4]
    da = dst[..., 3:4]
    oa = sa + da * (1 - sa)
    rgb = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    return np.concatenate([rgb, oa], -1)


def blank() -> np.ndarray:
    return np.zeros((SRC_H, SRC_W, 4), np.float32)


# ── 부위 지도 ────────────────────────────────────────────────────────

LABEL_COLORS = {
    (255, 223, 187): "head",
    (255, 229, 72): "legL",
    (160, 105, 187): "torso",
    (219, 126, 131): "torso",
    (62, 140, 33): "armL",
    (255, 170, 102): "legR",
    (241, 120, 193): "leg",
    (23, 89, 62): "leg",
    (73, 162, 190): "armL",
    (33, 139, 92): "armR",
    (41, 83, 132): "armR",
    (255, 0, 0): "torso",
}
GROUPS = ["head", "torso", "armL", "armR", "legL", "legR"]
_regions: dict | None = None


def regions() -> dict:
    """캔버스의 모든 픽셀을 가장 가까운 몸 부위로 나눈 지도 + 다리만의 지도"""
    global _regions
    if _regions is not None:
        return _regions
    lay = (load("main/body/body_layered.png") * 255).round().astype(np.int32)
    lab = np.full((SRC_H, SRC_W), -1, np.int32)
    xs = np.arange(SRC_W)[None, :].repeat(SRC_H, 0)
    for col, name in LABEL_COLORS.items():
        m = (lay[..., :3] == col).all(-1) & (lay[..., 3] > 250)
        if name == "leg":
            lab[m & (xs < 232)] = GROUPS.index("legL")
            lab[m & (xs >= 232)] = GROUPS.index("legR")
        else:
            lab[m] = GROUPS.index(name)
    idx = ndi.distance_transform_edt(lab < 0, return_distances=False, return_indices=True)
    full = lab[idx[0], idx[1]]
    legs = np.where(lab >= 4, lab, -1)
    idx = ndi.distance_transform_edt(legs < 0, return_distances=False, return_indices=True)
    legs_only = legs[idx[0], idx[1]]
    _regions = {"full": full, "legs": legs_only}
    return _regions


def disc(center, r) -> np.ndarray:
    yy, xx = np.mgrid[0:SRC_H, 0:SRC_W]
    return (xx - center[0]) ** 2 + (yy - center[1]) ** 2 <= r * r


def smooth(masks: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    """분할 경계의 잔가시를 없앤다: 마스크를 흐린 뒤 가장 센 쪽으로 다시 나눈다"""
    names = list(masks)
    soft = np.stack([ndi.gaussian_filter(masks[n].astype(np.float32), 2.5) for n in names])
    win = soft.argmax(0)
    return {n: win == i for i, n in enumerate(names)}


def piece_masks(kind: str) -> dict[str, np.ndarray]:
    return smooth(_piece_masks(kind))


def _piece_masks(kind: str) -> dict[str, np.ndarray]:
    """레이어 종류별 조각 마스크 (정확한 분할). kind: skin · pants · shoes · top"""
    g = regions()["full"]
    gi = GROUPS.index
    if kind == "skin":
        return {n: g == gi(n) for n in GROUPS}
    if kind == "pants":
        ll, lr = g == gi("legL"), g == gi("legR")
        return {"legL": ll, "legR": lr, "torso": ~(ll | lr)}
    if kind == "shoes":
        lg = regions()["legs"]
        return {"legL": lg == gi("legL"), "legR": lg == gi("legR")}
    if kind == "top":  # 윗옷·원피스·치마: 팔 위의 픽셀만 팔을 따라가고 나머지는 한 덩어리
        al, ar = g == gi("armL"), g == gi("armR")
        return {"armL": al, "armR": ar, "torso": ~(al | ar)}
    raise ValueError(kind)


def extend_under(masks: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    """아래에 깔리는 조각을 이웃 조각 쪽으로 넓힌다 (움직여도 틈이 안 보이게, 축소 뒤 이음매가 비치지 않게)"""
    out = dict(masks)
    if "torso" in masks:
        t = ndi.binary_dilation(masks["torso"], iterations=EXT_D)
        for side in "LR":
            if "leg" + side in masks:
                t |= masks["leg" + side] & disc(HIP[side], EXT_R)
            if "arm" + side in masks:
                t |= masks["arm" + side] & disc(SHOULDER[side], EXT_R)
        out["torso"] = t & ~masks.get("head", np.zeros_like(t))
    if "legR" in masks and "legL" in masks:
        out["legR"] = masks["legR"] | (ndi.binary_dilation(masks["legR"], iterations=EXT_D) & masks["legL"])
    return out


# ── 변형 ────────────────────────────────────────────────────────────


def warp(img: np.ndarray, inv) -> np.ndarray:
    """inv(x, y) → 원본 좌표. 알파를 곱한 채로 보간한다"""
    ys, xs = np.nonzero(img[..., 3] > 0)
    if len(ys) == 0:
        return img
    pad = 60
    x0, x1 = max(0, xs.min() - pad), min(SRC_W, xs.max() + pad)
    y0, y1 = max(0, ys.min() - pad), min(SRC_H, ys.max() + pad)
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    sx, sy = inv(xx, yy)
    pm = img.copy()
    pm[..., :3] *= pm[..., 3:4]
    out = blank()
    for c in range(4):
        out[y0:y1, x0:x1, c] = ndi.map_coordinates(pm[..., c], [sy, sx], order=1, mode="constant")
    a = np.maximum(out[..., 3:4], 1e-6)
    out[..., :3] = np.clip(out[..., :3] / a, 0, 1)
    return out


def rot_inv(pivot, deg):
    t = math.radians(deg)
    c, s = math.cos(t), math.sin(t)
    px, py = pivot

    def inv(x, y):
        dx, dy = x - px, y - py
        return px + c * dx + s * dy, py - s * dx + c * dy

    return inv


def leg_variants(img: np.ndarray, side: str) -> list[np.ndarray]:
    px, py = HIP[side]
    ay = py - 14

    def lift(x, y):
        return x, ay + (y - ay) / LEG_LIFT

    # 화면에서 +각도 = 발이 왼쪽(-x)으로 간다
    return [img, warp(img, lift), warp(img, rot_inv((px, py), -LEG_SWING)), warp(img, rot_inv((px, py), LEG_SWING))]


def arm_variants(img: np.ndarray, side: str) -> list[np.ndarray]:
    p = SHOULDER[side]
    return [img, warp(img, rot_inv(p, -ARM_SWING)), warp(img, rot_inv(p, ARM_SWING))]


def sway_variants(img: np.ndarray) -> list[np.ndarray]:
    ys = np.nonzero(img[..., 3].max(1) > 0.5)[0]
    if len(ys) == 0 or ys.max() <= WAIST_Y + 20:
        return [img]
    bottom = float(ys.max())

    def make(k):
        def inv(x, y):
            t = np.clip((y - WAIST_Y) / (bottom - WAIST_Y), 0, 1)
            return x - k * t * t, y

        return inv

    return [img, warp(img, make(-SKIRT_SWAY)), warp(img, make(SKIRT_SWAY))]


# ── 아틀라스 ────────────────────────────────────────────────────────


class Atlas:
    def __init__(self):
        self.cells: list[tuple[Image.Image, int, int]] = []
        self.index: dict[bytes, int] = {}

    def add(self, img: np.ndarray) -> int:
        """원본 캔버스 크기 RGBA(0~1) → 프레임으로 자르고 축소해 칸으로 넣는다. 빈 그림은 -1"""
        crop = img[Y0:Y1, CX - HALF : CX + HALF]
        pm = crop.copy()
        pm[..., :3] *= pm[..., 3:4]
        im = Image.fromarray((np.clip(pm, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBa")
        im = im.resize((W, H), Image.LANCZOS).convert("RGBA")
        arr = np.asarray(im).copy()
        arr[arr[..., 3] < 3] = 0
        ys, xs = np.nonzero(arr[..., 3])
        if len(ys) == 0:
            return -1
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        cell = arr[y0:y1, x0:x1]
        key = bytes([x0 & 255, y0 & 255]) + cell.tobytes() + bytes(cell.shape[:2])
        if key in self.index:
            return self.index[key]
        self.cells.append((Image.fromarray(cell, "RGBA"), int(x0), int(y0)))
        self.index[key] = len(self.cells) - 1
        return len(self.cells) - 1

    def pack(self, width: int = 1024):
        order = sorted(range(len(self.cells)), key=lambda i: -self.cells[i][0].height)
        rects: list = [None] * len(self.cells)
        x = y = row = 0
        for i in order:
            im, ox, oy = self.cells[i]
            if x + im.width > width:
                x, y, row = 0, y + row + 1, 0
            rects[i] = [x, y, im.width, im.height, ox, oy]
            x += im.width + 1
            row = max(row, im.height)
        sheet = Image.new("RGBA", (width, y + row), (0, 0, 0, 0))
        for i, (im, _, _) in enumerate(self.cells):
            sheet.paste(im, (rects[i][0], rects[i][1]))
        return sheet, rects


def cut(img: np.ndarray, mask: np.ndarray) -> np.ndarray:
    out = img.copy()
    out[~mask] = 0
    return out


def rig_layer(atlas: Atlas, img: np.ndarray, kind: str, sway: bool = False) -> dict:
    """레이어 한 장 → 조각별 칸 번호 {torso|body, legL[4], legR[4], armL[3], armR[3]}"""
    exact = piece_masks(kind)
    ext = extend_under(exact)
    out: dict = {}
    for name, mask in ext.items():
        if name == "head":
            continue
        part = cut(img, mask)
        if part[..., 3].max() <= 0:
            continue
        if name.startswith("leg"):
            ids = [atlas.add(v) for v in leg_variants(part, name[-1])]
        elif name.startswith("arm"):
            ids = [atlas.add(v) for v in arm_variants(part, name[-1])]
        elif sway:
            ids = [atlas.add(v) for v in sway_variants(part)]
        else:
            ids = [atlas.add(part)]
        if all(i < 0 for i in ids):
            continue
        out["body" if name == "torso" else name] = ids
    return out


# ── 머리 ────────────────────────────────────────────────────────────


def head_mask() -> np.ndarray:
    return load("main/body/head.png")[..., 3] > 0.5


def hair_front(bangs: str, cap: str) -> np.ndarray:
    return over(load(cap), load(bangs))


def hair_up(cap: str, back: str | None) -> np.ndarray:
    """뒤통수: 머리통 전체를 머리카락(흰 채움 + 검은 외곽선)으로 덮고 윗머리·뒷머리의 결을 얹는다"""
    hm = head_mask()
    capimg = load(cap)
    ball = ndi.binary_opening(hm, iterations=9)  # 귀를 떼어 낸다
    base = blank()
    base[ball] = 1.0
    edge = ball & ~ndi.binary_erosion(ball, iterations=3)
    base[edge, :3] = 0.0
    a = ndi.gaussian_filter(ball.astype(np.float32), 0.7)
    base[..., 3] = np.clip(a * 1.6 - 0.3, 0, 1)
    base[..., :3] = np.where((base[..., 3:4] > 0) & ~ball[..., None], 0.0, base[..., :3])
    # 윗머리의 선 가운데 머리통 안쪽(얼굴 테두리)에 있는 것은 지운다 — 바깥 윤곽과 그 근처의 결만 남긴다
    inner = ndi.binary_erosion(ball, iterations=5)
    cap2 = capimg.copy()
    dark = cap2[..., :3].mean(-1) < 0.6
    cap2[dark & inner, :3] = 1.0
    out = over(base, cap2)
    if back is not None:
        out = over(out, load(back))
    return out


# ── 액세서리 ────────────────────────────────────────────────────────

SS = 3  # 직접 그리는 액세서리의 슈퍼샘플 배율


def draw_layer(fn) -> np.ndarray:
    im = Image.new("RGBA", (SRC_W * SS, SRC_H * SS), (0, 0, 0, 0))
    fn(ImageDraw.Draw(im), SS)
    return np.asarray(im.resize((SRC_W, SRC_H), Image.LANCZOS), dtype=np.float32) / 255.0


def eye_boxes() -> list[tuple[float, float, float, float]]:
    a = load("main/PUPILS/3.png")[..., 3] > 0.3
    lab, n = ndi.label(a)
    boxes = []
    for sl in ndi.find_objects(lab):
        boxes.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop))
    boxes.sort(key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]))
    return sorted(boxes[:2])


def acc_layers(kind: str) -> dict[str, np.ndarray]:
    """액세서리 → {front, face, back, up, upBody} (원본 캔버스 RGBA). face = 머리카락 아래, back = 몸 뒤, up = 뒷모습의 머리 위"""
    if kind == "glasses":
        (ax0, ay0, ax1, ay1), (bx0, by0, bx1, by1) = eye_boxes()

        def fn(d, s):
            col = (70, 52, 60, 255)
            boxes = []
            for x0, y0, x1, y1, rx in ((ax0, ay0, ax1, ay1, 27), (bx0 - 3, by0, bx1 - 3, by1, 19)):
                cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 - 2
                ry = 27
                boxes.append((cx, cy, rx, ry))
                d.ellipse([(cx - rx) * s, (cy - ry) * s, (cx + rx) * s, (cy + ry) * s], fill=(255, 255, 255, 46), outline=col, width=int(3.4 * s))
            (c1, y1_, r1, _), (c2, y2_, r2, _) = boxes
            d.line([((c1 + r1) * s, (y1_ - 4) * s), ((c2 - r2) * s, (y2_ - 4) * s)], fill=col, width=int(3.4 * s))
            d.line([((c1 - r1) * s, (y1_ - 3) * s), ((c1 - r1 - 22) * s, (y1_ - 9) * s)], fill=col, width=int(3.4 * s))

        return {"front": draw_layer(fn)}
    if kind == "flower":
        img = load(RY + "flower crown.png")
        return {"front": img, "up": img}
    if kind == "crown":
        img = load(RY + "crown.png")
        return {"front": img, "up": img}
    if kind == "earrings":
        return {"front": load(RY + "earings.png")}
    if kind == "blush":
        return {"face": load(RY + "blush.png")}
    if kind == "wings":
        img = load(RY + "wings.png")
        return {"back": img, "upBody": img}
    if kind == "ribbon":

        def fn(d, s):
            cx, cy = 168, 178
            fill, line = (232, 92, 108, 255), (150, 38, 60, 255)

            def poly(pts, f=fill):
                pts = [((cx + x) * s, (cy + y) * s) for x, y in pts]
                d.polygon(pts, fill=f)
                d.line(pts + [pts[0]], fill=line, width=int(3.2 * s), joint="curve")

            poly([(-4, 0), (-40, -30), (-48, 6), (-36, 26)])
            poly([(4, -2), (30, -40), (50, -18), (34, 14)])
            poly([(-6, 8), (-22, 44), (-6, 40), (0, 12)])
            poly([(6, 8), (22, 42), (8, 44), (2, 12)])
            d.ellipse([(cx - 11) * s, (cy - 11) * s, (cx + 11) * s, (cy + 11) * s], fill=fill, outline=line, width=int(3.2 * s))

        img = draw_layer(fn)
        return {"front": img, "up": img}
    if kind == "veil":
        line = (196, 184, 208, 255)

        def veil(alpha):
            def fn(d, s):
                pts = []
                for i in range(41):  # 머리를 감싸는 반원
                    t = math.pi * (1 + i / 40)
                    pts.append((226 + 122 * math.cos(t), 252 + 130 * math.sin(t)))
                for i in range(1, 12):  # 오른쪽 자락
                    t = i / 12
                    pts.append((348 + 26 * t * t, 252 + 310 * t))
                for i in range(41):  # 아랫단
                    t = math.pi * i / 40
                    pts.append((226 + 148 * math.cos(t), 562 + 34 * math.sin(t)))
                for i in range(11, 0, -1):
                    t = i / 12
                    pts.append((104 - 26 * t * t, 252 + 310 * t))
                pts = [(x * s, y * s) for x, y in pts]
                d.polygon(pts, fill=(255, 255, 255, alpha))
                d.line(pts + [pts[0]], fill=line[:3] + (200,), width=int(3 * s), joint="curve")
                for x in (150, 190, 262, 302):
                    d.line([(226 * s + (x - 226) * 0.5 * s, 150 * s), (x * s + (x - 226) * 0.4 * s, 570 * s)], fill=line[:3] + (90,), width=int(2 * s))

            return draw_layer(fn)

        def band(d, s):
            # 머리 위의 작은 화관 띠
            for i, (x, y) in enumerate([(160, 176), (182, 160), (206, 150), (232, 146), (258, 150), (282, 160), (302, 176)]):
                r = 9 if i % 2 == 0 else 7
                d.ellipse([(x - r) * s, (y - r) * s, (x + r) * s, (y + r) * s], fill=(255, 255, 255, 255), outline=line, width=int(2.6 * s))
                d.ellipse([(x - 2.5) * s, (y - 2.5) * s, (x + 2.5) * s, (y + 2.5) * s], fill=(246, 214, 130, 255))

        b = draw_layer(band)
        return {"back": veil(150), "front": b, "up": over(veil(205), b)}
    raise ValueError(kind)


# ── 빌드 ────────────────────────────────────────────────────────────


def skin_hex(n: int) -> str:
    a = load(f"main/body/{n}.png")
    r, g, b = (a[250, 226, :3] * 255).round().astype(int)
    return f"#{r:02x}{g:02x}{b:02x}"


def build_data(atlas: Atlas) -> dict:
    gi = GROUPS.index
    full = regions()["full"]
    data: dict = {"skins": [], "faces": [], "hairs": [], "outfits": [], "accs": []}
    for label, n in SKINS:
        img = load(f"main/body/{n}.png")
        ent = rig_layer(atlas, img, "skin")
        ent["head"] = atlas.add(cut(img, full == gi("head")))
        data["skins"].append(ent)
        print("skin", label)
    for label, pu, la, br, mo in FACES:
        img = blank()
        for p in (f"main/PUPILS/{pu}.png", f"main/EYELASHES/{la}.png", f"main/EYEBROWS/{br}.png", f"main/MOUTH/{mo}.png"):
            img = over(img, load(p))
        data["faces"].append(atlas.add(img))
    for label, bangs, cap, back in HAIRS:
        data["hairs"].append(
            {
                "front": atlas.add(hair_front(bangs, cap)),
                "back": atlas.add(load(back)) if back else -1,
                "up": atlas.add(hair_up(cap, back)),
            }
        )
        print("hair", label)
    for label, parts, _fem in OUTFITS:
        low, high = [], []
        if "bottom" in parts:
            low.append(rig_layer(atlas, layer(parts["bottom"]), "pants"))
        if "shoes" in parts:
            low.append(rig_layer(atlas, layer(parts["shoes"]), "shoes"))
        if "skirt" in parts:
            high.append(rig_layer(atlas, layer(parts["skirt"]), "top", sway=True))
        if "dress" in parts:
            high.append(rig_layer(atlas, layer(parts["dress"]), "top", sway=True))
        if "top" in parts:
            high.append(rig_layer(atlas, layer(parts["top"]), "top"))
        data["outfits"].append({"low": low, "high": high})
        print("outfit", label)
    for label, kind in ACCESSORIES:
        data["accs"].append({k: atlas.add(v) for k, v in acc_layers(kind).items()})
    return data


def cmd_build() -> None:
    atlas = Atlas()
    data = build_data(atlas)
    sheet, rects = atlas.pack()
    os.makedirs(ASSETS, exist_ok=True)
    sheet.save(os.path.join(ASSETS, "atlas.png"), optimize=True)
    meta = {
        "v": 1,
        "w": W,
        "h": H,
        "footY": FOOT_Y,
        "rects": rects,
        "poses": POSES,
        **data,
    }
    with open(os.path.join(ASSETS, "atlas.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, separators=(",", ":"))
    write_catalog()
    size = os.path.getsize(os.path.join(ASSETS, "atlas.png"))
    print(f"atlas {sheet.size} {len(rects)} cells, {size / 1024:.0f} KB; frame {W}x{H} footY {FOOT_Y}")


def write_catalog() -> None:
    j = lambda v: json.dumps(v, ensure_ascii=False)
    head_top = round((HEAD_TOP_SRC - Y0) * SCALE)
    lines = [
        "/* 자동 생성 — art/chibi/build.py build (직접 고치지 말 것). 이름·개수·치수만 담는다 (이미지는 assets/, 저장소 밖) */",
        "",
        f"export const CHIBI_W = {W}",
        f"export const CHIBI_H = {H}",
        "/** 위에서 발밑(접지선)까지 */",
        f"export const CHIBI_FOOT_Y = {FOOT_Y}",
        "/** 위에서 맨머리 꼭대기까지 (머리카락·장식 제외) */",
        f"export const CHIBI_HEAD_TOP = {head_top}",
        "/** assets/atlas.json 의 판 번호 — 어긋나면 load() 가 거절한다 */",
        "export const CHIBI_ATLAS_V = 1",
        "",
        "export const SKINS: readonly { label: string; hex: string }[] = [",
        *[f"  {{ label: {j(l)}, hex: {j(skin_hex(n))} }}," for l, n in SKINS],
        "]",
        "export const FACES: readonly { label: string }[] = [",
        *[f"  {{ label: {j(f[0])} }}," for f in FACES],
        "]",
        "/** 앞의 SHORT_HAIRS 개가 짧은 머리, 나머지가 긴 머리 */",
        "export const HAIRS: readonly { label: string }[] = [",
        *[f"  {{ label: {j(h[0])} }}," for h in HAIRS],
        "]",
        f"export const SHORT_HAIRS = {SHORT_HAIRS}",
        "/** 머리 색: 흑백 선화의 밝기로 fill(채움) ↔ line(선) 을 섞어 칠한다 */",
        "export const HAIR_COLORS: readonly { label: string; hex: string; line: string }[] = [",
        *[f"  {{ label: {j(l)}, hex: {j(f)}, line: {j(ln)} }}," for l, f, ln in HAIR_COLORS],
        "]",
        "/** 0 = 신랑(턱시도), 1 = 신부(웨딩드레스). female = 원피스·치마 차림 */",
        "export const OUTFITS: readonly { label: string; female: boolean }[] = [",
        *[f"  {{ label: {j(o[0])}, female: {j(o[2])} }}," for o in OUTFITS],
        "]",
        "/** 액세서리 (외형의 accessory = 이 목록의 번호 + 1, 0 = 없음). 마지막(면사포)은 신부 몫 */",
        "export const ACCESSORIES: readonly { label: string }[] = [",
        *[f"  {{ label: {j(a[0])} }}," for a in ACCESSORIES],
        "]",
        "/** 고정 캐릭터의 외형 (face 는 outfitColor 칸) */",
        f"export const GROOM = {j(GROOM)} as const",
        f"export const BRIDE = {j(BRIDE)} as const",
        "",
    ]
    with open(os.path.join(STYLE_DIR, "catalog.ts"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


# ── 조합 (앱의 index.ts 와 같은 규칙 — 확인용) ───────────────────────


class Composer:
    def __init__(self):
        with open(os.path.join(ASSETS, "atlas.json"), encoding="utf-8") as f:
            self.m = json.load(f)
        self.sheet = Image.open(os.path.join(ASSETS, "atlas.png")).convert("RGBA")
        self.tints: dict = {}

    def cell(self, r: int) -> Image.Image:
        x, y, w, h, _, _ = self.m["rects"][r]
        return self.sheet.crop((x, y, x + w, y + h))

    def tinted(self, r: int, color: int) -> Image.Image:
        key = (r, color)
        if key not in self.tints:
            a = np.asarray(self.cell(r), dtype=np.float32) / 255
            g = a[..., :3].mean(-1, keepdims=True)
            _, fill, line = HAIR_COLORS[color]
            a[..., :3] = hexrgb(line) * (1 - g) + hexrgb(fill) * g
            self.tints[key] = Image.fromarray((a * 255 + 0.5).astype(np.uint8), "RGBA")
        return self.tints[key]

    def sprite(self, look: dict, direction: str, frame: int, mirror_down: bool = False) -> Image.Image:
        m = self.m
        up = direction == "up"
        pose = m["poses"]["side" if direction in ("left", "right") else "down"][frame]
        flip = direction == "left" or up or (direction == "down" and mirror_down)
        out = Image.new("RGBA", (m["w"], m["h"]), (0, 0, 0, 0))
        sh = Image.new("RGBA", out.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse([m["w"] / 2 - 30, m["footY"] - 7, m["w"] / 2 + 30, m["footY"] + 4], fill=(70, 50, 40, 50))
        out.alpha_composite(sh)

        def put(r, dx=0, dy=0, tint=None):
            if r is None or r < 0:
                return
            im = self.tinted(r, tint) if tint is not None else self.cell(r)
            layer_ = Image.new("RGBA", out.size, (0, 0, 0, 0))
            layer_.paste(im, (m["rects"][r][4] + dx, m["rects"][r][5] + dy))
            out.alpha_composite(layer_)

        def var(ent, name, v):
            ids = ent.get(name)
            return ids[min(v, len(ids) - 1)] if ids else -1

        skin = m["skins"][look["skin"]]
        outfit = m["outfits"][look["outfit"]]
        hair = m["hairs"][look["hairStyle"]]
        acc = m["accs"][look["accessory"] - 1] if look["accessory"] > 0 else {}
        hc = look["hairColor"]
        dy, hx, hy = pose["dy"], pose["hx"], pose["hy"]
        if not up:
            put(hair["back"], 0, hy, hc)  # 뒷머리는 좌우 흔들림을 따라가지 않는다 (살짝 늦게 따라오는 느낌)
            put(acc.get("back"), 0, dy)
        put(var(skin, "body", 0), 0, dy)
        for ly in outfit["low"]:
            put(var(ly, "body", 0), 0, dy)
        for i, side in ((1, "legR"), (0, "legL")):
            v = pose["l"][i]
            put(var(skin, side, v))
            for ly in outfit["low"]:
                put(var(ly, side, v))
        for ly in outfit["high"]:
            put(var(ly, "body", pose["b"]), 0, dy)
        for i, side in ((1, "armR"), (0, "armL")):
            v = pose["a"][i]
            put(var(skin, side, v), 0, dy)
            for ly in outfit["low"] + outfit["high"]:
                put(var(ly, side, v), 0, dy)
        if up:
            put(acc.get("upBody"), 0, dy)
            put(hair["up"], hx, hy, hc)
            put(acc.get("up"), hx, hy)
        else:
            put(skin["head"], hx, hy)
            put(acc.get("face"), hx, hy)
            put(m["faces"][look["face"]], hx, hy)
            put(hair["front"], hx, hy, hc)
            put(acc.get("front"), hx, hy)
        return out.transpose(Image.FLIP_LEFT_RIGHT) if flip else out


BG = (236, 240, 226, 255)


def sample_looks() -> list[tuple[str, dict, bool]]:
    g = lambda **k: k
    return [
        ("groom", dict(GROOM), False),
        ("bride", dict(BRIDE), True),
        ("guest1", g(skin=1, hairStyle=1, hairColor=0, outfit=2, face=0, accessory=1), False),
        ("guest2", g(skin=0, hairStyle=10, hairColor=3, outfit=10, face=3, accessory=2), False),
        ("guest3", g(skin=3, hairStyle=3, hairColor=1, outfit=4, face=4, accessory=0), False),
        ("guest4", g(skin=2, hairStyle=11, hairColor=5, outfit=13, face=7, accessory=3), False),
        ("guest5", g(skin=5, hairStyle=5, hairColor=7, outfit=7, face=6, accessory=0), False),
        ("guest6", g(skin=1, hairStyle=14, hairColor=8, outfit=11, face=2, accessory=7), False),
    ]


def cmd_proof(outdir: str) -> None:
    os.makedirs(outdir, exist_ok=True)
    c = Composer()
    looks = sample_looks()
    dirs = ["down", "left", "right", "up"]
    small = 0.42  # 지도에서의 크기(약 97px 높이 = 논리 49px x dpr 2)에 가까운 축소
    sw, sh_ = round(W * small), round(H * small)
    cols = len(dirs) * 3
    sheet = Image.new("RGBA", (cols * W + 8, len(looks) * (H + sh_ + 10)), BG)
    for r, (_, look, mir) in enumerate(looks):
        for d, direction in enumerate(dirs):
            for f in range(3):
                sp = c.sprite(look, direction, f, mir)
                x = (d * 3 + f) * W + 4
                y = r * (H + sh_ + 10)
                sheet.alpha_composite(sp, (x, y))
                sheet.alpha_composite(sp.resize((sw, sh_), Image.LANCZOS), (x + (W - sw) // 2, y + H + 2))
    sheet.convert("RGB").save(os.path.join(outdir, "walk.png"))
    # gif: 걷기 4박자 [1,0,2,0] — 윗줄 원래 크기, 아랫줄 지도 크기
    frames = []
    cycle = [1, 0, 2, 0]
    for t in range(16):
        direction = dirs[(t // 4) % 4]
        f = cycle[t % 4]
        fr = Image.new("RGBA", (len(looks) * W, H + sh_ + 8), BG)
        for i, (_, look, mir) in enumerate(looks):
            sp = c.sprite(look, direction, f, mir)
            fr.alpha_composite(sp, (i * W, 0))
            fr.alpha_composite(sp.resize((sw, sh_), Image.LANCZOS), (i * W + (W - sw) // 2, H + 4))
        frames.append(fr.convert("RGB"))
    # 방향마다 두 바퀴
    seq = []
    for d in range(4):
        seq += frames[d * 4 : d * 4 + 4] * 2
    seq[0].save(os.path.join(outdir, "walk.gif"), save_all=True, append_images=seq[1:], duration=170, loop=0)
    print("proof →", outdir)


def cmd_preview(out: str) -> None:
    """모든 파츠를 한 번씩: 머리 모양, 옷, 액세서리, 얼굴·피부"""
    c = Composer()
    base = dict(skin=0, hairStyle=9, hairColor=0, outfit=2, face=0, accessory=0)
    rows: list[list[Image.Image]] = []
    rows.append([c.sprite({**base, "hairStyle": i, "hairColor": i % len(HAIR_COLORS), "outfit": 2 + i % 3}, "down", 0) for i in range(len(HAIRS))])
    rows.append([c.sprite({**base, "hairStyle": i, "hairColor": i % len(HAIR_COLORS)}, "up", 0) for i in range(len(HAIRS))])
    rows.append([c.sprite({**base, "outfit": i, "hairStyle": 9 if OUTFITS[i][2] else 0}, "down", 0) for i in range(len(OUTFITS))])
    rows.append([c.sprite({**base, "outfit": i, "hairStyle": 9 if OUTFITS[i][2] else 0}, "right", 1) for i in range(len(OUTFITS))])
    rows.append(
        [c.sprite({**base, "accessory": i, "hairStyle": 2}, "down", 0) for i in range(len(ACCESSORIES) + 1)]
        + [c.sprite({**base, "accessory": i, "hairStyle": 10}, "up", 0) for i in (2, 3, 4, 7, 8)]
    )
    rows.append(
        [c.sprite({**base, "face": i, "skin": i % len(SKINS), "hairStyle": 2 + i, "hairColor": i}, "down", 0) for i in range(len(FACES))]
        + [c.sprite({**base, "skin": i, "hairStyle": 4, "outfit": 6}, "down", 0) for i in range(len(SKINS))]
    )
    n = max(len(r) for r in rows)
    sheet = Image.new("RGBA", (n * W, len(rows) * H), BG)
    for y, r in enumerate(rows):
        for x, im in enumerate(r):
            sheet.alpha_composite(im, (x * W, y * H))
    sheet.convert("RGB").save(out)
    print("preview →", out, sheet.size)


def main(argv: list[str]) -> None:
    global _collect_src
    cmd = argv[1] if len(argv) > 1 else ""
    if cmd == "collect":
        _collect_src = argv[2]
        build_data(Atlas())
        with open(os.path.join(RAW, ".gitignore"), "w", encoding="utf-8") as f:
            f.write("# 내려받은 CHIBI 팩 원본 — 재배포가 명시적으로 허용되지 않아 저장소에 올리지 않는다 (../LICENSE.md)\n*\n!.gitignore\n")
        print(f"{len(_used)} files → {RAW}")
    elif cmd == "build":
        cmd_build()
    elif cmd == "preview":
        cmd_preview(argv[2] if len(argv) > 2 else os.path.join(HERE, "preview.png"))
    elif cmd == "proof":
        cmd_proof(argv[2])
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv)
