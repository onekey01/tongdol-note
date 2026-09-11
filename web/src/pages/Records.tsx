import { useEffect, useState, useCallback, useMemo, Fragment } from 'react'
import 인쇄단추 from '../components/인쇄단추'
import { api } from '../lib/api'
import 실적창 from './실적창'

/**
 * 제공실적 — 그날 갔는가, 못 갔는가.
 *
 * 빈 종이에 매번 「누가 · 언제 · 무엇을」을 적게 하면 아무도 안 씁니다.
 * 배정에 이미 「화·목」이 들어 있으니 **그 달의 화요일과 목요일을 미리 깔아 두고
 * 눌러서 확인만** 하게 합니다.
 *
 *   ○ 계획      아직 처리 안 함
 *   ● 제공      갔다
 *   ✕ 미제공    못 갔다 (사유를 받습니다)
 *
 * ── 요일은 안내, 셈은 횟수 ─────────────────────────────────
 * 지자체가 정한 것은 **횟수**입니다 — 「주 2회」. 화·목은 그것을 어디에
 * 놓을지 정한 **안내**일 뿐입니다. 수·목에 다녀왔어도 그 주는 채운 것이라
 * 그냥 「제공」입니다. (예전에는 「계획밖 ◆」으로 갈랐는데, 채웠는데도
 * 계획을 안 지킨 것처럼 읽혀서 없앴습니다.)
 *
 * 못 간 날을 남기는 이유 — 지자체가 「주 2회인데 왜 6회뿐입니까」라고 물었을 때
 * **못 간 날과 사유가 있어야 답이 됩니다.** 없으면 일을 안 한 것이 됩니다.
 *
 * ── 왜 달력인가 ────────────────────────────────────────────
 *
 * 처음에는 **한 줄에 1일부터 31일까지 가로로** 늘어놓았습니다.
 * 자리는 적게 먹지만, 「8월 13일」을 찾으려면 **칸을 세야 합니다.**
 * 달력은 13일이 어디 있는지 눈이 이미 압니다. 토·일이 어디서 끊기는지도요.
 *
 * ── 왜 대상자별인가 ────────────────────────────────────────
 *
 * 25명을 한 달력에 다 넣으면 칸마다 스물다섯 줄이 됩니다.
 * 그리고 실제로 묻는 말은 언제나 **한 사람에 대한 것**입니다 —
 * 「김○○ 님은 이 달에 몇 번 갔습니까」. 그래서 왼쪽에서 사람을 고르고,
 * 오른쪽에 그 사람의 한 달을 폅니다.
 */

const DOW = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 대상자 상태 탭 — **셋뿐입니다.**
 *
 * 처음 열면 **이용 중인 분만** 보입니다. 종결까지 섞여 나오면
 * 「지금 몇 분을 보고 있나」를 셀 수가 없습니다. 대상자 목록 화면과 같은 규칙입니다.
 *
 * 그렇다고 없애지는 않습니다 — **중단·종결된 분의 지난 실적도 고쳐야 할 때가 있습니다.**
 * 지자체가 지난 달 것을 물어 오면 그때는 종결된 분의 칸을 열어 봐야 합니다.
 *
 * ── 왜 이 셋인가 ───────────────────────────────────────────
 *
 * **말은 지침을 따릅니다.** 2026 지침에 「중지」는 없고(유일한 한 번은
 * 「집중지원」의 일부입니다) **「중단」이 서른두 번** 나옵니다. 그래서 「중단」입니다.
 *
 *   대기        **넣지 않습니다.** 제공인력이 아직 안 붙은 분이라
 *               계획도 실적도 없습니다. 빈 달력만 나옵니다.
 *               (그 명단은 홈 화면에 며칠째 기다리는지와 함께 있습니다.)
 *   직권중단    **종결에 넣습니다.** 서비스가 끝난 것은 같고,
 *               왜 끝났는지만 다릅니다 — 그래서 이름 옆에 표로만 붙입니다.
 *   취소        탭을 두지 않습니다. 서비스가 아예 안 나간 분이라
 *               정산할 것도 고칠 것도 없습니다.
 */
const 탭목록 = [
  { key: '이용', 속함: ['이용'] },
  { key: '중단', 속함: ['중단'] },
  { key: '종결', 속함: ['종결', '직권중단'] },
] as const

const MARK: Record<string, string> = {
  계획: '○', 제공: '●', 미제공: '✕',
}

/**
 * 식사지원 **비대면 배달**의 표시 (A-4).
 *
 * ● 와 ✕ 사이의 자리입니다 — **갔고 놓고 왔습니다.**
 * 반만 찬 동그라미로 둡니다. 미제공(✕)과 헷갈리면 안 됩니다:
 * 비대면은 **제공**이고 **비용이 나갑니다.**
 */
const F2F_MARK = '◎'

// 월·생애 단위는 계획된 요일이 없습니다. 아무 날이나 누를 수 있게 열어 두되,
// 화면이 ○ 로 가득 차면 무엇이 계획인지 알 수 없으므로 아주 흐린 점으로 둡니다.
const FREE_MARK = '·'

