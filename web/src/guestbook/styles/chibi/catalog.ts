/* 자동 생성 — art/chibi/build.py build (직접 고치지 말 것). 이름·개수·치수만 담는다 (이미지는 assets/, 저장소 밖) */

export const CHIBI_W = 160
export const CHIBI_H = 246
/** 위에서 발밑(접지선)까지 */
export const CHIBI_FOOT_Y = 240
/** 위에서 맨머리 꼭대기까지 (머리카락·장식 제외) */
export const CHIBI_HEAD_TOP = 28
/** assets/atlas.json 의 판 번호 — 어긋나면 load() 가 거절한다 */
export const CHIBI_ATLAS_V = 1

export const SKINS: readonly { label: string; hex: string }[] = [
  { label: "뽀얀 톤", hex: "#f9e9e6" },
  { label: "살구 톤", hex: "#f7ceb3" },
  { label: "베이지", hex: "#cfa384" },
  { label: "허니", hex: "#b88766" },
  { label: "브라운", hex: "#af7a6e" },
  { label: "딥 브라운", hex: "#784d45" },
]
export const FACES: readonly { label: string }[] = [
  { label: "순한 눈" },
  { label: "또렷한 눈" },
  { label: "속눈썹" },
  { label: "파란 눈" },
  { label: "초록 눈" },
  { label: "시크" },
  { label: "장난꾸러기" },
  { label: "보라 눈" },
]
/** 앞의 SHORT_HAIRS 개가 짧은 머리, 나머지가 긴 머리 */
export const HAIRS: readonly { label: string }[] = [
  { label: "댄디컷" },
  { label: "울프컷" },
  { label: "가르마" },
  { label: "곱슬 숏컷" },
  { label: "내린 앞머리" },
  { label: "삐죽 머리" },
  { label: "포마드" },
  { label: "웨이브 숏" },
  { label: "단발" },
  { label: "긴 생머리" },
  { label: "긴 웨이브" },
  { label: "포니테일" },
  { label: "올림머리" },
  { label: "땋은 머리" },
  { label: "아주 긴 머리" },
  { label: "컬 포니테일" },
  { label: "옆으로 넘긴 머리" },
]
export const SHORT_HAIRS = 8
/** 머리 색: 흑백 선화의 밝기로 fill(채움) ↔ line(선) 을 섞어 칠한다 */
export const HAIR_COLORS: readonly { label: string; hex: string; line: string }[] = [
  { label: "흑갈색", hex: "#533028", line: "#200d09" },
  { label: "검정", hex: "#292934", line: "#000000" },
  { label: "밤색", hex: "#b86e40", line: "#853f13" },
  { label: "금발", hex: "#ffd99d", line: "#d6ab64" },
  { label: "주황", hex: "#db592e", line: "#a82b01" },
  { label: "와인", hex: "#911714", line: "#5e0200" },
  { label: "회색", hex: "#969696", line: "#585858" },
  { label: "은발", hex: "#ffffff", line: "#d0d0d0" },
  { label: "로즈 핑크", hex: "#f2a7b8", line: "#c26f85" },
  { label: "민트", hex: "#9fd8cc", line: "#5fa596" },
]
/** 0 = 신랑(턱시도), 1 = 신부(웨딩드레스). female = 원피스·치마 차림 */
export const OUTFITS: readonly { label: string; female: boolean }[] = [
  { label: "턱시도", female: false },
  { label: "웨딩드레스", female: true },
  { label: "멜빵 셔츠", female: false },
  { label: "후드 재킷", female: false },
  { label: "가죽 재킷", female: false },
  { label: "셔츠와 슬랙스", female: false },
  { label: "초록 니트", female: false },
  { label: "왕자님", female: false },
  { label: "검정 티셔츠", female: false },
  { label: "올리브 셔츠", female: false },
  { label: "민트 원피스", female: true },
  { label: "와인 드레스", female: true },
  { label: "핑크 원피스", female: true },
  { label: "하늘 블라우스와 치마", female: true },
  { label: "보라 홀터와 청바지", female: true },
  { label: "조끼와 랩스커트", female: true },
  { label: "흰 티셔츠와 청바지", female: true },
  { label: "하늘 원피스", female: true },
]
/** 액세서리 (외형의 accessory = 이 목록의 번호 + 1, 0 = 없음). 마지막(면사포)은 신부 몫 */
export const ACCESSORIES: readonly { label: string }[] = [
  { label: "동그란 안경" },
  { label: "화관" },
  { label: "리본" },
  { label: "나뭇가지 왕관" },
  { label: "귀걸이" },
  { label: "볼터치" },
  { label: "요정 날개" },
  { label: "면사포" },
]
/** 고정 캐릭터의 외형 (face 는 outfitColor 칸) */
export const GROOM = {"skin": 1, "hairStyle": 0, "hairColor": 1, "outfit": 0, "face": 1, "accessory": 0} as const
export const BRIDE = {"skin": 0, "hairStyle": 12, "hairColor": 0, "outfit": 1, "face": 2, "accessory": 8} as const
