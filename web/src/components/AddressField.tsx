import { useEffect, useRef, useState, type ReactNode } from 'react'

/*
 * ── 주소 칸 ───────────────────────────────────────────────────
 *
 * **주소를 적는 자리는 프로그램 안에 여럿 있습니다** — 대상자, 종사자,
 * 기관 정보, 첫 설치. 예전에는 대상자 칸에만 「주소 찾기」가 있었습니다.
 * 그러면 종사자 주소만 손으로 적혀 읍면동이 달리 잡히고, 기관 주소는
 * 청구서·영수증 머리글에 그대로 찍혀 나갑니다.
 *
 * **그래서 칸 자체를 하나로 만들어 돌려 씁니다.** 한 곳만 고치면 모든
 * 자리가 같이 좋아지고, 한쪽만 고쳐 두 화면이 어긋나는 일이 없습니다.
 *
 * ── 창은 어디 것인가 ─────────────────────────────────────────
 * **카카오(다음) 우편번호 서비스** — 포털·쇼핑몰이 다 쓰는 그 창입니다.
 * **무료이고, 신청도 승인키도 없습니다.**
 *
 * 왜 우리가 만들지 않는가: 주소는 **매달 바뀝니다**(도로명 신설·폐지,
 * 건물 준공·멸실). 우리가 흉내 낸 창은 그 갱신을 못 따라가고, 그러면
 * **찾아가는 사람이 없는 주소를 들고 나갑니다.**
 *
 * ── 나가는 것 ────────────────────────────────────────────────
 * **직원이 친 검색어(도로명 등)만** 나갑니다. 대상자의 이름·전화·생년월일은
 * 이 창을 거치지 않습니다. 고른 결과는 우리 자료함에만 들어갑니다.
 *
 * ── 인터넷이 없으면 ──────────────────────────────────────────
 * 창이 안 열립니다. 그때는 **그렇다고 말하고 물러섭니다** —
 * 칸은 그대로 열려 있고 손으로 적으시면 됩니다.
 * 주소를 못 적어 등록을 못 하는 일은 없어야 합니다.
 *
 * ── 여기 안 쓰는 곳 ──────────────────────────────────────────
 * **지자체 엑셀로 들어오는 대상자**는 예외입니다. 그 주소는 지자체가
 * 준 것이라 우리가 고쳐 넣을 자리가 아닙니다 — 엑셀에 있는 대로 받습니다.
 */
const 우편번호주소 = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

export type 고른주소 = { 주소: string; 읍면동: string; 우편번호: string }

/**
 * 검색창 꾸러미를 **누르실 때** 불러옵니다.
 * 첫 화면에서 부르면 인터넷이 없는 사무실에서 로그인 화면이 멎어 보입니다.
 */
export function 우편번호읽기(): Promise<any> {
  const w = window as any
  if (w.daum?.Postcode) return Promise.resolve(w.daum.Postcode)
  if (!w.__통돌_우편번호) {
    w.__통돌_우편번호 = new Promise((풀림, 깨짐) => {
      let 끝났나 = false
      const 실패 = () => {
        if (끝났나) return
        끝났나 = true
        // 다시 눌러 보실 수 있게 지웁니다. 안 지우면 한 번 실패한 뒤로 영영 안 됩니다.
        w.__통돌_우편번호 = null
        깨짐(new Error(
          '주소 검색창을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요. ' +
          '그동안은 주소를 손으로 적으셔도 됩니다.'
        ))
      }
      // 붙들고만 있으면 화면이 멎은 것처럼 보입니다. 10초에서 끊습니다.
      const 시계 = setTimeout(실패, 10000)
      const s = document.createElement('script')
      s.src = 우편번호주소
      s.async = true
      s.onload = () => {
        if (끝났나) return
        clearTimeout(시계)
        if (w.daum?.Postcode) { 끝났나 = true; 풀림(w.daum.Postcode) } else 실패()
      }
      s.onerror = () => { clearTimeout(시계); 실패() }
      document.head.appendChild(s)
    })
  }
  return w.__통돌_우편번호
}

/**
 * 검색창이 준 것에서 우리가 쓸 것만 추립니다.
 *
 * **읍면동은 읍·면·동으로 끝나는 것만 받습니다.** 법정리 이름(「명금리」)이
 * 읍면동 칸에 들어가면 거르기와 통계가 조용히 어긋납니다.
 */
export function 주소추리기(d: any): 고른주소 {
  const 도로 = String(d?.roadAddress || d?.autoRoadAddress || '').trim()
  const 지번 = String(d?.jibunAddress || d?.autoJibunAddress || '').trim()
  const 지번고름 = d?.userSelectedType === 'J'
  const 고른것 = (지번고름 ? 지번 || 도로 : 도로 || 지번)
  // 건물명은 찾아가는 사람에게 도움이 됩니다 (「○○아파트」·「군청」).
  const 건물 = String(d?.buildingName || '').trim()
  const 주소 = 고른것 + (건물 && !지번고름 ? ` (${건물})` : '')

  const 후보 = [d?.bname1, d?.hname, d?.bname]
    .map((x: any) => String(x ?? '').trim())
  const 읍면동 = 후보.find((x) => /[읍면동]$/.test(x)) ?? ''

  return { 주소, 읍면동, 우편번호: String(d?.zonecode ?? '').trim() }
}

