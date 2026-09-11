import { useEffect, useState, useCallback, Fragment } from 'react'
import 인쇄단추 from '../components/인쇄단추'
import { api } from '../lib/api'
import { linkProps } from '../lib/router'

/**
 * 정산 — 실적에 단가를 곱해 돈으로 바꿉니다.
 *
 *   서비스 비용   제공 횟수 × 단가
 *   본인부담금    서비스 비용 × 부담률   → 이용자가 냅니다
 *   청구액        비용 − 본인부담금      → 지자체에 청구합니다
 *
 * 「확정」을 누르면 계산에 쓴 단가·부담률·절삭 규칙이 **통째로 얼어붙습니다.**
 * 나중에 단가가 올라도 이 달 청구서 금액은 안 흔들립니다 —
 * 지자체가 「그때 얼마였습니까」라고 물으면 그때 값으로 답해야 하기 때문입니다.
 */

const won = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('ko-KR')

function thisMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function shift(m: string, by: number) {
  const [y, mm] = m.split('-').map(Number)
  const d = new Date(y, mm - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 상태 넷.
 *
 *   쌓이는중   청구 기간이 **아직 안 끝났습니다.** 확정하면 안 됩니다 —
 *              남은 날 실적이 갈 곳을 잃습니다. 얼마가 쌓였는지만 보여 줍니다.
 *   미확정     기간이 끝났고 이제 확정하면 됩니다.
 *   확정       금액이 얼었습니다. 단가가 올라도 안 흔들립니다.
 *   수납       돈을 받았습니다.
 */
const STATES = ['쌓이는중', '미확정', '확정', '수납']

/** 상태마다 색. 이미 있는 표 색을 빌려 씁니다. */
const 상태색: Record<string, string> = {
  수납: '이용', 확정: '중단', 미확정: '종결', 쌓이는중: '쌓이는중',
}

/** 기간을 짧게. 2026-07-11 → 7.11 */
/** 청구 시점을 사람 말로. 설정에서 고른 것을 화면에서 그대로 부릅니다. */
const 시점말 = (v: string) =>
  v === 'anniversary' ? '서비스 시작일부터 한 달씩'
  : v === 'on_end' ? '기간이 끝날 때 한 번에'
  : '달마다'

const 짧게 = (d: string) => (d ? `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}` : '')

/**
 * 한 **몫** 펼치기 — 서비스 줄과 단추.
 *
 * 시점이 같으면 몫이 하나라 지금까지와 똑같이 한 덩어리입니다.
 * 갈리면 두 덩어리가 되고, **각자 제 기간·제 상태·제 단추**를 갖습니다.
 * 지자체 몫은 확정했는데 본인부담금은 아직 쌓이는 중일 수 있으니까요.
 */
function 몫판({ x, k, month, rounding, onDone }: {
  x: any; k: any; month: string; rounding: any; onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const run = async (fn: () => Promise<any>) => {
    setBusy(true); setErr('')
    try { await fn(); onDone() }
    catch (e: any) { setErr(e.message) }
    finally { setBusy(false) }
  }

  const 한장 = k.kind === 'both'

  return (
    <div className="bill-part">
      {!한장 && (
        <div className="bill-part-head">
          <b>{k.몫이름}</b>
          <span className="muted small">
            {짧게(k.periodFrom)} ~ {짧게(k.periodTo)}
            {k.회차 > 1 && ` · ${k.회차}회차`}
          </span>
          <span className={`tag ${상태색[k.state] ?? '종결'}`}>{k.state}</span>
        </div>
      )}

      {err && <div className="msg err">{err}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>서비스</th><th className="right">평일</th><th className="right">휴일</th>
              <th className="right">횟수</th><th className="right">단가</th>
              <th className="right">비용</th><th>생애한도</th>
            </tr>
          </thead>
          <tbody>
            {k.lines.map((l: any) => (
              <tr key={l.serviceId}>
                <td><span className="svc">{l.service}</span></td>
                <td className="right mono small">{l.weekday || '—'}</td>
                <td className="right mono small">
                  {l.holiday ? l.holiday : <span className="muted">—</span>}
                </td>
                <td className="right mono"><b>{l.count}</b></td>
                <td className="right mono small">
                  {won(l.unitPrice)}
                  {l.holidayPrice && l.holiday > 0 && (
                    <div className="muted small">휴일 {won(l.holidayPrice)}</div>
                  )}
                </td>
                <td className="right mono"><b>{won(l.amount)}</b></td>
                <td className="small">
                  {l.lifetimeCap
                    ? <span className={l.over ? 'deadline' : undefined}>
                        {won(l.lifetimeUsed)} / {won(l.lifetimeCap)}
                        <div className="muted small">
                          {l.over ? `${won(-l.lifetimeLeft)}원 넘음` : `${won(l.lifetimeLeft)}원 남음`}
                        </div>
                      </span>
                    : <span className="muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row" style={{ alignItems: 'flex-start', marginTop: 14 }}>
        <div className="field" style={{ flex: 2, marginBottom: 0 }}>
          <dl className="facts">
            <dt>청구 기간</dt>
            <dd className="mono">
              {k.periodFrom} ~ {k.periodTo}
              {k.회차 > 1 && <span className="muted"> ({k.회차}회차)</span>}
            </dd>
            <dt>서비스 비용</dt><dd className="mono">{won(k.total)}원</dd>
            {k.kind !== 'claim' && (
              <>
                <dt>본인부담</dt>
                <dd className="mono">
                  {won(k.copay)}원
                  {/* 구간 이름에 이미 「20%」가 들어 있으면 또 붙이지 않습니다 —
                      「본인부담금 20% · 20%」처럼 겹쳐 보입니다. */}
                  <span className="muted"> ({
                    /\d\s*%/.test(String(k.copayLabel ?? ''))
                      ? k.copayLabel
                      : `${k.copayLabel} · ${
                          k.copayRate === 0 ? '면제' : `${Math.round(k.copayRate * 100)}%`}`
                  })</span>
                </dd>
              </>
            )}
            {k.kind !== 'copay' && (
              <><dt>지자체 청구</dt><dd className="mono"><b>{won(k.claim)}원</b></dd></>
            )}
            {k.issuedOn && <><dt>확정일</dt><dd className="mono">{k.issuedOn}</dd></>}
            {k.paidOn && <>
              <dt>수납일</dt>
              <dd className="mono">{k.paidOn} <span className="muted">({k.receiptNo})</span></dd>
            </>}
          </dl>
          {k.kind !== 'claim' && (
            <p className="note small" style={{ marginBottom: 0 }}>
              본인부담금은 <b>총액에 한 번</b> {rounding?.unit}원 단위{' '}
              {{ round: '반올림', ceil: '올림', floor: '절삭' }[rounding?.mode as string]}합니다.
              줄마다 자르고 더하면 합계가 어긋납니다.
            </p>
          )}
        </div>

        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
          <div className="btns" style={{ justifyContent: 'flex-end' }}>
            {/* 안 끝난 기간은 확정 단추 자체를 안 내놓습니다.
                눌러 봐야 「아직 안 끝났습니다」로 막히기만 합니다. */}
            {k.state === '쌓이는중' ? null
             : k.state === '미확정' || k.stale || k.priceDrift ? (
              <button className={k.priceDrift && !k.stale ? undefined : 'primary'}
                      disabled={busy}
                      onClick={() => run(() =>
                        api.issueBill({ recipientId: x.id, month, kind: k.kind }))}>
                {k.state === '미확정' ? '확정' : '다시 확정'}
              </button>
            ) : null}
            {k.state === '확정' && (
              <>
                <button disabled={busy}
                        onClick={() => run(() => api.payBill(k.billId))}>수납 처리</button>
                <button className="plain" disabled={busy}
                        onClick={() => run(() => api.cancelBill(k.billId))}>확정 취소</button>
              </>
            )}
            {k.state === '수납' && (
              <button className="plain" disabled={busy}
                      onClick={() => run(() => api.payBill(k.billId, true))}>수납 취소</button>
            )}
            {/* 청구서는 어르신께 드리는 종이입니다. 지자체 몫에는 붙이지 않습니다. */}
            {k.kind !== 'claim' && (
              <a className="btn-like" href={`/api/invoice/${x.id}/file?month=${month}`}
                 download={`${month}_본인부담금청구서_${x.name}.pdf`}>
                청구서 (PDF)
              </a>
            )}
            {/*
              ── 본인부담금 영수증 = **편람 서식7** (B-1) ─────────────
              **수납이 끝난 뒤에** 드리는 종이입니다 — 「수령하였습니다」라고
              적힌 서식이라 돈을 받기 전에 뽑으면 거짓말이 됩니다.
              지자체 몫에는 붙이지 않습니다. 본인부담금이 0원(면제)이면
              영수증을 낼 것이 없습니다.
            */}
            {k.kind !== 'claim' && k.state === '수납' && Number(k.copay) > 0 && (
              <a className="btn-like" href={`/api/receipt/${k.billId}/file`}
                 title="편람 서식7 원본을 채운 한글 파일입니다. 서명·도장 자리는 비어 있습니다.">
                영수증 (서식7)
              </a>
            )}
            {/*
              ── 개인별 서비스 비용총괄 = **편람 서식8** (B-3) ─────────
              한 달치 실적을 한 줄씩 적어 **군에** 내는 종이입니다.
              영수증이 「얼마를 받았다」라면 이것은 「무엇을 얼마나 했다」라
              **확정한 뒤**에 뽑습니다(그 전에는 금액이 흔들립니다).
              **지자체 몫 청구에만** 붙입니다 — 군에 내는 서류니까요.
              전액 자부담인 분은 서식 머리의 「※ <서비스비용 지원대상자>만
              작성 및 제출」에 걸려 서버가 그 자리에서 알려 줍니다.
            */}
            {k.kind !== 'copay' && k.state !== '미확정' && k.state !== '쌓이는중' && (
              <a className="btn-like" href={`/api/billing/${k.billId}/summary-hwpx`}
                 title="편람 서식8 원본을 채운 한글 파일입니다. 실적이 다섯 줄을 넘으면 칸이 늘어납니다.">
                비용총괄 (서식8)
              </a>
            )}
            {한장 && <a className="btn-like" {...linkProps(`/recipients/${x.id}`)}>대상자 화면</a>}
          </div>
          {k.state === '쌓이는중' && (
            <p className="note small" style={{ marginTop: 10, marginBottom: 0 }}>
              <b>아직 청구 기간이 안 끝났습니다</b>({k.periodTo}까지).
              지금까지 쌓인 금액만 보여 드립니다. <b>끝나는 달에 통째로 확정</b>하시면
              그동안 것이 한 장으로 나옵니다.
            </p>
          )}
          {k.state !== '미확정' && k.state !== '쌓이는중' && (
            <p className="note small" style={{ marginTop: 10, marginBottom: 0 }}>
              확정한 금액은 <b>얼어 있습니다.</b> 나중에 단가가 올라도 이 달 청구서는
              그대로 나옵니다.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/** 한 사람 펼치기 — 몫마다 한 덩어리씩. */
function Detail({ x, month, rounding, cols, onDone }: {
  x: any; month: string; rounding: any; cols: number; onDone: () => void
}) {
  return (
    <tr className="detail">
      <td colSpan={cols} style={{ padding: '14px 22px 18px', background: 'var(--surface-2)' }}>
        {!x.한장인가 && (
          <p className="note small" style={{ marginTop: 0 }}>
            이 기관은 <b>지자체 청구와 본인부담금의 청구 시점이 다릅니다.</b>{' '}
            묶는 기간이 서로 달라 <b>청구서가 둘로 나뉩니다.</b> 각각 따로 확정하시면 됩니다.
          </p>
        )}
        {x.몫들.map((k: any) => (
          <몫판 key={k.kind} x={x} k={k} month={month} rounding={rounding} onDone={onDone} />
        ))}
        {!x.한장인가 && (
          <div className="btns" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <a className="btn-like" {...linkProps(`/recipients/${x.id}`)}>대상자 화면</a>
          </div>
        )}
      </td>
    </tr>
  )
}

export default function Billing() {
  const [month, setMonth] = useState(thisMonth)
  const [d, setD] = useState<any>(null)
  const [q, setQ] = useState('')
  const [dong, setDong] = useState('')
  const [state, setState] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setD(await api.billing(month, { q, dong, state }))
  }, [month, q, dong, state])

  useEffect(() => {
    const t = setTimeout(() => load().catch((e) => setMsg(e.message)), 180)
    return () => clearTimeout(t)
  }, [load])

  if (!d) return <p className="muted">불러오는 중…</p>

  async function issueAll() {
    if (!confirm(
      `${month} 의 아직 확정하지 않은 것을 모두 확정합니다.\n\n` +
      `· 이미 수납한 것은 건드리지 않습니다\n` +
      `· 계산에 쓴 단가와 부담률이 그대로 얼어붙습니다\n\n` +
      `실적 입력이 끝난 뒤에 누르세요.\n\n계속할까요?`
    )) return
    setBusy(true); setMsg('')
    try {
      const r = await api.issueBill({ month, all: true })
      setMsg(`${r.done}건을 확정했습니다.${r.skipped ? ` (${r.skipped}건은 건너뜀)` : ''}`)
      await load()
    } catch (e: any) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  const t = d.tally

  return (
    <>
      <인쇄단추 무엇="본인부담금 청구 대장" 수={d?.items?.length}
                덧말={`${month.split('-')[0]}년 ${Number(month.split('-')[1])}월분`}
                조건={[
                  state ? `상태 ${state}` : '상태 전체',
                  dong && `행정동 ${dong}`,
                  q && `찾기 「${q}」`,
                ]} />

      <div className="main-head">
        <h1>정산</h1>
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
          {/* 단가만 바뀐 것은 여기 안 셉니다. 한꺼번에 다시 확정하면
              지난 청구 금액이 통째로 바뀌어 버립니다. 그건 한 건씩 판단할 일입니다. */}
          <button className="primary" disabled={busy || t.미확정 + t.stale === 0}
                  onClick={issueAll}>
            한꺼번에 확정 ({t.미확정 + t.stale})
          </button>
          {/* zip 이 아니라 PDF 한 파일입니다 — 인쇄를 한 번에 걸 수 있습니다. */}
          {d.items.length > 0 && (
            <a className="btn-like" href={`/api/invoice/all?month=${month}`}
               download={`${month}_본인부담금청구서_${d.items.length}명.pdf`}>
              청구서 한꺼번에 ({d.items.length}명 · PDF)
            </a>
          )}
        </div>
      </div>

      {msg && <div className="msg ok">{msg}</div>}

      {t.stale > 0 && (
        <div className="msg err">
          확정한 뒤에 <b>실적이 바뀐 것</b>이 {t.stale}건 있습니다.
          그대로 두면 <b>청구서 금액과 실제 실적이 어긋납니다.</b> 다시 확정해 주세요.
        </div>
      )}
      {t.priceDrift > 0 && (
        <div className="card warn">
          <h2 style={{ fontSize: '.86rem' }}>단가나 부담률이 바뀐 것이 {t.priceDrift}건 있습니다</h2>
          <p className="note small" style={{ marginBottom: 0 }}>
            실적은 그대로입니다. <b>대개는 그냥 두는 것이 맞습니다</b> —
            그때 금액으로 청구했으니까요. 다시 확정하면 금액이 바뀌므로,
            지자체와 이야기가 된 경우에만 다시 확정하세요.
          </p>
        </div>
      )}
      {t.over > 0 && (
        <div className="msg err">
          생애한도를 넘긴 대상자가 <b>{t.over}명</b> 있습니다. 확정 전에 확인해 주세요.
        </div>
      )}
      {/*
        「쌓이는 중」은 잘못된 것이 아닙니다 — **아직 때가 안 된 것**입니다.
        그런데 아무 말이 없으면 「왜 확정이 안 되지」 하고 헤매게 됩니다.
      */}
      {t.쌓이는중 > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '.86rem' }}>
            아직 청구 기간이 안 끝난 것이 {t.쌓이는중}건 있습니다
          </h2>
          <p className="note small" style={{ marginBottom: 0 }}>
            이 기관은 <b>{시점말(d.profile?.claim_timing)}</b> 청구합니다.
            기간 중간에 확정해 버리면 <b>남은 날 실적이 갈 곳을 잃습니다.</b>{' '}
            지금까지 쌓인 금액만 보여 드리고, <b>끝나는 달에 통째로</b> 확정합니다.
          </p>
        </div>
      )}
      {!d.한장인가 && (
        <div className="card">
          <h2 style={{ fontSize: '.86rem' }}>청구서가 둘로 나뉩니다</h2>
          <p className="note small" style={{ marginBottom: 0 }}>
            지자체 청구는 <b>{시점말(d.profile?.claim_timing)}</b>,
            본인부담금은 <b>{시점말(d.profile?.copay_timing)}</b> 받도록 정해 두셨습니다.{' '}
            <b>묶는 기간이 서로 다르므로</b> 한 장에 담으면 그 종이가 거짓말이 됩니다.
            그래서 사람마다 줄이 둘이고, <b>각각 따로 확정</b>합니다.
            바꾸시려면 <b>설정 · 계산 규칙</b>에서 청구 시점을 고치시면 됩니다.
          </p>
        </div>
      )}

      <div className="row tight" style={{ alignItems: 'stretch' }}>
        {[
          { label: '대상자', v: `${t.people}명` },
          // 몫이 갈리면 두 기간의 서비스 비용을 그냥 더할 수 없습니다.
          // 그때 뜻이 있는 숫자는 **이 달에 받을 돈**입니다.
          { label: d.한장인가 ? '서비스 비용' : '청구 합계', v: `${won(t.total)}원` },
          { label: '본인부담', v: `${won(t.copay)}원` },
          { label: '지자체 청구', v: `${won(t.claim)}원`, big: true },
        ].map((x) => (
          <div key={x.label} className="card"
               style={{ margin: 0, textAlign: 'center', padding: '14px 10px' }}>
            <div className="muted small">{x.label}</div>
            <div className="mono" style={{ fontSize: x.big ? '1.4rem' : '1.15rem', fontWeight: 700 }}>
              {x.v}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ paddingBottom: 14 }}>
        <div className="row tight" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 2, marginBottom: 0 }}>
            <label htmlFor="b-q">찾기</label>
            <input id="b-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="대상자" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="b-state">상태</label>
            <select id="b-state" value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">전체 ({t.people}명)</option>
              {/* 여기 숫자는 **사람 수**입니다. 고르면 사람이 걸러지니까요. */}
              {STATES.map((s) => (
                <option key={s} value={s}>{s} ({t.상태사람?.[s] ?? 0}명)</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="b-dong">읍면동</label>
            <select id="b-dong" value={dong} onChange={(e) => setDong(e.target.value)}>
              <option value="">전체</option>
              {d.dongs.map((x: string) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        </div>
        <p className="note small" style={{ marginBottom: 0, marginTop: 12 }}>
          적용 규칙 <b>{d.profile?.name}</b> · 본인부담금은 {d.rounding?.unit}원 단위{' '}
          {{ round: '반올림', ceil: '올림', floor: '절삭' }[d.rounding?.mode as string]} ·
          휴일 할증 {d.profile?.holiday_enabled ? `사용 (×${d.profile.holiday_surcharge})` : '사용 안 함'}
        </p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'right' }}>연번</th>
                <th>대상자</th>
                {/* 시점이 갈린 기관에서만. 안 갈렸으면 있으나 마나 한 열입니다. */}
                {!d.한장인가 && <th>청구 구분</th>}
                <th>서비스</th>
                <th className="right">횟수</th>
                <th className="right">서비스 비용</th>
                <th>본인부담</th>
                <th className="right">본인부담금</th>
                <th className="right">지자체 청구</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {/*
                줄은 **몫 단위**입니다. 시점이 같으면 한 사람에 한 줄로
                지금까지와 똑같고, 갈리면 두 줄이 됩니다 — 기간도 상태도
                따로 노는 것을 한 줄에 욱여넣으면 어느 쪽 이야기인지 알 수 없습니다.
              */}
              {d.items.map((x: any, i: number) => (
                <Fragment key={x.id}>
                  {x.몫들.map((k: any, ki: number) => (
                    <tr key={k.kind} className="clickable"
                        data-rid={x.id} data-kind={k.kind}
                        onClick={() => setOpen(open === x.id ? null : x.id)}>
                      {ki === 0 && (
                        <td className="mono small muted" rowSpan={x.몫들.length}
                            style={{ textAlign: 'right' }}>{i + 1}</td>
                      )}
                      {ki === 0 && (
                        <td rowSpan={x.몫들.length}>
                          <span className="name">{x.name}</span>
                          {x.dong && <div className="muted small">{x.dong}</div>}
                        </td>
                      )}
                      {!d.한장인가 && (
                        <td className="small">
                          <b>{k.몫이름}</b>
                          <div className="muted small">
                            {짧게(k.periodFrom)} ~ {짧게(k.periodTo)}
                            {k.회차 > 1 && ` · ${k.회차}회차`}
                          </div>
                        </td>
                      )}
                      <td className="small">
                        {k.lines.map((l: any) => l.service).join(' · ')}
                        {k.over && <div className="deadline small">생애한도 넘음</div>}
                      </td>
                      <td className="right mono">{k.count}</td>
                      <td className="right mono">{won(k.total)}</td>
                      <td className="small">
                        {k.kind === 'claim' ? <span className="muted">—</span>
                         : k.copayRate === 0 ? '면제'
                         : `${Math.round(k.copayRate * 100)}%`}
                      </td>
                      <td className="right mono">
                        {k.kind === 'claim' ? <span className="muted">—</span> : won(k.copay)}
                      </td>
                      <td className="right mono">
                        {k.kind === 'copay' ? <span className="muted">—</span>
                         : <b>{won(k.claim)}</b>}
                      </td>
                      <td>
                        <span className={`tag ${상태색[k.state] ?? '종결'}`}>{k.state}</span>
                        {k.stale && <div className="deadline small">실적 바뀜</div>}
                        {k.priceDrift && !k.stale && (
                          <div className="muted small">단가 바뀜</div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {open === x.id && (
                    <Detail x={x} month={month} rounding={d.rounding}
                            cols={d.한장인가 ? 9 : 10} onDone={load} />
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {d.items.length === 0 && (
          <div className="empty">
            이 달에 정산할 실적이 없습니다.<br />
            <span className="small">
              「제공실적」에서 다녀온 날을 먼저 적어 주세요. 제공한 것만 돈이 됩니다.
            </span>
          </div>
        )}
      </div>
    </>
  )
}
