import { useEffect, useState, useCallback } from 'react'
import 인쇄단추 from '../components/인쇄단추'
import { api } from '../lib/api'
import AssignBox from '../components/AssignBox'

/**
 * 배정 · 주간계획.
 *
 * 지자체 의뢰는 「김순자 · 가사지원 · 주 2회」까지만 옵니다.
 * 이걸로는 아무도 못 움직입니다. **누가** 가는지, **무슨 요일에** 가는지가
 * 없기 때문입니다. 그 둘을 채우는 화면입니다.
 *
 * 단위는 사람이 아니라 **대상자 × 서비스**입니다.
 * 한 사람이 여러 서비스를 받고 서비스마다 담당이 다르기 때문입니다 —
 * 식사지원은 관리자가, 이미용은 제공인력이 맡는 식입니다.
 *
 * 고치는 칸은 대상자 화면·종사자 화면과 **같은 부품**을 씁니다(AssignBox).
 * 어느 쪽에서 배정하든 나머지 두 곳에 그대로 나타납니다.
 */

const STATES = ['미배정', '계획없음', '확인필요', '배정됨', '지난의뢰', '종결자', '중단중']

// 아래 셋은 기본으로 숨깁니다.
// 끝난 사람과 끝난 기간은 배정할 거리가 아닌데, 목록에 섞여 있으면
// 남은 일이 몇 건인지 셀 수가 없습니다.
// (종결하면 배정은 서버가 자동으로 닫습니다. 이력은 대상자·종사자 화면에 남습니다.)
const HIDDEN = ['지난의뢰', '종결자', '중단중']
const 숨긴수 = (t: any) => HIDDEN.reduce((s, k) => s + (t[k] ?? 0), 0)

// 줄은 **대상자마다 하나**입니다.
// 한 사람이 서비스를 셋 받으면 옛 화면에서는 세 줄로 흩어졌습니다.
// 그러면 「이 어르신은 지금 어떻게 되어 있나」를 한눈에 볼 수가 없습니다.
// 이제 사람 칸은 하나로 묶고, 그 옆에 서비스마다 담당·기간·요일이 붙습니다.
const COLS = [
  { key: 'service', label: '서비스' },
  { key: 'cycle', label: '의뢰 주기' },
  { key: 'period', label: '서비스 기간' },
  { key: 'worker', label: '담당' },
  { key: 'assign', label: '배정 기간' },
  { key: 'slots', label: '가는 요일' },
  { key: 'state', label: '상태' },
]

