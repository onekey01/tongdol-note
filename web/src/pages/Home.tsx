import { useEffect, useState, useCallback } from 'react'
import 인쇄단추 from '../components/인쇄단추'
import { api } from '../lib/api'
import { linkProps } from '../lib/router'
import 기기바뀜 from '../lib/기기바뀜'

/**
 * 홈 — 오늘 손을 대야 하는 것만.
 *
 * 지자체는 「이 사람 끝났습니다」라고 따로 알려주지 않습니다.
 * 명단에 적힌 기간이 지나면 그걸로 끝인데, 그걸 놓치면
 * **끝난 사람이 이용 중으로 남아** 다음 정산과 보고가 통째로 어긋납니다.
 *
 * 그래서 프로그램이 세고, **판단과 처리는 여기서 사람이** 합니다.
 * 자동으로 종결시키지 않는 이유는 — 지자체가 전화로 먼저 연장을 알려 주고
 * 문서는 나중에 오는 일이 실제로 있기 때문입니다.
 */

type Sec = { key: string; title: string; help: string; tone: 'err' | 'warn' | 'ok' }

const SECTIONS: Sec[] = [
  {
    /*
     * 맨 위입니다. 오늘 손댈 것 중 **가장 급합니다.**
     * 서비스는 정해졌는데 갈 사람이 없다는 뜻이고,
     * 이대로 하루가 가면 그날 서비스는 그냥 안 나간 것이 됩니다.
     */
    key: 'unassigned', title: '제공인력이 안 붙은 대상자', tone: 'err',
    help: '서비스는 정해졌는데 갈 사람이 없습니다. 이름을 눌러 배정하거나, 「배정하기」로 바로 가세요.',
  },
  {
    /*
     * 생애한도는 **넘기면 그 돈을 기관이 떠안습니다.**
     * 그래서 다 쓴 뒤가 아니라 80%부터 올립니다 —
     * 공사를 잡기 전에 알아야 취소할 수 있습니다.
     */
    key: '한도임박', title: '생애한도가 다 되어 가는 대상자', tone: 'err',
    help: '한도를 넘긴 금액은 지자체가 안 줍니다. 공사를 잡기 전에 남은 금액을 확인해 주세요.',
  },
  {
    /*
     * ── 연간 지원한도 (7-마) ────────────────────────────────
     *
     * 위의 「생애한도」와 **다른 것**입니다. 그건 공사 한 건이고,
     * 이건 한 사람이 **올해 받은 일상생활돌봄 전체**입니다.
     *
     * 계약서 4조가 어르신께 「연간 지원한도액에서 차감됩니다」라고
     * 약속한 그 숫자입니다. **넘긴 뒤에 알면 이미 나간 돈**입니다.
     */
    key: '연간임박', title: '올해 지원한도가 다 되어 가는 대상자', tone: 'err',
    help: '넘긴 금액은 지자체가 안 줍니다. 다음 달 계획을 짜기 전에 남은 금액을 확인해 주세요.',
  },
  {
    key: 'expired', title: '기간이 모두 끝난 대상자', tone: 'err',
    help: '받는 서비스가 하나도 남지 않았습니다. 종결할지, 중단할지, 연장되었는지 정해 주세요.',
  },
  {
    key: 'suspended', title: '중단한 지 90일이 지난 대상자', tone: 'err',
    help: '지침상 종결 검토 대상입니다.',
  },
  {
    key: 'noShow', title: '식사지원을 연속으로 못 받은 대상자', tone: 'warn',
    help: '계약서 5-2조 — 3회 연속이면 통합돌봄 서비스 전체가 중지됩니다.',
  },
  {
    key: 'soon', title: '2주 안에 기간이 끝나는 대상자', tone: 'warn',
    help: '지자체에 연장 여부를 미리 물어볼 수 있습니다.',
  },
]