export function 주소고르개({ 처음, 닫기, 고름 }: {
  처음: string; 닫기: () => void; 고름: (a: 고른주소) => void
}) {
  const 담을곳 = useRef<HTMLDivElement>(null)
  const [탈, 탈로] = useState('')
  const [뜸, 뜨게] = useState(false)

  useEffect(() => {
    let 살아있나 = true
    우편번호읽기()
      .then((Postcode: any) => {
        if (!살아있나 || !담을곳.current) return
        담을곳.current.innerHTML = ''
        new Postcode({
          oncomplete: (d: any) => 고름(주소추리기(d)),
          // 창 안의 닫기를 눌러도 우리 겹창이 같이 닫혀야 합니다.
          onclose: (s: any) => { if (s?.state === 'FORCE_CLOSE') 닫기() },
          width: '100%', height: '100%',
        }).embed(담을곳.current, { autoClose: false, q: (처음 ?? '').trim() })
        뜨게(true)
      })
      .catch((e: any) => { if (살아있나) 탈로(e.message) })
    return () => { 살아있나 = false }
  }, [])

  return (
    <div className="dlg-back" onClick={닫기}>
      <div className="dlg addr-box" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-head">
          <b>주소 찾기</b>
          <div className="spacer" />
          <button type="button" className="plain" onClick={닫기}>닫기</button>
        </div>

        {/*
          검색창을 앉힐 자리에는 **우리가 아무것도 그리지 않습니다.**
          「불러오는 중」을 이 안에 넣었더니, 남의 창이 들어오면서 우리 글을
          치웠고 React 가 「없는 자식을 지우려 했다」며 화면째 죽었습니다.
          안내 글은 **옆에** 둡니다.
        */}
        {탈 ? <div className="msg err">{탈}</div> : (
          <>
            {!뜸 && <p className="note small" style={{ margin: '0 0 8px' }}>주소 검색창을 불러오는 중…</p>}
            <div className="addr-embed" ref={담을곳} />
          </>
        )}

        <p className="note small" style={{ marginTop: 10, marginBottom: 0 }}>
          도로명·지번·건물명 아무거나 넣으셔도 됩니다 (예: 「중앙1로 330」·「해남군청」).
          <br />
          고르시면 <b>상세 주소 칸으로 넘어갑니다</b> — 동·호수는 거기에 적어 주세요.
        </p>
      </div>
    </div>
  )
}

/**
 * 주소를 적는 칸 하나. 라벨 · 입력칸 · 「주소 찾기…」 단추까지 한 묶음입니다.
 *
 * - `고름` 은 **주소 말고 더 챙길 것이 있을 때만** 씁니다(대상자의 읍면동 등).
 * - 고른 뒤 커서를 칸 **맨 뒤**에 둡니다. 검색창은 건물까지만 알려 주므로
 *   동·호수는 사람이 이어 적습니다 — 포털이 상세주소 칸으로 옮겨 주는 것과
 *   같은 뜻입니다.
 */
export default function 주소칸({
  id, label = '주소', 곁말, value, onChange, 고름, placeholder, 아래,
  상세, 상세바꿈,
}: {
  id: string
  label?: string
  /** 라벨 옆에 덧붙일 것 (예: 「읍면동은 「해남읍」으로 잡힙니다」) */
  곁말?: ReactNode
  value: string
  onChange: (주소: string) => void
  고름?: (a: 고른주소) => void
  placeholder?: string
  /** 칸 아래에 덧붙일 안내 */
  아래?: ReactNode
  /*
   * 상세 주소(동·호수) 칸을 아래에 하나 더 답니다.
   *
   * **검색창은 건물까지만 알려 줍니다.** 「101동 502호」는 사람이 적어야 하는데,
   * 그것을 도로명 칸 뒤에 이어 적게 하면 다음에 주소를 다시 고를 때
   * **적어 둔 동·호수가 통째로 지워집니다.** 칸을 갈라 두면 도로명만 바뀝니다.
   * 포털이 이렇게 하는 이유가 그것입니다.
   *
   * 두 값을 주면 칸이 생기고, 안 주면 지금처럼 한 칸입니다.
   */
  상세?: string
  상세바꿈?: (상세: string) => void
}) {
  const [찾기, 찾기로] = useState(false)
  const 상세있음 = 상세 !== undefined && !!상세바꿈

  return (
    <>
      <div className="field">
        <label htmlFor={id}>{label}{곁말}</label>
        <div className="row tight" style={{ alignItems: 'stretch' }}>
          <input id={id} value={value} style={{ flex: 1 }}
                 placeholder={placeholder ?? (상세있음 ? '도로명 주소' : '찾아 넣거나 그냥 적으셔도 됩니다')}
                 onChange={(e) => onChange(e.target.value)} />
          <button type="button" style={{ flex: 'none' }}
                  onClick={() => 찾기로(true)}>주소 찾기…</button>
        </div>
        {상세있음 && (
          <input id={`${id}-detail`} value={상세} style={{ marginTop: 8 }}
                 aria-label="상세 주소"
                 placeholder="상세주소"
                 onChange={(e) => 상세바꿈!(e.target.value)} />
        )}
        {아래}
      </div>

      {찾기 && (
        <주소고르개
          처음={value}
          닫기={() => 찾기로(false)}
          고름={(a) => {
            찾기로(false)
            onChange(a.주소)
            고름?.(a)
            /*
              상세 주소 칸이 있으면 **그 칸으로 커서를 옮깁니다.** 포털이 하는 대로.
              도로명은 방금 정해졌고, 사람이 이어서 적을 것은 동·호수뿐입니다.
              값이 그려진 다음에 옮겨야 하므로 한 박자 뒤에 합니다.
            */
            setTimeout(() => {
              const 갈곳 = document.getElementById(상세있음 ? `${id}-detail` : id) as HTMLInputElement | null
              if (!갈곳) return
              갈곳.focus()
              갈곳.setSelectionRange(갈곳.value.length, 갈곳.value.length)
            }, 0)
          }} />
      )}
    </>
  )
}
