import { useEffect, useState, Fragment } from 'react'
import { api } from '../lib/api'

/**
 * 배정 한 건 고치기 — **한 곳에서 만들어 세 곳에서 씁니다.**
 *
 *   배정·주간계획 화면   목록에서 줄을 눌렀을 때
 *   대상자 화면          받는 서비스 줄에서 담당을 붙일 때
 *   종사자 화면          이 사람에게 대상자를 붙일 때
 *
 * 셋 다 같은 자료(assignment 표)에 씁니다. 그래서 어느 쪽에서 하든
 * 나머지 두 곳에 그대로 나타납니다. 화면마다 따로 만들면
 * 한쪽에서 고친 것이 다른 쪽에 안 보이는 날이 반드시 옵니다.
 */

export const DOW = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 서버가 보낸 글의 `**굵게**` 를 진짜 굵은 글씨로 바꿉니다.
 *
 * 예전에 서버 글에 별표를 그대로 두었더니 화면에 「**2건이 사라집니다**」
 * 처럼 별표가 보였습니다 (2026-09-07). 지우기만 하면 강조가 사라지므로,
 * 여기서 제대로 굵게 만들어 줍니다.
 */
function 굵게(글: string) {
  return String(글 ?? '').split(/(\*\*[^*]+\*\*)/g).map((조각, i) =>
    조각.startsWith('**') && 조각.endsWith('**')
      ? <b key={i}>{조각.slice(2, -2)}</b>
      : <span key={i}>{조각}</span>)
}

/** 「12시간」·「1시간 30분」처럼. 서버의 시간말 과 같은 모양입니다. */
function 시간글(분: number): string {
  const m = Math.max(0, Math.round(Number(분) || 0))
  const h = Math.floor(m / 60), r = m % 60
  if (h && r) return `${h}시간 ${r}분`
  if (h) return `${h}시간`
  return `${r}분`
}

/**
 * 요일 고르기.
 *
 * 시각은 받지 않습니다 — 2026 통합돌봄 지침에 서비스별 소요시간이 없습니다.
 * 없는 것을 칸으로 만들면 현장이 지어내서 채웁니다.
 */
