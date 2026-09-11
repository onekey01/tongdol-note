import { useEffect, useState, useCallback } from 'react'
import 인쇄단추 from '../components/인쇄단추'
import { api } from '../lib/api'
import { linkProps } from '../lib/router'

/**
 * 통계 — **한 해를 한 화면에서.**
 *
 * 지자체가 묻는 말은 정해져 있습니다.
 *
 *   「주 2회인데 왜 여섯 번뿐입니까」   → 계획 대비 실적 · 미제공 사유
 *   「이 어르신 안전생활환경개선 얼마 남았습니까」 → 생애한도
 *   「제공인력별로 몇 건씩 나갔습니까」 → 사람별 표
 *
 * 화면마다 흩어져 있으면 물어볼 때마다 세 곳을 뒤져야 합니다.
 * 한 자리에 모아 두고, **그대로 인쇄해서 들고 갑니다.**
 */

const won = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('ko-KR')

const 오늘해 = () => new Date().getFullYear()

/**
 * 달성률 막대. 숫자만 있으면 어느 쪽이 처진 것인지 눈에 안 들어옵니다.
 *
 * ★ `초과` — **계획보다 더 다녀온 건수**입니다 (2026-09-07).
 *   「월 2회」처럼 요일이 없는 서비스는 실제로 네 번 갈 수 있어서
 *   그대로 두면 200% 같은 값이 종이에 찍힙니다. 비율은 100 에서 끊고
 *   넘친 것은 옆에 **건수로** 적습니다 — 사실은 남고 종이는 멀쩡합니다.
 */
function 막대({ v, 초과 = 0 }: { v: number | null; 초과?: number }) {
  if (v === null) return <span className="muted">—</span>
  return (
    <span className="bar-wrap" title={초과 ? `${v}% · 계획보다 ${초과}건 더` : `${v}%`}>
      <span className={'bar' + (v >= 90 ? ' good' : v >= 60 ? ' mid' : ' low')}
            style={{ width: `${Math.min(100, v)}%` }} />
      <b className="bar-n">{v}%{초과 ? <span className="muted"> +{초과}</span> : null}</b>
    </span>
  )
}

/**
 * 계획 대비 실적 표 하나.
 * 서비스별·대상자별·제공인력별·행정동별이 모두 같은 모양입니다.
 *
 * **「아직」 열은 뺐습니다.** 처리율이 100% 가 아니면 그것이 곧 「아직 남았다」는
 * 말이고, 열 이름이 옆의 「처리율」과 붙어 **「아직 처리율」**로 읽혔습니다.
 * 전체 「아직」 개수는 위 요약 칸에 그대로 있습니다.
 */
function 실적표({ 줄들, 링크 }: {
  줄들: any[]; 링크?: (r: any) => string | null
}) {
  if (줄들.length === 0) {
    return <div className="empty">이 기간에는 셀 것이 없습니다.</div>
  }
  /*
   * **열 자리를 못박습니다.**
   * 표마다 이름 길이가 달라서(「가사지원」 vs 「해남읍」 vs 사람 이름)
   * 숫자 열이 표마다 다른 자리에 섰습니다. 탭을 넘길 때마다 숫자가
   * 좌우로 튀면 견주어 읽을 수가 없습니다.
   */
  return (
    <div className="table-wrap">
      <table className="grid stat-table">
        <colgroup>
          <col />
          <col style={{ width: 96 }} />
          <col style={{ width: 96 }} />
          <col style={{ width: 96 }} />
          <col style={{ width: 190 }} />
        </colgroup>
        <thead>
            <tr>
              <th>이름</th>
              <th className="right">계획</th>
              <th className="right">제공</th>
              <th className="right">미제공</th>
              <th style={{ paddingLeft: 18 }}>처리율</th>
            </tr>
          </thead>
          <tbody>
            {줄들.map((r) => {
              const to = 링크?.(r)
              return (
                <tr key={r.key}>
                  <td>
                    {to
                      ? <a className="name" {...linkProps(to)}>{r.이름}</a>
                      : <span className="name">{r.이름}</span>}
                    {r.곁말 && <div className="muted small">{r.곁말}</div>}
                  </td>
                  <td className="right mono">{r.계획}</td>
                  <td className="right mono"><b>{r.제공}</b></td>
                  <td className="right mono">
                    {r.미제공 ? <span className="deadline">{r.미제공}</span>
                             : <span className="muted">—</span>}
                  </td>
                  <td style={{ paddingLeft: 18 }}>
                    <막대 v={r.달성률} 초과={r.초과 ?? 0} />
                  </td>
                </tr>
              )
            })}
        </tbody>
      </table>
    </div>
  )
}

