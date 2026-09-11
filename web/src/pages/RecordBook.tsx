import { useEffect, useState, useCallback, Fragment } from 'react'
import { api } from '../lib/api'
import { 메모보드열기 } from '../lib/memo'

/**
 * 기록지 — **매달 지자체에 내는 단 하나의 서식.**
 *
 * 서비스 제공일과 회차는 실적에서 저절로 채워집니다.
 * 회차는 최초 제공일부터 **누적**이라 달이 갈수록 길어지는 칸인데,
 * 손으로 쓰면 가장 고통스럽고 프로그램이 대신하면 가장 크게 줄어드는 자리입니다.
 *
 * **사람이 써야 하는 것은 두 칸뿐입니다** — 상태변화 상세내용과 비고.
 * 그 달에 무엇을 보고 어떻게 판단했는지는 실적에서 뽑아낼 수 없습니다.
 */

function thisMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function shift(m: string, by: number) {
  const [y, mm] = m.split('-').map(Number)
  const d = new Date(y, mm - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 한 사람 펼치기 — 미리보기와 사람이 쓸 두 칸. */
function Detail({ id, month, states, onSaved, pdf된다 }: {
  id: string; month: string; states: string[]; onSaved: () => void; pdf된다: boolean
}) {
  const [g, setG] = useState<any>(null)
  const [sc, setSc] = useState('변화없음')
  const [detail, setDetail] = useState('')
  const [remark, setRemark] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let live = true
    api.recordbookOne(id, month).then((x) => {
      if (!live) return
      setG(x); setSc(x.note.statusChange); setDetail(x.note.detail); setRemark(x.note.remark)
    }).catch((e) => setMsg(e.message))
    return () => { live = false }
  }, [id, month])

  if (!g) return (
    <tr><td colSpan={8} style={{ padding: 16 }}><span className="muted">불러오는 중…</span></td></tr>
  )

  async function save() {
    setBusy(true); setMsg('')
    try {
      await api.saveRecordNote(id, { month, statusChange: sc, detail, remark })
      setMsg('저장했습니다.')
      onSaved()
    } catch (e: any) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  return (
    <tr className="detail">
      <td colSpan={8} style={{ padding: '14px 22px 18px', background: 'var(--surface-2)' }}>
        {msg && <div className="msg ok">{msg}</div>}

        <div className="table-wrap" style={{ marginBottom: 14 }}>
          <table>
            <thead>
              <tr>
                <th>구분</th><th>중분류</th><th>소분류</th><th>서비스명</th>
                <th>주기</th><th>최초 제공일</th>
                <th className="right">이 달</th><th className="right">누적</th>
              </tr>
            </thead>
            <tbody>
              {g.services.map((s: any) => (
                <tr key={s.serviceId}>
                  <td className="small">{s.catL}</td>
                  <td className="small">{s.catM}</td>
                  <td className="small">{s.catS}</td>
                  <td><span className="svc">{s.name}</span></td>
                  <td className="small">{s.cycle || '—'}</td>
                  <td className="mono small">{s.first || '—'}</td>
                  <td className="right mono">{s.thisMonth}</td>
                  <td className="right mono"><b>{s.total}</b>회차</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {g.sheets > 1 && (
          <div className="msg err">
            서비스가 {g.services.length}종이라 <b>{g.sheets}장</b>으로 나뉩니다.
            서식이 가진 줄이 5개뿐이라 행을 늘리면 한글이 파일을 열지 않습니다.
          </div>
        )}

        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>대상자 상태변화 여부</label>
            <div className="pick">
              {states.map((k) => (
                <button key={k} type="button" aria-pressed={sc === k}
                        onClick={() => setSc(k)}>{k}</button>
              ))}
            </div>
          </div>
          <div className="field" style={{ flex: 2 }}>
            <label htmlFor={`d-${id}`}>
              상태변화 상세내용
              <span className="muted"> — 한 줄에 하나씩. 「- 」는 저절로 붙습니다</span>
            </label>
            <textarea id={`d-${id}`} rows={5} value={detail}
                      onChange={(e) => setDetail(e.target.value)}
                      placeholder={'주 2회 밑반찬 배달을 계획대로 제공하였으며 대면 수령을 유지함.\n외모 변화에 만족감을 표하시고 정기 이용 의사를 밝히심.'} />
          </div>
          <div className="field" style={{ flex: 2 }}>
            <label htmlFor={`r-${id}`}>비고</label>
            <textarea id={`r-${id}`} rows={5} value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder={'보호자(아들)와 상담하여 가정 복귀 시점까지 일시 중단 조치함.'} />
          </div>
        </div>

        <div className="btns">
          <button className="primary" disabled={busy} onClick={save}>
            {busy ? '저장 중…' : '적은 글 저장'}
          </button>
          {/* 파일 이름을 여기서도 적어 둡니다.
              서버가 보내는 이름을 못 읽는 경우가 있어 둘 다 걸어 둡니다. */}
          <a className="btn-like" href={`/api/recordbook/${id}/file?month=${month}`}
             download={`${month}_기록지_${g.recipient.name}${g.sheets > 1 ? '.zip' : '.hwpx'}`}>
            한글 {g.sheets > 1 ? `(${g.sheets}장 zip)` : '(.hwpx)'}
          </a>
          {/* PDF 는 한글이 만듭니다. 한글이 없는 PC 에서는 단추를 감춥니다. */}
          {pdf된다 && (
            <a className="btn-like" href={`/api/recordbook/${id}/pdf?month=${month}`}
               download={`${month}_기록지_${g.recipient.name}.pdf`}>
              PDF
            </a>
          )}
        </div>
        <p className="note small" style={{ marginBottom: 0, marginTop: 10 }}>
          <b>서비스 제공일과 회차는 실적에서 저절로 채워집니다.</b>{' '}
          회차는 최초 제공일부터 누적이라 달이 갈수록 길어집니다 —
          작성예시의 7월 기록지에 5월 28일이 1회차로 적혀 있는 것이 그 뜻입니다.
        </p>
      </td>
    </tr>
  )
}

export default function RecordBook() {
  const [month, setMonth] = useState(thisMonth)
  const [d, setD] = useState<any>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  // PDF 는 한글 프로그램이 만듭니다 — 이 PC 에서 되는지 한 번 물어봅니다.
  const [pdf, setPdf] = useState<{ 된다: boolean; 왜: string } | null>(null)

  const load = useCallback(async () => {
    setD(await api.recordbook(month))
  }, [month])

  useEffect(() => { load().catch((e) => setMsg(e.message)) }, [load])
  useEffect(() => { api.pdfOk().then(setPdf).catch(() => setPdf({ 된다: false, 왜: '' })) }, [])

  if (!d) return <p className="muted">불러오는 중…</p>

  const 못쓴것 = d.items.filter((x: any) => x.needsWriting).length

  return (
    <>
      <div className="main-head">
        <h1>기록지</h1>
        <div className="btns" style={{ marginLeft: 12 }}>
          <button onClick={() => setMonth(shift(month, -1))}>◀</button>
          <b style={{ minWidth: 96, textAlign: 'center' }}>
            {month.split('-')[0]}년 {Number(month.split('-')[1])}월
          </b>
          <button onClick={() => setMonth(shift(month, 1))}>▶</button>
          {month !== thisMonth() && (
            <button className="plain" onClick={() => setMonth(thisMonth())}>이번 달</button>
          )}
        </div>
        <div className="spacer" />
        {/* 지자체는 한글과 PDF 를 함께 받습니다. 둘의 내용·장수는 똑같습니다. */}
        {d.items.length > 0 && (
          <div className="btns">
            <a className="btn-like primary" href={`/api/recordbook/all?month=${month}`}
               download={`${month}_기록지_${d.items.length}명.zip`}>
              {d.items.length}명 한글 (zip)
            </a>
            {pdf?.된다 && (
              <a className="btn-like primary" href={`/api/recordbook/all/pdf?month=${month}`}
                 download={`${month}_기록지_${d.items.length}명.pdf`}>
                {d.items.length}명 PDF (한 파일)
              </a>
            )}
          </div>
        )}
      </div>

      {msg && <div className="msg err">{msg}</div>}

      <div className="card">
        <p className="note small" style={{ margin: 0 }}>
          <b>매달 지자체에 내는 것은 이 기록지 하나입니다.</b>{' '}
          서비스 제공일과 회차는 실적에서 저절로 채워지고,
          <b> 사람이 쓸 것은 상태변화 상세내용과 비고 두 칸뿐</b>입니다.
          이름을 눌러 적고, 다 적었으면 위에서 받아 메일로 보내시면 됩니다.
          {pdf?.된다
            ? <> <b>PDF 는 한글이 만듭니다</b> — 한글에서 「파일 → PDF로 저장」 을
                누른 것과 같은 파일이라 서식이 그대로입니다.</>
            : <> PDF 단추는 <b>한글이 깔린 PC</b> 에서만 보입니다.
                지금은 한글 파일(.hwpx)을 받아 한글에서 「PDF로 저장」 하시면 됩니다 —
                종이는 똑같이 나옵니다.</>}
          {' '}용지는 <b>가로</b>로 나옵니다. 서식의 표가 가로 A4 에 딱 맞게 만들어져 있습니다.
          {못쓴것 > 0 && (
            <><br /><span className="deadline">
              아직 상세내용을 안 적은 분이 {못쓴것}명 있습니다.
            </span></>
          )}
        </p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'right' }}>연번</th>
                <th>대상자</th>
                <th className="right">서비스</th>
                <th className="right">제공</th>
                <th className="right">미제공</th>
                <th className="right">장수</th>
                <th>상태변화</th>
                <th>상세내용</th>
              </tr>
            </thead>
            <tbody>
              {d.items.map((x: any, i: number) => (
                <Fragment key={x.id}>
                  <tr className="clickable"
                      onClick={() => {
                        /*
                         * 이름을 누르면 그 칸이 펼쳐지고, **그 어르신 메모도 옆에 뜹니다.**
                         * 상태변화 상세내용과 비고는 그 달에 무엇을 보았는지 적는 칸인데,
                         * 그때 참고할 것이 바로 그 어르신 메모입니다.
                         * 종이로 일할 때 서류철에서 쪽지를 꺼내 옆에 두는 것과 같습니다.
                         * 접으면 기관 보드로 돌아갑니다.
                         */
                        const 열것 = open === x.id ? null : x.id
                        setOpen(열것)
                        메모보드열기(열것 ? x.id : '', x.name)
                      }}>
                    <td className="mono small muted" style={{ textAlign: 'right' }}>{i + 1}</td>
                    <td>
                      <span className="name">{x.name}</span>
                      {x.dong && <div className="muted small">{x.dong}</div>}
                    </td>
                    <td className="right mono">{x.services}</td>
                    <td className="right mono">{x.served}</td>
                    <td className="right mono">
                      {x.missed ? <span className="deadline">{x.missed}</span> : '—'}
                    </td>
                    <td className="right mono">
                      {x.sheets > 1 ? <b>{x.sheets}</b> : x.sheets}
                    </td>
                    <td className="small">{x.statusChange}</td>
                    <td className="small">
                      {x.needsWriting
                        ? <span className="deadline">아직 안 적음</span>
                        : <span className="muted">
                            {x.detail.split('\n')[0].slice(0, 28)}…
                          </span>}
                    </td>
                  </tr>
                  {open === x.id && (
                    <Detail id={x.id} month={month} states={d.states}
                            onSaved={load} pdf된다={!!pdf?.된다} />
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {d.items.length === 0 && (
          <div className="empty">
            이 달에 낼 기록지가 없습니다.<br />
            <span className="small">
              「제공실적」에서 다녀온 날을 먼저 적어 주세요. 제공 실적이 있어야 기록지가 나옵니다.
            </span>
          </div>
        )}
      </div>
    </>
  )
}
