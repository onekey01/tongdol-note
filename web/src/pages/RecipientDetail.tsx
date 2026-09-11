import { useEffect, useState, useCallback, Fragment } from 'react'
import 인쇄단추 from '../components/인쇄단추'
import { api, type Recipient, type StatusChange } from '../lib/api'
import { navigate, linkProps } from '../lib/router'
import RecipientForm, { twoGuardians, type RecipientDraft, type Tier } from '../components/RecipientForm'
import AssignBox from '../components/AssignBox'
import Deadline from '../components/Deadline'

const STATUS_HELP: Record<string, string> = {
  이용: '서비스를 받고 있는 상태입니다.',
  중단: '일시적으로 멈춘 상태입니다. 90일이 지나면 종결 검토 대상이 됩니다.',
  종결: '서비스가 끝난 상태입니다. 기록은 5년간 보관합니다.',
  취소: '연계는 되었으나 시작 전에 취소된 경우입니다.',
  직권중단: '기관·지자체 판단으로 중단한 경우입니다.',
}

type Svc = {
  id: number; name: string; code: string; unit: string
  from: string | null; to: string | null; months: number | null
  cycle: string; cycleUnit: string | null; cycleCount: number | null
  note: string; batch: string; referralId?: number
  worker: string; workerPhone: string; slotText: string
  workerEnded: boolean; workerUntil: string | null
  lifetimeCap: number | null; ended: boolean; daysLeft: number | null
  /** 중단한 날. 이 값이 있으면 「끝남」이 아니라 「중단」입니다. */
  cancelledAt?: string | null
  cancelReason?: string | null
}

/**
 * 받는 서비스를 **손으로** 하나 넣기.
 *
 * 지금까지 서비스는 지자체 엑셀로만 들어왔습니다. 그래서 직접 추가한 대상자는
 * 배정도 실적도 기록지도 할 수가 없었습니다. 엑셀을 아직 못 받은 달에도
 * 같은 일이 생깁니다 — 사람은 이미 오고 있는데 프로그램은 모릅니다.
 *
 * 넣는 자리는 여기 하나뿐이고, **저장하면 엑셀로 들어온 것과 똑같이** 배정·실적·
 * 정산·기록지가 그대로 돕니다. 어디서 왔는지는 「들어온 차수」 칸에 남습니다.
 */
