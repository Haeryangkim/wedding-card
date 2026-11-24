"""Stendhal(Cabbit 풍) 의상 레이어를 앱용 아틀라스 한 장 + 메타로 다시 묶는다.

사용:  python -I build.py [출력 폴더]      (pillow, numpy 필요 — 내려받은 파일은 읽기만 하고 실행하지 않는다)
기본 출력: ../../web/src/guestbook/styles/cabbit/assets/
출력물:   atlas.png (RGBA, 알파 0/255)  ·  atlas.ts (칸 위치·색 지도)

원본: raw/data/sprites/outfit/<layer>/<NNN>.png — 144x256 = 48x64 칸 3열(걸음·정지·걸음) x 4행(뒤·오른쪽·앞·왼쪽).
하는 일:
  1. 고른 파츠만 읽어 12칸이 함께 쓰는 여백을 잘라낸다 (칸 안 위치는 메타에 남긴다).
  2. 얼굴 = head 000 + mouth 002(작은 미소, 색을 차분하게 낮춤) + eyes 017(점 눈) 을 한 장으로 합친다.
  3. 웨딩드레스(988)·면사포(991)의 분홍을 흰색 계열로, 면사포의 주황 머리 장식을 옅은 금색으로 바꾼다.
     면사포 앞모습은 가는 선뿐이라, 선 안쪽을 채운 "몸 뒤에 까는 천" 한 장을 더 만든다.
  3-1. 몸에 그려진 파란 속옷을 피부색으로 덮는다 (어깨가 드러나는 드레스 위로 비어져 나와 파란 목걸이처럼 보였다).
  4. 머리카락·옷의 "다시 칠할 색" 마다 밝기 순위(넓이로 고르게 편 0~1 값)를 계산해 메타에 적는다.
     앱은 이 값으로 목표 색 띠(ramp)를 골라 칠한다 — 색조만 돌리면 검은 머리·검은 옷이 안 바뀌기 때문.
피부는 다섯 색(SKIN)을 그대로 두고 앱이 1:1 로 바꿔 칠한다.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw', 'data', 'sprites', 'outfit')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', 'web', 'src', 'guestbook', 'styles', 'cabbit', 'assets')

CW, CH, COLS, ROWS = 48, 64, 3, 4
ATLAS_W = 640
PAD = 1

# 몸·머리가 함께 쓰는 피부 다섯 색 (어두운 순) — 앱이 정확히 이 색을 찾아 바꾼다
SKIN = ['56330c', '794833', 'a86a52', 'c28d56', 'd2a975']

MOUTH_LINE = '8a3226'

# 머리 모양: (파일, 이름, 그대로 둘 장식 색)
HAIRS = [
    ('032', '짧은 머리', []),
    ('005', '뾰족 머리', []),
    ('043', '숏컷', []),
    ('007', '삐죽 머리', []),
    ('052', '곱슬 숏컷', []),
    ('020', '단발', []),
    ('041', '풍성한 단발', []),
    ('002', '양갈래 번', ['8dc6e8']),
    ('050', '올림머리', ['9d6691', 'cf95c1']),
    ('021', '포니테일', ['3a3500', '726500', 'aa9600', 'e2c600']),
    ('008', '옆 포니테일', ['555555', '939393']),
    ('022', '리본 머리', ['610000', '6e252d', '8c353e', 'b24651', 'cb6266', 'e97e7a', 'f49892', 'fabbab']),
    ('001', '긴 포니테일', ['184849', '308d90', '57c3c7', '9cdcde']),
    ('016', '긴 머리', []),
    ('048', '긴 생머리', []),
    ('047', '긴 웨이브', []),
    ('053', '긴 레이어드', []),
]

# 웨딩드레스·면사포의 분홍 → 흰색 띠 (밝기 순서대로 대응)
WHITE_RAMP = ['a99fbe', 'c9c2da', 'd9d4e6', 'e6e2f0', 'f1eef7', 'f8f6fb', 'fcfbfe', 'ffffff']
GOWN_PINK = ['e1a4cd', 'e9b1d6', 'ebb3d8', 'f2bfe0', 'fcceed', 'ffe5ff', 'ffebff', 'ffffff']
VEIL_PINK = {'b34f99': 'a99fbe', 'd279b4': 'cfc8de', 'd28ebb': 'dcd7e8', 'f2bfe0': 'e9e6f2', 'fcceed': 'f3f1f8', 'ffe5ff': 'fbfaff', 'ffffff': 'ffffff'}
# 면사포의 머리 장식: 진한 주황(불꽃처럼 보인다) → 옅은 금색
VEIL_TIARA = {'bb5e00': 'b0843a', 'cc3c00': 'cfa24c', 'e07d1b': 'e6c46c', 'e0bb1b': 'f4de92', 'e0de7c': 'fff4c4'}
# 면사포 앞모습에서 몸 뒤에 까는 천의 색
VEIL_FILL = 'f3f1f8'
# 몸에 그려진 속옷 (파랑, 어두운 순) → 피부색 (SKIN 의 색이라 피부를 바꿔 칠할 때 함께 바뀐다)
UNDERWEAR = {'000039': SKIN[1], '00006a': SKIN[2], '0000a8': SKIN[3]}

# 의상: (파일, 이름, 몸 0=남 1=여, 다시 칠할 주색 목록, 띠에서 쓸 구간)
#  주색이 아닌 색(셔츠·구두·단추 등)은 그대로 둔다. 0·1번은 신랑·신부 옷.
OUTFITS = [
    ('987', '턱시도', 0, ['000000', '0d0d0d', '0e0e0e', '171717', '1c1c1c', '1f1f1f', '363636'], (0.0, 0.8)),
    ('988', '웨딩드레스', 1, WHITE_RAMP, (0.42, 1.0)),
    ('053', '정장 조끼', 0, ['563400', '88573e'], (0.1, 0.8)),
    ('977', '웨이터 조끼', 0, ['292929', '414141', '525252', '595959', '6a6a6a'], (0.1, 0.85)),
    ('968', '다크 재킷', 0, ['272e30', '34464a', '4b615f', '597c78'], (0.15, 0.9)),
    ('006', '재킷과 청바지', 0, ['000000', '050505', '161616', '303030', '494949', '4b4b4b'], (0.0, 0.85)),
    ('005', '줄무늬 티', 0, ['183649', '214963', '295a79'], (0.15, 0.85)),
    ('054', '단추 셔츠', 0, ['781d1d', '9d2626', 'ad2a2a', 'c42f2f', 'cf3a3a'], (0.2, 0.95)),
    ('010', '티셔츠와 반바지', 0, ['0e383d', '185b63', '1e747f'], (0.15, 0.85)),
    ('033', '멜빵바지', 0, ['2e43c1', '4a71ac', '5d83bb', '71a2ec'], (0.3, 1.0)),
    ('017', '슬립 드레스', 1, ['010000', '300707', '931616', 'e13838'], (0.0, 1.0)),
    ('018', '퍼프 원피스', 1, ['803d7c', 'a24f9d', 'ba5ab4', 'd465cd', 'f178ea'], (0.2, 1.0)),
    ('024', '물방울 원피스', 1, ['530811', '800e1b', '9f1323', 'b31528', 'cb182d'], (0.15, 0.9)),
    ('025', '멜빵 원피스', 1, ['001183', '0e2158', '1132a4', '1842bc', '1d55ce', '2165e9'], (0.15, 1.0)),
    ('971', '앞치마 원피스', 1, ['002f8e', '2c5dae', '1e73c7', '3b86eb', '3b8fe3', '67a8ea', 'b5e0ff'], (0.2, 1.0)),
    ('985', '이브닝 드레스', 1, ['010000', '101010', '1f1f1f', '333333'], (0.0, 0.9)),
    ('982', '볼 가운', 1, ['6a323d', '923e4e', 'cd649f', 'ea5aab', 'ff7fcd'], (0.15, 1.0)),
    ('981', '토끼 옷', 0, ['3a3737', '827c7c', 'b7b3b2', 'd7d3d1', 'efe9e7', 'ebebeb', 'fafafa', 'ffffff'], (0.2, 1.0)),
]

# 액세서리: (이름, 레이어, 파일) — 0번 '없음' 은 앱이 붙인다. 면사포는 맨 끝(랜덤에서 빼기 쉽게)
ACCS = [
    ('안경', 'mask', '001'),
    ('귀걸이', 'mask', '008'),
    ('베레모', 'hat', '009'),
    ('방울 비니', 'hat', '012'),
    ('중산모', 'hat', '014'),
    ('파나마 모자', 'hat', '011'),
    ('깃털 페도라', 'hat', '017'),
    ('산타 모자', 'hat', '999'),
    ('왕관', 'hat', '988'),
    ('분홍 풍선', 'detail', '001'),
    ('하얀 풍선', 'detail', '002'),
    ('면사포', 'hat', '991'),
]


def load(layer, name):
    a = np.asarray(Image.open(os.path.join(RAW, layer, name + '.png')).convert('RGBA')).copy()
    assert a.shape == (CH * ROWS, CW * COLS, 4), (layer, name, a.shape)
    assert set(np.unique(a[..., 3]).tolist()) <= {0, 255}, (layer, name)
    a[a[..., 3] == 0] = 0
    return a


def rgb(h):
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def ints(a):
    """픽셀마다 0xRRGGBB (투명은 -1)"""
    v = (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2].astype(np.int64)
    return np.where(a[..., 3] > 0, v, -1)


def swap(a, mapping):
    v = ints(a)
    out = a.copy()
    for src, dst in mapping.items():
        out[v == int(src, 16), :3] = rgb(dst)
    return out


def over(*layers):
    out = layers[0].copy()
    for l in layers[1:]:
        m = l[..., 3] > 0
        out[m] = l[m]
    return out


def lum(c):
    r, g, b = (c >> 16) & 255, (c >> 8) & 255, c & 255
    return 0.299 * r + 0.587 * g + 0.114 * b


def ranks(a, colours, trange=(0.0, 1.0), what=''):
    """colours(hex 목록)의 넓이 누적 순위(밝기 순) → [[0xRRGGBB, t], ...]. 시트에 없는 색은 건너뛴다."""
    v = ints(a)
    found = []
    for h in dict.fromkeys(colours):
        n = int((v == int(h, 16)).sum())
        if n == 0:
            print(f'  ! {what}: 색 #{h} 이 시트에 없음', file=sys.stderr)
            continue
        found.append((int(h, 16), n))
    found.sort(key=lambda t: lum(t[0]))
    total = sum(n for _, n in found)
    out, acc = [], 0
    for c, n in found:
        t = (acc + n / 2) / total
        acc += n
        out.append([c, round(trange[0] + (trange[1] - trange[0]) * t, 3)])
    return out


def veil_rear(a):
    """면사포 앞모습(행 2)의 선 안쪽을 채운 장 — 몸 뒤에 먼저 그려, 머리·어깨 옆으로 흰 천이 보이게 한다."""
    v = ints(a)
    line = np.isin(v, [int(h, 16) for h in VEIL_PINK.values()])
    out = np.zeros_like(a)
    r = 2
    for c in range(COLS):
        for y in range(CH):
            xs = np.where(line[r * CH + y, c * CW:(c + 1) * CW])[0]
            if len(xs) >= 2 and xs.max() - xs.min() >= 8:
                out[r * CH + y, c * CW + xs.min():c * CW + xs.max() + 1] = (*rgb(VEIL_FILL), 255)
    return out


def all_colours(a, keep):
    v = ints(a)
    return ['%06x' % c for c in np.unique(v[v >= 0]).tolist() if '%06x' % c not in keep]


sheets = []  # (key, rgba 144x256)


def add(a):
    sheets.append(a)
    return len(sheets) - 1


meta = {'cell': [CW, CH], 'skin': [int(h, 16) for h in SKIN]}

# 몸 (속옷이 그려져 있어 항상 옷으로 덮는다) · 얼굴
meta['bodies'] = [{'s': add(swap(load('body', f), UNDERWEAR))} for f in ('000-nonude', '002-nonude')]
# 입 = mouth 002 (윗줄 넷 + 아랫줄 둘의 작은 미소). 원래 색은 새빨간 입술이라 차분한 적갈색 한 가지로 낮춘다
#  (mouth 001 은 두 줄짜리 네모라 지도 크기에서 무표정·벌린 입처럼 보였다)
mouth = load('mouth', '002')
mouth = swap(mouth, {h: MOUTH_LINE for h in all_colours(mouth, set())})
meta['head'] = {'s': add(over(load('head', '000'), mouth, load('eyes', '017')))}

meta['hairs'] = []
for f, name, keep in HAIRS:
    a = load('hair', f)
    meta['hairs'].append({'name': name, 'src': f, 's': add(a), 'map': ranks(a, all_colours(a, set(keep)), what='hair ' + f)})

meta['outfits'] = []
for f, name, body, main, trange in OUTFITS:
    a = load('dress', f)
    if f == '988':
        a = swap(a, dict(zip(GOWN_PINK, WHITE_RAMP)))
    meta['outfits'].append({'name': name, 'src': f, 'body': body, 's': add(a), 'map': ranks(a, main, trange, what='dress ' + f)})

meta['accs'] = []
for name, layer, f in ACCS:
    a = load(layer, f)
    if (layer, f) == ('hat', '991'):
        a = swap(a, {**VEIL_PINK, **VEIL_TIARA})
    e = {'name': name, 'layer': layer, 'src': f, 's': add(a)}
    if layer == 'detail':
        e['rear'] = add(load('detail', f + '-rear'))
    elif (layer, f) == ('hat', '991'):
        e['rear'] = add(veil_rear(a))
    meta['accs'].append(e)

# ── 여백 자르기 + 선반 채우기 ─────────────────────────────
boxes = []
for a in sheets:
    m = np.zeros((CH, CW), bool)
    for r in range(ROWS):
        for c in range(COLS):
            m |= a[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW, 3] > 0
    ys, xs = np.where(m)
    boxes.append((int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)))

order = sorted(range(len(sheets)), key=lambda i: (-boxes[i][3], -boxes[i][2]))
place = {}
x = y = PAD
shelf = 0
for i in order:
    w, h = boxes[i][2] * COLS, boxes[i][3] * ROWS
    if x + w + PAD > ATLAS_W:
        x = PAD
        y += shelf + PAD
        shelf = 0
    place[i] = (x, y)
    x += w + PAD
    shelf = max(shelf, h)
atlas = np.zeros((y + shelf + PAD, ATLAS_W, 4), np.uint8)
rects = []
for i, a in enumerate(sheets):
    ox, oy, w, h = boxes[i]
    ax, ay = place[i]
    for r in range(ROWS):
        for c in range(COLS):
            atlas[ay + r * h:ay + (r + 1) * h, ax + c * w:ax + (c + 1) * w] = a[r * CH + oy:r * CH + oy + h, c * CW + ox:c * CW + ox + w]
    rects.append([ax, ay, ox, oy, w, h])
meta['size'] = [ATLAS_W, int(atlas.shape[0])]
meta['sheets'] = rects

os.makedirs(OUT, exist_ok=True)
png = os.path.join(OUT, 'atlas.png')
Image.fromarray(atlas, 'RGBA').save(png, optimize=True, compress_level=9)

HEADER = '''// art/cabbit/build.py 가 만든 파일 — 직접 고치지 말 것
/** 아틀라스 한 구역: [x, y, 칸 안 x, 칸 안 y, 칸 너비, 칸 높이] — 3열(걸음·정지·걸음) x 4행(뒤·오른쪽·앞·왼쪽) */
export type SheetRect = readonly number[]
/** [0xRRGGBB, 띠 위치 0~1] */
export type ColourRank = readonly number[]
export interface AtlasHair {
  name: string
  src: string
  s: number
  map: readonly ColourRank[]
}
export interface AtlasOutfit extends AtlasHair {
  /** 0 = 남자 몸, 1 = 여자 몸 */
  body: number
}
export interface AtlasAcc {
  name: string
  layer: string
  src: string
  s: number
  /** 몸 뒤에 먼저 그리는 장 (풍선의 뒷모습, 면사포 앞모습의 천) */
  rear?: number
}
export interface Atlas {
  cell: readonly number[]
  size: readonly number[]
  skin: readonly number[]
  sheets: readonly SheetRect[]
  bodies: readonly { s: number }[]
  head: { s: number }
  hairs: readonly AtlasHair[]
  outfits: readonly AtlasOutfit[]
  accs: readonly AtlasAcc[]
}
export const ATLAS: Atlas = '''
with open(os.path.join(OUT, 'atlas.ts'), 'w', encoding='utf-8') as fp:
    fp.write(HEADER + json.dumps(meta, ensure_ascii=False, separators=(',', ':')).replace('],"', '],\n"').replace('},{', '},\n{') + '\n')

print('atlas', atlas.shape[1], 'x', atlas.shape[0], os.path.getsize(png), 'bytes;', len(sheets), 'sheets;',
      len(meta['hairs']), 'hairs', len(meta['outfits']), 'outfits', len(meta['accs']), 'accs')
