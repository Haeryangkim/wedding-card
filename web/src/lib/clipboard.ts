/**
 * 클립보드 복사. 보안 컨텍스트가 아니거나 카카오톡 등 인앱 브라우저에서
 * navigator.clipboard 가 막힌 경우 execCommand('copy') 로 폴백합니다.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 아래 폴백으로
  }
  return legacyCopy(text)
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.width = '1px'
    ta.style.height = '1px'
    ta.style.padding = '0'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    const sel = document.getSelection()
    const prevRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    if (prevRange && sel) {
      sel.removeAllRanges()
      sel.addRange(prevRange)
    }
    return ok
  } catch {
    return false
  }
}
