/**
 * 굽기 설정 — 브라우저(render-page.js)와 노드(build.mjs)가 함께 읽는다. 순수 데이터 + 소품 만들기 함수.
 *
 * 팔레트 텍스처는 가로 8 x 세로 4 칸의 그라데이션 블록이다. paint 는 "블록 → 어떻게 칠할지":
 *   'skin' | 'hair' | 'outfit'      실행 때 고른 색을 곱할 영역 (밝기만 남긴 중립색으로 굽는다)
 *   ['outfit', 밝기, 바닥]           같은 색을 조금 어둡게(밝기 < 1) / 그라데이션의 어두운 끝 밝기(바닥, 기본 0.6 · 피부 0.8)
 *   { c: '#rrggbb', floor, gain }    고정 색으로 바꿔 굽는다 (신랑·신부 옷)
 *   (없음)                           원본 그대로
 */

/** 한 칸(프레임 상자)과 카메라. 발바닥(무대 원점)이 위에서 footY 번째 줄, 가로는 한가운데에 온다 */
export const CAMERA = {
  w: 200,
  h: 256,
  footY: 240,
  /** 무대 1단위가 몇 픽셀인지 (직교 투영) */
  pxPerUnit: 88,
  /** 내려다보는 각도 (0 = 정면, 90 = 바로 위) */
  pitch: 24,
  /** 이 배수로 크게 그린 뒤 평균으로 줄인다 (MSAA 와 별개) */
  supersample: 4,
}

/** 색을 바꿀 영역을 구울 때의 중립 밝기 (sRGB 0~255). 흰색(255)으로 구우면 밝은 면이 하얗게 날아가 음영이 사라진다 */
export const NEUTRAL = 184

export const LIGHTS = {
  sky: 0xffffff,
  ground: 0xb9a89a,
  hemi: 1.9,
  dirs: [
    { color: 0xfff4e6, intensity: 1.9, from: [-3, 6, 5] },
    { color: 0xdfe8ff, intensity: 0.5, from: [4, 2, -3] },
  ],
}

export const CHARACTERS = ['Mage', 'Knight', 'Barbarian', 'Ranger', 'Rogue', 'Rogue_Hooded']

/** 프레임 0 = 정지, 1·2 = 반대 발이 나간 걷기 (Walking_A 는 1.067초 한 바퀴 — 두 발이 가장 벌어지는 두 순간) */
export const POSES = [
  { clip: 'Idle_A', time: 0 },
  { clip: 'Walking_A', time: 0.36 },
  { clip: 'Walking_A', time: 0.893 },
]

export const DIRS = ['down', 'left', 'right', 'up']
/** 무대를 Y 축으로 돌리는 각도. 모델은 +Z(카메라 쪽)를 본다 */
export const DIR_YAW = { down: 0, right: 90, left: -90, up: 180 }

/**
 * 손에 드는 원본 소품 (handslot 뼈에 붙인다).
 * stand: 정지 자세에서 무대 좌표 기준으로 한 번 더 돌리고(도) 옮긴 뒤 붙인다 — 지팡이를 세워 짚게 하려고.
 */
export const ITEMS = [
  { name: 'mug', file: 'mug_full', slot: 'r' },
  { name: 'book', file: 'spellbook_closed', slot: 'l' },
  { name: 'staff', file: 'staff', slot: 'r', stand: { rot: [-90, 0, 0], shift: [0, 0.42, 0], upright: true } },
  { name: 'wand', file: 'wand', slot: 'r' },
]

const limbs = (c) => [`${c}_Body`, `${c}_ArmLeft`, `${c}_ArmRight`, `${c}_LegLeft`, `${c}_LegRight`]
const ALL_BODIES = ['Mage', 'Knight', 'Barbarian', 'Ranger', 'Rogue'].flatMap(limbs)
const ALL_HEADS = ['Mage_Head', 'Knight_Head', 'Barbarian_Head', 'Ranger_Head', 'Rogue_Head', 'RogueHooded_Head']

