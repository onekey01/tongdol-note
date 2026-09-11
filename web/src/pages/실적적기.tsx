/**
 * 사무실이 **현장 몫을 직접 적는** 칸.
 *
 * ═══════════════════════════════════════════════════════════
 *  왜 필요한가
 * ═══════════════════════════════════════════════════════════
 *
 * 현장앱이 다 좋아도 이런 날이 있습니다 —
 *
 *   · 폰이 고장 났거나 배터리가 나갔다
 *   · 아직 폰을 안 쓰는 인력이 있다
 *   · 종이로 적어 온 것을 옮겨 적어야 한다
 *   · 찍긴 찍었는데 한 칸을 잘못 눌렀다
 *
 * 그때 사무실이 손을 못 대면 **그 달 서식은 통째로 손으로 쓰게 됩니다.**
 * 프로그램을 쓰는 뜻이 없어집니다.
 * (2026-09-05 무무 — 「새로 뜬 창은 현장에서 실행한 것 처럼
 *  관리자가 데이터를 입력할 수 도 있어야 해」)
 *
 * ═══════════════════════════════════════════════════════════
 *  ★ 서식을 그대로 따릅니다 ★
 * ═══════════════════════════════════════════════════════════
 *
 * 묻는 것이 서비스마다 다릅니다. **편람 서식과 한 글자도 다르지
 * 않게** 물어야 나중에 옮겨 적을 것이 없습니다.
 *
 *   서식3 가사지원 — 열한 가지 중 해 드린 것에 ○
 *   서식4 식사관리 — 제공형태 · 장소 · **식단(주식·반찬)**
 *                    ★ 서식에 「식단 포함 필수」라고 못 박혀 있습니다
 *   서식5 동행·이미용 — 제공장소 · 서비스내용
 *
 * 무엇을 물을지는 `server/서식갈래.ts` 가 정합니다 — **현장앱과 같은
 * 함수**입니다. 두 곳에서 따로 가리면 언젠가 어긋납니다.
 */
import { useState, useRef, useEffect } from 'react'

/**
 * 서식3 의 열한 가지 — **기본값일 뿐입니다.**
 *
 * 실제 목록은 서버가 칸마다 실어 보냅니다 (`c.확인사항`). 이미 적힌
 * 건은 **적을 때 화면에 있던 목록**이 오고, 아직 안 적은 칸은 지금
 * 목록이 옵니다. (2026-09-06 무무 — 「확인사항 항목이 바뀔 경우
 * 실행 시의 목록으로 서식을 뽑아」)
 *
 * 서버가 아무것도 안 보낸 옛 화면에서만 이 열한 가지를 씁니다.
 */
export const 가사항목 = [
  '목욕보조', '배변보조', '옷입기보조', '식사도움', '체위변경',
  '재활운동보조', '청소', '세탁', '취사', '외출동행', '말벗',
]

