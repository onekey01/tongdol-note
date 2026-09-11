import { useCallback, useEffect, useState } from 'react'
import 주소칸 from '../components/AddressField'
import { api } from '../lib/api'
import { getThemeChoice, setThemeChoice, type ThemeChoice } from '../theme'
import { 크기들, 글자크기읽기, 글자크기정하기, type 글자크기 } from '../fontsize'

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: '시스템 따름' },
  { value: 'light', label: '밝게' },
  { value: 'dark', label: '어둡게' },
]

const ORG_FIELDS: { key: string; label: string; ph?: string }[] = [
  { key: 'name', label: '기관명' },
  { key: 'unique_no', label: '고유번호', ph: '000-00-00000' },
  { key: 'biz_no', label: '사업자등록번호', ph: '000-00-00000' },
  { key: 'ceo_name', label: '대표자' },
  { key: 'phone', label: '대표 전화' },
  { key: 'address', label: '주소' },
  { key: 'bank_name', label: '은행' },
  { key: 'bank_account', label: '계좌번호' },
  { key: 'bank_holder', label: '예금주' },
]

const won = (n: number | null) => (n === null || n === undefined ? '—' : n.toLocaleString('ko-KR') + '원')

/**
 * 기관 직인.
 *
 * 그림을 자료함(tongdol.db) 안에 넣습니다. 폴더에 직인 파일이 굴러다니지 않고,
 * 자료함 하나만 복사하면 백업이 끝나는 원칙도 지켜집니다.
 * 영수증·청구서의 기관명 옆에 자동으로 찍힙니다.
 */
function StampCard({ org, onChange }: { org: any; onChange: () => void }) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  /**
   * 올린 그림을 **PNG 로 바꿔서** 저장합니다.
   *
   * 왜 그냥 안 넣고 한 번 거치느냐면 —
   * PDF(청구서·계약서)에 넣을 수 있는 그림은 **PNG 와 JPG 뿐**입니다.
   * WEBP 를 올리면 화면에는 멀쩡히 보이는데 **종이에는 안 찍힙니다.**
   * 오류도 안 나서, 뽑아 보고 「직인이 왜 없지」 하기 전에는 모릅니다.
   * 그래서 어떤 형식으로 올리셔도 여기서 PNG 로 바꿉니다.
   *
   * 크기도 여기서 줄입니다 (긴 변 600px). 도장은 작게 찍히므로 그 이상은 낭비고,
   * 큰 그림은 청구서 40장짜리 파일을 통째로 무겁게 만듭니다.
   * PNG 라서 **배경 투명도 그대로 살아남습니다.**
   */
  async function toPng(file: File): Promise<string> {
    const src: string = await new Promise((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(String(fr.result))
      fr.onerror = () => rej(new Error('그림을 읽지 못했습니다.'))
      fr.readAsDataURL(file)
    })
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('그림 형식을 알 수 없습니다.'))
      i.src = src
    })
    const 긴변 = Math.max(img.naturalWidth, img.naturalHeight) || 1
    const 배 = Math.min(1, 600 / 긴변)
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.naturalWidth * 배))
    c.height = Math.max(1, Math.round(img.naturalHeight * 배))
    const ctx = c.getContext('2d')
    if (!ctx) return src            // 캔버스를 못 쓰면 원본 그대로 (서버가 형식을 다시 봅니다)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/png')
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 4_000_000) return setErr('그림이 큽니다. 4MB 아래로 줄여 주세요.')

    setErr(''); setBusy(true)
    try {
      await api.uploadStamp(await toPng(file))
      onChange()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>기관 직인</h2>
      {err && <div className="msg err">{err}</div>}

      {org?.stamp_png ? (
        <div className="btns" style={{ alignItems: 'center', gap: 16 }}>
          <img src={org.stamp_png} alt="기관 직인"
               style={{ width: 84, height: 84, objectFit: 'contain' }} />
          <button className="danger" disabled={busy}
                  onClick={async () => { await api.removeStamp(); onChange() }}>
            지우기
          </button>
        </div>
      ) : (
        <p className="note" style={{ marginTop: 0 }}>
          아직 없습니다. 없으면 서식에 점선 동그라미가 나오니 손도장을 찍으시면 됩니다.
        </p>
      )}

      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="stamp">직인 그림 올리기</label>
        <input id="stamp" type="file" accept="image/png,image/jpeg,image/webp"
               onChange={pick} disabled={busy} />
      </div>

      <div className="btns">
        <a className="btn-like" href="/api/print/receipt" target="_blank" rel="noreferrer">
          영수증에서 확인하기
        </a>
      </div>
      <p className="note small" style={{ marginBottom: 0, marginTop: 10 }}>
        <b>배경이 없는 PNG</b>가 가장 깔끔합니다. 도장을 흰 종이에 찍어 사진을 찍으셨다면
        배경이 같이 나와 글자를 가립니다.
        <br />
        <b>영수증 · 본인부담금 청구서 · 계약서(제공기관 쪽)</b>의 기관명 옆에 자동으로 찍힙니다.
        올리시면 형식과 크기는 저희가 알아서 맞춥니다.
      </p>
    </div>
  )
}

/**
 * 배상책임보험.
 *
 * 사람마다 드는 것이 아니라 **기관이 인원수를 정해 한 번에 가입**합니다.
 * 그래서 종사자 화면이 아니라 여기 있습니다.
 *
 * 가입 인원보다 실제 제공인력이 많으면 알려줍니다.
 * 빠진 사람이 사고를 내면 기관이 그대로 떠안습니다.
 */
function LiabilityCard({ org, setOrg, info }: { org: any; setOrg: (v: any) => void; info: any }) {
  const on = (k: string) => (e: any) => setOrg({ ...org, [k]: e.target.value })
  const bad = info?.short || info?.expiring
  return (
    <div className={bad ? 'card warn' : 'card'}>
      <h2>배상책임보험</h2>

      {info?.short && (
        <div className="msg err">
          가입 인원 {info.headcount}명보다 제공인력이 {info.workerCount}명으로 더 많습니다.
          빠진 분이 사고를 내면 기관이 그대로 떠안습니다.
        </div>
      )}
      {info?.expiring && !info?.short && (
        <div className="msg err">
          보험 만료가 {info.daysLeft < 0 ? `${-info.daysLeft}일 지났습니다` : `${info.daysLeft}일 남았습니다`}.
        </div>
      )}

      <div className="row">
        <div className="field">
          <label htmlFor="li-ins">보험사</label>
          <input id="li-ins" value={org.liability_insurer ?? ''} onChange={on('liability_insurer')} />
        </div>
        <div className="field">
          <label htmlFor="li-no">증권번호</label>
          <input id="li-no" value={org.liability_policy_no ?? ''} onChange={on('liability_policy_no')} />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="li-from">시작</label>
          <input id="li-from" type="date" value={org.liability_from ?? ''} onChange={on('liability_from')} />
        </div>
        <div className="field">
          <label htmlFor="li-to">만료</label>
          <input id="li-to" type="date" value={org.liability_to ?? ''} onChange={on('liability_to')} />
        </div>
        <div className="field">
          <label htmlFor="li-cnt">가입 인원</label>
          <input id="li-cnt" type="number" min={0}
                 value={org.liability_headcount ?? ''} onChange={on('liability_headcount')} />
        </div>
      </div>

      <p className="note small" style={{ marginBottom: 0 }}>
        지금 제공인력은 <b>{info?.workerCount ?? 0}명</b>입니다.
        보험은 인원수를 정해 가입하므로, 사람이 늘면 가입 인원도 같이 늘려야 합니다.
        저장은 왼쪽 「기관 정보」의 저장 단추로 함께 됩니다.
      </p>
    </div>
  )
}

/**
 * 서비스 단가표 — 보기만 하던 것을 **고칠 수 있게** 했습니다.
 *
 * ── 왜 필요한가 ────────────────────────────────────────────
 * 지침에 없는 서비스를 지자체가 의뢰해 오는 일이 있습니다.
 * 그때마다 프로그램을 고치러 오라고 할 수는 없습니다.
 *
 * ── 지키는 것 두 가지 ──────────────────────────────────────
 * 1. **「복지부 지침 표준」은 못 고칩니다.** 그건 기준선입니다.
 *    우리 지자체 규칙(해남군)에서만 고칩니다. 서버에서도 막습니다.
 * 2. **지우는 단추가 없습니다.** 실적·의뢰·배정이 이미 그 서비스를 가리키고 있어서
 *    지우면 지난 기록지와 청구서가 「이름 없는 서비스」가 됩니다.
 *    안 쓰게 된 것은 **「안 씀」으로 접어 둡니다** — 새로 고를 때만 안 보입니다.
 *
 * ── 단가를 고쳐도 지난 청구서는 안 흔들립니다 ─────────────────
 * 확정할 때 단가·부담률·절삭 규칙을 통째로 얼려 두기 때문입니다(calc_snapshot).
 * 대신 정산 화면에 「단가 바뀜」이 뜹니다 — 다시 확정할지는 한 건씩 판단할 일입니다.
 */
const 단위표: Record<string, string> = { hour: '시간', meal: '식(끼)', time: '회' }
const 기록표: Record<string, string> = { time: '시간형', work: '공사형', meal: '식사형' }

const 빈서비스 = {
  catL: '', catM: '', catS: '', name: '', unit: 'time',
  unitPrice: '', holidayPrice: '', recordType: 'time', lifetimeCap: '',
  monthlyCapMinutes: '', monthlyCapCount: '', onceMinutes: '',
  noshowBillable: false, note: '',
  // 시간 셈하기 — 편람 그대로가 기본 (30분 단위 · 15분부터 올림)
  roundUnit: 30, roundHalf: true,
}

/** 「12시간」·「1시간 30분」처럼 사람이 읽는 말로. */
function 시간말(분: number): string {
  const m = Math.max(0, Math.round(분))
  const h = Math.floor(m / 60), 나머지 = m % 60
  if (h && 나머지) return `${h}시간 ${나머지}분`
  if (h) return `${h}시간`
  return `${나머지}분`
}

/** 월 한도를 한 칸에. 동행지원은 **둘 다** 걸리므로 둘 다 적습니다. */
function 월한도말(v: any): string {
  const 것: string[] = []
  if (v.monthly_cap_minutes > 0) 것.push(시간말(v.monthly_cap_minutes))
  if (v.monthly_cap_count > 0) 것.push(`${v.monthly_cap_count}회`)
  return 것.length ? 것.join(' · ') : '—'
}

/**
 * 본인부담 구간 — **지자체마다 다릅니다.**
 *
 * (2026-09-06 무무 지시로 열었습니다. 그전에는 보기만 됐습니다.)
 *
 * 지침이 「본인부담률 20%~80%」라 하고 「**광역지자체별로 본인부담률을
 * 차등 설정**하도록 함」이라고 적어 두었습니다. 구간 수도 비율도 지역마다
 * 다르므로, 여기가 안 열리면 다른 지자체에는 한 곳도 못 팝니다.
 *
 * ── 화면에서 지키는 것 ────────────────────────────────────
 *
 *   · 「복지부 지침 표준」을 쓰는 동안은 **잠깁니다** (서비스 단가와 같습니다)
 *   · 쓰는 대상자가 있는 구간은 **서버가** 지우기를 막습니다 — 여기서
 *     미리 막지 않는 까닭은, 화면이 아는 숫자와 자료함이 아는 숫자가
 *     어긋날 수 있어서입니다. 막는 자리는 한 곳이어야 합니다.
 *   · 부담률은 **퍼센트로** 받습니다. 자료함에는 0~1 로 들어갑니다 —
 *     사람이 「0.2」를 적게 하면 반드시 누군가 「20」을 적습니다.
 */
