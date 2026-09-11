import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import { useRoute } from '../lib/router'

/**
 * 메모 보드 — 사무실 벽에 걸린 화이트보드.
 *
 * ── 왜 목록이 아니라 보드인가 ──────────────────────────────
 * 사람이 벽에 종이를 붙일 때 아무 데나 붙이지 않습니다.
 * 급한 것은 눈높이에, 관련된 것끼리 옆에, 오래된 것은 구석에.
 * **그 자리 자체가 정보입니다.** 프로그램이 줄로 세우면 그 정보가 사라집니다.
 *
 * ── 어디에 있는가 ──────────────────────────────────────────
 * 홈에만 있으면 배정하다가 떠오른 것을 적을 수 없습니다.
 * 그래서 **어느 화면에서나** 오른쪽 가장자리 탭으로 열립니다.
 * 열면 서랍처럼 옆으로 나오고, 화면을 다 가리지 않으니 보면서 일할 수 있습니다.
 * 서랍 너비는 왼쪽 가장자리를 잡아 끌어 조절합니다.
 *
 * ── 어느 보드가 열리는가는 **화면이 정합니다** ─────────────
 * 여기에 보드 고르는 단추는 없습니다. 있으면 지금 보는 것이 누구 보드인지
 * 매번 확인해야 하고, 그러면 남의 보드에 적는 일이 생깁니다.
 *
 *   홈·배정·그 밖의 화면   기관 보드
 *   대상자 상세 화면       그 어르신 보드
 *   기록지에서 이름 누름   그 어르신 보드 (memo.ts 가 알려 줍니다)
 *
 * 화면을 벗어나면 저절로 기관 보드로 돌아옵니다.
 *
 * ── 지키는 것 하나 ─────────────────────────────────────────
 * **메모지끼리 겹치지 않습니다.** 겹치면 아래 것이 안 보이고,
 * 안 보이는 메모는 없는 메모입니다.
 * 부딪히면 미는 것이 아니라 **움직이는 쪽이 멈추거나 비켜섭니다** —
 * 남이 맞춰 둔 자리를 프로그램이 흔들면 안 됩니다.
 *
 * ── 단추는 적을수록 좋습니다 ───────────────────────────────
 * 메모지를 **누르면 바로 고쳐집니다.** 「고침」 단추가 따로 없습니다.
 * 보고 있을 때 보이는 단추는 「떼기」 하나뿐이고,
 * 지우기는 고치는 중에만 나옵니다 — 손이 미끄러져 지우는 일이 없게.
 */

const COLORS = ['yellow', 'pink', 'blue', 'green'] as const
const 색이름: Record<string, string> = {
  yellow: '노랑', pink: '분홍', blue: '파랑', green: '초록',
}

/** 서버(sticky.ts 자리규칙)가 보내 줍니다. 못 받았을 때 쓸 기본값입니다. */
const 기본규칙 = {
  기본너비: 220, 기본높이: 150,
  최소너비: 160, 최소높이: 110,
  최대너비: 480, 최대높이: 420,
  틈: 10, 격자: 10, 보드너비: 960,
}
type 규칙 = typeof 기본규칙
type 네모 = { x: number; y: number; w: number; h: number }

const 사이 = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

function 겹치나(a: 네모, b: 네모, 틈: number) {
  return !(a.x + a.w + 틈 <= b.x || b.x + b.w + 틈 <= a.x ||
           a.y + a.h + 틈 <= b.y || b.y + b.h + 틈 <= a.y)
}

// ── 서랍 너비는 그 사람 브라우저에만 둡니다 ────────────────
// 보드에 붙은 자리는 기관이 함께 보는 것이라 자료함에 있지만,
// 「서랍을 얼마나 넓게 여는가」는 쓰는 사람 손에 맞춘 값입니다.
// 열고 접은 상태는 **기억하지 않습니다** — 켤 때마다 접힌 채 시작합니다.
const 기억 = {
  읽기(key: string, 그냥: number) {
    try {
      const v = Number(localStorage.getItem(key))
      return Number.isFinite(v) && v > 0 ? v : 그냥
    } catch { return 그냥 }
  },
  쓰기(key: string, v: number) { try { localStorage.setItem(key, String(v)) } catch { } },
}

