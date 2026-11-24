"""'동숲(테스트)' 그림체(acref)의 에셋을 만든다 — 팬 위키(Nookipedia)의 투명 배경 캐릭터 렌더를 그대로 받아
발바닥 선·몸집을 맞추고 한 장의 아틀라스로 줄인다. (다시 그리지 않는다. 사적인 품질 시험용)

사용:  python -I build.py [--sheet 미리보기.png]      (pillow, numpy 필요)
  받은 원본  → art/acref/raw/                              (git 제외)
  아틀라스   → web/src/guestbook/styles/acref/assets/      (git 제외: atlas.webp 주민, items.webp 소품, atlas.json)
  주민 목록  → web/src/guestbook/styles/acref/roster.ts    (이름·치수·손 위치만 — 저장소에 올린다)

원본은 한 번 받으면 raw/ 에 남으므로 다시 돌려도 네트워크를 쓰지 않는다. 받은 파일은 이미지로만 읽는다.
"""
import hashlib, json, os, re, sys, time, urllib.parse, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
STYLE = os.path.normpath(os.path.join(HERE, '..', '..', 'web', 'src', 'guestbook', 'styles', 'acref'))
ASSETS = os.path.join(STYLE, 'assets')
API = 'https://nookipedia.com/w/api.php'
UA = 'Mozilla/5.0 (compatible; asset-fetch/1.0)'

# (id, 위키 문서, 파일, 이름표) — 이름표가 None 이면 위키 문서의 한국어 이름(ko-name)을 쓴다.
# 파일: 공식 아트워크(<이름>_NH.png)가 작으면 같은 게임의 모델 렌더(<이름>_NH_Model.png)를 쓴다.
# 0·1번은 신랑·신부 몫(게임 속 부부 캐릭터) — 하객 랜덤에서는 빠진다.
ROSTER = [
    ('cyrus', 'Cyrus', 'Cyrus_NH.png', None),
    ('reese', 'Reese', 'Reese_NH.png', None),
    # 고양이
    ('raymond', 'Raymond', 'Raymond_NH_Model.png', None),
    ('bob', 'Bob', 'Bob_NH.png', None),
    ('lolly', 'Lolly', 'Lolly_NH.png', None),
    ('punchy', 'Punchy', 'Punchy_NH.png', None),
    ('ankha', 'Ankha', 'Ankha_NH.png', None),
    # 토끼
    ('coco', 'Coco', 'Coco_NH.png', None),
    ('ruby', 'Ruby', 'Ruby_NH.png', None),
    ('dotty', 'Dotty', 'Dotty_NH.png', None),
    ('chrissy', 'Chrissy', 'Chrissy_NH.png', None),
    # 꼬마곰
    ('judy', 'Judy', 'Judy_NH_Model.png', None),
    ('stitches', 'Stitches', 'Stitches_NH_1.png', None),
    ('maple', 'Maple', 'Maple_NH.png', None),
    ('pekoe', 'Pekoe', 'Pekoe_NH.png', None),
    # 개
    ('goldie', 'Goldie', 'Goldie_NH_1.png', None),
    ('daisy', 'Daisy', 'Daisy_NH.png', None),
    ('isabelle', 'Isabelle', 'Isabelle_NH_Transparent.png', None),
    # 사슴
    ('fauna', 'Fauna', 'Fauna_NH_1.png', None),
    ('beau', 'Beau', 'Beau_NH.png', None),
    ('diana', 'Diana', 'Diana_NH.png', None),
    # 다람쥐
    ('marshal', 'Marshal', 'Marshal_NH.png', None),
    ('poppy', 'Poppy', 'Poppy_NH.png', None),
    # 펭귄
    ('roald', 'Roald', 'Roald_NH.png', None),
    ('sprinkle', 'Sprinkle', 'Sprinkle_NH.png', None),
    # 양·염소
    ('dom', 'Dom', 'Dom_NH_Model.png', None),
    ('willow', 'Willow', 'Willow_NH.png', None),
    ('sherb', 'Sherb', 'Sherb_NH_Model.png', None),
    # 그 밖
    ('molly', 'Molly', 'Molly_NH_1.png', None),
    ('zucker', 'Zucker', 'Zucker_NH.png', None),
    ('flurry', 'Flurry', 'Flurry_NH.png', None),
    ('merengue', 'Merengue', 'Merengue_NH.png', None),
    ('audie', 'Audie', 'Audie_NH_Model.png', None),
    # 사람(플레이어 렌더)
    # 이름표는 짧게 — 만들기 화면의 썸네일 칸이 이름 길이만큼 넓어진다
    ('player1', None, 'Player_1_NH.png', '갈색 머리'),
    ('player5', None, 'Player_5_NH.png', '화관 소녀'),
    ('player6', None, 'Player_6_NH.png', '파란 머리'),
]
GROOM, BRIDE = 0, 1