/** 어떤 눈으로 볼 것인가. 사람이 많아지면 한 화면에 네 표를 다 못 폅니다. */
const 보기들 = [
  { key: '서비스별', 밭: '서비스별' },
  { key: '대상자별', 밭: '대상자별' },
  { key: '제공인력별', 밭: '사람별' },
  { key: '행정동별', 밭: '행정동별' },
] as const

export default function Stats() {
  const [해, 해로] = useState(오늘해)
  const [월, 월로] = useState<number | null>(null)
  const [d, setD] = useState<any>(null)
  const [msg, setMsg] = useState('')
  const [보기, 보기로] = useState<string>('서비스별')

  const load = useCallback(async () => {
    setD(await api.stats(해, 월))
  }, [해, 월])

  useEffect(() => {
    load().catch((e) => setMsg(e.message))
  }, [load])

  if (!d) return <p className="muted">불러오는 중…</p>

  const t = d.전체
  const 한도 = d.생애한도

  return (
    <>
      <div className="main-head">
        <h1>통계</h1>
        <div className="btns" style={{ marginLeft: 12 }}>
          <button onClick={() => 해로(해 - 1)}>◀</button>
          <b style={{ minWidth: 72, textAlign: 'center' }}>{해}년</b>
          <button onClick={() => 해로(해 + 1)}>▶</button>
          {해 !== 오늘해() && (
            <button className="plain" onClick={() => 해로(오늘해())}>올해</button>
          )}
        </div>
        <div className="spacer" />
        {/*
          인쇄는 브라우저가 합니다. 따로 프로그램을 안 깔아도 되고,
          「미리보기 → PDF 로 저장」도 그대로 됩니다.
        */}
        {/*
          ★ 인쇄 단추는 **한 곳에서 만든 부품**을 씁니다
            (web/src/components/인쇄단추.tsx). 화면마다 따로 만들면
            어떤 건 거른 조건이 종이에 찍히고 어떤 건 안 찍힙니다.
        */}
        <인쇄단추 무엇="통계 · 계획 대비 실적"
                  덧말={`${해}년${월 ? ` ${월}월` : ' 한 해'}`}
                  조건={[보기 ? `보기 ${보기}` : '']} />
      </div>

      {msg && <div className="msg err">{msg}</div>}

      {/*
        ── 월 고르개 ────────────────────────────────────────────
        **열두 칸은 늘 있습니다.** 한 달을 골랐다고 나머지가 사라지면
        다른 월로 넘어가려고 「한 해」를 거쳐 돌아와야 합니다.
      */}
      <div className="card" style={{ paddingBottom: 10 }}>
        <div className="mon-tabs">
          <button className={'mon' + (월 === null ? ' on' : '')} onClick={() => 월로(null)}>
            한 해
          </button>
          {d.월별.map((x: any) => (
            <button key={x.월} disabled={!x.옴}
                    className={'mon' + (월 === x.월 ? ' on' : '')}
                    onClick={() => 월로(x.월)}>
              {x.월}월
              {x.셈함 && x.계획 > 0 && <span className="mon-n">{x.제공}</span>}
            </button>
          ))}
        </div>
        <p className="note small" style={{ marginBottom: 0, marginTop: 8 }}>
          <b>처리율</b>은 (제공 + 미제공) ÷ 계획입니다. <b>미제공도 처리한 것에 넣습니다</b> —
          사유를 적어 두었으면 지자체에 답할 수 있으니까요. 안 적힌 칸만 「아직」입니다.<br />
          <b> 돈은 여기서 안 셉니다</b> — 금액은 <b>정산</b> 화면 하나가 셈합니다.
          두 곳에서 따로 세면 언젠가 서로 다른 말을 합니다.<br />
          <b>계획</b>은 <b>몇 번 가야 하나</b>, <b>제공</b>은 <b>몇 번 갔나</b>입니다.{' '}
          <b>미제공</b>은 계획된 날인데 못 간 것이고, 누를 때 사유를 받습니다.
          <b> 요일은 안내일 뿐</b>이라, 화·목 대신 수·목에 다녀오셨어도
          그 주는 채운 것으로 셉니다.<br />
          <b>인쇄</b>는 이 화면 그대로 A4 로 나갑니다 — 차림표·단추·거르개는 빠지고,
          <b>지금 걸어 둔 조건이 종이 맨 위에 함께 찍힙니다.</b>
          쪽 번호를 붙이시려면 인쇄 창에서 <b>「머리글 및 바닥글」</b>을 켜 주세요 —
          그건 브라우저가 붙이는 것이라 우리가 대신 켤 수 없습니다.
        </p>
      </div>

      {/* ── 한눈에 ───────────────────────────────────────────── */}
      <div className="row tight" style={{ alignItems: 'stretch' }}>
        {[
          { label: '계획', v: t.계획 },
          { label: '제공', v: t.제공 },
          { label: '미제공', v: t.미제공 },
          { label: '아직', v: t.남음 },
        ].map((x) => (
          <div key={x.label} className="card"
               style={{ margin: 0, textAlign: 'center', padding: '14px 10px' }}>
            <div className="muted small">{x.label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{x.v}</div>
          </div>
        ))}
        <div className="card" style={{ margin: 0, textAlign: 'center', padding: '14px 10px' }}>
          <div className="muted small">처리율</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>
            {t.달성률 === null ? '—' : `${t.달성률}%`}
          </div>
          {/* 계획보다 더 다녀온 것 — 100% 를 넘겨 적는 대신 건수로 적습니다 */}
          {t.초과 > 0 && (
            <div className="muted small">계획보다 {t.초과}건 더</div>
          )}
        </div>
      </div>

      {/* ── 월별 흐름 ────────────────────────────────────────── */}
      {월 === null && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <h2 style={{ padding: '14px 18px 0', margin: 0, fontSize: '.9rem' }}>월별 흐름</h2>
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>월</th>
                  {d.월별.map((x: any) => (
                    <th key={x.월} className="right">{x.월}월</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([['계획', '계획'], ['제공', '제공'], ['미제공', '미제공'], ['아직', '남음']] as const)
                  .map(([이름, 키]) => (
                    <tr key={키}>
                      <td>{이름}</td>
                      {d.월별.map((x: any) => (
                        <td key={x.월} className="right mono">
                          {!x.옴 ? <span className="muted">·</span>
                           : x[키] ? (키 === '미제공' && x[키] ? <span className="deadline">{x[키]}</span> : x[키])
                           : <span className="muted">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="note small" style={{ margin: '0 18px 14px' }}>
            가운뎃점(·)은 <b>아직 오지 않은 월</b>입니다. 0 과 다릅니다.
          </p>
        </div>
      )}

      {/* ── 미제공 사유 ───────────────────────────────────────── */}
      {d.사유.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '.9rem' }}>미제공 사유 · 모두 {d.미제공합}건</h2>
          <div className="reasons">
            {d.사유.map((x: any) => (
              <div key={x.이름} className="reason">
                <b>{x.수}</b>
                <span>{x.이름}</span>
              </div>
            ))}
          </div>
          <p className="note small" style={{ marginBottom: 0 }}>
            {/*
            **「부재」로 부르지 않습니다.** 부재는 미제공 사유 **중 하나**입니다
            (부재 · 거부 · 입원 …). 둘을 같은 말로 부르면 「부재 5건」이
            「못 간 것 전부」인지 「사유가 부재인 것」인지 구별이 안 되고,
            입원으로 못 간 것까지 부재로 세어져 지자체에 틀린 말을 하게 됩니다.
            지침도 「제공/미제공」과 「미제공 사유」로 짝을 이룹니다.
          */}
          지자체가 <b>「주 2회인데 왜 여섯 번뿐입니까」</b>라고 물을 때 이 표가 답입니다.
            <b> 사유가 안 적힌 것</b>이 있으면 제공실적 화면에서 채워 주세요.
          </p>
        </div>
      )}

      {/* ── 생애한도 ─────────────────────────────────────────── */}
      {한도?.한도있음 && (
        <div className={한도.넘음 > 0 ? 'card warn' : 'card'}>
          <h2 style={{ fontSize: '.9rem' }}>
            생애한도
            {한도.넘음 > 0 && <span className="tag 종결" style={{ marginLeft: 8 }}>
              넘음 {한도.넘음}
            </span>}
            {한도.임박 > 0 && <span className="tag 중단" style={{ marginLeft: 6 }}>
              임박 {한도.임박}
            </span>}
          </h2>
          {한도.줄들.length === 0 ? (
            <p className="note small" style={{ marginBottom: 0 }}>
              한도가 붙은 서비스(
              {한도.서비스들.map((s: any) => `${s.이름} ${won(s.한도)}원`).join(' · ')}
              )를 <b>아직 아무도 안 쓰셨습니다.</b>
            </p>
          ) : (
            <>
              <div className="table-wrap">
                <table className="grid">
                  <thead>
                    <tr>
                      <th>대상자</th><th>서비스</th>
                      <th className="right">쓴 금액</th>
                      <th className="right">한도</th>
                      <th className="right">남음</th>
                      <th style={{ width: 150 }}>쓴 만큼</th>
                      <th>마지막</th>
                    </tr>
                  </thead>
                  <tbody>
                    {한도.줄들.map((r: any) => (
                      <tr key={`${r.recipientId}-${r.service}`}>
                        <td>
                          <a className="name" {...linkProps(`/recipients/${r.recipientId}`)}>
                            {r.이름}
                          </a>
                          {r.dong && <div className="muted small">{r.dong}</div>}
                        </td>
                        <td className="small">{r.service}</td>
                        <td className="right mono">{won(r.쓴돈)}</td>
                        <td className="right mono muted">{won(r.한도)}</td>
                        <td className="right mono">
                          {r.넘음
                            ? <b className="deadline">{won(-r.남은돈)}원 넘음</b>
                            : <b>{won(r.남은돈)}</b>}
                        </td>
                        <td><막대 v={Math.round(r.비율 * 100)} /></td>
                        <td className="mono small muted">{r.마지막}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="note small" style={{ marginBottom: 0, marginTop: 10 }}>
                <b>한도를 넘기면 그 돈은 기관이 떠안습니다.</b> 그래서
                <b> {Math.round(한도.임박선 * 100)}%부터 미리</b> 알려 드립니다 —
                다 쓴 뒤에 알면 이미 공사가 시작된 뒤입니다.
              </p>
            </>
          )}
        </div>
      )}

      {/*
        ── 계획 대비 실적 ───────────────────────────────────────
        같은 자료를 **네 가지 눈으로** 봅니다. 넷을 한꺼번에 펴 두었더니
        대상자가 늘수록 아래로 한없이 길어졌습니다. 탭으로 갈라 둡니다.
        기간은 위에서 고른 그대로입니다.
      */}
      {d.대상자별.length === 0 ? (
        <div className="card">
          <div className="empty">
            {해}년{월 ? ` ${월}월` : ''}에는 아직 배정된 것이 없습니다.<br />
            <span className="small">
              「배정·주간계획」에서 담당과 요일을 정하면 여기에 숫자가 쌓입니다.
            </span>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="view-tabs">
            {보기들.map((v) => (
              <button key={v.key} type="button"
                      className={'view-tab' + (보기 === v.key ? ' on' : '')}
                      onClick={() => 보기로(v.key)}>
                {v.key}
                <span className="view-n">{(d[v.밭] ?? []).length}</span>
              </button>
            ))}
            <div className="spacer" />
            <span className="muted small view-when">
              {해}년 {월 ? `${월}월` : '한 해'}
            </span>
          </div>
          {보기들.map((v) => 보기 !== v.key ? null : (
            <실적표 key={v.key} 줄들={d[v.밭] ?? []}
                    링크={v.key === '대상자별'
                      ? (r: any) => (r.key.length === 36 ? `/recipients/${r.key}` : null)
                      : undefined} />
          ))}
        </div>
      )}
    </>
  )
}
