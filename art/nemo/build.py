"""nonemo "Character Creation Asset Pack"(CC0) 의 SVG 를 앱용 경로 데이터(data.ts)로 옮긴다.

사용:  python -I build.py            → ../../web/src/guestbook/styles/nemo/data.ts 를 다시 만든다 (표준 라이브러리만 사용)
       python -I build.py --preview  → 추가로 preview.png 를 다시 찍는다 (node + rolldown(web/node_modules) + Chrome, pillow 필요)
       python -I build.py --proof <폴더>  → 걷기 확인용 walk.png / walk.gif 를 그 폴더에 만든다 (같은 도구 필요)

이 그림체는 "벡터" 다 — 아틀라스 이미지를 굽지 않고, 팩의 SVG 경로(머리카락·얼굴·안경·수염)와 치수·색만 뽑아
앱이 Canvas 2D 로 직접 그린다 (팔·다리·몸통·머리를 따로 움직이는 컷아웃 리그: ../../web/src/guestbook/styles/nemo/index.ts).
원본(raw/)은 읽기만 하고 실행하지 않는다. SVG 는 정규식으로 필요한 속성만 읽는다 (XML 파서를 쓰지 않는다).

하는 일
  1. 팩의 조립 치수(머리 145x143 칸, 몸통 35x25, 팔 12x28, 다리 13x28 …)를 raw SVG 에서 읽어 GEOM 으로 낸다.
     칸끼리의 상대 위치는 팩에 적혀 있지 않아 sample.png 를 재서 정했다 (ASSEMBLY — 1.2px = 1단위).
  2. 앞머리 5종·뒷머리 3종의 경로, 얼굴(smile·cute·laughs)의 눈/입, 안경 2종, 콧수염을 그대로 옮긴다.
  3. 팩의 색(피부 3톤·머리 9색·옷 7색)을 읽어 내고, 우리가 고른 색을 더한다 (OURS_* — 한국 하객용 자연스러운 머리색 등).
  4. 팩에 없는 모양(뱅 앞머리·짧은 머리·옆가르마·긴 생머리·똥머리·포니테일·양갈래)을 같은 납작한 화풍으로 그린
     경로(OURS_FRONT / OURS_BACK)를 함께 낸다. 턱시도·웨딩드레스·후드·멜빵 등 옷과 리본·꽃·모자·면사포는
     사각형·사다리꼴 조합이라 index.ts 에서 직접 그린다 (모두 우리가 더한 것 — LICENSE.md 참고).
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw', 'SVG')
WEB = os.path.normpath(os.path.join(HERE, '..', '..', 'web'))
OUT = os.path.join(WEB, 'src', 'guestbook', 'styles', 'nemo', 'data.ts')

# ── 우리가 더한 것 (팩의 머리 칸 좌표계 145x143: 얼굴 사각형 x25..120, y34..117) ──────────────────
OURS_FRONT = {
    # 일자 앞머리 + 옆머리
    'bangs': 'M25 64C25 47.43 38.43 34 55 34H90C106.57 34 120 47.43 120 64V86H112V73C112 69.13 108.87 66 105 66H40C36.13 66 33 69.13 33 73V86H25V64Z',
    # 이마선만 덮는 짧은 머리
    'crop': 'M25 64C25 47.43 38.43 34 55 34H90C106.57 34 120 47.43 120 64V72C120 62.06 111.94 54 102 54H43C33.06 54 25 62.06 25 72V64Z',
    # 옆가르마
    'sidepart': 'M25 64C25 47.43 38.43 34 55 34H90C106.57 34 120 47.43 120 64V76H117C103.5 76 92.5 66.5 89.5 54C82 67.5 64 76 41 76H25V64Z',
}
OURS_BACK = {
    # 허리까지 내려오는 생머리
    'straightLong': 'M19 70C19 49.57 35.57 33 56 33H89C109.43 33 126 49.57 126 70V142C126 146.42 122.42 150 118 150H27C22.58 150 19 146.42 19 142V70Z',
    # 정수리 똥머리
    'bun': 'M72.5 5C82.44 5 90.5 13.06 90.5 23C90.5 32.94 82.44 41 72.5 41C62.56 41 54.5 32.94 54.5 23C54.5 13.06 62.56 5 72.5 5Z',
    # 옆으로 묶은 포니테일 (앞에서 보면 오른쪽)
    'ponytail': 'M106 42C124 30 146 44 145 70C144.2 92 139 108 130 119C126 123.5 119.5 120.5 121 114.5C124 101 121 86 111 74Z',
    # 양갈래
    'twintails': 'M30 60C14 58 1 74 2 96C2.7 110 8 122 16 127.5C20 130 24.5 127.5 24 122.5C23 110 26 98 35 86Z'
    'M115 60C131 58 144 74 143 96C142.3 110 137 122 129 127.5C125 130 120.5 127.5 121 122.5C122 110 119 98 110 86Z',
}
# 피부: (이름, 바탕, 귀 안쪽, 볼) — 팩 3톤 사이·바깥에 우리가 3톤을 더한다
OURS_SKINS = {
    0: ('밝은 톤', '#FFDCC8', '#FFC3A0', '#FFB9A8'),
    2: ('웜 베이지', '#EFA988', '#DC8F6A', '#EC9379'),
    4: ('브론즈', '#9D5C49', '#89493A', '#93513F'),
}
PACK_SKIN_LABELS = {1: ('살구 톤', 'tint_1'), 3: ('허니', 'tint_2'), 5: ('딥 브라운', 'tint_3')}
# 머리색: 팩 9색 + 자연스러운 톤 3색 (만들기 화면 순서)
HAIR_ORDER = [
    ('검정', 'black'), ('흑갈색', '#3B2A26'), ('갈색', 'brown'), ('밝은 갈색', '#B06B3F'), ('금발', 'blond'), ('주황', 'orange'),
    ('빨강', 'red'), ('분홍', '#FF9CC2'), ('보라', 'violet'), ('하늘', 'blue'), ('초록', 'green'), ('흰색', 'white'),
]
# 옷 색: 팩 7색 + 5색
OUTFIT_ORDER = [
    ('빨강', 'red'), ('주황', 'orange'), ('노랑', '#FFC93C'), ('초록', 'green'), ('하늘', 'blue'), ('파랑', '#545AF2'),
    ('보라', 'violet'), ('분홍', '#FF8DB4'), ('남색', '#2D3270'), ('베이지', '#E9CFA6'), ('검정', 'black'), ('흰색', 'white'),
]
# sample.png(1.2px = 1단위)에서 잰 조립 위치 — 머리 칸 좌표계 기준
ASSEMBLY = {
    'bodyX': 55, 'bodyY': 118,          # 몸통 왼쪽 위
    'legLX': 58, 'legRX': 74, 'legY': 133,  # 다리 왼쪽 위
    'armPivotY': 122, 'armSpread': 35,    # 어깨 높이, 팔이 벌어진 각도(도)
}


def read(rel):
    with open(os.path.join(RAW, rel), encoding='utf-8') as f:
        return f.read()


def attrs(tag):
    return dict(re.findall(r'([\w:-]+)="([^"]*)"', tag))


def elements(svg):
    """<rect>/<circle>/<path> 를 순서대로 — mask/g 안의 것은 뺀다"""
    svg = re.sub(r'<mask.*?</mask>', '', svg, flags=re.S)
    svg = re.sub(r'<g .*?</g>', '', svg, flags=re.S)
    return [(m.group(1), attrs(m.group(2))) for m in re.finditer(r'<(rect|circle|path)\b([^>]*)/>', svg)]


def hexcol(c):
    c = {'black': '#000000', 'white': '#FFFFFF'}.get(c, c)
    assert re.fullmatch(r'#[0-9A-Fa-f]{6}', c), c
    return c.upper()


def num(v):
    f = float(v)
    return int(f) if f == int(f) else f


def one_path(rel):
    els = elements(read(rel))
    assert len(els) == 1 and els[0][0] == 'path', rel
    return els[0][1]['d']


def prim(kind, a):
    """앱이 그릴 수 있는 원시 도형 한 개 (rect/circle/path)"""
    p = {'t': kind}
    if kind == 'rect':
        for k in ('x', 'y', 'width', 'height', 'rx'):
            p[{'width': 'w', 'height': 'h'}.get(k, k)] = num(a.get(k, 0))
    elif kind == 'circle':
        p.update(x=num(a['cx']), y=num(a['cy']), r=num(a['r']))
    else:
        p['d'] = a['d']
    if a.get('fill', 'none') != 'none':
        p['fill'] = hexcol(a['fill'])
    if 'stroke' in a:
        p['stroke'] = hexcol(a['stroke'])
        p['sw'] = num(a['stroke-width'])
    return p


def first_x(p):
    if p['t'] == 'rect':
        return p['x'] + p['w'] / 2
    if p['t'] == 'circle':
        return p['x']
    return float(re.match(r'M\s*([\d.]+)', p['d']).group(1))


def face(rel, mouth_from=None):
    """얼굴 → 왼눈 / 오른눈 / 입 (옆모습에서 따로 밀어 그리려고 나눈다)"""
    prims = [prim(k, a) for k, a in elements(read(rel))]
    out = {'eyeL': [], 'eyeR': [], 'mouth': []}
    for p in prims:
        x = first_x(p)
        # 입은 가운데(66~79)에서 시작하고 눈(과 눈의 반짝임)은 그 바깥에 있다
        key = 'mouth' if 66 <= x <= 79 else ('eyeL' if x < 72.5 else 'eyeR')
        out[key].append(p)
    if mouth_from:
        # 눈은 선으로 그린 것만 남긴다 (laughs 의 흰 입이 눈 쪽으로 분류되지 않게)
        out['eyeL'] = [p for p in out['eyeL'] if 'stroke' in p]
        out['eyeR'] = [p for p in out['eyeR'] if 'stroke' in p]
        out['mouth'] = face(mouth_from)['mouth']
    assert out['eyeL'] and out['eyeR'] and out['mouth'], rel
    return out


def ts(v, indent=0):
    """파이썬 값 → TS 리터럴"""
    pad = '  ' * indent
    if isinstance(v, dict):
        if all(not isinstance(x, (dict, list)) for x in v.values()) and len(repr(v)) < 150 and 'd' not in v:
            return '{ ' + ', '.join(f'{k}: {ts(x)}' for k, x in v.items()) + ' }'
        return '{\n' + ''.join(f'{pad}  {k}: {ts(x, indent + 1)},\n' for k, x in v.items()) + pad + '}'
    if isinstance(v, (list, tuple)):
        if all(not isinstance(x, (dict, list)) for x in v):
            return '[' + ', '.join(ts(x) for x in v) + ']'
        return '[\n' + ''.join(f'{pad}  {ts(x, indent + 1)},\n' for x in v) + pad + ']'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, str):
        return "'" + v.replace('\\', '\\\\').replace("'", "\\'") + "'"
    return repr(v)


def build():
    # 1. 치수 — raw SVG 가 기대한 모양인지 확인하며 읽는다
    head = elements(read('skin/tint_1/head.cheeks.svg'))
    assert [k for k, _ in head] == ['rect', 'rect', 'rect', 'circle', 'circle']
    ear, ear_in, skull, cheek_l, cheek_r = (prim(k, a) for k, a in head)
    size = lambda rel: tuple(num(v) for v in re.search(r'width="([\d.]+)" height="([\d.]+)"', read(rel)).groups())
    assert size('skin/tint_1/head.svg') == (145, 143)
    body_w, body_h = size('skin/tint_1/body.svg')
    arm_w, arm_h = size('skin/tint_1/arm.svg')
    leg_w, leg_h = size('skin/tint_1/leg.svg')
    assert (body_w, body_h, arm_w, arm_h, leg_w, leg_h) == (35, 25, 12, 28, 13, 28)
    # 옷 치수: 티셔츠는 위 14, 원피스는 위 31 → 아래 41 사다리꼴, 소매 13/21, 반바지 12, 양말·신발 띠
    tee = elements(read('shirts/trousers.red.svg'))
    assert tee[0][1]['height'] == '14'
    assert size('shirts/dress.red.svg') == (41, 25)
    assert 'L12 13' in read('sleeves/red.short.svg') and 'L12 21' in read('sleeves/red.long.svg')
    assert 'V12H0' in read('pants/shorts.svg') and 'M0 16H13V19' in read('pants/shorts.svg')
    assert 'M0 15H13V18' in read('pants/pants.svg')
    pants_color = hexcol(elements(read('pants/pants.svg'))[0][1]['fill'])
    geom = {
        'headW': 145, 'headH': 143,
        'skull': {k: skull[k] for k in ('x', 'y', 'w', 'h', 'rx')},
        'ear': {k: ear[k] for k in ('x', 'y', 'w', 'h', 'rx')},
        'earIn': {k: ear_in[k] for k in ('x', 'y', 'w', 'h', 'rx')},
        'cheekL': {k: cheek_l[k] for k in ('x', 'y', 'r')},
        'cheekR': {k: cheek_r[k] for k in ('x', 'y', 'r')},
        'bodyW': body_w, 'bodyH': body_h, 'bodyR': 6,
        'armW': arm_w, 'armH': arm_h, 'legW': leg_w, 'legH': leg_h,
        'teeH': 14, 'dressTopW': 31, 'dressBottomW': 41,
        'sleeveShort': 13, 'sleeveLong': 21,
        'shortsH': 12, 'sockY': 15, 'sockH': 3, 'shoeY': 18,
        **ASSEMBLY,
    }

    # 2. 경로
    front = {n: one_path(f'hairs/front/{n}.black.svg') for n in ('regular', 'chupchik', 'straight', 'elegant', 'curly')}
    back = {n: one_path(f'hairs/back/{n}.black.svg') for n in ('short', 'long', 'curly')}
    assert not (set(front) & set(OURS_FRONT)) and not (set(back) & set(OURS_BACK))
    faces = {
        'smile': face('faces/smile.svg'),
        'cute': face('faces/cute.svg'),
        # laughs 의 웃는 눈(∩∩)만 쓰고 입은 기본 미소 (원본 입은 마스크를 쓴다)
        'happy': face('faces/laughs.svg', mouth_from='faces/smile.svg'),
    }
    glasses = {n: [prim(k, a) for k, a in elements(read(f'glasses/{n}.black.svg'))] for n in ('round', 'square')}
    moustache = one_path('beards/short.black.svg')

    # 3. 색
    def fill_of(rel):
        return hexcol(elements(read(rel))[0][1]['fill'])

    hair_pack = {c: fill_of(f'hairs/front/regular.{c}.svg') for c in ('black', 'blond', 'blue', 'brown', 'green', 'orange', 'red', 'violet', 'white')}
    for c, h in hair_pack.items():
        assert fill_of(f'beards/short.{c}.svg') == h
    shirt_pack = {c: fill_of(f'shirts/dress.{c}.svg') for c in ('black', 'blue', 'green', 'orange', 'red', 'violet', 'white')}
    skins = []
    for i in range(6):
        if i in OURS_SKINS:
            label, base, ear_c, cheek = OURS_SKINS[i]
            skins.append({'label': label, 'hex': base.lower(), 'ear': ear_c.lower(), 'cheek': cheek.lower(), 'pack': False})
        else:
            label, folder = PACK_SKIN_LABELS[i]
            els = elements(read(f'skin/{folder}/head.cheeks.svg'))
            skins.append({'label': label, 'hex': hexcol(els[0][1]['fill']).lower(), 'ear': hexcol(els[1][1]['fill']).lower(),
                          'cheek': hexcol(els[3][1]['fill']).lower(), 'pack': True})

    def swatches(order, pack):
        return [{'label': label, 'hex': (pack[c] if c in pack else hexcol(c)).lower(), 'pack': c in pack or hexcol(c) == pants_color}
                for label, c in order]

    out = [
        '/**',
        ' * 자동 생성 — art/nemo/build.py 가 만든다. 직접 고치지 말 것.',
        ' * nonemo "Character Creation Asset Pack" (CC0, https://nonemo.itch.io/character-creation-asset-pack) 의 경로·치수·색과,',
        ' * 같은 화풍으로 우리가 더한 모양(OURS_*)·색(pack: false). 좌표는 팩의 머리 칸(145x143) 기준이다.',
        ' */',
        'export interface Prim {',
        "  t: 'rect' | 'circle' | 'path'",
        '  x?: number',
        '  y?: number',
        '  w?: number',
        '  h?: number',
        '  rx?: number',
        '  r?: number',
        '  d?: string',
        '  fill?: string',
        '  stroke?: string',
        '  sw?: number',
        '}',
        'export interface Face {',
        '  eyeL: Prim[]',
        '  eyeR: Prim[]',
        '  mouth: Prim[]',
        '}',
        'export interface Tone {',
        '  label: string',
        '  hex: string',
        '  /** 팩에 있던 색이면 true, 우리가 더한 색이면 false */',
        '  pack: boolean',
        '}',
        'export interface SkinTone extends Tone {',
        '  ear: string',
        '  cheek: string',
        '}',
        '',
        '/** 조립 치수 (팩 SVG 의 칸 크기 + sample.png 에서 잰 상대 위치) */',
        f'export const GEOM = {ts(geom)} as const',
        '',
        '/** 팩의 앞머리 경로 */',
        f'export const PACK_FRONT = {ts(front)} as const',
        '/** 우리가 더한 앞머리 경로 */',
        f'export const OURS_FRONT = {ts(OURS_FRONT)} as const',
        '/** 팩의 뒷머리 경로 */',
        f'export const PACK_BACK = {ts(back)} as const',
        '/** 우리가 더한 뒷머리 경로 */',
        f'export const OURS_BACK = {ts(OURS_BACK)} as const',
        '',
        '/** 팩의 얼굴 (눈·입) — smile: 기본, cute: 반짝 눈, happy: 웃는 눈 */',
        f'export const FACES: Record<\'smile\' | \'cute\' | \'happy\', Face> = {ts(faces)}',
        '/** 팩의 안경 */',
        f'export const GLASSES: Record<\'round\' | \'square\', Prim[]> = {ts(glasses)}',
        '/** 팩의 콧수염 (beards/short) — 머리색으로 칠한다 */',
        f'export const MOUSTACHE = {ts(moustache)}',
        '',
        f'export const SKINS: SkinTone[] = {ts(skins)}',
        f'export const HAIR_COLORS: Tone[] = {ts(swatches(HAIR_ORDER, hair_pack))}',
        f'export const OUTFIT_COLORS: Tone[] = {ts(swatches(OUTFIT_ORDER, shirt_pack))}',
        '/** 팩의 바지색 */',
        f"export const PANTS_BLUE = '{pants_color.lower()}'",
        '',
    ]
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))
    print('wrote', os.path.relpath(OUT, HERE), os.path.getsize(OUT), 'bytes')


# ── 미리보기 / 걷기 확인 (선택) ───────────────────────────────────────────────
CHROME_CANDIDATES = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome', 'chromium', 'chromium-browser',
]


def shoot(mode, out_png, width, height, work):
    """index.ts 를 한 파일로 묶어 preview.html 로 그리고 헤드리스 Chrome 으로 찍는다"""
    import shutil

    os.makedirs(work, exist_ok=True)
    bundle = os.path.join(work, 'nemo.bundle.js')
    rolldown = os.path.join(WEB, 'node_modules', '.bin', 'rolldown')
    subprocess.run([rolldown, os.path.join(WEB, 'src', 'guestbook', 'styles', 'nemo', 'index.ts'), '--format', 'iife', '--name', 'Nemo',
                    '--file', bundle], check=True, cwd=WEB, stdout=subprocess.DEVNULL)
    shutil.copy(os.path.join(HERE, 'preview.html'), os.path.join(work, 'preview.html'))
    chrome = next((c for c in CHROME_CANDIDATES if os.path.exists(c) or shutil.which(c)), None)
    if not chrome:
        sys.exit('Chrome 을 찾지 못했다 — preview/proof 는 건너뛴다')
    url = 'file://' + os.path.join(work, 'preview.html') + '#' + mode
    subprocess.run([chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
                    f'--user-data-dir={os.path.join(work, "chrome-profile")}', f'--window-size={width},{height}',
                    '--default-background-color=00000000', f'--screenshot={out_png}', url],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print('wrote', out_png)


def main():
    build()
    args = sys.argv[1:]
    import tempfile

    if '--preview' in args:
        with tempfile.TemporaryDirectory() as work:
            shoot('preview', os.path.join(HERE, 'preview.png'), 1180, 760, work)
    if '--proof' in args:
        from PIL import Image

        dest = os.path.abspath(args[args.index('--proof') + 1])
        os.makedirs(dest, exist_ok=True)
        with tempfile.TemporaryDirectory() as work:
            shoot('walk', os.path.join(dest, 'walk.png'), 1560, 2260, work)
            strip = os.path.join(work, 'strip.png')
            # strip: 4박자(1,0,2,0) x 칸 — preview.html 의 STRIP 과 같은 수치
            cols, cell_w, cell_h, beats = 8, 150, 150, 4
            shoot('strip', strip, cols * cell_w, 4 * cell_h * beats, work)
            im = Image.open(strip).convert('RGB')
            frames = [im.crop((0, b * 4 * cell_h, cols * cell_w, (b + 1) * 4 * cell_h)) for b in range(beats)]
            frames[0].save(os.path.join(dest, 'walk.gif'), save_all=True, append_images=frames[1:], duration=170, loop=0)
            print('wrote', os.path.join(dest, 'walk.gif'))


if __name__ == '__main__':
    main()
