"""LPC(Liberated Pixel Cup) 시트에서 앱용 'lpc' 그림체 에셋을 만든다.

사용:  python -I build.py [--no-sa] [출력 폴더]
        (pillow, numpy 필요. 기본 출력 = web/src/guestbook/styles/lpc/assets)
입력:  raw/manifest.json + raw/spritesheets(-sa)/**/walk*.png   (64x64 칸, 9열 x 4행: 위·왼·아래·오른)
출력:  atlas.png  — 파츠별 띠(12칸 = 4방향 x 3프레임)를 빈 곳을 잘라 내고 모은 한 장
        atlas.ts   — 띠 좌표·그리는 순서(z)·다시 칠할 색 단(ramp)·파츠 목록(머리/의상 묶음/액세서리)
        credits.csv — 실제로 실린 파일의 저작자·라이선스 (앱의 크레딧 링크가 가리킬 파일)

원칙
 - 그림은 고치지 않는다. 칸을 고르고(정지 1 + 걷기 2), 빈 곳을 자르고, 눈 색만 미리 바꿔 둔다.
 - 색 바꾸기는 LPC 방식 그대로: 기준 색 단(피부 light / 머리 orange / 옷 white, 6단계)의 같은 단계끼리 맞바꾼다.
   앱은 실행 중에 이 표를 보고 픽셀 단위로 바꾼다 (파츠마다 그림 한 장만 싣는다).
 - --no-sa : CC-BY-SA 전용 파츠(정장 재킷·조끼·넥타이·티아라·모자·둥근 안경·선글라스)를 빼고 만든다.
"""
import csv
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
USE_SA = '--no-sa' not in sys.argv
OUT = ARGS[0] if ARGS else os.path.join(HERE, '..', '..', 'web', 'src', 'guestbook', 'styles', 'lpc', 'assets')

# ── 칸 고르기 ─────────────────────────────────────────────────
CELL = 64
ROW = {'up': 0, 'left': 1, 'down': 2, 'right': 3}
DIRS = ['down', 'left', 'right', 'up']  # 아틀라스 안의 방향 순서
# 프레임 0 = 정지(0열). 걷기 두 장은 서로 반대 발이 나간 칸:
# 옆모습은 보폭이 가장 넓은 1·5열, 앞·뒷모습은 한 발이 가장 많이 나온 3·7열
COLS = {'down': [0, 3, 7], 'up': [0, 3, 7], 'left': [0, 1, 5], 'right': [0, 1, 5]}
# 64x64 칸에서 실제로 쓰는 영역 (그림 중심 x=32, 발끝 y=63)
CROP_X0, CROP_X1 = 12, 52
CROP_Y0, CROP_Y1 = 6, 64
W, H = CROP_X1 - CROP_X0, CROP_Y1 - CROP_Y0

# ── 색 단 ────────────────────────────────────────────────────
def ramps(material):
    with open(os.path.join(RAW, 'palette_definitions', material, f'{material}_ulpc.json')) as f:
        return {k: [int(c[1:], 16) for c in v] for k, v in json.load(f).items()}

BODY, HAIR, CLOTH, EYE = ramps('body'), ramps('hair'), ramps('cloth'), ramps('eye')
SRC = {'skin': BODY['light'], 'hair': HAIR['orange'], 'cloth': CLOTH['white']}
EYE_SRC, EYE_DST = EYE['blue'], EYE['brown']



def mix(a, b, t):
    """두 색 단을 단계별로 섞는다 (t = b 쪽 비율)"""
    ch = lambda c, s: (c >> s) & 255
    return [sum(round(ch(x, s) * (1 - t) + ch(y, s) * t) << s for s in (16, 8, 0)) for x, y in zip(a, b)]


# LPC 의 'amber' 는 화면에서 너무 노랗게 보여서, 밝은 톤과 올리브 사이를 섞은 살구 톤을 대신 쓴다
BODY['apricot'] = mix(BODY['light'], BODY['olive'], 0.4)
SKINS = [('밝은 톤', 'light'), ('살구 톤', 'apricot'), ('웜 베이지', 'olive'), ('토프', 'taupe'), ('브론즈', 'bronze'), ('브라운', 'brown')]
# 앞의 넷이 자연스러운 어두운 색 — 하객 랜덤은 주로 이 넷에서 뽑는다 (흑청색 'raven' 은 화면에서 청록 염색으로 보여 뒤로 뺐다)
HAIR_COLORS = [
    ('블랙', 'black'), ('다크 브라운', 'dark_brown'), ('밤색', 'chestnut'), ('라이트 브라운', 'light_brown'),
    ('샌디', 'sandy'), ('금발', 'blonde'), ('진저', 'ginger'), ('레드', 'redhead'),
    ('로즈 핑크', 'rose'), ('흑청색', 'raven'), ('그레이', 'gray'), ('은발', 'white'),
]
OUTFIT_COLORS = [
    ('화이트', 'white'), ('블랙', 'black'), ('그레이', 'gray'), ('네이비', 'navy'), ('블루', 'blue'), ('스카이', 'sky'),
    ('그린', 'green'), ('옐로', 'yellow'), ('레드', 'red'), ('핑크', 'pink'), ('라벤더', 'lavender'), ('브라운', 'brown'),
]

