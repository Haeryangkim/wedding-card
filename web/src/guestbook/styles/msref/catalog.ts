/* 자동 생성 — art/msref/build.py build (직접 고치지 말 것). 이름·아이템 번호·치수만 담는다 (이미지는 assets/, 저장소 밖) */

export const MSREF_W = 66
export const MSREF_H = 86
/** 위에서 발밑(접지선)까지 */
export const MSREF_FOOT_Y = 83
/** 발밑에서 맨머리 꼭대기까지 (머리카락·모자 제외) */
export const MSREF_HEAD_TOP = 64
export const POSES = ["stand1:0", "stand1:1", "stand1:2", "walk1:0", "walk1:1", "walk1:2", "walk1:3"] as const

export const SKINS: readonly { label: string; id: number; hex: string }[] = [
  { label: "밝은 톤", id: 2000, hex: "#ffe2bc" },
  { label: "뽀얀 톤", id: 2003, hex: "#ffecdc" },
  { label: "핑크빛", id: 2010, hex: "#ffe5e4" },
  { label: "베이지", id: 2011, hex: "#d2b396" },
  { label: "태닝", id: 2001, hex: "#b3864e" },
  { label: "브라운", id: 2002, hex: "#8b6b3b" },
]
export const FACES: readonly { label: string; id: number }[] = [
  { label: "순한 눈", id: 20033 },
  { label: "또렷한 눈", id: 20005 },
  { label: "구슬 눈", id: 20038 },
  { label: "큰 눈", id: 21004 },
  { label: "속눈썹", id: 21028 },
  { label: "수줍은 눈", id: 21031 },
]
/** 머리 아이템 번호 = base + 색의 digit (게임 원래의 색 변형 — 틴트가 아니다) */
export const HAIRS: readonly { label: string; base: number }[] = [
  { label: "프린스 컷", base: 33000 },
  { label: "단정한 숏컷", base: 33240 },
  { label: "부스스 숏컷", base: 33250 },
  { label: "베이비 컷", base: 33330 },
  { label: "바람 웨이브", base: 33340 },
  { label: "도토리 컷", base: 30310 },
  { label: "바가지 컷", base: 30480 },
  { label: "C컬 단발", base: 34040 },
  { label: "버섯 단발", base: 34230 },
  { label: "앞머리 긴머리", base: 34250 },
  { label: "양갈래", base: 34220 },
  { label: "리본 묶음", base: 34100 },
  { label: "포니테일", base: 34190 },
  { label: "올림머리", base: 34350 },
  { label: "긴 웨이브", base: 34210 },
  { label: "반묶음", base: 34240 },
]
export const HAIR_COLORS: readonly { label: string; digit: number; hex: string }[] = [
  { label: "검정", digit: 0, hex: "#343434" },
  { label: "갈색", digit: 7, hex: "#8e4626" },
  { label: "금발", digit: 3, hex: "#dc9610" },
  { label: "오렌지", digit: 2, hex: "#d2540c" },
  { label: "빨강", digit: 1, hex: "#be1415" },
  { label: "보라", digit: 6, hex: "#8624aa" },
  { label: "파랑", digit: 5, hex: "#236fb2" },
  { label: "초록", digit: 4, hex: "#659e2c" },
]
export const OUTFITS: readonly { label: string; items: readonly number[] }[] = [
  { label: "턱시도", items: [1050113, 1072010] },
  { label: "웨딩드레스", items: [1051114, 1071107] },
  { label: "네이비 정장", items: [1050131, 1072010] },
  { label: "화이트 정장", items: [1050134, 1070090] },
  { label: "블루 드레스", items: [1051150, 1071005] },
  { label: "핑크 드레스", items: [1051151, 1071004] },
  { label: "교복", items: [1050139, 1072010] },
  { label: "세일러 원피스", items: [1051162, 1071000] },
  { label: "고양이 후드", items: [1050141, 1072004] },
  { label: "핑크 고양이 후드", items: [1051164, 1071004] },
  { label: "멜빵바지", items: [1050146, 1072012] },
  { label: "캐주얼 재킷", items: [1050125, 1072006] },
  { label: "피크닉 원피스", items: [1051108, 1071005] },
  { label: "한복 (도령)", items: [1050229, 1072004] },
  { label: "한복 (아씨)", items: [1051166, 1072004] },
  { label: "티셔츠와 반바지", items: [1040002, 1060002, 1072012] },
]
/** 0번(없음)은 여기 없다 — accessory 인덱스 n 은 ACCESSORIES[n - 1] */
export const ACCESSORIES: readonly { label: string; items: readonly number[] }[] = [
  { label: "동그란 안경", items: [1022285] },
  { label: "뿔테 안경", items: [1022044] },
  { label: "선글라스", items: [1022004] },
  { label: "핑크 선글라스", items: [1022055] },
  { label: "핑크 리본", items: [1002727] },
  { label: "리본 머리띠", items: [1002887] },
  { label: "베레모", items: [1001013] },
  { label: "밀짚모자", items: [1003141] },
  { label: "화관", items: [1002310] },
  { label: "장미 핀", items: [1004937] },
  { label: "헤드폰", items: [1002747] },
  { label: "고양이 귀", items: [1001031] },
  { label: "토끼 귀", items: [1003050] },
  { label: "티아라", items: [1001017] },
  { label: "웨딩 베일", items: [1000029] },
]
/** 신랑·신부: skin, hair, hairColor, outfit, face, accessory 인덱스 */
export const GROOM = {"skin": 0, "hair": 0, "hairColor": 0, "outfit": 0, "face": 0, "accessory": 0} as const
export const BRIDE = {"skin": 0, "hair": 9, "hairColor": 1, "outfit": 1, "face": 4, "accessory": 15} as const