/**
 * 색 고르기.
 *
 * 반 이름을 `memo-swatch` 로 둡니다. 그냥 `swatch` 로 두었더니
 * 메모지 안의 「단추는 이렇게 생겼다」는 규칙이 더 세서 **네 개가 모두
 * 같은 반투명 흰색**이 되고, 메모지 색이 비쳐 네 개가 한꺼번에 바뀌는
 * 것처럼 보였습니다. 실제로 그렇게 만들었다가 쓰는 사람이 잡아냈습니다.
 */
function 색고르기({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <span className="memo-swatches">
      {COLORS.map((c) => (
        <button key={c} type="button" className={`memo-swatch ${c}`}
                aria-pressed={value === c} aria-label={색이름[c]} title={색이름[c]}
                onClick={(e) => { e.stopPropagation(); onPick(c) }} />
      ))}
    </span>
  )
}

/* ── 메모지 한 장 ────────────────────────────────────────── */
function 메모지({
  s, me, 규칙, 남들, onChange, onPlace, 맨위로, 맨위인가,
}: {
  s: any; me: any; 규칙: 규칙; 남들: 네모[]
  onChange: () => void
  onPlace: (id: number, 자리: 네모) => void
  맨위로: (id: number) => void
  맨위인가: boolean
}) {
  const [고치는중, 고치기] = useState(false)
  const [글, 글쓰기] = useState(s.text)
  const [색, 색쓰기] = useState<string>(s.color)
  const [바쁨, 바쁘게] = useState(false)

  // 끌고 있는 동안의 자리. 손을 떼면 서버가 정한 자리로 맞춥니다.
  const [지금, 지금으로] = useState<네모 | null>(null)
  const 끌기 = useRef<any>(null)
  /*
   * 끌고 있는 동안의 자리를 **ref 에도** 둡니다.
   * 손을 빨리 움직이면 화면 새로 그리기가 못 따라오는데, 그때 계산의 기준을
   * 화면 값(state)에서 가져오면 한 걸음 전 자리를 기준으로 삼아 벽을 못 탑니다.
   * 계산은 ref 로, 보여주는 것은 state 로.
   */
  const 살아있는자리 = useRef<네모 | null>(null)

  const 내것 = s.authorId === me?.id || (me?.isAdmin ?? false)
  const 자리: 네모 = 지금 ?? { x: s.x ?? 0, y: s.y ?? 0, w: s.w, h: s.h }

  // 밖에서 글이나 색이 바뀌었을 때(다른 사람이 고쳤을 때) 따라갑니다.
  useEffect(() => { if (!고치는중) { 글쓰기(s.text); 색쓰기(s.color) } }, [s.text, s.color, 고치는중])

  async function 해보기(하기: () => Promise<unknown>) {
    바쁘게(true)
    try { await 하기(); onChange() }
    catch (e: any) { alert(e.message) }
    finally { 바쁘게(false) }
  }

  const 눈금 = (v: number) => Math.round(v / 규칙.격자) * 규칙.격자

  /** 옮기기 — 부딪히면 벽을 타고 미끄러집니다(한 축씩 따로 봅니다). */
  function 옮겨보기(바라는x: number, 바라는y: number, 기준: 네모): 네모 {
    const nx = Math.max(0, 눈금(바라는x))
    const ny = Math.max(0, 눈금(바라는y))
    const 되나 = (x: number, y: number) =>
      !남들.some((o) => 겹치나({ x, y, w: 기준.w, h: 기준.h }, o, 규칙.틈))
    if (되나(nx, ny)) return { ...기준, x: nx, y: ny }
    if (되나(nx, 기준.y)) return { ...기준, x: nx }      // 가로로만
    if (되나(기준.x, ny)) return { ...기준, y: ny }      // 세로로만
    return 기준
  }

  /** 크기 — 옆 사람에 닿기 직전까지만 커집니다. */
  function 키워보기(바라는w: number, 바라는h: number, 기준: 네모): 네모 {
    let maxW = 규칙.최대너비
    let maxH = 규칙.최대높이
    for (const o of 남들) {
      const 세로겹침 = !(기준.y + 규칙.최소높이 + 규칙.틈 <= o.y || o.y + o.h + 규칙.틈 <= 기준.y)
      const 가로겹침 = !(기준.x + 규칙.최소너비 + 규칙.틈 <= o.x || o.x + o.w + 규칙.틈 <= 기준.x)
      if (세로겹침 && o.x > 기준.x) maxW = Math.min(maxW, o.x - 규칙.틈 - 기준.x)
      if (가로겹침 && o.y > 기준.y) maxH = Math.min(maxH, o.y - 규칙.틈 - 기준.y)
    }
    return {
      ...기준,
      w: 사이(눈금(바라는w), 규칙.최소너비, Math.max(규칙.최소너비, 눈금(maxW))),
      h: 사이(눈금(바라는h), 규칙.최소높이, Math.max(규칙.최소높이, 눈금(maxH))),
    }
  }

  function 잡기(e: React.PointerEvent, 무엇: 'move' | 'resize') {
    if (고치는중) return
    // 단추·글상자 위에서는 끌지 않습니다. 누르려던 것이 끌려가면 안 됩니다.
    const t = e.target as HTMLElement
    if (무엇 === 'move' && t.closest('button, textarea, input, a')) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    맨위로(s.id)
    const 처음: 네모 = { x: s.x ?? 0, y: s.y ?? 0, w: s.w, h: s.h }
    끌기.current = { 무엇, 시작x: e.clientX, 시작y: e.clientY, 처음, 움직임: 0 }
    살아있는자리.current = 처음
    지금으로(처음)
  }

  function 움직이기(e: React.PointerEvent) {
    const d = 끌기.current
    if (!d) return
    const dx = e.clientX - d.시작x
    const dy = e.clientY - d.시작y
    d.움직임 = Math.max(d.움직임, Math.abs(dx) + Math.abs(dy))
    const 다음 = d.무엇 === 'move'
      ? 옮겨보기(d.처음.x + dx, d.처음.y + dy, 살아있는자리.current ?? d.처음)
      : 키워보기(d.처음.w + dx, d.처음.h + dy, d.처음)
    살아있는자리.current = 다음
    지금으로(다음)
  }

  function 놓기(e: React.PointerEvent) {
    const d = 끌기.current
    if (!d) return
    끌기.current = null
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { }
    const 끝 = 살아있는자리.current
    살아있는자리.current = null
    지금으로(null)
    if (!끝) return
    const 그대로 = 끝.x === d.처음.x && 끝.y === d.처음.y &&
                   끝.w === d.처음.w && 끝.h === d.처음.h
    /*
     * 끌지 않고 **누르기만 했으면 고치기로 들어갑니다.**
     * 종이에 뭘 적으려면 종이를 집어 들지, 「고침」이라는 단추를 찾지 않습니다.
     * 손이 조금 떨린 것(4px 안쪽)은 누른 것으로 봅니다.
     */
    if (그대로 && d.무엇 === 'move' && d.움직임 < 4) {
      if (내것) 고치기(true)
      return
    }
    if (그대로) return
    onPlace(s.id, 끝)
  }

  async function 저장하기() {
    await 해보기(async () => {
      await api.updateSticky(s.id, { text: 글, color: 색 })
      고치기(false)
    })
  }
  function 되돌리기() {
    글쓰기(s.text); 색쓰기(s.color); 고치기(false)
  }

  // 반 이름을 'memo-note' 로 둔 이유: 이 프로그램에는 이미 설명문용 `.note` 가 있습니다.
  // 같은 이름을 쓰면 화면 곳곳의 설명문이 메모지 규칙(position:absolute)을 뒤집어써
  // 표 위로 겹쳐 올라갑니다. 실제로 그렇게 만들었다가 시험이 잡아냈습니다.
  const 반 = ['memo-note', 고치는중 ? 색 : s.color, 맨위인가 ? 'top' : '',
              고치는중 ? 'editing' : '', 끌기.current ? 'moving' : '']
    .filter(Boolean).join(' ')

  return (
    <div className={반}
         style={{ left: 자리.x, top: 자리.y, width: 자리.w, height: 자리.h }}
         onPointerDown={(e) => 잡기(e, 'move')}
         onPointerMove={움직이기}
         onPointerUp={놓기}
         onPointerCancel={놓기}
         title={고치는중 ? undefined : 내것 ? '눌러서 고칩니다 · 끌어서 옮깁니다' : '끌어서 옮깁니다'}>

      {고치는중 ? (
        <>
          <textarea value={글} onChange={(e) => 글쓰기(e.target.value)} autoFocus
                    aria-label="메모 내용"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { e.preventDefault(); 되돌리기() }
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); 저장하기() }
                    }} />
          <div className="foot">
            <색고르기 value={색} onPick={색쓰기} />
            <span className="spacer" />
            <button className="danger-plain" disabled={바쁨}
                    title="이 메모를 아주 없앱니다. 되돌릴 수 없습니다."
                    onClick={() => {
                      if (!confirm('이 메모를 아주 없앱니다. 되돌릴 수 없습니다.\n\n끝난 일이라 치우려는 것이면 「떼기」를 쓰세요 — 30일 동안 남아 있어 다시 붙일 수 있습니다.')) return
                      해보기(() => api.removeSticky(s.id))
                    }}>지움</button>
            <button disabled={바쁨} onClick={되돌리기}>취소</button>
            <button className="primary" disabled={바쁨 || !글.trim()} onClick={저장하기}>저장</button>
          </div>
        </>
      ) : (
        <>
          <div className="body">{s.text}</div>
          <div className="meta">
            <span className="who" title={s.author}>{s.author}</span>
          </div>
          {내것 && (
            <div className="foot">
              <span className="spacer" />
              <button disabled={바쁨}
                      title="보드에서 떼어 아래 「뗀 메모」에 둡니다. 바로 없어지는 것이 아니라 30일 동안 남아 있고, 언제든 다시 붙일 수 있습니다."
                      onClick={() => 해보기(() => api.doneSticky(s.id, true))}>떼기</button>
            </div>
          )}
          {/* 오른쪽 아래 모서리를 잡고 끌면 크기가 바뀝니다. */}
          <span className="grip" title="끌어서 크기 조절"
                onPointerDown={(e) => { e.stopPropagation(); 잡기(e, 'resize') }}
                onPointerMove={움직이기}
                onPointerUp={놓기}
                onPointerCancel={놓기} />
        </>
      )}
    </div>
  )
}