# 손에 드는 소품 — 같은 게임의 아이템 아이콘(128px)을 그대로 쓴다. (id, 파일, 이름표, 배율(K=1 기준), 손잡이 위치(가로·세로 비율) 또는 None=자동, 기울기°)
# 기울기: 손잡이를 축으로 몸 바깥쪽으로 돌리는 각도 — 풍선이 얼굴을 가리지 않게 바깥으로 살짝 눕힌다.
# 0 이 아니면 "기울여 드는 소품" 이라는 뜻이고, 실제 각도는 주민마다 머리에 닿지 않는 가장 작은 값으로 정한다 (balloon_lean).
# 아이콘이 모두 손잡이가 왼쪽 아래·머리가 오른쪽 위로 기울어 있어, 그림의 오른쪽 손에 쥐여 준다.
ITEMS = [
    ('balloon-red', 'Red_Balloon_NH_Icon.png', '빨간 풍선', 1.2, (0.5, 0.955), 18),
    ('balloon-blue', 'Blue_Balloon_NH_Icon.png', '파란 풍선', 1.2, (0.5, 0.955), 18),
    ('balloon-yellow', 'Yellow_Balloon_NH_Icon.png', '노란 풍선', 1.2, (0.5, 0.955), 18),
    ('balloon-pink', 'Pink_Balloon_NH_Icon.png', '분홍 풍선', 1.2, (0.5, 0.955), 18),
    ('bouquet', 'Wedding_Wand_NH_Icon.png', '부케', 1.0, None, 0),
    ('tulip', 'Tulip_Wand_NH_Icon.png', '튤립', 1.0, None, 0),
    ('star', 'Star_Wand_NH_Icon.png', '별 지팡이', 1.0, None, 0),
    ('pinwheel', 'Pinwheel_NH_Icon.png', '바람개비', 1.0, None, 0),
    ('lollipop', 'Lollipop_NH_Icon.png', '막대사탕', 1.0, (0.1, 0.9), 0),
    ('popper', 'Party_Popper_NH_Icon.png', '파티 폭죽', 1.0, (0.3, 0.76), 0),
    ('lightstick', 'Light_Stick_NH_Icon.png', '응원봉', 1.0, None, 0),
    ('fan', 'Uchiwa_Fan_NH_Icon.png', '부채', 1.0, (0.2, 0.88), 0),
]
BRIDE_ITEM = 'bouquet'  # 신부는 부케를 든다 (드레스·베일 렌더가 없어서 이것으로 신부임을 보인다)

# 손 위치: 기본은 자동(몸통 높이에서 가장 오른쪽으로 나온 곳). 자동이 틀리는 주민만 직접 적는다.
# (가로 중심에서 오른쪽으로 몇 px, 발바닥에서 위로 몇 px) — K=1 로 줄인 그림 기준. 가로가 음수면 왼손(소품을 좌우로 뒤집어 든다)
HANDS = {
    'marshal': (-42, 39),  # 오른쪽은 꼬리
    'poppy': (-39, 45),
    'player1': (-45, 93),  # 오른쪽 손은 얼굴 옆으로 들고 있다
    # 고양이: 자동은 옆으로 나온 꼬리 끝을 손으로 잡는다
    'bob': (44, 54),
    'lolly': (46, 54),
    'punchy': (46, 54),
    'ankha': (39, 51),
    # 토끼: 귀가 길어 몸통 높이 띠에 볼이 들어와, 자동은 볼을 손으로 잡는다
    'coco': (40, 58),
    'ruby': (40, 58),
    'dotty': (41, 58),
    'chrissy': (42, 60),
}
# 기울여 드는 소품(풍선)의 각도 후보(°) — 작은 것부터 대 보고 머리에 닿지 않는 첫 값을 쓴다
LEAN_STEPS = (8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30)