const SUIT = '#565c74'
const SUIT_DARK = '#333747'
const WHITE = '#ffffff'

/**
 * 의상(몸) 레이어. 0 = 신랑, 1 = 신부 (하객에게는 주지 않는다).
 * base = 의상 색 0번("기본")일 때 곱할 색을 읽어 올 블록 (메쉬, 블록).
 */
export const BODIES = [
  {
    id: 'groom',
    label: '턱시도',
    meshes: [...limbs('Ranger'), 'bowtie', 'boutonniere'],
    // 셔츠 → 차콜 재킷, 가죽 띠·바지·장화 → 더 짙은 색, 목수건 → 흰 셔츠 앞섶 (그 위에 나비넥타이)
    paint: {
      '0,0': 'skin',
      '5,0': { c: SUIT, floor: 0.55 },
      '6,0': { c: SUIT, floor: 0.55 },
      '7,0': { c: SUIT_DARK, floor: 0.55 },
      '7,2': { c: SUIT_DARK, floor: 0.55 },
      '1,1': { c: SUIT_DARK, floor: 0.55 },
      '3,2': { c: SUIT_DARK, floor: 0.55 },
      '7,1': { c: '#1c1e27', floor: 0.55 },
      '0,1': { c: WHITE, floor: 0.75 },
    },
  },
  {
    id: 'bride',
    label: '웨딩드레스',
    meshes: [...limbs('Mage'), 'Mage_Cape'],
    paint: {
      '7,2': 'skin',
      '0,1': { c: WHITE, floor: 0.7 },
      '7,1': { c: '#efe6ea', floor: 0.7 },
      '3,0': { c: '#fff4dc', floor: 0.75 },
      '4,0': { c: '#fff4dc', floor: 0.75 },
      '5,0': { c: '#f6b7c6', floor: 0.7 },
      '2,2': { c: '#f6b7c6', floor: 0.7 },
      '0,2': { c: WHITE, floor: 0.8 },
      '3,2': { c: '#fbf3ee', floor: 0.75 },
      '2,1': { c: '#fbf7fa', floor: 0.78 },
    },
  },
  { id: 'knight-cape', label: '기사 (망토)', meshes: [...limbs('Knight'), 'Knight_Cape'], paint: { '0,1': 'outfit' }, base: ['Knight_Cape', '0,1'] },
  { id: 'knight', label: '기사', meshes: limbs('Knight'), paint: { '0,1': 'outfit' }, base: ['Knight_Cape', '0,1'] },
  {
    id: 'mage-cape',
    label: '마법사 (망토)',
    meshes: [...limbs('Mage'), 'Mage_Cape'],
    paint: { '7,2': 'skin', '0,1': 'outfit', '7,1': ['outfit', 0.55], '2,1': ['outfit', 0.72] },
    base: ['Mage_Body', '0,1'],
  },
  { id: 'mage', label: '마법사', meshes: limbs('Mage'), paint: { '7,2': 'skin', '0,1': 'outfit', '7,1': ['outfit', 0.55] }, base: ['Mage_Body', '0,1'] },
  { id: 'ranger-cape', label: '레인저 (망토)', meshes: [...limbs('Ranger'), 'Ranger_Cape'], paint: { '0,0': 'skin', '0,1': 'outfit' }, base: ['Ranger_Cape', '0,1'] },
  { id: 'ranger', label: '레인저', meshes: limbs('Ranger'), paint: { '0,0': 'skin', '0,1': 'outfit' }, base: ['Ranger_Cape', '0,1'] },
  {
    id: 'rogue-cape',
    label: '로그 (망토)',
    meshes: [...limbs('Rogue'), 'Rogue_Cape'],
    paint: { '0,0': 'skin', '0,1': ['outfit', 0.8], '1,1': 'outfit' },
    base: ['Rogue_Cape', '1,1'],
  },
  { id: 'rogue', label: '로그', meshes: limbs('Rogue'), paint: { '0,0': 'skin', '0,1': ['outfit', 0.8], '1,1': 'outfit' }, base: ['Rogue_Cape', '1,1'] },
  { id: 'barbarian', label: '바바리안', meshes: limbs('Barbarian'), paint: { '0,0': 'skin', '6,0': 'outfit' }, base: ['Barbarian_Body', '6,0'] },
]

