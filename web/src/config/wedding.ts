/**
 * 청첩장 내용의 형태(WeddingConfig)와, 프론트에 번들되는 데모 청첩장(/w/demo)의 예시 값.
 * 실제 청첩장의 내용은 서버에 저장되고 /w/<주소>/edit 에서 수정합니다.
 */
export interface Person {
  name: string
  /** 성을 뺀 이름 (표지용) */
  firstName: string
  /** "장남" | "차남" | "장녀" | "차녀" | "아들" | "딸" ... */
  relation: string
  father?: { name: string; deceased?: boolean }
  mother?: { name: string; deceased?: boolean }
  phone?: string
}

export interface Account {
  role: string // 예: "신랑", "신랑 아버지"
  bank: string
  number: string
  holder: string
  /** 카카오페이 송금 링크(선택) */
  kakaoPayUrl?: string
}

export interface WeddingConfig {
  groom: Person
  bride: Person
  /** 예식 시작 일시 — 반드시 +09:00(KST) 오프셋 포함 ISO 문자열 */
  datetime: string
  /** 예식 예상 소요 시간(분) — 캘린더 일정 종료 시각 계산용 */
  durationMinutes: number
  venue: {
    name: string // 예: "OO웨딩홀"
    hall: string // 예: "3층 그랜드볼룸"
    address: string
    tel?: string
    /** WGS84 좌표 */
    lat: number
    lng: number
    transport: { title: string; lines: string[] }[]
  }
  greeting: { title: string; body: string[] }
  /** public/ 기준 상대경로. 비어 있으면 자리표시 그래픽이 렌더링됩니다 */
  coverImage?: string
  gallery: string[]
  accounts: { groomSide: Account[]; brideSide: Account[] }
  share: { title: string; description: string }
}

export const wedding: WeddingConfig = {
  groom: {
    name: '김신랑',
    firstName: '신랑',
    relation: '장남',
    father: { name: '김아버지' },
    mother: { name: '이어머니' },
    phone: '010-0000-0000',
  },
  bride: {
    name: '박신부',
    firstName: '신부',
    relation: '장녀',
    father: { name: '박아버지' },
    mother: { name: '최어머니' },
    phone: '010-0000-0000',
  },
  datetime: '2027-05-15T12:30:00+09:00',
  durationMinutes: 90,
  venue: {
    name: '예시웨딩홀',
    hall: '3층 그랜드홀',
    address: '서울특별시 중구 세종대로 110',
    tel: '02-000-0000',
    // 서울시청. 편집기의 "위치 미정" 자리표시 좌표(lib/venue.ts DEFAULT_COORDS)와 겹치지 않게 한다
    lat: 37.5665851,
    lng: 126.9782038,
    transport: [
      { title: '지하철', lines: ['1·2호선 시청역 5번 출구 도보 3분'] },
      { title: '버스', lines: ['시청앞·덕수궁 정류장 하차'] },
      { title: '주차', lines: ['건물 내 지하주차장 이용 (2시간 무료)'] },
    ],
  },
  greeting: {
    title: '초대합니다',
    body: [
      '서로 다른 길을 걸어온 두 사람이',
      '이제 같은 길을 함께 걸어가려 합니다.',
      '',
      '저희의 새로운 시작을',
      '가까이에서 축복해 주시면 감사하겠습니다.',
    ],
  },
  coverImage: undefined,
  gallery: [],
  accounts: {
    groomSide: [{ role: '신랑', bank: '예시은행', number: '000-0000-0000', holder: '김신랑' }],
    brideSide: [{ role: '신부', bank: '예시은행', number: '000-0000-0000', holder: '박신부' }],
  },
  share: {
    title: '김신랑 ♥ 박신부 결혼합니다',
    description: '2027년 5월 15일 토요일 오후 12시 30분 · 예시웨딩홀',
  },
}