# ── 파츠 ─────────────────────────────────────────────────────
# 머리 모양: (이름, manifest id)
HAIRS = [
    ('단정한 머리', 'hair_plain'), ('가르마', 'hair_parted3'), ('삐죽 머리', 'hair_cowlick'), ('커튼 뱅', 'hair_curtains'),
    ('반삭', 'hair_buzzcut'), ('짧은 곱슬', 'hair_natural'), ('뽀글 머리', 'hair_curly_short'), ('아이돌 컷', 'hair_idol'),
    ('단발', 'hair_bob'), ('옆가르마 단발', 'hair_bob_side_part'), ('바가지 머리', 'hair_page'), ('중단발', 'hair_lob'),
    ('긴 생머리', 'hair_long_straight'), ('반묶음', 'hair_half_up'), ('포니테일', 'hair_high_ponytail'),
    ('똥머리', 'hair_bangs_bun'), ('땋은 머리', 'hair_princess'), ('긴 웨이브', 'hair_wavy'),
]

# 의상 묶음: (이름, 몸 'm'|'f', [(manifest id, 색)], SA 필요 여부)
#   색: 'main' = 하객이 고른 의상 색, 그 밖에는 고정 옷감 색 단 이름.
#       'a|b' = 평소엔 a, 고른 의상 색이 a 와 같으면 b (윗도리·아랫도리가 한 덩어리로 뭉개지지 않게)
#   (부츠는 원본 z 가 하의보다 위라 치마·바지 위로 올라와 보인다 — 그래서 묶음에는 쓰지 않는다)
OUTFITS = [
    ('턱시도', 'm', [('shoes_revised', 'black'), ('legs_pants', 'main'), ('shirt_buttoned', 'white'),
                  ('jacket_collared', 'main'), ('bowtie2', 'black')], True),
    ('웨딩드레스', 'f', [('shoes_revised', 'white'), ('skirt_belle', 'main'), ('blouse_longsleeve', 'main')], False),
    ('조끼 정장', 'm', [('shoes_revised', 'black'), ('legs_pants', 'charcoal|gray'), ('shirt_buttoned', 'white'),
                   ('vest', 'main'), ('necktie', 'maroon|navy')], True),
    ('멜빵 보타이', 'm', [('shoes_revised', 'brown'), ('legs_pants', 'navy|charcoal'), ('shirt_buttoned', 'main'),
                    ('suspenders', 'brown|walnut'), ('bowtie2', 'red|navy')], False),
    ('카디건', 'm', [('shoes_revised', 'brown'), ('legs_pants2', 'tan'), ('shirt_cardigan', 'main')], False),
    ('브이넥 니트', 'm', [('shoes_revised', 'black'), ('legs_pants', 'slate|charcoal'), ('shirt_vneck_long', 'main')], False),
    ('폴로 반바지', 'm', [('shoes_basic', 'white'), ('legs_shorts', 'navy|tan'), ('shirt_polo', 'main')], False),
    ('티셔츠 청바지', 'm', [('shoes_basic', 'white'), ('legs_pants2', 'blue|navy'), ('shirt_tshirt', 'main')], False),
    ('멜빵바지', 'm', [('shoes_revised', 'brown'), ('shirt_tshirt', 'white|sky'), ('overalls', 'main')], False),
    ('파티 드레스', 'f', [('shoes_revised', 'white'), ('skirt_belle', 'main'), ('shirt_sleeveless', 'main')], False),
    ('롱 드레스', 'f', [('sandals', 'tan'), ('dress_slit', 'main')], False),
    ('블라우스 스커트', 'f', [('shoes_revised', 'black'), ('skirt_straight', 'navy|charcoal'), ('blouse', 'main')], False),
    ('티셔츠 플레어스커트', 'f', [('shoes_basic', 'white'), ('skirt_plain', 'main'), ('shirt_scoop', 'white|sky')], False),
    ('카디건 스커트', 'f', [('shoes_revised', 'brown'), ('skirt_straight', 'gray|charcoal'), ('shirt_cardigan', 'main')], False),
    ('니트 바지', 'f', [('shoes_revised', 'brown'), ('legs_pants', 'slate|charcoal'), ('shirt_vneck_long', 'main')], False),
    ('티셔츠 반바지', 'f', [('shoes_basic', 'white'), ('legs_shorts', 'blue|navy'), ('shirt_tshirt', 'main')], False),
    ('멜빵바지 (슬림)', 'f', [('shoes_revised', 'brown'), ('shirt_tshirt', 'white|sky'), ('overalls', 'main')], False),
]
# SA 파츠를 못 쓸 때 신랑이 입는 묶음 이름
GROOM_FALLBACK = '멜빵 보타이'

