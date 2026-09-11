import { useEffect, useState, useCallback, useRef } from 'react'
import 주소칸 from '../components/AddressField'
import { api } from '../lib/api'
import { navigate, linkProps } from '../lib/router'
import AssignBox from '../components/AssignBox'

/**
 * 종사자 한 사람.
 *
 * 정보 수정 · 비밀번호 · 계약종료를 한 화면에서 합니다.
 * 목록에서 이름을 누르면 여기로 옵니다.
 *
 * 배상책임보험은 여기 없습니다. 사람마다 드는 것이 아니라
 * **기관이 인원수를 정해 한 번에 가입**하는 것이라 설정 → 기관 정보에 있습니다.
 */

type Row = { name: string; no?: string; on?: string; hours?: string }

const EMPTY = {
  name: '', loginId: '', password: '', phone: '',
  roles: ['worker'] as string[],
  birth: '', address: '', addressDetail: '',
  empNo: '', hiredOn: '', contractOn: '',
  qualifications: [] as Row[], trainings: [] as Row[],
  payrollExcluded: false, excludeReason: '', note: '',
}

/**
 * 주소에서 읍·면·동을 뽑습니다. 서버(staff.ts dongOf)와 같은 규칙입니다.
 * 여기서 쓰는 이유는 하나 — 적는 동안 "해남읍으로 잡혔습니다"를 보여 주기 위해서입니다.
 * 저장되는 값은 서버가 다시 뽑은 것입니다.
 */
function dongOf(address: string): string {
  const m = String(address ?? '').replace(/\s+/g, ' ').trim()
    .match(/[가-힣]{1,6}(?:읍|면|동)(?:\s?\d+가)?/)
  return m ? m[0] : ''
}