/* ── 보드 ────────────────────────────────────────────────── */
/** 주소에서 「지금 누구 화면인가」를 읽습니다. /recipients/<uuid> */
function 지금대상자(path: string): string {
  const m = path.match(/^\/recipients\/([0-9a-f-]{36})/i)
  return m ? m[1] : ''
}

export default function MemoBoard() {
  const path = useRoute()
  const 화면대상자 = 지금대상자(path)

  /*
   * **켜면 늘 접혀 있습니다.**
   *
   * 열어 둔 상태를 기억하게 해 두었더니, 한 번 열고 나면 다음 날 켜도
   * 서랍이 펼쳐진 채로 떠서 배정표가 좁아진 채 시작했습니다.
   * 메모는 **볼 일이 있을 때 펴는 것**이지 늘 펼쳐 두는 것이 아닙니다.
   *
   * 세션 안에서는 그대로 유지됩니다 — 화면을 옮겨 다녀도 열어 둔 것은 열려 있고,
   * 새로 켜거나 새로고침할 때만 접힌 채 시작합니다.
   * 서랍 **너비**는 그대로 기억합니다. 그건 그 사람 손에 맞춘 값입니다.
   */
  const [열림, 열기] = useState(false)
  const [너비, 너비로] = useState(() => 기억.읽기('memo.width', 520))
  const [자료, 자료넣기] = useState<any>(null)

  /*
   * 화면이 「이 사람 보드를 열어 달라」고 한 것.
   * 기록지에서 이름을 누를 때처럼 **주소가 안 바뀌는** 자리에서 씁니다.
   * 다른 화면으로 넘어가면 저절로 풀립니다.
   */
  const [부름, 부름으로] = useState<{ id: string; name: string }>({ id: '', name: '' })
  useEffect(() => {
    const 듣기 = (e: any) => {
      const id = String(e?.detail?.id ?? '')
      부름으로({ id, name: String(e?.detail?.name ?? '') })
      /*
       * 보라고 부른 것이면 펼쳐 줍니다.
       *
       * 다만 **조용히** 부르는 자리가 있습니다 — 배정 상자를 열었을 때는
       * 「이 사람 보드로 돌려 놓기만」 하면 됩니다. 서랍까지 저절로 열리면
       * 배정표가 좁아져 하던 일을 방해합니다. 그때 `quiet` 를 보냅니다.
       */
      if (id && !e?.detail?.quiet) 열기(true)
    }
    window.addEventListener('memo:board', 듣기 as EventListener)
    return () => window.removeEventListener('memo:board', 듣기 as EventListener)
  }, [])
  useEffect(() => { 부름으로({ id: '', name: '' }) }, [path])

  /*
   * 지금 보고 있는 보드 — **고르는 것이 아니라 화면이 정합니다.**
   * 대상자 화면이면 그 사람, 기록지에서 부른 것이면 그 사람, 아니면 기관.
   */
  const 보드 = 화면대상자 || 부름.id

  /*
   * 이름을 기억해 둡니다. 서버가 아직 안 보내 준 사이에도 탭에는
   * 「이 대상자」가 아니라 **「강판례」**라고 적혀 있어야 합니다.
   */
  const [이름기억, 이름기억으로] = useState('')
  useEffect(() => { 이름기억으로(부름.name || '') }, [보드, 부름.name])

  const [새로쓰기, 새로쓰기로] = useState(false)
  const [글, 글쓰기] = useState('')
  const [색, 색쓰기] = useState<string>('yellow')
  const [뗀것보기, 뗀것보이기] = useState(false)
  const [맨위, 맨위로] = useState<number | null>(null)
  const [알림, 알리기] = useState('')

  /*
   * 메모장은 **관리자만** 씁니다(서버 perm.ts 의 "memo.use").
   * 권한이 없으면 탭도 보이지 않아야 합니다 — 눌러도 안 열리는 탭이
   * 가장자리에 붙어 있으면 「고장 났나」 싶습니다.
   */
  const [막힘, 막기] = useState(false)

  const 불러오기 = useCallback(async () => {
    try {
      const d = await api.stickies(true, 보드)
      자료넣기(d)
      막기(false)
      if (보드 && d.boardName) 이름기억으로(d.boardName)
    } catch { 막기(true) }
  }, [보드])
  useEffect(() => { 불러오기() }, [불러오기])

  /*
   * 본문을 **덮지 않고 밀어냅니다.**
   * 덮으면 배정표를 보면서 메모를 적을 수 없고, 그러면 메모를 안 적습니다.
   * 서랍이 차지한 만큼 본문 오른쪽을 비워 둡니다 — 진짜 사이드바처럼.
   */
  useEffect(() => {
    const el = document.documentElement
    el.style.setProperty('--memo-w', 열림 ? `${너비}px` : '0px')
    return () => el.style.setProperty('--memo-w', '0px')
  }, [열림, 너비])

  const 규칙: 규칙 = { ...기본규칙, ...(자료?.rules ?? {}) }
  const items: any[] = 자료?.items ?? []
  const me = 자료?.me ?? null
  const 붙은것 = items.filter((x) => !x.done)
  const 뗀것 = items.filter((x) => x.done)

  // 서랍 너비 조절 —— 왼쪽 가장자리를 잡고 끕니다.
  const 서랍끌기 = useRef<any>(null)
  function 서랍잡기(e: React.PointerEvent) {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    서랍끌기.current = { 시작x: e.clientX, 처음: 너비 }
  }
  function 서랍움직이기(e: React.PointerEvent) {
    const d = 서랍끌기.current
    if (!d) return
    // 왼쪽으로 끌면 넓어집니다. 본문이 최소 320px 는 남게 둡니다 —
    // 메모를 보려고 하던 일을 못 보게 되면 뒤바뀐 것입니다.
    const 최대 = Math.max(360, window.innerWidth - 320)
    너비로(사이(d.처음 - (e.clientX - d.시작x), 360, 최대))
  }
  function 서랍놓기(e: React.PointerEvent) {
    if (!서랍끌기.current) return
    서랍끌기.current = null
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { }
    기억.쓰기('memo.width', 너비)
  }

  async function 붙이기() {
    if (!글.trim()) return
    try {
      // 대상자 보드에서 붙이면 **그 사람 메모**가 됩니다. 기관 보드에는 안 보입니다.
      await api.addSticky({ text: 글, color: 색, recipientId: 보드 || undefined })
      글쓰기(''); 새로쓰기로(false)
      await 불러오기()
    } catch (e: any) { alert(e.message) }
  }

  /** 손을 뗐을 때 — 서버가 정한 자리로 맞춥니다. */
  const 놓아두기 = useCallback(async (id: number, 자리: 네모) => {
    // 화면부터 먼저 옮깁니다. 서버를 기다리면 종이가 손에서 늦게 따라옵니다.
    자료넣기((전: any) => 전 && ({
      ...전, items: 전.items.map((x: any) => x.id === id ? { ...x, ...자리 } : x),
    }))
    try {
      const r = await api.placeSticky(id, 자리)
      자료넣기((전: any) => 전 && ({
        ...전,
        items: 전.items.map((x: any) =>
          x.id === id ? { ...x, x: r.x, y: r.y, w: r.w, h: r.h } : x),
      }))
      if (r.비켜섬) { 알리기('겹치는 자리라 가까운 빈자리로 놓았습니다.'); setTimeout(() => 알리기(''), 2200) }
      else if (r.덜커짐) { 알리기('옆 메모에 닿아 거기까지만 커집니다.'); setTimeout(() => 알리기(''), 2200) }
    } catch (e: any) {
      alert(e.message)
      불러오기()
    }
  }, [불러오기])

  // 보드 크기 — 메모가 오른쪽·아래로 뻗으면 보드가 따라 커지고 넘치면 스크롤합니다.
  // 서랍을 좁혀도 붙여 둔 자리를 흐트러뜨리지 않으려는 것입니다.
  const 오른끝 = 붙은것.reduce((m, x) => Math.max(m, (x.x ?? 0) + x.w), 0)
  const 아래끝 = 붙은것.reduce((m, x) => Math.max(m, (x.y ?? 0) + x.h), 0)

  const 화면이름 = 자료?.boardName || 이름기억 || ''
  const 보드이름 = 보드 ? `${화면이름 || '대상자'} 메모` : '기관 메모'
  const 보관일수: number = 자료?.보관일수 ?? 30

  // 권한이 없으면 아무것도 그리지 않습니다.
  if (막힘) return null

  if (!열림) {
    /*
     * 접혀 있을 때는 그냥 **「메모장」**입니다.
     * 화면을 옮길 때마다 탭 글씨가 「강판례 메모」·「기관 메모」로 바뀌면
     * 가장자리에서 글자가 계속 흔들려 오히려 눈에 걸립니다.
     * 어느 보드인지는 펼쳤을 때 머리글이 말해 줍니다.
     */
    return (
      <button className="memo-tab" onClick={() => 열기(true)} title="메모장 펼치기">
        <span className="memo-tab-label">메모장</span>
        {붙은것.length > 0 && <span className="memo-tab-n">{붙은것.length}</span>}
      </button>
    )
  }

  return (
    <aside className="memo-drawer" style={{ width: 너비 }}>
      <div className="memo-grip"
           onPointerDown={서랍잡기} onPointerMove={서랍움직이기}
           onPointerUp={서랍놓기} onPointerCancel={서랍놓기}
           title="좌우로 끌어 너비 조절" />

      <div className="memo-head">
        <b>{보드이름}</b>
        <span className="muted small">{붙은것.length}장</span>
        <span className="spacer" />
        <button onClick={() => 새로쓰기로(!새로쓰기)} className="primary">
          {새로쓰기 ? '접기' : '새 메모'}
        </button>
        <button className="plain" onClick={() => 열기(false)} title="보드 접기">접기 ▸</button>
      </div>

      {보드 !== '' && (
        <p className="memo-where">
          {화면이름 ? <b>{화면이름}</b> : '이 대상자'} 어르신 메모입니다.
          여기 붙인 것은 이 어르신 화면에서만 보입니다.
        </p>
      )}

      {새로쓰기 && (
        <div className={`memo-note new ${색}`}>
          <textarea value={글} onChange={(e) => 글쓰기(e.target.value)} autoFocus
                    placeholder={보드
                      ? '예) 목요일 병원 — 그날 방문 빼기 / 대문 열쇠는 화분 밑'
                      : '예) 군청 박주무관 통화 — 8월 명단 다음 주에 온다고'}
                    aria-label="새 메모 내용"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { e.preventDefault(); 글쓰기(''); 새로쓰기로(false) }
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); 붙이기() }
                    }} />
          <div className="foot">
            <색고르기 value={색} onPick={색쓰기} />
            <span className="spacer" />
            <button className="primary" disabled={!글.trim()} onClick={붙이기}>붙이기</button>
          </div>
        </div>
      )}

      {알림 && <div className="memo-say">{알림}</div>}

      <div className="memo-board">
        <div className="memo-canvas"
             style={{ width: Math.max(오른끝 + 40, 규칙.최소너비 + 40),
                      height: Math.max(아래끝 + 40, 320) }}>
          {붙은것.length === 0 && (
            <p className="memo-empty">
              붙어 있는 메모가 없습니다.<br />
              <span className="small">
                「새 메모」로 붙이고, 종이처럼 끌어서 원하는 자리에 두세요.
                붙인 메모는 눌러서 바로 고칩니다.
              </span>
            </p>
          )}
          {붙은것.map((s) => (
            <메모지 key={s.id} s={s} me={me} 규칙={규칙}
                    남들={붙은것.filter((o) => o.id !== s.id)
                          .map((o) => ({ x: o.x ?? 0, y: o.y ?? 0, w: o.w, h: o.h }))}
                    onChange={불러오기} onPlace={놓아두기}
                    맨위로={맨위로} 맨위인가={맨위 === s.id} />
          ))}
        </div>
      </div>

      {뗀것.length > 0 && (
        <div className="memo-off">
          <button className="plain" onClick={() => 뗀것보이기(!뗀것보기)}>
            {뗀것보기 ? '뗀 메모 감추기 ▾' : `뗀 메모 ${뗀것.length}장 ▸`}
          </button>
          {뗀것보기 && (
            <>
              <p className="note small" style={{ margin: '4px 0 8px' }}>
                여기는 <b>휴지통</b>입니다. 뗀 메모는 <b>{보관일수}일 뒤에 저절로 없어집니다.</b>{' '}
                그전에는 언제든 다시 붙일 수 있습니다.
              </p>
              <ul className="memo-off-list">
                {뗀것.map((s) => (
                  <li key={s.id}>
                    <span className={`dot ${s.color}`} />
                    <span className="txt" title={s.text}>{s.text}</span>
                    {typeof s.남은날 === 'number' && (
                      <span className={s.남은날 <= 3 ? 'left soon' : 'left'}
                            title={`뗀 지 ${보관일수 - s.남은날}일 됐습니다`}>
                        {s.남은날 === 0 ? '오늘 없어짐' : `${s.남은날}일 남음`}
                      </span>
                    )}
                    <span className="muted small">{s.author}</span>
                    {(s.authorId === me?.id || me?.isAdmin) && (
                      <button className="plain small"
                              onClick={async () => { await api.doneSticky(s.id, false); 불러오기() }}>
                        다시 붙임
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </aside>
  )
}