/** "2026-09-05T09:30:00" → "09:30". 빈 값이면 빈 글자. */
function 시각칸(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * ── 서명을 마우스로 받습니다 ────────────────────────────────
 *
 * 종이로 받아 온 것을 옮길 때 씁니다. 어르신이 직접 여기 그리시는
 * 일은 없습니다 — 그건 현장앱이 할 일입니다.
 *
 * 손가락으로도 되게 포인터 이벤트를 씁니다. 사무실에 터치 화면이
 * 있을 수 있고, 있으면 그게 훨씬 자연스럽습니다.
 */
function 서명판({ 값, 바뀜 }: { 값: string | null; 바뀜: (v: string | null) => void }) {
  const 종이 = useRef<HTMLCanvasElement>(null)
  const 그리는중 = useRef(false)
  const [뭔가그렸나, set뭔가그렸나] = useState(!!값)

  useEffect(() => {
    const c = 종이.current
    if (!c) return
    /*
     * 화면 배율만큼 크게 잡아야 글씨가 안 뭉갭니다. 서명은 나중에
     * 서식에 그대로 들어가는 그림이라 흐리면 못 씁니다.
     */
    const 배 = window.devicePixelRatio || 1
    const 폭 = c.clientWidth, 높 = c.clientHeight
    c.width = 폭 * 배; c.height = 높 * 배
    const g = c.getContext('2d')!
    g.scale(배, 배)
    g.lineWidth = 2.2
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.strokeStyle = '#111'
    if (값) {
      const img = new Image()
      img.onload = () => g.drawImage(img, 0, 0, 폭, 높)
      img.src = 값
    }
  }, [])

  const 자리 = (e: React.PointerEvent) => {
    const r = 종이.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  return (
    <div>
      <canvas
        ref={종이}
        className="서명판"
        onPointerDown={(e) => {
          그리는중.current = true
          /*
           * 캡처는 **되면 좋고 안 되면 그만**입니다. 손가락이 종이 밖으로
           * 나가도 선이 이어지게 하는 것뿐인데, 브라우저에 따라 던집니다.
           * 그것 때문에 서명 자체가 안 그려지면 안 됩니다.
           */
          try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { }
          const g = 종이.current!.getContext('2d')!
          const { x, y } = 자리(e)
          g.beginPath(); g.moveTo(x, y)
        }}
        onPointerMove={(e) => {
          if (!그리는중.current) return
          const g = 종이.current!.getContext('2d')!
          const { x, y } = 자리(e)
          g.lineTo(x, y); g.stroke()
          if (!뭔가그렸나) set뭔가그렸나(true)
        }}
        onPointerUp={() => {
          그리는중.current = false
          바뀜(종이.current!.toDataURL('image/png'))
        }}
      />
      <div className="row tight" style={{ marginTop: 6 }}>
        <button className="plain 작은단추" type="button" onClick={() => {
          const c = 종이.current!
          c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
          set뭔가그렸나(false); 바뀜(null)
        }}>지우고 다시</button>
        {!뭔가그렸나 && <span className="muted small">이 칸에 마우스로 그리세요.</span>}
      </div>
    </div>
  )
}

export type 적을것 = {
  시작?: string; 종료?: string
  적은것?: Record<string, any>
  서명?: string | null
  새사진?: string[]          // data:image/…;base64,…
}

export default function 실적적기({ it, c, 그만, 보내기 }: {
  it: any; c: any
  그만: () => void
  보내기: (값: 적을것) => Promise<void>
}) {
  const 현장 = c.현장 ?? {}
  const 적은것 = 현장.적은것 ?? {}
  const 갈래 = it.갈래 ?? '기타'

  const [시작, set시작] = useState(시각칸(c.시작))
  const [종료, set종료] = useState(시각칸(c.종료))
  const [한것, set한것] = useState<string[]>(적은것.한것 ?? [])
  const [기타, set기타] = useState(String(적은것.기타 ?? ''))
  const [제공형태, set제공형태] = useState(String(적은것.제공형태 ?? ''))
  const [장소, set장소] = useState(String(적은것.장소 ?? ''))
  const [주식, set주식] = useState(String(적은것.주식 ?? ''))
  const [반찬, set반찬] = useState(String(적은것.반찬 ?? ''))
  const [내용, set내용] = useState(String(적은것.내용 ?? ''))
  const [특이사항, set특이사항] = useState(String(적은것.특이사항 ?? ''))
  const [서명, set서명] = useState<string | null>(현장.서명 ?? null)
  const [새사진, set새사진] = useState<string[]>([])
  const [바쁨, set바쁨] = useState(false)
  const [오류, set오류] = useState('')

  /*
   * 이 건에 쓸 확인사항 목록. 서버가 준 것이 먼저입니다.
   *
   * ★ **이미 눌러 둔 것 중 목록에 없는 것도 보여 줍니다.** 관리자가
   *   목록을 고친 뒤 옛 건을 열면, 목록에서 빠진 항목이 화면에서
   *   사라졌다가 저장하는 순간 **진짜로 없어집니다.** 그러면
   *   시각 하나 고치려고 연 것이 그날 한 일을 지웁니다.
   */
  const 온목록: string[] = Array.isArray(c.확인사항) && c.확인사항.length
    ? c.확인사항 : 가사항목
  const 보일목록 = [...온목록, ...한것.filter((x) => !온목록.includes(x))]

  const 켬 = (x: string) =>
    set한것((전) => 전.includes(x) ? 전.filter((y) => y !== x) : [...전, x])

  async function 파일고름(e: React.ChangeEvent<HTMLInputElement>) {
    const 것들 = [...(e.target.files ?? [])]
    if (!것들.length) return
    if (것들.length > 8) { set오류('사진은 한 번에 여덟 장까지입니다.'); return }
    const 읽은것: string[] = []
    for (const f of 것들) {
      if (f.size > 8 * 1024 * 1024) { set오류(`${f.name} 이 8MB 를 넘습니다.`); return }
      읽은것.push(await new Promise<string>((맞음, 틀림) => {
        const r = new FileReader()
        r.onload = () => 맞음(String(r.result))
        r.onerror = () => 틀림(new Error('사진을 못 읽었습니다.'))
        r.readAsDataURL(f)
      }))
    }
    set새사진(읽은것); set오류('')
  }

  async function 냄() {
    set바쁨(true); set오류('')
    try {
      const 적: Record<string, any> = { 특이사항 }
      if (갈래 === '가사') { 적.한것 = 한것; 적.기타 = 기타 }
      else if (갈래 === '식사') { 적.제공형태 = 제공형태; 적.장소 = 장소; 적.주식 = 주식; 적.반찬 = 반찬 }
      else if (갈래 === '동행' || 갈래 === '이미용') { 적.장소 = 장소; 적.내용 = 내용 }
      else { 적.내용 = 내용 }

      await 보내기({
        시작, 종료, 적은것: 적,
        서명: 서명 !== (현장.서명 ?? null) ? 서명 : undefined,
        새사진: 새사진.length ? 새사진 : undefined,
      })
    } catch (e: any) {
      set오류(e.message ?? '적지 못했습니다.')
    } finally {
      set바쁨(false)
    }
  }

  return (
    <div className="실적칸 적는칸">
      <div className="실적이름표">
        사무실에서 적기
        {it.서식 && <span className="한것딱지">{it.서식} 대로</span>}
      </div>
      <p className="small muted" style={{ margin: '0 0 10px' }}>
        폰으로 못 올린 것을 여기서 적습니다. 적은 칸에는
        <b> 「관리자 수정함」</b>이 붙습니다. 서식에는 폰으로 올린 것과
        똑같이 나갑니다.
      </p>

      {/* ── 진행시간 ── */}
      <div className="field">
        <label className="이름표">진행시간</label>
        <div className="row tight" style={{ alignItems: 'center' }}>
          <input type="time" value={시작} onChange={(e) => set시작(e.target.value)}
                 style={{ maxWidth: 130 }} />
          <span className="muted">~</span>
          <input type="time" value={종료} onChange={(e) => set종료(e.target.value)}
                 style={{ maxWidth: 130 }} />
        </div>
        <p className="small muted" style={{ margin: '4px 0 0' }}>
          서식8 「진행시간 ○○:○○~○○:○○」 칸에 그대로 들어갑니다.
        </p>
      </div>

      {/* ── 갈래별 ── */}
      {갈래 === '가사' && (
        <div className="field">
          <label className="이름표">
            해 드린 것 <span className="muted small">— 해당하는 것을 모두 고르세요</span>
          </label>
          <div className="고름">
            {보일목록.map((x) => (
              <label key={x} className="칸고름"
                     title={온목록.includes(x) ? undefined
                       : '지금 목록에는 없는 항목입니다 — 이 건을 적을 때는 있었습니다'}>
                <input type="checkbox" checked={한것.includes(x)} onChange={() => 켬(x)} />
                <span>{x}{온목록.includes(x) ? '' : ' *'}</span>
              </label>
            ))}
          </div>
          <input value={기타} onChange={(e) => set기타(e.target.value)}
                 placeholder="그 밖에 해 드린 것 (직접 적기)"
                 style={{ marginTop: 8 }} />
          {보일목록.some((x) => !온목록.includes(x)) && (
            <p className="small muted" style={{ margin: '6px 0 0' }}>
              <b>*</b> 표는 <b>지금 확인사항 목록에는 없는 항목</b>입니다 —
              이 건을 적을 때는 있었습니다. 껐다 켜지 않는 한 그대로 남습니다.
            </p>
          )}
        </div>
      )}

      {갈래 === '식사' && (
        <>
          <div className="field">
            <label className="이름표">제공 형태</label>
            <div className="고름 둘">
              {['대면 배달', '비대면 배달'].map((x) => (
                <label key={x} className="칸고름">
                  <input type="radio" name="제공형태" checked={제공형태 === x}
                         onChange={() => set제공형태(x)} />
                  <span>{x}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="이름표">제공 장소</label>
            <input value={장소} onChange={(e) => set장소(e.target.value)}
                   placeholder="예) 자택 현관" />
          </div>
          {/*
            ★ 서식4 에 「식단 포함 **필수**」라고 못 박혀 있습니다.
              비워 두면 나중에 서식을 못 냅니다.
          */}
          <div className="field">
            <label className="이름표">
              식단 <span style={{ color: 'var(--bad)' }}>— 서식4 필수</span>
            </label>
            <div className="row tight">
              <input value={주식} onChange={(e) => set주식(e.target.value)}
                     placeholder="주식 (예: 흰죽)" />
              <input value={반찬} onChange={(e) => set반찬(e.target.value)}
                     placeholder="반찬 (예: 계란찜, 김치)" />
            </div>
          </div>
        </>
      )}

      {(갈래 === '동행' || 갈래 === '이미용') && (
        <>
          <div className="field">
            <label className="이름표">제공 장소</label>
            <input value={장소} onChange={(e) => set장소(e.target.value)}
                   placeholder="예) 해남종합병원 정형외과" />
          </div>
          <div className="field">
            <label className="이름표">서비스 내용</label>
            <textarea rows={3} value={내용} onChange={(e) => set내용(e.target.value)}
                      placeholder={'1. 병원까지 동행\n2. 접수·수납 도움\n3. 귀가 동행'} />
          </div>
        </>
      )}

      {갈래 === '기타' && (
        <div className="field">
          <label className="이름표">무엇을 해 드렸는지</label>
          <textarea rows={3} value={내용} onChange={(e) => set내용(e.target.value)} />
        </div>
      )}

      {/* ── 특이사항 ── */}
      <div className="field">
        <label className="이름표">특이사항</label>
        <textarea rows={3} value={특이사항} onChange={(e) => set특이사항(e.target.value)}
                  placeholder="예) 무릎이 아프시다고 하셔서 외출은 다음으로 미뤘습니다" />
        <p className="small muted" style={{ margin: '4px 0 0' }}>
          적으시면 <b>대상자 메모지로도</b> 넘어갑니다 — 기록지 쓰실 때 보입니다.
        </p>
      </div>

      {/* ── 사진 ── */}
      <div className="field">
        <label className="이름표">사진</label>
        <input type="file" accept="image/*" multiple onChange={파일고름} />
        {!!새사진.length && (
          <>
            <div className="실적사진판" style={{ marginTop: 8 }}>
              {새사진.map((x, i) => (
                <span key={i} className="실적사진"><img src={x} alt="" /></span>
              ))}
            </div>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              {새사진.length}장을 넣습니다. <b>저장을 눌러야</b> 올라갑니다.
            </p>
          </>
        )}
      </div>

      {/* ── 서명 ── */}
      <div className="field">
        <label className="이름표">이용자 확인서명</label>
        <p className="small muted" style={{ margin: '0 0 6px' }}>
          종이로 받아 오신 것을 옮길 때만 쓰세요. 어르신이 직접 하시는 것은
          현장앱이 받습니다.
        </p>
        <서명판 값={서명} 바뀜={set서명} />
      </div>

      {오류 && <div className="msg err" style={{ marginTop: 10 }}>{오류}</div>}

      <div className="row tight" style={{ marginTop: 12 }}>
        <button className="primary" disabled={바쁨} onClick={냄}>
          {바쁨 ? '저장 중…' : '저장'}
        </button>
        <button className="plain" disabled={바쁨} onClick={그만}>그만두기</button>
      </div>
    </div>
  )
}
