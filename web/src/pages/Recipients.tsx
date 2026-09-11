import { useEffect, useState, useCallback } from 'react'
import 인쇄단추 from '../components/인쇄단추'
import { api, type Recipient } from '../lib/api'
import { navigate } from '../lib/router'
import RecipientForm, { EMPTY, type RecipientDraft, type Tier } from '../components/RecipientForm'
import Deadline from '../components/Deadline'

type Col = { key: string; label: string; sortable?: boolean }

const COLS: Col[] = [
  { key: 'name', label: '성명', sortable: true },
  { key: 'age', label: '나이', sortable: true },
  { key: 'dong', label: '읍면동', sortable: true },
  { key: 'services', label: '받는 서비스', sortable: true },
  { key: 'status', label: '상태', sortable: true },
  { key: 'deadline', label: '종결 검토 기한', sortable: true },
  { key: 'copay', label: '본인부담', sortable: true },
]

/**
 * 받는 서비스.
 *
 * 서비스마다 기간이 따로 있어서, 한 사람이 세 가지를 받는 중에
 * 하나만 먼저 끝나는 일이 흔합니다. 그 하나만 회색에 줄을 그어 보여줍니다.
 * **대상자 상태는 그대로 「이용」입니다.** 나머지를 아직 받고 있으니까요.
 */
function Services({ list }: { list: Recipient['services'] }) {
  if (!list?.length) return <span className="muted">—</span>
  return (
    <span className="svcs">
      {list.map((v, i) => (
        <span key={i} className={`svc${v.ended ? ' done' : ''}`}
              title={`${v.from ?? ''} ~ ${v.to ?? ''}${v.cycle ? ` · ${v.cycle}` : ''}${
                v.ended ? ' (기간 끝)' : ''}`}>
          {v.name}
        </span>
      ))}
    </span>
  )
}

export default function Recipients() {
  const [items, setItems] = useState<Recipient[]>([])
  const [dongs, setDongs] = useState<string[]>([])
  const [statuses, setStatuses] = useState<string[]>([])
  const [tiers, setTiers] = useState<Tier[]>([])

  const [q, setQ] = useState('')
  // 처음 열면 **이용 중인 분만** 보입니다.
  // 종결·취소까지 섞여 나오면 "지금 몇 분을 보고 있나"를 셀 수가 없습니다.
  // 상태를 「전체」로 바꾸면 다 보입니다.
  const [status, setStatus] = useState('이용')
  const [dong, setDong] = useState('')
  const [sort, setSort] = useState('name')
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')

  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<RecipientDraft>(EMPTY)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const r = await api.recipients(q, status, dong, sort, dir)
    setItems(r.items); setDongs(r.dongs); setStatuses(r.statuses); setLoading(false)
  }, [q, status, dong, sort, dir])

  // 글자를 칠 때마다 서버를 부르지 않고 잠깐 기다립니다.
  useEffect(() => {
    const t = setTimeout(load, 180)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    api.settings().then((s) => setTiers(s.tiers ?? [])).catch(() => {})
  }, [])

  function head(c: Col) {
    if (!c.sortable) return c.label
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

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      await api.createRecipient(draft)
      setAdding(false); setDraft(EMPTY); await load()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  const 이용중 = items.filter((i) => i.status === '이용').length

  return (
    <>
      {/*
        ★ **거른 조건이 종이에 함께 찍힙니다.** 「이용 중인 분만」 걸러
          뽑은 12명짜리 종이가 전체 명단처럼 보이면, 회의 탁자에서
          40명 중 28명이 없는 채로 이야기가 굴러갑니다.
      */}
      <인쇄단추 무엇="대상자 명단" 수={items.length}
                조건={[
                  status ? `상태 ${status}` : '상태 전체',
                  dong && `행정동 ${dong}`,
                  q && `찾기 「${q}」`,
                  sort && `정렬 ${({ name: '이름', dong: '행정동', status: '상태' } as any)[sort] ?? sort}`,
                ]} />

      <div className="main-head">
        <h1>대상자</h1>
        <span className="muted small">
          {loading ? '' : `${items.length}명 표시 · 이용 중 ${이용중}명`}
        </span>
        <div className="spacer" />
        {/*
          ── 방문표 한꺼번에 뽑기 (C-2-d ①) ──────────────────────
          한 사람씩 뽑으면 서른 분이면 서른 번 눌러야 합니다.
          여기서 한 번에 뽑아 점선대로 잘라 나눠 드리는 것이 맞습니다.
          **이용 중인 분만** 나옵니다 — 종결·중단된 집에 붙일 일은 없습니다.
        */}
        <a className="btn-like plain" target="_blank" rel="noreferrer"
           href="/api/print/visit?all=1"
           title="이용 중인 분 전부의 방문표를 A4 에 여덟 장씩 뽑습니다.">
          방문표 전부 인쇄
        </a>
        <button className="primary" onClick={() => { setDraft(EMPTY); setErr(''); setAdding(true) }}>
          + 직접 추가
        </button>
      </div>

      <div className="card 거르개" style={{ paddingBottom: 14 }}>
        <div className="row tight" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 2, marginBottom: 0 }}>
            <label htmlFor="q">찾기</label>
            <input id="q" value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="성명 · 연락처 · 주소 · 보호자 · 서비스명" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="f-status">상태</label>
            <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">전체</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="f-dong">읍면동</label>
            <select id="f-dong" value={dong} onChange={(e) => setDong(e.target.value)}>
              <option value="">전체</option>
              {dongs.map((d) => <option key={d} value={d}>{d}</option>)}
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
                {COLS.map((c) => <th key={c.key}>{head(c)}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map((r, i) => (
                <tr key={r.id} className="clickable" onClick={() => navigate(`/recipients/${r.id}`)}>
                  {/* 연번은 지금 화면에 보이는 순서입니다. 거르거나 정렬하면 다시 매겨집니다.
                      전화로 "몇 번째 분이요"를 주고받을 때 쓰는 번호입니다. */}
                  <td className="mono small muted" style={{ textAlign: 'right' }}>{i + 1}</td>
                  <td>
                    <span className="name">{r.name}</span>
                    {r.noShowWarn && (
                      <span className="tag 중단" style={{ marginLeft: 6 }}>
                        미수령 {r.noShowStreak}
                      </span>
                    )}
                  </td>
                  <td>{r.age ?? '—'}</td>
                  <td>{r.dong || '—'}</td>
                  <td><Services list={r.services} /></td>
                  <td><span className={`tag ${r.status}`}>{r.status}</span></td>
                  <td><Deadline r={r} /></td>
                  <td className="small">{r.copayShort ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && items.length === 0 && (
          <div className="empty">
            {q || status || dong
              ? '조건에 맞는 대상자가 없습니다.'
              : '아직 등록된 대상자가 없습니다. 「의뢰 접수」에서 지자체 명단을 올리거나, 오른쪽 위 「직접 추가」로 시작하세요.'}
          </div>
        )}
      </div>

      {adding && (
        <div className="veil" onClick={(e) => { if (e.target === e.currentTarget) setAdding(false) }}>
          <form className="modal" onSubmit={save}>
            <h2>대상자 직접 추가</h2>
            {err && <div className="msg err">{err}</div>}
            <RecipientForm value={draft} onChange={setDraft} tiers={tiers} />
            <div className="btns" style={{ marginTop: 10 }}>
              <button className="primary" disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
              <button type="button" className="plain" onClick={() => setAdding(false)}>취소</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