/** 한 사람에 대해 할 수 있는 일 — 종결 · 중단 · 연장. */
function Actions({ p, onDone }: { p: any; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [until, setUntil] = useState('')
  const [why, setWhy] = useState('')

  async function status(to: string, ask: string) {
    const reason = prompt(`${p.name} 님을 「${to}」 처리합니다.\n\n${ask}\n\n사유를 적어 주세요.`)
    if (reason === null) return
    setBusy(true)
    try { await api.changeStatus(p.id, { status: to, reason }); onDone() }
    finally { setBusy(false) }
  }

  async function doExtend() {
    if (!until) return
    setBusy(true)
    try { await api.extendRecipient(p.id, until, why); setOpen(false); onDone() }
    catch (e: any) { alert(e.message) }
    finally { setBusy(false) }
  }

  return (
    <>
      <div className="btns" style={{ justifyContent: 'flex-end' }}>
        <button disabled={busy} onClick={() => setOpen(!open)}>연장</button>
        <button disabled={busy}
                onClick={() => status('중단', '90일이 지나면 종결 검토 대상이 됩니다.')}>
          중단
        </button>
        <button className="danger" disabled={busy}
                onClick={() => status('종결', '기록은 5년간 그대로 남습니다.')}>
          종결
        </button>
      </div>
      {open && (
        <div className="card" style={{ marginTop: 10, marginBottom: 0 }}>
          <p className="note small" style={{ marginTop: 0 }}>
            지자체가 연장을 알려 왔는데 새 명단은 아직 안 온 경우에 씁니다.
            <b> 기간이 끝난 의뢰만</b> 이 날짜까지 미룹니다. 늘린 기록이 남습니다.
          </p>
          <div className="row tight" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>언제까지</label>
              <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 2, marginBottom: 0 }}>
              <label>근거</label>
              <input value={why} onChange={(e) => setWhy(e.target.value)}
                     placeholder="○○○ 주무관 전화 통보" />
            </div>
            <div className="field" style={{ flex: 0, marginBottom: 0 }}>
              <button className="primary" disabled={busy || !until} onClick={doExtend}>
                연장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Person({ p, sec, onDone }: { p: any; sec: string; onDone: () => void }) {
  return (
    <tr>
      <td>
        <a {...linkProps(`/recipients/${p.id}`)} className="name">{p.name}</a>
        <div className="muted small">
          {[p.dong, p.age != null ? `${p.age}세` : '', p.phone].filter(Boolean).join(' · ')}
        </div>
      </td>
      <td className="small">
        {sec === 'expired' && (
          <>
            <b className="mono">{p.endedOn}</b> 로 끝남
            <span className="muted"> ({p.daysSince}일 지남)</span>
            <div className="muted small">
              {p.services.map((v: any) => `${v.name} ${v.cycle ?? ''}`).join(' · ')}
            </div>
          </>
        )}
        {sec === 'soon' && (
          <>
            <b className="mono">{p.endsOn}</b> 까지
            <span className={p.daysLeft <= 7 ? 'deadline' : 'muted'}> ({p.daysLeft}일 남음)</span>
            <div className="muted small">{p.services.map((v: any) => v.name).join(' · ')}</div>
          </>
        )}
        {sec === 'suspended' && (
          <>
            <b className="mono">{p.since}</b> 부터 중단
            <span className="muted"> (기한 {p.deadline} · {-p.daysLeft}일 지남)</span>
            {p.reason && <div className="muted small">{p.reason}</div>}
          </>
        )}
        {sec === 'noShow' && (
          <>
            연속 <b>{p.streak}회</b> 미수령
            {p.lastOn && <span className="muted"> (마지막 {p.lastOn})</span>}
            <div className="muted small">3회가 되면 통합돌봄 서비스 전체가 중지됩니다.</div>
          </>
        )}
        {sec === '한도임박' && (
          <>
            <b>{p.service}</b>{' '}
            {p.넘음
              ? <span className="deadline">
                  한도를 <b>{(-p.남은돈).toLocaleString('ko-KR')}원</b> 넘겼습니다
                </span>
              : <>남은 금액 <b>{p.남은돈.toLocaleString('ko-KR')}원</b>
                  <span className="muted"> ({p.비율}% 씀)</span></>}
            <div className="muted small">
              한도 {p.한도.toLocaleString('ko-KR')}원 중{' '}
              {p.쓴돈.toLocaleString('ko-KR')}원 · 마지막 {p.마지막}
            </div>
          </>
        )}
        {sec === '연간임박' && (
          <>
            {p.넘음
              ? <span className="deadline">
                  올해 한도를 <b>{(-p.남은돈).toLocaleString('ko-KR')}원</b> 넘겼습니다
                </span>
              : <>올해 남은 금액 <b>{p.남은돈.toLocaleString('ko-KR')}원</b>
                  <span className="muted"> ({p.비율}% 씀)</span></>}
            <div className="muted small">
              연간 한도 {p.한도.toLocaleString('ko-KR')}원 중{' '}
              {p.쓴돈.toLocaleString('ko-KR')}원 씀
              {' · '}안전생활환경개선은 이 숫자에 안 들어갑니다
            </div>
          </>
        )}
        {sec === 'unassigned' && (
          <>
            {p.since
              ? <>
                  <b className="mono">{p.since}</b> 부터
                  <span className={(p.daysWaiting ?? 0) >= 7 ? 'deadline' : 'muted'}>
                    {' '}({p.daysWaiting ?? 0}일째 갈 사람 없음)
                  </span>
                </>
              : <span className="deadline">갈 사람이 없습니다</span>}
            <div className="muted small">
              {p.services?.map((v: any) => `${v.name}${v.cycle ? ` ${v.cycle}` : ''}`).join(' · ')}
            </div>
          </>
        )}
      </td>
      <td style={{ width: 320 }}>
        {sec === '한도임박'
          ? <div className="btns" style={{ justifyContent: 'flex-end' }}>
              <a {...linkProps('/stats')} className="btn-like">생애한도 전체 보기</a>
            </div>
          : sec === '연간임박'
          ? <div className="btns" style={{ justifyContent: 'flex-end' }}>
              <a {...linkProps(`/recipients/${p.id}`)} className="btn-like">대상자 보기</a>
            </div>
          : sec === 'unassigned'
          ? <div className="btns" style={{ justifyContent: 'flex-end' }}>
              <a {...linkProps('/assign')} className="btn-like primary">배정하기</a>
            </div>
          : sec === 'noShow'
          ? <div className="btns" style={{ justifyContent: 'flex-end' }}>
              <a {...linkProps(`/recipients/${p.id}`)} className="btn-like">대상자 화면에서 처리</a>
            </div>
          : <Actions p={p} onDone={onDone} />}
      </td>
    </tr>
  )
}

/* ══════════════════════════════════════════════════════════════
 *  USB 로 오간 자료 — 홈 맨 위 띠
 * ══════════════════════════════════════════════════════════════
 *
 * (2026-09-06 무무 — 「USB에 백업된 파일을 가지고 집에서 작업 시
 *  다음날 출근하여 백업USB를 기관PC에 꽂아 프로그램을 열면
 *  최신 데이터로 동기화 해줘야 해」)
 *
 * ★ **홈에 띄우는 것이 핵심입니다.** 설정 깊은 데 두면, 어제 집에서
 *   한 일이 있다는 것을 모른 채 사무실 자료함에 계속 적습니다.
 *   그러면 두 갈래가 점점 벌어져서 나중에는 어느 쪽도 못 버립니다.
 *
 * ★ **여기서 가져오지 않습니다.** 자료함을 통째로 바꾸는 일이라,
 *   무엇이 사라지는지 표로 보고 나서 누르게 합니다 —
 *   설정 · 일반 · 백업으로 보냅니다.
 */
/**
 * ── 설정 점검 — **프로그램이 스스로 말합니다** ─────────────────
 *
 * (`할일.md` 8번 — 「홈에 설정 점검 한 줄. **문서는 안 읽혀도 홈은
 *  매일 봅니다**」)
 *
 * 최초 설정 마법사가 단가·한도는 눈앞에 보여 주고 확인받습니다.
 * 그런데 **공휴일은 달력을 손에 들고 있어야** 넣을 수 있어 그 자리에서
 * 못 묻습니다. 그래서 넣으실 때까지 여기서 말합니다.
 *
 * ★ 고칠 곳으로 **바로 가는 길**을 답니다. 「무엇이 잘못됐다」만
 *   말하고 어디서 고치는지 안 알려 주면, 관리자는 설정 화면을
 *   헤매다 그냥 닫습니다.
 */
function 설정점검({ 목록 }: { 목록?: { 무엇: string; 말: string; 어디: string }[] }) {
  if (!목록?.length) return null
  return (
    <div className="card warn" style={{ marginBottom: 12 }}>
      <h2 style={{ marginTop: 0 }}>설정을 한 번 봐 주세요</h2>
      <ul className="plain" style={{ margin: 0 }}>
        {목록.map((x, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            <b>{x.무엇}</b> — {x.말.replace(/\*\*/g, '')}
            {' '}<a href={x.어디}>설정에서 고치기</a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function USB띠({ v }: { v: any }) {
  if (!v?.띄울까) return null
  const 갈라짐 = v.판단 === '갈라짐'
  return (
    <div className={갈라짐 ? 'card warn USB띠' : 'card USB띠'}>
      <h2 style={{ margin: '0 0 6px' }}>
        {갈라짐
          ? '★ USB 와 이 컴퓨터에서 따로 적으셨습니다'
          : 'USB 에 이 컴퓨터에 없는 것이 있습니다'}
      </h2>
      <p className="note small" style={{ margin: '0 0 10px' }}>
        {갈라짐 ? (
          <>
            USB 에만 <b>{v.저쪽에만}건</b>, 이 컴퓨터에만 <b>{v.이쪽에만}건</b> 있습니다.
            <b> 가져오면 이 컴퓨터에만 있는 {v.이쪽에만}건이 사라집니다.</b><br />
            무엇이 사라지는지 표로 보시고 정하세요. 가져오기 전에 지금 자료를
            한 부 떠 두므로, 잘못 눌러도 돌아올 자리가 있습니다.
          </>
        ) : (
          <>
            집에서 하신 것으로 보입니다 — <b>{v.저쪽에만}건</b>.
            이 컴퓨터에만 있는 것은 <b>없습니다</b>, 그대로 가져오시면 됩니다.
          </>
        )}
      </p>
      <a {...linkProps('/settings')} className="btn">백업에서 살펴보기</a>
    </div>
  )
}

export default function Home() {
  const [d, setD] = useState<any>(null)
  const load = useCallback(async () => { setD(await api.home()) }, [])
  useEffect(() => { load().catch(() => {}) }, [load])

  if (!d) return <p className="muted">불러오는 중…</p>

  const c = d.counts
  /*
   * 「오늘 손댈 것」에 **제공인력이 안 붙은 분을 넣습니다.**
   *
   * 넣지 않았더니 위에는 빨간 글씨로 「세 분에게 안 붙었습니다」가 떠 있는데
   * 바로 아래에서 「오늘 손댈 것이 없습니다」라고 했습니다.
   * 화면이 스스로 말을 뒤집으면, 사람은 둘 중 어느 쪽도 안 믿습니다.
   */
  const todo = c.대기중 + c.expired + c.suspended + c.noShow + (c.한도임박 ?? 0) + (c.연간임박 ?? 0)

  return (
    <>
      {/*
        홈은 「오늘 손댈 것」을 모아 둔 자리라, 그대로 뽑으면
        **종결·중단 검토 명단**이 됩니다 — 회의에 그대로 들고 갑니다.
      */}
      <인쇄단추 무엇="오늘 손댈 것 (종결·중단 검토 명단)" 수={todo}
                덧말={`기준일 ${d.today}`}
                조건={[
                  c.expired ? `기간 끝남 ${c.expired}명` : '',
                  c.soon ? `2주 내 종결 ${c.soon}명` : '',
                  c.suspended ? `중단 ${c.suspended}명` : '',
                  c.대기중 ? `담당 없음 ${c.대기중}명` : '',
                ]} />

      <div className="main-head">
        <h1>홈</h1>
        <span className="muted small">{d.today}</span>
      </div>

      {/*
        ★ 맨 위입니다. 제공인력이 새 휴대폰으로 들어온 것은 **오늘 안에
          눈으로 봐야 하는** 일입니다. 본인이면 그냥 두면 되지만,
          아니면 그 폰이 어르신 자료를 보고 있는 것입니다.
      */}
      <기기바뀜 />

      <USB띠 v={d.USB} />
      <설정점검 목록={d.설정점검} />

      {/*
        오늘 손을 대야 하는 숫자만 놓습니다.
        종결·전체는 「지금 무엇을 할까」에 답을 주지 않습니다 — 통계 탭 몫입니다.
      */}
      <div className="row tight" style={{ alignItems: 'stretch' }}>
        {[
          { label: '이용 중', v: c.이용, help: '서비스를 받고 있는 분' },
          { label: '대기중', v: c.대기중, help: '제공인력이 안 붙은 분', warn: c.대기중 > 0,
            to: '/assign' },
          { label: '중단', v: c.중단, help: '잠시 멈춘 분' },
          { label: '2주 내 종결 대상', v: c.soon, help: '기간이 곧 끝나는 분', warn: c.soon > 0 },
        ].map((x) => (
          <div key={x.label} className={x.warn ? 'card warn' : 'card'}
               style={{ margin: 0, textAlign: 'center' }}>
            <div className="muted small">{x.label}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{x.v ?? 0}</div>
            <div className="muted" style={{ fontSize: '.68rem' }}>{x.help}</div>
          </div>
        ))}
      </div>

      {todo === 0 ? (
        <div className="card">
          <h2>오늘 손댈 것이 없습니다</h2>
          <p className="note" style={{ marginBottom: 0 }}>
            제공인력이 안 붙은 분도, 기간이 끝난 분도, 90일이 지난 중단자도,
            식사를 연속으로 못 받은 분도 없습니다.
            {c.soon > 0 && <> 다만 <b>{c.soon}명</b>이 2주 안에 기간이 끝납니다 — 아래를 보세요.</>}
          </p>
        </div>
      ) : (
        <div className="msg err">
          손댈 것이 <b>{todo}건</b> 있습니다.
          {c.대기중 > 0 && ` 제공인력 안 붙음 ${c.대기중}명`}
          {c.expired > 0 && `${c.대기중 > 0 ? ' · ' : ' '}기간 끝남 ${c.expired}명`}
          {c.suspended > 0 && ` · 중단 90일 경과 ${c.suspended}명`}
          {c.noShow > 0 && ` · 식사 연속 미수령 ${c.noShow}명`}
        </div>
      )}

      {SECTIONS.map((s) => {
        const list = d[s.key] as any[]
        if (!list?.length) return null
        return (
          <div key={s.key} className={s.tone === 'err' ? 'card warn' : 'card'}
               style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 0' }}>
              <h2>
                {s.title}
                <span className="muted small" style={{ fontWeight: 400, marginLeft: 8 }}>
                  {list.length}명
                </span>
              </h2>
              <p className="note small" style={{ marginTop: -4 }}>{s.help}</p>
            </div>
            <div className="table-wrap">
              <table>
                <tbody>
                  {list.map((p) => (
                    <Person key={p.id} p={p} sec={s.key} onDone={load} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </>
  )
}
