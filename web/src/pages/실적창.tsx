/**
 * 제공실적 한 칸을 눌렀을 때 뜨는 창.
 *
 * ── 왜 만들었나 ────────────────────────────────────────────
 *
 * 예전에는 칸을 누를 때마다 상태가 **돌았습니다**
 * (계획 → 제공 → 미제공 → 계획). 손으로 찍던 시절에는 그것이 빨랐습니다.
 *
 * 그런데 현장앱이 붙으면서 한 칸이 들고 있는 것이 많아졌습니다 —
 * 진행시간, 무엇을 해 드렸는지, 사진, 이용자 서명, 나중에 고친 기록.
 * 이걸 달력 한 칸에 넣을 수가 없고, 넣어도 안 읽힙니다.
 *
 * 그리고 **눌러 도는 것은 위험합니다.** 「제공」을 보려고 눌렀는데
 * 「미제공」이 되어 버립니다. 실제로 그러다 실적이 틀어졌습니다.
 *
 * 그래서 **누르면 열어서 보여 주고, 고치는 것은 그 안에서** 합니다.
 * (2026-09-05 무무 지시)
 */
import { useEffect, useState } from 'react'
import 실적적기, { type 적을것 } from './실적적기'

const 요일 = ['일', '월', '화', '수', '목', '금', '토']