/** 머리(머리 모양) 레이어 */
export const HEADS = [
  { id: 'knight', label: '짧은 머리', meshes: ['Knight_Head'], paint: { '0,0': 'skin', '1,0': 'hair' } },
  { id: 'ranger', label: '콧수염', meshes: ['Ranger_Head'], paint: { '0,0': 'skin', '1,0': 'hair' } },
  { id: 'barbarian', label: '민머리와 수염', meshes: ['Barbarian_Head'], paint: { '0,0': 'skin', '1,0': 'hair' } },
  { id: 'rogue', label: '긴 웨이브', meshes: ['Rogue_Head'], paint: { '0,0': 'skin', '1,0': 'hair' } },
  { id: 'mage', label: '긴 생머리', meshes: ['Mage_Head'], paint: { '0,0': 'skin', '1,0': 'hair' } },
  { id: 'hood', label: '후드', meshes: ['RogueHooded_Head'], paint: { '0,0': 'skin', '1,0': 'hair', '1,1': 'outfit' } },
]

/**
 * 액세서리 조각. 조각마다 두 장을 굽는다:
 *   under = 조각 전체 (몸·머리보다 먼저 그린다)
 *   over  = ref(가리개)보다 앞에 있는 부분만 (맨 나중에 그린다)
 * 모자의 ref 는 "제 머리 + 모든 몸", 손에 든 물건·직접 만든 소품의 ref 는 "모든 머리 + 모든 몸".
 */
export const PIECES = {
  wizardHat: { meshes: ['Mage_Hat'], paint: { '1,1': 'outfit' }, ref: ['Mage_Head', ...ALL_BODIES] },
  helmet: { meshes: ['Knight_Helmet'], paint: {}, ref: ['Knight_Head', ...ALL_BODIES] },
  bearHat: { meshes: ['Barbarian_BearHat'], paint: {}, ref: ['Barbarian_Head', ...ALL_BODIES] },
  mask: { meshes: ['RogueHooded_Mask'], paint: { '0,1': ['outfit', 0.8] }, ref: ['RogueHooded_Head', ...ALL_BODIES] },
  flowerCrown: { meshes: ['flowerCrown'], paint: {}, ref: [...ALL_HEADS, ...ALL_BODIES] },
  mug: { meshes: ['mug'], paint: {}, ref: [...ALL_HEADS, ...ALL_BODIES] },
  book: { meshes: ['book'], paint: {}, ref: [...ALL_HEADS, ...ALL_BODIES] },
  staff: { meshes: ['staff'], paint: {}, ref: [...ALL_HEADS, ...ALL_BODIES] },
  wand: { meshes: ['wand'], paint: {}, ref: [...ALL_HEADS, ...ALL_BODIES] },
  bouquet: { meshes: ['bouquet'], paint: {}, ref: [...ALL_HEADS, ...ALL_BODIES] },
  veil: { meshes: ['veil'], paint: {}, ref: [...ALL_HEADS, ...limbs('Mage'), 'Mage_Cape'] },
}

/** 액세서리 목록 (0번 "없음" 은 실행 쪽에서 붙인다). hat = 머리에 쓰는 것(후드 머리에는 랜덤으로 주지 않는다), couple = 신랑·신부 전용 */
export const ACCESSORIES = [
  { label: '마법사 모자', hat: true, pieces: ['wizardHat'] },
  { label: '투구', hat: true, pieces: ['helmet'] },
  { label: '곰 모자', hat: true, pieces: ['bearHat'] },
  { label: '복면', pieces: ['mask'] },
  { label: '화관', hat: true, pieces: ['flowerCrown'] },
  { label: '머그잔', pieces: ['mug'] },
  { label: '책', pieces: ['book'] },
  { label: '지팡이', pieces: ['staff'] },
  { label: '요술봉', pieces: ['wand'] },
  { label: '꽃다발', pieces: ['bouquet'] },
  { label: '마법사 모자와 지팡이', hat: true, pieces: ['wizardHat', 'staff'] },
  { label: '면사포와 부케', pieces: ['veil', 'bouquet'], couple: true },
]

