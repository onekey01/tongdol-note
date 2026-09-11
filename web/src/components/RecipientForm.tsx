import 주소칸 from './AddressField'

/**
 * 대상자 입력 칸 묶음입니다.
 * 새로 등록할 때와 고칠 때가 똑같은 칸을 쓰므로 한 곳에 모아 둡니다.
 * 한쪽만 고쳐서 두 화면이 어긋나는 일이 제일 흔한 사고입니다.
 */

export type Guardian = { relation: string; name: string; phone: string }

export type RecipientDraft = {
  name: string
  birth: string
  gender: string
  phone: string
  phoneHome: string
  address: string
  addressDetail: string
  dong: string
  copayTierId: number | null
  guardians: Guardian[]
  cctv: string
  pet: string
  caution: string
  selfSign: boolean
  memo: string
}

export const EMPTY: RecipientDraft = {
  name: '', birth: '', gender: '', phone: '', phoneHome: '',
  address: '', addressDetail: '', dong: '', copayTierId: null,
  guardians: [
    { relation: '', name: '', phone: '' },
    { relation: '', name: '', phone: '' },
  ],
  cctv: '', pet: '', caution: '', selfSign: true, memo: '',
}

export type Tier = { id: number; label: string; rate: number }

/** 대리인 칸은 항상 두 줄로 보여줍니다. 비어 있으면 저장되지 않습니다. */
export function twoGuardians(list: Guardian[] | undefined): Guardian[] {
  const g = [...(list ?? [])]
  while (g.length < 2) g.push({ relation: '', name: '', phone: '' })
  return g.slice(0, 2)
}

