/**
 * 바디 스크롤 잠금 (참조 카운트).
 * 여러 오버레이(시트·카드·라이트박스)가 겹쳐 열리고 순서 없이 닫혀도 잠금이 남지 않도록 한곳에서 관리합니다.
 */
let count = 0
let prevOverflow = ''

export function lockScroll(): () => void {
  if (count === 0) {
    prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  count++
  let released = false
  return () => {
    if (released) return
    released = true
    count--
    if (count === 0) document.body.style.overflow = prevOverflow
  }
}
