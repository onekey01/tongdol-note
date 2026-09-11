import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

/**
 * 의뢰 접수 — 지자체가 보낸 명단을 우리 자료와 맞춰 봅니다.
 *
 * 파일이 아니라 **사람**이 기준입니다.
 * 시트를 고르지 않고 파일에 든 시트를 모두 한 번에 읽습니다.
 * 지자체가 새 의뢰만 보내든 전체 명단을 보내든 같은 결과가 나옵니다.
 *
 * 두 걸음으로 나눕니다.
 *   1) 미리보기 — 무엇이 새 것이고 무엇이 바뀌었는지만 보여줍니다. 자료함에 쓰지 않습니다.
 *   2) 반영    — 사람이 확인하고 누르면 그때 들어갑니다.
 */

type Diff = {
  sheet: string; row: number; dupOf: number | null
  name: string; birth: string; dong: string; address: string; phone: string
  service: string; serviceId: number | null
  periodFrom: string | null; periodTo: string | null
  cycleText: string; copay: string; note: string
  state: string
  changes: { field: string; before: string; after: string }[]
  problems: string[]
  candidates: { id: string; name: string; birth: string; address: string; phone: string }[]
  /** 이미 있는 의뢰와 기간이 겹치는 것들 — 「재의뢰」 */
  overlaps: { batch: string; from: string; to: string; cycle: string }[]
}

const HELP: Record<string, string> = {
  신규: '처음 보는 사람입니다. 대상자로 새로 만들어집니다.',
  추가: '아는 사람인데 이 서비스는 처음입니다.',
  변경: '같은 사람·같은 서비스인데 기간이나 횟수가 달라졌습니다.',
  재개: '종결·중단됐던 분이 다시 의뢰되었습니다. 이용으로 되돌립니다.',
  유지: '이미 갖고 있는 것과 똑같습니다. 반영해도 달라지는 게 없습니다.',
  지난차수: '지금 갖고 있는 것보다 이전 기간입니다. 이미 지나간 의뢰라 넣지 않습니다.',
  확인필요: '서비스명이나 부담 구간을 우리 자료에서 못 찾았습니다.',
  동명이인: '성명·생년월일이 같은 분이 이미 있는데 주소·연락처가 다릅니다.',
}
const TONE: Record<string, string> = {
  신규: '이용', 추가: '이용', 재개: '이용',
  변경: '중단', 지난차수: '', 유지: '',
  확인필요: '취소', 동명이인: '취소',
}
const ORDER = ['신규', '추가', '변경', '재개', '유지', '지난차수', '확인필요', '동명이인']