export default function RecipientForm({
  value, onChange, tiers,
}: {
  value: RecipientDraft
  onChange: (next: RecipientDraft) => void
  tiers: Tier[]
}) {
  const set = (k: keyof RecipientDraft) => (e: any) => {
    const raw = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    onChange({
      ...value,
      [k]: k === 'copayTierId' ? (raw ? Number(raw) : null) : raw,
    })
  }

  const guardians = twoGuardians(value.guardians)
  const setG = (i: number, k: keyof Guardian) => (e: any) => {
    const next = guardians.map((g, j) => (j === i ? { ...g, [k]: e.target.value } : g))
    onChange({ ...value, guardians: next })
  }

  return (
    <>
      <div className="row">
        <div className="field" style={{ flex: 1.2 }}>
          <label htmlFor="r-name">성명</label>
          <input id="r-name" value={value.name} onChange={set('name')} autoFocus required />
        </div>
        <div className="field" style={{ flex: 1.3 }}>
          <label htmlFor="r-birth">생년월일</label>
          <input id="r-birth" value={value.birth} onChange={set('birth')}
                 placeholder="1940-03-02" required />
        </div>
        <div className="field" style={{ flex: .8 }}>
          <label htmlFor="r-gender">성별</label>
          <select id="r-gender" value={value.gender} onChange={set('gender')}>
            <option value="">—</option>
            <option value="여">여</option>
            <option value="남">남</option>
          </select>
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="r-phone">휴대전화</label>
          <input id="r-phone" value={value.phone} onChange={set('phone')} placeholder="010-0000-0000" />
        </div>
        <div className="field">
          <label htmlFor="r-phoneHome">집 전화</label>
          <input id="r-phoneHome" value={value.phoneHome} onChange={set('phoneHome')} />
        </div>
        <div className="field">
          <label htmlFor="r-dong">읍면동</label>
          <input id="r-dong" value={value.dong} onChange={set('dong')} placeholder="해남읍" />
        </div>
      </div>

      {/*
        ── 주소 ──────────────────────────────────────────────
        손으로 치면 같은 집이 사람마다 다르게 적힙니다 —
        「해남읍 중앙1로 330」·「해남군 해남읍 중앙1로 330」·「중앙1로330」.
        그러면 읍면동으로 거르는 화면과 통계가 조용히 어긋납니다.
        게다가 **찾아가는 사람이 보고 가는 주소**라 틀리면 헛걸음입니다.

        그래서 포털에서 쓰시던 그 검색창으로 찾아 넣습니다. 다만
        **칸은 그대로 열어 둡니다** — 인터넷이 없다고 등록을 못 하면 안 됩니다.
      */}
      <주소칸
        id="r-address"
        value={value.address}
        onChange={(주소) => onChange({ ...value, address: 주소 })}
        상세={value.addressDetail}
        상세바꿈={(상세) => onChange({ ...value, addressDetail: 상세 })}
        고름={(a) => {
          /*
            **읍면동도 함께 채웁니다.** 거르기·통계가 그 값을 쓰는데,
            주소만 넣고 읍면동을 비워 두면 그분은 어느 동에도 안 잡힙니다.
            이미 적혀 있으면 건드리지 않습니다 — 사람이 고른 것이 우선입니다.
          */
          if (!value.dong.trim() && a.읍면동) onChange({ ...value, address: a.주소, dong: a.읍면동 })
        }} />

      <div className="field">
        <label htmlFor="r-copay">본인부담</label>
        <select id="r-copay" value={value.copayTierId ?? ''} onChange={set('copayTierId')}>
          <option value="">— 아직 정하지 않음</option>
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* ── 대리인 · 비상연락처 ─────────────────────────── */}
      <h3 style={{ marginTop: 20 }}>대리인 · 비상연락처</h3>
      <p className="note small" style={{ marginTop: -6 }}>
        문제가 생겼을 때 연락할 곳입니다. <b>한 명만 적으셔도 됩니다.</b>
        두 번째는 첫 번째와 연락이 닿지 않을 때를 위한 예비입니다.
      </p>
      {guardians.map((g, i) => (
        <div className="row tight" key={i}>
          <div className="field" style={{ flex: .8 }}>
            <label htmlFor={`g-rel-${i}`}>{i === 0 ? '관계' : '관계 (예비)'}</label>
            <input id={`g-rel-${i}`} value={g.relation} onChange={setG(i, 'relation')}
                   placeholder={i === 0 ? '아들' : '딸'} />
          </div>
          <div className="field">
            <label htmlFor={`g-name-${i}`}>성명</label>
            <input id={`g-name-${i}`} value={g.name} onChange={setG(i, 'name')} />
          </div>
          <div className="field">
            <label htmlFor={`g-phone-${i}`}>연락처</label>
            <input id={`g-phone-${i}`} value={g.phone} onChange={setG(i, 'phone')}
                   placeholder="010-0000-0000" />
          </div>
        </div>
      ))}

      <div className="field">
        <label htmlFor="r-selfsign">계약서 서명</label>
        <select id="r-selfsign" value={value.selfSign ? 'self' : 'proxy'}
                onChange={(e) => onChange({ ...value, selfSign: e.target.value === 'self' })}>
          <option value="self">본인이 직접 서명</option>
          <option value="proxy">대리인 서명 필요</option>
        </select>
      </div>

      {/* ── 방문 전 알아야 할 것 ────────────────────────── */}
      <h3 style={{ marginTop: 20 }}>방문 전 알아야 할 것</h3>
      <p className="note small" style={{ marginTop: -6 }}>
        여기 적은 내용은 <b>제공인력 화면에 그대로 뜹니다.</b>
        계약서 6·7조에서 이용자가 미리 알리기로 되어 있는 항목입니다.
      </p>
      <div className="row">
        <div className="field">
          <label htmlFor="r-pet">반려동물</label>
          <input id="r-pet" value={value.pet} onChange={set('pet')}
                 placeholder="중형견 1마리, 마당에 묶여 있음" />
        </div>
        <div className="field">
          <label htmlFor="r-cctv">CCTV 위치</label>
          <input id="r-cctv" value={value.cctv} onChange={set('cctv')}
                 placeholder="현관 위, 거실 천장" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="r-caution">그 밖에 주의할 점</label>
        <input id="r-caution" value={value.caution} onChange={set('caution')}
               placeholder="귀가 어두우심 · 대문 초인종 고장 · 계단 미끄러움" />
      </div>

      <div className="field">
        <label htmlFor="r-memo">내부 메모</label>
        <textarea id="r-memo" value={value.memo} onChange={set('memo')}
                  placeholder="출력 서식에는 나가지 않습니다." />
      </div>
    </>
  )
}