function AddServiceBox({
  recipientId, 고칠것, onClose, onSaved,
}: {
  recipientId: string
  /** 넣기면 null, 고치기면 그 줄. **같은 상자를 둘 다에 씁니다.** */
  고칠것?: Svc | null
  onClose: () => void
  onSaved: () => void
}) {
  const 고치는중 = !!고칠것
  const [catalog, setCatalog] = useState<any[] | null>(null)
  const [serviceId, setServiceId] = useState(고칠것 ? String(고칠것.id) : '')
  const [from, setFrom] = useState(고칠것?.from ?? '')
  const [to, setTo] = useState(고칠것?.to ?? '')
  const [unit, setUnit] = useState<'week' | 'month' | 'lifetime'>(
    (고칠것?.cycleUnit as any) ?? 'week')
  const [count, setCount] = useState(String(고칠것?.cycleCount ?? 2))
  const [note, setNote] = useState(고칠것?.note ?? '')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    api.serviceCatalog()
      .then((r) => { if (live) setCatalog(r.services ?? []) })
      .catch((e) => { if (live) { setCatalog([]); setMsg(String(e.message ?? e)) } })
    return () => { live = false }
  }, [])

  // 주기 글은 서버가 짓습니다. 여기서는 **같은 글을 미리 보여만** 줍니다.
  const 주기글 = unit === 'week' ? `주 ${count || 1}회`
               : unit === 'month' ? `월 ${count || 1}회`
               : `생애 ${count || 1}회`

  async function save() {
    if (!serviceId) return setMsg('서비스를 골라 주세요.')
    if (!from) return setMsg('시작일을 넣어 주세요.')
    setBusy(true); setMsg('')
    const 몸 = {
      serviceId: Number(serviceId), from, to: to || null,
      cycleUnit: unit, cycleCount: Number(count) || 1, note,
    }
    try {
      if (고치는중) await api.editReferral(고칠것!.referralId!, 몸)
      else await api.addRecipientService(recipientId, 몸)
      onSaved()
    } catch (e: any) {
      setMsg(String(e.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dlg-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="dlg" role="dialog"
           aria-label={고치는중 ? '받는 서비스 고치기' : '받는 서비스 넣기'}>
        <div className="dlg-head">
          <h2 style={{ margin: 0 }}>받는 서비스 {고치는중 ? '고치기' : '넣기'}</h2>
        </div>

        {msg && <div className="msg err">{msg}</div>}

        {고치는중 && (
          <p className="note small" style={{ marginTop: 0 }}>
            <b>기간·주기·비고는 제공실적이 있어도 고칠 수 있습니다.</b>
            고쳐도 이미 찍힌 실적은 사라지지 않고, 정산이 다시 셉니다.
            <br />
            다만 <b>서비스 종류</b>는 실적이 하나라도 있으면 못 바꿉니다 —
            이미 찍힌 실적이 엉뚱한 서비스에 붙기 때문입니다.
          </p>
        )}

        <div className="field">
          <label htmlFor="ns-service">서비스</label>
          {catalog === null
            ? <p className="muted small" style={{ margin: 0 }}>불러오는 중…</p>
            : (
              <select id="ns-service" value={serviceId}
                      onChange={(e) => setServiceId(e.target.value)}>
                <option value="">— 고르세요 —</option>
                {catalog.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.unit_price ? ` (${v.unit_price.toLocaleString('ko-KR')}원)` : ''}
                  </option>
                ))}
              </select>
            )}
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="ns-from">시작일</label>
            <input id="ns-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ns-to">
              끝나는 날
              <span className="muted small" style={{ fontWeight: 400, marginLeft: 6 }}>
                모르면 비워 두세요
              </span>
            </label>
            <input id="ns-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {/*
          주기는 **요일로 펼 수 있는 것과 없는 것**이 갈립니다.
          「주 2회」는 요일을 고를 수 있고, 「월 2회」·「생애 1회」는 그 달 어느
          날에 갈지 그때 정하는 일이라 요일로 못박으면 거짓말이 됩니다.
        */}
        <div className="row">
          <div className="field">
            <label htmlFor="ns-unit">주기</label>
            <select id="ns-unit" value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}>
              <option value="week">주 단위</option>
              <option value="month">월 단위</option>
              <option value="lifetime">생애 (한 번뿐)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="ns-count">횟수</label>
            <input id="ns-count" type="number" min={1} max={99} value={count}
                   onChange={(e) => setCount(e.target.value)} />
          </div>
        </div>
        <p className="note small" style={{ marginTop: -4 }}>
          이렇게 적힙니다 — <b>{주기글}</b>
          {unit !== 'week' && ' · 요일은 고르지 않고 실적에서 날짜를 고릅니다'}
        </p>

        <div className="field">
          <label htmlFor="ns-note">비고</label>
          <input id="ns-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="btns" style={{ marginTop: 12 }}>
          <button className="primary" disabled={busy} onClick={save}>
            {busy ? (고치는중 ? '고치는 중…' : '넣는 중…') : (고치는중 ? '고치기' : '넣기')}
          </button>
          <div className="spacer" />
          <button className="plain" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}

/**
 * 받는 서비스.
 *
 * 서비스마다 기간·주기가 따로입니다. 한 사람이 셋을 받는 중에 하나만
 * 먼저 끝나는 일이 흔해서, 끝난 것만 회색에 줄을 긋습니다.
 * 대상자 상태는 그대로 「이용」입니다 — 나머지를 아직 받고 있으니까요.
 */
