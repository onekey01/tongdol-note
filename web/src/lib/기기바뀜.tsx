/**
 * 홈 맨 위의 **「새 휴대폰으로 들어왔습니다」 알림.**
 *
 * ── 왜 승인을 안 받고 알림만 하나 ───────────────────────────
 *
 * 처음에는 사무실이 승인해야 들어가게 할까 했습니다. 그러면 폰을 바꾼
 * 제공인력이 **현장에 선 채로 사무실 전화를 기다립니다.** 관리자가
 * 반차라도 내면 그날 일이 통째로 멎습니다.
 *
 * 그래서 **바로 들여보내고, 사무실은 나중에 봅니다.**
 * (2026-09-05 무무 — 「바로 들어가고 사무실은 나중에 본다」)
 *
 * 대신 이 알림이 반드시 눈에 띄어야 합니다. 모르는 새 남이 들어왔다면
 * 「이 기기 끊기」를 누르는 순간 그 폰은 아무것도 못 봅니다.
 *
 * ── 「끊기」와 「퇴사」는 다릅니다 ───────────────────────────
 *
 * 끊기는 **기기만** 뗍니다. 본인이면 다시 로그인하면 그만입니다.
 * 폰을 잃어버렸을 때 쓰는 것입니다. 그 사람 자체를 막는 것은
 * 종사자 화면의 「계약 종료」입니다.
 */
import { useEffect, useState, useCallback } from 'react'
import { api } from './api'

type 바뀜 = {
  때: string; 이름: string; 인력id: number; 인력번호: string; 끊은수: number
}

function 언제(iso: string) {
  const d = new Date(iso)
  const 오늘 = new Date()
  const 같은날 = d.toDateString() === 오늘.toDateString()
  const 시각 = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return 같은날 ? `오늘 ${시각}` : `${d.getMonth() + 1}월 ${d.getDate()}일 ${시각}`
}

export default function 기기바뀜() {
  const [목록, set목록] = useState<바뀜[]>([])
  const [바쁨, set바쁨] = useState('')

  /*
   * 관리자만 볼 수 있습니다(서버가 403 을 냅니다). 제공인력이 사무실
   * 화면을 열었을 때 오류가 뜨면 안 되므로 조용히 비웁니다.
   */
  const 보기 = useCallback(async () => {
    try { set목록((await api.기기바뀜()).목록 ?? []) } catch { set목록([]) }
  }, [])

  useEffect(() => {
    보기()
    // 사무실이 홈을 켜 둔 채 있을 수 있으니 이따금 다시 봅니다.
    const t = setInterval(보기, 30_000)
    return () => clearInterval(t)
  }, [보기])

  if (!목록.length) return null

  return (
    <>
      {목록.map((b) => (
        <div className="card warn" key={b.때}>
          <h2 style={{ marginTop: 0 }}>
            {b.이름} 님이 새 휴대폰으로 들어왔습니다
          </h2>
          <p className="note">
            {언제(b.때)}
            {b.끊은수 > 0
              ? ' · 전에 쓰시던 기기는 끊겼습니다.'
              : ' · 이 분의 첫 휴대폰입니다.'}
          </p>
          <p className="note">
            본인이 폰을 바꾸셨거나 다른 브라우저로 여신 것이면
            <b> 그냥 두시면 됩니다.</b> 짚이는 데가 없으시면 아래를 누르세요 —
            그 휴대폰은 그 자리에서 아무것도 못 보게 됩니다.
          </p>
          <div className="row tight">
            <button
              className="danger"
              disabled={바쁨 === b.때}
              onClick={async () => {
                if (!confirm(
                  `${b.이름} 님의 휴대폰을 끊습니다.\n\n` +
                  `그 휴대폰은 바로 아무것도 못 보게 됩니다.\n` +
                  `본인이시면 아이디와 비밀번호로 다시 들어오시면 됩니다.\n\n` +
                  `끊으시겠습니까?`
                )) return
                set바쁨(b.때)
                try { await api.기기끊기(b.인력번호, b.때) } catch (e: any) { alert(e.message) }
                set바쁨(''); 보기()
              }}
            >{바쁨 === b.때 ? '끊는 중…' : '이 기기 끊기'}</button>
            <button
              className="plain"
              onClick={async () => { await api.기기바뀜지우기(b.때).catch(() => {}); 보기() }}
            >확인했습니다</button>
          </div>
        </div>
      ))}
    </>
  )
}
