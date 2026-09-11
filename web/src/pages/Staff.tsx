import { useEffect, useState, useCallback } from 'react'
import 인쇄단추 from '../components/인쇄단추'
import { api } from '../lib/api'
import { navigate } from '../lib/router'

/**
 * 종사자 — 기관에서 일하는 사람 전부.
 *
 * 관리자 · 사무직원 · 제공인력 · 외부업체를 한 곳에서 봅니다.
 * **한 사람이 역할을 여럿 가질 수 있습니다.** 관리자가 제공인력을 겸하는 경우가
 * 실제로 있는데, 명단을 따로 두면 같은 사람이 두 번 등록되어
 * 인건비가 두 번 잡히거나 실적이 갈라집니다.
 *
 * 이름을 누르면 그 사람 화면으로 갑니다. 고치기·비번·계약종료가 거기 다 있습니다.
 */

type Staff = {
  id: number; loginId: string; name: string; phone: string
  roles: string[]; rolesKo: string[]; status: string; statusKo: string
  resignedAt: string | null; onLeave: boolean; leaveFrom: string; leaveTo: string
  isWorker: boolean; hiredOn: string; contractOn: string; dong: string
  matchNow: number; matchAll: number
  payrollExcluded: boolean
}

/**
 * 읍면동은 칸을 따로 두지 않습니다.
 * **주소 안에 이미 있어서** 서버가 뽑아 줍니다. 성명 아래에 작게 붙이고,
 * 그 자리에는 계약체결일을 놓습니다 — 근로계약서 관리에 실제로 쓰는 날짜입니다.
 */
const COLS = [
  { key: 'name', label: '성명' },
  { key: 'roles', label: '역할' },
  { key: 'loginId', label: '아이디' },
  { key: 'phone', label: '연락처' },
  { key: 'hiredOn', label: '입사일' },
  { key: 'contractOn', label: '계약체결일' },
  { key: 'match', label: '대상자 매칭' },
]

export default function Staff() {
  const [items, setItems] = useState<Staff[]>([])
  const [roles, setRoles] = useState<{ key: string; label: string }[]>([])
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [dong, setDong] = useState('')
  const [showResigned, setShowResigned] = useState(false)
  const [sort, setSort] = useState('name')
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')

  const load = useCallback(async () => {
    const d = await api.staff(q, role, showResigned)
    setItems(d.items); setRoles(d.roles)
  }, [q, role, showResigned])

  useEffect(() => {
    const t = setTimeout(() => load().catch(() => {}), 180)
    return () => clearTimeout(t)
  }, [load])

  const pick = (s: Staff) => {
    switch (sort) {
      case 'roles': return s.rolesKo.join(',')
      case 'loginId': return s.loginId
      case 'phone': return s.phone
      case 'hiredOn': return s.hiredOn || '9999'
      case 'contractOn': return s.contractOn || '9999'
      case 'dong': return s.dong
      case 'match': return s.matchNow
      default: return s.name
    }
  }
  const dongs = [...new Set(items.map((s) => s.dong).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, 'ko')
  )
  const shown = dong ? items.filter((s) => s.dong === dong) : items
  const sorted = [...shown].sort((a, b) => {
    const x = pick(a), y = pick(b)
    const c = typeof x === 'number' && typeof y === 'number'
      ? x - y : String(x).localeCompare(String(y), 'ko')
    return c * (dir === 'asc' ? 1 : -1)
  })

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

  return (
    <>
      <인쇄단추 무엇="종사자 명부" 수={items.length}
                조건={[
                  role ? `역할 ${role}` : '역할 전체',
                  dong && `읍면동 ${dong}`,
                  q && `찾기 「${q}」`,
                ]} />

      <div className="main-head">
        <h1>종사자</h1>
        <span className="muted small">관리자 · 사무직원 · 제공인력 · 외부업체</span>
        <div className="spacer" />
        <button className="primary" onClick={() => navigate('/staff/new')}>+ 종사자 등록</button>
      </div>

      <div className="card 거르개" style={{ paddingBottom: 14 }}>
        <div className="row tight" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 2, marginBottom: 0 }}>
            <label htmlFor="q">찾기</label>
            <input id="q" value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="성명 · 아이디 · 연락처 · 사번 · 읍면동" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="f-role">역할</label>
            <select id="f-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">전체</option>
              {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="f-dong">거주 읍면동</label>
            <select id="f-dong" value={dong} onChange={(e) => setDong(e.target.value)}>
              <option value="">전체</option>
              {dongs.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, flex: 0, whiteSpace: 'nowrap' }}>
            <label htmlFor="f-res">계약종료</label>
            <label className="check">
              <input id="f-res" type="checkbox" checked={showResigned}
                     onChange={(e) => setShowResigned(e.target.checked)} />
              함께 보기
            </label>
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
              {sorted.map((s, i) => (
                <tr key={s.id} className="clickable" onClick={() => navigate(`/staff/${s.id}`)}
                    style={s.status === 'resigned' ? { opacity: .5 } : undefined}>
                  {/* 연번은 지금 화면에 보이는 순서입니다. 거르거나 정렬하면 다시 매겨집니다. */}
                  <td className="mono small muted" style={{ textAlign: 'right' }}>{i + 1}</td>
                  <td>
                    <span className="name">{s.name}</span>
                    {s.payrollExcluded && (
                      <span className="tag 중단" style={{ marginLeft: 6 }}>별도관리</span>
                    )}
                    {s.dong && <div className="muted small">{s.dong}</div>}
                    {s.status === 'resigned' && (
                      <div className="muted small">{s.resignedAt} 계약종료</div>
                    )}
                    {/* 휴직 — 쉬고 있을 뿐 우리 사람입니다. 명단에 남되 표를 답니다. */}
                    {s.status === 'leave' && (
                      <div className="deadline">
                        휴직 중{s.leaveTo ? ` · ${s.leaveTo} 복귀 예정` : ''}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="svcs">
                      {s.rolesKo.map((r) => <span key={r} className="svc">{r}</span>)}
                    </span>
                  </td>
                  <td className="mono small">{s.loginId}</td>
                  <td className="mono small">{s.phone || '—'}</td>
                  <td className="small">{s.hiredOn || '—'}</td>
                  <td className="small">{s.contractOn || '—'}</td>
                  <td className="small">
                    {!s.isWorker ? <span className="muted">—</span>
                      : s.matchNow > 0
                      ? <b>{s.matchNow}명</b>
                      : <span className="muted">없음{s.matchAll ? ` (지난 ${s.matchAll})` : ''}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 && (
          <div className="empty">
            {q || role || dong ? '조건에 맞는 사람이 없습니다.' : '아직 등록된 종사자가 없습니다.'}
          </div>
        )}
      </div>
    </>
  )
}