function ServiceTable({
  list, recipientId, onChanged,
}: { list: Svc[]; recipientId: string; onChanged: () => void }) {
  // 여기서 담당을 붙여도 배정 화면·종사자 화면에 그대로 나타납니다.
  // 같은 부품(AssignBox)이 같은 자료에 쓰기 때문입니다.
  const [open, setOpen] = useState<number | null>(null)
  const [고칠것, 고칠것정하기] = useState<Svc | null>(null)

  const 고치기 = (v: Svc) => 고칠것정하기(v)

  /*
   * 의뢰 중단. 지자체 의뢰는 지울 수 없지만 **안 하게 된 것은 표시**해야 합니다.
   * 「신청은 했는데 자부담이 부담되어 취소」가 현장에서 자주 나옵니다.
   */
  async function 중단하기(referralId: number, 이름: string) {
    const 사유 = prompt(
      `「${이름}」을 중단합니다.\n\n` +
      `왜 안 하게 되었는지 적어 주세요.\n` +
      `나중에 군이 「이건 왜 안 했느냐」고 물으면 이 줄이 답이 됩니다.\n\n` +
      `예) 자부담 부담으로 본인 취소`, '')
    if (사유 === null) return
    if (!사유.trim()) return alert('사유를 적어 주세요.')
    try {
      await api.cancelReferral(referralId, 사유.trim())
      onChanged()
    } catch (e: any) { alert(String(e.message ?? e)) }
  }

  async function 되돌리기(referralId: number, 이름: string) {
    if (!confirm(`「${이름}」 중단을 되돌릴까요?\n기간이 중단 전으로 돌아갑니다.`)) return
    try {
      await api.uncancelReferral(referralId)
      onChanged()
    } catch (e: any) { alert(String(e.message ?? e)) }
  }

  async function 지우기(referralId: number, 이름: string, 차수: string) {
    /*
     * 지자체 의뢰를 지우면 「무엇이 왔었는지」가 사라집니다 —
     * 엑셀 원본은 따로 안 남고 이 줄이 유일한 기록입니다.
     * 그래서 지우기 전에 그 사실을 보여 주고, 안 하게 된 것뿐이면
     * 「중단」을 권합니다. 그래도 지우겠다면 지웁니다 — 잘못 들어온 줄을
     * 치울 길이 없으면 화면이 계속 틀린 채로 남습니다.
     */
    const 의뢰 = 차수 !== '손입력'
    const 말 = 의뢰
      ? `「${이름}」을 아주 지울까요?\n\n` +
        `이건 지자체 의뢰(${차수})로 들어온 줄입니다.\n` +
        `지우면 「무엇이 왔었는지」가 사라집니다 — 엑셀 원본은 따로 남지 않습니다.\n\n` +
        `· 잘못 들어온 줄이면 → 지우기\n` +
        `· 신청했다가 안 하게 된 것이면 → 「중단」이 낫습니다`
      : `「${이름}」을 이 대상자의 받는 서비스에서 지울까요?`
    if (!confirm(말)) return
    try {
      await api.removeReferral(referralId)
      onChanged()
    } catch (e: any) {
      alert(String(e.message ?? e))
    }
  }

  if (!list.length) {
    return (
      <p className="note" style={{ margin: 0 }}>
        아직 받는 서비스가 없습니다. 「의뢰 접수」에서 지자체 명단을 올리면 여기에 채워지고,
        위의 <b>「서비스 넣기」</b>로 하나씩 넣으셔도 됩니다.
      </p>
    )
  }
  return (
    <>
    {open !== null && (
      <AssignBox recipientId={recipientId} serviceId={open} showWeek={false}
                 onClose={() => setOpen(null)}
                 onSaved={() => { setOpen(null); onChanged() }} />
    )}
    {고칠것 && (
      <AddServiceBox recipientId={recipientId} 고칠것={고칠것}
                     onClose={() => 고칠것정하기(null)}
                     onSaved={() => { 고칠것정하기(null); onChanged() }} />
    )}
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>서비스</th><th>담당 · 가는 요일</th><th>기간</th><th>주기</th>
            <th>남은 기간</th><th>비고</th><th>들어온 차수</th>
          </tr>
        </thead>
        <tbody>
          {list.map((v, i) => (
            <tr key={i} style={(v.ended || v.cancelledAt) ? { opacity: .55 } : undefined}>
              <td>
                <span className={`svc${v.ended ? ' done' : ''}`}>{v.name}</span>
                {v.lifetimeCap ? (
                  <div className="muted small">생애한도 {v.lifetimeCap.toLocaleString('ko-KR')}원</div>
                ) : null}
              </td>
              {/* 서비스마다 담당이 다릅니다. 식사지원은 관리자가, 이미용은 제공인력이 하는 식. */}
              <td className="small">
                {v.worker
                  ? <>
                      <span className={v.workerEnded ? 'muted' : 'name'}>{v.worker}</span>
                      <div className="muted small">
                        {v.workerEnded
                          ? `${v.workerUntil} 까지 (지난 담당)`
                          : v.slotText || '요일 없음'}
                      </div>
                    </>
                  : <span className="muted">배정 없음</span>}
                <div>
                  <button className="plain small" style={{ padding: '2px 0' }}
                          onClick={() => setOpen(v.id)}>
                    {v.worker ? '담당 바꾸기' : '담당 붙이기'}
                  </button>
                </div>
              </td>
              <td className="mono small">
                {v.from ?? '—'} ~ {v.to ?? '—'}
                {v.months ? <span className="muted"> ({v.months}개월)</span> : null}
              </td>
              <td className="small">{v.cycle || '—'}</td>
              <td className="small">
                {/* 기간이 다 된 것과 안 하기로 한 것은 뜻이 다릅니다. */}
                {v.cancelledAt
                  ? <>
                      <span className="svc done">중단</span>
                      <div className="muted small">{v.cancelledAt}</div>
                    </>
                  : v.ended
                  ? <span className="muted">끝남</span>
                  : v.daysLeft === null
                  ? '—'
                  : <span className={v.daysLeft <= 14 ? 'deadline' : undefined}>{v.daysLeft}일</span>}
              </td>
              <td className="small">
                {v.cancelReason
                  ? <><b>중단</b> — {v.cancelReason}
                      {v.note ? <div className="muted small">{v.note}</div> : null}</>
                  : (v.note || '—')}
              </td>
              <td className="small muted">
                {v.batch}
                {/*
                  손으로 넣은 것만 지울 수 있습니다. 지자체 의뢰는 무엇이 왔었는지가
                  근거라 지우면 안 됩니다 — 서버도 같이 막습니다.
                */}
                {v.referralId ? (
                  <div className="row tight">
                    {/*
                      고치기·지우기는 손으로 넣은 것만 됩니다 — 지자체가 보낸
                      기록은 근거라 우리가 바꾸면 안 됩니다(서버도 막습니다).
                      하지만 **중단**은 어느 쪽이든 됩니다. 안 하게 된 사실은
                      의뢰가 어디서 왔든 적을 수 있어야 합니다.
                    */}
                    {v.batch === '손입력' && (
                      <button className="plain small" style={{ padding: '2px 0' }}
                              onClick={() => 고치기(v)}>고치기</button>
                    )}
                    {v.cancelledAt
                      ? <button className="plain small" style={{ padding: '2px 0' }}
                                onClick={() => 되돌리기(v.referralId!, v.name)}>중단 되돌리기</button>
                      : <button className="plain small danger" style={{ padding: '2px 0' }}
                                onClick={() => 중단하기(v.referralId!, v.name)}>중단</button>}
                    {/*
                      지우기는 **어느 줄에서든** 됩니다 — 잘못 들어온 줄을
                      치울 길이 없으면 화면이 계속 틀린 채로 남습니다.
                      다만 실적이 찍혔으면 서버가 막고, 지자체 의뢰를 지울 때는
                      무엇이 사라지는지 먼저 알려 줍니다.
                    */}
                    <button className="plain small danger" style={{ padding: '2px 0' }}
                            onClick={() => 지우기(v.referralId!, v.name, v.batch)}>지우기</button>
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  )
}

/**
 * 식사지원 대면 수령 세기.
 *
 * 계약서 5-2조에 「3회 연속 대면 수령하지 않으면 통합돌봄 서비스가 중지된다」고
 * 되어 있습니다. 누적이 아니라 연속이라 손으로는 세기 어렵고 놓치기 쉽습니다.
 * **식사지원을 받는 분에게만** 보여줍니다.
 */
function NoShowCard({ r, onDone }: { r: any; onDone: (m: any) => void }) {
  const [busy, setBusy] = useState(false)
  /*
   * ── 손으로 세는 칸이 아닙니다 (2026-09-01 바로잡음) ────────
   *
   * 전에는 여기 「미수령 기록」 단추로 숫자를 직접 올렸습니다. 둘이 틀렸습니다 —
   *   ① 세던 것이 **미제공 연속**이었습니다. 편람이 세는 것은
   *      **비대면 배달 연속**입니다. 안 간 것과 놓고 온 것은 다른 일입니다.
   *   ② 손으로 올린 숫자를 다음 식사 실적이 **말없이 덮어썼습니다.**
   *
   * 이제 숫자는 **제공실적에서만** 나옵니다. 여기 단추는 다시 세기뿐입니다.
   */
  async function 다시세기() {
    setBusy(true)
    try { onDone(await api.noShow(r.id, false)) } finally { setBusy(false) }
  }
  // ★ 판단은 **설정한 방식**으로 합니다 (v33). 화면에는 둘 다 보입니다.
  const 방식 = (r as any).비대면방식 ?? '연속'
  const 볼값 = Number((r as any).비대면볼값 ?? r.noShowStreak)
  const reached = r.noShowReached ?? (볼값 >= r.noShowLimit)
  return (
    <div className={reached ? 'card bad' : r.noShowWarn ? 'card warn' : 'card'}>
      <h2>식사지원 대면 배달</h2>
      <dl className="facts">
        <dt>연속 비대면{방식 === '연속' ? ' ← 이 기관 기준' : ''}</dt>
        <dd>
          <b>{r.noShowStreak}회</b>{방식 === '연속' ? ` / ${r.noShowLimit}회` : ''}
        </dd>
        {/*
          편람과 계약서는 둘 다 **「3회 연속」**이고, 2026-09-08 에 군 답을
          받았습니다 — **연속이 맞습니다.** 다만 다른 지자체가 누적으로 읽을
          수 있어 **설정에서 고르게** 두었습니다(설정 → 우리 지자체 규칙).
          어느 쪽을 고르든 **둘 다 보입니다** — 어르신 서비스가 끝나는
          기준이라 한쪽을 숨기면 안 됩니다. 「← 이 기관 기준」이 붙은 줄이
          지금 판단에 쓰이는 값입니다.
        */}
        <dt>{r.비대면해 ?? ''}년 누적{방식 === '누적' ? ' ← 이 기관 기준' : ''}</dt>
        <dd>
          <b>{r.비대면누적 ?? 0}회</b>{방식 === '누적' ? ` / ${r.noShowLimit}회` : ''}
        </dd>
        <dt>마지막 비대면</dt><dd>{r.lastNoShowOn || '—'}</dd>
      </dl>
      <p className="note small" style={{ marginTop: 10 }}>
        {reached
          ? '계약서 5-2조에 따라 통합돌봄 서비스 전체가 중지 대상입니다. 지자체와 협의하세요.'
          : r.noShowWarn
          ? '한 번 더 비대면이면 서비스 전체가 중지됩니다. 지금 연락하세요.'
          : '3회 연속 비대면 배달이면 식사지원을 포함한 전체 서비스가 중지됩니다.'}
      </p>
      <p className="note small">
        <b>이 숫자는 제공실적에서 저절로 셉니다.</b> 여기서 올리고 내리지 않습니다 —
        놓고 온 배달은 <b>제공실적</b> 달력에서 식사지원 칸을 눌러
        <b>◎ 비대면</b>까지 돌려 주세요(○ 계획 → ● 대면 → ◎ 비대면 → ✕ 미제공).
        비대면이어도 <b>비용은 그대로 나갑니다</b> — 음식이 이미 만들어졌습니다.
      </p>
      <p className="note small">
        <b>「연속」과 「누적」을 둘 다 보여 드립니다.</b> 편람과 계약서 5-2조는
        <b>「3회 연속」</b>이라고 적혀 있는데 현장에서는 누적으로 읽기도 합니다.
        <b>어르신 서비스가 끝나는 기준</b>이라 한쪽만 보여 드리지 않습니다 —
        군에 확인되면 그때 하나로 정리합니다.
      </p>
      <div className="btns">
        <button className="plain" disabled={busy} onClick={다시세기}>다시 세기</button>
      </div>
    </div>
  )
}

function toDraft(r: Recipient): RecipientDraft {
  return {
    name: r.name, birth: r.birth, gender: r.gender,
    phone: r.phone, phoneHome: r.phoneHome,
    /* 고칠 때는 도로명과 상세를 **따로** 받습니다. 합쳐진 것은 도로 가를 수 없습니다. */
    address: r.addressRoad ?? r.address ?? '', addressDetail: r.addressDetail ?? '',
    dong: r.dong, copayTierId: r.copayTierId,
    guardians: twoGuardians(r.guardians),
    cctv: r.cctv, pet: r.pet, caution: r.caution,
    selfSign: r.selfSign, memo: r.memo,
  }
}

export default function RecipientDetail({ id }: { id: string }) {
  const [r, setR] = useState<any>(null)
  const [services, setServices] = useState<Svc[]>([])
  const [history, setHistory] = useState<StatusChange[]>([])
  const [changes, setChanges] = useState<any[]>([])
  const [한도, set한도] = useState<any>(null)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [statuses, setStatuses] = useState<string[]>([])

  const [서비스넣는중, 서비스넣기] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<RecipientDraft | null>(null)
  /*
    고치기를 시작할 때의 모습을 그대로 들고 있습니다.
    **저절로 저장되지 않는다**는 것을 화면이 말해 주려면, 「고친 것이 있는지」를
    알아야 합니다. 안 그러면 사람은 적어 놓고 그냥 나가 버립니다.
  */
  const [고치기전, 고치기전으로] = useState('')
  const 고친것있나 = editing && !!draft && JSON.stringify(draft) !== 고치기전
  const [취소확인, 취소확인으로] = useState(false)

  function 고치기시작(x: any) {
    const d = toDraft(x)
    setDraft(d); 고치기전으로(JSON.stringify(d))
    취소확인으로(false); setEditing(true)
  }
  function 고치기그만() {
    // 고친 것이 있으면 한 번 더 묻습니다. 무서운 경고창 대신 단추가 바뀝니다.
    if (고친것있나 && !취소확인) { 취소확인으로(true); return }
    setEditing(false); 취소확인으로(false)
  }

  const [toStatus, setToStatus] = useState('')
  const [changedOn, setChangedOn] = useState('')
  const [reason, setReason] = useState('')

  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const d = await api.recipient(id)
    setR(d.recipient); setServices(d.services ?? [])
    setHistory(d.history); setChanges(d.changes ?? []); set한도(d.한도 ?? null)
    setToStatus(d.recipient.status)
  }, [id])

  useEffect(() => {
    load().catch((e) => setMsg({ kind: 'err', text: e.message }))
    api.settings().then((s) => setTiers(s.tiers ?? [])).catch(() => {})
    api.recipients().then((x) => setStatuses(x.statuses)).catch(() => {})
    setChangedOn(new Date().toISOString().slice(0, 10))
  }, [load])

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    setBusy(true)
    try {
      await api.updateRecipient(id, draft)
      setEditing(false); 취소확인으로(false); await load()
      setMsg({ kind: 'ok', text: '저장했습니다.' })
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) }
    finally { setBusy(false) }
  }

  async function applyStatus(e: React.FormEvent) {
    e.preventDefault(); setBusy(true)
    try {
      const res = await api.changeStatus(id, { status: toStatus, changedOn, reason })
      await load(); setReason('')
      setMsg({
        kind: 'ok',
        text: res.suspendDeadline
          ? `「중단」으로 바꿨습니다. 종결 검토 기한은 ${res.suspendDeadline} 입니다.`
          : `「${toStatus}」으로 바꿨습니다.`,
      })
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) }
    finally { setBusy(false) }
  }

  async function remove() {
    if (!confirm('이 대상자를 지웁니다. 되돌릴 수 없습니다. 계속할까요?')) return
    await api.deleteRecipient(id)
    navigate('/recipients')
  }

  if (!r) {
    return (
      <>
        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
        <p className="muted">불러오는 중…</p>
      </>
    )
  }

  const 이용중 = services.filter((v) => !v.ended).length

  return (
    <>
      <div className="main-head">
        <a {...linkProps('/recipients')} className="small">← 대상자 목록</a>
      </div>

      {/*
        ★ **대상자 한 명 요약** — 기본정보 · 받는 서비스 · 담당 · 상태 이력.
          사례회의에 한 장 들고 갈 때 씁니다. 개인정보가 담긴 종이라
          아래 「보관 기한」이 꼬리말에 함께 찍힙니다.
      */}
      <인쇄단추 무엇={`대상자 요약 — ${r.name}`}
                조건={[`상태 ${r.status}`, r.dong && `행정동 ${r.dong}`]}
                덧말="개인정보가 담긴 종이입니다 · 쓰신 뒤 보관 기한에 맞춰 파기해 주세요" />

      <div className="main-head">
        <h1>{r.name}</h1>
        <span className={`tag ${r.status}`}>{r.status}</span>
        {r.age !== null && <span className="muted small">만 {r.age}세</span>}
        {r.copayShort && <span className="muted small">본인부담 {r.copayShort}</span>}
        <div className="spacer" />
        <div className="btns">
          {!editing && (
            <button onClick={() => 고치기시작(r)}>수정</button>
          )}
          {/*
            ── 계약서 = **편람 서식2** (B-2) ─────────────────────────
            성명·주소·서비스·계약기간·기관 정보가 채워져 나옵니다.
            **대리인과 서명란은 비어 있습니다** — 계약 자리에서 얼굴을 보고
            손으로 적고 서명하는 자리입니다.

            우리가 그리던 PDF 는 **되돌아갈 자리로 남겨 둡니다.** 제출 서류는
            서식이 완전히 같아야 하므로 **한글 쪽이 진짜**입니다.
          */}
          {!editing && (
            <a className="btn-like" href={`/api/contract/${id}/hwpx`}
               title="편람 서식2 원본을 채운 한글 파일입니다. 대리인·서명란은 비어 있습니다.">
              계약서 (서식2)
            </a>
          )}
          {/*
            ── PDF 는 **한글이 만든 것**이어야 합니다 (2026-09-04 지시) ──
            우리가 직접 그리던 PDF 는 글꼴·선 굵기·여백이 우리 값이라
            **같은 서식이 아니었습니다.** 이제 서식2 hwpx 를 한글에 넘겨
            **Microsoft Print to PDF 로 인쇄**한 것을 내려 줍니다 —
            한글에서 종이에 뽑은 것과 같은 모습입니다.
            (한글이 없는 PC 에서는 못 합니다. 그때는 왼쪽 hwpx 를 쓰시면 됩니다.)
          */}
          {!editing && (
            <a className="btn-like plain" href={`/api/contract/${id}/hwpx-pdf`}
               title="서식2 를 한글에 넘겨 Microsoft Print to PDF 로 인쇄한 것입니다. 한글이 깔린 PC 에서만 됩니다.">
              계약서 (PDF)
            </a>
          )}
          {/*
            ── 방문표 = 문에 붙이는 QR (C-2-d ①) ────────────────────
            제공인력이 **그 집에 실제로 갔다**는 것을 남기는 표입니다.
            들어가며 한 번, 나오며 한 번 찍으면 편람 서식8 의 「진행시간」이
            기억이 아니라 **기록**이 됩니다.

            새 창으로 여는 까닭 — 이 화면은 A4 종이 모양이라, 대상자 화면
            안에 끼워 넣으면 인쇄할 때 옆의 것들이 같이 딸려 나갑니다.
          */}
          {!editing && (
            <a className="btn-like plain" target="_blank" rel="noreferrer"
               href={`/api/print/visit?ids=${id}`}
               title="어르신 댁 문 안쪽에 붙이는 QR 종이입니다. 방문한 것을 이 표로 적습니다.">
              방문표 인쇄
            </a>
          )}
          {/*
            **저절로 저장되지 않습니다.** 고치는 동안에는 이 자리에 저장을 둡니다 —
            칸이 길어서 맨 아래 단추는 스크롤 밖으로 나가고, 그러면 사람은
            「적었으니 됐겠지」 하고 나갑니다. 자리는 **삭제 바로 왼쪽**입니다.
          */}
          {editing && (
            <>
              <button type="button" className={취소확인 ? 'danger' : 'plain'}
                      onClick={고치기그만}>수정 취소</button>
              <button type="submit" form="대상자고치기" className="primary"
                      disabled={busy || !고친것있나}>
                {busy ? '저장 중…' : 고친것있나 ? '저장' : '고친 것 없음'}
              </button>
            </>
          )}
          <button className="danger" onClick={remove}>삭제</button>
        </div>
      </div>

      {고친것있나 && (
        <div className="msg warn">
          {취소확인
            ? <>「수정 취소」를 <b>한 번 더 누르면</b> 고치신 내용이 사라집니다.
                남기시려면 <b>「저장」</b>을 누르세요.</>
            : <>아직 <b>저장하지 않았습니다.</b> 고치신 내용은 <b>「저장」을 눌러야</b> 들어갑니다 —
                저절로 저장되지 않습니다.</>}
        </div>
      )}

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      {editing && draft ? (
        <form id="대상자고치기" className="card" onSubmit={saveEdit}>
          <h2>대상자 정보 수정</h2>
          <p className="note small" style={{ marginTop: -6 }}>
            고치신 내용은 <b>「저장」을 눌러야</b> 들어갑니다. 저절로 저장되지 않습니다.
          </p>
          <RecipientForm value={draft} onChange={setDraft} tiers={tiers} />
          <div className="btns">
            <button className="primary" disabled={busy || !고친것있나}>
              {busy ? '저장 중…' : 고친것있나 ? '저장' : '고친 것 없음'}
            </button>
            <button type="button" className={취소확인 ? 'danger' : 'plain'}
                    onClick={고치기그만}>수정 취소</button>
          </div>
        </form>
      ) : (
        <>
          {/* 왼쪽 기본정보 · 오른쪽 상태와 연락처 */}
          <div className="grid2">
            <div className="card">
              <h2>기본 정보</h2>
              <dl className="facts">
                <dt>생년월일</dt><dd>{r.birth || '—'}</dd>
                <dt>성별</dt><dd>{r.gender || '—'}</dd>
                <dt>휴대전화</dt><dd className="mono">{r.phone || '—'}</dd>
                <dt>집 전화</dt><dd className="mono">{r.phoneHome || '—'}</dd>
                <dt>읍면동</dt><dd>{r.dong || '—'}</dd>
                <dt>주소</dt><dd>{r.address || '—'}</dd>
                <dt>본인부담</dt><dd>{r.copayLabel ?? '아직 정하지 않음'}</dd>
                {/*
                  ── 올해 남은 한도 (7-마) ──────────────────────────
                  계약서 4조가 어르신께 「연간 지원한도액에서 차감됩니다」라고
                  약속합니다. **「얼마나 남았어요」에 답하는 줄**입니다.
                  안전생활환경개선은 이 한도 바깥이라 여기 안 들어갑니다.
                */}
                {한도?.일상?.봄 && (
                  <>
                    <dt>{한도.해}년 남은 한도</dt>
                    <dd>
                      {한도.일상.넘었나 ? (
                        <span className="deadline">
                          <b>{(-한도.일상.남은돈).toLocaleString('ko-KR')}원</b> 넘겼습니다
                        </span>
                      ) : (
                        <b className={한도.일상.비율 >= 0.9 ? 'deadline' : ''}>
                          {한도.일상.남은돈.toLocaleString('ko-KR')}원
                        </b>
                      )}
                      <span className="muted small">
                        {' '}/ {한도.일상.한도.toLocaleString('ko-KR')}원
                        {' ('}{Math.round(한도.일상.비율 * 100)}% 씀{')'}
                      </span>
                      {한도.주거.쓴돈 > 0 && (
                        <div className="muted small">
                          안전생활환경개선은 따로 —{' '}
                          {한도.주거.쓴돈.toLocaleString('ko-KR')}원 /{' '}
                          {한도.주거.한도.toLocaleString('ko-KR')}원 (생애)
                        </div>
                      )}
                    </dd>
                  </>
                )}
                <dt>계약 서명</dt><dd>{r.selfSign ? '본인이 직접' : '대리인 서명 필요'}</dd>
                {/*
                  ★ `white-space: pre-line` 이 꼭 있어야 합니다.
                    메모는 **줄 단위로 쌓입니다** — 현장앱에서 올라온 특이사항이
                    「[날짜 · 종사자] 말」 한 줄씩 붙습니다. 그런데 HTML 은
                    줄바꿈을 없애 버려서, 여러 날치가 **한 줄로 뭉개져** 보였습니다.
                    자료는 멀쩡히 들어와 있는데 화면에서는 없는 것과 같았습니다.
                    (2026-09-05 무무 — 「그것도 구현되지 않았다」)
                */}
                <dt>내부 메모</dt>
                <dd style={{ whiteSpace: 'pre-line' }}>{r.memo || '—'}</dd>
              </dl>
            </div>

            <div>
              <div className="card">
                <h2>상태</h2>
                <dl className="facts">
                  <dt>현재</dt><dd><span className={`tag ${r.status}`}>{r.status}</span></dd>
                  <dt>바뀐 날</dt><dd>{r.statusSince || '—'}</dd>
                  <dt>사유</dt><dd>{r.statusReason || '—'}</dd>
                  <dt>종결 검토</dt><dd><Deadline r={r} /></dd>
                </dl>
                <p className="note small" style={{ marginTop: 12, marginBottom: 0 }}>
                  {STATUS_HELP[r.status]}
                </p>
              </div>

              <div className="card">
                <h2>대리인 · 비상연락처</h2>
                {r.guardians.length === 0 ? (
                  <p className="note" style={{ margin: 0 }}>
                    아직 없습니다. 문제가 생겼을 때 연락할 곳이 없다는 뜻입니다.
                    「고치기」에서 한 명이라도 넣어 두세요.
                  </p>
                ) : (
                  <dl className="facts">
                    {r.guardians.map((g: any, i: number) => (
                      <Fragment key={i}>
                        <dt>{g.relation || (i === 0 ? '대리인' : '예비')}</dt>
                        <dd>{g.name || '—'}
                          {g.phone && <span className="mono">　{g.phone}</span>}</dd>
                      </Fragment>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          </div>

          {/* 받는 서비스 */}
          <div className="card">
            <h2>
              받는 서비스
              <span className="muted small" style={{ fontWeight: 400, marginLeft: 8 }}>
                이용 중 {이용중}개 / 전체 {services.length}개
              </span>
              <button className="plain small" style={{ float: 'right', fontWeight: 400 }}
                      onClick={() => 서비스넣기(true)}>서비스 넣기</button>
            </h2>
            <ServiceTable list={services} recipientId={id} onChanged={load} />
          </div>
          {서비스넣는중 && (
            <AddServiceBox recipientId={id}
                           onClose={() => 서비스넣기(false)}
                           onSaved={() => { 서비스넣기(false); load() }} />
          )}

          {/* 방문 전 확인 · 식사 대면 수령 */}
          <div className="grid2">
            {(r.pet || r.cctv || r.caution) ? (
              <div className="card warn">
                <h2>방문 전 확인</h2>
                <dl className="facts">
                  {r.pet && (<><dt>반려동물</dt><dd>{r.pet}</dd></>)}
                  {r.cctv && (<><dt>CCTV</dt><dd>{r.cctv}</dd></>)}
                  {r.caution && (<><dt>주의</dt><dd>{r.caution}</dd></>)}
                </dl>
                <p className="note small" style={{ marginTop: 12, marginBottom: 0 }}>
                  제공인력 화면에도 그대로 뜹니다.
                </p>
              </div>
            ) : null}

            {/* 식사지원을 받는 분에게만 */}
            {r.hasMeal && (
              <NoShowCard r={r} onDone={(m) => {
                setMsg({ kind: m.reached ? 'err' : 'ok', text: m.message }); load()
              }} />
            )}
          </div>
        </>
      )}

      <form className="card" onSubmit={applyStatus}>
        <h2>상태 바꾸기</h2>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="s-to">바꿀 상태</label>
            <select id="s-to" value={toStatus} onChange={(e) => setToStatus(e.target.value)}>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="s-on">바뀐 날</label>
            <input id="s-on" type="date" value={changedOn}
                   onChange={(e) => setChangedOn(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 2, marginBottom: 0 }}>
            <label htmlFor="s-why">사유</label>
            <input id="s-why" value={reason} onChange={(e) => setReason(e.target.value)}
                   placeholder="입원, 자녀 방문 등" />
          </div>
          <button className="primary" disabled={busy} style={{ marginBottom: 0 }}>적용</button>
        </div>
        <p className="note small" style={{ marginTop: 12, marginBottom: 0 }}>
          {STATUS_HELP[toStatus]}
        </p>
      </form>

      <div className="grid2">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 0' }}><h2>상태 이력</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>날짜</th><th>변경</th><th>사유</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="mono small">{h.changed_on}</td>
                    <td>
                      {h.from_status ? `${h.from_status} → ` : ''}
                      <span className={`tag ${h.to_status}`}>{h.to_status}</span>
                    </td>
                    <td className="small">{h.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 0' }}><h2>변경 이력</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>날짜</th><th>항목</th><th>내용</th></tr></thead>
              <tbody>
                {changes.length === 0 ? (
                  <tr><td colSpan={3} className="muted small">아직 없습니다.</td></tr>
                ) : changes.map((c, i) => (
                  <tr key={i}>
                    <td className="mono small">{c.changed_on}</td>
                    <td className="small">{c.field}</td>
                    <td className="small">
                      <s className="muted">{c.before_val || '없음'}</s> → <b>{c.after_val}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