function 시분(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function 때말(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-`
    + `${String(d.getDate()).padStart(2, '0')} ${시분(iso)}`
}
/** 몇 시간 몇 분. 「1시간 30분」처럼 사람 말로. */
function 걸린시간(시작?: string | null, 끝?: string | null) {
  if (!시작 || !끝) return ''
  const 분 = Math.round((new Date(끝).getTime() - new Date(시작).getTime()) / 60000)
  if (분 <= 0 || !isFinite(분)) return ''
  const h = Math.floor(분 / 60), m = 분 % 60
  return h ? `${h}시간 ${m ? `${m}분` : ''}`.trim() : `${m}분`
}

/**
 * 휴일이라고 적는 말.
 *
 * 달력은 토·일과 공휴일을 **한 덩어리로** 「휴일」로 다룹니다 — 할증이
 * 붙는 것이 같기 때문입니다. 그런데 화면에까지 토요일을 「공휴일」이라고
 * 적으면 안 됩니다. **토요일은 공휴일이 아닙니다.**
 */
function 휴일말(c: any) {
  if (!c.holiday) return ''
  if (c.dow === 0) return ' · 일요일'
  if (c.dow === 6) return ' · 토요일'
  return ' · 공휴일'
}

/**
 * ── 「관리자 수정함」 ────────────────────────────────────────
 *
 * 사무실이 손댄 칸에만 **작은 글씨로** 붙습니다.
 * (2026-09-05 무무 — 「구분해서 남기되 관리자가 수정한 부분에 한해서
 *  작은 글씨로 관리자 수정함이라고 표시만 해주면 될 것 같아」)
 *
 * 서식으로 나갈 때는 폰으로 찍은 것과 **똑같이** 나갑니다.
 * 이 표시는 화면에서만 봅니다 — 군에서 「누가 적었느냐」를 물으면
 * 답할 수 있어야 하고, 무엇보다 사무실 자신이 헷갈리지 않아야 합니다.
 */
function 손댐({ 현장, 칸 }: { 현장: any; 칸: string }) {
  const 것 = 현장?.관리자고침?.[칸]
  if (!것) return null
  return <span className="손댐">관리자 수정함</span>
}

/** 서식3 가사지원의 열한 가지. 고른 것만 보여 줍니다. */
function 한것줄(현장: any) {
  const 한것: string[] = 현장?.적은것?.한것 ?? []
  const 기타 = String(현장?.적은것?.기타 ?? '').trim()
  if (!한것.length && !기타) return null
  return (
    <div className="실적줄">
      <span>해 드린 것<손댐 현장={현장} 칸="적은것.한것" /></span>
      <span>
        {한것.map((x) => <span key={x} className="한것딱지">{x}</span>)}
        {기타 && <span className="한것딱지 기타">{기타}</span>}
      </span>
    </div>
  )
}

export default function 실적창({ it, c, 닫기, 상태바꾸기, 분적기, 갈래고치기, 현장적기,
                                 사유들 = [] }: {
  it: any; c: any; 닫기: () => void
  /** 못 간 사유를 **여기서 골라** 함께 넘깁니다 (2026-09-09). */
  상태바꾸기: (다음: string, 대면?: boolean, 사유?: string) => void
  /** 고를 수 있는 못 간 사유 — 서버가 정한 목록 그대로입니다. */
  사유들?: string[]
  분적기: () => void
  갈래고치기: () => void
  /** 사무실이 현장 몫을 직접 적습니다. 저장하면 화면을 다시 불러옵니다. */
  현장적기: (값: 적을것) => Promise<void>
}) {
  const 현장 = c.현장
  const [큰그림, set큰그림] = useState<string | null>(null)
  const [적는중, set적는중] = useState(false)
  /*
   * ── 못 간 사유를 **창 안에서** 고릅니다 (2026-09-09) ────────
   *
   * 예전에는 브라우저 prompt 가 떠서 사유를 **손으로 쳐야** 했습니다.
   * 사유는 정해진 목록인데 타이핑을 시키면 「부제」·「병원」처럼
   * 목록에 없는 말이 들어가고, 그게 **그대로 기록지에 실려 지자체로
   * 나갑니다.** 눌러서 고르면 그런 일이 없습니다.
   */
  const [사유고르기, set사유고르기] = useState(false)

  // Esc 로 닫습니다. 창을 열어 두고 다른 일을 하려는 사람이 반드시 있습니다.
  useEffect(() => {
    const 눌림 = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      /*
       * 적는 중에 Esc 로 창이 통째로 닫히면 **적던 것이 날아갑니다.**
       * 그때는 적기만 접습니다.
       */
      if (큰그림) set큰그림(null)
      else if (적는중) set적는중(false)
      else 닫기()
    }
    window.addEventListener('keydown', 눌림)
    return () => window.removeEventListener('keydown', 눌림)
  }, [닫기, 큰그림, 적는중])

  const 비대면 = c.state === '제공' && c.대면 === false

  return (
    <div className="덮개" onClick={닫기}>
      <div className="실적창" onClick={(e) => e.stopPropagation()}>
        <div className="실적창머리">
          <div>
            <b>{it.recipient}</b> <span className="muted">· {it.service}</span>
            <div className="small muted">
              {c.on} ({요일[c.dow]}){휴일말(c)}
            </div>
          </div>
          <button className="plain 닫기단추" onClick={닫기} aria-label="닫기">✕</button>
        </div>

        {/* ── 지금 상태를 고릅니다 ─────────────────────────── */}
        <div className="실적칸">
          <div className="실적이름표">이 날</div>
          <div className="상태고름">
            {[
              { 값: '계획', 글: '계획', 대면: undefined as boolean | undefined },
              ...(it.대면원칙
                ? [{ 값: '제공', 글: '대면 배달', 대면: true },
                   { 값: '제공', 글: '비대면 배달', 대면: false }]
                : [{ 값: '제공', 글: '제공', 대면: undefined as boolean | undefined }]),
              { 값: '미제공', 글: '미제공', 대면: undefined as boolean | undefined },
            ].map((x, i) => {
              const 지금인가 = x.값 === c.state
                && (x.대면 === undefined || x.대면 === (c.대면 !== false))
              return (
                <button key={i}
                        className={'상태단추' + (지금인가 ? ' 지금' : '')}
                        disabled={c.on > (it.today ?? '9999')}
                        onClick={() => {
                          // 미제공은 **까닭부터** 고릅니다. 창은 안 닫습니다.
                          if (x.값 === '미제공' && 사유들.length) {
                            set사유고르기(true)
                            return
                          }
                          상태바꾸기(x.값, x.대면)
                          /*
                           * ★ 고르고 나면 **저절로 닫힙니다** (2026-09-05).
                           *
                           *   예전에는 칸을 한 번 누르면 상태가 돌았습니다.
                           *   창으로 바뀌면서 열고·고르고·닫고 **세 번**이
                           *   되었는데, 한 달치를 훑어 찍는 일이라 값이
                           *   나갑니다. 고르는 것이 이 창을 연 목적이었다면
                           *   거기서 끝나는 것이 맞습니다.
                           *
                           *   ★ 적는 중이면 안 닫습니다 — 적던 것이 날아갑니다.
                           *   사진을 보려고 여신 때는 애초에 안 고르십니다.
                           */
                          if (!적는중) 닫기()
                        }}>
                  {x.글}
                </button>
              )
            })}
          </div>
          {/*
            ── 못 간 까닭 고르기 ─────────────────────────────────
            상태 단추 바로 아래에 폅니다. 창을 새로 띄우지 않는 이유는
            한 달치를 훑어 찍는 일이라 창이 하나 더 뜨면 손이 늦어지고,
            무엇보다 **어느 날 칸을 눌렀는지**가 눈에서 사라지기 때문입니다.
          */}
          {사유고르기 && (
            <div className="실적줄" style={{ display: 'block' }}>
              <p style={{ margin: '0 0 8px', fontWeight: 600 }}>못 간 까닭을 골라 주세요</p>
              <div className="row tight" style={{ flexWrap: 'wrap', gap: 6 }}>
                {사유들.map((r) => (
                  <button key={r} className="상태단추"
                          onClick={() => {
                            set사유고르기(false)
                            상태바꾸기('미제공', undefined, r)
                            if (!적는중) 닫기()
                          }}>
                    {r}
                  </button>
                ))}
              </div>
              <p className="note small" style={{ margin: '8px 0 0' }}>
                여기서 고른 말이 <b>그대로 기록지에 실려 지자체로 나갑니다.</b>
                {' '}맞는 것이 없으면 「기타」를 고르고, 자세한 것은 기록지의
                <b> 비고</b>에 적어 주세요.
              </p>
              <div className="btns" style={{ marginTop: 8 }}>
                <button className="plain" onClick={() => set사유고르기(false)}>그만두기</button>
              </div>
            </div>
          )}

          {c.state === '미제공' && (
            <div className="실적줄">
              <span>못 간 까닭</span>
              <span>
                {c.missKind ? <b>{c.missKind}</b> : <i className="muted">안 적음</i>}
                {c.reason ? ` — ${c.reason}` : ''}
                {c.늦음 && <span className="한것딱지 늦음">늦게 알림</span>}
                <button className="plain 작은단추" onClick={갈래고치기}>고치기</button>
              </span>
            </div>
          )}
          {비대면 && (
            <p className="small" style={{ margin: '6px 0 0' }}>
              <b>비대면도 제공입니다.</b> 음식은 이미 만들어져 나갔으니 비용이 나갑니다.
              <b> 3회 연속이면 서비스가 중지</b>됩니다.
            </p>
          )}
          {it.unit === 'hour' && c.state === '제공' && (
            <div className="실적줄">
              <span>제공 분</span>
              <span>
                {c.minutes == null
                  ? <i className="muted">안 적음</i>
                  : <>{c.minutes}분{c.인정 != null && c.인정 !== c.minutes && ` (인정 ${c.인정}분)`}</>}
                <button className="plain 작은단추" onClick={분적기}>고치기</button>
              </span>
            </div>
          )}
        </div>

        {/* ── 현장앱에서 온 것 ─────────────────────────────── */}
        {현장 ? (
          <>
            <div className="실적칸">
              <div className="실적이름표">
                현장에서 온 것
                {c.판정 === '확인필요' && <span className="한것딱지 확인">확인필요</span>}
              </div>

              {/*
                현장에서는 다녀왔다고 올라왔는데 사무실이 「미제공」으로
                두었으면, 둘 중 하나는 틀린 것입니다. 막지는 않습니다 —
                사무실이 바로잡는 자리가 여기이기 때문입니다.
                다만 **말없이 지나가면 안 됩니다.**
              */}
              {c.state === '미제공' && (
                <p className="small" style={{ color: 'var(--bad, #8f3630)', margin: '0 0 8px' }}>
                  <b>어긋납니다.</b> 현장에서는 다녀왔다고 올라왔습니다
                  {현장.서명 ? ' — 이용자 서명까지 있습니다' : ''}.
                  그런데 여기서는 「미제공」입니다. 어느 쪽이 맞는지 확인해 주세요.
                </p>
              )}

              {(c.시작 || c.종료) && (
                <div className="실적줄">
                  <span>진행시간<손댐 현장={현장} 칸="시작" /></span>
                  <span>
                    <b>{시분(c.시작)} ~ {시분(c.종료)}</b>
                    {걸린시간(c.시작, c.종료) && (
                      <span className="muted"> · {걸린시간(c.시작, c.종료)}</span>
                    )}
                  </span>
                </div>
              )}

              {현장.표없이 && (
                <p className="small" style={{ color: 'var(--risk)', margin: '6px 0 0' }}>
                  <b>방문표를 못 찍고 손으로 적은 건입니다.</b> 다녀온 것은 맞아도
                  근거가 한 겹 얇습니다. 그 댁에 방문표가 붙어 있는지 확인해 주세요.
                </p>
              )}

              {한것줄(현장)}

              {현장.적은것?.제공형태 && (
                <div className="실적줄">
                  <span>제공 형태<손댐 현장={현장} 칸="적은것.제공형태" /></span>
                  <span>{현장.적은것.제공형태}</span>
                </div>
              )}
              {현장.적은것?.장소 && (
                <div className="실적줄">
                  <span>장소<손댐 현장={현장} 칸="적은것.장소" /></span>
                  <span>{현장.적은것.장소}</span>
                </div>
              )}
              {(현장.적은것?.주식 || 현장.적은것?.반찬) && (
                <div className="실적줄">
                  <span>식단<손댐 현장={현장} 칸="적은것.주식" /></span>
                  <span>
                    {현장.적은것.주식 && <b>{현장.적은것.주식}</b>}
                    {현장.적은것.주식 && 현장.적은것.반찬 && ' · '}
                    {현장.적은것.반찬}
                  </span>
                </div>
              )}
              {현장.적은것?.내용 && (
                <div className="실적줄">
                  <span>서비스 내용<손댐 현장={현장} 칸="적은것.내용" /></span>
                  <span style={{ whiteSpace: 'pre-line' }}>{현장.적은것.내용}</span>
                </div>
              )}
              {현장.적은것?.특이사항 && (
                <div className="실적줄">
                  <span>특이사항<손댐 현장={현장} 칸="적은것.특이사항" /></span>
                  <span style={{ whiteSpace: 'pre-line' }}>{현장.적은것.특이사항}</span>
                </div>
              )}
            </div>

            {/* 사진 */}
            {!!(현장.사진 ?? []).length && (
              <div className="실적칸">
                <div className="실적이름표">
                  사진 {현장.사진.length}장<손댐 현장={현장} 칸="사진" />
                </div>
                <div className="실적사진판">
                  {현장.사진.map((x: any) => (
                    <button key={x.자리} className="실적사진" title="눌러서 크게 보기"
                            onClick={() => set큰그림(`/api/photo/${x.자리}`)}>
                      <img src={`/api/photo/${x.자리}`} alt="현장 사진" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 서명 */}
            {현장.서명 && (
              <div className="실적칸">
                <div className="실적이름표">
                  이용자 확인서명<손댐 현장={현장} 칸="서명" />
                </div>
                {/*
                  * ★ **그림일 때만 그림으로 그립니다.**
                  *
                  *   서명은 손글씨가 `data:image/...` 로 들어옵니다. 그런데
                  *   옛 자료나 밖에서 옮겨 온 것에는 「(서명 받음)」 같은
                  *   **글자**가 들어 있을 수 있습니다. 그대로 `<img src>` 에
                  *   넣으면 **깨진 그림 아이콘**이 떠서, 서명을 못 받은 것처럼
                  *   보입니다 — 사무실이 다시 받으러 사람을 보내게 됩니다.
                  */}
                {String(현장.서명).startsWith('data:')
                  ? <img className="실적서명" src={현장.서명} alt="이용자 서명" />
                  : <p style={{ margin: 0 }}>{String(현장.서명)}</p>}
                {현장.서명받은때 && (
                  <p className="small muted" style={{ margin: '4px 0 0' }}>
                    {때말(현장.서명받은때)} 에 받았습니다
                  </p>
                )}
              </div>
            )}

            {/* 끝을 잘못 찍어 되돌린 기록 */}
            {!!(현장.되돌림 ?? []).length && (
              <div className="실적칸 고침칸">
                <div className="실적이름표">
                  종료를 되돌림 {현장.되돌림.length}번
                </div>
                {현장.되돌림.map((x: string) => (
                  <div key={x} className="실적줄"><span>{때말(x)}</span></div>
                ))}
                <p className="small muted" style={{ margin: '4px 0 0' }}>
                  끝을 잘못 찍어 제공인력이 되돌린 것입니다. 위에 적힌 종료 시각이
                  나중에 다시 찍은 것입니다. 자주 되풀이되면 그 댁의 방문표 자리를
                  한번 보아 주세요.
                </p>
              </div>
            )}

            {/* 나중에 고친 기록 */}
            {!!(현장.고침 ?? []).length && (
              <div className="실적칸 고침칸">
                <div className="실적이름표">현장에서 나중에 고침 {현장.고침.length}번</div>
                {현장.고침.map((x: string) => (
                  <div key={x} className="실적줄"><span>{때말(x)}</span></div>
                ))}
                <p className="small muted" style={{ margin: '4px 0 0' }}>
                  서명까지 마친 뒤에 제공인력이 다시 열어 고친 것입니다.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="실적칸">
            <p className="small muted" style={{ margin: 0 }}>
              현장앱에서 온 것이 없습니다.
              사무실에서 손으로 적었거나, 아직 안 올라온 건입니다.
            </p>
          </div>
        )}

        {/*
          ── 사무실이 직접 적기 ─────────────────────────────
          제공인력 평균 연령이 높아 폰에서 막히는 일이 실제로 잦습니다.
          그때 사무실이 손을 못 대면 그 달 서식을 통째로 손으로 씁니다.
          (2026-09-05 무무)
        */}
        {적는중 ? (
          <실적적기
            it={it} c={c}
            그만={() => set적는중(false)}
            보내기={async (값) => { await 현장적기(값); set적는중(false) }}
          />
        ) : c.on <= (it.today ?? '9999') && (
          <div className="실적칸" style={{ paddingTop: 10 }}>
            <button className="plain" onClick={() => set적는중(true)}>
              {현장 ? '사무실에서 고치기' : '사무실에서 적기'}
            </button>
            <p className="small muted" style={{ margin: '6px 0 0' }}>
              폰으로 못 올린 것을 여기서 적습니다 — 진행시간·해 드린 것·
              식단·특이사항·사진·서명.
              {it.서식 && <> <b>{it.서식}</b> 대로 묻습니다.</>}
            </p>
          </div>
        )}

        {/* 사진을 크게 */}
        {큰그림 && (
          <div className="큰그림" onClick={() => set큰그림(null)}>
            <img src={큰그림} alt="현장 사진 크게" />
          </div>
        )}
      </div>
    </div>
  )
}
