#!/usr/bin/env python3
"""'msref' 그림체(테스트 전용) 에셋 빌드 — maplestory.io 의 아이템 레이어를 받아 로컬 아틀라스로 굽는다.

    python art/msref/build.py fetch            # catalog.json 에 적힌 아이템을 raw/ 로 내려받기 (캐시)
    python art/msref/build.py build            # 아틀라스(png) + atlas.json → web/src/guestbook/styles/msref/assets/
                                               # catalog.ts(이름·개수·치수, 이미지 없음) → web/src/guestbook/styles/msref/
    python art/msref/build.py verify [N]       # 무작위 조합 N 개(기본 24)를 API 가 직접 조합한 그림과 픽셀 비교
    python art/msref/build.py sheet <out.png>  # 로컬 조합 결과 확인용 시트
    python art/msref/build.py browse <out.png> <hair|face|outfit|acc> <id...>   # 후보 아이템을 기본 몸에 입혀 본 시트 (고르기용)
    python art/msref/build.py try <skin> <pose> <id...>         # 한 조합을 API 렌더와 비교 (개발용)

파츠 목록은 catalog.json. 검증(verify)은 신랑·신부의 모든 자세 + 무작위 조합 + 파츠마다 한 번씩을 본다.

조합 규칙 (게임 데이터 그대로):
  - 몸(body)의 origin 을 (0,0) = 발밑으로 두고, 각 레이어는 공유 기준점(navel/neck/brow/hand)으로 맞춘다.
        topLeft = anchorWorld - layer.map[anchor] - layer.origin
  - 그리는 순서는 zmap(뒤→앞), 가려지는 레이어는 smap + 아이템 vslot 로 정한다 (모자가 윗머리를 숨기는 식).
내려받은 그림은 타사 게임 리소스다 — raw/ 와 assets/ 는 .gitignore 로 저장소에서 빠져 있다.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import random
import sys

sys.dont_write_bytecode = True

import numpy as np
from PIL import Image

import msapi

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
STYLE_DIR = os.path.join(ROOT, "web", "src", "guestbook", "styles", "msref")
ASSETS = os.path.join(STYLE_DIR, "assets")
CATALOG = os.path.join(HERE, "catalog.json")

# 쓰는 동작: (action, frame 수)
ACTIONS = (("stand1", 3), ("walk1", 4))
POSES = [f"{a}:{i}" for a, n in ACTIONS for i in range(n)]


def load_catalog() -> dict:
    with open(CATALOG, encoding="utf-8") as f:
        return json.load(f)


# ── 원본 데이터 → 레이어 ─────────────────────────────────────────────


def _png(b64: str) -> Image.Image:
    return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGBA")


def _pt(v: dict) -> tuple[int, int]:
    return int(v["x"]), int(v["y"])


def wz_canvas(path: str) -> dict:
    """WZ 캔버스 노드 → {img, origin, z, map}"""
    node = msapi.wz(path)
    if not node or not isinstance(node.get("value"), str):
        raise RuntimeError(f"no canvas at {path}")
    out = {"img": _png(node["value"]), "origin": (0, 0), "z": None, "map": {}}
    ch = node["children"]
    if "origin" in ch:
        out["origin"] = _pt(msapi.wz(path + "/origin")["value"])
    if "z" in ch:
        out["z"] = msapi.wz(path + "/z")["value"]
    if "map" in ch:
        for k in msapi.wz(path + "/map")["children"]:
            out["map"][k] = _pt(msapi.wz(f"{path}/map/{k}")["value"])
    return out


_smap: dict[str, list[str]] = {}


def smap(z: str) -> list[str]:
    """레이어 z 이름이 차지하는 슬롯들 (2글자씩)"""
    if z not in _smap:
        node = msapi.wz(f"Base/smap.img/{z}")
        v = node.get("value") if node else ""
        v = v if isinstance(v, str) else ""
        _smap[z] = [v[i : i + 2] for i in range(0, len(v), 2)]
    return _smap[z]


class Piece:
    """아이템(또는 몸·머리) 하나: 포즈별 레이어 목록"""

    def __init__(self, pid: int, name: str, islot: str, vslot: list[str]):
        self.id = pid
        self.name = name
        self.islot = islot
        self.vslot = vslot
        # pose -> [ {img, origin, map, z} ]
        self.layers: dict[str, list[dict]] = {p: [] for p in POSES}


_pieces: dict[int, Piece] = {}


def skin_pieces(skin_id: int) -> tuple[Piece, Piece]:
    """(몸, 머리). 머리는 모든 포즈에서 front/head 한 장"""
    head_id = 10000 + skin_id
    if skin_id in _pieces:
        return _pieces[skin_id], _pieces[head_id]
    body = Piece(skin_id, f"body{skin_id}", "Bd", ["Bd"])
    head = Piece(head_id, f"head{head_id}", "Hd", ["Hd"])
    jobs = [(a, i) for a, n in ACTIONS for i in range(n)]

    def one(job):
        a, i = job
        base = f"Character/{skin_id:08d}.img/{a}/{i}"
        node = msapi.wz(base)
        parts = [c for c in node["children"] if c not in ("delay", "face")]
        return [dict(wz_canvas(f"{base}/{c}"), name=c) for c in parts]

    for (a, i), layers in zip(jobs, msapi.pmap(one, jobs)):
        body.layers[f"{a}:{i}"] = layers
    hd = dict(wz_canvas(f"Character/{head_id:08d}.img/front/head"), name="head")
    for p in POSES:
        head.layers[p] = [hd]
    _pieces[skin_id] = body
    _pieces[head_id] = head
    return body, head


def item_piece(item_id: int) -> Piece | None:
    if item_id in _pieces:
        return _pieces[item_id]
    d = msapi.item_json(item_id)
    if not d:
        return None
    meta = d.get("metaInfo") or {}
    islots = meta.get("islots") or [""]
    piece = Piece(item_id, (d.get("description") or {}).get("name") or str(item_id), islots[0], meta.get("vslots") or [])
    fbs = d["frameBooks"]
    is_face = (d.get("typeInfo") or {}).get("subCategory") == "Face"
    for a, n in ACTIONS:
        for i in range(n):
            if is_face:
                fb = fbs.get("default")
                fr = fb["frames"][0] if fb else None
            else:
                fb = fbs.get(a) or fbs.get("default")
                frames = fb["frames"] if fb else []
                fr = frames[i] if i < len(frames) else (frames[0] if frames else None)
            layers = []
            for name, eff in ((fr or {}).get("effects") or {}).items():
                if not eff.get("image") or not eff.get("position"):
                    continue
                layers.append(
                    {
                        "name": name,
                        "img": _png(eff["image"]),
                        "origin": _pt(eff["origin"]),
                        "z": eff["position"],
                        "map": {k: _pt(v) for k, v in (eff.get("mapOffset") or {}).items()},
                    }
                )
            piece.layers[f"{a}:{i}"] = layers
    _pieces[item_id] = piece
    return piece


# ── 조합 ─────────────────────────────────────────────────────────────

_zmap: list[str] | None = None


def zindex(z: str) -> int:
    global _zmap
    if _zmap is None:
        _zmap = msapi.zmap()
    return _zmap.index(z) if z in _zmap else -1


def place(skin_id: int, pose: str, piece: Piece) -> list[dict]:
    """piece 의 pose 레이어들을 몸 기준 좌표로: [{img, x, y, z, zi, slots}]"""
    body, head = skin_pieces(skin_id)
    anchors: dict[str, tuple[int, int]] = {}
    placed: dict[int, list[dict]] = {}
    for src in (body, head):
        out = []
        # 몸통(body) 먼저 — navel/neck 을 만든 뒤 팔·머리를 붙인다
        for ly in sorted(src.layers[pose], key=lambda l: 0 if l["name"] == "body" else 1):
            if ly["name"] == "body":
                tl = (-ly["origin"][0], -ly["origin"][1])
            else:
                a = next(k for k in ly["map"] if k in anchors)
                tl = (anchors[a][0] - ly["map"][a][0] - ly["origin"][0], anchors[a][1] - ly["map"][a][1] - ly["origin"][1])
            for k, m in ly["map"].items():
                anchors.setdefault(k, (tl[0] + ly["origin"][0] + m[0], tl[1] + ly["origin"][1] + m[1]))
            out.append({"img": ly["img"], "x": tl[0], "y": tl[1], "z": ly["z"], "zi": zindex(ly["z"]), "slots": smap(ly["z"])})
        placed[src.id] = out
    if piece.id in placed:
        return placed[piece.id]
    out = []
    for ly in piece.layers[pose]:
        a = next((k for k in ly["map"] if k in anchors), None)
        if a is None:
            raise RuntimeError(f"{piece.id} {pose} {ly['name']}: no known anchor in {list(ly['map'])}")
        tl = (anchors[a][0] - ly["map"][a][0] - ly["origin"][0], anchors[a][1] - ly["map"][a][1] - ly["origin"][1])
        out.append({"img": ly["img"], "x": tl[0], "y": tl[1], "z": ly["z"], "zi": zindex(ly["z"]), "slots": smap(ly["z"])})
    return out


def slot_owner(pieces: list[Piece]) -> dict[str, int]:
    """슬롯 → 차지한 아이템. islot 의 zmap 순서(Bd, Hd, Hr, Fc, … Cp, … Pn, … Ma)로 돌며 나중 것이 덮어쓴다"""
    owner: dict[str, int] = {}
    for p in sorted(pieces, key=lambda p: zindex(p.islot[:2]) if p.islot else 999):
        for s in p.vslot:
            owner[s] = p.id
    return owner


def visible(layer: dict, piece: Piece, owner: dict[str, int]) -> bool:
    # 레이어가 쓰는 슬롯 가운데 "이 아이템이 원래 차지하는" 슬롯을 다른 아이템에 뺏겼으면 숨긴다
    return all(owner.get(s, piece.id) == piece.id for s in layer["slots"] if s in piece.vslot)


def compose(skin_id: int, item_ids: list[int], pose: str) -> tuple[Image.Image, tuple[int, int]]:
    """(그림, 그림 왼쪽 위의 몸 기준 좌표). API 렌더와 같은 결과가 나와야 한다"""
    body, head = skin_pieces(skin_id)
    pieces = [body, head] + [p for p in (item_piece(i) for i in item_ids) if p]
    owner = slot_owner(pieces)
    layers = []
    for order, p in enumerate(pieces):
        for ly in place(skin_id, pose, p):
            if visible(ly, p, owner):
                layers.append((ly["zi"], order, ly))
    layers.sort(key=lambda t: (t[0], t[1]))
    x0 = min(l["x"] for _, _, l in layers)
    y0 = min(l["y"] for _, _, l in layers)
    x1 = max(l["x"] + l["img"].width for _, _, l in layers)
    y1 = max(l["y"] + l["img"].height for _, _, l in layers)
    canvas = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
    for _, _, l in layers:
        tmp = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        tmp.paste(l["img"], (l["x"] - x0, l["y"] - y0))
        canvas = Image.alpha_composite(canvas, tmp)
    return canvas, (x0, y0)


def crop(img: Image.Image) -> Image.Image:
    box = img.getchannel("A").getbbox()
    return img.crop(box) if box else img


def diff(a: Image.Image, b: Image.Image) -> tuple[bool, str]:
    """투명 여백을 잘라 낸 뒤 픽셀 비교"""
    a, b = crop(a), crop(b)
    if a.size != b.size:
        return False, f"size {a.size} vs {b.size}"
    x = np.asarray(a).astype(int)
    y = np.asarray(b).astype(int)
    vis = (x[..., 3] > 0) | (y[..., 3] > 0)
    d = np.abs(x - y)
    d[~vis] = 0
    bad = int((d.max(axis=2) > 2).sum())
    return bad == 0, f"max {int(d.max())}, pixels off by >2: {bad}/{int(vis.sum())}"


# ── 명령 ─────────────────────────────────────────────────────────────


def verify_one(skin_id: int, item_ids: list[int], pose: str) -> tuple[bool, str]:
    a, f = pose.split(":")
    ref = msapi.render([skin_id, 10000 + skin_id] + item_ids, a, int(f))
    if ref is None:
        return False, "API render failed (400/404)"
    mine, _ = compose(skin_id, item_ids, pose)
    return diff(mine, Image.open(io.BytesIO(ref)).convert("RGBA"))


def cmd_try(args: list[str]) -> None:
    """build.py try <skin> <pose> <item...> — 한 조합을 API 렌더와 비교 (개발용)"""
    skin = int(args[0])
    pose = args[1]
    items = [int(x) for x in args[2:]]
    ok, msg = verify_one(skin, items, pose)
    print("OK " if ok else "BAD", skin, pose, items, msg)
    if not ok:
        out = os.path.join(msapi.RAW, "debug")
        os.makedirs(out, exist_ok=True)
        mine, _ = compose(skin, items, pose)
        a, f = pose.split(":")
        ref = Image.open(io.BytesIO(msapi.render([skin, 10000 + skin] + items, a, int(f)))).convert("RGBA")
        tag = "-".join(map(str, items)) + "_" + pose.replace(":", "")
        crop(mine).resize((crop(mine).width * 4, crop(mine).height * 4), Image.NEAREST).save(os.path.join(out, f"{tag}_mine.png"))
        crop(ref).resize((crop(ref).width * 4, crop(ref).height * 4), Image.NEAREST).save(os.path.join(out, f"{tag}_ref.png"))
        print("  saved", out, tag)


def _label(draw, xy, text):
    draw.text(xy, text, fill=(40, 40, 60, 255))


def cmd_browse(args: list[str]) -> None:
    """build.py browse <out.png> <hair|face|outfit|acc> <id...> — 후보를 기본 캐릭터에 입혀 본다 (고르기용)"""
    from PIL import ImageDraw

    out, kind = args[0], args[1]
    groups = [[int(x) for x in a.split("+")] for a in args[2:]]
    ids = sorted({i for g in groups for i in g})

    def get(i):
        try:
            return item_piece(i) is not None
        except Exception as e:  # noqa: BLE001
            print("skip", i, e)
            return False

    # 내려받기는 병렬, 파싱은 캐시에서
    msapi.pmap(lambda i: msapi.item_json(i) if True else None, ids)
    ok = {i: get(i) for i in ids}
    base = {"face": 20000, "hair": 30000, "outfit": [1040002, 1060002]}
    cell_w, cell_h = 76, 112
    sc, cols = int(os.environ.get("SC", "2")), int(os.environ.get("COLS", "14"))
    good = [g for g in groups if all(ok.get(i) for i in g)]
    rows = (len(good) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell_w * sc, rows * cell_h * sc), (238, 240, 232, 255))
    draw = ImageDraw.Draw(sheet)
    for n, g in enumerate(good):
        items = [base["face"]] if kind != "face" else []
        if kind != "hair":
            items.append(31000 if kind == "acc2" else base["hair"])
        if kind != "outfit":
            items += base["outfit"]
        items += g
        try:
            img, (x0, y0) = compose(2000, items, "stand1:0")
        except Exception as e:  # noqa: BLE001
            print("compose failed", g, e)
            continue
        cx = (n % cols) * cell_w + cell_w // 2
        fy = (n // cols) * cell_h + cell_h - 16
        big = img.resize((img.width * sc, img.height * sc), Image.NEAREST)
        sheet.alpha_composite(big, ((cx + x0) * sc, (fy + y0) * sc))
        _label(draw, ((n % cols) * cell_w * sc + 4, (fy + 2) * sc), "+".join(str(i) for i in g))
        _label(draw, ((n % cols) * cell_w * sc + 4, (fy + 8) * sc), (_pieces[g[0]].name or "")[:22])
    sheet.save(out)
    print("saved", out, len(good), "of", len(groups))


# ── 카탈로그(catalog.json) ───────────────────────────────────────────

LOOK_KEYS = ("skin", "hair", "hairColor", "outfit", "face", "accessory")


def look_items(cat: dict, look: dict) -> tuple[int, list[int]]:
    """외형(인덱스) → (피부 id, 아이템 id 들). 순서: 얼굴, 머리, 옷…, 액세서리… (런타임과 같은 순서)"""
    items = [cat["faces"][look["face"]]["id"], cat["hairs"][look["hair"]]["base"] + cat["hairColors"][look["hairColor"]]["digit"]]
    items += cat["outfits"][look["outfit"]]["items"]
    if look["accessory"] > 0:
        items += cat["accessories"][look["accessory"] - 1]["items"]
    return cat["skins"][look["skin"]]["id"], items


def all_item_ids(cat: dict) -> list[int]:
    ids = [f["id"] for f in cat["faces"]]
    ids += [h["base"] + c["digit"] for h in cat["hairs"] for c in cat["hairColors"]]
    ids += [i for o in cat["outfits"] for i in o["items"]]
    ids += [i for a in cat["accessories"] for i in a["items"]]
    return list(dict.fromkeys(ids))


def random_look(cat: dict, rnd: random.Random) -> dict:
    return {
        "skin": rnd.randrange(len(cat["skins"])),
        "hair": rnd.randrange(len(cat["hairs"])),
        "hairColor": rnd.randrange(len(cat["hairColors"])),
        "outfit": rnd.randrange(len(cat["outfits"])),
        "face": rnd.randrange(len(cat["faces"])),
        "accessory": rnd.randrange(len(cat["accessories"]) + 1),
    }


def cmd_fetch(args: list[str]) -> None:
    cat = load_catalog()
    ids = all_item_ids(cat)

    def one(i):
        try:
            return i, msapi.item_json(i) is not None
        except Exception as e:  # noqa: BLE001
            print("  error", i, e)
            return i, False

    res = msapi.pmap(one, ids)
    missing = [i for i, ok in res if not ok]
    for sk in cat["skins"]:
        skin_pieces(sk["id"])
    zindex("body")
    print(f"items {len(ids) - len(missing)}/{len(ids)} ok, skins {len(cat['skins'])}")
    if missing:
        print("MISSING:", missing)
        sys.exit(1)


def cmd_verify(args: list[str]) -> None:
    """무작위 조합 + 신랑·신부를 API 가 조합한 그림과 비교"""
    n = int(args[0]) if args else 24
    seed = int(args[1]) if len(args) > 1 else 7
    cat = load_catalog()
    rnd = random.Random(seed)
    jobs = [("groom", cat["groom"], p) for p in POSES] + [("bride", cat["bride"], p) for p in POSES]
    for i in range(n):
        jobs.append((f"rand{i}", random_look(cat, rnd), rnd.choice(POSES)))
    # 빠짐없이: 파츠마다 적어도 한 번씩 (나머지 파츠·자세는 무작위)
    for key, count in (("accessory", len(cat["accessories"]) + 1), ("outfit", len(cat["outfits"])), ("hair", len(cat["hairs"])), ("skin", len(cat["skins"])), ("face", len(cat["faces"]))):
        for i in range(count):
            jobs.append((f"{key[:4]}{i}", dict(random_look(cat, rnd), **{key: i}), rnd.choice(POSES)))

    def one(job):
        name, look, pose = job
        skin, items = look_items(cat, look)
        try:
            ok, msg = verify_one(skin, items, pose)
        except Exception as e:  # noqa: BLE001
            ok, msg = None, f"could not fetch reference: {e}"
        return name, look, pose, skin, items, ok, msg

    # 레이어 캐시를 먼저 채운다 (스레드에서 같은 조각을 두 번 만들지 않도록)
    for sk in cat["skins"]:
        skin_pieces(sk["id"])
    for i in all_item_ids(cat):
        item_piece(i)
    good = bad = skipped = 0
    for name, look, pose, skin, items, ok, msg in msapi.pmap(one, jobs):
        tag = "OK  " if ok else ("SKIP" if ok is None else "BAD ")
        print(tag, f"{name:7s}", pose, skin, items, msg)
        good += ok is True
        bad += ok is False
        skipped += ok is None
    print(f"exact: {good}, different: {bad}, reference unavailable: {skipped}")
    if bad:
        sys.exit(1)


def cmd_sheet(args: list[str]) -> None:
    """build.py sheet <out.png> [what] — 카탈로그 확인용 (로컬 조합)"""
    from PIL import ImageDraw

    out = args[0]
    what = args[1] if len(args) > 1 else "all"
    cat = load_catalog()
    base = {"skin": 0, "hair": 0, "hairColor": 0, "outfit": 10, "face": 0, "accessory": 0}
    cells: list[tuple[str, dict, str]] = []
    if what in ("all", "couple"):
        for p in POSES:
            cells.append((f"groom {p}", cat["groom"], p))
        for p in POSES:
            cells.append((f"bride {p}", cat["bride"], p))
    if what in ("all", "outfit"):
        for i, o in enumerate(cat["outfits"]):
            cells.append((f"o{i} {o['items'][0]}", dict(base, outfit=i, hair=i % len(cat["hairs"]), hairColor=i % 8), "stand1:0"))
            cells.append((f"o{i} walk", dict(base, outfit=i, hair=i % len(cat["hairs"]), hairColor=i % 8), "walk1:0"))
    if what in ("all", "hair"):
        for i, h in enumerate(cat["hairs"]):
            for c in range(len(cat["hairColors"])):
                cells.append((f"h{i} c{c}", dict(base, hair=i, hairColor=c, face=i % len(cat["faces"])), "stand1:0"))
    if what in ("all", "acc"):
        for i in range(len(cat["accessories"])):
            for h in (0, 9, 13):
                cells.append((f"a{i + 1} h{h}", dict(base, accessory=i + 1, hair=h, hairColor=1), "stand1:0"))
    if what in ("all", "skin"):
        for i in range(len(cat["skins"])):
            for f in range(len(cat["faces"])):
                cells.append((f"s{i} f{f}", dict(base, skin=i, face=f, hair=7, outfit=15), "stand1:0"))
    sc, cols = int(os.environ.get("SC", "3")), int(os.environ.get("COLS", "14"))
    cw, ch = 84, 110
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cw * sc, rows * ch * sc), (238, 240, 232, 255))
    draw = ImageDraw.Draw(sheet)
    for n, (label, look, pose) in enumerate(cells):
        skin, items = look_items(cat, look)
        img, (x0, y0) = compose(skin, items, pose)
        cx = (n % cols) * cw + cw // 2
        fy = (n // cols) * ch + ch - 12
        sheet.alpha_composite(img.resize((img.width * sc, img.height * sc), Image.NEAREST), ((cx + x0) * sc, (fy + y0) * sc))
        _label(draw, ((n % cols) * cw * sc + 4, (fy + 2) * sc), label)
    sheet.save(out)
    print("saved", out, len(cells))


# ── 아틀라스 굽기 ────────────────────────────────────────────────────


def _hex(rgb) -> str:
    return "#%02x%02x%02x" % tuple(int(round(v)) for v in rgb[:3])


def hair_swatch(pieces: list[Piece]) -> str:
    """색상칩: 머리 모양마다 중간 밝기 색을 구해 그 중앙값 (모양마다 색조가 조금씩 달라서)"""
    cols = np.array([[int(_hair_mid(p)[i : i + 2], 16) for i in (1, 3, 5)] for p in pieces])
    return _hex(np.median(cols, axis=0))


def _hair_mid(piece: Piece) -> str:
    px = []
    for ly in piece.layers["stand1:0"]:
        a = np.asarray(ly["img"]).reshape(-1, 4)
        px.append(a[a[:, 3] > 200][:, :3])
    a = np.concatenate(px).astype(float)
    lum = a @ np.array([0.299, 0.587, 0.114])
    order = np.argsort(lum)
    mid = a[order[int(len(a) * 0.45) : int(len(a) * 0.8)]]
    return _hex(mid.mean(axis=0))


def skin_swatch(head: Piece) -> str:
    a = np.asarray(head.layers["stand1:0"][0]["img"]).reshape(-1, 4)
    a = a[a[:, 3] > 200][:, :3]
    # 외곽선(어두운 픽셀)을 뺀 평균 — 가장 흔한 색만 보면 밝은 피부들이 모두 흰색으로 나온다
    lum = a.astype(float) @ np.array([0.299, 0.587, 0.114])
    return _hex(a[lum > 90].mean(axis=0))


def pack(images: list[Image.Image], width: int = 512) -> tuple[Image.Image, list[list[int]]]:
    """선반 채우기. 반환: (아틀라스, 입력 순서대로의 [x, y, w, h])"""
    order = sorted(range(len(images)), key=lambda i: (-images[i].height, -images[i].width))
    rects: list[list[int]] = [[0, 0, 0, 0] for _ in images]
    x = y = shelf = 0
    for i in order:
        im = images[i]
        if x + im.width > width:
            x = 0
            y += shelf
            shelf = 0
        rects[i] = [x, y, im.width, im.height]
        x += im.width
        shelf = max(shelf, im.height)
    atlas = Image.new("RGBA", (width, y + shelf), (0, 0, 0, 0))
    for i, im in enumerate(images):
        atlas.paste(im, (rects[i][0], rects[i][1]))
    return atlas, rects


def cmd_build(args: list[str]) -> None:
    cat = load_catalog()
    skin0 = cat["skins"][0]["id"]
    # (piece, 좌표를 잴 때 쓸 피부)
    pieces: list[tuple[Piece, int]] = []
    for sk in cat["skins"]:
        body, head = skin_pieces(sk["id"])
        pieces += [(body, sk["id"]), (head, sk["id"])]
    for i in all_item_ids(cat):
        p = item_piece(i)
        if p is None:
            raise SystemExit(f"item {i} missing — run fetch")
        pieces.append((p, skin0))

    images: list[Image.Image] = []
    index: dict[str, int] = {}
    slot_sets: list[list[str]] = []
    out_pieces: dict[str, dict] = {}
    ext = [10**6, 10**6, -(10**6), -(10**6)]
    geo0: dict[str, list] = {}
    odd_z: set = set()
    for piece, skin in pieces:
        poses_out: list = []
        for pose in POSES:
            layers = []
            for ly in place(skin, pose, piece):
                if ly["zi"] < 0 and (piece.id, ly["z"]) not in odd_z:
                    # zmap 에 없는 z 이름 — API 렌더와 똑같이 맨 뒤(-1)에 그린다 (verify 로 확인)
                    odd_z.add((piece.id, ly["z"]))
                    print(f"note: {piece.id} has a layer with z '{ly['z']}' that is not in zmap; drawn at the back")
                im = ly["img"]
                key = hashlib.sha1(im.tobytes() + bytes(str(im.size), "ascii")).hexdigest()
                if key not in index:
                    index[key] = len(images)
                    images.append(im)
                if ly["slots"] not in slot_sets:
                    slot_sets.append(ly["slots"])
                layers.append([index[key], ly["x"], ly["y"], ly["zi"], slot_sets.index(ly["slots"])])
                ext = [min(ext[0], ly["x"]), min(ext[1], ly["y"]), max(ext[2], ly["x"] + im.width), max(ext[3], ly["y"] + im.height)]
            same = next((k for k, prev in enumerate(poses_out) if prev == layers), None)
            poses_out.append(same if same is not None else layers)
        # 피부색이 달라도 몸·머리의 위치는 같아야 한다 (머리·옷 좌표를 첫 피부로 재기 때문)
        if piece.islot in ("Bd", "Hd"):
            shape = [[[l[1], l[2], l[3]] for l in (poses_out[p] if isinstance(p, int) else p)] for p in poses_out]
            if geo0.setdefault(piece.islot, shape) != shape:
                raise SystemExit(f"skin {piece.id}: geometry differs from the first skin")
        out_pieces[str(piece.id)] = {"o": zindex(piece.islot[:2]) if piece.islot else 999, "v": piece.vslot, "p": poses_out}

    # 가로 중심축: 첫 피부의 맨몸(몸+머리, 정지 자세) 가운데
    bare, (bx, _by) = compose(skin0, [], "stand1:0")
    axis = int(round(bx + bare.width / 2))
    half = max(axis - ext[0], ext[2] - axis) + 1
    w = half * 2
    top = -ext[1] + 1
    bottom = max(0, ext[3]) + 1
    h = top + bottom
    cx = half - axis  # 몸 origin 의 캔버스 x
    foot_y = top  # 몸 origin(발밑) 의 캔버스 y
    head_top = -min(l["y"] for l in place(skin0, "stand1:0", skin_pieces(skin0)[1]))

    atlas, rects = pack(images)
    os.makedirs(ASSETS, exist_ok=True)
    atlas_path = os.path.join(ASSETS, "atlas.png")
    atlas.save(atlas_path, optimize=True)
    meta = {
        "v": 1,
        "w": w,
        "h": h,
        "cx": cx,
        "footY": foot_y,
        "poses": POSES,
        "rects": rects,
        "slotSets": slot_sets,
        "pieces": out_pieces,
    }
    json_path = os.path.join(ASSETS, "atlas.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, separators=(",", ":"))

    # catalog.ts — 이름·번호·치수뿐 (이미지 없음). 에셋이 없어도 타입체크·정규화가 되도록 저장소에 둔다
    def ts(v) -> str:
        return json.dumps(v, ensure_ascii=False)

    lines = [
        "/* 자동 생성 — art/msref/build.py build (직접 고치지 말 것). 이름·아이템 번호·치수만 담는다 (이미지는 assets/, 저장소 밖) */",
        "",
        f"export const MSREF_W = {w}",
        f"export const MSREF_H = {h}",
        "/** 위에서 발밑(접지선)까지 */",
        f"export const MSREF_FOOT_Y = {foot_y}",
        "/** 발밑에서 맨머리 꼭대기까지 (머리카락·모자 제외) */",
        f"export const MSREF_HEAD_TOP = {head_top}",
        f"export const POSES = {ts(POSES)} as const",
        "",
        "export const SKINS: readonly { label: string; id: number; hex: string }[] = [",
        *[f"  {{ label: {ts(s['label'])}, id: {s['id']}, hex: {ts(skin_swatch(skin_pieces(s['id'])[1]))} }}," for s in cat["skins"]],
        "]",
        "export const FACES: readonly { label: string; id: number }[] = [",
        *[f"  {{ label: {ts(s['label'])}, id: {s['id']} }}," for s in cat["faces"]],
        "]",
        "/** 머리 아이템 번호 = base + 색의 digit (게임 원래의 색 변형 — 틴트가 아니다) */",
        "export const HAIRS: readonly { label: string; base: number }[] = [",
        *[f"  {{ label: {ts(s['label'])}, base: {s['base']} }}," for s in cat["hairs"]],
        "]",
        "export const HAIR_COLORS: readonly { label: string; digit: number; hex: string }[] = [",
        *[
            f"  {{ label: {ts(s['label'])}, digit: {s['digit']}, hex: {ts(hair_swatch([item_piece(h['base'] + s['digit']) for h in cat['hairs']]))} }},"
            for s in cat["hairColors"]
        ],
        "]",
        "export const OUTFITS: readonly { label: string; items: readonly number[] }[] = [",
        *[f"  {{ label: {ts(s['label'])}, items: {ts(s['items'])} }}," for s in cat["outfits"]],
        "]",
        "/** 0번(없음)은 여기 없다 — accessory 인덱스 n 은 ACCESSORIES[n - 1] */",
        "export const ACCESSORIES: readonly { label: string; items: readonly number[] }[] = [",
        *[f"  {{ label: {ts(s['label'])}, items: {ts(s['items'])} }}," for s in cat["accessories"]],
        "]",
        "/** 신랑·신부: skin, hair, hairColor, outfit, face, accessory 인덱스 */",
        f"export const GROOM = {ts({k: cat['groom'][k] for k in LOOK_KEYS})} as const",
        f"export const BRIDE = {ts({k: cat['bride'][k] for k in LOOK_KEYS})} as const",
        "",
    ]
    with open(os.path.join(STYLE_DIR, "catalog.ts"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    total = os.path.getsize(atlas_path) + os.path.getsize(json_path)
    print(f"atlas {atlas.size} {len(images)} images, {os.path.getsize(atlas_path)} B; json {os.path.getsize(json_path)} B; total {total} B")
    print(f"sprite {w}x{h}, cx {cx}, footY {foot_y}, headTop {head_top}, ext {ext}, axis {axis}")


COMMANDS = {"try": cmd_try, "browse": cmd_browse, "fetch": cmd_fetch, "verify": cmd_verify, "sheet": cmd_sheet, "build": cmd_build}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(__doc__)
        sys.exit(2)
    COMMANDS[sys.argv[1]](sys.argv[2:])