export const SKINS = [
  { label: '밝은 살구', color: '#f6c6a4' },
  { label: '아이보리', color: '#fbdcc4' },
  { label: '웜 베이지', color: '#e8b088' },
  { label: '탠', color: '#c98d62' },
  { label: '브라운', color: '#9c6644' },
  { label: '다크 브라운', color: '#6d452d' },
]

/** 앞의 넷이 자연스러운 어두운 색 */
export const HAIR_COLORS = [
  { label: '블랙', color: '#3d3639' },
  { label: '다크 브라운', color: '#5e3f30' },
  { label: '밤색', color: '#a5644a' },
  { label: '라이트 브라운', color: '#bd8a5a' },
  { label: '금발', color: '#e8c698' },
  { label: '백금발', color: '#f3e8d2' },
  { label: '회색', color: '#a8a29c' },
  { label: '빨강', color: '#cf4a34' },
  { label: '핑크', color: '#ec93b4' },
  { label: '파랑', color: '#5d86cc' },
]

/** 0번은 "기본" — 의상마다 원본의 색 (BODIES[].base) */
export const OUTFIT_COLORS = [
  { label: '기본', color: null },
  { label: '빨강', color: '#e25555' },
  { label: '주황', color: '#ee8a3c' },
  { label: '노랑', color: '#f0c64a' },
  { label: '초록', color: '#3ea35d' },
  { label: '청록', color: '#2aa39a' },
  { label: '하늘', color: '#3fa4dc' },
  { label: '파랑', color: '#3e5fb5' },
  { label: '보라', color: '#7a68b8' },
  { label: '분홍', color: '#ea7fa8' },
  { label: '흰색', color: '#f2f0ee' },
  { label: '검정', color: '#3a3b45' },
]

/** 신랑·신부의 고정 외형 (번호는 위 목록의 순서) */
export const GROOM = { skin: 0, hairStyle: 0, hairColor: 1, outfit: 0, outfitColor: 0, accessory: 0 }
export const BRIDE = { skin: 0, hairStyle: 3, hairColor: 1, outfit: 1, outfitColor: 0, accessory: 12 }

/* ── 직접 만든 소품 ───────────────────────────────────────── */

/**
 * 원본 팩에 없는 결혼식 소품을 기본 도형으로 만든다. 좌표는 "정지 자세의 무대 좌표"(발 = 원점, +Z 가 앞, +Y 가 위).
 * anchors = { handR, handL }: 손 슬롯 뼈의 위치.
 * 돌려주는 것: [{ name, bone: 'head' | 'chest' | 'r' | 'l', object }] — 메쉬의 userData.flat = { color, faceted? }
 */