/** 이번 달을 YYYY-MM 으로. */
function thisMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shift(m: string, by: number) {
  const [y, mm] = m.split('-').map(Number)
  const d = new Date(y, mm - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 「가사지원」 → 「가사」. 칸이 좁아 이름을 다 못 답니다. 전체 이름은 title 로. */
const 짧은이름 = (s: string) => (s ?? '').slice(0, 2)

/** 「12시간」·「1시간 30분」처럼 사람이 읽는 말로. */
function 시간말(분: number): string {
  const m = Math.max(0, Math.round(분))
  const h = Math.floor(m / 60), 나머지 = m % 60
  if (h && 나머지) return `${h}시간 ${나머지}분`
  if (h) return `${h}시간`
  return `${나머지}분`
}

/**
 * ── 이 달 월 한도 (A-2 · 7-사) ────────────────────────────────
 *
 * 편람: 가사 월 12시간 · 식사 월 8회 · **동행 월 6시간과 2회** · 이미용 월 1회.
 *
 * **동행지원은 둘 다 걸립니다.** 시간이 남아도 세 번째 방문은 안 됩니다.
 * 그래서 둘 다 적고, **무엇 때문에 넘었는지**를 갈라 보여 줍니다 —
 * 「넘었습니다」만 뜨면 무엇을 줄여야 할지 모릅니다.
 *
 * 막지 않습니다. 군과 협의해 넘길 여지가 있고, 우리가 군보다 앞서
 * 판단하면 현장이 프로그램과 싸우게 됩니다.
 */
function MonthCap({ x }: { x: any }) {
  const 조각: any[] = []
  if (x.한도분 > 0) 조각.push(
    <span key="m" className={x.분넘었나 ? 'over' : ''}>
      {시간말(x.인정분합)}/{시간말(x.한도분)}
    </span>)
  if (x.한도횟수 > 0) 조각.push(
    <span key="c" className={x.횟수넘었나 ? 'over' : ''}>
      {x.쓴횟수}/{x.한도횟수}회
    </span>)
  return (
    <span className={'rec-cap' + (x.넘었나 ? ' over' : '')}
          title={x.넘었나
            ? `이 달 한도를 넘었습니다. 넘긴 몫은 지자체가 안 줍니다.${
                x.분넘었나 && x.횟수넘었나 ? ' (시간·횟수 둘 다)'
                : x.분넘었나 ? ' (시간)' : ' (횟수)'}`
            : '이 달 쓴 만큼 / 편람이 정한 월 한도'}>
      이 달 {조각.map((c, i) => <Fragment key={i}>{i > 0 && ' · '}{c}</Fragment>)}
      {x.넘었나 && ' 넘음'}
    </span>
  )
}

export default function Records() {
  const [month, setMonth] = useState(thisMonth)
  const [d, setD] = useState<any>(null)
  const [q, setQ] = useState('')
  const [dong, setDong] = useState('')
  const [worker, setWorker] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [고른이, 고르기] = useState('')
  const [상태, 상태로] = useState<string>('이용')   // 처음 열면 이용 중인 분만

  /*
   * ── 눌러 도는 대신 **열어서 봅니다** (2026-09-05 무무 지시) ──
   *
   * 칸을 누르면 창이 뜨고, 상태를 고르는 것도 그 안에서 합니다.
   * 「제공」을 보려고 눌렀다가 「미제공」이 되는 일이 없어집니다.
   *
   * ★ 이 줄은 **반드시 다른 useState 들과 나란히** 있어야 합니다.
   *   아래 `if (!d) return …` 뒤에 두었다가 자료가 오는 순간
   *   갈고리 수가 달라져 화면이 통째로 하얘졌습니다 (React #310).
   */
  const [열린칸, set열린칸] = useState<{ it: any; c: any } | null>(null)

  const load = useCallback(async () => {
    setD(await api.records(month, { q, dong, worker }))
  }, [month, q, dong, worker])

  useEffect(() => {
    const t = setTimeout(() => load().catch((e) => setMsg(e.message)), 180)
    return () => clearTimeout(t)
  }, [load])

  /*
   * 대상자 하나에 서비스가 여럿일 수 있습니다 (가사 + 식사).
   * 서버는 **배정 단위**로 주므로 여기서 사람 단위로 묶습니다.
   */
  const 모든사람 = useMemo(() => {
    const m = new Map<string, any>()
    for (const it of (d?.items ?? []) as any[]) {
      let p = m.get(it.recipientId)
      if (!p) {
        p = {
          id: it.recipientId, name: it.recipient, dong: it.dong,
          status: it.status ?? '이용', 배정: [] as any[],
        }
        m.set(it.recipientId, p)
      }
      p.배정.push(it)
    }
    return [...m.values()].map((p) => ({
      ...p,
      계획: p.배정.reduce((s: number, x: any) => s + x.계획, 0),
      제공: p.배정.reduce((s: number, x: any) => s + x.제공, 0),
      미제공: p.배정.reduce((s: number, x: any) => s + x.미제공, 0),
      // 노쇼는 미제공 **안에 든 채로** 따로 셉니다 (A-3). 빼서 세면 합이 안 맞습니다.
      노쇼: p.배정.reduce((s: number, x: any) => s + (x.노쇼 ?? 0), 0),
      // 비대면 배달은 **제공 안에 든 채로** 따로 셉니다 (A-4).
      비대면: p.배정.reduce((s: number, x: any) => s + (x.비대면 ?? 0), 0),
      남음: p.배정.reduce((s: number, x: any) => s + x.남음, 0),
    }))
  }, [d])

  /*
   * 탭에 몇 명인지 미리 세어 둡니다.
   * 셋은 **비어 있어도 늘 내놓습니다** — 「중단 0」이 보이는 것과
   * 탭이 아예 없는 것은 다릅니다. 앞은 「없구나」이고, 뒤는 「어디 갔지」입니다.
   */
  const 탭셈 = useMemo(() => {
    const c: Record<string, number> = {}
    for (const t of 탭목록)
      c[t.key] = 모든사람.filter((p) => (t.속함 as readonly string[]).includes(p.status)).length
    return c
  }, [모든사람])

  const 사람들 = useMemo(() => {
    const 탭 = 탭목록.find((t) => t.key === 상태) ?? 탭목록[0]
    return 모든사람.filter((p) => (탭.속함 as readonly string[]).includes(p.status))
  }, [모든사람, 상태])

  /*
   * 어느 탭에도 안 들어가는 분 — 지금은 「취소」뿐입니다.
   * **말없이 사라지면 안 됩니다.** 취소인데 실적이 있다면 그건
   * 자료가 어긋난 것이라 사람이 봐야 합니다.
   */
  const 빠진사람 = useMemo(() => {
    const 속한것 = new Set(탭목록.flatMap((t) => t.속함 as readonly string[]))
    return 모든사람.filter((p) => !속한것.has(p.status))
  }, [모든사람])

  // 거르고 나면 고른 사람이 목록에서 사라질 수 있습니다. 그러면 맨 위로.
  const 지금사람 = 사람들.find((p) => p.id === 고른이) ?? 사람들[0] ?? null

  /** 그 사람의 그날 — 배정마다 칸이 있는지 찾아 둡니다. */
  const 그날칸 = useMemo(() => {
    const m = new Map<string, { it: any; c: any }[]>()
    for (const it of (지금사람?.배정 ?? []) as any[]) {
      for (const c of it.cells) {
        const arr = m.get(c.on) ?? []
        arr.push({ it, c })
        m.set(c.on, arr)
      }
    }
    return m
  }, [지금사람])

  /**
   * 달력 칸 깔기 — 1일이 무슨 요일인지에 맞춰 앞을 비우고,
   * 마지막 주도 일곱 칸을 채웁니다. 안 채우면 줄이 깨져 보입니다.
   */
  const 주들 = useMemo(() => {
    const days: any[] = d?.days ?? []
    if (days.length === 0) return []
    const 칸: (any | null)[] = []
    for (let i = 0; i < days[0].dow; i++) 칸.push(null)
    칸.push(...days)
    while (칸.length % 7 !== 0) 칸.push(null)
    const out: (any | null)[][] = []
    for (let i = 0; i < 칸.length; i += 7) out.push(칸.slice(i, i + 7))
    return out
  }, [d])

  if (!d) return <p className="muted">불러오는 중…</p>

  /*
   * 창이 떠 있는 동안 자료가 새로 오면, 창 안의 값도 따라가야 합니다.
   * 안 그러면 상태를 고쳐도 창에는 옛것이 그대로 보입니다.
   */
  const 열린것 = 열린칸 && (() => {
    for (const { it, c } of (그날칸.get(열린칸.c.on) ?? []))
      if (it.assignId === 열린칸.it.assignId)
        return { it: { ...it, today: d?.today }, c }
    return { it: { ...열린칸.it, today: d?.today }, c: 열린칸.c }
  })()

  /**
   * 한 칸의 상태를 바꿉니다.
   *
   * `고른상태` 를 주면 그것으로 곧장 갑니다 — 창에서 고른 경우입니다.
   * 안 주면 예전처럼 **돌아가며** 바뀝니다. 돌리는 길은 지금 아무도
   * 안 쓰지만, 창을 못 띄우는 상황이 생기면 되돌아올 자리로 남겨 둡니다.
   */
  /**
   * @param 고른사유 창에서 **이미 고른** 못 간 사유. 있으면 다시 안 묻습니다.
   *                 (2026-09-09 — 예전에는 브라우저 prompt 에 **타이핑**해야
   *                  했습니다. 사유는 정해진 목록인데 손으로 치게 두면
   *                  「부제」·「병원」 같은 제각각인 말이 기록지에 실려
   *                  지자체로 나갑니다.)
   */
  async function tap(it: any, c: any, 고른상태?: string, 고른대면?: boolean,
                     고른사유?: string) {
    if (c.on > d.today) return setMsg('아직 오지 않은 날입니다.')

    /*
     * ── 식사지원은 자리가 하나 더 있습니다 (A-4, 2026-09-01 고침) ──
     *
     *   식사지원    ○ 계획 → ● 대면 → ◎ 비대면 → ✕ 미제공 → ○ 계획
     *   그 밖       ○ 계획 → ● 제공 →           ✕ 미제공 → ○ 계획
     *
     * **비대면은 제공입니다.** 놓고 왔어도 음식은 이미 만들어져 나갔으니
     * 비용이 나갑니다. 처음에는 이걸 칸 밑의 작은 단추로 두었는데,
     * 눌러 도는 차례에 없으니 **아무도 거기까지 안 갔습니다** —
     * 실제로 「제공」을 지나쳐 「미제공」으로 찍혔습니다.
     * 현장에서 하는 일이 「문 앞에 두고 왔다」 한 가지이면
     * **누르는 것도 한 번**이어야 합니다.
     */
    const 비대면인가 = c.state === '제공' && c.대면 === false
    const next = 고른상태 ?? (c.state === '계획' ? '제공'
      : c.state === '제공' ? (it.대면원칙 && !비대면인가 ? '제공' : '미제공')
      : '계획')
    // 식사지원에서 ● → ◎ 로 넘어가는 자리
    const 다음대면 = 고른상태
      ? (it.대면원칙 && next === '제공' ? (고른대면 ?? true) : undefined)
      : it.대면원칙 && next === '제공'
        ? (c.state === '계획' ? true : false)
        : undefined

    // 이미 그 상태이고 대면 여부도 같으면 할 일이 없습니다.
    if (고른상태 && next === c.state
        && (다음대면 === undefined || 다음대면 === (c.대면 !== false))) return

    /*
     * ── 현장에서 올라온 건을 되돌릴 때는 반드시 묻습니다 ──────
     *
     * 제공인력이 다녀와 적고 **서명까지 받아 올린** 건입니다.
     * 「계획」으로 되돌리면 그 기록이 사무실에서 지워질 뿐 아니라,
     * **제공인력 휴대폰의 기록도 처음으로 되돌아갑니다** — 시작·끝·
     * 서명·사진·적어 둔 것이 다 사라지고 그 집을 다시 가야 합니다.
     *
     * 되돌릴 일이 아예 없지는 않습니다(엉뚱한 날에 찍힌 것 등).
     * 막지는 않되, **모르고 누르는 일은 없어야** 합니다.
     * (2026-09-05 무무 지시)
     */
    if (next === '계획' && c.현장) {
      /*
       * 문구는 **무무가 준 그대로**입니다 (2026-09-05).
       * 위의 한 줄은 문구가 아니라 **무엇을 지우는지 가리키는 것**입니다 —
       * 달력에 칸이 여럿이라, 어느 칸을 눌렀는지 없이 「삭제하시겠습니까」만
       * 뜨면 엉뚱한 날을 지우게 됩니다.
       */
      if (!confirm(
        `${it.recipient} 님 · ${it.service} · ${c.on} (${DOW[c.dow]})\n\n` +
        `제공한 내역이 모두 삭제되고 이후엔 되돌릴 수 없습니다.\n` +
        `정말로 삭제 하시겠습니까?`
      )) return
    }

    let reason = ''
    let 갈래: string | undefined
    let 알린날: string | undefined
    if (next === '미제공') {
      if (고른사유) {
        reason = String(고른사유).trim()
      } else {
        /*
         * 창에서 안 고르고 들어온 길 — 남겨 둡니다. 창을 안 거치는
         * 자리가 나중에 생겨도 사유 없이 「미제공」이 들어가면 안 됩니다.
         */
        const picked = prompt(
          `${it.recipient} 님 · ${it.service}\n${c.on} (${DOW[c.dow]})\n\n` +
          `못 간 사유를 적어 주세요.\n${d.reasons.join(' · ')}`,
          '부재'
        )
        if (picked === null) return
        reason = picked.trim()
      }
      if (!reason) return

      /*
       * 갈래는 **노쇼를 쓰는 서비스에서만** 묻습니다 (2026-09-01).
       * 해남 현장은 안 씁니다 — 가사·동행·이미용은 이용자 사정이면
       * **일정을 사전 조율**해 다시 잡고, 식사는 「대면/비대면」이 그 자리입니다.
       * 없는 개념을 물으면 현장은 전부 「기타」를 고르게 되고, 그건 묻지
       * 않느니만 못합니다.
       */
      if (it.노쇼쓰나) {
        const 고름 = await 갈래묻기(it, c, d.사유별갈래?.[reason] ?? '기타')
        if (!고름) return
        갈래 = 고름.갈래
        알린날 = 고름.알린날
      }
    }

    setBusy(true); setMsg('')
    try {
      const r = await api.setRecordCell({
        assignId: it.assignId, on: c.on, state: next, reason,
        missKind: 갈래, notifiedOn: 알린날,
        ...(다음대면 === undefined ? {} : { faceToFace: 다음대면 }),
      })
      알림(r)
      await load()
    } catch (e: any) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  /**
   * ── 못 간 날의 **갈래** (A-3 · 7-아) ───────────────────────
   *
   * 계약서(서식2) 4조 —
   *   「이용자가 **사전 취소 없이** … 이용하지 않으셨더라도 비용이
   *    지출되며, 1인당 연간 지원한도액에서 차감됩니다.」
   *
   * 같은 「미제공」이라도 **돈과 한도가 정반대**입니다. 그래서 사유와
   * 따로 한 번 더 묻습니다. 사유를 고르면 갈래를 **미리 골라 두므로**
   * 대개는 그대로 확인만 하면 됩니다.
   */
  async function 갈래묻기(it: any, c: any, 처음: string) {
    // 노쇼를 안 쓰는 서비스에서는 **고르개에도 안 보입니다.**
    const 갈래들 = (d.갈래들 ?? []).filter((g: string) => it.노쇼쓰나 || g !== '노쇼')
    const 설명 = 갈래들.map((g: string) => `  ${g} — ${d.갈래설명?.[g] ?? ''}`)
    const g = prompt(
      `${it.recipient} 님 · ${it.service}\n${c.on} (${DOW[c.dow]})\n\n` +
      `못 간 갈래를 골라 주세요.\n\n${설명.join('\n')}\n`,
      처음
    )
    if (g === null) return null
    const 갈래 = g.trim()
    if (!갈래들.includes(갈래)) {
      setMsg(`갈래는 ${갈래들.join(' · ')} 중에서 골라 주세요.`)
      return null
    }
    if (갈래 !== '사전취소') return { 갈래, 알린날: undefined }

    /*
     * 알린 날. 미리 채워 두는 값은 **예정일 하루 전**이지만,
     * 늦었는지 아닌지는 **서버가 판단합니다** — 계약서의 선은 한 곳에서만
     * 잽니다. 여기 숫자는 손을 덜자고 채워 두는 것일 뿐입니다.
     */
    const 하루전 = new Date(c.on + 'T00:00:00Z')
    하루전.setUTCDate(하루전.getUTCDate() - 1)
    const n = prompt(
      `이용자께서 **언제** 알려 오셨습니까?\n\n` +
      `계약서 4조는 「예정일 하루 전까지」입니다.\n` +
      `그보다 늦으면 노쇼가 되어 비용이 나갑니다 (막지는 않고 알려만 드립니다).`,
      c.notifiedOn || 하루전.toISOString().slice(0, 10)
    )
    if (n === null) return null
    return { 갈래, 알린날: n.trim() }
  }

  /** 갈래만 고칩니다. 상태를 세 번 돌리지 않고 바로 바꿀 수 있게. */
  async function 갈래고치기(it: any, c: any) {
    if (c.on > d.today) return
    const 고름 = await 갈래묻기(it, c, c.missKind || '기타')
    if (!고름) return
    setBusy(true); setMsg('')
    try {
      const r = await api.setRecordCell({
        assignId: it.assignId, on: c.on, state: '미제공', reason: c.reason || '기타',
        missKind: 고름.갈래, notifiedOn: 고름.알린날,
      })
      알림(r)
      await load()
    } catch (e: any) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  /** 저장한 뒤에 알려 줄 말. **막지 않고 알려만 줍니다.** */
  function 알림(r: any) {
    /*
     * ── 한도에 닿으면 **경고창** (2026-09-01) ──────────────────
     *
     * 위쪽 안내줄(setMsg)로는 부족합니다 — **어르신 서비스가 통째로 끊기는**
     * 일이라 화면 어딘가에 적혀 있는 것으로는 안 됩니다. 멈춰 세웁니다.
     *
     * **그래도 상태는 저희가 안 바꿉니다.** 중지는 지자체와 협의할 일이고,
     * 기계가 앞서 정하면 현장이 프로그램과 싸우게 됩니다.
     * 「중단」은 사람이 대상자 화면에서 누릅니다.
     */
    const f = r?.비대면
    if (f?.닿음) {
      alert(
        `비대면 수령 횟수가 ${f.연속}회 되었습니다. 서비스 중지가 필요합니다.\n\n` +
        `계약서 5-2조 — 「${f.한계}회 연속 대면 수령하지 않은 경우 식사지원을 포함한 ` +
        `통합돌봄 서비스가 중지됩니다.」\n\n` +
        `프로그램이 상태를 바꾸지는 않았습니다. 지자체와 협의하신 뒤 ` +
        `대상자 화면 「상태 바꾸기」에서 처리해 주세요.`
      )
    }
    if (r?.faceToFace === false)
      setMsg(
        '비대면 배달로 적었습니다. 음식이 이미 만들어졌으므로 비용은 그대로 나갑니다. ' +
        '3회 연속이면 통합돌봄 서비스 전체가 중지됩니다 (계약서 5-2조).'
      )
    else if (r?.늦음)
      setMsg(
        '사전취소로 적었지만 알려 오신 날이 예정일 하루 전보다 늦습니다. ' +
        '계약서 4조대로면 노쇼라 비용이 나갑니다 — 그대로 두실지 군과 확인해 주세요.'
      )
    else if (r?.missKind === '노쇼')
      setMsg('노쇼로 적었습니다. 비용이 나가고 연간 지원한도에서 깎입니다 (계약서 4조).')
    else setMsg('')
  }

  /**
   * ── 몇 분 있었나 (30분 환산 · A-1) ─────────────────────────
   *
   * 편람: 15분 미만 미산정 · 15~45분 30분 · 45분 이상 1시간.
   * **시간제(가사·동행)에만** 묻습니다 — 식사는 끼, 이미용은 회입니다.
   *
   * 안 적으면 **예전처럼 한 번 = 한 시간**입니다. 그래서 강제로 묻지 않고
   * 칸 밑에 작은 단추로 둡니다. 나중에 현장앱이 이 값을 자동으로 채웁니다.
   */
  async function 분적기(it: any, c: any) {
    if (c.on > d.today) return
    const 지금 = c.minutes == null ? '' : String(c.minutes)
    const picked = prompt(
      `${it.recipient} 님 · ${it.service}\n${c.on} (${DOW[c.dow]})\n\n` +
      `실제로 몇 분 있었는지 적어 주세요.\n` +
      `15분 미만은 인정되지 않고, 15~45분은 30분, 45분 이상은 1시간입니다.\n` +
      `비워 두면 지금까지처럼 한 번을 한 시간으로 셉니다.`,
      지금
    )
    if (picked === null) return
    const 값 = picked.trim() === '' ? null : Number(picked.trim())
    if (값 !== null && (!Number.isFinite(값) || 값 < 0))
      return setMsg('분은 0 이상의 숫자로 적어 주세요.')

    setBusy(true); setMsg('')
    try {
      await api.setRecordCell({
        assignId: it.assignId, on: c.on, state: '제공', reason: '', minutes: 값,
      })
      await load()
    } catch (e: any) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  /*
   * 지금 **보이는 사람들만** 채웁니다.
   * 「이용」 탭을 보고 있는데 종결된 분의 칸까지 조용히 채워지면
   * 자기가 무엇을 눌렀는지 모르게 됩니다. 보이는 것이 바뀌는 것입니다.
   */
  async function fill() {
    const 대상 = 사람들.flatMap((p: any) => p.배정.map((x: any) => x.assignId))
    if (!confirm(
      `${month} 의 지난 계획 중 **아직 손대지 않은 칸**을 모두 「제공」으로 채웁니다.\n\n` +
      `· 지금 보고 있는 「${상태}」 ${사람들.length}명만 채웁니다\n` +
      `· 미제공으로 적어 둔 것은 건드리지 않습니다\n` +
      `· 오늘 이후 날짜는 채우지 않습니다\n\n` +
      `계획대로 다 다녀온 달에 쓰세요. 그 뒤에 못 간 날만 눌러 고치면 됩니다.\n\n계속할까요?`
    )) return
    setBusy(true)
    try {
      const r = await api.fillRecords(month, 대상)
      setMsg(`${r.filled}칸을 「제공」으로 채웠습니다. 못 간 날은 눌러서 고쳐 주세요.`)
      await load()
    } catch (e: any) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  /*
   * 숫자는 **지금 보이는 사람들의 것**입니다.
   * 서버가 준 그 달 전체 합계를 그대로 쓰면, 탭으로 「이용」만 보고 있는데
   * 위 숫자에는 종결된 분까지 섞여 들어가 **목록과 숫자가 서로 다른 말**을 합니다.
   */
  const t = {
    계획: 사람들.reduce((s, p) => s + p.계획, 0),
    제공: 사람들.reduce((s, p) => s + p.제공, 0),
    미제공: 사람들.reduce((s, p) => s + p.미제공, 0),
    노쇼: 사람들.reduce((s, p) => s + (p.노쇼 ?? 0), 0),
    비대면: 사람들.reduce((s, p) => s + (p.비대면 ?? 0), 0),
    남음: 사람들.reduce((s, p) => s + p.남음, 0),
  }
  /*
   * ★ 100% 를 넘겨 적지 않습니다 (2026-09-07). 「월 2회」처럼 요일이 없는
   *   서비스는 네 번 갈 수 있어 그대로 두면 200% 가 뜹니다. 비율은 끊고
   *   넘친 것은 **건수로** 아래에 적습니다 — 통계 화면과 같은 규칙입니다.
   */
  const 처리한것 = t.제공 + t.미제공
  const 진행률 = t.계획 > 0 ? Math.min(100, Math.round((처리한것 / t.계획) * 100)) : 0
  const 초과건 = t.계획 > 0 ? Math.max(0, 처리한것 - t.계획) : 0
  const 여러서비스 = (지금사람?.배정.length ?? 0) > 1

  return (
    <>
      <인쇄단추 무엇="제공실적 (계획 대비)" 수={(d?.items ?? []).length}
                덧말={`${month.split('-')[0]}년 ${Number(month.split('-')[1])}월분`}
                조건={[
                  상태 ? `상태 ${상태}` : '상태 전체',
                  dong && `행정동 ${dong}`,
                  worker && '담당 고름',
                  q && `찾기 「${q}」`,
                ]} />

      <div className="main-head">
        <h1>제공실적</h1>
        <div className="btns" style={{ marginLeft: 12 }}>
          <button onClick={() => setMonth(shift(month, -1))}>◀</button>
          <b style={{ minWidth: 96, textAlign: 'center' }}>
            {month.split('-')[0]}년 {Number(month.split('-')[1])}월
          </b>
          <button onClick={() => setMonth(shift(month, 1))}>▶</button>
          {month !== thisMonth() && (
            <button className="plain" onClick={() => setMonth(thisMonth())}>이번 달</button>
          )}
        </div>
        <div className="spacer" />
        <div className="btns">
          <button disabled={busy || t.남음 === 0} onClick={fill}>
            지난 계획 한꺼번에 제공 처리
          </button>
        </div>
      </div>

      {msg && <div className="msg ok">{msg}</div>}

      <div className="row tight" style={{ alignItems: 'stretch' }}>
        {/*
          「노쇼」는 미제공 **안에 든 숫자**입니다 (빼서 세지 않습니다).
          그런데 **이것만 돈이 나가므로** 따로 한 칸을 줍니다 — 계약서 4조.
        */}
        {/*
          ── 왜 칸을 더 만들지 않는가 (2026-09-01 고침) ──────────
          **비대면 배달은 제공입니다.** 노쇼는 미제공입니다.
          둘 다 **이미 위 숫자에 들어 있는** 것이라 옆에 칸을 하나 더 세우면
          더했을 때 합이 안 맞습니다. 그래서 **그 칸 밑에 「그중 …」**으로 답니다.
        */}
        {[
          ['계획', t.계획, null],
          ['제공', t.제공, t.비대면 > 0
            ? { 말: `그중 비대면 ${t.비대면}`,
                풀이: '대면으로 건네 드리지 못한 배달입니다. 비용은 그대로 나가고, 3회 연속이면 통합돌봄 전체가 중지됩니다 (계약서 5-2조).' }
            : null],
          ['미제공', t.미제공, t.노쇼 > 0
            ? { 말: `그중 노쇼 ${t.노쇼}`,
                풀이: '사전 취소가 없었던 날입니다. 비용이 나가고 연간 지원한도에서 깎입니다 (계약서 4조).' }
            : null],
          ['아직', t.남음, null],
          ['처리', `${진행률}%`, 초과건
            ? { 말: `계획보다 ${초과건}건 더`,
                풀이: '계획한 횟수보다 더 다녀왔습니다. 「월 2회」처럼 요일이 없는 서비스에서 잘 생깁니다 — 월 한도를 넘겼는지 아래 달력 줄에서 확인해 주세요.' }
            : null],
        ].map(([label, v, 곁]: any) => (
          <div key={String(label)}
               className={'card' + (곁 ? ' 노쇼칸' : '')}
               style={{ margin: 0, textAlign: 'center', padding: '12px 10px' }}>
            <div className="muted small">{label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{v}</div>
            {곁 && <div className="rec-noshow small" title={곁.풀이}>{곁.말}</div>}
          </div>
        ))}
      </div>

      <div className="card 거르개" style={{ paddingBottom: 14 }}>
        <div className="row tight" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 2, marginBottom: 0 }}>
            <label htmlFor="r-q">찾기</label>
            <input id="r-q" value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="대상자 · 서비스 · 담당" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="r-dong">읍면동</label>
            <select id="r-dong" value={dong} onChange={(e) => setDong(e.target.value)}>
              <option value="">전체</option>
              {d.dongs.map((x: string) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="r-worker">담당</label>
            <select id="r-worker" value={worker} onChange={(e) => setWorker(e.target.value)}>
              <option value="">전체</option>
              {d.workers.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {모든사람.length === 0 ? (
        <div className="card">
          <div className="empty">
            이 달에 배정된 것이 없습니다.<br />
            <span className="small">
              「배정·주간계획」에서 담당과 요일을 먼저 정하면 여기에 칸이 깔립니다.
            </span>
          </div>
        </div>
      ) : (
        <div className="rec-split">
          {/* ── 왼쪽: 누구를 볼 것인가 ─────────────────────────
              「제공 / 계획」을 여기에 함께 둡니다. 사람을 하나씩 열어 보지 않아도
              **아직 안 채운 사람**이 목록에서 바로 보여야 합니다. */}
          <div className="card rec-who" style={{ padding: 0 }}>
            {/* 상태 탭 — 처음 열면 「이용」. 셋은 비어 있어도 늘 있습니다. */}
            <div className="rec-tabs">
              {탭목록.map((t) => (
                <button key={t.key} type="button"
                        className={'rec-tab' + (상태 === t.key ? ' on' : '')}
                        onClick={() => 상태로(t.key)}>
                  {t.key}
                  <span className="rec-tab-n">{탭셈[t.key] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="rec-who-head small muted">
              {사람들.length > 0
                ? `${상태} ${사람들.length}명`
                : `「${상태}」인 분은 이 달에 없습니다`}
              {/* 취소는 탭을 두지 않습니다. 다만 말없이 없애지도 않습니다. */}
              {빠진사람.length > 0 && (
                <div>취소 {빠진사람.length}명은 목록에 없습니다</div>
              )}
            </div>
            <div className="rec-who-list">
              {사람들.map((p) => (
                <button key={p.id} type="button"
                        className={'rec-who-item' + (지금사람?.id === p.id ? ' on' : '')}
                        onClick={() => 고르기(p.id)}>
                  <div className="rec-who-name">
                    <span className="name">{p.name}</span>
                    {/*
                      직권중단은 종결 탭에 함께 있습니다 — 서비스가 끝난 것은 같으니까요.
                      다만 **왜 끝났는지가 다르므로** 이름 옆에 표로 갈라 둡니다.
                    */}
                    {p.status === '직권중단' && (
                      <span className="tag 직권중단">직권중단</span>
                    )}
                    {p.남음 > 0 && <span className="rec-left">{p.남음}</span>}
                  </div>
                  <div className="muted small">
                    {p.dong && `${p.dong} · `}
                    {p.배정.map((x: any) => x.service).join(' · ')}
                  </div>
                  <div className="muted small">
                    제공 <b>{p.제공}</b>/{p.계획}
                    {p.미제공 > 0 && <> · 미제공 {p.미제공}</>}
                    {p.노쇼 > 0 && <span className="rec-noshow"> · 노쇼 {p.노쇼}</span>}
                    {p.비대면 > 0 && (
                      <span className="rec-noshow"> · 비대면 {p.비대면}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── 오른쪽: 그 사람의 한 달 ──────────────────────── */}
          <div className="card" style={{ marginTop: 0 }}>
            {!지금사람 ? (
              <div className="empty">
                이 달에 <b>「{상태}」</b>인 분은 없습니다.<br />
                <span className="small">위 탭에서 다른 상태를 골라 보세요.</span>
              </div>
            ) : (
              <>
                <div className="rec-cal-head">
                  <h2 style={{ margin: 0 }}>{지금사람.name}</h2>
                  {/* 중단·종결된 분의 칸을 열었다는 것을 모르면 안 됩니다. */}
                  {지금사람.status !== '이용' && (
                    <span className={`tag ${지금사람.status}`}>{지금사람.status}</span>
                  )}
                  <span className="muted small">
                    {지금사람.dong} · {month.split('-')[0]}년 {Number(month.split('-')[1])}월
                  </span>
                </div>

                {/* 서비스가 여럿이면 어느 칩이 무엇인지 여기서 알려 줍니다. */}
                <div className="rec-svc">
                  {지금사람.배정.map((it: any) => (
                    <div key={it.assignId} className="rec-svc-item">
                      {여러서비스 && <b className="rec-svc-tag">{짧은이름(it.service)}</b>}
                      <b>{it.service}</b>
                      <span className="muted">
                        {it.planText}
                        {it.worker && ` · ${it.worker}`}
                      </span>
                      <span className="rec-svc-num">
                        제공 <b>{it.제공}</b>/{it.계획}
                        {it.미제공 > 0 && <span className="muted"> · 미제공 {it.미제공}</span>}
                        {it.비대면 > 0 && (
                          <span className="rec-noshow" title="대면으로 건네 드리지 못한 배달 — 비용은 그대로 나가고, 3회 연속이면 통합돌봄 전체가 중지됩니다 (계약서 5-2조)">
                            {' '}· 비대면 {it.비대면}
                          </span>
                        )}
                        {it.노쇼 > 0 && (
                          <span className="rec-noshow" title="사전 취소 없이 이용하지 않으신 날 — 비용이 나가고 연간 한도에서 깎입니다 (계약서 4조)">
                            {' '}· 노쇼 {it.노쇼}
                          </span>
                        )}
                      </span>
                      {/*
                        ── 이 달 월 한도 (A-2) ─────────────────────────
                        편람: 가사 월 12시간 · 식사 월 8회 · 동행 월 6시간과 2회 ·
                        이미용 월 1회. **막지 않고 보여만 줍니다.**
                        동행지원은 시간과 횟수 **둘 다** 걸리므로 둘 다 적습니다.
                      */}
                      {it.월한도?.봄 && <MonthCap x={it.월한도} />}

                      {/*
                        ── 제공기록지 받기 (서식3·4·5) ─────────────────
                        제공인력이 집에 돌아와 **기억으로** 적던 종이입니다.
                        현장앱이 찍은 것과 사무실이 적은 것이 다 모여 있으니
                        여기서 그대로 뽑습니다. 서비스 갈래에 따라 서식이
                        갈리고, 넘치면 장이 나뉘어 zip 으로 묶입니다.
                      */}
                      {it.서식 && it.제공 > 0 && (
                        <a className="plain 작은단추 rec-sheet"
                           href={`/api/records/${it.assignId}/sheet?month=${month}`}
                           title={`${it.서식} — 진행시간·해 드린 것·특이사항이 채워진 채로 나옵니다`}>
                          {it.서식} 받기
                        </a>
                      )}
                    </div>
                  ))}
                </div>

                <div className="cal">
                  {DOW.map((n, i) => (
                    <div key={n}
                         className={'cal-dow' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '')}>
                      {n}
                    </div>
                  ))}
                  {주들.map((week, wi) => week.map((x, di) => {
                    if (!x) return <div key={`${wi}-${di}`} className="cal-day out" />
                    const 오늘 = x.on === d.today
                    const 앞날 = x.on > d.today
                    const 칸들 = 그날칸.get(x.on) ?? []
                    return (
                      <div key={x.on}
                           className={'cal-day'
                             + (x.holiday ? ' holiday' : '')
                             + (오늘 ? ' today' : '')
                             + (앞날 ? ' future' : '')}
                           data-on={x.on}>
                        <div className="cal-num">
                          <span className={di === 0 ? 'sun' : di === 6 ? 'sat' : ''}>{x.day}</span>
                          {x.holidayName && (
                            <span className="cal-hname" title={x.holidayName}>{x.holidayName}</span>
                          )}
                        </div>
                        {칸들.map(({ it, c }) => (
                          <button key={it.assignId}
                                  className={`cal-chip ${c.state}`
                                    + (c.free && c.state === '계획' ? ' free' : '')
                                    + (c.state === '제공' && c.대면 === false ? ' 비대면' : '')}
                                  disabled={busy || 앞날}
                                  title={`${it.service} · ${c.on} `
                                    + (c.state === '제공' && c.대면 === false
                                        ? '비대면 배달 (제공 — 비용이 나갑니다. 3회 연속이면 서비스 중지)'
                                        : c.state === '제공' && it.대면원칙 ? '대면 배달' : c.state)
                                    + (c.reason ? ` — ${c.reason}` : '')
                                    + (c.missKind ? ` (${c.missKind})` : '')}
                                  onClick={() => set열린칸({ it, c })}>
                            {여러서비스 && <span className="chip-svc">{짧은이름(it.service)}</span>}
                            <span className="chip-mark">
                              {c.free && c.state === '계획' ? FREE_MARK
                                : c.state === '제공' && c.대면 === false ? F2F_MARK
                                : MARK[c.state]}
                            </span>
                            {/* 비대면은 **칸 안에서** 읽혀야 합니다 — 기호만으론 모릅니다 */}
                            {c.state === '제공' && c.대면 === false && (
                              <span className="chip-why f2f">비대면</span>
                            )}
                            {c.reason && <span className="chip-why">{c.reason}</span>}
                          </button>
                        ))}
                        {/*
                          시간제 서비스의 「제공」 칸에만 분을 묻습니다.
                          적으면 편람 규칙으로 몇 분 인정되는지 그 자리에 보입니다.
                        */}
                        {칸들.filter(({ it, c }) => it.unit === 'hour' && c.state === '제공')
                          .map(({ it, c }) => (
                            <button key={`m${it.assignId}`}
                                    className={'chip-min'
                                      + (c.minutes == null ? ''
                                         : c.인정 === 0 ? ' 미산정' : ' 적음')}
                                    disabled={busy || 앞날}
                                    title={c.minutes == null
                                      ? '몇 분 있었는지 적으면 편람대로 셈합니다. 안 적으면 한 시간으로 봅니다.'
                                      : `실제 ${c.minutes}분 → ${c.인정}분 인정`}
                                    onClick={() => 분적기(it, c)}>
                              {c.minutes == null
                                ? '분 적기'
                                : c.인정 === 0
                                ? `${c.minutes}분 · 인정 안 됨`
                                : `${c.minutes}분 → ${c.인정}분`}
                            </button>
                          ))}
                        {/*
                          ── 못 간 날의 갈래 (A-3 · 7-아) ───────────────
                          **노쇼만 돈이 나가고 한도에서 깎입니다**(계약서 4조).
                          같은 ✕ 라도 정반대라서, 무엇으로 적었는지 칸에
                          그대로 보이게 하고 눌러서 고칠 수 있게 둡니다.
                        */}
                        {칸들.filter(({ it, c }) => c.state === '미제공'
                          && (it.노쇼쓰나 || (c.missKind && c.missKind !== '기타')))
                          .map(({ it, c }) => (
                          <button key={`k${it.assignId}`}
                                  className={'chip-kind'
                                    + (c.missKind === '노쇼' ? ' 노쇼' : '')
                                    + (c.늦음 ? ' 늦음' : '')}
                                  disabled={busy || 앞날}
                                  title={c.missKind === '노쇼'
                                    ? '사전 취소 없이 이용하지 않으심 — 비용이 나가고 연간 한도에서 깎입니다 (계약서 4조)'
                                    : c.늦음
                                    ? `사전취소로 적혀 있지만 알려 오신 날(${c.notifiedOn || '없음'})이 하루 전보다 늦습니다`
                                    : '비용도 한도도 안 갑니다. 눌러서 고칠 수 있습니다.'}
                                  onClick={() => 갈래고치기(it, c)}>
                            {c.missKind === '노쇼' ? '노쇼 · 비용 발생'
                              : c.늦음 ? `${c.missKind} · 늦음`
                              : c.missKind || '기타'}
                          </button>
                        ))}
                      </div>
                    )
                  }))}
                </div>

                {/*
                  * ── 안내문 (2026-09-05 무무 지시로 손봤습니다) ─────────
                  *
                  * 「제공계획의 달력 아래에도 지금 적용된 내용과 다른 부분은
                  *  수정 및 삭제 해줘야 해.」
                  *
                  * 화면이 바뀌었는데 안내문이 안 따라와 **틀린 말**이 되어
                  * 있었습니다. 안내문이 틀리면 없느니만 못합니다 — 화면을
                  * 안 믿게 되고, 그다음부터는 안 읽습니다.
                  *
                  *   ① 「칸을 누르면 ○ → ● → ✕ 로 돌아갑니다」
                  *      → 지금은 **창이 뜹니다**. 눌러 도는 방식은 8월에
                  *        없앴습니다(「보려고 눌렀다가 바뀌는」 일 때문에).
                  *   ② 「식사지원만 자리가 하나 더 ○ → ● 대면 → ◎ 비대면 → ✕」
                  *      → 같은 까닭으로 틀렸습니다. 창 안에서 고릅니다.
                  *   ③ 「휴일 방문은 할증이 붙으므로」
                  *      → 이 기관은 **할증을 안 씁니다**(설정 · 계산 규칙).
                  *        무조건 붙는 것처럼 적으면 안 됩니다.
                  *
                  * 나머지는 길이를 줄였습니다. 열한 줄짜리 안내가 표를
                  * 아래로 밀어내고 있었습니다.
                  */}
                <p className="note small" style={{ marginBottom: 0, marginTop: 14 }}>
                  <b>칸을 누르면 창이 뜹니다.</b> 상태(계획 · 제공 · 미제공)를 고르는 것도,
                  현장에서 올라온 것을 보는 것도 그 안에서 합니다 —
                  보려고 눌렀다가 값이 바뀌는 일은 없습니다.
                  식사지원은 <b>대면 · 비대면</b>이 한 자리 더 있습니다.
                  시간제 서비스는 칸 아래 <b>「분 적기」</b>로 실제 있었던 시간을 적습니다 —
                  안 적으면 <b>한 번을 한 시간</b>으로 셉니다.<br />
                  <b>비대면은 미제공이 아니라 「제공」입니다.</b>{' '}
                  문 앞에 두고 오셨어도 음식은 이미 만들어져 나갔으므로 <b>비용이
                  그대로 나갑니다.</b> 편람이 <b>「단순 식사배달이 아닌 돌봄서비스이므로
                  대면 배달 원칙을 준수」</b>하라고 했고, 계약서 5-2조는 <b>3회 연속이면
                  통합돌봄 서비스 전체가 중지</b>된다고 정해 두었습니다 —
                  그 셈은 <b>대상자 화면</b>에 「연속 비대면 N/3」으로 뜹니다.
                  <b>비대면은 이용자 확인서명을 받지 않습니다</b> — 어르신을 뵙지 못한
                  것이라 받을 길이 없습니다. 현장앱도 그 건은 서명을 안 묻고 바로 보냅니다.<br />
                  <b>가사·동행·이미용은 이용자 사정이면 일정을 사전 조율해</b> 다시
                  잡으시면 됩니다 — 그래서 미제공에 갈래를 따로 묻지 않습니다.
                  (계약서 4조의 <b>노쇼</b>를 비용으로 잡는 지자체라면{' '}
                  <b>설정 · 서비스</b>에서 켜실 수 있습니다.)<br />
                  <b>계획 요일이 아닌 날에 다녀오셔도 그냥 「제공」입니다.</b>{' '}
                  지자체가 정한 것은 횟수(「주 2회」)이고 요일은 안내입니다.
                  「월 2회」·「생애 1회」처럼 요일이 없는 서비스는 달력이
                  흐린 점(<b>·</b>)으로 열려 있으니 다녀온 날을 눌러 주세요.<br />
                  <b>토·일과 설정에 넣은 공휴일은 색이 다릅니다.</b> 공휴일은{' '}
                  <b>설정 · 공휴일</b>에서 넣습니다. 휴일 할증을 쓰기로 하신 기관이면
                  그 날에 할증이 붙습니다 (<b>설정 · 계산 규칙</b>에서 켜고 끕니다).<br />
                  <b>관리자와 사무직원은 지난 기록도 눌러서 고칠 수 있습니다.</b>{' '}
                  현장에서 잘못 찍힌 것을 사무실에서 바로잡는 자리입니다.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/*
        눌러서 연 칸. 상태를 고치는 것도, 현장에서 온 것을 보는 것도
        여기서 합니다 (2026-09-05 무무 지시로 「눌러 도는」 것을 대신함).
      */}
      {열린것 && (
        <실적창
          it={열린것.it}
          c={열린것.c}
          닫기={() => set열린칸(null)}
          사유들={d.reasons ?? []}
          상태바꾸기={(다음, 대면, 사유) => tap(열린것.it, 열린것.c, 다음, 대면, 사유)}
          분적기={() => 분적기(열린것.it, 열린것.c)}
          갈래고치기={() => 갈래고치기(열린것.it, 열린것.c)}
          현장적기={async (값) => {
            /*
             * 사진은 따로 올립니다 — 그림이 커서 나머지와 한 덩이로
             * 보내면 큰 것 하나 때문에 다 실패합니다.
             */
            if (값.새사진?.length)
              await api.실적사진({
                assignId: 열린것.it.assignId, on: 열린것.c.on, 그림들: 값.새사진,
              })
            await api.현장적기({
              assignId: 열린것.it.assignId, on: 열린것.c.on,
              값: { 시작: 값.시작, 종료: 값.종료, 적은것: 값.적은것,
                    ...(값.서명 !== undefined ? { 서명: 값.서명 } : {}) },
            })
            await load()
          }}
        />
      )}
    </>
  )
}