/** 줄 단위로 쌓는 목록 — 「+ 추가」로 늘리고 「×」로 지웁니다. */
function RowList({
  title, rows, onChange, cols, hint,
}: {
  title: string
  rows: Row[]
  onChange: (next: Row[]) => void
  cols: { key: keyof Row; label: string; type?: string; ph?: string; flex?: number }[]
  hint: string
}) {
  const set = (i: number, k: keyof Row, v: string) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))

  return (
    <div className="field">
      <label>{title} <span className="muted">— {hint}</span></label>
      {rows.length === 0 && (
        <p className="note small" style={{ margin: '0 0 8px' }}>아직 없습니다.</p>
      )}
      {rows.map((r, i) => (
        <div className="row tight" key={i} style={{ marginBottom: 6, alignItems: 'center' }}>
          {cols.map((c) => (
            <input key={String(c.key)} style={{ flex: c.flex ?? 1 }}
                   type={c.type ?? 'text'} placeholder={c.label}
                   value={String(r[c.key] ?? '')}
                   onChange={(e) => set(i, c.key, e.target.value)} />
          ))}
          <button type="button" className="plain" style={{ flex: 0, padding: '6px 10px' }}
                  onClick={() => onChange(rows.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, { name: '' }])}>+ 추가</button>
    </div>
  )
}

/**
 * 기기 등록 — 제공인력 휴대폰을 우편함에 잇습니다.
 *
 * 관리자 화면에 두되, **비밀번호는 제공인력 본인이 그 자리에서** 칩니다.
 * 그래서 옆에 네 단계를 띄워 둡니다 — 관리자가 보면서 그대로 진행하게.
 */
function 기기등록칸({ staffId, 이름 }: { staffId: number; 이름: string }) {
  const [열림, 열기] = useState(false)
  const [바쁨, setBusy] = useState(false)
  const [결과, set결과] = useState<{ qr: string; 만료: string; 몇분: number } | null>(null)
  const [탈말, set탈말] = useState('')
  const [남은, set남은] = useState(0)
  const [상태, set상태] = useState<'없음' | '기다리는중' | '됨'>('없음')
  /*
   * ★ 다시 등록할 때 QR 이 곧바로 사라지던 문제 ★
   *
   * 화면이 3초마다 물어보는데, **옛 등록이 아직 살아 있어서** 「됨」이
   * 돌아옵니다. 그걸 「끝났다」로 읽고 QR 을 지워 버렸습니다 —
   * 폰이 찍지도 않았는데요.
   *
   * 그래서 **폰이 찍은 것을 한 번이라도 본 뒤에만** 「됨」을 믿습니다.
   * 폰이 찍으면 우편함이 옛 열쇠를 버리므로 잠깐 「기다리는중」이 됩니다.
   * 그 순간을 본 뒤의 「됨」이라야 진짜입니다.
   */
  const 아직안찍음 = useRef(false)

  // 남은 시간을 초 단위로 셉니다. 다 되면 QR 을 스스로 지웁니다 —
  // 화면에 오래 떠 있는 QR 은 지나가는 사람이 찍어 갈 수 있습니다.
  useEffect(() => {
    if (!결과) return
    const 끝 = new Date(결과.만료).getTime()
    const t = setInterval(() => {
      const 초 = Math.max(0, Math.round((끝 - Date.now()) / 1000))
      set남은(초)
      if (초 === 0) { set결과(null); set탈말('시간이 지나 QR 을 지웠습니다. 다시 만드세요.') }
    }, 1000)
    return () => clearInterval(t)
  }, [결과])

  /*
   * QR 을 띄운 동안 서버에 3초마다 물어봅니다.
   * 물어보는 김에 서버가 **열쇠를 싸서 건넵니다** — QR 에는 열쇠가 없으므로
   * 휴대폰이 등록해서 공개쪽을 올려야 비로소 건넬 수 있습니다.
   * 다 되면 QR 을 지우고 「끝났습니다」로 바뀝니다.
   */
  useEffect(() => {
    if (!결과) return
    let 살아있나 = true
    const 묻기 = async () => {
      try {
        const r = await api.enrollState(staffId)
        if (!살아있나) return
        set상태(r.상태)
        // 폰이 찍으면 옛 열쇠가 버려져 잠깐 「기다리는중」이 됩니다.
        if (r.상태 === '기다리는중') 아직안찍음.current = false
        if (r.상태 === '됨' && !아직안찍음.current) set결과(null)
      } catch { /* 잠깐 못 물어본 것은 넘어갑니다 */ }
    }
    묻기()
    const t = setInterval(묻기, 3000)
    return () => { 살아있나 = false; clearInterval(t) }
  }, [결과, staffId])

  /*
   * 다시 등록. 새 QR 을 내면 우편함이 그 폰의 공개쪽을 새것으로 갈고
   * 옛 싼 열쇠를 버립니다(005). 그래서 **먼저 쓰던 폰은 못 쓰게** 됩니다.
   */
  async function 다시등록() {
    if (!confirm(
      `${이름} 님의 휴대폰을 다시 등록합니다.\n\n` +
      `먼저 쓰던 휴대폰은 그때부터 못 씁니다.\n` +
      `(한 사람에 휴대폰 하나입니다)\n\n` +
      `계속할까요?`)) return
    set상태('없음')
    await 만들기()
  }

  async function 만들기() {
    setBusy(true); set탈말('')
    try {
      아직안찍음.current = true       // 폰이 찍기 전까지는 「됨」을 안 믿습니다
      set결과(await api.enrollDevice(staffId))
    } catch (err: any) {
      set탈말(err?.message ?? '만들지 못했습니다')
    } finally { setBusy(false) }
  }

  const 분초 = `${Math.floor(남은 / 60)}:${String(남은 % 60).padStart(2, '0')}`

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="main-head" style={{ marginTop: 0 }}>
        <h2 style={{ margin: 0 }}>휴대폰 기기 등록</h2>
        <div className="spacer" />
        <button type="button" onClick={() => {
          const 다음 = !열림
          열기(다음); set결과(null); set탈말('')
          if (다음) api.enrollState(staffId).then((r) => set상태(r.상태)).catch(() => {})
        }}>
          {열림 ? '닫기' : '기기 등록'}
        </button>
      </div>

      {!열림 && (
        <p className="note small" style={{ margin: 0 }}>
          {이름} 님이 <b>휴대폰으로 방문을 찍으려면</b> 기기를 한 번 등록해야 합니다.
          본인이 사무실에 오셔야 합니다 — 열쇠가 화면에서 카메라로 건너갑니다.
        </p>
      )}

      {열림 && (
        <div className="grid2" style={{ alignItems: 'start' }}>
          {/* ── 왼쪽: 하는 일 ─────────────────────────────── */}
          <div>
            {!결과 && 상태 === '됨' && (
              <div className="note" style={{ marginTop: 0 }}>
                <p style={{ marginTop: 0 }}><b>이미 등록된 휴대폰이 있습니다.</b></p>
                <p className="small">
                  {이름} 님 휴대폰에 열쇠가 건네져 있습니다.
                  앱을 새로 올려도 <b>등록은 그대로</b>입니다 — 다시 부르실 필요 없습니다.
                </p>
                {/*
                  다시 등록해야 하는 경우가 실제로 있습니다 —
                  휴대폰을 바꿨거나, 잃어버렸거나, 여섯 자리를 열 번 틀려
                  폰에서 지워졌을 때입니다. 그때 길이 막혀 있으면 안 됩니다.
                */}
                <p className="small" style={{ marginBottom: 8 }}>
                  <b>다시 등록해야 할 때</b> — 휴대폰을 바꿨거나, 잃어버렸거나,
                  여섯 자리를 열 번 틀려 폰에서 지워졌을 때.
                </p>
                <button onClick={다시등록} disabled={바쁨}>
                  {바쁨 ? '만드는 중…' : '다시 등록 (새 QR 만들기)'}
                </button>
                <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>
                  새로 등록하면 <b>먼저 쓰던 휴대폰은 못 씁니다.</b>
                  한 사람에 휴대폰 하나입니다.
                </p>
              </div>
            )}

            {!결과 && 상태 !== '됨' && (
              <div>
                <p className="note small" style={{ marginTop: 0 }}>
                  <b>{이름} 님을 앞에 두고</b> 아래 단추를 누르세요.
                  그림이 뜨면 그분 휴대폰으로 찍으시면 됩니다.
                </p>
                {탈말 && <p className="note bad small">{탈말}</p>}
                <button className="primary" disabled={바쁨} onClick={만들기}>
                  {바쁨 ? '만드는 중…' : 'QR 만들기'}
                </button>
              </div>
            )}

            {결과 && (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{ background: '#fff', padding: 12, borderRadius: 10, display: 'inline-block' }}
                  dangerouslySetInnerHTML={{ __html: 결과.qr }}
                />
                <p className="note small" style={{ marginBottom: 6 }}>
                  <b>{이름} 님 휴대폰으로 이 그림을 찍으세요.</b>
                </p>
                <p className={남은 < 60 ? 'note bad small' : 'note small'} style={{ margin: 0 }}>
                  {분초} 뒤에 사라집니다 — 지나면 다시 만들면 됩니다
                </p>
                <p className="note small" style={{ marginTop: 8, marginBottom: 0 }}>
                  <b>휴대폰을 기다리는 중…</b><br />
                  <span className="muted">
                    찍으시면 이 화면이 저절로 바뀝니다.
                    열쇠는 QR 이 아니라 <b>휴대폰이 등록한 뒤에 따로</b> 건네집니다.
                  </span>
                </p>
                <button type="button" style={{ marginTop: 10 }}
                        onClick={() => { set결과(null); set탈말('') }}>
                  지우기
                </button>
              </div>
            )}
          </div>

          {/* ── 오른쪽: 네 단계 안내 ──────────────────────── */}
          <div className="card" style={{ background: 'var(--surface-2, #f5f7f3)', margin: 0 }}>
            <b>어떻게 하나요</b>
            <ol style={{ paddingLeft: 20, marginBottom: 10 }}>
              <li><b>{이름} 님이 사무실에 옵니다.</b><br />
                  <span className="muted small">휴대폰을 가지고 오셔야 합니다.</span></li>
              <li><b>휴대폰 카메라로 그림을 찍습니다.</b><br />
                  <span className="muted small">
                    기본 카메라면 됩니다. 알림을 누르면 화면이 열립니다.
                  </span></li>
              <li><b>휴대폰에서 6자리 잠금을 정합니다.</b><br />
                  <span className="muted small">다음부터는 이 6자리로 엽니다.</span></li>
            </ol>
            {/*
              ★ 이 안내가 2026-09-05 까지 **틀린 말을 하고 있었습니다.**
                「휴대폰을 바꾸면 다시 오셔야 합니다」였는데, 계정 로그인이
                붙은 뒤로는 사실이 아닙니다. 화면이 거짓말을 하면
                사무실은 오지 않아도 될 사람을 부릅니다.
            */}
            <p className="note small" style={{ marginBottom: 0 }}>
              <b>꼭 이렇게 해야 하나요.</b> 아닙니다 — 이건 <b>빠른 길</b>입니다.
              QR 을 찍으면 아이디·비밀번호를 안 쳐도 바로 등록됩니다.<br /><br />
              <b>휴대폰을 바꾸시면</b> 사무실에 안 오셔도 됩니다.
              앱 첫 화면에서 <b>아이디와 비밀번호</b>로 들어가시면 됩니다.
              브라우저를 바꾸셔도 마찬가지입니다.<br /><br />
              휴대폰은 <b>한 사람에 한 대</b>입니다. 새로 들어가시면 앞 기기는
              끊기고 <b>사무실 홈에 뜹니다</b>. 비밀번호가 기억나지 않으시면
              위 「비밀번호 바꾸기」로 새로 정해 알려 주세요.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}


export default function StaffDetail({ id }: { id: string }) {
  const isNew = id === 'new'
  const [form, setForm] = useState<any>(isNew ? { ...EMPTY } : null)
  const [staff, setStaff] = useState<any>(null)
  const [matches, setMatches] = useState<any[]>([])
  const [past, setPast] = useState<any[]>([])
  const [roles, setRoles] = useState<{ key: string; label: string }[]>([])
  const [지금관리자, set지금관리자] = useState<{ id: number; name: string } | null>(null)
  const [perms, setPerms] = useState<any>(null)
  const [self, setSelf] = useState(false)
  // 이 사람에게 대상자를 붙이기 — 배정 화면·대상자 화면과 같은 부품을 씁니다.
  const [free, setFree] = useState<any[]>([])
  const [picking, setPicking] = useState(false)
  const [pick, setPick] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (isNew) return
    const d = await api.staffOne(Number(id))
    setStaff(d.staff); setMatches(d.matches); setPast(d.pastMatches)
    setPerms(d.perms ?? null); setSelf(!!d.self)
    setForm({
      name: d.staff.name, loginId: d.staff.loginId, password: '', phone: d.staff.phone,
      roles: [...d.staff.roles],
      birth: d.staff.birth, address: d.staff.address,
      empNo: d.staff.empNo, hiredOn: d.staff.hiredOn, contractOn: d.staff.contractOn,
      qualifications: d.staff.qualifications, trainings: d.staff.trainings,
      payrollExcluded: d.staff.payrollExcluded, excludeReason: d.staff.excludeReason,
      note: d.staff.note,
    })
  }, [id, isNew])

  useEffect(() => {
    load().catch((e) => setMsg({ kind: 'err', text: e.message }))
    api.staff().then((d) => { setRoles(d.roles); set지금관리자(d.지금관리자 ?? null); if (isNew) setPerms(d.perms) }).catch(() => {})
    // 아직 담당이 없는 대상자 × 서비스. 여기서 바로 붙일 수 있게.
    api.assign({ state: '미배정' }).then((d) => setFree(d.items)).catch(() => {})
  }, [load])

  const set = (k: string) => (e: any) =>
    setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  /*
   * ── 관리자는 **한 명뿐입니다** ──────────────────────────
   *
   * (2026-09-08 무무 — 「관리자는 현재는 1명으로 제한 해야해. 추후에
   *  관리자를 추가하는 경우엔 **PC 백업 문제 등 얽히는 문제들**이 다수
   *  발생할 여지가 있어서」)
   *
   * 서버가 어차피 막습니다. 그래도 화면에서 **누르기 전에** 알려 줍니다 —
   * 눌러서 저장까지 하고 나서 빨간 글을 보는 것은 기분 나쁜 일입니다.
   * 대신 자리를 넘기는 길(「관리자 넘기기」)을 그 자리에 둡니다.
   */
  const 남이관리자 = !!지금관리자 && String(지금관리자.id) !== String(id)
  const 관리자잠김 = (k: string) => k === 'admin' && 남이관리자

  function toggleRole(k: string) {
    if (관리자잠김(k)) return
    const has = form.roles.includes(k)
    setForm({ ...form, roles: has ? form.roles.filter((x: string) => x !== k) : [...form.roles, k] })
  }

  /** 자리를 이 사람에게 넘깁니다. 부른 사람은 그 자리에서 사무직원이 됩니다. */
  async function 넘기기() {
    if (!confirm(
      `관리자 자리를 ${form?.name || '이 분'}에게 넘깁니다.\n\n` +
      `· ${지금관리자?.name ?? '지금 관리자'} 님은 **사무직원**이 됩니다\n` +
      `· 설정 · 계정 · 계약종료는 그때부터 ${form?.name || '이 분'}만 할 수 있습니다\n` +
      `· 본인이 넘기시는 것이면, 넘긴 뒤 이 화면의 단추들이 사라집니다\n\n` +
      `넘기시겠습니까?`
    )) return
    setBusy(true)
    try {
      const r = await api.관리자넘기기(Number(id))
      setMsg({ kind: 'ok', text: `${r.준이} 님에서 ${r.받은이} 님으로 관리자를 넘겼습니다.` })
      await load()
      const d = await api.staff().catch(() => null)
      if (d) set지금관리자(d.지금관리자 ?? null)
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) }
    setBusy(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()

    // 아이디를 고쳤거나 새 비밀번호를 적었는가.
    // 그러면 그 사람이 지금 쓰고 있는 로그인이 끊깁니다.
    // 밖에서 일하는 중에 갑자기 튕기면 왜 그런지 모르니, 저장 전에 한 번 묻습니다.
    const touchedLogin =
      !!String(form.password ?? '').trim() ||
      (!!staff && form.loginId !== staff.loginId)
    if (!isNew && touchedLogin &&
        !confirm('계정 수정 시 로그인이 끊깁니다. 계속할까요?')) return

    setBusy(true); setMsg(null)
    try {
      if (isNew) {
        const r = await api.createStaff(form)
        navigate(`/staff/${r.id}`)
      } else {
        const r = await api.updateStaff(Number(id), form)
        // 내 계정을 내가 바꾼 경우엔 나부터 끊깁니다.
        // 그대로 두면 다음 동작이 죄다 실패하니 로그인 화면으로 보냅니다.
        if (self && (r?.idChanged || r?.pwChanged)) {
          alert('내 계정을 바꿨습니다. 새 아이디와 비밀번호로 다시 들어와 주세요.')
          location.href = '/'
          return
        }
        await load()
        setMsg({
          kind: 'ok',
          text: touchedLogin
            ? '저장했습니다. 로그인이 끊겼으니 본인에게 새 아이디와 비밀번호를 알려 주세요.'
            : '저장했습니다.',
        })
      }
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) }
    finally { setBusy(false) }
  }

  async function newPassword() {
    const pw = prompt(
      `${staff.name} 님의 새 비밀번호를 정해 주세요. (4자 이상)\n지금 쓰고 있는 로그인은 모두 끊깁니다.`
    )
    if (!pw) return
    try {
      await api.resetStaffPassword(Number(id), pw)
      setMsg({ kind: 'ok', text: '비밀번호를 바꿨습니다. 본인에게 알려 주세요.' })
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) }
  }

  async function doResign() {
    if (!confirm(
      `${staff.name} 님의 계약을 종료합니다.\n\n` +
      `· 남긴 실적과 일지는 그대로 남습니다\n` +
      `· 로그인이 끊기고 위치정보 동의가 철회됩니다\n\n계속할까요?`
    )) return
    try {
      const r = await api.resignStaff(Number(id))
      await load()
      setMsg({ kind: 'ok', text: `${r.resignedAt} 자로 계약을 종료했습니다. 위치정보 동의도 철회했습니다.` })
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) }
  }

  /**
   * 휴직 — 쉬었다 돌아오는 사람.
   *
   * 퇴직으로 갈음하면 안 됩니다. 돌아왔을 때 입사일·자격·교육이
   * 새로 시작한 것처럼 보이기 때문입니다. 근속을 따질 때도,
   * 지자체가 인력 현황을 물을 때도 틀린 답이 나갑니다.
   */
  async function doLeave() {
    const 시작 = prompt(
      `${staff.name} 님을 휴직 처리합니다.\n\n` +
      `· 명단에는 「휴직」으로 남습니다\n` +
      `· 새 배정에서 빠집니다 (이미 맡은 것은 그대로 둡니다)\n` +
      `· 입사일·자격·교육은 그대로 이어집니다\n\n` +
      `휴직 시작일 (YYYY-MM-DD)`,
      new Date().toISOString().slice(0, 10)
    )
    if (시작 === null) return
    const 복귀 = prompt('돌아올 예정일 (모르시면 비워 두세요)', '') ?? ''
    const 사유 = prompt('사유 (병가·출산 등, 비워 두셔도 됩니다)', '') ?? ''
    try {
      const r = await api.leaveStaff(Number(id), { from: 시작, to: 복귀, reason: 사유 })
      await load()
      setMsg({
        kind: r.openCount > 0 ? 'err' : 'ok',
        text: r.openCount > 0
          ? `휴직 처리했습니다. 다만 아직 ${r.openCount}건을 맡고 있습니다 — ` +
            r.openList.map((x: any) => `${x.recipient}(${x.service})`).join(', ') +
            '. 배정 화면에서 대타를 정해 주세요.'
          : '휴직 처리했습니다.',
      })
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) }
  }

  async function doReturn() {
    try {
      await api.returnStaff(Number(id))
      await load()
      setMsg({ kind: 'ok', text: '복직 처리했습니다. 이제 배정할 수 있습니다.' })
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) }
  }

  if (!form) {
    return (
      <>
        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
        <p className="muted">불러오는 중…</p>
      </>
    )
  }

  const isWorker = form.roles.includes('worker')
  // 아이디 · 비밀번호 · 역할은 관리자만. 본인이라도 스스로 역할을 넓힐 수 없습니다.
  const account = isNew || !perms || perms['staff.account']

  return (
    <>
      <div className="main-head">
        <a {...linkProps('/staff')} className="small">← 종사자 목록</a>
      </div>

      <div className="main-head">
        <h1>{isNew ? '종사자 등록' : staff?.name}</h1>
        {staff?.status === 'resigned' && (
          <span className="tag 종결">{staff.resignedAt} 계약종료</span>
        )}
        {staff?.onLeave && (
          <span className="tag 중단">
            휴직 중{staff.leaveFrom ? ` · ${staff.leaveFrom}부터` : ''}
            {staff.leaveTo ? ` · ${staff.leaveTo} 복귀 예정` : ''}
          </span>
        )}
        {staff?.payrollExcluded && <span className="tag 중단">별도관리</span>}
        <div className="spacer" />
        {/*
          저장은 맨 위에 둡니다. 화면이 길어서 아래까지 내려갔다가
          저장하러 다시 올라오는 일이 없게 하려는 것입니다.
          form 속성으로 아래 <form> 에 매답니다.
        */}
        <div className="btns">
          <button className="primary" form="staff-form" disabled={busy}>
            {busy ? '저장 중…' : isNew ? '등록' : '저장'}
          </button>
          <button type="button" className="plain" onClick={() => navigate('/staff')}>
            {isNew ? '취소' : '목록으로'}
          </button>
        </div>
      </div>

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      <form id="staff-form" onSubmit={save}>
        <div>
          <div className="card">
            <h2>기본 정보</h2>
            <div className="row">
              <div className="field">
                <label htmlFor="s-name">성명</label>
                <input id="s-name" value={form.name} onChange={set('name')} autoFocus required />
              </div>
              <div className="field">
                <label htmlFor="s-birth">생년월일</label>
                <input id="s-birth" value={form.birth} onChange={set('birth')}
                       placeholder="1975-03-02" />
              </div>
              <div className="field">
                <label htmlFor="s-phone">연락처</label>
                <input id="s-phone" value={form.phone} onChange={set('phone')}
                       placeholder="010-0000-0000" />
              </div>
            </div>
            {/*
              종사자 주소도 찾아 넣습니다. 읍면동은 **주소 안에서 뽑으므로**
              (서버 staff.ts dongOf 와 같은 규칙) 따로 채울 칸이 없습니다.
              손으로 치면 「해남군 해남읍」과 「전남 해남군 해남읍」이 섞여
              읍면동이 달리 잡힙니다.
            */}
            <주소칸 id="s-addr" value={form.address}
                    placeholder="전남 해남군 해남읍 수성리 18"
                    onChange={(주소) => setForm({ ...form, address: 주소 })}
                    상세={form.addressDetail ?? ''}
                    상세바꿈={(상세) => setForm({ ...form, addressDetail: 상세 })}
                    곁말={dongOf(form.address)
                      ? <span className="muted"> — 읍면동은 「{dongOf(form.address)}」로 잡힙니다</span>
                      : null} />
            <div className="row" style={{ marginBottom: 0 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="s-hired">입사일</label>
                <input id="s-hired" type="date" value={form.hiredOn} onChange={set('hiredOn')} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="s-contract">계약체결일</label>
                <input id="s-contract" type="date" value={form.contractOn}
                       onChange={set('contractOn')} />
              </div>
              <div className="field" style={{ marginBottom: 0 }} />
            </div>
          </div>

          <div className="card">
            <h2>계정 · 역할</h2>
            {!account ? (
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 2 }}>
                  <dl className="facts">
                    <dt>아이디</dt><dd className="mono">{form.loginId}</dd>
                    <dt>역할</dt><dd>{staff?.rolesKo?.join(' · ')}</dd>
                  </dl>
                  <p className="note small" style={{ marginBottom: 0 }}>
                    아이디와 역할은 <b>관리자만</b> 바꿀 수 있습니다.
                  </p>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>비밀번호</label>
                  {self ? (
                    <>
                      <button type="button" onClick={newPassword}>비밀번호 바꾸기</button>
                      <p className="note small" style={{ marginTop: 8, marginBottom: 0 }}>
                        본인 비밀번호는 직접 바꾸실 수 있습니다.
                      </p>
                    </>
                  ) : (
                    <p className="note small" style={{ margin: 0 }}>관리자만 바꿉니다.</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/*
                  ── 왜 여기서 아이디·비밀번호를 꼭 받나 (2026-09-09 무무) ──
                  안 적고 「등록」을 누르면 브라우저 말풍선만 뜨고 화면에는
                  아무 말이 없어, 관리자는 **눌렀는데 아무 일도 안 일어난** 것으로
                  느낍니다 (2026-09-08 파일럿 예행). 규칙은 그대로 두고
                  **까닭을 칸 위에 미리 적어** 둡니다.
                */}
                {isNew && (
                  <p className="note small" style={{ marginTop: 0, marginBottom: 10 }}>
                    <b>아이디와 비밀번호는 꼭 적어야 합니다.</b>
                    {' '}이 두 가지가 있어야 이 분이 <b>휴대폰으로 들어와</b> 오늘 갈 곳을
                    받고 다녀온 것을 적을 수 있습니다.
                    <br />
                    아직 안 정하셨으면 <b>이름 첫 글자 + 전화 뒷자리</b>처럼 아무렇게나
                    넣어 두셨다가, 그 분께 휴대폰을 이어 드릴 때 바꿔 주셔도 됩니다.
                  </p>
                )}
                <div className="row" style={{ alignItems: 'flex-end' }}>
                  <div className="field">
                    <label htmlFor="s-login">아이디</label>
                    <input id="s-login" value={form.loginId} onChange={set('loginId')} required />
                  </div>
                  <div className="field">
                    <label htmlFor="s-pw">비밀번호</label>
                    <input id="s-pw" type="password" value={form.password} onChange={set('password')}
                           autoComplete="new-password" required={isNew}
                           placeholder={isNew ? '' : '바꿀 때만 적으세요'} />
                  </div>
                  {/*
                    계약종료는 되돌리기 번거로운 일이라 저장 단추에서 멀리 둡니다.
                    손이 미끄러져 눌리는 자리에 있으면 안 됩니다.
                  */}
                  <div className="field">
                    <div className="btns">
                      {staff?.status === 'active' && (
                        <>
                          {/* 휴직이 먼저 옵니다. 쉬었다 오는 일이 그만두는 일보다 훨씬 잦습니다. */}
                          <button type="button" onClick={doLeave}>휴직</button>
                          <button type="button" className="danger" onClick={doResign}>계약종료</button>
                        </>
                      )}
                      {staff?.status === 'leave' && (
                        <>
                          <button type="button" className="primary" onClick={doReturn}>복직</button>
                          <button type="button" className="danger" onClick={doResign}>계약종료</button>
                        </>
                      )}
                      {staff?.status === 'resigned' && (
                        <button type="button"
                                onClick={async () => { await api.restoreStaff(Number(id)); load() }}>
                          종료 취소
                        </button>
                      )}
                    </div>
                    {staff?.leaveReason && (
                      <p className="note small" style={{ marginTop: 6, marginBottom: 0 }}>
                        휴직 사유: {staff.leaveReason}
                      </p>
                    )}
                  </div>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>역할 <span className="muted">— 겸할 수 있습니다</span></label>
                  <div className="pick">
                    {roles.map((r) => (
                      <button key={r.key} type="button"
                              aria-pressed={form.roles.includes(r.key)}
                              disabled={관리자잠김(r.key)}
                              title={관리자잠김(r.key)
                                ? `관리자는 한 명뿐입니다 — 지금은 ${지금관리자?.name} 님입니다`
                                : undefined}
                              onClick={() => toggleRole(r.key)}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <p className="note small" style={{ marginTop: 10, marginBottom: 0 }}>
                    관리자가 제공인력을 겸하는 경우 두 개를 다 켜세요.
                    따로 등록하면 같은 사람이 둘로 잡혀 인건비가 두 번 계산됩니다.
                  </p>
                  {남이관리자 && (
                    <div className="관리자한명">
                      <p className="note small" style={{ margin: '10px 0 8px' }}>
                        <b>관리자는 한 명뿐입니다</b> — 지금은 <b>{지금관리자?.name} 님</b>입니다.
                        {' '}관리자가 둘이면 백업을 각자 다른 곳에 뜨고 USB 를 각자 들고 다니게 되어,
                        {' '}<b>어느 자료함이 진짜인지 아무도 모르게</b> 됩니다.
                      </p>
                      {!isNew && perms?.['staff.account'] && (
                        <button type="button" className="plain" disabled={busy}
                                onClick={넘기기}>
                          관리자 자리를 이 분에게 넘기기
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="card" style={{ marginTop: 14, marginBottom: 0 }}>
                  <h2 style={{ fontSize: '.82rem' }}>역할별로 보이는 범위</h2>
                  <dl className="facts">
                    <dt>관리자</dt><dd>전부. 계정 · 역할 · 계약종료도 관리자만.</dd>
                    <dt>사무직원</dt><dd>대상자 · 의뢰는 전부, 종사자는 명단만. 계정은 못 건드립니다.</dd>
                    <dt>제공인력</dt><dd><b>자기에게 배정된 대상자만</b>. 본인 정보만 고칩니다.</dd>
                    <dt>외부업체</dt><dd>제공인력과 같되 배정된 건만.</dd>
                  </dl>
                </div>
              </>
            )}
          </div>
        </div>

        {isWorker && (
          <>
            <div className="card">
              <h2>제공인력 정보</h2>
              <div className="row">
                <div className="field">
                  <label htmlFor="s-emp">사번</label>
                  <input id="s-emp" value={form.empNo} onChange={set('empNo')} />
                </div>
                <div className="field" />
                <div className="field" />
              </div>

              <RowList
                title="자격" hint="자격증마다 한 줄씩"
                rows={form.qualifications}
                onChange={(v) => setForm({ ...form, qualifications: v })}
                cols={[
                  { key: 'name', label: '자격명 (예: 요양보호사 1급)', flex: 2 },
                  { key: 'no', label: '자격번호' },
                  { key: 'on', label: '취득일', type: 'date' },
                ]}
              />

              <RowList
                title="교육 이수" hint="교육마다 한 줄씩"
                rows={form.trainings}
                onChange={(v) => setForm({ ...form, trainings: v })}
                cols={[
                  { key: 'name', label: '교육명 (예: 인권교육)', flex: 2 },
                  { key: 'on', label: '이수일', type: 'date' },
                  { key: 'hours', label: '시간' },
                ]}
              />

              <div className="card warn" style={{ marginBottom: 14 }}>
                <label className="check">
                  <input type="checkbox" checked={form.payrollExcluded}
                         onChange={set('payrollExcluded')} />
                  <b>임금·근태 관리에서 제외 (별도관리)</b>
                </label>
                <p className="note small" style={{ marginTop: 8, marginBottom: 0 }}>
                  이미 다른 자리로 채용된 직원이 이 사업을 거드는 경우에 켭니다.
                  이 사업 인건비로 계산하면 정산이 틀어지기 때문입니다.<br />
                  <b>제공 실적과 일지는 그대로 쌓입니다.</b> 임금 계산에서만 빠집니다 —
                  실적까지 빠지면 기록지에 구멍이 납니다.
                </p>
                {form.payrollExcluded && (
                  <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                    <label htmlFor="s-why">제외 사유</label>
                    <input id="s-why" value={form.excludeReason} onChange={set('excludeReason')}
                           placeholder="복지관 정규직, 타 사업 인건비로 지급" />
                  </div>
                )}
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="s-note">메모</label>
                <input id="s-note" value={form.note} onChange={set('note')} />
              </div>
            </div>
          </>
        )}

      </form>

      {!isNew && isWorker && (
        <기기등록칸 staffId={Number(id)} 이름={form.name || '이 분'} />
      )}

      {!isNew && isWorker && (
        <div className="grid2">
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 0' }}>
              <div className="main-head" style={{ marginTop: 0 }}>
                <h2 style={{ margin: 0 }}>맡고 있는 대상자
                  <span className="muted small" style={{ fontWeight: 400, marginLeft: 8 }}>
                    {matches.length}명
                  </span>
                </h2>
                <div className="spacer" />
                <button onClick={() => { setPicking(!picking); setPick('') }}>
                  {picking ? '닫기' : '+ 대상자 배정'}
                </button>
              </div>
              {picking && (
                <>
                  <div className="field">
                    <label htmlFor="pick-r">담당 없는 대상자 · 서비스</label>
                    <select id="pick-r" value={pick} onChange={(e) => setPick(e.target.value)}>
                      <option value="">— 고르기 —</option>
                      {free.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.recipient}{f.dong ? ` (${f.dong})` : ''} · {f.service} · {f.cycle}
                        </option>
                      ))}
                    </select>
                    {free.length === 0 && (
                      <p className="note small" style={{ marginTop: 6, marginBottom: 0 }}>
                        담당이 없는 건이 지금은 없습니다.
                      </p>
                    )}
                  </div>
                  {pick && (
                    <AssignBox
                      recipientId={pick.split('|')[0]}
                      serviceId={Number(pick.split('|')[1])}
                      presetUserId={Number(id)}
                      showWeek={false}
                      onClose={() => { setPick(''); setPicking(false) }}
                      onSaved={() => {
                        setPick(''); setPicking(false); load()
                        api.assign({ state: '미배정' }).then((d) => setFree(d.items)).catch(() => {})
                      }}
                    />
                  )}
                </>
              )}
            </div>
            {matches.length === 0 ? (
              <div className="empty">
                아직 배정된 대상자가 없습니다.<br />
                <span className="small">위 「+ 대상자 배정」으로 바로 붙일 수 있습니다.</span>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>대상자</th><th>읍면동</th><th>서비스</th><th>가는 요일</th><th>기간</th></tr></thead>
                  <tbody>
                    {matches.map((m) => (
                      <tr key={m.id}>
                        <td><span className="name">{m.recipient}</span></td>
                        <td className="small">{m.dong}</td>
                        <td><span className="svc">{m.service}</span></td>
                        <td className="small">{m.slotText || <span className="muted">—</span>}</td>
                        <td className="mono small">{m.from ?? '—'} ~ {m.to ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 0' }}><h2>지난 배정 이력</h2></div>
            {past.length === 0 ? (
              <div className="empty">아직 없습니다.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>대상자</th><th>서비스</th><th>가는 요일</th><th>기간</th></tr></thead>
                  <tbody>
                    {past.map((m) => (
                      <tr key={m.id} style={{ opacity: .6 }}>
                        <td>
                          {m.recipient}
                          {m.recipientStatus && m.recipientStatus !== '이용' && (
                            <div className="muted small">{m.recipientStatus}</div>
                          )}
                        </td>
                        <td><span className="svc done">{m.service}</span></td>
                        <td className="small">{m.slotText || '—'}</td>
                        <td className="mono small">{m.from ?? '—'} ~ {m.to ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