export default function Assign() {
  const [d, setD] = useState<any>(null)
  const [q, setQ] = useState('')
  const [state, setState] = useState('')
  const [dong, setDong] = useState('')
  const [service, setService] = useState('')
  const [open, setOpen] = useState<any>(null)
  const [sort, setSort] = useState('recipient')
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')

  const load = useCallback(async () => {
    setD(await api.assign({ q, state, dong, service }))
  }, [q, state, dong, service])

  useEffect(() => {
    const t = setTimeout(() => load().catch(() => {}), 180)
    return () => clearTimeout(t)
  }, [load])

  if (!d) return <p className="muted">불러오는 중…</p>

  const pick = (x: any) => {
    switch (sort) {
      case 'service': return x.service
      case 'cycle': return x.cycle
      case 'period': return x.from ?? '9999'
      case 'worker': return x.worker || '힣'
      case 'assign': return x.assignFrom ?? '9999'
      case 'slots': return x.slotText || '힣'
      case 'state': return STATES.indexOf(x.state)
      default: return x.recipient
    }
  }
  const sorted = [...d.items].sort((a: any, b: any) => {
    const x = pick(a), y = pick(b)
    const c = typeof x === 'number' && typeof y === 'number'
      ? x - y : String(x).localeCompare(String(y), 'ko')
    return c * (dir === 'asc' ? 1 : -1)
  })

  // 대상자마다 묶습니다. 정렬은 그 사람의 첫 줄이 있는 자리를 따릅니다.
  const people: { id: string; name: string; dong: string; memo: string; rows: any[] }[] = []
  const seen = new Map<string, number>()
  for (const x of sorted) {
    let i = seen.get(x.recipientId)
    if (i === undefined) {
      i = people.length
      seen.set(x.recipientId, i)
      people.push({
        id: x.recipientId, name: x.recipient, dong: x.dong, memo: x.memo ?? '', rows: [],
      })
    }
    people[i].rows.push(x)
  }
  const rows = sorted

  function head(c: { key: string; label: string }) {
    const on = sort === c.key
    return (
      <button className="sorter" onClick={() => {
        if (on) setDir(dir === 'asc' ? 'desc' : 'asc')
        else { setSort(c.key); setDir('asc') }
      }}>
        {c.label}<span className="arrow">{on ? (dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </button>
    )
  }

  const t = d.tally
  const left = t.미배정 + t.계획없음
  // 받는 서비스가 없어 이 목록에 아예 못 뜨는 대상자. 빈 화면에서만 씁니다.
  const 없는수 = Number(d.서비스없는대상자 ?? 0)

  return (
    <>
      <인쇄단추 무엇="배정 · 주간계획" 수={rows.length}
                조건={[
                  state ? `상태 ${state}` : '상태 전체',
                  dong && `행정동 ${dong}`,
                  service && `서비스 ${service}`,
                  q && `찾기 「${q}」`,
                ]} />

      <div className="main-head">
        <h1>배정 · 주간계획</h1>
      </div>

      {left > 0 && (
        <div className="msg err">
          아직 <b>{left}건</b>이 사람을 기다리고 있습니다.
          {t.미배정 > 0 && ` 담당 없음 ${t.미배정}건`}
          {t.계획없음 > 0 && ` · 담당은 있는데 요일이 없음 ${t.계획없음}건`}
        </div>
      )}

      {/*
        손으로 넣은 대상자는 **받는 서비스**가 없어 이 목록에 아예 못 뜹니다.
        고장이 아니라 순서인데, 말을 안 하면 관리자는 「넣었는데 왜 없지」에서
        첫날 멈춥니다. 그래서 목록이 비었든 안 비었든 항상 알려 줍니다.
      */}
      {없는수 > 0 && (
        <div className="msg">
          받는 서비스가 아직 없는 대상자 <b>{없는수}명</b>은 여기 안 나옵니다.
          <br />
          <span className="small">
            「대상자」에서 그 사람을 열고 <b>서비스 추가</b>로 서비스·기간·횟수를
            넣으시면, 지자체 엑셀로 들어온 것과 똑같이 여기에 나오고
            배정·실적·정산·기록지가 그대로 됩니다.
          </span>
        </div>
      )}

      {open && (
        <AssignBox recipientId={open.recipientId} serviceId={open.serviceId}
                   onClose={() => setOpen(null)}
                   onSaved={() => { setOpen(null); load() }} />
      )}

      <div className="card 거르개" style={{ paddingBottom: 14 }}>
        <div className="row tight" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 2, marginBottom: 0 }}>
            <label htmlFor="a-q">찾기</label>
            <input id="a-q" value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="대상자 · 서비스 · 담당" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="a-state">상태</label>
            <select id="a-state" value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">지금 할 일만 ({t.all - 숨긴수(t)})</option>
              <option value="__all">끝난 것까지 전부 ({t.all})</option>
              {STATES.map((s) => (
                <option key={s} value={s}>{s} ({(t as any)[s] ?? 0})</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="a-dong">읍면동</label>
            <select id="a-dong" value={dong} onChange={(e) => setDong(e.target.value)}>
              <option value="">전체</option>
              {d.dongs.map((x: string) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="a-svc">서비스</label>
            <select id="a-svc" value={service} onChange={(e) => setService(e.target.value)}>
              <option value="">전체</option>
              {d.services.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'right' }}>연번</th>
                <th style={{ minWidth: 120 }}>
                  <button className="sorter" onClick={() => {
                    if (sort === 'recipient') setDir(dir === 'asc' ? 'desc' : 'asc')
                    else { setSort('recipient'); setDir('asc') }
                  }}>
                    대상자
                    <span className="arrow">
                      {sort === 'recipient' ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </button>
                </th>
                {COLS.map((c) => <th key={c.key}>{head(c)}</th>)}
              </tr>
            </thead>
            <tbody>
              {people.map((p, pi) =>
                p.rows.map((x: any, i: number) => (
                  <tr key={x.key} className="clickable" onClick={() => setOpen(x)}
                      style={{
                        ...(x.ended ? { opacity: .55 } : null),
                        // 사람이 바뀌는 자리에 선을 그어 묶음이 눈에 들어오게 합니다.
                        ...(i === 0 && pi > 0
                          ? { borderTop: '2px solid var(--line)' } : null),
                      }}>
                    {i === 0 && (
                      <>
                        <td rowSpan={p.rows.length} className="mono small muted"
                            style={{ textAlign: 'right', verticalAlign: 'top' }}>
                          {pi + 1}
                        </td>
                        <td rowSpan={p.rows.length} style={{ verticalAlign: 'top' }}>
                          <span className="name">{p.name}</span>
                          {p.dong && <div className="muted small">{p.dong}</div>}
                          <div className="muted small">서비스 {p.rows.length}개</div>
                          {/*
                            대상자 메모 — 「대문 왼쪽에 개 있음」 「귀가 어두우셔서 크게」.
                            **출력물에는 한 글자도 안 나갑니다.** 가는 사람이 알아야 하는 말이라
                            사람을 정하는 이 화면에 있어야 합니다. 대상자 화면까지 들어가서
                            봐야 한다면 아무도 안 봅니다.
                          */}
                          {p.memo && (
                            <span className="memo-line" title={p.memo}>📌 {p.memo}</span>
                          )}
                        </td>
                      </>
                    )}
                    <td>
                      <span className={x.ended ? 'svc done' : 'svc'}>{x.service}</span>
                    </td>
                    <td className="small">{x.cycle || '—'}</td>
                    <td className="mono small">{x.from ?? '—'} ~ {x.to ?? '—'}</td>
                    <td>
                      {x.worker
                        ? <>
                            <span className="name">{x.worker}</span>
                            {/*
                              맡고 있던 사람이 쉬러 갔을 때. 배정을 자동으로 떼지 않습니다 —
                              대타를 누구로 할지는 기관이 정할 일이고, 프로그램이 말없이
                              닫아 버리면 그 대상자가 「미배정」으로 조용히 사라집니다.
                            */}
                            {x.workerOnLeave && (
                              <div className="deadline over">휴직 중 — 대타 필요</div>
                            )}
                            {x.sameDong && !x.workerOnLeave &&
                              <div className="muted small">같은 읍면동</div>}
                          </>
                        : <span className="muted">—</span>}
                    </td>
                    <td className="mono small">
                      {x.assignFrom || x.assignTo
                        ? <>{x.assignFrom ?? '—'} ~ {x.assignTo ?? '—'}</>
                        : <span className="muted">—</span>}
                    </td>
                    <td className="small">
                      {x.slotText
                        ? x.slotText
                        : x.byDow
                        ? <span className="muted">—</span>
                        : <span className="muted">날짜 지정</span>}
                    </td>
                    <td>
                      <span className={`tag ${
                        x.state === '배정됨' ? '이용'
                        : HIDDEN.includes(x.state) ? '종결' : '중단'}`}>
                        {x.state}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="empty">
            {t.all === 0
              ? <>아직 의뢰가 없습니다.<br />
                  <span className="small">「의뢰 접수」에서 지자체 명단을 올리면 여기 나옵니다.</span></>
              : !state && t.all === 숨긴수(t)
              ? <>지금 배정할 것이 없습니다 —
                  <b> 기간이 끝났거나 종결된 {t.all}건</b>뿐입니다.<br />
                  <span className="small">보시려면 상태에서 「끝난 것까지 전부」를 고르세요.</span></>
              : '조건에 맞는 것이 없습니다.'}
          </div>
        )}
      </div>
    </>
  )
}