# 액세서리: (이름, [(manifest id, 색)], SA) — 색: 'hair'·'skin'·'main'·옷감 색 단·None(그림 그대로)
ACCS = [
    ('안경', [('glasses', None)], False),
    ('동그란 안경', [('glasses_round', None)], True),
    ('선글라스', [('sunglasses', None)], True),
    ('머리띠', [('headband_thick', 'main')], False),
    ('리본', [('headband_hairtie', 'red')], False),
    ('고양이 귀', [('ears_cat', 'hair'), ('ears_cat_skin', 'skin')], False),
    ('산타 모자', [('hat_christmas', None)], False),
    ('귀걸이', [('earrings_princess', None)], False),
    ('목걸이', [('necklace_simple', None)], False),
    ('티아라', [('tiara', None)], True),
    ('실크햇', [('tophat', None)], True),
    ('중절모', [('bowler', None)], True),
]
# 모자: 이 액세서리를 쓰면 모자 위로 삐져나온 머리카락을 지운다 (모자 그림의 맨 아래 줄보다 위쪽만)
HATS = {'산타 모자', '실크햇', '중절모'}

# 여러 색 그림이 있는 파츠는 이 파일을 쓴다 (white = 옷감 기준 색 단이라 다시 칠할 수 있다)
VARIANT = {'tiara': 'tiara_gold.png', 'tophat': 'black.png', 'bowler': 'black.png'}
# 원본 시트에 찍힌 티끌 (몸에서 9px 떨어진 한 점) — (행, 열, 칸 안 x, y)
STRAY = {'spritesheets/torso/aprons/overalls/male/walk.png': [(2, 0, 50, 48)]}
FIXED = {'glasses', 'glasses_round', 'sunglasses', 'earrings_princess', 'necklace_simple', 'hat_christmas', 'tiara', 'tophat', 'bowler'}

with open(os.path.join(RAW, 'manifest.json')) as f:
    MANIFEST = json.load(f)
ITEMS = {it['id']: it for it in MANIFEST['items']}


def ramp_kind(item_id):
    if item_id in FIXED:
        return None
    if item_id in ('body', 'head_male', 'head_female', 'ears_cat_skin'):
        return 'skin'
    if item_id.startswith('hair_') or item_id == 'ears_cat':
        return 'hair'
    return 'cloth'


def files_of(item_id, sex):
    """[(z, 경로)] — 그 몸(sex)에 맞는 걷기 시트"""
    out = []
    for layer in ITEMS[item_id]['layers']:
        f = layer['files'].get('male' if sex == 'm' else 'female')
        if not f:
            raise SystemExit(f'{item_id}: {sex} 몸에 맞는 그림이 없다')
        walk = f['walk']
        want = VARIANT.get(item_id, 'white.png')
        pick = next((p for p in walk if p.endswith('/' + want)), walk[0]) if len(walk) > 1 else walk[0]
        out.append((layer['zPos'], pick))
    return out


# ── 띠 만들기 ─────────────────────────────────────────────────
strips = []  # {path, z, ramp, px(12, H, W, 4)}
strip_index = {}
stats = {'snapped': 0, 'semi': 0}


def snap(px, ramp):
    """기준 색 단에서 채널당 1 이내로 어긋난 픽셀을 정확한 색으로 맞춘다 (앱에서는 정확히 일치하는 색만 바꾼다)"""
    rgb = px[..., :3].astype(np.int16)
    for c in ramp:
        t = np.array([(c >> 16) & 255, (c >> 8) & 255, c & 255], np.int16)
        near = (np.abs(rgb - t).max(-1) <= 1) & (px[..., 3] > 0)
        exact = (rgb == t).all(-1)
        stats['snapped'] += int((near & ~exact).sum())
        px[near, :3] = t.astype(np.uint8)