function CopayCard({ s, onChange }: { s: any; onChange: () => void }) {
  const 잠김 = !!s.profile?.is_builtin
  const [새것, set새것] = useState<{ label: string; rate: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const 감싸기 = async (일: () => Promise<unknown>) => {
    setBusy(true); setErr('')
    try { await 일(); onChange() }
    catch (e: any) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '18px 22px 0', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>본인부담 구간</h2>
        {!잠김 && !새것 && (
          <button onClick={() => set새것({ label: '', rate: '' })} disabled={busy}>
            구간 추가
          </button>
        )}
      </div>

      <div style={{ padding: '6px 22px 0' }}>
        <p className="note small" style={{ margin: '8px 0 0' }}>
          지자체마다 구간 수도 비율도 다릅니다. 지침은 「본인부담률 20%~80%」로 두고
          <b> 광역지자체별로 차등 설정</b>하라고 정해 두었습니다.
          {잠김 && <> <b>지금은 「복지부 지침 표준」을 쓰고 있어 고칠 수 없습니다.</b>{' '}
            위 <b>계산 규칙</b>에서 우리 지자체 규칙으로 바꿔 주세요.</>}
          {!잠김 && <> 고치면 <b>아직 확정하지 않은 청구부터</b> 새 비율로 셈합니다 —
            이미 확정한 것은 그때 값이 얼려 있어 안 흔들립니다.</>}
        </p>
        {err && <div className="msg err" style={{ marginTop: 10 }}>{err}</div>}
      </div>

      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead>
            <tr>
              <th>구분</th>
              <th className="right" style={{ width: 120 }}>부담률</th>
              {!잠김 && <th style={{ width: 90 }}></th>}
            </tr>
          </thead>
          <tbody>
            {s.tiers?.map((t: any) => (
              <TierRow key={t.id} t={t} 잠김={잠김} busy={busy} 감싸기={감싸기} />
            ))}
            {새것 && (
              <tr>
                <td>
                  <input value={새것.label} autoFocus disabled={busy}
                         placeholder="예) 기초연금 수급자"
                         onChange={(e) => set새것({ ...새것, label: e.target.value })} />
                </td>
                <td className="right">
                  <div className="퍼센트칸">
                    <input value={새것.rate} disabled={busy} inputMode="numeric"
                           placeholder="20"
                           onChange={(e) => set새것({ ...새것, rate: e.target.value })} />
                    <span>%</span>
                  </div>
                </td>
                <td>
                  <div className="btns">
                    <button className="primary" disabled={busy || !새것.label.trim()}
                            onClick={() => 감싸기(async () => {
                              await api.addCopayTier({
                                label: 새것.label.trim(), rate: Number(새것.rate || 0),
                              })
                              set새것(null)
                            })}>넣기</button>
                    <button disabled={busy} onClick={() => { set새것(null); setErr('') }}>
                      그만
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** 구간 한 줄. 눌러서 그 자리에서 고칩니다. */
function TierRow({ t, 잠김, busy, 감싸기 }: {
  t: any; 잠김: boolean; busy: boolean; 감싸기: (일: () => Promise<unknown>) => Promise<void>
}) {
  const [고침, set고침] = useState<{ label: string; rate: string } | null>(null)

  if (!고침) return (
    <tr className={잠김 ? undefined : 'clickable'}
        onClick={() => !잠김 && set고침({
          label: t.label, rate: String(Math.round(Number(t.rate) * 100)),
        })}>
      <td>{t.label}</td>
      <td className="right mono">{Math.round(Number(t.rate) * 100)}%</td>
      {!잠김 && <td className="muted small">눌러서 고치기</td>}
    </tr>
  )

  return (
    <tr>
      <td>
        <input value={고침.label} autoFocus disabled={busy}
               onChange={(e) => set고침({ ...고침, label: e.target.value })} />
      </td>
      <td className="right">
        <div className="퍼센트칸">
          <input value={고침.rate} disabled={busy} inputMode="numeric"
                 onChange={(e) => set고침({ ...고침, rate: e.target.value })} />
          <span>%</span>
        </div>
      </td>
      <td>
        <div className="btns">
          <button className="primary" disabled={busy || !고침.label.trim()}
                  onClick={() => 감싸기(async () => {
                    await api.saveCopayTier(t.id, {
                      label: 고침.label.trim(), rate: Number(고침.rate || 0),
                    })
                    set고침(null)
                  })}>저장</button>
          <button disabled={busy} onClick={() => set고침(null)}>그만</button>
          <button className="danger" disabled={busy}
                  onClick={() => {
                    if (!confirm(
                      `「${t.label}」 구간을 지웁니다.\n\n` +
                      `이 구간을 쓰는 대상자가 있으면 지워지지 않습니다.`
                    )) return
                    감싸기(async () => { await api.removeCopayTier(t.id); set고침(null) })
                  }}>지우기</button>
        </div>
      </td>
    </tr>
  )
}

function ServiceRow({ v, 잠김, onSaved }: {
  v: any; 잠김: boolean; onSaved: () => void
}) {
  const [열림, set열림] = useState(false)
  const [f, setF] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function 펼치기() {
    if (잠김) return
    setF({
      catL: v.cat_l ?? '', catM: v.cat_m ?? '', catS: v.cat_s ?? '',
      name: v.name ?? '', unit: v.unit ?? 'time',
      unitPrice: String(v.unit_price ?? ''),
      holidayPrice: v.holiday_price == null ? '' : String(v.holiday_price),
      recordType: v.record_type ?? 'time',
      lifetimeCap: v.lifetime_cap == null ? '' : String(v.lifetime_cap),
      monthlyCapMinutes: v.monthly_cap_minutes ? String(v.monthly_cap_minutes) : '',
      monthlyCapCount: v.monthly_cap_count ? String(v.monthly_cap_count) : '',
      onceMinutes: v.once_minutes ? String(v.once_minutes) : '',
      noshowBillable: Number(v.noshow_billable ?? 0) === 1,
      roundUnit: Number(v.round_unit ?? 30) === 60 ? 60 : 30,
      roundHalf: Number(v.round_half ?? 1) === 1,
      note: v.note ?? '', active: v.active !== 0,
    })
    set열림(!열림)
  }

  async function 저장() {
    setBusy(true); setErr('')
    try { await api.saveService(v.id, f); set열림(false); onSaved() }
    catch (e: any) { setErr(e.message) }
    finally { setBusy(false) }
  }

  const 꺼짐 = v.active === 0
  return (
    <>
      <tr className={잠김 ? undefined : 'clickable'} onClick={펼치기}
          style={꺼짐 ? { opacity: 0.5 } : undefined}>
        <td className="mono small">{v.code}</td>
        <td className="small">{[v.cat_l, v.cat_m].filter(Boolean).join(' · ')}</td>
        <td>
          <span className="name">{v.name}</span>
          {v.custom === 1 && <span className="muted small"> · 기관이 만든 것</span>}
          {꺼짐 && <span className="muted small"> · 안 씀</span>}
        </td>
        <td className="small">{단위표[v.unit] ?? v.unit}</td>
        <td className="right mono small">{won(v.unit_price)}</td>
        <td className="right mono small">{won(v.holiday_price)}</td>
        <td className="small">{기록표[v.record_type] ?? v.record_type}</td>
        <td className="right mono small">{won(v.lifetime_cap)}</td>
        <td className="right small">{월한도말(v)}</td>
      </tr>
      {열림 && f && (
        <tr>
          <td colSpan={9} style={{ padding: '14px 22px 18px', background: 'var(--surface-2)' }}>
            {err && <div className="msg err">{err}</div>}
            <ServiceFields f={f} setF={setF} />
            <div className="field" style={{ maxWidth: 260 }}>
              <label>쓰는 중인가</label>
              <div className="pick">
                <button type="button" aria-pressed={f.active}
                        onClick={() => setF({ ...f, active: true })}>씀</button>
                <button type="button" aria-pressed={!f.active}
                        onClick={() => setF({ ...f, active: false })}>안 씀</button>
              </div>
            </div>
            <p className="note small">
              <b>「안 씀」으로 해도 지난 기록은 그대로 남습니다.</b> 새로 고를 때만 안 보입니다.
              서비스를 지우는 길은 일부러 두지 않았습니다 —
              지우면 지난 기록지와 청구서가 「이름 없는 서비스」가 됩니다.
            </p>
            <div className="btns">
              <button className="primary" disabled={busy} onClick={저장}>
                {busy ? '저장 중…' : '저장'}
              </button>
              <button className="plain" onClick={() => set열림(false)}>취소</button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/**
 * ── 시간 셈하기 미리보기 ──────────────────────────────────
 *
 * **server/money.ts 의 `인정분()` 과 같은 셈입니다.** 여기가 다르면
 * 설정 화면이 「30분 나옵니다」 해 놓고 청구서는 다른 숫자를 냅니다 —
 * 그런 어긋남은 기관이 군에 낸 뒤에야 드러납니다. 고칠 때 **둘 다**
 * 고쳐 주세요. (시험: `시간셈하기시험.ts` 가 두 곳을 맞춰 봅니다.)
 */
function 인정분미리(분: number, 단위: number, 반올림: boolean): number {
  const m = Math.floor(분)
  if (!Number.isFinite(m) || m <= 0) return 0
  const u = 단위 === 60 ? 60 : 30
  return 반올림
    ? Math.floor((m + u / 2) / u) * u
    : Math.floor(m / u) * u
}

function 분말(분: number): string {
  if (분 <= 0) return '안 셈'
  const h = Math.floor(분 / 60), r = 분 % 60
  if (h && r) return `${h}시간 ${r}분`
  if (h) return `${h}시간`
  return `${r}분`
}

/**
 * 「시간 셈하기」 — **지자체마다, 해마다 다릅니다.**
 *
 * (2026-09-06 무무 — 「년도가 바뀌면 수정되는 부분이 있을텐데 고정하면
 *  절대 안 되는 부분이야」 / 「예시를 하단에 표시해 주는건 매우 좋은
 *  아이디어야」)
 *
 * 편람은 30분 단위에 15분부터 올림입니다. 그런데 1시간 단위로 세라는
 * 데도 있고, 미달은 아예 버리라는 데도 있습니다. 못박아 두면 그때마다
 * 프로그램을 고치러 와야 합니다.
 *
 * **시간제 서비스에만 뜹니다** — 끼·회는 잰 분을 안 보고 「한 번」으로
 * 세므로 이 규칙이 아무 데도 안 걸립니다. 그런 칸을 보여 주면
 * 「여기 고쳤는데 왜 안 바뀌지」가 됩니다.
 */
function 시간셈칸({ f, setF }: { f: any; setF: (v: any) => void }) {
  const 단위 = Number(f.roundUnit ?? 30) === 60 ? 60 : 30
  const 반올림 = !!f.roundHalf
  const 단가 = Number(String(f.unitPrice ?? '').replace(/[^0-9]/g, '')) || 0
  const 보기 = 단위 === 30 ? [10, 20, 40, 50, 80] : [20, 29, 30, 50, 80]

  return (
    <>
      <div className="row tight">
        <div className="field" style={{ flex: 1 }}>
          <label>몇 분 단위로 셉니까</label>
          <div className="pick">
            <button type="button" aria-pressed={단위 === 30}
                    onClick={() => setF({ ...f, roundUnit: 30 })}>30분</button>
            <button type="button" aria-pressed={단위 === 60}
                    onClick={() => setF({ ...f, roundUnit: 60 })}>1시간</button>
          </div>
        </div>
        <div className="field" style={{ flex: 2 }}>
          <label>모자란 자투리</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={반올림}
                   onChange={(e) => setF({ ...f, roundHalf: e.target.checked })} />
            <span>
              반올림합니다 <span className="muted">— {단위 / 2}분부터 올려 셉니다</span>
            </span>
          </label>
        </div>
      </div>

      <table className="셈보기">
        <caption>이렇게 셈합니다</caption>
        <thead>
          <tr><th>다녀온 시간</th><th>셈하는 시간</th><th className="right">금액</th></tr>
        </thead>
        <tbody>
          {보기.map((분) => {
            const 인정 = 인정분미리(분, 단위, 반올림)
            return (
              <tr key={분} className={인정 === 0 ? 'muted' : undefined}>
                <td>{분말(분)}</td>
                <td>{분말(인정)}</td>
                <td className="right mono">{won(Math.round(단가 * 인정 / 60))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="note small" style={{ margin: '6px 0 12px' }}>
        {반올림
          ? <>자투리가 <b>{단위 / 2}분을 넘으면 올려서</b> 셉니다. 못 넘으면 버립니다.</>
          : <>자투리는 <b>모두 버립니다</b> — {단위}분을 못 채우면 그만큼은 셈에 안 듭니다.</>}
        <br />
        이 셈은 <b>서비스마다 따로</b>입니다. 가사는 30분, 동행은 1시간처럼
        지자체가 다르게 정했으면 그대로 맞출 수 있습니다.
        <b> 이미 확정한 청구서는 이걸 고쳐도 안 흔들립니다</b> — 확정할 때 규칙을
        통째로 얼려 두기 때문입니다.
      </p>
    </>
  )
}

function ServiceFields({ f, setF }: { f: any; setF: (v: any) => void }) {
  const on = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  return (
    <>
      <div className="row">
        <div className="field" style={{ flex: 1 }}>
          <label>구분(대분류)</label>
          <input value={f.catL} onChange={on('catL')} placeholder="일상생활돌봄" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>중분류</label>
          <input value={f.catM} onChange={on('catM')} placeholder="가사지원" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>소분류</label>
          <input value={f.catS} onChange={on('catS')} placeholder="청소·빨래·식사준비" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>서비스명</label>
          <input value={f.name} onChange={on('name')} placeholder="가사지원" />
        </div>
      </div>
      <div className="row">
        <div className="field" style={{ flex: 1 }}>
          <label>단위</label>
          <select value={f.unit} onChange={on('unit')}>
            <option value="time">회</option>
            <option value="hour">시간</option>
            <option value="meal">식(끼)</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>단가 (원)</label>
          <input inputMode="numeric" value={f.unitPrice} onChange={on('unitPrice')} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>휴일단가 <span className="muted">— 없으면 비워 둠</span></label>
          <input inputMode="numeric" value={f.holidayPrice} onChange={on('holidayPrice')} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>기록 형태</label>
          <select value={f.recordType} onChange={on('recordType')}>
            <option value="time">시간형</option>
            <option value="meal">식사형</option>
            <option value="work">공사형</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>생애한도 <span className="muted">— 없으면 비워 둠</span></label>
          <input inputMode="numeric" value={f.lifetimeCap} onChange={on('lifetimeCap')} />
        </div>
      </div>
      {f.unit === 'hour' && <시간셈칸 f={f} setF={setF} />}
      {/*
        ── 월 한도 (A-2 · 7-사) ────────────────────────────────
        편람: 가사 월 12시간(720분) · 식사 월 8회 · 동행 월 6시간(360분)과 2회 ·
        이미용 월 1회. **동행지원처럼 둘 다 걸리는 것이 있어 칸이 둘**입니다.
      */}
      <div className="row tight">
        <div className="field" style={{ flex: 1 }}>
          <label>월 한도 — 시간 <span className="muted">— 분으로. 720 = 12시간</span></label>
          <input inputMode="numeric" value={f.monthlyCapMinutes}
                 onChange={on('monthlyCapMinutes')} placeholder="없으면 비워 둠" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>월 한도 — 횟수 <span className="muted">— 회</span></label>
          <input inputMode="numeric" value={f.monthlyCapCount}
                 onChange={on('monthlyCapCount')} placeholder="없으면 비워 둠" />
        </div>
      </div>
      <p className="note small" style={{ margin: '0 0 12px' }}>
        <b>동행지원처럼 둘 다 걸리는 서비스가 있습니다</b> — 월 6시간이면서 월 2회.
        시간이 남아도 세 번째 방문은 안 됩니다. 그래서 칸이 둘입니다.
        비워 두면 <b>그 한도는 안 봅니다.</b>
      </p>

      {/*
        ── 1회 서비스 시간 (v36 · 2026-09-11 무무) ──────────────
        「1회 서비스를 60분으로 한도 내에서 사용할 수도 있는데 설정에서
         이를 반영하지 못한다」 — 맞는 말이었습니다. 시간에 관해 설정에
        있던 칸은 **하루 최대 하나뿐**이었고, 그건 천장이지 「보통 이만큼
        한다」가 아닙니다. 그래서 배정마다 손으로 쳐야 했습니다.
      */}
      {f.unit === 'hour' && (
        <>
          <div className="field" style={{ maxWidth: '16rem' }}>
            <label>1회 서비스 시간 <span className="muted">— 분. 비우면 60분</span></label>
            <input inputMode="numeric" value={f.onceMinutes}
                   onChange={on('onceMinutes')} placeholder="60" />
          </div>
          <p className="note small" style={{ margin: '0 0 12px' }}>
            배정에서 <b>요일별 시간을 비워 두면 이 값</b>으로 계획을 잽니다.
            사람마다 다르면 배정에서 적으시면 되고, 그 값이 이것보다 앞섭니다.
            <br />
            <b>한도 안에 들면 어떻게 나누셔도 됩니다</b> — 나눠 쓰든 하루
            최대까지 꽉 채워 한 번에 쓰든, <b>1회 시간 × 그 달 횟수</b>가 위의
            월 한도 안이고 1회 시간이 <b>하루 최대</b>를 안 넘으면 그대로 저장됩니다.
            {!!(Number(f.onceMinutes || 60) > 0 && Number(f.monthlyCapMinutes) > 0) && (
              <><br />
                지금 값이면 한 달에{' '}
                <b>{Math.floor(Number(f.monthlyCapMinutes) / Number(f.onceMinutes || 60))}번</b>
                {' '}까지 됩니다
                ({시간말(Number(f.monthlyCapMinutes))} ÷ {Number(f.onceMinutes || 60)}분).
              </>
            )}
          </p>
        </>
      )}
      {/*
        ── 노쇼를 비용으로 잡나 (A-3 · 계약서 4조) ─────────────
        **기본은 꺼짐**입니다. 해남 현장은 안 씁니다 — 이용자 사정이면
        일정을 사전 조율해 다시 잡고, 식사는 「대면/비대면」이 그 자리입니다.
        그래도 계약서 4조가 **어르신께 인쇄되어 나가는 종이**에 적혀 있어
        기능은 남겨 둡니다. 다른 지자체가 켜서 씁니다.
      */}
      <div className="field">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" style={{ width: 'auto' }}
                 checked={!!f.noshowBillable}
                 onChange={(e) => setF({ ...f, noshowBillable: e.target.checked })} />
          <span>노쇼를 비용으로 잡습니다 <span className="muted">— 기본은 꺼짐</span></span>
        </label>
      </div>
      <p className="note small" style={{ margin: '0 0 12px' }}>
        켜면 <b>미제공을 적을 때 「갈래」를 한 번 더 묻습니다</b> — 노쇼 · 사전취소 ·
        기관사정 · 기타. 그중 <b>노쇼만 비용이 나가고 연간 지원한도에서 깎입니다</b>
        (계약서 4조: 「사전 취소 없이 … 이용하지 않으셨더라도 비용이 지출되며,
        1인당 연간 지원한도액에서 차감됩니다」).<br />
        <b>해남은 꺼 두었습니다.</b> 이용자 사정이면 <b>일정을 사전 조율</b>해 다시
        잡고, 식사지원은 <b>「대면 / 비대면 배달」</b>이 그 자리를 대신합니다 —
        비대면은 미제공이 아니라 <b>제공</b>이라 비용이 그대로 나갑니다.
      </p>
      <div className="field">
        <label>메모 <span className="muted">— 왜 만들었는지 적어 두면 나중에 도움이 됩니다</span></label>
        <input value={f.note} onChange={on('note')}
               placeholder="2026.9. 군에서 추가 의뢰. 지침에는 없음" />
      </div>
    </>
  )
}

/* ── 계산 규칙 — 칸을 흩어 놓고 하나씩 ────────────────────── */
/*
 * 예전에는 「해남군」처럼 규칙 덩어리를 골라 쓰기만 했습니다.
 * 그런데 지자체마다 「후납인데 반올림은 100원 내림, 할증은 안 씀」처럼
 * **조합이 제각각**이라, 미리 만들어 둔 덩어리로는 반드시 안 맞는 곳이 나옵니다.
 * 그래서 칸을 흩어 놓고 하나씩 정합니다.
 *
 * 규칙 **이름도 고칠 수 있습니다.** 프로그램에 특정 지자체 이름을 박아 두면
 * 다른 곳에서 설치했을 때 남의 프로그램을 빌려 쓰는 꼴이 됩니다.
 */
const 시점보기: { v: string; label: string; help: string }[] = [
  { v: 'monthly', label: '달마다',
    help: '달력 달로 자릅니다. 8월분은 8.1~8.31 — 지자체 명단·기록지와 줄이 맞습니다.' },
  { v: 'anniversary', label: '시작일부터 한 달씩',
    help: '의뢰가 시작한 날부터 셉니다. 5월 11일에 시작했으면 5.11~6.10 이 1회차입니다.' },
  { v: 'on_end', label: '기간이 끝날 때 한 번에',
    help: '의뢰 기간이 끝나면 그동안 것을 한 장으로 묶어 청구합니다.' },
]

/**
 * ── 돈을 적는 칸 — **세 자리마다 쉼표** ─────────────────────
 *
 * 「1500000」은 사람이 못 읽습니다. 0 을 하나 더 치거나 덜 쳐도 모릅니다.
 * 한도는 **150만원**인데 「15000000」으로 저장되면 열 배가 됩니다.
 * 그래서 보이는 동안은 **1,500,000** 으로 적습니다 (2026-09-04 무무 님 지시).
 *
 * `type="number"` 는 쉼표를 못 넣습니다. 그래서 글자 칸으로 두고
 * **숫자만 골라내어** 저장합니다 — 쉼표를 지우든 넣든 같은 값이 됩니다.
 * 고치는 동안에는 손을 안 대고, **칸을 벗어날 때** 다시 예쁘게 적습니다.
 */
function 돈칸({ id, label, value, busy, onSave }: {
  id: string; label: string; value: number; busy: boolean;
  onSave: (v: number) => void
}) {
  const 예쁘게 = (n: number) => Number(n || 0).toLocaleString('ko-KR')
  const [글, 글쓰기] = useState(() => 예쁘게(value))
  // 서버 값이 바뀌면(저장 뒤·규칙 바꾼 뒤) 칸도 따라갑니다.
  useEffect(() => { 글쓰기(예쁘게(value)) }, [value])

  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" inputMode="numeric" disabled={busy}
             value={글}
             onChange={(e) => 글쓰기(e.target.value)}
             onBlur={() => {
               const v = Number(String(글).replace(/[^0-9]/g, ''))
               글쓰기(예쁘게(v))
               if (v !== Number(value)) onSave(v)
             }} />
    </div>
  )
}

function RuleFields({ s, onChange, setMsg }: { s: any; onChange: () => void; setMsg: (m: any) => void }) {
  const p = s.profile ?? {}
  const 잠김 = !!p.is_builtin
  const [busy, setBusy] = useState(false)

  async function 고치기(b: Record<string, unknown>) {
    if (잠김) return
    setBusy(true)
    try {
      await api.saveRules(p.id, b)
      onChange()
      setMsg({ kind: 'ok', text: '규칙을 고쳤습니다. 바꾼 것은 기록에 남습니다.' })
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) }
    finally { setBusy(false) }
  }

  if (잠김) {
    /*
     * 지침이 정한 것과 **정하지 않은 것**을 갈라 보여 줍니다.
     *
     * 예전에는 청구 방식·반올림을 「지침 표준」 아래 나란히 적어 두었는데,
     * 2026년 사업안내 381쪽에 **「절삭」·「반올림」·「선납」·「후납」이 한 번도 안 나옵니다.**
     * 지침이 정하는 것은 본인부담률이고, 그 밖은 지자체 자율입니다.
     * 지침에 없는 것을 지침이라고 적어 두면 **기준이 통째로 무너집니다.**
     */
    return (
      <>
        <dl className="facts">
          <dt>본인부담률</dt>
          <dd>
            서비스마다 지침이 정합니다
            <div className="muted small">아래 「본인부담 구간」 표를 보세요</div>
          </dd>
        </dl>
        <p className="note small" style={{ marginTop: 10 }}>
          <b>「복지부 지침 표준」은 고칠 수 없습니다.</b> 2026년 의료·요양 통합돌봄
          사업안내를 옮긴 <b>기준선</b>이라, 우리 지자체가 지침과 무엇이 다른지
          견주려면 이쪽이 안 움직여야 합니다.
        </p>
        <dl className="facts" style={{ marginTop: 10 }}>
          <dt>연속 비대면 배달</dt>
          <dd>
            <b>{p.f2f_limit ?? 3}회</b>면 통합돌봄 서비스 전체 중지
            <div className="muted small">
              계약서(서식2) 5-2조. 어느 기관이나 어르신과 맺는 계약이라
              기준선에도 넣어 두었습니다 — 다만 <b>고치려면 아래 「우리 지자체
              규칙」</b>으로 바꿔 쓰셔야 합니다.
            </div>
          </dd>
        </dl>
        <div className="msg warn" style={{ marginTop: 4 }}>
          <b>지원한도(연 150만원)도 지침에 없습니다.</b><br />
          <span className="small">
            그 숫자는 <b>해남군 업무편람</b>에 적힌 것이고 2026년 사업안내에는
            없습니다. 그래서 기준선에는 넣지 않았습니다 —
            <b> 지금 이 규칙에서는 한도를 안 봅니다.</b>
            편람 값(연 150만원 · 안전생활환경 생애 100만원)은 아래
            <b>「우리 지자체 규칙」</b>에 들어 있습니다.
          </span>
        </div>
        <div className="msg warn" style={{ marginTop: 4 }}>
          <b>청구 시점과 절삭 방식은 지침에 없습니다.</b><br />
          <span className="small">
            사업안내 전문을 뒤져도 「절삭」·「반올림」·「선납」·「후납」이라는 말이
            한 번도 안 나옵니다. 지침이 정하는 것은 <b>서비스별 본인부담률</b>이고,
            그 외 소득구간은 <b>「광역지자체별로 차등 설정」</b>, 사업 세부내역은
            <b>「지자체가 자율적으로 설계·집행」</b>이라고만 되어 있습니다.<br />
            그러니 그 둘은 <b>우리 지자체에 확인해서</b> 아래 「우리 지자체 규칙」에
            적으셔야 합니다. 여기 안 보이는 이유가 그것입니다.
          </span>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="field">
        <label htmlFor="rule-name">규칙 이름</label>
        <input id="rule-name" defaultValue={p.name ?? ''} disabled={busy}
               onBlur={(e) => e.target.value.trim() !== p.name && 고치기({ name: e.target.value })} />
      </div>

      <div className="field">
        <label htmlFor="rule-mode">청구 방식</label>
        <select id="rule-mode" value={p.billing_mode ?? 'postpaid'} disabled={busy}
                onChange={(e) => 고치기({ billingMode: e.target.value })}>
          <option value="postpaid">후납 — 다녀온 실적으로 나중에 청구</option>
          <option value="prepaid">선납 — 계획을 기준으로 먼저 청구</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="rule-claim">지자체 청구는 언제</label>
        <select id="rule-claim" value={p.claim_timing ?? 'monthly'} disabled={busy}
                onChange={(e) => 고치기({ claimTiming: e.target.value })}>
          {시점보기.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
        </select>
        <p className="note small" style={{ margin: '4px 0 0' }}>
          {시점보기.find((x) => x.v === (p.claim_timing ?? 'monthly'))?.help}
        </p>
      </div>

      <div className="field">
        <label htmlFor="rule-copay">본인부담금 청구는 언제</label>
        <select id="rule-copay" value={p.copay_timing ?? 'monthly'} disabled={busy}
                onChange={(e) => 고치기({ copayTiming: e.target.value })}>
          {시점보기.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
        </select>
        <p className="note small" style={{ margin: '4px 0 0' }}>
          {(p.claim_timing ?? 'monthly') === (p.copay_timing ?? 'monthly')
            ? '지자체 몫과 같은 때라 청구서 한 장에 둘 다 담깁니다.'
            : '지자체 몫과 때가 달라 청구서가 두 장으로 갈립니다.'}
        </p>
      </div>

      <div className="row tight">
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="rule-runit">절삭 단위</label>
          <select id="rule-runit" value={String(p.rounding_unit ?? 10)} disabled={busy}
                  onChange={(e) => 고치기({ roundingUnit: Number(e.target.value) })}>
            <option value="1">1원</option>
            <option value="10">10원</option>
            <option value="100">100원</option>
            <option value="1000">1,000원</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="rule-rmode">절삭 방식</label>
          <select id="rule-rmode" value={p.rounding_mode ?? 'round'} disabled={busy}
                  onChange={(e) => 고치기({ roundingMode: e.target.value })}>
            <option value="round">반올림</option>
            <option value="floor">내림 (절삭)</option>
            <option value="ceil">올림</option>
          </select>
        </div>
      </div>
      <p className="note small" style={{ margin: '4px 0 12px' }}>
        본인부담금에 적용합니다. <b>총액에 한 번만</b> 자릅니다 —
        줄마다 자르고 더하면 합계가 어긋납니다.
      </p>

      <div className="field">
        <label>휴일 할증</label>
        <div className="row tight" style={{ alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
            <input type="checkbox" style={{ width: 16 }} disabled={busy}
                   checked={!!p.holiday_enabled}
                   onChange={(e) => 고치기({ holidayEnabled: e.target.checked })} />
            <span className="small">토·일·공휴일에 할증</span>
          </label>
          {!!p.holiday_enabled && (
            <div className="field" style={{ marginBottom: 0, flex: 0 }}>
              <input type="number" step="any" min="1" max="3" style={{ width: 90 }}
                     defaultValue={p.holiday_surcharge ?? 1.5} disabled={busy}
                     aria-label="할증 배수"
                     onBlur={(e) => 고치기({ holidaySurcharge: Number(e.target.value) })} />
            </div>
          )}
        </div>
        <p className="note small" style={{ margin: '4px 0 0' }}>
          지침에는 있으나 <b>예산 때문에 실제로 쓰는 곳이 드뭅니다.</b>
          쓰지 않으면 휴일도 평일 단가로 셈합니다.
        </p>
      </div>

      {/*
        ── 지원한도 (7-마) ──────────────────────────────────────
        편람은 연간 150만 · 안전생활환경 생애 100만이라고 적어 두었지만
        **지역마다 다를 수 있어** 여기서 고쳐 씁니다.
      */}
      <div className="row tight">
        <돈칸 id="rule-annual" label="1인 연간 지원한도" busy={busy}
              value={p.annual_cap ?? 1500000}
              onSave={(v) => 고치기({ annualCap: v })} />
        <돈칸 id="rule-housing" label="안전생활환경 생애한도" busy={busy}
              value={p.housing_cap ?? 1000000}
              onSave={(v) => 고치기({ housingCap: v })} />
      </div>
      <p className="note small" style={{ margin: '4px 0 12px' }}>
        <b>안전생활환경개선은 연간 한도 바깥</b>이라 따로 셉니다.
        넘겨도 <b>막지 않고 알려만 줍니다</b> — 군과 협의해 넘길 여지가 있습니다.
        0 을 넣으면 한도를 안 봅니다.
      </p>

      {/*
        ── 연간 한도를 **무엇으로** 재나 (2026-09-07 무무) ────────
        편람은 「150만원」이라고만 적어 두었지, 그것이 총액인지
        군 부담액인지는 안 적어 두었습니다. 이 답에 따라 「넘었다」가
        갈립니다 — 본인부담 20% 구간이면 두 셈이 25% 차이가 납니다.
      */}
      <div className="field" style={{ maxWidth: '22rem' }}>
        <label htmlFor="rule-basis">연간 한도를 무엇으로 재나</label>
        <select id="rule-basis" disabled={busy}
                value={p.cap_basis ?? 'total'}
                onChange={(e) => 고치기({ capBasis: e.target.value })}>
          <option value="total">총 서비스 비용</option>
          <option value="claim">군 부담액 — 본인부담금을 뺀 것</option>
        </select>
      </div>
      <p className="note small" style={{ margin: '4px 0 12px' }}>
        편람은 <b>「1인 연간 지원한도 150만원」</b>이라고만 적어 두었고,
        그것이 총액인지 군 부담액인지는 <b>안 적혀 있습니다.</b>
        군에 확인하신 뒤 여기서 맞춰 주세요 — 본인부담 20% 구간이면
        두 셈이 <b>25%</b> 차이가 납니다.<br />
        계획을 짤 때 뜨는 <b>「이 계획대로 가면」</b> 줄과 홈의 한도 경고가
        모두 이 기준으로 셉니다.
      </p>

      {/*
        ── 하루 최대 서비스 시간 — 편람 「1일 최대 3시간」 ───────
        가사도 동행도 편람이 「1일 최대 3시간(평일 오전 9시 ~ 오후 6시)」이라
        적어 두었습니다. 잰 시간이 이보다 길면 여기까지만 셉니다.
        사람마다 다른 경우는 **배정의 주간 계획**에 요일별 시간을 적습니다 —
        거기 적힌 값이 이것보다 앞섭니다.
      */}
      <div className="field" style={{ marginBottom: 0, maxWidth: '16rem' }}>
        <label htmlFor="rule-daily">하루 최대 서비스 시간 (분)</label>
        <input id="rule-daily" type="number" min="0" max="1440" disabled={busy}
               defaultValue={p.daily_cap_minutes ?? 180}
               onBlur={(e) => Number(e.target.value) !== Number(p.daily_cap_minutes ?? 180)
                 && 고치기({ dailyCapMinutes: Number(e.target.value) })} />
      </div>
      <p className="note small" style={{ margin: '4px 0 12px' }}>
        편람이 <b>「1일 최대 3시간(평일 오전 9시 ~ 오후 6시)」</b>이라 적어 둔
        값입니다. 실적에 그보다 긴 시간이 적혀도 <b>청구는 여기까지만</b> 셉니다.
        30분 단위 환산과 겹치면 하루에 나오는 값은 <b>30분 · 1시간 · 1시간30분 ·
        2시간 · 2시간30분 · 3시간</b> 여섯 가지입니다.<br />
        사람마다 다르면 <b>배정 화면의 주간 계획</b>에 요일별 시간을 적어 주세요 —
        그 값이 이것보다 앞섭니다. 0 을 넣으면 안 봅니다.
      </p>

      {/*
        ── 연속 비대면 배달 한도 (A-4 · 계약서 5-2조) ────────────
        편람과 계약서는 3회입니다. **지침은 개정됩니다** — 그때마다 프로그램을
        새로 짜지 않아도 되게 설정값으로 둡니다.
      */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: 0 }}>
        <div className="field" style={{ marginBottom: 0, maxWidth: '11rem' }}>
          <label htmlFor="rule-f2f">식사지원 · 비대면 배달 한도</label>
          <input id="rule-f2f" type="number" step="1" min="0" max="30" disabled={busy}
                 defaultValue={p.f2f_limit ?? 3}
                 onBlur={(e) => Number(e.target.value) !== Number(p.f2f_limit ?? 3)
                   && 고치기({ f2fLimit: Number(e.target.value) })} />
        </div>
        {/*
          ── 연속으로 세나, 누적으로 세나 (v33 · 2026-09-08 무무) ──
          해남은 **연속**이 맞습니다(군 확인). 다른 군이 누적으로 읽을 수
          있어 고를 수 있게 두었습니다. 세는 것은 둘 다 그대로 세고,
          이 값은 **경고하고 끊는 기준**만 바꿉니다.
        */}
        <div className="field" style={{ marginBottom: 0, maxWidth: '11rem' }}>
          <label htmlFor="rule-f2fmode">세는 법</label>
          <select id="rule-f2fmode" disabled={busy}
                  defaultValue={p.f2f_mode ?? '연속'}
                  onChange={(e) => e.target.value !== (p.f2f_mode ?? '연속')
                    && 고치기({ f2fMode: e.target.value })}>
            <option value="연속">연속 — 한 번 대면이면 0으로</option>
            <option value="누적">누적 — 그해에 모두 더함</option>
          </select>
        </div>
      </div>
      <p className="note small" style={{ margin: '4px 0 12px' }}>
        편람과 계약서 5-2조는 <b>3회 연속</b>입니다 — 3회 연속 대면 수령하지 않으면
        <b> 식사지원을 포함한 통합돌봄 서비스 전체가 중지</b>됩니다.
        해남군에 확인한 답도 <b>연속</b>입니다(2026-09-08). 다른 지자체가 누적으로
        볼 수 있어 「세는 법」을 두었습니다 — <b>연속·누적은 어느 쪽을 고르든
        대상자 화면에 둘 다 보입니다.</b> 고르는 것은 경고하고 끊는 기준뿐입니다.
        <b>지침이 개정되면 여기서 고칩니다.</b> 0 을 넣으면 안 봅니다.<br />
        <b>닿아도 프로그램이 상태를 바꾸지 않습니다.</b> 경고창만 띄우고,
        중단은 <b>사람이 대상자 화면에서</b> 합니다 — 군과 협의할 일이라
        기계가 앞서 정하면 안 됩니다.
      </p>

      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="rule-note">메모</label>
        <textarea id="rule-note" rows={2} defaultValue={p.note ?? ''} disabled={busy}
                  placeholder="예) 2026.8 확인 — 예산 집행 시 100원 단위 절삭, 영수증 미발행"
                  onBlur={(e) => e.target.value !== p.note && 고치기({ note: e.target.value })} />
      </div>

      <p className="note small" style={{ marginBottom: 0, marginTop: 10 }}>
        <b>규칙을 바꾸면 돈 계산이 달라집니다.</b> 무엇을 언제 누가 바꿨는지 남습니다.
        이미 확정한 청구서는 그때 값으로 얼려 두었으므로 <b>흔들리지 않습니다.</b>
      </p>
    </>
  )
}

/* ── 공휴일 — 기관이 적어 넣습니다 ────────────────────────── */
/*
 * 프로그램이 알고 있지 않습니다. 토·일은 셈으로 나오지만
 * 설날·추석은 음력이라 양력 날짜가 해마다 옮겨 다니고, 대체공휴일은
 * 그해 규정을 탑니다. 박아 두면 반드시 틀리고, 틀리면 할증이 어긋납니다.
 */
/* ── 백업정보 ─────────────────────────────────────────────── */
/*
 * 이 프로그램의 자료는 **파일 하나**에 다 들어 있습니다.
 * 그 파일이 날아가면 기관의 대상자·실적·청구가 통째로 사라집니다.
 * 「가끔 복사해 두세요」라고 말로 하면 아무도 안 하므로 프로그램이 합니다.
 *
 * 다만 **같은 디스크에만 두면 그 디스크가 죽을 때 원본과 함께 죽습니다.**
 * 그래서 다른 곳(USB·외장하드·공유 폴더)을 정할 수 있게 했습니다.
 */
/** 이 주기로 이만큼 남기면 며칠치가 되는가. 고르기 전에 보이는 편이 낫습니다. */
const 남는기간 = (시간: number, 부수: number) => {
  if (!시간) return ''
  const 시간수 = 시간 * 부수
  if (시간수 < 48) return `${시간수}시간`
  return `${Math.round(시간수 / 24)}일`
}

/**
 * 백업 파일 이름을 사람이 읽는 말로.
 *   tongdol-2026-08-28-1430.db  →  8월 28일 14:30
 *   tongdol-2026-08-28.db       →  8월 28일        (옛 이름)
 */
const 백업때 = (이름: string) => {
  const m = 이름.match(/(\d{4})-(\d{2})-(\d{2})(?:-(\d{2})(\d{2}))?/)
  if (!m) return 이름
  const [, , 월, 일, 시, 분] = m
  return `${Number(월)}월 ${Number(일)}일` + (시 ? ` ${시}:${분}` : '')
}

const 크기글 = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB`
  : n >= 1024 ? `${Math.round(n / 1024)}KB` : `${n}B`

/**
 * 폴더 고르개 — **탐색기처럼 눌러 들어갑니다.**
 *
 * 직인은 `<input type="file">` 로 고르는데, **폴더는 그렇게 못 고릅니다.**
 * 브라우저가 보안상 고른 폴더의 **전체 경로를 안 알려 주기** 때문입니다
 * (`webkitdirectory` 도, `showDirectoryPicker()` 도 마찬가지입니다).
 * 그런데 우리 서버는 **그 컴퓨터 안에서** 돌고 있으니, 서버가 폴더를 훑어
 * 목록으로 내주고 화면은 눌러 들어가기만 하면 됩니다.
 *
 * **고르기 전에 그 자리에 실제로 써 봅니다.** 「저장했습니다」 해 놓고
 * 정작 백업이 안 되는 상태로 몇 달이 지나면 안 됩니다.
 */
function 폴더고르개({ 처음, 닫기, 정하기 }: {
  처음: string; 닫기: () => void; 정하기: (p: string) => void
}) {
  const [여기, 여기로] = useState<any>(null)
  const [바쁨, 바쁘게] = useState(false)
  const [새폴더, 새폴더로] = useState('')

  const 열기 = useCallback(async (p?: string) => {
    바쁘게(true)
    try { 여기로(await api.browseFolders(p)) }
    catch (e: any) { 여기로({ 문제: e.message, 폴더들: [], 뿌리들: [], 지금: p ?? '', 위: null }) }
    finally { 바쁘게(false) }
  }, [])

  useEffect(() => { 열기(처음 || undefined) }, [열기, 처음])

  /*
   * **처음 뜰 때도 창은 바로 보여 줍니다.**
   * 자료가 올 때까지 아무것도 안 그렸더니, 누르고 나서 잠깐 **아무 일도
   * 안 일어난 것처럼** 보였습니다(느린 USB 면 몇 초). 눌렀는데 반응이 없으면
   * 사람은 한 번 더 누릅니다.
   */
  const 빔 = { 지금: '', 이름: '', 위: null, 뿌리들: [], 폴더들: [], 쓸수있나: false, 문제: '' }
  const 볼것 = 여기 ?? 빔
  const 여기서정할수있나 = !!볼것.지금 && 볼것.쓸수있나

  return (
    <div className="dlg-back" onClick={닫기}>
      <div className="dlg" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-head">
          <b>백업을 둘 폴더를 고르세요</b>
          <div className="spacer" />
          <button className="plain" onClick={닫기}>닫기</button>
        </div>

        <div className="dlg-where">
          <button disabled={바쁨} onClick={() => 열기(볼것.위 ?? undefined)}
                  title="위로">↑</button>
          <span className="mono">{볼것.지금 || '이 컴퓨터'}</span>
        </div>

        {볼것.문제 && <div className="msg err">{볼것.문제}</div>}

        <div className="dlg-list">
          {!여기 && <div className="empty small">불러오는 중…</div>}
          {여기 && 볼것.폴더들.length === 0 && !볼것.문제 && (
            <div className="empty small">이 안에는 폴더가 없습니다.</div>
          )}
          {볼것.폴더들.map((f: any) => (
            <button key={f.경로} className="dlg-row" disabled={바쁨}
                    onClick={() => 열기(f.경로)}>
              <span className="dlg-ico">📁</span>
              <span>{f.이름}</span>
            </button>
          ))}
        </div>

        {/*
          없는 폴더를 만들어 두는 자리. USB 를 꽂으면 대개 비어 있고,
          그 안에 「통돌Note백업」 같은 칸을 하나 만들어 두는 편이 낫습니다.
          (만들지 않아도 됩니다 — 정하는 순간 서버가 알아서 만듭니다.)
        */}
        {볼것.지금 && (
          <div className="row tight" style={{ alignItems: 'stretch', marginTop: 10 }}>
            <input value={새폴더} onChange={(e) => 새폴더로(e.target.value)}
                   placeholder="여기에 새 폴더 이름 (없어도 됩니다)" style={{ flex: 1 }} />
            <button disabled={바쁨 || !새폴더.trim()} style={{ flex: 'none' }}
                    onClick={() => {
                      const 끝 = 볼것.지금.endsWith('\\') || 볼것.지금.endsWith('/')
                      정하기(볼것.지금 + (끝 ? '' : (볼것.지금.includes('\\') ? '\\' : '/')) + 새폴더.trim())
                    }}>
              이 이름으로 만들고 정하기
            </button>
          </div>
        )}

        <div className="dlg-foot">
          <span className="muted small">
            {!여기 ? '불러오는 중…'
              : 볼것.지금
              ? (여기서정할수있나
                  ? '이 폴더에 실제로 써 봤습니다. 됩니다.'
                  : (볼것.문제 || '여기에는 쓸 수 없습니다. 다른 폴더를 고르세요.'))
              : '드라이브를 고르세요. USB 는 대개 D: 나 E: 입니다.'}
          </span>
          <div className="spacer" />
          <button className="primary" disabled={바쁨 || !여기서정할수있나}
                  onClick={() => 정하기(볼것.지금)}>
            이 폴더로 정하기
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * ── 사무실 안에서 열기 ──────────────────────────────────────
 *
 * 사무보조원이 **자기 자리 컴퓨터**에서 대상자를 등록하고 서식을 뽑는
 * 길입니다. 지금은 관리자 PC 앞에 가서 앉아야 합니다.
 * (2026-09-05 무무 — 「관리자가 한시적 승인으로 접근할 수 있는 url」)
 *
 * ★ 세 겹으로 막습니다 —
 *   ① 몇 시간짜리로만 열리고 저절로 닫힙니다
 *   ② 여섯 자리 번호를 물어봅니다
 *   ③ 그다음 본인 아이디·비밀번호로 들어갑니다
 *
 * ★ 방화벽 경고는 **못 막습니다.** 윈도우가 띄우는 창이라 우리 손이
 *   닿지 않습니다. 미리 알려 주는 것이 할 수 있는 전부입니다
 *   (무무: 한글 경고창은 「고객 입장에서는 굉장히 무서울 일」).
 */
/*
 * ── 설정 → 이 프로그램 → 업데이트 ──────────────────────────
 *
 * 여기 있는 것은 셋입니다 — **켜고 끄기 · 지금 확인해 보기 · 지난 목록.**
 *
 * ── 왜 「지난 목록」이 있나 ─────────────────────────────────
 *
 * 띠는 한 번 닫으면 사라집니다. 그런데 몇 주 뒤 「그때 뭐가 바뀐다고
 * 했더라」가 반드시 생깁니다 — 특히 청구액이 달라 보일 때. 그때 볼
 * 자리가 없으면 저에게 전화를 거셔야 합니다. 그래서 남겨 둡니다.
 *
 * ── 왜 「무엇이 나가나」를 그 자리에 적나 ───────────────────
 *
 * 통합돌봄 자료를 다루는 프로그램이 바깥으로 무언가 보낸다면, 기관은
 * 그게 무엇인지 알 권리가 있습니다. 그리고 실제로 **아무것도 안
 * 보냅니다** — 파일을 받아 와 이 컴퓨터 안에서 견줍니다. 그 사실을
 * 설명서 어딘가가 아니라 **끄는 단추 바로 옆**에 적습니다.
 */
function 업데이트칸() {
  const [것, set것] = useState<any>(null)
  const [바쁨, set바쁨] = useState(false)

  const 보기 = async () => {
    try { set것(await api.업데이트()) } catch { set것(null) }
  }
  useEffect(() => { 보기() }, [])
  if (!것) return null

  const 준비 = 것.형편?.무엇 === '준비됨' ? 것.형편.정보 : null

  return (
    <div className="card 업데이트설정">
      <h2>업데이트 안내</h2>

      <label className="check">
        <input
          type="checkbox"
          checked={!!것.켜짐}
          onChange={async (e) => {
            await api.업데이트설정({ 켜짐: e.target.checked }).catch(() => {})
            보기()
          }}
        />
        <span>새 버전이 나오면 알려 줍니다</span>
      </label>

      {/*
        ── 이 두 문단만 남긴 까닭 ──────────────────────────────
        여기는 **인터넷에 닿는 기능**입니다. 통합돌봄 자료가 든 컴퓨터에서
        바깥으로 무언가 오간다면, 기관은 그게 무엇인지 알 권리가 있습니다.
        그래서 「무엇이 나가나」와 「저절로 바뀌나」 둘은 끄는 단추 바로
        옆에 답이 있어야 합니다. 이건 안내가 아니라 **묻기 전에 답하는 것**입니다.
      */}
      <p className="note small">
        하루에 한 번, 켤 때 <b>「지금 가장 새 버전이 몇 번인가」가 적힌
        파일 하나</b>(1KB쯤)를 읽어 옵니다. <b>이 컴퓨터에서 나가는 것은
        아무것도 없습니다</b> — 대상자 정보는 물론이고 <b>이 컴퓨터가 몇 번
        버전을 쓰는지조차 보내지 않습니다.</b> 받아 온 파일을 이 안에서
        견주기만 합니다.
      </p>
      <p className="note small">
        <b>저절로 바꾸지 않습니다.</b> 새 버전이 나오면 무엇이 바뀌는지
        화면 위에 띠로 보여 드리고, <b>관리자가 「지금 업데이트」를 눌러야</b>
        {' '}바뀝니다.
      </p>

      {준비 && (
        <dl className="facts">
          <dt>받아 둔 새 버전</dt><dd className="mono">v{준비.버전}</dd>
        </dl>
      )}

      {/*
        단추는 **하나**입니다. 저절로 하루 한 번 보지만, 만든 곳에서
        「방금 올렸어요」라고 전화가 올 때가 있습니다. 그때 다시 켜 봐야
        소용이 없습니다 — 하루에 한 번만 보게 해 두었기 때문입니다.
        그래서 당길 자리는 남깁니다.
      */}
      <div className="row tight">
        <button
          className="plain"
          disabled={바쁨}
          onClick={async () => {
            set바쁨(true)
            try {
              const r = await api.업데이트확인()
              if (r.형편?.무엇 === '조용')
                alert('지금 쓰시는 것이 가장 새 버전입니다.\n받을 것이 없습니다.')
            } catch (e: any) { alert(e.message) }
            set바쁨(false); 보기()
          }}
        >{바쁨 ? '보는 중…' : '새 버전이 있는지 지금 확인'}</button>
      </div>

      {/*
        띠는 한 번 닫으면 사라집니다. 그런데 몇 주 뒤 「그때 뭐가 바뀐다고
        했더라」가 반드시 생깁니다 — 특히 청구액이 달라 보일 때. 그때 볼
        자리가 없으면 만든 곳에 전화를 거셔야 합니다.
      */}
      {(것.지난목록 ?? []).length > 0 && (
        <details className="지난버전">
          <summary>지금까지 바뀐 것</summary>
          {(것.지난목록 ?? []).map((p: any) => (
            <div className="지난버전줄" key={p.버전}>
              <b className="mono">v{p.버전}</b> <span className="흐림">{p.낸날}</span>
              <ul>{(p.바뀐것 ?? []).map((줄: string, i: number) => <li key={i}>{줄}</li>)}</ul>
            </div>
          ))}
        </details>
      )}
    </div>
  )
}

function 사무실칸() {
  const [s, setS] = useState<any>(null)
  const [고른시간, 시간고르기] = useState(4)
  const [busy, setBusy] = useState(false)
  const [알림, set알림] = useState<{ kind: string; text: string } | null>(null)
  const [안내봄, 안내보기] = useState(false)

  const 보기 = useCallback(async () => {
    try { setS(await api.사무실열림()) } catch { setS(null) }
  }, [])
  useEffect(() => { 보기() }, [보기])

  if (!s) return null

  async function 열기() {
    setBusy(true); set알림(null)
    try {
      const r = await api.사무실열기(고른시간)
      setS({ ...s, ...r }); 안내보기(false)
    } catch (e: any) { set알림({ kind: 'err', text: e.message }) }
    finally { setBusy(false); 보기() }
  }

  return (
    <div className="card">
      <h2>사무실 안에서 열기</h2>
      <p className="note">
        사무보조원이 <b>자기 자리 컴퓨터</b>에서 대상자를 등록하고 서식을 뽑을 수
        있게 잠깐 열어 둡니다. 정한 시각이 되면 <b>저절로 닫힙니다.</b>
        통돌 Note를 껐다 켜면 <b>닫힌 채로</b> 시작합니다.
      </p>

      {!s.주소있나 && (
        <div className="msg warn">
          사무실 네트워크에 붙어 있지 않습니다. 랜선이나 와이파이를 확인해 주세요.
        </div>
      )}

      {s.열림 ? (
        <>
          <div className="열린안내">
            <div className="열린줄">
              <span className="이름표">주소</span>
              <b className="열린값">{s.주소}</b>
            </div>
            <div className="열린줄">
              <span className="이름표">번호</span>
              <b className="열린값 번호">{s.번호}</b>
            </div>
          </div>
          <p className="note">
            보조원 컴퓨터의 <b>인터넷 창 주소칸</b>에 위 주소를 그대로 치면
            번호를 물어봅니다. 번호를 넣은 뒤 <b>본인 아이디와 비밀번호</b>로
            들어가시면 됩니다.
          </p>
          <div className="row tight">
            <button className="plain" disabled={busy} onClick={async () => {
              setBusy(true)
              await api.사무실닫기().catch(() => {})
              setBusy(false); 보기()
            }}>지금 닫기</button>
            <span className="muted small" style={{ alignSelf: 'center' }}>
              {s.닫힐때 && `${new Date(s.닫힐때).getHours()}시 ` +
                `${String(new Date(s.닫힐때).getMinutes()).padStart(2, '0')}분에 닫힙니다`}
            </span>
          </div>
        </>
      ) : 안내봄 ? (
        /*
         * ★ 누르기 **전에** 방화벽 창을 미리 보여 줍니다.
         *   모르고 만나면 무섭고, 알고 만나면 그냥 절차입니다.
         */
        <>
          <div className="msg warn" style={{ lineHeight: 1.7 }}>
            <b>잠시 뒤 윈도우가 물어봅니다.</b><br />
            「Windows Defender 방화벽에서 이 앱의 일부 기능을 차단했습니다」<br /><br />
            <b>개인 네트워크</b>에만 체크하시고, <b>공용 네트워크는 비워 두세요.</b><br />
            그다음 <b>「액세스 허용」</b>을 눌러 주세요.<br />
            <span className="muted">이 창은 처음 한 번만 뜹니다.</span>
          </div>
          <div className="row tight">
            <button className="primary" disabled={busy} onClick={열기}>
              {busy ? '여는 중…' : `${고른시간}시간 열기`}
            </button>
            <button className="plain" disabled={busy}
                    onClick={() => 안내보기(false)}>그만두기</button>
          </div>
        </>
      ) : (
        <div className="row tight" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="lan-h">얼마나</label>
            <select id="lan-h" value={고른시간}
                    onChange={(e) => 시간고르기(Number(e.target.value))}>
              {(s.시간들 ?? []).map((x: any) => (
                <option key={x.값} value={x.값}>{x.이름}</option>
              ))}
            </select>
          </div>
          <button className="plain" disabled={busy || !s.주소있나}
                  onClick={() => 안내보기(true)}>열기</button>
        </div>
      )}

      {알림 && <div className={`msg ${알림.kind}`}>{알림.text}</div>}

      <p className="note" style={{ marginBottom: 0 }}>
        <b>번호를 왜 묻나요.</b> 주소만 열면 사무실 와이파이에 붙은 아무 기기가
        로그인 화면을 봅니다. 로그인 화면이 보이면 비밀번호를 맞혀 볼 수 있습니다.
        번호가 한 겹 더입니다. <b>번호는 옆자리에 말로 알려 주세요.</b>
      </p>
    </div>
  )
}

/**
 * ── 들어온 기록 ─────────────────────────────────────────────
 *
 * 홈에는 **기기가 실제로 바뀐 것만** 뜹니다. 브라우저만 바꿔 들어온
 * 것까지 띄우면 알림이 잦아지고, 잦은 알림은 안 읽히고, 안 읽히는
 * 알림은 정작 남이 들어왔을 때도 넘어갑니다.
 * (2026-09-05 무무 — 「브라우저만 바뀐 경우엔 안뜨고 기기변경 시에만」)
 *
 * 그래서 **안 띄운 것까지 여기 남깁니다.** 평소엔 아무도 안 봐도 되고,
 * 이상하다 싶을 때 볼 자리가 하나는 있어야 합니다.
 */
function 들어온기록칸() {
  const [목록, set목록] = useState<any[] | null>(null)
  const [폄, 펴기] = useState(false)

  useEffect(() => {
    if (!폄 || 목록) return
    api.들어온기록().then((r: any) => set목록(r.목록 ?? [])).catch(() => set목록([]))
  }, [폄, 목록])

  return (
    <div className="card">
      <h2>휴대폰이 들어온 기록</h2>
      <p className="note">
        제공인력이 아이디·비밀번호로 들어온 기록입니다.
        <b> 기기가 바뀐 것만 홈에 뜹니다</b> — 같은 휴대폰에서 브라우저만
        바꿔 여신 것은 여기에만 남습니다.
      </p>
      {!폄 ? (
        <button className="plain" onClick={() => 펴기(true)}>기록 보기</button>
      ) : 목록 === null ? (
        <p className="muted">불러오는 중…</p>
      ) : !목록.length ? (
        <p className="muted">아직 아무도 들어온 적이 없습니다.</p>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>때</th><th>누가</th><th>휴대폰</th><th></th></tr></thead>
            <tbody>
              {목록.map((b, i) => (
                <tr key={i}>
                  <td className="muted small">
                    {new Date(b.때).toLocaleString('ko-KR',
                      { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>{b.이름}</td>
                  <td className="muted small">{b.표식}</td>
                  <td className="small">
                    {b.같은폰
                      ? <span className="muted">같은 휴대폰 · 브라우저만</span>
                      : b.끊은수 > 0
                        ? <b style={{ color: 'var(--bad)' }}>기기가 바뀜</b>
                        : <span className="muted">첫 휴대폰</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="note" style={{ marginBottom: 0 }}>
        <b>웹은 기기 고유번호를 못 읽습니다.</b> 그래서 「휴대폰」 칸은
        폰 모델·화면 크기로 <b>미루어 본 것</b>입니다 — 같은 기종 폰
        두 대는 못 가립니다. 짚이는 데가 있으면 종사자 화면에서
        그 분의 기기를 끊어 주세요.
      </p>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
 *  확인사항 항목 — 폰에서 누르는 「오늘 해 드린 것」
 * ══════════════════════════════════════════════════════════════
 *
 * (2026-09-06 무무 — 「가사지원 확인사항은 **기관의 입맛에 변경하여
 *  사용할 수 있도록** 설정에서 항목을 추가/삭제 할 수 있는 기능을 넣자」)
 *
 * ── 여기서 지키는 것 셋 ──────────────────────────────────────
 *
 *  ① **서식은 안 건드립니다.** 서식3 의 열한 줄은 편람이 정한 것이라
 *     한 줄도 안 늘립니다. 기관이 더한 항목은 서식의 **「기타」 칸에
 *     모아서** 찍힙니다. (무무 — 「세상에 지자체에 제출하는 서류의
 *     서식을 마음대로 수정하는 경우는 없어」)
 *
 *  ② **고치면 그때 목록을 얼려 둡니다.** 3월에 「말벗」을 눌러 둔
 *     기록이, 6월에 「말벗」을 지우는 순간 사라지면 안 됩니다.
 *     지난 기록은 계속 옛 목록으로 보이고 옛 목록으로 인쇄됩니다.
 *
 *  ③ **앱을 다시 안 올려도 됩니다.** 저장하면 오늘 갈 곳 짐에 실려
 *     폰으로 갑니다. 제공인력은 아무것도 안 해도 됩니다.
 */
function 확인사항칸() {
  const [것, set것] = useState<any>(null)
  const [줄들, set줄들] = useState<string[]>([])
  const [새것, set새것] = useState('')
  const [바쁨, set바쁨] = useState(false)
  const [말, set말] = useState<{ kind: string; text: string } | null>(null)
  const [이력열림, set이력열림] = useState(false)

  async function 불러오기() {
    try {
      const r: any = await api.checkItems()
      set것(r); set줄들(r?.지금?.항목 ?? [])
    } catch { /* 옛 버전이면 이 길이 없습니다 */ }
  }
  useEffect(() => { 불러오기() }, [])
  if (!것) return null

  const 편람: string[] = 것.편람 ?? []
  const 원래: string[] = 것.지금?.항목 ?? []
  const 바뀜 = 줄들.length !== 원래.length || 줄들.some((x, i) => x !== 원래[i])

  const 옮기기 = (i: number, 몇: number) => {
    const j = i + 몇
    if (j < 0 || j >= 줄들.length) return
    const c = [...줄들]; [c[i], c[j]] = [c[j], c[i]]; set줄들(c)
  }

  function 더하기() {
    const x = 새것.trim().replace(/\s+/g, ' ')
    if (!x) return
    if (줄들.includes(x)) { set말({ kind: 'err', text: `「${x}」 은 이미 있습니다.` }); return }
    if (x.length > 20) { set말({ kind: 'err', text: '항목은 20자 안으로 적어 주세요.' }); return }
    set줄들([...줄들, x]); set새것(''); set말(null)
  }

  async function 저장() {
    set바쁨(true); set말(null)
    try {
      await api.saveCheckItems(줄들)
      await 불러오기()
      set말({ kind: 'ok', text: '저장했습니다. 폰에는 곧 반영됩니다 — 제공인력은 아무것도 안 해도 됩니다.' })
    } catch (e: any) { set말({ kind: 'err', text: e.message }) }
    finally { set바쁨(false) }
  }

  return (
    <div className="card">
      <h2>확인사항 항목</h2>
      <p className="note small">
        제공인력 폰의 <b>가사지원</b> 화면에서 누르는 「오늘 해 드린 것」입니다.
        기관에서 자주 하는 일을 더하고, 한 번도 안 하는 것은 빼도 됩니다.
        <b> 순서가 그대로 폰 화면의 순서</b>입니다.
      </p>

      <ol className="확인줄들">
        {줄들.map((x, i) => (
          <li key={x + i}>
            <span className="확인번호">{i + 1}</span>
            <input value={x} onChange={(e) => {
              const c = [...줄들]; c[i] = e.target.value; set줄들(c)
            }} />
            {편람.includes(x)
              ? <span className="딱지 작게" title="편람 서식3 에 있는 항목 — 서식의 그 줄에 ○ 로 찍힙니다">서식</span>
              : <span className="딱지 작게 기타" title="서식3 에 없는 항목 — 서식의 「기타」 칸에 모아서 찍힙니다">기타</span>}
            <button type="button" className="plain" onClick={() => 옮기기(i, -1)}
                    disabled={i === 0} aria-label="위로">↑</button>
            <button type="button" className="plain" onClick={() => 옮기기(i, 1)}
                    disabled={i === 줄들.length - 1} aria-label="아래로">↓</button>
            <button type="button" className="plain 지움"
                    onClick={() => set줄들(줄들.filter((_, k) => k !== i))}>빼기</button>
          </li>
        ))}
      </ol>

      <div className="row tight" style={{ alignItems: 'flex-end', marginTop: 8 }}>
        <div className="field" style={{ flex: 1, margin: 0 }}>
          <label htmlFor="새확인">항목 더하기</label>
          <input id="새확인" value={새것} onChange={(e) => set새것(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); 더하기() } }}
                 placeholder="예) 약 챙겨 드리기" />
        </div>
        <button type="button" onClick={더하기}>더하기</button>
      </div>

      {말 && <div className={`msg ${말.kind}`}>{말.text}</div>}

      <div className="btns" style={{ marginTop: 10 }}>
        <button className="primary" disabled={!바뀜 || 바쁨} onClick={저장}>
          {바쁨 ? '저장 중…' : '저장'}
        </button>
        <button className="plain" disabled={!바뀜} onClick={() => { set줄들(원래); set말(null) }}>
          되돌리기
        </button>
        <button className="plain" onClick={() => { set줄들([...편람]); set말(null) }}>
          편람 열한 가지로
        </button>
      </div>

      <p className="note small" style={{ marginTop: 12 }}>
        <b>「서식」 표가 붙은 것</b>은 편람 서식3 에 있는 항목입니다 — 제공기록지의
        그 줄에 <b>○</b> 로 찍힙니다.<br />
        <b>「기타」 표가 붙은 것</b>은 서식3 에 없는 항목입니다. 지자체에 내는
        서식은 <b>한 줄도 고치지 않으므로</b>, 이런 항목은 서식의
        <b> 「기타」 칸에 모아서</b> 나갑니다 (「약 챙겨 드리기 · 화분 물주기」).<br />
        <b>지운 항목도 지난 기록에는 그대로 남습니다.</b> 목록을 고칠 때마다
        그때 목록을 얼려 두기 때문입니다 — <b>제공 당시의 목록으로 서식을 뽑습니다.</b>
      </p>

      {(것.이력?.length ?? 0) > 1 && (
        <>
          <button type="button" className="plain" style={{ padding: 0 }}
                  onClick={() => set이력열림(!이력열림)}>
            {이력열림 ? '바꾼 기록 접기' : `바꾼 기록 ${것.이력.length}번 보기`}
          </button>
          {이력열림 && (
            <table className="확인이력">
              <tbody>
                {것.이력.map((h: any) => (
                  <tr key={h.버전}>
                    <td className="mono small">{String(h.때).slice(0, 10)}</td>
                    <td className="small">{h.누가}</td>
                    <td className="small">{h.항목.join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}


/**
 * ── 근무시간 ────────────────────────────────────────────────
 *
 * 성질이 다른 둘을 한 칸에 둡니다.
 *
 *   켜기 — **상시 설정.** 한 번 켜 두면 계속 그렇습니다.
 *   끄기 — **그날의 예약.** 반차라 일찍 나가는 날만 겁니다.
 *          (2026-09-05 무무 — 「켜는것은 상시이지만 끄는 것은
 *           일시적 이벤트로 필요할때만」)
 */
function 근무시간칸() {
  const [h, setH] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [고른시간, 시간고르기] = useState(6)
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null)

  const load = useCallback(async () => {
    try { setH(await api.근무시간()) } catch { /* 옛 버전이면 없습니다 */ }
  }, [])
  useEffect(() => { load() }, [load])

  async function 하기(무엇: () => Promise<any>, 말: string) {
    setBusy(true); setMsg(null)
    try {
      const r = await 무엇()
      setH(r.정보)
      setMsg({ kind: 'ok', text: 말 })
    } catch (e: any) { setMsg({ kind: 'bad', text: e.message }) }
    finally { setBusy(false) }
  }

  if (!h) return null
  const 예약 = h.예약된때 ? new Date(h.예약된때) : null
  const 예약말 = 예약
    ? `${String(예약.getHours()).padStart(2, '0')}:${String(예약.getMinutes()).padStart(2, '0')}`
    : ''

  return (
    <div className="card">
      <h2>근무시간</h2>
      <p className="note small" style={{ marginTop: 0 }}>
        이 프로그램이 꺼져 있으면 <b>제공인력 휴대폰이 아무것도 못 합니다</b> —
        새 휴대폰으로 로그인해도 열쇠를 못 받고, 보낸 보고도 안 내려옵니다.
      </p>

      <label className="check" style={{ display: 'block', margin: '10px 0' }}>
        <input type="checkbox" disabled={busy || !h.자동시작됨}
               checked={!!h.자동시작}
               onChange={(e) => 하기(
                 () => api.자동시작고치기(e.target.checked),
                 e.target.checked ? '컴퓨터를 켤 때 같이 켜집니다.' : '같이 켜지지 않습니다.')} />
        {' '}<b>컴퓨터를 켜면 통돌 Note 도 같이 켜기</b>
      </label>
      <p className="note small" style={{ margin: '0 0 16px' }}>
        관리자가 반차인 날에도 <b>사무실 동료가 컴퓨터만 켜 주면</b> 됩니다.
        동료는 관리자 계정을 모르니 <b>어르신 자료는 못 봅니다</b> —
        로그인해야 보입니다.
        {!h.자동시작됨 && <> (윈도우에서만 됩니다.)</>}
      </p>

      <div style={{ borderTop: '1px solid var(--line, #e5e5e5)', paddingTop: 14 }}>
        <b>컴퓨터 종료 예약</b>
        <p className="note small" style={{ margin: '4px 0 10px' }}>
          일찍 나가시는 날만 거는 <b>일회성</b>입니다. 늘 걸려 있지 않습니다.
          예약은 <b>윈도우가 들고 있어서</b>, 통돌 Note 창을 닫고 나가셔도
          그 시각에 컴퓨터가 꺼집니다.
        </p>

        {예약 ? (
          <div className="msg warn" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>오늘 <b>{예약말}</b> 에 컴퓨터가 꺼집니다.</span>
            <button className="plain" disabled={busy} style={{ marginLeft: 'auto' }}
                    onClick={() => 하기(() => api.종료예약취소(), '예약을 물렸습니다.')}>
              예약 취소
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <div className="field" style={{ marginBottom: 0, maxWidth: '12rem' }}>
              <label htmlFor="hours-off">지금부터</label>
              <select id="hours-off" disabled={busy} value={고른시간}
                      onChange={(e) => 시간고르기(Number(e.target.value))}>
                {h.예약시간들.map((x: any) => (
                  <option key={x.값} value={x.값}>{x.이름}</option>
                ))}
              </select>
            </div>
            <button disabled={busy || !h.자동시작됨}
                    onClick={() => 하기(() => api.종료예약(고른시간), '예약했습니다.')}>
              컴퓨터 끄기 예약
            </button>
          </div>
        )}
        <p className="note small" style={{ margin: '8px 0 0' }}>
          꺼지기 <b>{h.미리알림분}분 전</b>에 윈도우가 알려 주고, 그때도 물릴 수 있습니다.
          같은 컴퓨터를 다른 분이 쓰고 계시면 <b>그분 것도 함께 꺼집니다.</b>
        </p>
      </div>

      {msg && <div className={'msg ' + (msg.kind === 'ok' ? 'ok' : 'bad')}
                   style={{ marginTop: 10 }}>{msg.text}</div>}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
 *  USB 로 오간 자료 맞추기
 * ══════════════════════════════════════════════════════════════
 *
 * (2026-09-06 무무 — 「USB에 백업된 파일을 가지고 집에서 작업 시
 *  다음날 출근하여 백업USB를 기관PC에 꽂아 프로그램을 열면
 *  최신 데이터로 동기화 해줘야 해」)
 *
 * ── 이 화면이 지키는 것 ──────────────────────────────────────
 *
 *  ① **무엇이 사라지는지 표로 먼저 보여 줍니다.** 「가져오시겠습니까」만
 *     묻고 덮으면, 그날 오전에 사무실에서 넣은 것이 말없이 없어집니다.
 *  ② **가져오기 전에 지금 것을 한 부 떠 둡니다.** 잘못 눌러도 돌아올
 *     자리가 있어야 합니다 (되돌리기와 같은 길입니다).
 *  ③ **바로 안 바뀝니다.** 다음에 켤 때 바뀝니다 — 쓰는 중에 자료함이
 *     통째로 갈리면 열어 둔 화면이 거짓말을 하게 됩니다.
 */
function USB칸() {
  const [것, set것] = useState<any>(null)
  const [바쁨, set바쁨] = useState(false)
  const [말, set말] = useState<{ kind: string; text: string } | null>(null)
  const [고른것, set고른것] = useState('')
  const [끝남, set끝남] = useState(false)

  const 불러오기 = useCallback(async () => {
    try {
      const r: any = await api.usbSync()
      set것(r); set고른것(r?.찾음?.으뜸 ?? '')
    } catch { /* 옛 버전이면 이 길이 없습니다 */ }
  }, [])
  useEffect(() => { 불러오기() }, [불러오기])

  async function 다른것보기(경로: string) {
    set바쁨(true); set말(null); set고른것(경로)
    try {
      const r: any = await api.usbCompare(경로)
      set것((앞: any) => ({ ...앞, 견: r.견 }))
    } catch (e: any) { set말({ kind: 'err', text: e.message }) }
    finally { set바쁨(false) }
  }

  async function 가져오기() {
    const 견 = 것?.견
    if (!견) return
    if (견.판단 === '갈라짐') {
      if (!confirm(
        `이 컴퓨터에만 있는 ${견.이쪽에만}건이 사라집니다.\n\n` +
        `가져오기 전에 지금 자료를 한 부 떠 두므로 되돌릴 수는 있습니다.\n` +
        `그래도 가져올까요?`)) return
    }
    set바쁨(true); set말(null)
    try {
      const r: any = await api.usbImport(고른것, 견.이쪽에만)
      set끝남(true)
      set말({
        kind: 'ok',
        text: '준비했습니다. 프로그램을 껐다 켜면 그때 바뀝니다. ' +
              `지금 자료는 「${r.지금것을떠둠 ?? '보관 폴더'}」에 떠 두었습니다.`,
      })
    } catch (e: any) { set말({ kind: 'err', text: e.message }) }
    finally { set바쁨(false) }
  }

  if (!것) return null
  const 찾음 = 것.찾음 ?? {}
  const 견 = 것.견
  const 갈라짐 = 견?.판단 === '갈라짐'

  return (
    <div className={갈라짐 ? 'card warn' : 'card'}>
      <h2>USB 로 오간 자료</h2>
      <p className="note small">
        집에서 USB 의 백업으로 일하고 오셨으면, 그 파일을 여기서
        <b> 이 컴퓨터로 가져옵니다.</b> 무엇이 사라지는지 먼저 보여 드립니다.
      </p>

      {!찾음.볼것있나 && (
        <p className="muted small" style={{ margin: 0 }}>{찾음.까닭 || '가져올 것이 없습니다.'}</p>
      )}

      {찾음.볼것있나 && (
        <>
          <div className="field">
            <label htmlFor="usb-file">어느 파일에서</label>
            <select id="usb-file" value={고른것} disabled={바쁨 || 끝남}
                    onChange={(e) => 다른것보기(e.target.value)}>
              {찾음.후보?.map((f: any) => (
                <option key={f.경로} value={f.경로}>
                  {f.이름} — {new Date(f.만든때).toLocaleString('ko-KR')}
                </option>
              ))}
            </select>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              백업 자리: <span className="mono">{찾음.자리}</span>
            </p>
          </div>

          {견 && (
            <>
              <p className={갈라짐 ? 'msg warn' : 'note small'} style={{ margin: '8px 0' }}>
                {견.말}
              </p>

              {/*
                ★ **표로 보여 줍니다.** 「N건이 사라집니다」라는 한 줄만으로는
                  그 N 이 대상자인지 실적인지 청구서인지 모릅니다.
                  청구서 3장이 사라지는 것과 메모 3개가 사라지는 것은
                  전혀 다른 일입니다.
              */}
              <table className="USB견줌">
                <thead>
                  <tr>
                    <th></th>
                    <th className="right">USB 에만</th>
                    <th className="right">이 컴퓨터에만</th>
                  </tr>
                </thead>
                <tbody>
                  {견.줄들?.map((r: any) => (
                    <tr key={r.이름} className={r.이쪽에만 > 0 ? '사라짐' : undefined}>
                      <td title={r.뜻}>{r.이름}</td>
                      <td className="right mono">{r.저쪽에만 || <span className="muted">—</span>}</td>
                      <td className="right mono">
                        {r.이쪽에만 ? <b>{r.이쪽에만}</b> : <span className="muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="small muted" style={{ margin: '6px 0 10px' }}>
                <b>USB 에만</b> — 집에서 하신 일입니다. 가져오면 들어옵니다.<br />
                <b>이 컴퓨터에만</b> — <b>가져오면 사라집니다.</b> 0 이면 안심하셔도 됩니다.<br />
                마지막 실적: USB <b className="mono">{견.저쪽?.마지막실적 || '—'}</b> ·
                이 컴퓨터 <b className="mono">{견.이쪽?.마지막실적 || '—'}</b>
              </p>

              {끝남 ? null : 견.가져올수있나 ? (
                <div className="btns">
                  <button className={갈라짐 ? undefined : 'primary'} disabled={바쁨}
                          onClick={가져오기}>
                    {바쁨 ? '준비 중…' : 갈라짐
                      ? `가져오기 (이 컴퓨터 ${견.이쪽에만}건이 사라집니다)`
                      : '가져오기'}
                  </button>
                </div>
              ) : (
                <p className="msg" style={{ margin: 0 }}>{견.못하는까닭}</p>
              )}
            </>
          )}
        </>
      )}

      {말 && <div className={`msg ${말.kind}`}>{말.text}</div>}
    </div>
  )
}

function BackupCard({ health }: { health: any }) {
  const [b, setB] = useState<any>(null)
  const [dir, setDir] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null)
  // 폴더 고르개
  const [고르기, 고르기로] = useState(false)
  const [고르기시작, 고르기시작으로] = useState('')
  const 고르기열기 = (from: string) => { 고르기시작으로(from); 고르기로(true) }
  // 되돌리기 — 펼친 자리, 견주어 본 것
  const [펼침, 펼치기] = useState('')
  const [견줌, 견주기] = useState<any>(null)

  const load = useCallback(async () => {
    try {
      const d = await api.backup()
      setB(d)
      const 정한것 = d.자리들?.find((x: any) => x.정한것)
      setDir(정한것?.경로 ?? '')
    } catch { /* 권한이 없으면 조용히 */ }
  }, [])
  useEffect(() => { load() }, [load])

  async function 지금백업() {
    setBusy(true); setMsg(null)
    try {
      const r = await api.backupNow()
      setB(r.정보)
      setMsg({ kind: 'ok', text: `${r.뜬곳.length}곳에 떠 두었습니다.` })
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) }
    finally { setBusy(false) }
  }

  async function 주기저장(every: number, keep: number) {
    setBusy(true); setMsg(null)
    try {
      const r = await api.setBackupSchedule(every, keep)
      setB(r.정보)
      setMsg({ kind: 'ok', text: '백업 주기를 바꿨습니다. 다시 켜지 않아도 바로 적용됩니다.' })
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) }
    finally { setBusy(false) }
  }

  async function 자리저장(값?: string) {
    const 정할것 = (값 ?? dir).trim()
    setBusy(true); setMsg(null)
    try {
      const r = await api.setBackupDir(정할것)
      setB(r.정보)
      setMsg({
        kind: 'ok',
        text: 정할것
          ? '그 폴더에 실제로 떠 봤습니다. 됩니다.'
          : '이제 자료함 옆에만 떠 둡니다.',
      })
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) }
    finally { setBusy(false) }
  }

  /*
   * ── 되돌리기 ───────────────────────────────────────────────
   *
   * **고르자마자 바꾸지 않습니다.** 먼저 견줍니다.
   * 되돌리기는 지금 자료를 버리는 일이라, 「그 파일에 무엇이 얼마나
   * 들어 있는지」를 지금 것과 나란히 놓고 사람이 정하게 합니다.
   */
  async function 들여다보기(경로: string) {
    setBusy(true); setMsg(null); 견주기(null)
    try {
      const r = await api.inspectBackup(경로)
      견주기({ 경로, ...r })
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) }
    finally { setBusy(false) }
  }

  async function 되돌리기(경로: string) {
    setBusy(true); setMsg(null)
    try {
      const r = await api.restoreBackup(경로)
      setB(r.정보); 견주기(null); 펼치기('')
      setMsg({ kind: 'ok', text: '준비했습니다. 프로그램을 껐다 켜면 그때 바뀝니다.' })
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) }
    finally { setBusy(false) }
  }

  async function 되돌리기취소() {
    setBusy(true); setMsg(null)
    try {
      const r = await api.cancelRestore()
      setB(r.정보)
      setMsg({ kind: 'ok', text: '되돌리기를 물렀습니다. 지금 자료 그대로 갑니다.' })
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) }
    finally { setBusy(false) }
  }

  const 막힌곳 = b?.자리들?.find((x: any) => x.문제)

  return (
    <div className={막힌곳 || b?.오류 || b?.예약 ? 'card warn' : 'card'}>
      <h2>백업정보</h2>

      {/*
        예약된 되돌리기는 **맨 위**에 둡니다.
        「다시 켜면 자료가 바뀐다」는 것을 모르고 며칠 쓰면 안 됩니다.
      */}
      {b?.예약 && (
        <div className="msg warn">
          <b>되돌리기가 예약되어 있습니다.</b>{' '}
          프로그램을 껐다 켜면 아래 파일로 자료함이 바뀝니다.
          <div className="mono small" style={{ wordBreak: 'break-all', marginTop: 4 }}>
            {b.예약.어느것}
          </div>
          <div className="btns" style={{ marginTop: 6 }}>
            <button disabled={busy} onClick={되돌리기취소}>되돌리기 무르기</button>
          </div>
        </div>
      )}

      {(막힌곳 || b?.오류) && (
        <div className="msg err">
          {막힌곳?.문제 ?? b?.오류}
        </div>
      )}
      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      <dl className="facts">
        <dt>원본</dt>
        <dd className="mono small">
          {b?.원본 ?? health?.dbPath ?? '—'}
          {b?.원본크기 ? <span className="muted"> · {크기글(b.원본크기)}</span> : null}
        </dd>
        <dt>마지막 백업</dt>
        <dd>
          {b?.마지막
            ? new Date(b.마지막).toLocaleString('ko-KR')
            : <span className="muted">아직 없습니다</span>}
        </dd>
        <dt>형식</dt><dd>v{health?.schemaVersion ?? '—'}</dd>
        <dt>처음 설치</dt>
        <dd>{health?.installedAt ? new Date(health.installedAt).toLocaleString('ko-KR') : '—'}</dd>
      </dl>

      {/*
        어느 자리에 백업이 **몇 개** 들어 있는가.
        「5부」라고만 두었더니 그 숫자가 무엇을 센 것인지 안 보였습니다 —
        백업 파일 개수인지, 날짜인지, 설정값인지. 그래서 말을 붙였습니다.
      */}
      {b?.자리들?.map((x: any) => (
        <div key={x.경로} style={{ marginTop: 12 }}>
          <div className="small">
            <b>{x.무엇}</b>
            <span className="muted">
              {' · '}
              {x.파일.length > 0
                ? `백업 파일 ${x.파일.length}개`
                : '아직 없습니다'}
            </span>
          </div>
          <div className="mono small muted" style={{ wordBreak: 'break-all' }}>{x.경로}</div>
          {x.파일.length > 0 && (
            <div className="muted small" style={{ marginTop: 2 }}>
              가장 최근 {백업때(x.파일[0].이름)}
              {x.파일[0].크기 ? ` · ${크기글(x.파일[0].크기)}` : ''}
            </div>
          )}
          {x.파일.length > 0 && (
            <div className="btns" style={{ marginTop: 6 }}>
              <button className="small" disabled={busy}
                      onClick={() => { 견주기(null); 펼치기(펼침 === x.경로 ? '' : x.경로) }}>
                {펼침 === x.경로 ? '접기' : '여기 것으로 되돌리기'}
              </button>
            </div>
          )}
          {펼침 === x.경로 && (
            <div className="bk-files">
              {x.파일.map((f: any) => (
                <button key={f.이름} type="button" disabled={busy}
                        className={'bk-file' + (견줌?.경로 === f.경로 ? ' on' : '')}
                        onClick={() => 들여다보기(f.경로)}>
                  <b>{백업때(f.이름)}</b>
                  <span className="muted">{크기글(f.크기)}</span>
                  {f.되돌리기전 && <span className="tag">되돌리기 전</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {/*
        ── 견주기 ─────────────────────────────────────────────
        **합쳐 주지 않습니다.** 양쪽에서 각각 일한 자료를 자동으로
        합치는 방법은 없습니다. 어느 쪽을 버릴지는 사람이 정해야 하므로
        숫자를 나란히 놓기만 합니다.
      */}
      {견줌 && (
        <div className="bk-compare">
          <div className="small" style={{ marginBottom: 6 }}>
            <b>{백업때(견줌.그것.경로.split(/[\\/]/).pop() ?? '')}</b> 것과 지금 것을 견줍니다.
          </div>
          <table className="grid small">
            <thead>
              <tr><th></th><th>지금 자료함</th><th>고른 백업</th></tr>
            </thead>
            <tbody>
              {([
                ['대상자', '대상자'], ['제공실적', '실적'],
                ['청구서', '청구'], ['메모', '메모'],
              ] as const).map(([이름, 키]) => (
                <tr key={키}>
                  <td>{이름}</td>
                  <td>{견줌.지금[키]}건</td>
                  <td className={견줌.그것[키] < 견줌.지금[키] ? 'danger' : ''}>
                    {견줌.그것[키]}건
                    {견줌.그것[키] < 견줌.지금[키] &&
                      <span className="muted"> ({견줌.지금[키] - 견줌.그것[키]}건 줄어듭니다)</span>}
                  </td>
                </tr>
              ))}
              <tr>
                <td>마지막 실적일</td>
                <td>{견줌.지금.마지막실적 || '—'}</td>
                <td className={견줌.그것.마지막실적 < 견줌.지금.마지막실적 ? 'danger' : ''}>
                  {견줌.그것.마지막실적 || '—'}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="note small" style={{ margin: '8px 0 0' }}>
            되돌리면 <b>지금 자료함은 이 백업으로 통째로 바뀝니다.</b>{' '}
            <b>합쳐지지 않습니다.</b>
            {' '}바꾸기 직전에 <b>지금 것을 한 부 떠 둡니다</b>
            (<code>tongdol-되돌리기전-…</code>) — 잘못 골랐으면 그것으로 다시 오시면 됩니다.
          </p>
          <div className="btns">
            <button className="danger" disabled={busy}
                    onClick={() => 되돌리기(견줌.경로)}>이것으로 되돌리기</button>
            <button disabled={busy} onClick={() => 견주기(null)}>그만두기</button>
          </div>
        </div>
      )}

      {/*
        얼마나 자주 뜰지.
        잦은 것과 오래 가는 것은 서로 반대라, 고른 값에 따라
        「며칠치가 남는지」를 그 자리에서 셈해 보여 줍니다.
      */}
      <div className="row tight" style={{ marginTop: 14, alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="bk-every">백업 주기</label>
          <select id="bk-every" value={String(b?.주기 ?? 6)} disabled={busy}
                  onChange={(e) => 주기저장(Number(e.target.value), b?.부수 ?? 20)}>
            {(b?.주기들 ?? []).map((x: any) => (
              <option key={x.값} value={x.값}>{x.이름}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 0, marginBottom: 0 }}>
          <label htmlFor="bk-keep">보관 개수</label>
          <input id="bk-keep" type="number" min={3} max={200} style={{ width: 88 }}
                 defaultValue={b?.부수 ?? 20} disabled={busy}
                 onBlur={(e) => Number(e.target.value) !== b?.부수 &&
                                주기저장(b?.주기 ?? 6, Number(e.target.value))} />
        </div>
      </div>
      {/*
        「20부」라고만 두었더니 그 숫자가 무엇을 뜻하는지 안 보였습니다.
        **개수가 아니라 「며칠 전까지 되돌릴 수 있는가」가 사람이 알고 싶은 것**입니다.
        그래서 셈해서 그 말로 적어 줍니다.
      */}
      <p className="note small" style={{ margin: '4px 0 0' }}>
        {(b?.주기들 ?? []).find((x: any) => x.값 === b?.주기)?.설명}
        {b?.주기 > 0 && (
          <><br />
            지금 설정이면 백업 파일이 <b>{b.부수}개</b>까지 쌓이고,
            <b> {남는기간(b.주기, b.부수)} 전까지 되돌릴 수 있습니다.</b>{' '}
            그 개수를 넘으면 <b>가장 오래된 것부터</b> 지워집니다.
          </>
        )}
      </p>

      {/*
        ── 따로 둘 곳 ────────────────────────────────────────
        **손으로 타이핑하게 두지 않습니다.** `D:\통돌Note백업` 을 `D;\` 로
        잘못 쳐도 화면은 그럴듯하고, 백업이 안 되는 것은 몇 달 뒤에 압니다.
        직인처럼 눌러서 고르게 합니다.
      */}
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="bk-dir">따로 둘 곳 (USB 등 외부 저장매체를 권장합니다)</label>
        <div className="row tight" style={{ alignItems: 'stretch' }}>
          <input id="bk-dir" value={dir} onChange={(e) => setDir(e.target.value)}
                 className="mono" placeholder="아직 안 정하셨습니다"
                 style={{ flex: 1 }} readOnly
                 onKeyDown={(e) => e.key === 'Enter' && 자리저장()} />
          <button className="primary" disabled={busy} style={{ flex: 'none' }}
                  onClick={() => 고르기열기(dir)}>폴더 고르기…</button>
          {dir && (
            <button disabled={busy} style={{ flex: 'none' }}
                    onClick={() => { setDir(''); 자리저장('') }}>비우기</button>
          )}
        </div>
      </div>
      <div className="btns">
        <button disabled={busy} onClick={지금백업}>지금 백업</button>
      </div>

      {고르기 && (
        <폴더고르개 처음={고르기시작} 닫기={() => 고르기로(false)}
                    정하기={(p: string) => { setDir(p); 고르기로(false); 자리저장(p) }} />
      )}

      <p className="note small" style={{ marginBottom: 0, marginTop: 12 }}>
        <b>이 파일 하나가 기관의 모든 원본입니다.</b>{' '}
        프로그램이 <b>{(b?.주기들 ?? []).find((x: any) => x.값 === b?.주기)?.이름 ?? '자동으로'}</b>{' '}
        떠 두고 <b>최근 {b?.부수 ?? 20}개</b>를 남깁니다.
        <br />
        같은 디스크에만 두면 <b>그 디스크가 죽을 때 원본과 함께 죽습니다.</b>{' '}
        USB·외장하드·공유 폴더를 정해 두시면 거기에도 함께 떠 둡니다.
        정할 때 <b>실제로 한 번 써 보고</b> 되는 것을 확인합니다.
        <br />
        <b>되돌릴 때</b>는 위 목록에서 <b>「여기 것으로 되돌리기」</b>를 누르시면 됩니다.
        고른 백업에 무엇이 얼마나 들어 있는지 <b>지금 것과 견주어 보여 드리고</b>,
        정하시면 <b>다음에 켤 때</b> 바꿉니다 (돌아가는 중에 바꾸면 자료가 깨집니다).
        <br />
        USB 를 다른 컴퓨터에서 쓰셨다면, 그 USB 를 <b>따로 둘 곳</b>으로 정하시면
        거기 백업이 목록에 함께 뜹니다. 다만 <b>양쪽에서 각각 일한 것은 합쳐지지 않습니다</b> —
        어느 쪽을 남길지 견주어 보고 고르시는 것입니다.
      </p>
    </div>
  )
}

function HolidayCard({ s, onChange }: { s: any; onChange: () => void }) {
  const [on, setOn] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [해, 해로] = useState('')
  const list: any[] = s.holidays ?? []

  const 해별: Record<string, any[]> = {}
  for (const h of list) (해별[h.on_date.slice(0, 4)] ??= []).push(h)
  /*
   * 연도는 **이른 해부터** 늘어놓습니다.
   * 처음에 최신순으로 두었더니 2027·2026·2025 로 거꾸로 읽혀
   * 달력을 넘길 때와 방향이 반대였습니다.
   */
  const 해들 = Object.keys(해별).sort()
  const 올해 = String(new Date().getFullYear())
  // 처음 열 때는 **올해**를 보여 줍니다. 없으면 가장 가까운 해.
  const 기본해 = 해별[올해] ? 올해
    : (해들.filter((y) => y >= 올해)[0] ?? 해들[해들.length - 1] ?? '')
  const 보는해 = 해 && 해별[해] ? 해 : 기본해
  const 보이는것 = (해별[보는해] ?? []).slice()
    .sort((a, b) => a.on_date.localeCompare(b.on_date))

  /*
   * 넣으려는 날이 이미 토·일이면 알려 줍니다.
   * 넣어도 해로울 것은 없지만, **이미 휴일인 날을 넣고 있다는 것**은
   * 대체공휴일과 헷갈리고 있다는 신호일 때가 많습니다.
   */
  const 요일 = (ymd: string) =>
    ymd ? ['일', '월', '화', '수', '목', '금', '토'][new Date(ymd + 'T00:00:00').getDay()] : ''
  const 벌써휴일 = on ? ['일', '토'].includes(요일(on)) : false

  async function 넣기() {
    if (!on || !name.trim()) return
    setBusy(true); setErr('')
    try {
      await api.addHoliday(on, name.trim())
      해로(on.slice(0, 4))
      setOn(''); setName(''); onChange()
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="card">
      <h2>공휴일</h2>
      <div className="grid2" style={{ marginTop: 4 }}>
        {/* ── 왼쪽 — 넣는 자리 ─────────────────────────────── */}
        <div>
          <p className="note small" style={{ marginTop: 0 }}>
            <b>토·일은 프로그램이 압니다.</b> 그 밖의 공휴일은 여기에 적어 주세요 —
            설날·추석은 음력이라 해마다 날짜가 옮겨 다니고 대체공휴일도 그해마다 달라서,
            프로그램에 미리 넣어 두면 반드시 틀립니다.
            <b> 넣은 것은 그대로 쌓입니다.</b>
          </p>

          <div className="field">
            <label htmlFor="hd-on">날짜</label>
            <input id="hd-on" type="date" value={on} style={{ maxWidth: 180 }}
                   onChange={(e) => setOn(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="hd-name">무슨 날</label>
            <input id="hd-name" value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="명절 · 대체공휴일 · 지방선거일"
                   onKeyDown={(e) => e.key === 'Enter' && 넣기()} />
          </div>

          {벌써휴일 && (
            <p className="note small" style={{ marginTop: -6, color: 'var(--warn)' }}>
              그날은 <b>{요일(on)}요일</b>이라 넣지 않아도 이미 휴일입니다.
            </p>
          )}

          <div className="btns">
            <button className="primary" disabled={busy || !on || !name.trim()} onClick={넣기}
                    style={{ whiteSpace: 'nowrap' }}>
              넣기
            </button>
          </div>
          {err && <div className="msg err" style={{ marginTop: 8 }}>{err}</div>}
        </div>

        {/* ── 오른쪽 — 쌓인 것 ─────────────────────────────── */}
        <div>
          {해들.length === 0 ? (
            <p className="note small" style={{ marginTop: 0 }}>
              아직 넣은 공휴일이 없습니다. 지금은 <b>토·일만</b> 휴일로 셉니다.
            </p>
          ) : (
            <>
              {/*
                해가 쌓이면 탭이 가로로 넘칩니다. 줄을 접게 두면
                열 해가 넘어도 두 줄로 얌전히 내려앉습니다.
              */}
              <div className="memo-boards"
                   style={{ padding: 0, marginBottom: 8, flexWrap: 'wrap', rowGap: 6 }}>
                {해들.map((y) => (
                  <button key={y} aria-pressed={y === 보는해} onClick={() => 해로(y)}
                          style={{ padding: '3px 12px', fontSize: '.78rem', borderRadius: 12 }}>
                    {y}년 <span className="muted">{해별[y].length}</span>
                  </button>
                ))}
              </div>
              <div className="table-wrap" style={{ maxHeight: '32vh', overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 96 }}>날짜</th>
                      <th style={{ width: 42 }}>요일</th>
                      <th>무슨 날</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {보이는것.map((h: any) => {
                      const w = 요일(h.on_date)
                      return (
                        <tr key={h.on_date}>
                          <td className="mono small">{h.on_date.slice(5).replace('-', '. ')}</td>
                          <td className={['일', '토'].includes(w) ? 'small deadline' : 'small'}>{w}</td>
                          <td className="small">{h.name}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="plain small" title="지웁니다"
                                    onClick={async () => { await api.removeHoliday(h.on_date); onChange() }}>
                              ✕
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="note small" style={{ marginBottom: 0, marginTop: 8 }}>
                {보는해}년 <b>{보이는것.length}일</b>
                {보이는것.some((h: any) => ['일', '토'].includes(요일(h.on_date))) &&
                  ' · 붉은 요일은 넣지 않아도 이미 휴일인 날입니다'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ServiceCard({ s, onChange }: { s: any; onChange: () => void }) {
  const [새로, set새로] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const 잠김 = !!s.profile?.is_builtin

  async function 만들기() {
    setBusy(true); setErr('')
    try { await api.addService(새로); set새로(null); onChange() }
    catch (e: any) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '18px 22px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0 }}>서비스 단가</h2>
        <div className="spacer" />
        {!잠김 && !새로 && (
          <button onClick={() => set새로({ ...빈서비스 })}>서비스 추가</button>
        )}
      </div>

      <div style={{ padding: '10px 22px 0' }}>
        {잠김 ? (
          <p className="note small" style={{ marginBottom: 0 }}>
            지금 쓰는 규칙은 <b>「{s.profile?.name}」</b>입니다.
            <b> 기준선이라 고칠 수 없습니다.</b> 단가를 바꾸시려면 위에서
            우리 지자체 규칙을 골라 주세요.
          </p>
        ) : (
          <p className="note small" style={{ marginBottom: 0 }}>
            줄을 누르면 고칠 수 있습니다.
            <b> 단가를 바꿔도 이미 확정한 청구서는 그대로입니다</b> —
            확정할 때 그때의 단가를 통째로 얼려 두기 때문입니다.
            대신 정산 화면에 「단가 바뀜」이 뜹니다.
          </p>
        )}
        {err && <div className="msg err" style={{ marginTop: 10 }}>{err}</div>}
      </div>

      {새로 && (
        <div style={{ padding: '14px 22px', background: 'var(--surface-2)', marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>새 서비스</h3>
          <ServiceFields f={새로} setF={set새로} />
          <div className="btns">
            <button className="primary" disabled={busy || !새로.name.trim()} onClick={만들기}>
              {busy ? '만드는 중…' : '만들기'}
            </button>
            <button className="plain" onClick={() => set새로(null)}>취소</button>
          </div>
          <p className="note small" style={{ marginBottom: 0 }}>
            코드를 안 적으면 겹치지 않는 것으로 저절로 붙습니다.
            여기서 만든 것은 <b>「기관이 만든 것」</b>으로 표시됩니다 —
            나중에 지침이 바뀌면 이것부터 살펴보시면 됩니다.
          </p>
        </div>
      )}

      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>코드</th><th>분류</th><th>서비스</th>
              <th>단위</th><th className="right">단가</th><th className="right">휴일단가</th>
              <th>기록 형태</th><th className="right">생애한도</th>
              <th className="right">월 한도</th>
            </tr>
          </thead>
          <tbody>
            {s.services?.map((v: any) => (
              <ServiceRow key={v.id} v={v} 잠김={잠김} onSaved={onChange} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
 *  설정 탭 세 개
 * ══════════════════════════════════════════════════════════════
 *
 * (2026-09-06 무무 — 「설정에서 관리하는 내용이 많아진 만큼 카테고리를
 *  2~3개정도로 분류해서 탭으로 분류해주면 좋겠어」 / 「탭 명칭을
 *  **일반/기관정보/계산규칙** 이렇게 3가지로 만들고 **별도로 여는 기준
 *  없이 탭을 선택하면 언제나 볼 수 있도록** 해줘야 해」)
 *
 * ── 무엇을 어디에 두었나 ─────────────────────────────────────
 *
 *   일반      이 PC·이 사람이 쓰는 것 — 보기 · 버전 번호 · 백업 ·
 *             근무시간 · 확인사항 항목 · 사무실 안에서 열기 · 휴대폰 기록
 *   기관정보  종이에 찍혀 나가는 것 — 기관 정보 · 직인 · 배상책임보험
 *   계산규칙  **서비스에 딸린 것 전부** — 계산 규칙 · 공휴일 ·
 *             확인사항 항목 · 서비스 단가(시간 셈하기는 서비스 줄 안에) ·
 *             본인부담 구간
 *             (2026-09-07 무무 — 「확인사항은 서비스에 관련된 항목이므로
 *              계산규칙에 들어가는게 맞는 것 같아」)
 *
 * 가르는 잣대는 「이걸 잘못 만지면 무엇이 틀리나」입니다. 계산 규칙
 * 탭의 것은 **틀리면 지자체에 낸 돈이 틀립니다.** 한자리에 모아 두면
 * 그 무게가 눈에 보이고, 다른 탭을 여는 사람이 실수로 스칠 일도 없습니다.
 *
 * ★ **탭은 언제나 열립니다.** 「무엇을 먼저 해야 이게 보인다」 같은
 *   조건을 두지 않습니다 — 찾는 것이 어디 있는지 헷갈리게 됩니다.
 */
const 탭들 = [
  { 값: '일반', 글: '일반' },
  { 값: '기관정보', 글: '기관 정보' },
  { 값: '계산규칙', 글: '계산 규칙' },
] as const
type 탭이름 = typeof 탭들[number]['값']

const 탭열쇠 = 'tongdol.설정탭'
function 탭읽기(): 탭이름 {
  try {
    const v = localStorage.getItem(탭열쇠)
    return 탭들.some((t) => t.값 === v) ? (v as 탭이름) : '일반'
  } catch { return '일반' }
}
function 탭정하기(v: 탭이름) {
  try { localStorage.setItem(탭열쇠, v) } catch { /* 사설 창이면 못 적습니다 */ }
}

export default function Settings({ onOrgChange }: { onOrgChange: () => void }) {
  const [s, setS] = useState<any>(null)
  const [health, setHealth] = useState<any>(null)
  const [org, setOrg] = useState<any>({})
  const [theme, setTheme] = useState<ThemeChoice>(getThemeChoice)
  const [글자, 글자로] = useState<글자크기>(글자크기읽기)
  const 글자고르기 = (v: 글자크기) => { 글자크기정하기(v); 글자로(v) }
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [탭, 탭으로] = useState<탭이름>(탭읽기)

  /*
   * 고른 탭을 이 브라우저에 적어 둡니다. 단가를 손보는 날은 「계산 규칙」만
   * 열 일이 아니라 **하루 종일 그 탭을 오갑니다** — 저장할 때마다 「일반」으로
   * 튕기면 매번 다시 눌러야 합니다.
   *
   * 자료함에 안 넣는 까닭은 밝기·글자 크기와 같습니다 — 옆자리 직원이
   * 물려받을 값이 아닙니다.
   */
  const 탭고르기 = (v: 탭이름) => { 탭정하기(v); 탭으로(v); setMsg(null) }

  const load = useCallback(async () => {
    const d = await api.settings()
    setS(d); setOrg(d.org ?? {})
  }, [])

  useEffect(() => {
    load().catch(() => {})
    api.health().then(setHealth).catch(() => {})
  }, [load])

  function pick(next: ThemeChoice) {
    setThemeChoice(next)
    setTheme(next)
  }

  async function saveOrg(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.saveOrg(org)
      setMsg({ kind: 'ok', text: '기관 정보를 저장했습니다.' })
      onOrgChange()
    } catch (e: any) {
      setMsg({ kind: 'err', text: e.message })
    } finally {
      setBusy(false)
    }
  }

  if (!s) return <p className="muted">불러오는 중…</p>

  return (
    <>
      <div className="main-head"><h1>설정</h1></div>

      {/*
        ★ 탭은 **언제나 눌립니다.** 무엇을 먼저 해야 열리는 탭은 없습니다.
          (2026-09-06 무무 — 「별도로 여는 기준 없이 탭을 선택하면 언제나
           볼 수 있도록 해줘야 해」)
      */}
      <div className="설정탭띠" role="tablist" aria-label="설정 갈래">
        {탭들.map((t) => (
          <button key={t.값} type="button" role="tab"
                  aria-selected={탭 === t.값}
                  className={탭 === t.값 ? '고름' : undefined}
                  onClick={() => 탭고르기(t.값)}>
            {t.글}
          </button>
        ))}
      </div>

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      {/* ══ 일반 ══════════════════════════════════════════════ */}
      {탭 === '일반' && (
        <div className="grid2">
          <div>
            {/*
              ── 보기 ────────────────────────────────────────────
              밝기와 글자 크기를 **나란히** 둡니다. 둘 다 「이 사람이 이 화면을
              어떻게 보는가」라서 한자리에 있어야 찾습니다.
            */}
            <div className="card">
              <h2>보기</h2>
              <div className="view-split">
                <div>
                  <h3>화면 밝기</h3>
                  <div className="pick" role="group" aria-label="화면 밝기">
                    {THEMES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        aria-pressed={theme === t.value}
                        onClick={() => pick(t.value)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3>글자 크기</h3>
                  <div className="pick" role="group" aria-label="글자 크기">
                    {크기들.map((x) => (
                      <button
                        key={x.value}
                        type="button"
                        aria-pressed={글자 === x.value}
                        onClick={() => 글자고르기(x.value)}
                        title={x.곁말}
                      >
                        {x.value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <p className="note small" style={{ marginBottom: 0, marginTop: 14 }}>
                둘 다 <b>이 PC의 이 브라우저에만</b> 적용됩니다. 자료함에는 저장되지 않습니다 —
                눈이 좋은 분이 정한 크기를 옆자리 직원이 물려받으면 안 되니까요.
                <br />
                <b>뽑는 종이는 늘 같은 크기입니다.</b> 화면만 커집니다.
              </p>
            </div>

            <근무시간칸 />
          </div>

          <div>
            {/*
              ── 버전 번호 ──────────────────────────────────────────
              원격으로 도와드릴 때 **첫 물음이 「지금 몇 버전 쓰세요?」**입니다.
              화면 어디에도 없으면 그 물음에서 막힙니다.

              **숫자만 둡니다.** 설명도, 「도움 요청하실 때…」 같은 안내도
              붙이지 않습니다. 쓰는 사람은 문제가 생기기 전까지 궁금하지 않고,
              생기면 화면을 읽는 것이 아니라 전화를 겁니다.
              그때 필요한 것은 **읽어 줄 숫자 하나**뿐입니다.
            */}
            <div className="card">
              <h2>이 프로그램</h2>
              <dl className="facts" style={{ marginBottom: 0 }}>
                <dt>버전</dt><dd className="mono">v{s.앱?.버전 ?? '—'}</dd>
              </dl>
            </div>

            <업데이트칸 />
            <사무실칸 />
            <들어온기록칸 />
            <BackupCard health={health} />
            <USB칸 />
          </div>
        </div>
      )}

      {/* ══ 기관 정보 ══════════════════════════════════════════ */}
      {탭 === '기관정보' && (
        <div className="grid2">
          <form className="card" onSubmit={saveOrg}>
            <h2>기관 정보</h2>
            <p className="note small" style={{ marginTop: -6 }}>
              여기 넣은 내용이 나중에 청구서·영수증 머리글에 그대로 들어갑니다.
            </p>
            {ORG_FIELDS.map((f) => (
              /*
                기관 주소도 **찾아 넣습니다.** 이 값은 청구서·영수증 머리글에
                그대로 찍혀 나가므로, 손으로 친 오타가 지자체까지 갑니다.
              */
              f.key === 'address' ? (
                <주소칸 key={f.key} id={`o-${f.key}`} value={org[f.key] ?? ''}
                        onChange={(주소) => setOrg({ ...org, [f.key]: 주소 })}
                        상세={org.address_detail ?? ''}
                        상세바꿈={(상세) => setOrg({ ...org, address_detail: 상세 })} />
              ) : (
                <div className="field" key={f.key}>
                  <label htmlFor={`o-${f.key}`}>{f.label}</label>
                  <input
                    id={`o-${f.key}`}
                    value={org[f.key] ?? ''}
                    placeholder={f.ph}
                    onChange={(e) => setOrg({ ...org, [f.key]: e.target.value })}
                  />
                </div>
              )
            ))}
            <button className="primary" disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
          </form>

          <div>
            <StampCard org={s.org} onChange={() => api.settings().then(setS)} />
            <LiabilityCard org={org} setOrg={setOrg} info={s.liability} />
          </div>
        </div>
      )}

      {/* ══ 계산 규칙 ══════════════════════════════════════════ */}
      {탭 === '계산규칙' && (
        <>
          <p className="note small 규칙머리">
            <b>서비스를 어떻게 셈하고 어떻게 기록할지</b>를 정하는 곳입니다.
            잘못 고치면 <b>지자체에 내는 금액이나 종이가 틀립니다.</b> 대신
            <b> 이미 확정한 청구서와 이미 적은 기록은 안 흔들립니다</b> —
            단가·부담률·셈 규칙은 확정할 때, 확인사항 목록은 고칠 때마다
            그때 것을 통째로 얼려 두기 때문입니다. 바꾼 것은 모두 기록에 남습니다.
          </p>

          <div className="grid2">
            <div className="card">
              <h2>계산 규칙</h2>
              <div className="field">
                <label htmlFor="prof">적용할 규칙</label>
                <select id="prof" value={s.profile?.id ?? ''}
                        onChange={async (e) => {
                          await api.setProfile(Number(e.target.value))
                          setS(await api.settings())
                          setMsg({ kind: 'ok', text: '적용 규칙을 바꿨습니다. 바꾼 기록이 남습니다.' })
                        }}>
                  {s.profiles?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <RuleFields s={s} onChange={load} setMsg={setMsg} />
            </div>

            <div>
              <HolidayCard s={s} onChange={load} />
              {/*
                ★ **여기가 확인사항의 자리입니다** (2026-09-07 무무 —
                  「확인사항은 서비스에 관련된 항목이므로 계산규칙에
                   들어가는게 맞는 것 같아」).

                처음에는 「일반」에 두었는데, 이 목록은 **그 서비스를
                어떻게 기록하고 어떤 종이로 내보내는가**를 정합니다 —
                단가·한도와 같은 갈래입니다. 밝기나 글자 크기처럼
                「이 PC를 어떻게 볼까」와는 다른 것입니다.
              */}
              <확인사항칸 />
            </div>
          </div>

          <ServiceCard s={s} onChange={load} />

          <CopayCard s={s} onChange={load} />
        </>
      )}
    </>
  )
}
