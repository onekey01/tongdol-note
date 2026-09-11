/**
 * 화면이 열려 있는 동안 서버와 **가느다란 줄 하나**를 붙들고 있습니다.
 *
 * 창을 닫으면 줄이 끊어지고, 줄이 하나도 안 남으면 프로그램이 스스로
 * 꺼집니다(`server/지킴이.ts`). 사람이 검은 창을 찾아 Ctrl+C 를 누를
 * 일이 없어집니다.
 *
 * ── 끊겼다고 바로 포기하지 않습니다 ────────────────────────
 * 새로고침·잠깐의 끊김에도 줄은 끊어집니다. 그래서 **곧바로 다시 붙습니다.**
 * 서버 쪽은 잠시 기다렸다가 그때도 아무도 안 붙어 있으면 끕니다.
 *
 * 서버가 정말 꺼진 뒤에는 붙을 데가 없습니다. 그때는 **점점 뜸하게**
 * 두드리다 멈춥니다 — 꺼진 프로그램에 초마다 문을 두드려도 소용이 없고,
 * 그 사이 화면은 「프로그램이 꺼져 있습니다」를 보여 주면 됩니다.
 */

let 줄: WebSocket | null = null
let 시도 = 0
let 그만 = false

export function 줄잇기() {
  if (그만 || 줄) return
  try {
    const 규약 = location.protocol === 'https:' ? 'wss:' : 'ws:'
    줄 = new WebSocket(`${규약}//${location.host}/alive`)
  } catch {
    return 다시()
  }
  줄.onopen = () => { 시도 = 0 }
  줄.onclose = () => { 줄 = null; 다시() }
  줄.onerror = () => { /* onclose 가 이어서 옵니다. */ }
}

function 다시() {
  줄 = null
  시도++
  // 1초 → 2초 → 4초 … 최대 30초. 열 번 넘게 실패하면 그만둡니다.
  if (시도 > 12) return
  const 쉼 = Math.min(30_000, 1000 * 2 ** Math.min(시도 - 1, 5))
  setTimeout(줄잇기, 쉼)
}

/** 일부러 끊습니다 — 이 화면이 더는 프로그램을 붙들지 않게. */
export function 줄놓기() {
  그만 = true
  try { 줄?.close() } catch { }
  줄 = null
}