# 아틀라스 칸(= 스프라이트 명목 크기) 안에서의 배치
# K: 전체 해상도 배율. 1 이면 가장 큰 주민의 키가 262px — 만들기 화면의 큰 미리보기(기기 픽셀 약 370px)에서도
# 흐려지지 않도록 1.3 으로 둔다. 아래 치수와 HANDS·소품 배율은 모두 K=1 기준으로 적고 K 를 곱해 쓴다.
K = 1.3
AREA_SIDE = 150 * K          # 실루엣 넓이의 제곱근을 이 값에 맞춘다 (귀·꼬리에 덜 휘둘리는 몸집 기준)
MAX_H = round(262 * K)       # 그래도 이보다 크면(귀가 긴 토끼 등) 여기까지 줄인다
MIN_H = round(214 * K)       # 이보다 작으면(옆으로 퍼진 다람쥐·펭귄 등) 여기까지 키운다
MAX_HALF_W = round(112 * K)  # 중심에서 좌우로 이만큼까지
TOP_PAD = round(20 * K)      # 걷기(통통 뛰며 기울기) 여유
FOOT_PAD = round(12 * K)     # 발 아래(그림자) 여유
SIDE_PAD = 6                 # 아틀라스 칸의 좌우 여유
SWAY_PAD = round(22 * K)     # 스프라이트 좌우 여유 (기울 때 머리·소품이 잘리지 않게)
ITEM_COLS = 6
COLS = 9
QUALITY = 84


def http(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = r.read()
    time.sleep(0.25)  # 위키에 부담을 주지 않게 한 번에 하나씩, 천천히
    return data


def api(**params):
    return json.loads(http(API + '?' + urllib.parse.urlencode({**params, 'format': 'json'})))


def fetch_image(fn):
    dst = os.path.join(RAW, fn)
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return dst
    d = api(action='query', titles='File:' + fn, prop='imageinfo', iiprop='url')
    for page in d['query']['pages'].values():
        info = page.get('imageinfo')
        if not info:
            raise SystemExit(f'위키에 없는 파일: {fn}')
        url = info[0]['url']
        if not url.startswith('https://dodo.ac/np/images/'):
            raise SystemExit(f'예상 밖의 주소: {url}')
        data = http(url)
        with open(dst + '.part', 'wb') as f:
            f.write(data)
        os.replace(dst + '.part', dst)
        print('받음', fn, len(data))
        return dst
    raise SystemExit(f'위키 응답을 읽지 못함: {fn}')


def fetch_ko_name(page):
    """위키 문서 정보 상자의 한국어 이름 (raw/names.json 에 기억)"""
    cache_path = os.path.join(RAW, 'names.json')
    cache = {}
    if os.path.exists(cache_path):
        with open(cache_path, encoding='utf-8') as f:
            cache = json.load(f)
    if page not in cache:
        text = api(action='parse', page=page, prop='wikitext')['parse']['wikitext']['*']
        m = re.search(r'\|\s*ko-name\s*=\s*([^\n|}]+)', text) or re.search(r'\|\s*ko\s*=\s*([^\n|}]+)', text)
        if not m:
            raise SystemExit(f'한국어 이름을 찾지 못함: {page}')
        cache[page] = re.sub(r'<[^>]+>|\{\{[^}]*\}\}', '', m.group(1)).strip()
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(cache, f, ensure_ascii=False, indent=1)
    return cache[page]


def trimmed(path):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im)[..., 3]
    if (a < 8).mean() < 0.05:
        raise SystemExit(f'배경이 투명하지 않은 그림: {path}')
    ys, xs = np.nonzero(a > 16)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def resize_rgba(im, size):
    """알파를 미리 곱해 줄인다 (가장자리에 어두운·흰 테가 생기지 않게)"""
    return im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


