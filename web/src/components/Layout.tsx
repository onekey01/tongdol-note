import type { ReactNode } from 'react'
import { api, type Me, type Perms } from '../lib/api'
import { linkProps, navigate } from '../lib/router'
import MemoBoard from './MemoBoard'

/**
 * 차림표는 권한에 따라 줄어듭니다.
 * 제공인력에게 「설정」이 보이면 눌러 볼 수밖에 없고,
 * 눌러서 막히면 그때부터 프로그램을 못 믿습니다.
 * 애초에 안 보이는 편이 낫습니다.
 */
const MENU: { to: string; label: string; need?: keyof Perms }[] = [
  { to: '/home', label: '홈', need: 'recipient.viewAll' },
  { to: '/inbox', label: '의뢰 접수', need: 'referral.manage' },
  { to: '/recipients', label: '대상자' },
  { to: '/staff', label: '종사자' },
  { to: '/assign', label: '배정·주간계획' },
  { to: '/records', label: '제공실적' },
  { to: '/billing', label: '정산', need: 'recipient.viewAll' },
  { to: '/stats', label: '통계', need: 'recipient.viewAll' },
  { to: '/recordbook', label: '기록지', need: 'recipient.viewAll' },
  { to: '/settings', label: '설정', need: 'settings.view' },
]

// 다음 단계에서 열립니다. 미리 보여주는 이유는
// 기관이 "이게 전부인가?" 하고 오해하지 않게 하려는 것입니다.
const SOON: string[] = []

/** 지금 어느 화면인가. 인쇄 머리글에 적습니다. */
function 여기이름(path: string) {
  return MENU.find((m) => path.startsWith(m.to))?.label
      ?? (path.startsWith('/recipients/') ? '대상자' : '대상자');
}

export default function Layout({
  user, orgName, path, perms, 버전, onLogout, children,
}: {
  user: Me
  orgName: string
  path: string
  perms: Perms | null
  /** 프로그램 버전 번호. 원격으로 도울 때 첫 물음이 「지금 몇 버전 쓰세요?」입니다. */
  버전?: string
  onLogout: () => void
  children: ReactNode
}) {
  async function logout() {
    await api.logout()
    // 주소도 같이 되돌립니다. 주소만 바꾸고 화면을 안 바꾸면
    // 다시 로그인했을 때 엉뚱한 화면이 뜹니다.
    navigate('/recipients')
    onLogout()
  }

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          {/*
            버전 번호는 **여기**에 둡니다.
            설정 안쪽에 있으면 전화로 「설정 들어가서 아래로 내려서…」를
            안내해야 합니다. 켜면 바로 보이는 자리가 맞습니다.

            다만 **간판이 먼저입니다.** 이름을 크게 두고, 버전 번호는
            그 아래 줄에 작게 붙입니다 — 늘 보이되 이름을 눌러 앉히지 않게.
          */}
          <div className="name">통돌 Note</div>
          {버전 && <div className="ver" title={`이 프로그램의 버전 ${버전}`}>v{버전}</div>}
          <div className="org">{orgName}</div>
        </div>

        <nav className="nav">
          {MENU.filter((m) => !m.need || !perms || perms[m.need]).map((m) => (
            <a
              key={m.to}
              {...linkProps(m.to)}
              className={path.startsWith(m.to) ? 'on' : undefined}
            >
              {m.label}
            </a>
          ))}
          {SOON.map((s) => (
            <a key={s} className="soon" onClick={(e) => e.preventDefault()} href="#">
              {s}
            </a>
          ))}
        </nav>

        <div className="spacer" />

        <div className="side-foot">
          <div className="who">
            {user.name} 님
            <a {...linkProps(`/staff/${user.id}`)} className="small"
               style={{ display: 'block', marginTop: 2 }}>내 정보</a>
          </div>
          <button className="plain" onClick={logout}>로그아웃</button>
        </div>
      </aside>

      <main className="main">
        {/*
          ── 인쇄 머리글 ─────────────────────────────────────
          **화면에는 안 보이고 종이에만 나옵니다.**

          종이는 돌아다니다 출처를 잃습니다. 어느 기관의 무슨 화면을
          **언제 누가** 뽑았는지가 없으면, 회의 탁자에 놓인 그 장이
          이번 달 것인지 지난 달 것인지 아무도 모릅니다.

          한 곳에 두면 **모든 화면이 같은 머리글**로 나옵니다.
          화면마다 붙이면 어떤 건 있고 어떤 건 없습니다.
        */}
        <div className="print-head">
          <b>{orgName} · {여기이름(path)}</b>
          <span>{new Date().toLocaleString('ko-KR')} · {user.name}</span>
        </div>
        {children}
      </main>

      {/*
        메모 보드는 **어느 화면에서나** 열립니다.
        홈에만 두면 배정하다가 떠오른 것을 적을 수 없고,
        적으려고 홈까지 갔다 오면 하던 일을 놓칩니다.
        대상자 이름이 적힌 쪽지라 명단을 볼 수 있는 사람에게만 엽니다.
      */}
      {(!perms || perms['recipient.viewAll']) && <MemoBoard />}
    </div>
  )
}
