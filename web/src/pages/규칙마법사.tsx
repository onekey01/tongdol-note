import { useEffect, useState } from 'react'
import { api } from '../lib/api'

/**
 * ═══════════════════════════════════════════════════════════
 *  최초 설정 마법사 — 확인하지 않으면 홈이 안 열립니다
 * ═══════════════════════════════════════════════════════════
 *
 * (2026-09-01 무무 안 · `할일.md` 7-하)
 *
 *   기관 정보  →  관리자 등록  →  ★ 여기  →  홈
 *
 * ── ★ 새로 적는 화면이 아니라 「확인하는 화면」입니다 ★ ──────
 *
 * 편람 값이 **이미 다 채워져 있습니다.** 맞으면 맨 아래 단추 하나로
 * 끝나고, 다른 지자체면 그 자리에서 고칩니다. **1분**입니다.
 *
 * ── 건너뛰기를 두지 않습니다 ────────────────────────────────
 * 값이 다 채워져 있어 누를 것이 확인뿐입니다.
 * 빠져나갈 구멍을 두면 반드시 그리로 갑니다.
 *
 * ── 왜 묻는지 한 줄씩 답니다 ────────────────────────────────
 * 「이 값이 틀리면 청구 금액이 틀립니다」가 없으면, 관리자는 무엇을
 * 확인하는지 모르는 채로 아래로 내려갑니다.
 */