export default function Inbox() {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [res, setRes] = useState<any>(null)
  const [skip, setSkip] = useState<Set<string>>(new Set())
  const [services, setServices] = useState<any[]>([])
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [batches, setBatches] = useState<any[]>([])
  const pwRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const key = (l: Diff) => `${l.sheet}|${l.row}`
  const loadBatches = () => api.batches().then((d) => setBatches(d.batches)).catch(() => {})

  useEffect(() => {
    loadBatches()
    api.settings().then((s) => setServices(s.services ?? [])).catch(() => {})
  }, [])

  async function look() {
    if (!file) return setMsg({ kind: 'err', text: '엑셀 파일을 골라 주세요.' })
    setBusy(true); setMsg(null)
    try {
      setRes(await api.previewReferrals(file, password)); setSkip(new Set())
    } catch (e: any) {
      setRes(null); setMsg({ kind: 'err', text: e.message })
      if (e.status === 401) pwRef.current?.focus()
    } finally { setBusy(false) }
  }

  async function patch(l: Diff, body: any) {
    const d = await api.fixReferral(res.token, l.sheet, l.row, body)
    setRes((r: any) => ({
      ...r,
      summary: d.summary,
      lines: r.lines.map((x: Diff) => (key(x) === key(l) ? d.line : x)),
    }))
  }

  async function put() {
    setBusy(true)
    try {
      const r = await api.applyReferrals(
        res.token,
        [...skip].map((k) => ({ sheet: k.split('|')[0], row: Number(k.split('|')[1]) }))
      )
      setRes(null); setFile(null); setPassword('')
      if (fileRef.current) fileRef.current.value = ''
      await loadBatches()
      setMsg({
        kind: 'ok',
        text: `${r.batches.join(' · ')} 반영했습니다. ` +
          `새 대상자 ${r.새사람}명 · 의뢰 ${r.새의뢰}건` +
          (r.재개 ? ` · 재개 ${r.재개}명` : '') +
          (r.부담변경 ? ` · 부담구간 변경 ${r.부담변경}건` : '') +
          (r.건너뜀 ? ` · 건너뜀 ${r.건너뜀}건` : ''),
      })
    } catch (e: any) {
      setMsg({ kind: 'err', text: e.message })
    } finally { setBusy(false) }
  }

  const s = res?.summary
  const lines: Diff[] = res?.lines ?? []
  const 손봐야 = lines.filter((l) => l.state === '확인필요' || l.state === '동명이인')
  const 보통 = lines.filter((l) => l.state !== '확인필요' && l.state !== '동명이인')
  const 반영수 = lines.filter(
    (l) => !skip.has(key(l)) && ['신규', '추가', '변경', '재개'].includes(l.state)
  ).length

  return (
    <>
      <div className="main-head">
        <h1>의뢰 접수</h1>
        <span className="muted small">지자체가 보낸 대상자 명단을 여기에 올립니다</span>
      </div>

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      <div className="card">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 2, marginBottom: 0 }}>
            <label htmlFor="xl">엑셀 파일</label>
            <input id="xl" ref={fileRef} type="file" accept=".xlsx,.xls"
                   onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRes(null) }} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="pw">파일 암호</label>
            <input id="pw" ref={pwRef} type="password" value={password}
                   onChange={(e) => setPassword(e.target.value)} placeholder="없으면 비워 두세요" />
          </div>
          <button className="primary" disabled={busy || !file} onClick={look}
                  style={{ marginBottom: 0 }}>
            {busy ? '읽는 중…' : '미리보기'}
          </button>
        </div>
        <p className="note small" style={{ marginTop: 12, marginBottom: 0 }}>
          <b>시트를 고르지 않아도 됩니다.</b> 파일에 든 차수를 모두 한 번에 읽어
          사람마다 쌓습니다. 차수를 거꾸로 올려도 자료가 되돌아가지 않습니다.
          암호가 걸린 파일도 그대로 올리시면 되고, <b>암호는 저장하지 않습니다.</b>
        </p>
      </div>

      {res && (
        <>
          <div className="card">
            <div className="row tight" style={{ alignItems: 'flex-end' }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>읽은 차수</h3>
                {res.sheets.map((sh: any) => (
                  <div key={sh.name} className="small">
                    <b>{sh.name}</b>{' '}
                    {sh.skipped
                      ? <span style={{ color: 'var(--risk)' }}>— {sh.skipped}</span>
                      : <span className="muted">{sh.rows}줄 (머리글 {sh.headerRow}번째 줄)</span>}
                  </div>
                ))}
              </div>
              <div className="spacer" />
              <div className="right">
                <div className="pills">
                  {ORDER.filter((k) => s[k] > 0).map((k) => (
                    <span key={k} className={`tag ${TONE[k]}`} title={HELP[k]}>{k} {s[k]}</span>
                  ))}
                </div>
                <div className="muted small" style={{ marginTop: 6 }}>
                  전체 {s.줄수}줄 · 사람 {s.사람수}명
                  {s.재의뢰 > 0 && (
                    <> · <b style={{ color: 'var(--warn)' }}>기간이 겹치는 것 {s.재의뢰}줄</b></>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── 관리자가 손봐야 하는 것 ── */}
          {손봐야.length > 0 && (
            <div className="card bad" style={{ paddingBottom: 8 }}>
              <h2>관리자 확인 {손봐야.length}건</h2>
              <p className="note small" style={{ marginTop: -6 }}>
                프로그램이 판단할 수 없는 줄입니다. <b>여기서 지정하지 않으면 반영되지 않습니다.</b>
                지자체에 확인한 뒤 정해 주세요.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>차수·줄</th><th>성명</th><th>내용</th><th style={{ width: 300 }}>어떻게 할까요</th></tr>
                  </thead>
                  <tbody>
                    {손봐야.map((l) => (
                      <tr key={key(l)}>
                        <td className="small mono">{l.sheet}<br />{l.row}줄</td>
                        <td><span className="name">{l.name}</span>
                          <div className="muted small">{l.birth}</div></td>
                        <td className="small">
                          {l.problems.map((p, i) => <div key={i} style={{ color: 'var(--risk)' }}>{p}</div>)}
                          {l.state === '동명이인' && (
                            <div>
                              같은 성명·생년월일이 이미 있습니다.<br />
                              <span className="muted">올린 자료: {l.address || '주소 없음'} · {l.phone || '연락처 없음'}</span>
                            </div>
                          )}
                        </td>
                        <td>
                          {l.state === '확인필요' && !l.serviceId && (
                            <select defaultValue="" onChange={(e) =>
                              e.target.value && patch(l, { serviceId: Number(e.target.value) })}>
                              <option value="">— 어느 서비스인가요</option>
                              {services.map((v: any) => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                              ))}
                            </select>
                          )}
                          {l.state === '동명이인' && (
                            <div className="btns">
                              {l.candidates.map((c) => (
                                <button key={c.id} onClick={() => patch(l, { recipientId: c.id })}>
                                  같은 분: {c.address || '주소 없음'} · {c.phone || '연락처 없음'}
                                </button>
                              ))}
                              <button className="primary" onClick={() => patch(l, { newPerson: true })}>
                                다른 분 — 새로 등록
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 나머지 ── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 34 }}></th>
                    <th>차수</th><th>줄</th><th>성명</th><th>읍면</th><th>서비스</th>
                    <th>기간</th><th>주기</th><th>부담</th><th>판정</th><th>내용</th>
                  </tr>
                </thead>
                <tbody>
                  {보통.map((l) => {
                    const 고정 = l.state === '유지' || l.state === '지난차수'
                    const off = skip.has(key(l)) || 고정
                    return (
                      <tr key={key(l)} style={off ? { opacity: .5 } : undefined}>
                        <td>
                          <input type="checkbox" style={{ width: 16 }} disabled={고정}
                                 checked={!off}
                                 onChange={(e) => {
                                   const n = new Set(skip)
                                   e.target.checked ? n.delete(key(l)) : n.add(key(l))
                                   setSkip(n)
                                 }} />
                        </td>
                        <td className="small">{l.sheet}</td>
                        <td className="mono small">{l.row}</td>
                        <td><span className="name">{l.name}</span>
                          <div className="muted small">{l.birth}</div></td>
                        <td className="small">{l.dong}</td>
                        <td className="small">{l.service}</td>
                        <td className="mono small">{l.periodFrom ?? '—'}<br />{l.periodTo ?? ''}</td>
                        <td className="small">{l.cycleText}</td>
                        <td className="small">{l.copay}</td>
                        <td>
                          <span className={`tag ${TONE[l.state]}`} title={HELP[l.state]}>{l.state}</span>
                          {/*
                            기간이 겹치는 의뢰 — 둘 다 유효하지만 지자체가 못 걸렀을 수도 있습니다.
                            판정과 나란히 붙여, 반영 단추를 누르기 전에 눈에 걸리게 합니다.
                          */}
                          {l.overlaps?.length > 0 && (
                            <div style={{ marginTop: 3 }}>
                              <span className="tag warn" title="이미 있는 의뢰와 기간이 겹칩니다">재의뢰</span>
                            </div>
                          )}
                        </td>
                        <td className="small">
                          {l.changes.map((c, i) => (
                            <div key={i}>{c.field}: <s className="muted">{c.before || '없음'}</s> → <b>{c.after}</b></div>
                          ))}
                          {l.overlaps?.map((o, i) => (
                            <div key={`ov${i}`} style={{ color: 'var(--warn)' }}>
                              <b>{o.batch}</b> 의뢰({o.from || '?'}~{o.to || '열림'})와 <b>기간이 겹칩니다.</b>
                              {' '}둘 다 살려 둡니다 — 지자체가 못 걸렀는지 한 번 봐 주세요
                            </div>
                          ))}
                          {l.dupOf && (
                            <div style={{ color: 'var(--warn)' }}>
                              같은 차수 {l.dupOf}줄과 같은 사람·같은 서비스입니다
                            </div>
                          )}
                          {l.note && <div className="muted">{l.note}</div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="btns">
              <button className="primary" disabled={busy || 반영수 === 0} onClick={put}>
                {busy ? '반영 중…' : `${반영수}건 반영하기`}
              </button>
              <button className="plain" onClick={() => setRes(null)}>취소</button>
              <span className="note small">
                「유지」와 「지난차수」는 넣지 않습니다. 체크를 풀면 그 줄도 빠집니다.
              </span>
            </div>
          </div>
        </>
      )}

      {batches.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 0' }}><h2>반영한 차수</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>차수</th><th>사람</th><th>의뢰</th><th>반영일</th></tr></thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.label}>
                    <td><span className="name">{b.label}</span></td>
                    <td>{b.people}명</td>
                    <td>{b.lines}건</td>
                    <td className="mono small">{String(b.at).slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