export function buildProps(THREE, anchors) {
  const mesh = (geo, color, opt = {}) => {
    const m = new THREE.Mesh(geo)
    m.userData.flat = { color, ...opt }
    return m
  }
  const ball = (r, color, x, y, z, detail = 1) => {
    const m = mesh(new THREE.IcosahedronGeometry(r, detail), color, { faceted: detail < 2 })
    m.position.set(x, y, z)
    return m
  }
  const props = []

  // 나비넥타이: 턱 아래 가슴 앞
  {
    const g = new THREE.Group()
    for (const s of [-1, 1]) {
      const wing = mesh(new THREE.ConeGeometry(0.075, 0.13, 4), '#22242e', { faceted: true })
      wing.rotation.z = (s * Math.PI) / 2
      wing.position.set(s * 0.075, 0, 0)
      g.add(wing)
    }
    g.add(ball(0.04, '#3a3c48', 0, 0, 0.01))
    g.position.set(0, 1.04, 0.37)
    props.push({ name: 'bowtie', bone: 'chest', object: g })
  }
  // 부토니에르: 왼쪽 가슴의 작은 꽃
  {
    const g = new THREE.Group()
    g.add(ball(0.05, '#f7a8bd', 0, 0, 0))
    g.add(ball(0.035, '#6fae62', -0.045, -0.04, -0.005))
    g.position.set(0.2, 0.93, 0.36)
    props.push({ name: 'boutonniere', bone: 'chest', object: g })
  }
  // 면사포: 머리 뒤쪽 반을 감싸며 허리 아래까지 내려오는 얇은 껍질 + 정수리의 작은 꽃 장식
  {
    const g = new THREE.Group()
    const profile = [
      [0.1, 2.3],
      [0.36, 2.27],
      [0.58, 2.1],
      [0.66, 1.8],
      [0.67, 1.45],
      [0.66, 1.1],
      [0.68, 0.85],
    ].map(([r, y]) => new THREE.Vector2(r, y))
    const shell = mesh(new THREE.LatheGeometry(profile, 12, Math.PI * 0.68, Math.PI * 0.64), '#fdfbff')
    g.add(shell)
    const blooms = ['#ffffff', '#f7a8bd', '#ffffff', '#f7a8bd', '#ffffff']
    blooms.forEach((c, i) => {
      const a = ((i - 2) * 26 * Math.PI) / 180
      g.add(ball(0.075, c, Math.sin(a) * 0.5, 2.2 - Math.abs(i - 2) * 0.035, Math.cos(a) * 0.5 - 0.42))
    })
    props.push({ name: 'veil', bone: 'head', object: g })
  }
  // 화관: 머리 둘레의 꽃 고리
  {
    const g = new THREE.Group()
    const colors = ['#f7a8bd', '#fff6e8', '#f6d365', '#fff6e8', '#f48fb1', '#fff6e8', '#f6d365', '#fff6e8', '#f7a8bd', '#fff6e8', '#f48fb1', '#fff6e8']
    const n = colors.length
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      g.add(ball(i % 2 ? 0.07 : 0.09, colors[i], Math.sin(a) * 0.56, 2.02 + (i % 2 ? 0.02 : 0), Math.cos(a) * 0.56 + 0.02))
      const a2 = ((i + 0.5) / n) * Math.PI * 2
      g.add(ball(0.055, '#6fae62', Math.sin(a2) * 0.57, 1.97, Math.cos(a2) * 0.57 + 0.02))
    }
    props.push({ name: 'flowerCrown', bone: 'head', object: g })
  }
  // 꽃다발: 오른손에 쥔 포장지 고깔 + 꽃 송이
  {
    const g = new THREE.Group()
    const wrap = mesh(new THREE.ConeGeometry(0.17, 0.4, 7, 1, true), '#fff6e8', { faceted: true })
    wrap.rotation.x = Math.PI
    wrap.position.set(0, 0.2, 0)
    g.add(wrap)
    const stem = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 5), '#6fae62')
    stem.position.set(0, -0.04, 0)
    g.add(stem)
    const blooms = [
      ['#f7a8bd', 0, 0.45, 0],
      ['#ffffff', 0.11, 0.42, 0.04],
      ['#f48fb1', -0.11, 0.42, 0.03],
      ['#fff1c9', 0.03, 0.42, 0.12],
      ['#ffffff', -0.04, 0.42, -0.11],
      ['#f7a8bd', 0.09, 0.41, -0.08],
      ['#6fae62', -0.14, 0.37, -0.07],
      ['#6fae62', 0.15, 0.37, -0.03],
    ]
    for (const [c, x, y, z] of blooms) g.add(ball(c === '#6fae62' ? 0.07 : 0.09, c, x, y, z))
    // 손 위로 살짝 앞쪽으로 기울여 든다
    g.rotation.x = 0.35
    g.position.set(anchors.handR.x, anchors.handR.y - 0.02, anchors.handR.z + 0.02)
    props.push({ name: 'bouquet', bone: 'r', object: g })
  }
  return props
}
