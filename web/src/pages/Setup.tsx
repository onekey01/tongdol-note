import { useState } from 'react'
import 주소칸 from '../components/AddressField'
import { api } from '../lib/api'

/**
 * 프로그램을 처음 켰을 때 딱 한 번 나오는 화면입니다.
 * 여기서 기관과 관리자 계정이 만들어집니다.
 * 나머지 기관 정보(사업자번호·계좌 등)는 설정에서 언제든 채울 수 있게 두었습니다.
 * 처음부터 다 물으면 시작을 못 합니다.
 */
export default function Setup({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    orgName: '', phone: '', address: '', addressDetail: '',
    adminName: '', loginId: '', password: '', password2: '',
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (f.password !== f.password2) return setErr('비밀번호 두 칸이 서로 다릅니다.')
    setBusy(true)
    try {
      await api.setup(f)
      onDone()
    } catch (e: any) {
      setErr(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="center">
      <form className="panel wide" onSubmit={submit}>
        <div className="panel-head">
          <p className="eyebrow">처음 한 번</p>
          <h1>기관을 개설합니다</h1>
          <p className="note">
            여기서 입력한 내용은 이 PC 안의 자료함 파일에만 저장됩니다.
            바깥으로 나가지 않습니다.
          </p>
        </div>

        {err && <div className="msg err">{err}</div>}

        <h3>기관</h3>
        <div className="field">
          <label htmlFor="orgName">기관명</label>
          <input id="orgName" value={f.orgName} onChange={set('orgName')}
                 autoFocus required />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="phone">대표 전화</label>
            <input id="phone" value={f.phone} onChange={set('phone')} />
          </div>
        </div>

        {/* 기관 주소는 청구서·영수증 머리글에 그대로 찍혀 나갑니다. */}
        <주소칸 id="address" value={f.address}
                onChange={(주소) => setF({ ...f, address: 주소 })}
                상세={f.addressDetail}
                상세바꿈={(상세) => setF({ ...f, addressDetail: 상세 })} />

        <h3 style={{ marginTop: 20 }}>관리자 계정</h3>
        <div className="row">
          <div className="field">
            <label htmlFor="adminName">이름</label>
            <input id="adminName" value={f.adminName} onChange={set('adminName')} placeholder="홍길동" />
          </div>
          <div className="field">
            <label htmlFor="loginId">아이디</label>
            <input id="loginId" value={f.loginId} onChange={set('loginId')}
                   autoComplete="username" required />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="password">비밀번호</label>
            <input id="password" type="password" value={f.password} onChange={set('password')}
                   autoComplete="new-password" required />
          </div>
          <div className="field">
            <label htmlFor="password2">비밀번호 확인</label>
            <input id="password2" type="password" value={f.password2} onChange={set('password2')}
                   autoComplete="new-password" required />
          </div>
        </div>

        <p className="note small">
          비밀번호는 되돌릴 수 없는 형태로 바뀌어 저장됩니다.
          잊으면 저희도 알 수 없으니 적어 두세요.
        </p>

        <div className="btns" style={{ marginTop: 18 }}>
          <button className="primary wide" disabled={busy}>
            {busy ? '만드는 중…' : '기관 개설하기'}
          </button>
        </div>
      </form>
    </div>
  )
}
