"""Gemini 로 뽑은 시트(heads/bodies/acc)를 잘라 앱용 아틀라스로 만든다.
사용: python build.py <출력 폴더>   (pillow, numpy, scipy 필요)
출력: heads.png bodies.png acc.png (RGBA), heads-mask.png bodies-mask.png (R=머리카락 G=피부 B=옷 주색), atlas.json
"""
import sys, json, colorsys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

OUT = sys.argv[1]
K = 3  # 축소 배율 (원본의 가짜 도트 한 칸 ≈ 9px → 3px)

def load(p): return np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
def hsv(a):
    r, g, b = a[..., 0] / 255, a[..., 1] / 255, a[..., 2] / 255
    mx = np.max(a, -1) / 255; mn = np.min(a, -1) / 255; d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr = m & (mx == r); gg = m & (mx == g) & ~rr; bb = m & ~rr & ~gg
    h[rr] = ((g - b)[rr] / d[rr]) % 6; h[gg] = (b - r)[gg] / d[gg] + 2; h[bb] = (r - g)[bb] / d[bb] + 4
    return h / 6, np.where(mx > 0, d / np.maximum(mx, 1e-6), 0), mx
def bgmask(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (g > 120) & (g > r * 1.35) & (g > b * 1.35)
def components(a, minarea):
    fg = ndi.binary_opening(~bgmask(a), iterations=2)
    lab, _ = ndi.label(fg)
    out = []
    for i, sl in enumerate(ndi.find_objects(lab)):
        if (lab[sl] == i + 1).sum() >= minarea:
            out.append((sl[0].start, sl[0].stop, sl[1].start, sl[1].stop))
    out.sort(key=lambda t: (round((t[0] + t[1]) / 2 / (a.shape[0] / 8)), t[2]))
    return out
def cut(a, box, pad=6):
    y0, y1, x0, x1 = box
    y0 = max(0, y0 - pad); x0 = max(0, x0 - pad); y1 = min(a.shape[0], y1 + pad); x1 = min(a.shape[1], x1 + pad)
    c = a[y0:y1, x0:x1].copy()
    bg = bgmask(c)
    # 배경과 이어진 초록만 지운다 (안경알 같은 안쪽 초록도 배경과 같은 색이라 함께 투명)
    alpha = (~bg).astype(np.float32)
    # 초록 번짐 제거
    mxrb = np.maximum(c[..., 0], c[..., 2])
    c[..., 1] = np.where(c[..., 1] > mxrb * 1.15, mxrb, c[..., 1])
    return c, alpha, (y0, x0)
def small(rgb, alpha, extra=None):
    """미리 곱한 알파로 1/K 축소"""
    h, w = alpha.shape
    H, W = -(-h // K), -(-w // K)
    def rs(ch): return np.asarray(Image.fromarray(ch.astype(np.float32), 'F').resize((W, H), Image.BOX))
    a = rs(alpha)
    out = np.zeros((H, W, 4), np.float32)
    for i in range(3): out[..., i] = rs(rgb[..., i] * alpha) / np.maximum(a, 1e-4)
    out[..., 3] = a * 255
    ex = None
    if extra is not None:
        ex = np.zeros((H, W, 4), np.float32)
        for i in range(3): ex[..., i] = rs(extra[..., i] * alpha) / np.maximum(a, 1e-4) * 255
        ex[..., 3] = 255
    return np.clip(out, 0, 255).astype(np.uint8), (None if ex is None else np.clip(ex, 0, 255).astype(np.uint8))
def pack(items, name):
    """items: [(rgba, mask|None)] → 가로로 줄 맞춰 붙인다"""
    pad = 2; x = pad; y = pad; rowh = 0; maxw = 1024; rects = []
    for im, _ in items:
        h, w = im.shape[:2]
        if x + w + pad > maxw: x = pad; y += rowh + pad; rowh = 0
        rects.append([x, y, w, h]); x += w + pad; rowh = max(rowh, h)
    H = y + rowh + pad
    sheet = np.zeros((H, maxw, 4), np.uint8); msheet = np.zeros((H, maxw, 4), np.uint8); hasmask = False
    for (im, mk), (x, y, w, h) in zip(items, rects):
        sheet[y:y + h, x:x + w] = im
        if mk is not None: msheet[y:y + h, x:x + w] = mk; hasmask = True
    Image.fromarray(sheet).save(f'{OUT}/{name}.png', optimize=True)
    if hasmask: Image.fromarray(msheet[..., :3]).save(f'{OUT}/{name}-mask.png', optimize=True)
    return rects

meta = {'k': K}

# ── 머리 ─────────────────────────────────────────────
A = load('heads-v1.png')
boxes = components(A, 8000)
# 7번(긴 웨이브)은 아래 머리와 붙어 나왔다 → 웨이브만 살리고 아래 머리는 버린다
boxes[7] = (boxes[7][0], 948, boxes[7][2], boxes[7][3])
HEAD_NAMES = ['단정한 숏컷', '가르마', '곱슬머리', '반삭', '올백', '앞머리 단발', '긴 생머리', '긴 웨이브', '숏컷', '올림머리', '포니테일', '당고머리', '양갈래', '내린 머리']
items = []; heads = []; hair_sum = np.zeros(3); hair_n = 0; skin_sum = np.zeros(3); skin_n = 0
for bi, box in enumerate(boxes):
    c, alpha, (oy, ox) = cut(A, box)
    h, s, v = hsv(c)
    op = alpha > 0
    white = op & (s < 0.12) & (v > 0.9)
    # 두 눈의 반짝임(흰 조각) 가운데 큰 두 개의 중심 = 얼굴 기준점
    wl, wn = ndi.label(ndi.binary_dilation(white, iterations=3))
    ws = ndi.sum(white, wl, range(1, wn + 1))
    cand = [i + 1 for i in np.argsort(ws)[-6:]]
    cc_ = dict(zip(cand, ndi.center_of_mass(white, wl, cand)))
    best = None
    for i in cand:
        for j in cand:
            if i < j and abs(cc_[i][0] - cc_[j][0]) < 18 and 120 < abs(cc_[i][1] - cc_[j][1]) < 210:
                sc_ = ws[i - 1] + ws[j - 1]
                if best is None or sc_ > best[0]: best = (sc_, i, j)
    cs = [cc_[best[1]], cc_[best[2]]]
    ex = (cs[0][1] + cs[1][1]) / 2; ey = (cs[0][0] + cs[1][0]) / 2
    print(bi, 'eyes', [(round(c[1]), round(c[0])) for c in cs], 'gap', round(abs(cs[0][1] - cs[1][1])))
    yy, xx = np.mgrid[0:c.shape[0], 0:c.shape[1]]
    dx = np.abs(xx - ex); dy = yy - ey
    face_keep = ((dx > 20) & (dx < 105) & (np.abs(dy) < 42)) | ((dx < 45) & (dy > 45) & (dy < 95))  # 눈·입은 그대로
    skin = op & (v > 0.72) & (s > 0.1) & (s < 0.5) & ((h < 0.12) | (h > 0.95))
    brown = op & ((h < 0.12) | (h > 0.93)) & (v < 0.72) & (s > 0.15)
    dark = op & (v < 0.22)
    hair = (brown | dark) & ~face_keep
    # 얼굴 안쪽의 갈색 선(코·턱선)은 피부 쪽에 둔다: 피부로 둘러싸인 작은 조각 제외
    lab, n = ndi.label(hair)
    sizes = ndi.sum(hair, lab, range(1, n + 1))
    for i, sz in enumerate(sizes):
        if sz < 400: hair[lab == i + 1] = False
    # 턱 아래의 목·어깨(피부)는 지운다 — 목은 몸 그림의 것을 쓰고, 머리는 턱까지만 얹는다 (목이 두 번 그려져 길어 보이지 않게)
    below = dy > 104
    neck = ndi.binary_dilation(skin & below, iterations=5) & below
    alpha[neck] = 0
    m = np.zeros(c.shape, np.float32); m[..., 0] = hair; m[..., 1] = skin & ~hair
    hm = hair & (v > 0.3)
    hair_sum += c[hm].sum(0); hair_n += hm.sum(); skin_sum += c[skin & (v > 0.9)].sum(0); skin_n += (skin & (v > 0.9)).sum()
    im, mk = small(c, alpha, m)
    items.append((im, mk)); heads.append({'name': HEAD_NAMES[bi], 'ex': round(ex / K, 1), 'ey': round(ey / K, 1)})
for hd, r in zip(heads, pack(items, 'heads')): hd['rect'] = r
meta['heads'] = heads
meta['hairBase'] = [round(float(x)) for x in hair_sum / hair_n]
meta['skinBase'] = [round(float(x)) for x in skin_sum / skin_n]

# ── 몸(옷) ───────────────────────────────────────────
B = load('bodies-v1.png')
boxes = [b for b in components(B, 60000)]
BODY_NAMES = ['턱시도', '웨딩드레스', '네이비 정장', '그레이 정장', '가디건', '셔츠와 청바지', '핑크 원피스', '블라우스와 스커트', '여자 한복', '남자 한복', '후드티', '노랑 원피스']
assert len(boxes) == 12, len(boxes)
items = []; bodies = []
for bi, box in enumerate(boxes):
    c, alpha, _ = cut(B, box)
    # Gemini 표식(✦)이 마지막 칸 오른쪽 아래에 있다 → 옅은 흰 별은 주변 색으로 덮기 어렵다: 그대로 두되 눈에 띄면 다시 뽑는다
    h, s, v = hsv(c)
    op = alpha > 0
    skin = op & (c[..., 0] > 222) & (c[..., 1] - c[..., 2] > 11) & (c[..., 1] - c[..., 2] < 42) & (c[..., 0] - c[..., 1] > 22) & (c[..., 0] - c[..., 1] < 80)
    cloth = op & ~skin & (v > 0.12)
    # 옷의 주색 무리: (무채색 여부, 색상 12칸, 밝기 3칸) 가운데 가장 넓은 칸
    neutral = s < 0.12
    key = np.where(neutral, 100 + np.minimum((v * 3).astype(int), 2), ((h + 1 / 24) * 12).astype(int) % 12)
    ks, cnt = np.unique(key[cloth], return_counts=True)
    dom = ks[cnt.argmax()]
    if dom >= 100:
        vd = v[cloth & (key == dom)].mean(); main = cloth & (s < 0.22) & (np.abs(v - vd) < 0.3)
    else:
        hd_ = dom / 12; dh = np.abs(h - hd_); dh = np.minimum(dh, 1 - dh); main = cloth & (s > 0.06) & (dh < 0.09)
    main = ndi.binary_closing(main, iterations=2) & cloth
    lum = (c * [0.299, 0.587, 0.114]).sum(-1)
    m = np.zeros(c.shape, np.float32); m[..., 1] = skin; m[..., 2] = main
    im, mk = small(c, alpha, m)
    top = np.nonzero(alpha[:14].sum(0) > 0)[0]
    items.append((im, mk))
    bodies.append({'name': BODY_NAMES[bi], 'ax': round(float(top.mean()) / K, 1), 'lum': round(float(lum[main].mean())), 'rgb': [round(float(x)) for x in c[main].mean(0)]})
for bd, r in zip(bodies, pack(items, 'bodies')): bd['rect'] = r
meta['bodies'] = bodies

# ── 액세서리 ─────────────────────────────────────────
C = load('acc-v1.png')
ACC_NAMES = ['동그란 안경', '선글라스', '리본', '화관', '밀짚모자', '베레모', '티아라', '헤드폰']
# 원본 크기 파일은 아래쪽 절반에 머리 시트가 남아 있다 → 위쪽 4x2 칸만, 칸 단위로 잘라 쓴다 (안경처럼 가는 선도 살린다)
COLS = [301, 898, 1503, 2101]; ROWS = [(90, 380), (470, 815)]
items = []; accs = []
for ri, (y0, y1) in enumerate(ROWS):
    for ci, cx in enumerate(COLS):
        if ri == 1 and ci == 3: y1 = 852
        c = C[y0:y1, cx - 290:cx + 290].copy()
        hh, ss, vv = hsv(c)
        fg = ~bgmask(c)
        # 목 조각(피부색)·아래 머리카락(갈색)·초록 번짐 제거
        junk = (vv > 0.7) & (ss > 0.1) & (ss < 0.5) & ((hh < 0.12) | (hh > 0.95)) if ci < 3 or ri == 0 else np.zeros_like(fg)
        lowband = np.zeros_like(fg); lowband[-70:] = True
        if ri == 1: junk = junk | (lowband & ((hh < 0.12) | (hh > 0.93)) & (ss > 0.25) & (vv < 0.75)) | (lowband & (hh > 0.2) & (hh < 0.45) & (ss > 0.4))
        if ri == 0: junk = junk & (np.arange(c.shape[0])[:, None] > c.shape[0] - 110)
        fg &= ~junk
        fg = ndi.binary_opening(fg, iterations=1) | (fg & (vv < 0.5))
        lab, n = ndi.label(ndi.binary_dilation(fg, iterations=6))
        sizes = ndi.sum(fg, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, z in enumerate(sizes) if z > 1500]) & fg
        ys, xs = np.nonzero(keep)
        box = (ys.min(), ys.max() + 1, xs.min(), xs.max() + 1)
        cc = c[box[0]:box[1], box[2]:box[3]].copy(); al = keep[box[0]:box[1], box[2]:box[3]].astype(np.float32)
        mxrb = np.maximum(cc[..., 0], cc[..., 2]); cc[..., 1] = np.where(cc[..., 1] > mxrb * 1.15, mxrb, cc[..., 1])
        im, _ = small(cc, al)
        items.append((im, None)); accs.append({'name': ACC_NAMES[ri * 4 + ci]})
for ac, r in zip(accs, pack(items, 'acc')): ac['rect'] = r
meta['acc'] = accs

print(json.dumps(meta, ensure_ascii=False)[:1500])
open(f'{OUT}/atlas.ts', 'w').write('// art/gemini/build.py 가 만든 파일 — 직접 고치지 말 것\nexport const ATLAS = ' + json.dumps(meta, ensure_ascii=False, indent=1) + ' as const\n')