def place(im):
    """몸집·키를 맞춘 그림과, 그 안에서 캐릭터 중심(x)이 어디인지"""
    a = np.asarray(im)[..., 3] > 128
    w, h = im.size
    s = AREA_SIDE / np.sqrt(a.sum())
    s = min(s, MAX_H / h)
    s = max(s, MIN_H / h)
    s = min(s, MAX_H / h, 1.0)  # 원본보다 키우지는 않는다
    cols = a.sum(0).astype(np.float64)
    xs = np.arange(w)
    whole = (cols * xs).sum() / cols.sum()
    feet_rows = a[int(h * 0.86):]
    fc = feet_rows.sum(0).astype(np.float64)
    feet = (fc * xs).sum() / max(fc.sum(), 1)
    cx = (whole + feet) / 2  # 발과 몸 전체의 가운데쯤 — 꼬리·팔이 한쪽으로 뻗어도 발이 중심에서 멀어지지 않게
    half = max(cx, w - cx) * s
    if half > MAX_HALF_W:
        s *= MAX_HALF_W / half
    W, H = max(1, round(w * s)), max(1, round(h * s))
    return resize_rgba(im, (W, H)), cx * W / w, s


def find_hand(cid, im, cx):
    """손(소품을 쥘 곳)의 위치와 어느 손인지(+1 = 그림의 오른쪽)"""
    w, h = im.size
    if cid in HANDS:
        dx, up = HANDS[cid][0] * K, HANDS[cid][1] * K
        return cx + dx, h - up, (1 if dx >= 0 else -1)
    a = np.asarray(im)[..., 3] > 128
    y0, y1 = int(h * 0.56), int(h * 0.86)
    right = np.array([np.nonzero(row)[0].max() if row.any() else -1 for row in a[y0:y1]])
    best = right.max()
    ys = np.nonzero(right >= best - 3 * K)[0]
    return best - 8.0 * K, y0 + float(ys.mean()), 1


