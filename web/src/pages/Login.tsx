import { useState } from 'react'
import { api } from '../lib/api'

export default function Login({ onDone, orgName }: { onDone: () => void; orgName?: string }) {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await api.login(loginId, password)
      onDone()
    } catch (e: any) {
      setErr(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="center">
      <form className="panel" onSubmit={submit}>
        <div className="panel-head">
          <p className="eyebrow">{orgName || '통돌 Note'}</p>
          <h1>로그인</h1>
        </div>

        {err && <div className="msg err">{err}</div>}

        <div className="field">
          <label htmlFor="id">아이디</label>
          <input id="id" value={loginId} onChange={(e) => setLoginId(e.target.value)}
                 autoComplete="username" autoFocus required />
        </div>
        <div className="field">
          <label htmlFor="pw">비밀번호</label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                 autoComplete="current-password" required />
        </div>

        <button className="primary wide" disabled={busy} style={{ marginTop: 6 }}>
          {busy ? '확인 중…' : '들어가기'}
        </button>

        <p className="note small" style={{ marginTop: 16, marginBottom: 0 }}>
          자리를 비울 때는 로그아웃해 주세요. 화면에 대상자 정보가 그대로 남습니다.
        </p>
      </form>
    </div>
  )
}
