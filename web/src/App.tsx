import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { api, type Me, type Perms } from './lib/api'
import { useRoute, navigate } from './lib/router'
import { applyTheme, watchSystemTheme } from './theme'
import Layout from './components/Layout'
import Setup from './pages/Setup'
import 규칙마법사 from './pages/규칙마법사'
import Login from './pages/Login'
import Recipients from './pages/Recipients'
import RecipientDetail from './pages/RecipientDetail'
import Settings from './pages/Settings'
import Inbox from './pages/Inbox'
import Staff from './pages/Staff'
import Home from './pages/Home'
import Records from './pages/Records'
import 근무띠 from './lib/근무띠'
import 업데이트띠 from './lib/업데이트띠'
import Billing from './pages/Billing'
import Stats from './pages/Stats'
import RecordBook from './pages/RecordBook'
import Assign from './pages/Assign'
import StaffDetail from './pages/StaffDetail'

type Boot = {
  needsSetup: boolean; needsRules?: boolean
  user: Me | null; perms: Perms | null; org: any; today: string
  /** 버전 번호와 자료함 구조 번호. 왼쪽 위에 늘 보입니다. */
  앱?: { 버전: string; 구조: number }
}

/** 권한이 없는 곳에 주소를 직접 쳐서 들어온 경우. */
function NoEntry({ what }: { what: string }) {
  return (
    <>
      <div className="main-head"><h1>{what}</h1></div>
      <div className="card">
        <p className="note" style={{ marginTop: 0 }}>
          이 화면은 <b>지금 계정의 역할로는 열 수 없습니다.</b><br />
          필요하시면 기관 관리자에게 역할을 넓혀 달라고 하세요.
        </p>
      </div>
    </>
  )
}

export default function App() {
  const [boot, setBoot] = useState<Boot | null>(null)
  const [error, setError] = useState('')
  const path = useRoute()

  const reload = useCallback(async () => {
    try {
      setBoot(await api.bootstrap())
      setError('')
    } catch (e: any) {
      setError(e.message ?? '서버에 연결하지 못했습니다.')
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  // 테마: 저장된 선택을 붙이고, '시스템 따름'이면 OS 변경을 따라갑니다.
  useEffect(() => {
    applyTheme()
    return watchSystemTheme()
  }, [])

  // 처음 들어오면 "/" 대신 대상자 화면 주소로 맞춰 둡니다.
  // 그래야 왼쪽 차림표의 표시가 화면과 어긋나지 않습니다.
  useEffect(() => {
    if (boot?.user && path === '/')
      navigate(boot.perms?.['recipient.viewAll'] === false ? '/recipients' : '/home')
  }, [boot, path])

  if (error) {
    return (
      <div className="center">
        <div className="panel">
          <div className="panel-head">
            <p className="eyebrow">통돌 Note</p>
            <h1>서버가 응답하지 않습니다</h1>
          </div>
          <p className="note">{error}</p>
          <p className="note">
            <b>프로그램이 꺼져 있습니다.</b> 브라우저 창을 닫으면 프로그램도 함께
            꺼집니다 — 이 화면은 그 뒤에 남아 있던 것입니다.
            <br />
            <b>바탕화면의 「통돌 Note」를 다시 눌러</b> 켜 주세요.
          </p>
          <div className="btns" style={{ marginTop: 18 }}>
            <button className="primary" onClick={reload}>다시 시도</button>
          </div>
        </div>
      </div>
    )
  }

  if (!boot) {
    return <div className="center"><p className="muted">불러오는 중…</p></div>
  }

  if (boot.needsSetup) return <Setup onDone={reload} />
  if (!boot.user) return <Login onDone={reload} orgName={boot.org?.name} />
  /*
   * ── ★ 필수 설정을 안 마쳤으면 **어느 주소로 들어와도 여기** ★ ──
   *
   * (2026-09-01 무무 안 · `할일.md` 7-하 — 「기관 정보 → 관리자 등록
   *  → **필수 설정** → 홈」. 단가·한도가 손도 안 댄 채로 쓰이는 것을
   *  설명서가 아니라 **순서**로 막습니다.)
   *
   * 서버가 관리자에게만 참으로 보냅니다 — 사무직원이 켰을 때 뜨면
   * 고칠 권한도 없는 화면 앞에서 갇힙니다.
   */
  if (boot.needsRules) return <규칙마법사 onDone={reload} />

  // 로그인한 뒤의 화면들
  const detail = path.match(/^\/recipients\/([0-9a-f-]{36})$/i)
  const staffOne = path.match(/^\/staff\/(new|\d+)$/)

  const perms = boot.perms
  const blocked = (need: keyof Perms) => perms && !perms[need]

  let page: ReactNode
  if (detail) page = <RecipientDetail id={detail[1]} />
  else if (path.startsWith('/settings')) {
    page = blocked('settings.view') ? <NoEntry what="설정" /> : <Settings onOrgChange={reload} />
  }
  else if (path.startsWith('/inbox')) {
    page = blocked('referral.manage') ? <NoEntry what="의뢰 접수" /> : <Inbox />
  }
  else if (path.startsWith('/home')) {
    page = blocked('recipient.viewAll') ? <NoEntry what="홈" /> : <Home />
  }
  else if (staffOne) page = <StaffDetail id={staffOne[1]} />
  else if (path.startsWith('/assign')) page = <Assign />
  else if (path.startsWith('/records')) page = <Records />
  else if (path.startsWith('/stats')) {
    page = blocked('recipient.viewAll') ? <NoEntry what="통계" /> : <Stats />
  }
  else if (path.startsWith('/billing')) {
    page = blocked('recipient.viewAll') ? <NoEntry what="정산" /> : <Billing />
  }
  else if (path.startsWith('/recordbook')) {
    page = blocked('recipient.viewAll') ? <NoEntry what="기록지" /> : <RecordBook />
  }
  else if (path.startsWith('/staff')) {
    // 명단 전체를 못 보는 사람은 자기 화면으로 보냅니다.
    page = blocked('staff.list') ? <StaffDetail id={String(boot.user.id)} /> : <Staff />
  }
  else page = <Recipients />

  return (
    <Layout user={boot.user} orgName={boot.org?.name ?? ''} path={path} 버전={boot.앱?.버전}
            perms={perms} onLogout={reload}>
      <근무띠 />
      <업데이트띠 />
      {page}
    </Layout>
  )
}