def recolor(px, src, dst):
    for a, b in zip(src, dst):
        m = (px[..., 0] == (a >> 16) & 255) & (px[..., 1] == (a >> 8) & 255) & (px[..., 2] == a & 255)
        px[m, 0], px[m, 1], px[m, 2] = (b >> 16) & 255, (b >> 8) & 255, b & 255


def strip(path, z, kind, eyes=False):
    key = path
    if key in strip_index:
        return strip_index[key]
    im = np.asarray(Image.open(os.path.join(RAW, path)).convert('RGBA')).copy()
    if im.shape[0] != 4 * CELL or im.shape[1] != 9 * CELL:
        raise SystemExit(f'{path}: 걷기 시트 크기가 아니다 {im.shape}')
    im[im[..., 3] == 0] = 0
    for r, c, sx, sy in STRAY.get(path, []):
        assert im[r * CELL + sy, c * CELL + sx, 3] > 0, f'{path}: 지울 티끌이 없다'
        im[r * CELL + sy, c * CELL + sx] = 0
    if kind:
        snap(im, SRC[kind])
    if eyes:
        snap(im, EYE_SRC)
        recolor(im, EYE_SRC, EYE_DST)
    cells = []
    for d in DIRS:
        for col in COLS[d]:
            y0, x0 = ROW[d] * CELL, col * CELL
            cell = im[y0:y0 + CELL, x0:x0 + CELL]
            outside = cell.copy()
            outside[CROP_Y0:CROP_Y1, CROP_X0:CROP_X1] = 0
            if outside[..., 3].any():
                raise SystemExit(f'{path}: {d}/{col} 칸의 그림이 자르는 영역 밖으로 나간다')
            cells.append(cell[CROP_Y0:CROP_Y1, CROP_X0:CROP_X1])
    px = np.stack(cells)
    stats['semi'] += int(((px[..., 3] > 0) & (px[..., 3] < 255)).sum())
    strips.append({'path': path, 'z': z, 'ramp': kind, 'px': px})
    strip_index[key] = len(strips) - 1
    return strip_index[key]


def parts(item_id, sex, tint):
    kind = ramp_kind(item_id)
    out = []
    for z, path in files_of(item_id, sex):
        i = strip(path, z, kind, eyes=item_id.startswith('head_'))
        out.append([i, tint if kind else ''])
    return out


def sa(item_id):
    return ITEMS[item_id]['sharealike_only']


base = {
    'm': parts('body', 'm', 'skin') + parts('head_male', 'm', 'skin'),
    'f': parts('body', 'f', 'skin') + parts('head_female', 'f', 'skin'),
}
hairs = [{'label': label, 'parts': parts(i, 'f', 'hair')} for label, i in HAIRS]

outfits = []
for label, sex, pieces, needs_sa in OUTFITS:
    assert needs_sa == any(sa(i) for i, _ in pieces), label
    if needs_sa and not USE_SA:
        continue
    ps = []
    for item_id, tint in pieces:
        ps += parts(item_id, sex, tint)
    outfits.append({'label': label, 'body': sex, 'parts': ps})

accs = []
for label, pieces, needs_sa in ACCS:
    assert needs_sa == any(sa(i) for i, _ in pieces), label
    if needs_sa and not USE_SA:
        continue
    entry = {'label': label}
    for sex in 'mf':
        ps = []
        for item_id, tint in pieces:
            ps += parts(item_id, sex, tint or '')
        entry[sex] = ps
    if entry['m'] == entry['f']:
        entry = {'label': label, 'parts': entry['m']}
    if label in HATS:
        entry['hat'] = True
    accs.append(entry)

# ── 아틀라스로 모으기 ─────────────────────────────────────────
N = len(DIRS) * 3
for s in strips:
    a = s['px'][..., 3]
    ys = np.where(a.any(axis=(0, 2)))[0]
    xs = np.where(a.any(axis=(0, 1)))[0]
    s['oy'], s['h'] = int(ys[0]), int(ys[-1] - ys[0] + 1)
    s['ox'], s['w'] = int(xs[0]), int(xs[-1] - xs[0] + 1)