def balloon_lean(person, thing):
    """기울여 드는 소품을 이 주민이 들었을 때 머리·귀에 닿지 않는 가장 작은 각도(라디안).
    손 근처(아래 28%)는 어차피 손·팔과 겹치므로 보지 않는다. 끝까지 닿으면 가장 덜 닿는 각도."""
    im, it = person['im'], thing['im']
    body = np.asarray(im)[..., 3] > 128
    hx, hy = person['cx'] + person['hx'], im.size[1] + person['hy']
    if person['side'] < 0:  # 왼손이면 좌우를 뒤집어 오른손으로 놓고 잰다
        body, hx = body[:, ::-1], im.size[0] - hx
    pad = max(it.size) + 8
    canvas = np.zeros((im.size[1] + pad * 2, im.size[0] + pad * 2), bool)
    canvas[pad:pad + im.size[1], pad:pad + im.size[0]] = body
    # 닿을락 말락 하지 않게 실루엣을 몇 px 부풀린다
    grow = round(4 * K)
    fat = np.asarray(Image.fromarray((canvas * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(grow * 2 + 1))) > 0
    mask = np.asarray(it)[..., 3] > 64
    mask[int(it.size[1] * 0.72):] = False
    layer0 = Image.new('L', canvas.shape[::-1], 0)
    layer0.paste(Image.fromarray((mask * 255).astype(np.uint8)), (round(hx + pad - thing['gx']), round(hy + pad - thing['gy'])))
    best = None
    for deg in LEAN_STEPS:
        rot = np.asarray(layer0.rotate(-deg, center=(hx + pad, hy + pad), resample=Image.BILINEAR)) > 127
        hit = int((rot & fat).sum())
        if hit == 0:
            return np.radians(deg)
        if best is None or hit < best[0]:
            best = (hit, deg)
    return np.radians(best[1])


def unpremultiplied(im):
    """아이템 아이콘은 색에 알파가 미리 곱해져 저장돼 있다 (반투명 가장자리의 색이 알파보다 밝지 않다).
    그대로 쓰면 가장자리에 어두운 점선 테가 생기므로 색을 알파로 나눠 되돌린다. 보통 그림이면 그대로 둔다."""
    a = np.asarray(im).astype(np.float64)
    al = a[..., 3]
    semi = (al > 0) & (al < 250)
    if semi.sum() == 0 or ((a[..., :3].max(-1) <= al + 2) & semi).sum() < semi.sum() * 0.9:
        return im
    rgb = np.where(al[..., None] > 0, a[..., :3] * 255.0 / np.maximum(al[..., None], 1), 0)
    out = np.dstack([np.clip(rgb, 0, 255), al]).round().astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def load_item(fn, scale, grip):
    im = unpremultiplied(trimmed(fetch_image(fn)))
    w, h = im.size
    if grip is None:
        a = np.asarray(im)[..., 3] > 64
        band = a[int(h * 0.86):int(h * 0.95)]
        gx = (band.sum(0) * np.arange(w)).sum() / max(band.sum(), 1) / w
        grip = (float(gx), 0.9)
    scale *= K
    im = resize_rgba(im, (round(w * scale), round(h * scale)))
    return im, grip[0] * im.size[0], grip[1] * im.size[1]


def main():
    os.makedirs(RAW, exist_ok=True)
    os.makedirs(ASSETS, exist_ok=True)

    # ── 주민 ──
    people = []
    for cid, page, fn, label in ROSTER:
        src = fetch_image(fn)
        name = label or fetch_ko_name(page)
        im, cx, s = place(trimmed(src))
        hx, hy, side = find_hand(cid, im, cx)
        people.append({'id': cid, 'label': name, 'im': im, 'cx': cx, 'scale': s, 'file': fn,
                       'hx': hx - cx, 'hy': hy - im.size[1], 'side': side})  # 손: 중심·발바닥 기준

    half = max(max(p['cx'], p['im'].size[0] - p['cx']) for p in people)
    cell_w = int(np.ceil(half + SIDE_PAD)) * 2
    tallest = max(p['im'].size[1] for p in people)
    cell_h = tallest + 4
    cell_foot = cell_h - 2
    rows = -(-len(people) // COLS)
    atlas = Image.new('RGBA', (COLS * cell_w, rows * cell_h), (0, 0, 0, 0))
    for i, p in enumerate(people):
        im = p['im']
        atlas.alpha_composite(im, ((i % COLS) * cell_w + round(cell_w / 2 - p['cx']), (i // COLS) * cell_h + cell_foot - im.size[1]))

    # ── 소품 ──
    things = []
    for iid, fn, label, scale, grip, lean in ITEMS:
        im, gx, gy = load_item(fn, scale, grip)
        things.append({'id': iid, 'label': label, 'im': im, 'gx': gx, 'gy': gy, 'lean': np.radians(lean)})
    # 기울여 드는 소품(풍선)의 각도는 주민마다: 풍선은 모두 같은 모양이라 첫 번째 것으로 잰다
    tilted = next((t for t in things if t['lean']), None)
    for p in people:
        p['lean'] = balloon_lean(p, tilted) if tilted else 0.0
    icw = max(t['im'].size[0] for t in things) + 4
    ich = max(t['im'].size[1] for t in things) + 4
    irows = -(-len(things) // ITEM_COLS)
    isheet = Image.new('RGBA', (ITEM_COLS * icw, irows * ich), (0, 0, 0, 0))
    for i, t in enumerate(things):
        t['x'], t['y'] = (i % ITEM_COLS) * icw + 2, (i // ITEM_COLS) * ich + 2
        isheet.alpha_composite(t['im'], (t['x'], t['y']))

    # ── 스프라이트 명목 크기: 어떤 주민이 어떤 소품을 들어도 들어가는 크기 ──
    reach, top = half, tallest
    for p in people:
        for t in things:
            w, h = t['im'].size
            lean = p['lean'] if t['lean'] else 0.0
            c, sn = np.cos(lean), np.sin(lean)
            for x, y in ((-t['gx'], -t['gy']), (w - t['gx'], -t['gy']), (-t['gx'], h - t['gy']), (w - t['gx'], h - t['gy'])):
                rx, ry = x * c - y * sn, x * sn + y * c  # 손잡이를 축으로 시계 방향(바깥쪽)으로 돌린 모서리
                reach = max(reach, abs(p['hx']) + rx)
                top = max(top, -p['hy'] - ry)
    sprite_w = int(np.ceil(reach + SWAY_PAD)) * 2
    sprite_h = TOP_PAD + int(np.ceil(top)) + FOOT_PAD
    foot_y = sprite_h - FOOT_PAD

    ids = [p['id'] for p in people]
    stamp = hashlib.sha1(json.dumps([ids, [t['id'] for t in things], cell_w, cell_h, icw, ich, sprite_w, sprite_h]).encode()).hexdigest()[:10]
    out = os.path.join(ASSETS, 'atlas.webp')
    atlas.save(out, 'WEBP', quality=QUALITY, method=6, alpha_quality=92)
    iout = os.path.join(ASSETS, 'items.webp')
    isheet.save(iout, 'WEBP', lossless=True, method=6)
    with open(os.path.join(ASSETS, 'atlas.json'), 'w', encoding='utf-8') as f:
        json.dump({'stamp': stamp, 'residents': ids, 'items': [t['id'] for t in things]}, f)

    r1 = lambda v: round(float(v), 1)
    lines = [
        '/**',
        ' * 동숲(테스트) 그림체의 주민·소품 목록과 아틀라스 치수 — art/acref/build.py 가 만든다 (직접 고치지 않는다).',
        ' * 그림(assets/*.webp)은 저장소에 올리지 않으므로, 이름·치수만 여기에 둔다.',
        ' */',
        'export interface Resident {',
        '  id: string',
        '  /** 화면에 보이는 이름 */',
        '  label: string',
        '  /** 키 (발바닥에서 머리·귀 꼭대기까지) */',
        '  h: number',
        '  /** 소품을 쥐는 손: 가로 중심에서 오른쪽으로 hx(왼손이면 음수), 발바닥에서 위로 hy. side -1 이면 왼손(소품을 뒤집어 든다) */',
        '  hx: number',
        '  hy: number',
        '  side: 1 | -1',
        '  /** 기울여 드는 소품(풍선)을 손잡이를 축으로 몸 바깥쪽으로 눕히는 각도 (라디안) — 머리에 닿지 않는 가장 작은 값 */',
        '  lean: number',
        '}',
        'export interface Item {',
        '  id: string',
        '  label: string',
        '  /** items.webp 안의 자리 */',
        '  x: number',
        '  y: number',
        '  w: number',
        '  h: number',
        '  /** 손잡이(손에 닿는 점) — 그림 왼쪽 위 기준 */',
        '  gx: number',
        '  gy: number',
        '  /** true 면 기울여 드는 소품(풍선) — 각도는 주민의 lean */',
        '  tilt: boolean',
        '}',
        '',
        '/** assets/atlas.json 의 stamp 와 같아야 한다 (그림과 목록이 어긋나면 불러오기를 거절) */',
        f"export const ATLAS_STAMP = '{stamp}'",
        '/** 스프라이트 명목 크기와 발바닥 선 (가로 기준은 중앙) */',
        f'export const SPRITE_W = {sprite_w}',
        f'export const SPRITE_H = {sprite_h}',
        f'export const FOOT_Y = {foot_y}',
        '/** atlas.webp 의 한 칸 (주민은 칸의 가로 중앙, 발은 CELL_FOOT 에 놓인다) */',
        f'export const CELL_W = {cell_w}',
        f'export const CELL_H = {cell_h}',
        f'export const CELL_FOOT = {cell_foot}',
        f'export const ATLAS_COLS = {COLS}',
        '/** 가장 큰 주민의 키 */',
        f'export const TALLEST = {tallest}',
        f'export const GROOM_INDEX = {GROOM}',
        f'export const BRIDE_INDEX = {BRIDE}',
        '/** 신부가 드는 소품 (액세서리 번호: 0 = 없음) */',
        f"export const BRIDE_ACCESSORY = {[t['id'] for t in things].index(BRIDE_ITEM) + 1}",
        '',
        'export const RESIDENTS: readonly Resident[] = [',
    ]
    for p in people:
        lines.append(f"  {{ id: '{p['id']}', label: '{p['label']}', h: {p['im'].size[1]}, "
                     f"hx: {r1(p['hx'])}, hy: {r1(-p['hy'])}, side: {p['side']}, lean: {round(float(p['lean']), 3)} }},")
    lines += [']', '', 'export const ITEMS: readonly Item[] = [']
    for t in things:
        w, h = t['im'].size
        lines.append(f"  {{ id: '{t['id']}', label: '{t['label']}', x: {t['x']}, y: {t['y']}, "
                     f"w: {w}, h: {h}, gx: {r1(t['gx'])}, gy: {r1(t['gy'])}, tilt: {'true' if t['lean'] else 'false'} }},")
    lines += [']', '']
    with open(os.path.join(STYLE, 'roster.ts'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    total = os.path.getsize(out) + os.path.getsize(iout)
    print(f'스프라이트 {sprite_w}x{sprite_h} (발바닥 y={foot_y}), 칸 {cell_w}x{cell_h}, 주민 {len(people)}명, 소품 {len(things)}개')
    print(f'atlas.webp {atlas.size} {os.path.getsize(out)} bytes, items.webp {isheet.size} {os.path.getsize(iout)} bytes, 합계 {total}')
    for p in people:
        print(f"  {p['id']:10s} {p['label']:14s} {p['im'].size} 배율 {p['scale']:.3f} 손 ({p['hx']:.0f},{-p['hy']:.0f}) "
              f"기울기 {np.degrees(p['lean']):.0f}° ({p['file']})")

    if '--sheet' in sys.argv:
        # 확인용: 주민마다 소품을 하나씩 돌려 가며 쥐여 본 그림 (발바닥 선·중심선·손 위치 표시)
        dst = sys.argv[sys.argv.index('--sheet') + 1]
        sheet = Image.new('RGBA', (COLS * sprite_w, rows * sprite_h), (238, 236, 226, 255))
        dr = ImageDraw.Draw(sheet)
        for i, p in enumerate(people):
            x0, y0 = (i % COLS) * sprite_w, (i // COLS) * sprite_h
            dr.rectangle((x0, y0, x0 + sprite_w - 1, y0 + sprite_h - 1), outline=(205, 200, 190, 255))
            dr.line((x0, y0 + foot_y, x0 + sprite_w, y0 + foot_y), fill=(230, 150, 150, 255))
            dr.line((x0 + sprite_w // 2, y0, x0 + sprite_w // 2, y0 + sprite_h), fill=(190, 205, 235, 255))
            im = p['im']
            sheet.alpha_composite(im, (x0 + round(sprite_w / 2 - p['cx']), y0 + foot_y - im.size[1]))
            t = things[i % len(things)]
            it, gx = t['im'], t['gx']
            if p['side'] < 0:
                it, gx = it.transpose(Image.FLIP_LEFT_RIGHT), it.size[0] - gx
            hx, hy = x0 + sprite_w / 2 + p['hx'], y0 + foot_y + p['hy']
            layer = Image.new('RGBA', sheet.size, (0, 0, 0, 0))
            layer.alpha_composite(it, (round(hx - gx), round(hy - t['gy'])))
            if t['lean']:
                layer = layer.rotate(-np.degrees(p['lean']) * p['side'], center=(hx, hy), resample=Image.BICUBIC)
            sheet.alpha_composite(layer)
            dr.ellipse((hx - 3, hy - 3, hx + 3, hy + 3), outline=(255, 0, 0, 255))
            dr.text((x0 + 4, y0 + 4), p['id'], fill=(60, 60, 60, 255))
        sheet.convert('RGB').save(dst)


if __name__ == '__main__':
    main()
