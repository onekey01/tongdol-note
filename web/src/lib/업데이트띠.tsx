/**
 * 화면 맨 위의 **업데이트 안내 띠.**
 *
 * ── 왜 「바뀐 것」을 그 자리에 펼치나 ───────────────────────
 *
 * 링크를 눌러 딴 데로 나가야 무엇이 바뀌었는지 알 수 있으면 아무도
 * 안 봅니다. **왜 바꿔야 하는지 모르는 갱신은 안 깝니다.** 그래서
 * 세 줄이든 열 줄이든 여기서 바로 읽히게 둡니다.
 *
 * ── 왜 글자로만 그리나 ──────────────────────────────────────
 *
 * 이 글은 **바깥에서 받아 온 것**입니다. 서명으로 「우리가 쓴 것」임을
 * 확인하긴 했지만, 그렇다고 HTML 로 넣을 까닭은 없습니다. React 가
 * 글자를 글자로 그리는 기본 동작에 그대로 맡깁니다 —
 * `dangerouslySetInnerHTML` 은 이 파일에 한 번도 나오지 않습니다.
 *
 * ── 「나중에」 ──────────────────────────────────────────────
 *
 * 영영 안 뜨게 하지 않습니다. **하루만** 접습니다. 바쁜 날 눌러 두고
 * 잊어도, 다음 날 다시 뜹니다. 「보낸 것을 안 깐 채로 지나가는 일」을
 * 막으려고 만든 기능이라 영영 끄는 단추를 두면 뜻이 없어집니다.
 * (아주 끄는 것은 설정 → 이 프로그램에 있습니다.)
 */
import { useEffect, useState, useCallback } from 'react'
import { api } from './api'

type 버전정보 = {
  버전: string; 낸날: string; 바뀐것: string[]; 꼭해야하나: boolean
}
type 형편 =
  | { 무엇: '조용' }
  | { 무엇: '받는중'; 새버전: string; 온것: number; 전체: number }
  | { 무엇: '준비됨'; 정보: 버전정보 }
  | { 무엇: '갈아끼우는중' }

function 날짜말(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  return m ? `${Number(m[2])}월 ${Number(m[3])}일` : ymd
}

export default function 업데이트띠() {
  const [형편, set형편] = useState<형편>({ 무엇: '조용' })
  const [접힘, set접힘] = useState(false)
  const [누름, set누름] = useState(false)
  const [끄는중, set끄는중] = useState('')

  /*
   * 관리자만 볼 수 있습니다(서버가 403 을 냅니다). 사무직원이 화면을
   * 열었을 때 오류가 뜨면 안 되므로 조용히 비웁니다.
   */
  const 보기 = useCallback(async () => {
    try {
      const r = await api.업데이트()
      set형편(r.형편 ?? { 무엇: '조용' })
      set접힘(!!r.접힘)
    } catch { set형편({ 무엇: '조용' }); set접힘(false) }
  }, [])

  useEffect(() => {
    보기()
    /*
     * 받는 동안에는 자주 봐야 눈금이 움직입니다. 다 받고 나면 굳이
     * 두드릴 까닭이 없어 느리게 봅니다.
     */
    const t = setInterval(보기, 형편.무엇 === '받는중' ? 2_000 : 60_000)
    return () => clearInterval(t)
  }, [보기, 형편.무엇])

  if (끄는중) {
    return (
      <div className="card 업데이트띠 하는중">
        <h2 style={{ marginTop: 0 }}>새 버전으로 바꾸는 중입니다</h2>
        <p className="note">{끄는중}</p>
        <p className="note">
          검은 창이 잠깐 지나갑니다. <b>닫지 마세요.</b> 끝나면 프로그램이
          저절로 다시 켜집니다. 이 화면은 그때 닫으셔도 됩니다.
        </p>
      </div>
    )
  }

  if (형편.무엇 === '받는중') {
    const 비율 = 형편.전체 > 0 ? Math.min(100, Math.round((형편.온것 / 형편.전체) * 100)) : 0
    return (
      <div className="card 업데이트띠 받는중">
        <p className="note" style={{ margin: 0 }}>
          새 버전({형편.새버전})을 받는 중입니다 — {비율}%
          {' '}<span className="흐림">· 그동안 하시던 일을 그대로 하시면 됩니다.</span>
        </p>
        <div className="받는눈금"><div style={{ width: `${비율}%` }} /></div>
      </div>
    )
  }

  if (형편.무엇 !== '준비됨') return null
  if (접힘) return null

  const 정보 = 형편.정보
  return (
    <div className={'card 업데이트띠 준비됨' + (정보.꼭해야하나 ? ' 꼭' : '')}>
      <h2 style={{ marginTop: 0 }}>
        새 버전({정보.버전})의 업데이트가 준비됐습니다
        <span className="흐림" style={{ fontWeight: 400 }}> · {날짜말(정보.낸날)}</span>
      </h2>

      {정보.꼭해야하나 && (
        <p className="note 꼭줄">
          <b>이 버전은 꼭 하셔야 합니다.</b> 셈이 틀리던 것을 고친 버전입니다 —
          그냥 두시면 <b>엉뚱한 청구서가 나갈 수 있습니다.</b>
        </p>
      )}

      <ul className="바뀐것">
        {정보.바뀐것.map((줄, i) => <li key={i}>{줄}</li>)}
      </ul>

      <p className="note">
        누르시면 프로그램이 <b>스스로 꺼졌다가 새 버전으로 다시 켜집니다</b>
        {' '}— 10초쯤 걸립니다. <b>적어 두신 자료는 그대로 있습니다.</b>
        {' '}전에 쓰시던 버전도 「이전버전」 폴더에 남겨 둡니다.
      </p>

      <div className="row tight">
        <button
          className="primary"
          disabled={누름}
          onClick={async () => {
            if (!confirm(
              `새 버전 ${정보.버전} 으로 바꿉니다.\n\n` +
              `· 프로그램이 잠깐 꺼졌다가 다시 켜집니다 (10초쯤)\n` +
              `· 적어 두신 자료는 그대로 있습니다\n` +
              `· 지금 다른 분이 쓰고 계시면 잠시 멈춥니다\n\n` +
              `지금 바꾸시겠습니까?`
            )) return
            set누름(true)
            try {
              const r = await api.업데이트하기()
              if (r.됨) set끄는중(r.말)
              else { alert(r.말); set누름(false) }
            } catch (e: any) { alert(e.message); set누름(false) }
          }}
        >{누름 ? '바꾸는 중…' : '지금 업데이트'}</button>
        <button
          className="plain"
          onClick={async () => { await api.업데이트나중에(정보.버전).catch(() => {}); set접힘(true) }}
        >나중에</button>
      </div>
    </div>
  )
}