ATLAS_W = N * W  # 가장 넓은 띠(12칸 x 40)가 한 줄에 들어간다
order = sorted(range(len(strips)), key=lambda i: (-strips[i]['h'], -strips[i]['w']))
x = y = shelf = 0
for i in order:
    s = strips[i]
    sw = s['w'] * N
    if x + sw > ATLAS_W:
        x, y, shelf = 0, y + shelf, 0
    s['x'], s['y'] = x, y
    x += sw
    shelf = max(shelf, s['h'])
ATLAS_H = y + shelf
atlas = np.zeros((ATLAS_H, ATLAS_W, 4), np.uint8)
for s in strips:
    for c in range(N):
        atlas[s['y']:s['y'] + s['h'], s['x'] + c * s['w']:s['x'] + (c + 1) * s['w']] = \
            s['px'][c, s['oy']:s['oy'] + s['h'], s['ox']:s['ox'] + s['w']]

os.makedirs(OUT, exist_ok=True)
png = os.path.join(OUT, 'atlas.png')
colors = np.unique(atlas.reshape(-1, 4), axis=0)
if len(colors) <= 256:
    # 색이 256개 이하면 팔레트 PNG (투명도는 tRNS) — 색 값은 그대로 보존된다
    lut = {tuple(c): i for i, c in enumerate(colors.tolist())}
    idx = np.array([lut[tuple(p)] for p in atlas.reshape(-1, 4).tolist()], np.uint8).reshape(ATLAS_H, ATLAS_W)
    pim = Image.fromarray(idx, 'P')
    pim.putpalette(colors[:, :3].astype(np.uint8).tobytes())
    pim.save(png, optimize=True, transparency=bytes(colors[:, 3].astype(np.uint8).tolist()))
else:
    Image.fromarray(atlas, 'RGBA').save(png, optimize=True, compress_level=9)
check = np.asarray(Image.open(png).convert('RGBA'))
visible = atlas[..., 3] > 0
assert (check[..., 3] == atlas[..., 3]).all() and (check[visible] == atlas[visible]).all(), 'PNG 가 원본 픽셀과 다르다'

# ── 메타데이터 ────────────────────────────────────────────────
RAMP_ID = {None: 0, 'skin': 1, 'hair': 2, 'cloth': 3}
cloth_used = sorted({n for _, n in OUTFIT_COLORS}
                    | {t for o in outfits for _, tint in o['parts'] for t in tint.split('|') if t not in ('', 'main')}
                    | {t for a in accs for k in ('parts', 'm', 'f') for _, tint in a.get(k, [])
                       for t in tint.split('|') if t not in ('', 'main', 'hair', 'skin')})


def look(outfit_label, hair_id, hair_color, color, acc_label):
    names = [o['label'] for o in outfits]
    acc_names = [a['label'] for a in accs]
    return {
        'skin': 0,
        'hairStyle': [i for _, i in HAIRS].index(hair_id),
        'hairColor': [n for _, n in HAIR_COLORS].index(hair_color),
        'outfit': names.index(outfit_label),
        'outfitColor': [n for _, n in OUTFIT_COLORS].index(color),
        'accessory': acc_names.index(acc_label) + 1 if acc_label in acc_names else 0,
    }


def swatch(ramp):
    """색상칩: 색 단의 밝은 중간 단계"""
    return f'#{ramp[4]:06x}'


groom_outfit = '턱시도' if USE_SA else GROOM_FALLBACK
meta = {
    'w': W, 'h': H,
    # 땅에 닿는 줄: 서 있을 때 남자 몸의 신발은 칸의 y=61 줄, 여자 몸은 y=62 줄에서 끝난다 (앱에서 재어 본 값).
    # 3/4 시점이라 발끝이 접지선에 걸치거나 한 줄 넘는 쪽이 자연스럽다 — 한 줄 더 내리면 남자 몸이 그림자 위에 떠 보인다
    'footY': CROP_Y1 - CROP_Y0 - 2,
    'dirs': DIRS, 'frames': 3,
    # 띠: [x, y, 칸 너비, 칸 높이, 칸 안 x, 칸 안 y, 색 단(0 없음·1 피부·2 머리·3 옷감), z]
    'strips': [[s['x'], s['y'], s['w'], s['h'], s['ox'], s['oy'], RAMP_ID[s['ramp']], s['z']] for s in strips],
    'src': [[], SRC['skin'], SRC['hair'], SRC['cloth']],
    'skins': [{'label': label, 'swatch': swatch(BODY[n]), 'ramp': BODY[n]} for label, n in SKINS],
    'hairColors': [{'label': label, 'swatch': swatch(HAIR[n]), 'ramp': HAIR[n]} for label, n in HAIR_COLORS],
    'outfitColors': [{'label': label, 'swatch': '#f6f5ec' if n == 'white' else swatch(CLOTH[n]), 'cloth': n}
                     for label, n in OUTFIT_COLORS],
    'cloth': {n: CLOTH[n] for n in cloth_used},
    'base': base,
    'hairs': hairs,
    'outfits': outfits,
    'accs': accs,
    'groom': look(groom_outfit, 'hair_parted3', 'black', 'black' if USE_SA else 'white', ''),
    'bride': look('웨딩드레스', 'hair_princess', 'dark_brown', 'white', '티아라' if USE_SA else '머리띠'),
    'sharealike': USE_SA,
}