export default function 규칙마법사({ onDone }: { onDone: () => void }) {
  const [d, setD] = useState<any>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.setupRules().then(setD).catch((e) => setErr(e.message))
  }, [])

  if (err && !d) return (
    <div className="center"><div className="panel"><div className="msg err">{err}</div></div></div>
  )
  if (!d) return <div className="center"><p className="muted">불러오는 중…</p></div>

  const 고치기 = (조각: any) => setD({ ...d, ...조각 })
  const 서비스고치기 = (id: number, 조각: any) => setD({
    ...d, 서비스들: d.서비스들.map((s: any) => (s.id === id ? { ...s, ...조각 } : s)),
  })
  const 구간고치기 = (id: number, 조각: any) => setD({
    ...d, 구간들: d.구간들.map((t: any) => (t.id === id ? { ...t, ...조각 } : t)),
  })

  const 단위말 = (u: string) => (u === 'hour' ? '시간당' : u === 'meal' ? '한 끼' : '한 번')
  const 시간제 = (u: string) => u === 'hour'

  /*
   * ── ★ 빈칸을 0 으로 바꿔 보내면 안 됩니다 ★ (2026-09-09) ─────
   *
   * `Number('') || 0` 은 **빈칸을 0 으로** 만듭니다. 그런데 이 화면에서
   * 0 은 「한도를 안 봅니다」라는 **뜻이 있는 값**입니다. 그래서 칸을
   * 비우고 마치면 「한도 없음」으로 조용히 저장되고, 아무도 모릅니다.
   *
   * 빈칸은 **빈칸 그대로** 보냅니다. 서버(`첫설정.ts`)가 「적어 주세요」로
   * 돌려보내고, 0 을 정말로 넣고 싶으면 0 을 치면 됩니다.
   */
  const 그대로 = (v: any) => (String(v ?? '').trim() === '' ? '' : v)

  async function 마치기() {
    setErr(''); setBusy(true)
    try {
      await api.setupRulesSave({
        규칙이름: d.규칙이름,
        연간한도: 그대로(d.연간한도),
        주거한도: 그대로(d.주거한도),
        비대면한도: 그대로(d.비대면한도),
        비대면세는법: d.비대면세는법,
        서비스들: d.서비스들.map((s: any) => ({
          id: s.id, name: s.name,
          단가: 그대로(s.단가),
          월한도분: 그대로(s.월한도분),
          월한도횟수: 그대로(s.월한도횟수),
          // 1회 시간은 비워 두어도 됩니다 — 60분으로 봅니다 (v36).
          한번분: String(s.한번분 ?? '').trim() === '' ? 0 : s.한번분,
          생애한도: s.생애한도 == null ? null : 그대로(s.생애한도),
        })),
        구간들: d.구간들.map((t: any) => ({ id: t.id, label: t.label, rate: Number(t.rate) })),
      })
      onDone()
    } catch (e: any) { setErr(e.message); setBusy(false) }
  }

  return (
    <div className="center">
      <form className="panel wide" onSubmit={(e) => { e.preventDefault(); 마치기() }}>
        <div className="panel-head">
          <p className="eyebrow">처음 한 번 · 1분</p>
          <h1>이 값들이 맞는지만 봐 주세요</h1>
          <p className="note">
            <b>{d.기관}</b> 의 값입니다. 2026년 해남군 통합돌봄 편람 기준으로 채워 두었습니다.
            <b> 맞으면 맨 아래 단추 하나로 끝납니다.</b> 다른 지자체면 여기서 고치시면 됩니다.
            <br />
            마친 뒤에도 <b>설정 → 우리 지자체 규칙</b>에서 언제든 고칠 수 있습니다. 여기는 시작점일 뿐입니다.
          </p>
        </div>

        {err && <div className="msg err" style={{ whiteSpace: 'pre-wrap' }}>{err}</div>}

        {/* ① 우리 지자체 이름 */}
        <h3>① 우리 지자체 이름</h3>
        <p className="note small" style={{ marginTop: 0 }}>
          규칙 이름입니다. 그대로 두면 설정 화면과 이력에 <b>남의 프로그램처럼</b> 보입니다.
        </p>
        <div className="field" style={{ maxWidth: '20rem' }}>
          <label htmlFor="w-name">규칙 이름</label>
          <input id="w-name" value={d.규칙이름} placeholder="해남군 규칙"
                 onChange={(e) => 고치기({ 규칙이름: e.target.value })} required />
        </div>

        {/* ② 서비스 단가 */}
        <h3 style={{ marginTop: 24 }}>② 서비스 단가</h3>
        <p className="note small" style={{ marginTop: 0 }}>
          <b>이 값이 틀리면 청구 금액이 그대로 틀립니다.</b> 어르신 영수증과 군에 내는
          비용총괄(서식8)에 이 값이 찍혀 나갑니다.
        </p>
        <table className="grid">
          <thead><tr><th>서비스</th><th style={{ width: '11rem' }}>단가</th><th>단위</th></tr></thead>
          <tbody>
            {d.서비스들.map((s: any) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>
                  <input type="number" min="0" value={s.단가}
                         onChange={(e) => 서비스고치기(s.id, { 단가: e.target.value })} />
                </td>
                <td className="muted">{단위말(s.unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ③ 지원한도 */}
        <h3 style={{ marginTop: 24 }}>③ 지원한도</h3>
        <p className="note small" style={{ marginTop: 0 }}>
          넘겨서 청구하면 <b>군이 안 줍니다 — 기관이 떠안습니다.</b> 넘는 계획은 아예 저장되지 않습니다.
          <b> 0 은 「한도를 안 봅니다」</b>라는 뜻입니다.
        </p>
        <div className="row">
          <div className="field" style={{ maxWidth: '14rem' }}>
            <label htmlFor="w-annual">1인 연간 지원한도</label>
            <input id="w-annual" type="number" min="0" value={d.연간한도}
                   onChange={(e) => 고치기({ 연간한도: e.target.value })} />
            <span className="muted small">편람 1,500,000원</span>
          </div>
          <div className="field" style={{ maxWidth: '14rem' }}>
            <label htmlFor="w-house">안전생활환경 생애한도</label>
            <input id="w-house" type="number" min="0" value={d.주거한도}
                   onChange={(e) => 고치기({ 주거한도: e.target.value })} />
            <span className="muted small">편람 1,000,000원 · 연간 한도 <b>바깥</b>입니다</span>
          </div>
        </div>

        {/* ④ 서비스별 월 한도 */}
        <h3 style={{ marginTop: 24 }}>④ 서비스별 월 한도</h3>
        <p className="note small" style={{ marginTop: 0 }}>
          편람 — 가사 <b>월 12시간</b> · 식사 <b>월 8회</b> · 동행 <b>월 6시간과 2회</b> ·
          이미용 <b>월 1회</b>. 시간과 횟수가 <b>둘 다</b> 걸리는 서비스가 있습니다.
        </p>
        <table className="grid">
          <thead><tr>
            <th>서비스</th><th style={{ width: '8rem' }}>월 시간</th>
            <th style={{ width: '7rem' }}>월 횟수</th>
            <th style={{ width: '8rem' }}>1회 시간</th>
            <th style={{ width: '10rem' }}>생애한도</th>
          </tr></thead>
          <tbody>
            {d.서비스들.map((s: any) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>
                  {시간제(s.unit) ? (
                    <input type="number" min="0" value={s.월한도분}
                           onChange={(e) => 서비스고치기(s.id, { 월한도분: e.target.value })} />
                  ) : <span className="muted">—</span>}
                </td>
                <td>
                  <input type="number" step="1" min="0" value={s.월한도횟수}
                         onChange={(e) => 서비스고치기(s.id, { 월한도횟수: e.target.value })} />
                </td>
                {/*
                  ── 1회 서비스 시간 (v36 · 2026-09-11 무무) ────────────
                  「마법사에서도 적용이 되어야 해. 그래야 수행기관에서
                   어? 이게 맞을텐데 왜 안되지? 하는 오해를 하지 않을 수 있어.」
                  설정에만 있으면 관리자는 여기서 월 한도만 보고 넘어갔다가
                  배정에서 막히고, 까닭을 못 찾습니다.
                */}
                <td>
                  {시간제(s.unit) ? (
                    <input type="number" min="0" max="1440" value={s.한번분}
                           placeholder="60"
                           onChange={(e) => 서비스고치기(s.id, { 한번분: e.target.value })} />
                  ) : <span className="muted">—</span>}
                </td>
                <td>
                  {s.생애한도 == null
                    ? <span className="muted">—</span>
                    : <input type="number" min="0" value={s.생애한도}
                             onChange={(e) => 서비스고치기(s.id, { 생애한도: e.target.value })} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/*
          ── ★ 숫자 칸에 step 을 붙이지 마세요 ★ (2026-09-11) ────────
          여기 `step="30"` 이 붙어 있었습니다. 화살표로 30씩 오르내리게
          하려던 것인데, 브라우저는 그걸 **「30의 배수만 유효」**로 받습니다.
          그래서 20·25·45 를 치면 저장이 막히고 **영문 창**이 떴습니다 —
            「Please enter a valid value. The two nearest valid values are 0 and 30.」
          파일럿 첫날 무무 님이 이 창을 보고 30 을 넣고 오셨습니다.
          그러면 가사지원 월 한도가 **30분**이 되어 **배정이 하나도
          저장되지 않습니다.** 단가·한도 칸도 모두 같은 까닭으로 걷어냈습니다.
        */}
        <p className="note small" style={{ margin: '4px 0 0' }}>
          월 시간은 <b>분</b>으로 적습니다 — 12시간이면 720. <b>0 은 「안 봅니다」</b>입니다.
          <br />
          <b>1회 시간</b>은 「한 번 가면 보통 몇 분 하는가」입니다. 비우면 60분으로 봅니다.
          배정에서 사람마다 다르게 적을 수 있고, 그 값이 이것보다 앞섭니다.
          <br />
          <b>한도 안에 들면 어떻게 나누셔도 됩니다</b> — 1회 시간 × 그 달 횟수가
          월 시간 안이면 그대로 저장됩니다.
          {d.서비스들.filter((s: any) => 시간제(s.unit)
              && Number(s.월한도분) > 0 && Number(s.한번분 || 60) > 0).map((s: any) => (
            <span key={s.id}>
              <br />
              <b>{s.name}</b> — 월 {Number(s.월한도분)}분 ÷ 1회 {Number(s.한번분 || 60)}분 ={' '}
              <b>한 달 {Math.floor(Number(s.월한도분) / Number(s.한번분 || 60))}번</b>까지
            </span>
          ))}
        </p>

        {/* ⑤ 비대면 배달 */}
        <h3 style={{ marginTop: 24 }}>⑤ 식사지원 · 비대면 배달</h3>
        <p className="note small" style={{ marginTop: 0 }}>
          계약서(서식2) 5-2조 — <b>3회 연속</b> 대면 수령하지 않으면 식사지원을 포함한
          <b> 통합돌봄 서비스 전체가 중지</b>됩니다. 돈이 아니라 <b>어르신 서비스가 끊기는</b> 기준입니다.
        </p>
        <div className="row">
          <div className="field" style={{ maxWidth: '11rem' }}>
            <label htmlFor="w-f2f">한도 (회)</label>
            <input id="w-f2f" type="number" step="1" min="0" max="30" value={d.비대면한도}
                   onChange={(e) => 고치기({ 비대면한도: e.target.value })} />
          </div>
          <div className="field" style={{ maxWidth: '15rem' }}>
            <label htmlFor="w-f2fmode">세는 법</label>
            <select id="w-f2fmode" value={d.비대면세는법}
                    onChange={(e) => 고치기({ 비대면세는법: e.target.value })}>
              <option value="연속">연속 — 한 번 대면이면 0으로</option>
              <option value="누적">누적 — 그해에 모두 더함</option>
            </select>
            <span className="muted small">해남군 확인 = <b>연속</b> (2026-09-08)</span>
          </div>
        </div>

        {/* ⑥ 본인부담 구간 */}
        <h3 style={{ marginTop: 24 }}>⑥ 본인부담 구간</h3>
        <p className="note small" style={{ marginTop: 0 }}>
          <b>지자체마다 다릅니다.</b> 이 비율이 그대로 어르신 영수증의 본인부담금이 됩니다.
        </p>
        <table className="grid">
          <thead><tr><th>구간 이름</th><th style={{ width: '9rem' }}>본인부담</th></tr></thead>
          <tbody>
            {d.구간들.map((t: any) => (
              <tr key={t.id}>
                <td>
                  <input value={t.label}
                         onChange={(e) => 구간고치기(t.id, { label: e.target.value })} />
                </td>
                <td>
                  <input type="number" step="1" min="0" max="100"
                         value={Math.round(Number(t.rate) * 100)}
                         onChange={(e) => 구간고치기(t.id, { rate: Number(e.target.value) / 100 })} />
                  <span className="muted small"> %</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ⑦ 공휴일 — 여기만 「나중에」 */}
        <h3 style={{ marginTop: 24 }}>⑦ 공휴일 — 나중에 하셔도 됩니다</h3>
        <p className="note small" style={{ marginTop: 0 }}>
          {d.올해공휴일 > 0
            ? <>{d.해}년 공휴일이 <b>{d.올해공휴일}일</b> 들어 있습니다. 이대로 두시면 됩니다.</>
            : <>
                {d.해}년 공휴일이 <b>하나도 없습니다.</b> 달력을 손에 들고 있어야 넣을 수 있고,
                휴일 할증이 꺼져 있으면 급하지 않아 <b>여기서는 묻지 않습니다</b> —
                <b> 설정 → 공휴일</b>에서 넣으실 때까지 홈에 알려 드립니다.
              </>}
        </p>

        <div className="panel-foot" style={{ marginTop: 28 }}>
          <button className="primary" disabled={busy}>
            {busy ? '저장하는 중…' : '이 값으로 시작합니다'}
          </button>
          <p className="note small" style={{ margin: '8px 0 0' }}>
            건너뛰는 단추는 두지 않았습니다. <b>값이 다 채워져 있어 누를 것이 확인뿐</b>이고,
            빠져나갈 구멍을 두면 이 화면이 있으나 마나 하기 때문입니다.
          </p>
        </div>
      </form>
    </div>
  )
}