export function DayPicker({
  value, onChange, load,
}: { value: number[]; onChange: (v: number[]) => void; load?: number[] }) {
  return (
    <div className="row tight" style={{ alignItems: 'stretch' }}>
      {DOW.map((d, i) => {
        const on = value.includes(i)
        const n = load?.[i] ?? 0
        return (
          <button key={i} type="button" aria-pressed={on}
                  className={on ? 'primary' : undefined}
                  style={{ flex: 1, flexDirection: 'column', lineHeight: 1.3 }}
                  onClick={() => onChange(
                    on ? value.filter((x) => x !== i) : [...value, i].sort()
                  )}>
            {d}
            {/* 그 요일에 이 담당이 이미 몇 곳을 도는지.
                월요일에만 여덟 곳이 몰린 계획은 지킬 수 없는 계획입니다. */}
            <span style={{ display: 'block', fontSize: '.68rem', opacity: .7 }}>
              {n > 0 ? `이미 ${n}곳` : ' '}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/*
 * ── 대상자 메모는 **오른쪽 메모장 한 곳**에서만 (2026-09-04) ──
 *
 * 여기 「대상자 메모」 한 줄이 따로 있었습니다. 그런데 오른쪽 메모장을
 * 펴면 **그 사람 보드가 아니라 기관 보드**가 나와, 같은 사람 메모가
 * 두 군데로 갈리고 어느 쪽이 진짜인지 알 수 없었습니다.
 *
 * 그래서 **줄을 없애고 메모장 한 곳으로 모았습니다** (무무 님 지시).
 * 대신 이 상자를 열면 **메모장이 그 사람 보드로 따라옵니다** —
 * 아래 `useEffect` 의 `memo:board` 가 그 일을 합니다.
 */

export default function AssignBox({
  recipientId, serviceId, presetUserId, onSaved, onClose, showWeek = true,
}: {
  recipientId: string
  serviceId: number
  presetUserId?: number | null
  onSaved: () => void
  onClose: () => void
  showWeek?: boolean
}) {
  const [d, setD] = useState<any>(null)
  const [userId, setUserId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [days, setDays] = useState<number[]>([])
  /** 계획된 **1회 서비스 시간**(분). 비우면 계획 셈은 1시간으로 봅니다. */
  const [mins, setMins] = useState('')
  // 한 달에 몇 번까지 (v34). '0' 이면 매주.
  const [달번, set달번] = useState('0')
  const [load, setLoad] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  /** 저장하기 전에 미리 재 본 것 — 한 달에 얼마, 한도를 넘는지. */
  const [잰것, set잰것] = useState<any>(null)

  useEffect(() => {
    let live = true
    api.assignOne(recipientId, serviceId).then((x) => {
      if (!live) return
      setD(x)
      setUserId(String(presetUserId ?? x.row.workerUserId ?? ''))
      // 배정 기간은 의뢰 기간을 기본으로 씁니다.
      // 대개 그대로 가고, 담당이 중간에 바뀔 때만 손을 댑니다.
      setFrom(x.row.assignFrom ?? x.row.from ?? '')
      setTo(x.row.assignTo ?? x.row.to ?? '')
      setDays((x.row.slots ?? []).map((s: any) => s.dow))
      setMins(String((x.row.slots ?? []).find((s: any) => s.minutes)?.minutes ?? ''))
      set달번(String(x.row.monthlyTimes ?? 0))
    }).catch((e) => setMsg(e.message))
    return () => { live = false }
  }, [recipientId, serviceId, presetUserId])

  /*
   * 이 상자를 열면 **오른쪽 메모장을 그 사람 보드로** 돌려 놓습니다.
   * 배정 화면은 주소가 안 바뀌므로 메모장이 스스로는 알 수 없습니다 —
   * 그래서 화면이 알려 줍니다(`MemoBoard` 가 이 신호를 듣습니다).
   * 상자를 닫으면 기관 보드로 되돌아갑니다.
   */
  useEffect(() => {
    if (!d?.row?.recipient) return
    const 알리기 = (id: string, name: string) => {
      // quiet — 보드만 돌려 놓고 서랍을 저절로 열지는 않습니다.
      window.dispatchEvent(new CustomEvent('memo:board', { detail: { id, name, quiet: true } }))
    }
    알리기(recipientId, d.row.recipient)
    return () => { 알리기('', '') }
  }, [recipientId, d?.row?.recipient])

  useEffect(() => {
    if (!userId) { setLoad([0, 0, 0, 0, 0, 0, 0]); return }
    const t = setTimeout(() => {
      api.assignLoad({
        userId: Number(userId), from: from || null, to: to || null,
        exceptId: d?.row?.assignId ?? null,
      }).then((r) => setLoad(r.dayLoad)).catch(() => {})
    }, 200)
    return () => clearTimeout(t)
  }, [userId, from, to, d])

  /*
   * ── ★ 계획을 **저장하기 전에** 재 봅니다 ★ ─────────────────
   *
   * (2026-09-07 무무 — 계획 수립 시 100%가 넘어가는 계획이 수립되면
   *  경고창을 띄우자)
   *
   * 지금까지 한도 경고는 전부 **사후**였습니다. 다녀온 기록이 쌓여
   * 넘고 나서야 홈에 떴는데, 그때는 **이미 나간 돈**입니다. 넘긴 몫을
   * 지자체가 안 주면 기관이 떠안습니다.
   *
   * 요일을 누를 때마다 그 자리에서 다시 잽니다 — 저장을 눌러야 알면
   * 이미 늦습니다. 자료함은 아무것도 안 바뀝니다(재기만 합니다).
   */
  useEffect(() => {
    if (!d?.row) return
    const t = setTimeout(() => {
      api.previewAssign({
        recipientId, serviceId,
        assignId: d.row.assignId ?? null,
        from: from || null, to: to || null,
        slots: days.map((dow) => ({ dow, minutes: mins ? Number(mins) : null })),
        달몇번: Number(달번) || 0,
      }).then(set잰것).catch(() => set잰것(null))
    }, 250)
    return () => clearTimeout(t)
  }, [recipientId, serviceId, days, mins, from, to, 달번, d?.row?.assignId])

  if (!d) return <div className="card"><p className="muted">불러오는 중…</p></div>

  const picked = d.workers.find((w: any) => String(w.userId) === userId)
  const want = d.row.want
  const countOff = want != null && days.length > 0 && days.length !== want

  async function save() {
    if (!userId) return setMsg('담당을 골라 주세요.')
    // 제공인력 역할이 없는 사람을 골랐을 때 — 관리자가 직접 나가는 경우입니다.
    let allowRoleAdd = false
    if (picked && !picked.isWorker) {
      if (!confirm(
        `${picked.name} 님은 제공인력 역할이 없습니다.\n\n` +
        `역할에 「제공인력」을 함께 켜고 배정합니다.\n` +
        `그래야 실적과 기록지가 이 분 이름으로 쌓입니다.\n\n계속할까요?`
      )) return
      allowRoleAdd = true
    }
    /*
     * ── ★ 한도를 넘는 계획이면 **여기서 알려 주고 멈춥니다** ★ ──
     *
     * (2026-09-07 무무 — 「한도가 넘어갈 경우 지자체 예산의 문제가 발생할
     *  수 있습니다. 정말로 계획 할까요? 라고 한번만 더 묻는거지」)
     * (2026-09-08 무무 — 「막지만 한도를 넘게 계획했다고 관리자에게
     *  알려야 함」 / 막는 자리는 「**가. 계획**」)
     *
     * ★★ 2026-09-08 에 **두 번 묻고 지나가던 것을 없앴습니다.**
     *   이제 서버가 막습니다. 물어 놓고 「예」를 눌렀는데 그 다음에
     *   거절당하면, 그건 **묻지 말았어야 할 것을 물은 것**입니다.
     *
     * ★ **여기서 못 박지는 않습니다.** 「줄이는 저장」은 서버가 통과
     *   시키는데(이미 넘겨 저장된 배정의 담당자만 바꾸는 경우 등),
     *   화면은 그 사정을 모릅니다. 화면이 앞서 막으면 고칠 길이 막힙니다.
     *   **판단은 서버 한 곳**입니다 — 화면은 미리 보여 주기만 합니다.
     */
    if (잰것?.넘나) {
      const 넘은것 = (잰것.칸들 ?? []).filter((x: any) => x.넘나)
      const 현 = 잰것.현황 ?? {}
      const 현황글 = [
        `［${d.row.recipient} 님이 지금 받고 있는 것 — ${(현.달 ?? '').replace('-', '년 ')}월］`,
        ...((현.줄들 ?? []).length
          ? 현.줄들.map((r: any) => `· ${r.이름}   ${r.말}`)
          : ['· (이 달에 다녀온 기록이 아직 없습니다)']),
        현.연간?.봄
          ? `· 올해 지원한도  ${Number(현.연간.쓴돈).toLocaleString('ko-KR')}원 / ` +
            `${Number(현.연간.한도).toLocaleString('ko-KR')}원 · ` +
            `남음 ${Number(현.연간.남은돈).toLocaleString('ko-KR')}원`
          : '',
      ].filter(Boolean).join('\n')

      /*
       * 「한 달에 몇 번」으로 들 수 있으면 **그것부터** 알려 줍니다.
       * 월 2회짜리를 매주로 잡으면 요일을 아무리 줄여도 못 듭니다 —
       * 그 말이 없으면 관리자는 될 때까지 요일만 지웁니다.
       */
      const 횟수칸 = 넘은것.find((x: any) =>
        x.단위 === '회' && x.한도 >= 1 && x.한도 <= 4)
      const 길잡이 = 횟수칸 && Number(달번) === 0
        ? `\n\n★ 이 서비스는 한 달에 ${횟수칸.한도}번까지입니다.\n` +
          `   「가는 주기」를 「한 달에 ${횟수칸.한도}번」으로 바꾸면 한도 안에 듭니다.\n` +
          `   요일만 줄여서는 들 수 없습니다 (한 주에 한 번이라도 한 달 4~5번입니다).`
        : ''

      alert(
        `이 계획은 한도를 넘습니다. 이대로는 저장할 수 없습니다.\n\n` +
        현황글 + `\n\n［넘는 것］\n` +
        넘은것.map((x: any) =>
          `· ${x.이름}\n   ${x.말}` +
          (x.설명 ? `\n   → ${String(x.설명).replace(/\*\*/g, '')}` : '')
        ).join('\n\n') + 길잡이 +
        `\n\n요일·시간·주기를 고쳐 한도 안에 들게 해 주세요.`
      )
      /*
       * ★ 그래도 **저장을 시도합니다.** 「줄이는 저장」이면 서버가
       *   통과시킵니다. 화면이 여기서 return 해 버리면 이미 넘겨 저장된
       *   배정을 영영 못 고칩니다.
       */
    }

    setBusy(true); setMsg('')
    try {
      await api.saveAssign({
        recipientId, serviceId, userId: Number(userId),
        from: from || null, to: to || null,
        slots: days.map((dow) => ({ dow, minutes: mins ? Number(mins) : null })),
        monthlyTimes: Number(달번) || 0,
        allowRoleAdd,
      })
      onSaved()
    } catch (e: any) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  async function drop() {
    if (!d.row.assignId) return
    if (!confirm(
      `${d.row.recipient} 님의 ${d.row.service} 배정을 거둡니다.\n\n` +
      `이미 시작한 배정이면 지우지 않고 어제 날짜로 닫습니다 —\n` +
      `다녀온 날들이 있는데 배정이 사라지면 실적이 붕 뜹니다.\n\n계속할까요?`
    )) return
    setBusy(true)
    try { await api.removeAssign(d.row.assignId); onSaved() }
    catch (e: any) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="card">
      <div className="main-head" style={{ marginTop: 0 }}>
        <h2 style={{ margin: 0 }}>
          {d.row.recipient} <span className="muted">·</span> {d.row.service}
        </h2>
        <span className="muted small">
          {d.row.dong && `${d.row.dong} · `}
          의뢰 {d.row.cycle || '주기 없음'} · {d.row.from ?? '—'} ~ {d.row.to ?? '—'}
        </span>
        <div className="spacer" />
        <div className="btns">
          <button className="primary" onClick={save} disabled={busy}>
            {busy ? '저장 중…' : '배정 저장'}
          </button>
          {d.row.assignId && (
            <button className="danger" onClick={drop} disabled={busy}>배정 거두기</button>
          )}
          <button className="plain" onClick={onClose}>닫기</button>
        </div>
      </div>

      {msg && <div className="msg err">{msg}</div>}

      {/*
        대상자 메모는 **오른쪽 메모장**에 있습니다. 이 상자를 열면
        메모장이 그 사람 보드로 따라옵니다 (위 `useEffect` 참고).
      */}

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="a-worker">담당</label>
          <select id="a-worker" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">— 고르기 —</option>
            <optgroup label="제공인력">
              {d.workers.filter((w: any) => w.isWorker && !w.onLeave).map((w: any) => (
                <option key={w.userId} value={w.userId}>
                  {w.name}{w.dong ? ` (${w.dong})` : ''}{w.near ? ' ★같은 읍면동' : ''}
                  {` · ${w.load}건`}
                </option>
              ))}
            </optgroup>
            <optgroup label="그 밖의 종사자 — 고르면 제공인력 역할을 함께 켭니다">
              {d.workers.filter((w: any) => !w.isWorker && !w.onLeave).map((w: any) => (
                <option key={w.userId} value={w.userId}>
                  {w.name}{w.dong ? ` (${w.dong})` : ''}
                </option>
              ))}
            </optgroup>
            {/*
              쉬고 있는 분.
              **목록에서 감추지 않습니다.** 감추면 「최돌봄 선생님이 왜 없지」가 되고,
              찾다가 계정을 하나 더 만드는 일이 벌어집니다.
              보이되 고를 수는 없게 둡니다.
            */}
            {d.workers.some((w: any) => w.onLeave) && (
              <optgroup label="휴직 중 — 고를 수 없습니다">
                {d.workers.filter((w: any) => w.onLeave).map((w: any) => (
                  <option key={w.userId} value={w.userId} disabled>
                    {w.name}{w.dong ? ` (${w.dong})` : ''} · 휴직 중
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {picked && !picked.isWorker && (
            <p className="note small" style={{ marginTop: 6, marginBottom: 0 }}>
              제공인력 역할이 없는 분입니다. 저장할 때 역할을 함께 켭니다.
            </p>
          )}
          {picked?.payrollExcluded && (
            <p className="note small" style={{ marginTop: 6, marginBottom: 0 }}>
              <b>별도관리</b>로 표시된 분입니다. 실적은 쌓이고 임금 계산에서만 빠집니다.
            </p>
          )}
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="a-from">배정 시작</label>
          <input id="a-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="a-to">배정 끝</label>
          <input id="a-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {/*
        「주 2회」는 요일로 펼 수 있습니다. 「월 2회」·「생애 1회」는 못 폅니다 —
        그 달 어느 날에 갈지는 그때 정하는 일이고, 요일로 못박으면 거짓말이 됩니다.
      */}
      {d.row.byDow ? (
        <div className="field">
          <label>
            가는 요일
            <span className="muted"> — 「{d.row.cycle || '주기 없음'}」을 실제 요일로</span>
          </label>
          <DayPicker value={days} onChange={setDays} load={load} />

          {/*
            ── 1회 서비스 시간 (2026-09-03 무무 님 지시) ────────────
            「서비스 제공계획에 시간이 별도로 명시되어 있다면 일 최대
             서비스시간을 이에 맞춤.」 여기 적은 값이 **그 요일의 하루 최대**가
            됩니다. 비우면 **계획 셈만** 1시간으로 잡습니다 (2026-09-09 무무).
            청구 쪽 천장은 그대로 설정의 「하루 최대 서비스 시간」입니다.
          */}
          <div className="row tight" style={{ marginTop: 10 }}>
            <div className="field" style={{ marginBottom: 0, maxWidth: '14rem' }}>
              <label htmlFor="a-mins">1회 서비스 시간 (분)</label>
              <input id="a-mins" type="number" min="0" max="1440"
                     placeholder="비우면 1시간"
                     value={mins} onChange={(e) => setMins(e.target.value)} />
            </div>
            {/*
              ── 가는 주기 (v34 · 2026-09-08 무무) ────────────────────
              동행지원은 **월 2회**, 이미용은 **월 1회**입니다. 요일만으로는
              한 주에 한 번이 제일 적은데 그것만도 한 달 4~5번이라 **절대
              한도 안에 못 듭니다.** 그래서 「한 달에 몇 번」을 여기서 정합니다.
              「한 달에 2번 · 수요일」 = 그 달 수요일 중 **앞의 두 번**입니다.
            */}
            <div className="field" style={{ marginBottom: 0, maxWidth: '13rem' }}>
              <label htmlFor="a-cycle">가는 주기</label>
              <select id="a-cycle" value={달번} onChange={(e) => set달번(e.target.value)}>
                <option value="0">매주 — 고른 요일마다</option>
                <option value="1">한 달에 1번</option>
                <option value="2">한 달에 2번</option>
                <option value="3">한 달에 3번</option>
                <option value="4">한 달에 4번</option>
              </select>
            </div>
          </div>
          {Number(달번) > 0 && (
            <p className="note small" style={{ margin: '6px 0 0' }}>
              고른 요일이 그 달에 여러 번 와도 <b>앞의 {달번}번만</b> 갑니다.
              사무실 달력과 제공인력 폰이 <b>같은 날</b>을 봅니다.
            </p>
          )}
          <p className="note small" style={{ margin: '4px 0 0' }}>
            계획에 시간을 적어 두면 <b>그 요일의 하루 최대</b>가 됩니다 —
            실적에 그보다 긴 시간이 적혀도 청구는 여기까지만 셉니다.
            <br />
            비워 두시면 아래 셈은 <b>한 번에 1시간</b>으로 잡습니다.
            실제로 더 길게 하는 서비스면 여기에 적어 주세요 — 적은 값으로 다시 셉니다.
          </p>
        </div>
      ) : (
        <div className="field">
          <label>가는 요일</label>
          <p className="note small" style={{ margin: 0 }}>
            「{d.row.cycle || '주기 없음'}」은 요일을 정하지 않습니다.
            <b> 어느 날에 갈지는 그때그때 정하는 일</b>이라 요일로 못박으면 계획이 거짓말이 됩니다.<br />
            <b>제공실적</b> 화면에서 달력의 날짜를 눌러 다녀온 날을 적으시면 됩니다.
          </p>
        </div>
      )}

      {/*
        ── 이 계획대로 가면 ────────────────────────────────────
        요일을 누를 때마다 다시 잽니다. 저장을 눌러야 알면 이미 늦습니다.
      */}
      {잰것 && (잰것.칸들?.length > 0 || (잰것.달들?.length ?? 0) > 0) && (
        <div className={잰것.넘나 ? 'msg warn 계획잰것' : 'note small 계획잰것'}>
          {/* 서버 글의 `**굵게**` 를 진짜 굵은 글씨로 — 안 그러면 별표가 그대로 보입니다. */}
          <b>{굵게(잰것.한줄)}</b>

          {/*
            ★ **지금 받고 있는 것 · 한도 · 남은 한도**를 함께 (2026-09-07 무무).
              무엇을 줄여야 할지는 이 분이 받는 것 전체를 봐야 정합니다.
          */}
          {((잰것.현황?.줄들?.length ?? 0) > 0 || 잰것.현황?.연간?.봄) && (
            <div className="계획현황">
              <div className="이름표">
                {d.row.recipient} 님이 지금 받고 있는 것
                <span className="muted"> — {잰것.현황.달}</span>
              </div>
              {(잰것.현황.줄들 ?? []).map((r: any) => (
                <div key={r.serviceId} className="줄">
                  <span>{r.이름}</span><span className="muted">{r.말}</span>
                </div>
              ))}
              {잰것.현황?.연간?.봄 && (
                <div className="줄 연간">
                  <span>올해 지원한도 <span className="muted">(일상생활돌봄 전체)</span></span>
                  <span>
                    {Number(잰것.현황.연간.쓴돈).toLocaleString('ko-KR')}원 /
                    {' '}{Number(잰것.현황.연간.한도).toLocaleString('ko-KR')}원 ·
                    {' '}남음 <b>{Number(잰것.현황.연간.남은돈).toLocaleString('ko-KR')}원</b>
                  </span>
                </div>
              )}
            </div>
          )}
          {잰것.칸들?.length > 0 && (
            <table className="계획표">
              <tbody>
                {잰것.칸들.map((x: any) => (
                  <Fragment key={x.이름}>
                    <tr className={x.넘나 ? '넘음' : undefined}>
                      <td>{x.이름}</td>
                      <td>{x.말}</td>
                      <td className="right mono">
                        {Math.round(x.비율 * 100)}%{x.넘나 ? ' ★' : ''}
                      </td>
                    </tr>
                    {/*
                      ★ **무엇이 어떻게 되는지**를 바로 아래 붙입니다.
                        (2026-09-07 무무 — 「한도가 초과되었다고 하면서
                         설명이 같이 들어가면 좋겠지」)
                        「183% 넘음」만으로는 그게 얼마나 큰일인지 모릅니다.
                    */}
                    {x.설명 && (
                      <tr className={x.넘나 ? '넘음풀이' : '풀이'}>
                        <td colSpan={3}>{굵게(x.설명)}</td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
          {/*
            ── 달마다 몇 번 가나 — **정수**입니다 ────────────────
            (2026-09-07 무무 — 「실제로 실행되었다고 인정되는
             횟수(소수점은 말도 안되지) × 시간으로 계산이 되어야 해」)
            9월은 11번, 10월은 14번 — 달마다 다르고 그게 사실입니다.
          */}
          {(잰것.달들?.length ?? 0) > 0 && (
            <table className="계획달표">
              <tbody>
                {잰것.달들.map((m: any) => (
                  <tr key={m.달} className={m.넘나 ? '넘음' : undefined}>
                    <td>{Number(m.달.slice(5)) }월</td>
                    <td className="muted small">{m.첫날} ~ {m.끝날}</td>
                    <td className="right"><b>{m.횟수}번</b></td>
                    {잰것.시간제 && <td className="right mono">{시간글(m.인정분)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="muted small" style={{ marginTop: 6 }}>
            <b>{잰것.개시일} ~ {잰것.마지막날}</b>
            {잰것.기간개월 > 0 &&
              <span className="muted"> · 편람 「개시일부터 {잰것.기간개월}개월」로 잘랐습니다</span>}
            <br />
            앞으로 갈 것 <b>{Number(잰것.앞으로돈).toLocaleString('ko-KR')}원</b>
            {' · '}한도는 <b>{잰것.기준말}</b> 기준
            {잰것.기준 === 'claim' && 잰것.부담률 > 0 &&
              ` (본인부담 ${Math.round(잰것.부담률 * 100)}% 뺀 것)`}
            <br />
            달력의 요일을 <b>그대로 세었습니다</b> — 어림이 아닙니다.
            {/*
              2026-08-31 무무 님 지시로 **계획 단계에서 막습니다.**
              (「계획이 안 되면 실적도 따라서 할 수가 없어」)
              그 전 문구가 「넘어도 막지는 않습니다」로 남아 있어
              화면이 프로그램과 다른 말을 하고 있었습니다. 2026-09-08 고침.
            */}
            한도를 넘으면 <b>저장이 안 됩니다</b> — 넘긴 계획으로 실적을 찍으면
            그만큼이 <b>기관 부담</b>이 되기 때문입니다.
            요일이나 <b>1회 서비스 시간</b>을 줄여 한도 안으로 들이신 뒤 저장해 주세요.
          </div>
        </div>
      )}

      {countOff && (
        <div className="msg err">
          의뢰는 「{d.row.cycle}」인데 요일은 {days.length}개입니다.
          지자체와 이야기해 조정한 것이라면 그대로 두셔도 됩니다.
        </div>
      )}

      {showWeek && (
        <div className="field" style={{ marginBottom: 0 }}>
          <label>
            {d.row.recipient} 님의 한 주
            <span className="muted"> — 다른 서비스까지 함께 봅니다</span>
          </label>
          <div className="row tight" style={{ alignItems: 'stretch' }}>
            {DOW.map((dd, i) => {
              const others = (d.week ?? []).filter((w: any) => !w.mine && w.dow === i)
              const mineHere = days.includes(i)
              return (
                <div key={i} className="card"
                     style={{ margin: 0, padding: '10px', minWidth: 0 }}>
                  <div className="muted small" style={{ fontWeight: 700, marginBottom: 6 }}>{dd}</div>
                  {mineHere && (
                    <div className="small" style={{ fontWeight: 700 }}>{d.row.service}</div>
                  )}
                  {others.map((o: any, j: number) => (
                    <div key={j} className="muted small">{o.service}</div>
                  ))}
                  {!mineHere && others.length === 0 && <div className="muted small">—</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