TYPES = """/** [띠 번호, 색] — 색: 'skin'·'hair'·'main'(고른 의상 색)·옷감 색 이름·'a|b'(a, 의상 색이 a 면 b)·''(그림 그대로) */
export type LpcPart = [number, string]
export interface LpcLook {
  skin: number
  hairStyle: number
  hairColor: number
  outfit: number
  outfitColor: number
  accessory: number
}
export interface LpcAtlas {
  w: number
  h: number
  footY: number
  dirs: string[]
  frames: number
  /** [x, y, 칸 너비, 칸 높이, 칸 안 x, 칸 안 y, 색 단(0 없음·1 피부·2 머리·3 옷감), z] — 한 띠는 방향 x 프레임 칸이 가로로 이어진다 */
  strips: number[][]
  /** 색 단 번호별 기준 색 6단계 (0xRRGGBB) */
  src: number[][]
  skins: { label: string; swatch: string; ramp: number[] }[]
  hairColors: { label: string; swatch: string; ramp: number[] }[]
  outfitColors: { label: string; swatch: string; cloth: string }[]
  cloth: Record<string, number[]>
  /** 몸 + 얼굴 */
  base: { m: LpcPart[]; f: LpcPart[] }
  hairs: { label: string; parts: LpcPart[] }[]
  outfits: { label: string; body: 'm' | 'f'; parts: LpcPart[] }[]
  /** parts = 두 몸 공용, 아니면 m / f. hat = 모자(위로 나온 머리카락을 가린다) */
  accs: { label: string; parts?: LpcPart[]; m?: LpcPart[]; f?: LpcPart[]; hat?: boolean }[]
  groom: LpcLook
  bride: LpcLook
  /** CC-BY-SA 전용 파츠가 실렸는지 */
  sharealike: boolean
}
"""


def dump(v, depth=0):
    """사람이 읽을 만한 한 줄 위주의 JSON"""
    if isinstance(v, dict) and depth < 1:
        return '{\n' + ',\n'.join(f' {json.dumps(k)}: {dump(x, depth + 1)}' for k, x in v.items()) + '\n}'
    if isinstance(v, list) and depth == 1 and v and isinstance(v[0], (dict, list)):
        return '[\n' + ',\n'.join('  ' + json.dumps(x, ensure_ascii=False) for x in v) + '\n ]'
    return json.dumps(v, ensure_ascii=False)


with open(os.path.join(OUT, 'atlas.ts'), 'w', encoding='utf-8') as f:
    f.write('// art/lpc/build.py 가 만든 파일 — 직접 고치지 말 것\n')
    f.write(TYPES)
    f.write('export const ATLAS: LpcAtlas = ' + dump(meta) + '\n')

# 실린 파일의 크레딧만 추린다
used = {s['path'] for s in strips}
with open(os.path.join(RAW, 'credits_files.csv'), newline='', encoding='utf-8') as f:
    rows = list(csv.reader(f))
head, body = rows[0], rows[1:]
col = next(i for i, h in enumerate(head) if any(r[i] in used for r in body))
kept = [r for r in body if r[col] in used]
missing = used - {r[col] for r in kept}
if missing:
    raise SystemExit(f'크레딧이 없는 파일: {sorted(missing)}')
with open(os.path.join(OUT, 'credits.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(head)
    w.writerows(kept)

n_sa = sum(1 for p in used if p.startswith('spritesheets-sa/'))
print(f'strips {len(strips)} (SA {n_sa}), atlas {ATLAS_W}x{ATLAS_H}, colours {len(colors)}, png {os.path.getsize(png)} bytes')
print(f'hairs {len(hairs)}, outfits {len(outfits)}, accessories {len(accs)} (+none); snapped {stats["snapped"]} px, semi-transparent {stats["semi"]} px')
