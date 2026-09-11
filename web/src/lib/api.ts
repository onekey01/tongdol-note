/**
 * 서버와 이야기하는 창구입니다.
 * 화면 코드는 fetch 를 직접 쓰지 않고 여기 함수만 부릅니다.
 * 주소가 바뀌거나 오류 처리 방식이 바뀔 때 이 파일만 고치면 됩니다.
 */

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function call(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    credentials: 'same-origin', // 로그인 쿠키를 같이 보냅니다
    // 파일을 올릴 때(FormData)는 브라우저가 알아서 머리말을 붙입니다.
    // 우리가 손대면 경계 문자열이 빠져서 서버가 못 읽습니다.
    headers: typeof init?.body === 'string' ? { 'content-type': 'application/json' } : undefined,
    ...init,
  })

  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = null }

  if (!res.ok) {
    throw new ApiError(data?.error ?? `서버가 응답하지 않습니다 (${res.status})`, res.status)
  }
  return data
}

const get = (p: string) => call(p)
const post = (p: string, body?: unknown) =>
  call(p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
const patch = (p: string, body: unknown) =>
  call(p, { method: 'PATCH', body: JSON.stringify(body) })
const del = (p: string) => call(p, { method: 'DELETE' })

export type Me = {
  id: number; login_id: string; name: string; role: string; roles: string[]
}

/**
 * 누가 무엇까지 볼 수 있는가. 서버(perm.ts)가 막는 것과 같은 표입니다.
 * 화면은 이걸로 차림표와 단추를 감출 뿐입니다 —
 * **감추는 것은 막는 것이 아닙니다.** 진짜 잠금은 서버에 있습니다.
 */
export type Perms = {
  'staff.list': boolean
  'staff.create': boolean
  'staff.editOther': boolean
  'staff.account': boolean
  'recipient.viewAll': boolean
  'recipient.edit': boolean
  'recipient.delete': boolean
  'referral.manage': boolean
  'settings.view': boolean
  'settings.edit': boolean
}

export type Guardian = { relation: string; name: string; phone: string }

export type Recipient = {
  id: string
  name: string
  birth: string
  age: number | null
  gender: string
  phone: string
  phoneHome: string
  /** 도로명과 상세(동·호수)를 **합친 것.** 화면·계약서·기록지가 쓰는 값입니다. */
  address: string
  /** 고치기 화면에서만 씁니다 — 합쳐진 주소는 도로 가를 수 없어 따로 받습니다. */
  addressRoad?: string
  addressDetail?: string
  dong: string
  guardians: Guardian[]
  cctv: string
  pet: string
  caution: string
  selfSign: boolean
  noShowStreak: number
  noShowWarn: boolean
  noShowLimit: number
  lastNoShowOn: string | null
  status: string
  statusSince: string | null
  statusReason: string | null
  suspendDeadline: string | null
  suspendDaysLeft: number | null
  copayTierId: number | null
  copayLabel: string | null
  copayShort: string | null
  services: { name: string; from: string | null; to: string | null; cycle: string; ended: boolean }[]
  noShowCount: number
  memo: string
  createdAt: string
  updatedAt: string
}

export type StatusChange = {
  id: number
  from_status: string | null
  to_status: string
  changed_on: string
  reason: string | null
}

export const api = {
  bootstrap: () => get('/api/bootstrap'),
  health: () => get('/api/health'),

  setup: (b: Record<string, unknown>) => post('/api/setup', b),
  // 최초 설정 마법사 (v35) — 지금 값을 읽고, 확인한 값을 한 번에 저장합니다.
  setupRules: () => get('/api/setup/rules'),
  setupRulesSave: (b: Record<string, unknown>) => post('/api/setup/rules', b),
  login: (loginId: string, password: string) => post('/api/login', { loginId, password }),
  logout: () => post('/api/logout'),

  /** 의뢰 엑셀 미리보기. 자료함에는 아무것도 쓰지 않습니다. */
  previewReferrals: (file: File, password: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (password) fd.append('password', password)
    return call('/api/referrals/preview', { method: 'POST', body: fd })
  },
  /** 확인필요·동명이인 줄을 관리자가 손으로 정해 줍니다. */
  fixReferral: (token: string, sheet: string, row: number, body: Record<string, unknown>) =>
    post('/api/referrals/fix', { token, sheet, row, ...body }),
  applyReferrals: (token: string, skip: { sheet: string; row: number }[]) =>
    post('/api/referrals/apply', { token, skip }),
  batches: () => get('/api/referrals/batches'),

  // ── 인력 ─────────────────────────────────────────────────
  staff: (q = '', role = '', resigned = false) => {
    const s = new URLSearchParams()
    if (q) s.set('q', q)
    if (role) s.set('role', role)
    if (resigned) s.set('resigned', '1')
    const qs = s.toString()
    return get('/api/staff' + (qs ? `?${qs}` : ''))
  },
  staffOne: (id: number) => get(`/api/staff/${id}`),
  createStaff: (b: Record<string, unknown>) => post('/api/staff', b),
  updateStaff: (id: number, b: Record<string, unknown>) => patch(`/api/staff/${id}`, b),
  resetStaffPassword: (id: number, password: string) =>
    post(`/api/staff/${id}/password`, { password }),
  resignStaff: (id: number, on?: string) => post(`/api/staff/${id}/resign`, { on }),
  restoreStaff: (id: number) => post(`/api/staff/${id}/restore`, {}),
  /** 휴직 — 쉬었다 돌아오는 사람. 퇴직과 다릅니다(입사일·자격이 그대로 이어집니다). */
  leaveStaff: (id: number, b: { from?: string; to?: string; reason?: string }) =>
    post(`/api/staff/${id}/leave`, b),
  returnStaff: (id: number) => post(`/api/staff/${id}/return`, {}),
  /**
   * 기기 등록 — 제공인력 휴대폰을 우편함에 잇습니다.
   * 비밀번호는 **본인이 그 자리에서** 치고, 확인은 서버(해시를 가진 쪽)가 합니다.
   */
  /** 등록 QR 을 만듭니다. 관리자만 부를 수 있습니다(서버가 막습니다). */
  enrollDevice: (id: number) =>
    post(`/api/staff/${id}/enroll`, {}) as
      Promise<{ qr: string; 만료: string; 몇분: number; 인력번호: string }>,
  /**
   * 등록이 어디까지 갔나. 물어보는 김에 서버가 **열쇠도 건넵니다** —
   * QR 에는 열쇠가 없고, 휴대폰이 올린 공개쪽으로 싸서 따로 보내기 때문입니다.
   */
  enrollState: (id: number) =>
    post(`/api/staff/${id}/enrollstate`, {}) as
      Promise<{ 상태: '없음' | '기다리는중' | '됨'; 건넨수?: number }>,

  // ── 기록지 ───────────────────────────────────────────────
  recordbook: (month: string) => get(`/api/recordbook?month=${month}`),
  recordbookOne: (id: string, month: string) => get(`/api/recordbook/${id}?month=${month}`),
  saveRecordNote: (id: string, b: Record<string, unknown>) => post(`/api/recordbook/${id}`, b),
  // PDF 는 한글 프로그램이 만듭니다. 이 PC 에서 되는지 먼저 물어봅니다.
  pdfOk: () => get('/api/recordbook/pdf-ok'),

  // ── 정산 ─────────────────────────────────────────────────
  billing: (month: string, f: Record<string, string> = {}) => {
    const s = new URLSearchParams({ month })
    for (const [k, v] of Object.entries(f)) if (v) s.set(k, v)
    return get('/api/billing?' + s.toString())
  },
  billingOne: (recipientId: string, month: string) =>
    get(`/api/billing/${recipientId}?month=${month}`),
  /** 확정 — 계산에 쓴 값을 얼려서 저장합니다. */
  issueBill: (b: Record<string, unknown>) => post('/api/billing/issue', b),
  payBill: (billId: number, undo = false) => post('/api/billing/pay', { billId, undo }),
  cancelBill: (billId: number) => post('/api/billing/cancel', { billId }),

  // ── 제공실적 ─────────────────────────────────────────────
  records: (month: string, f: Record<string, string> = {}) => {
    const s = new URLSearchParams({ month })
    for (const [k, v] of Object.entries(f)) if (v) s.set(k, v)
    return get('/api/records?' + s.toString())
  },
  setRecordCell: (b: Record<string, unknown>) => post('/api/records/cell', b),
  fillRecords: (month: string, assignIds?: number[]) =>
    post('/api/records/fill', { month, assignIds }),

  /** 홈 — 오늘 손대야 할 것. */
  home: () => get('/api/home'),

  // ── 포스트잇 ─────────────────────────────────────────────
  // 사무실 벽에 붙던 종이를 프로그램 안으로. 떼기 전까지 홈에 남습니다.
  /**
   * 보드 한 장을 불러옵니다.
   *   board 없음    기관 보드 (대상자에 안 매인 메모)
   *   board=<id>    그 대상자의 보드
   * 섞어 보면 김순자 어르신 화면에 남의 쪽지가 스무 장 뜹니다.
   */
  stickies: (done = false, board = '') => {
    const s = new URLSearchParams()
    if (done) s.set('done', '1')
    if (board) s.set('board', board)
    const qs = s.toString()
    return get('/api/sticky' + (qs ? `?${qs}` : ''))
  },
  addSticky: (b: Record<string, unknown>) => post('/api/sticky', b),
  updateSticky: (id: number, b: Record<string, unknown>) => patch(`/api/sticky/${id}`, b),
  /** 떼기 · 다시 붙이기. 뗀 것도 지워지지 않고 아래에 남습니다. */
  doneSticky: (id: number, done: boolean) => post(`/api/sticky/${id}/done`, { done }),
  /**
   * 보드 위에서 옮기거나 크기를 바꿉니다.
   * 겹치는 자리에 놓으면 서버가 **가장 가까운 빈자리**로 비켜세우고,
   * 실제로 놓인 자리를 돌려줍니다. 화면은 그 값으로 맞춰야 다음 끌기가 안 어긋납니다.
   */
  placeSticky: (id: number, b: { x?: number; y?: number; w?: number; h?: number }) =>
    post(`/api/sticky/${id}/place`, b),
  removeSticky: (id: number) => del(`/api/sticky/${id}`),
  /** 지자체가 연장을 알려 왔을 때. 끝난 의뢰의 종료일만 미룹니다. */
  extendRecipient: (id: string, until: string, reason = '') =>
    post(`/api/recipients/${id}/extend`, { until, reason }),

  // ── 배정 · 주간계획 ──────────────────────────────────────
  assign: (f: Record<string, string> = {}) => {
    const s = new URLSearchParams()
    for (const [k, v] of Object.entries(f)) if (v) s.set(k, v)
    const qs = s.toString()
    return get('/api/assign' + (qs ? `?${qs}` : ''))
  },
  /** 이 기관이 고를 수 있는 서비스 목록 — 손으로 서비스를 넣을 때 씁니다. */
  serviceCatalog: () => get('/api/service-catalog'),
  /** 대상자에게 받는 서비스를 **손으로** 하나 넣습니다. */
  addRecipientService: (recipientId: string, b: Record<string, unknown>) =>
    post(`/api/recipients/${recipientId}/service`, b),
  /** 손으로 넣은 서비스 고치기. 기간·주기·비고는 실적이 있어도 고칠 수 있습니다. */
  editReferral: (referralId: number, b: Record<string, unknown>) =>
    patch(`/api/referral/${referralId}`, b),
  /** 손으로 넣은 서비스 지우기. 엑셀에서 온 것은 서버가 막습니다. */
  removeReferral: (referralId: number) => del(`/api/referral/${referralId}`),
  /**
   * 의뢰 중단 — 「신청은 했는데 자부담이 부담되어 취소」 같은 경우.
   * **지우지 않고 기간을 그날로 닫습니다.** 무엇이 왔었는지는 근거로 남습니다.
   */
  cancelReferral: (referralId: number, reason: string) =>
    post(`/api/referral/${referralId}/cancel`, { reason }),
  uncancelReferral: (referralId: number) =>
    post(`/api/referral/${referralId}/uncancel`, {}),

  assignOne: (recipientId: string, serviceId: number) =>
    get(`/api/assign/${recipientId}/${serviceId}`),
  saveAssign: (b: Record<string, unknown>) => post('/api/assign', b),
  removeAssign: (id: number) => del(`/api/assign/${id}`),
  /** 이 담당이 요일마다 이미 몇 곳을 도는지. */
  assignLoad: (b: Record<string, unknown>) => post('/api/assign/load', b),

  settings: () => get('/api/settings'),
  saveOrg: (b: Record<string, unknown>) => patch('/api/settings/org', b),
  setProfile: (profileId: number, reason = '') =>
    post('/api/settings/profile', { profileId, reason }),
  // 계산 규칙을 **하나씩** 고칩니다. 바꾼 것은 하나하나 기록에 남습니다.
  saveRules: (profileId: number, b: Record<string, unknown>) =>
    patch('/api/settings/profile/rules', { profileId, ...b }),
  uploadStamp: (dataUrl: string) => post('/api/settings/stamp', { dataUrl }),
  removeStamp: () => del('/api/settings/stamp'),

  /*
   * 공휴일 — **프로그램이 알고 있지 않습니다. 기관이 적어 넣습니다.**
   * 설날·추석은 음력이라 해마다 옮겨 다니고, 대체공휴일은 그해 규정을 탑니다.
   * 관공서 달력이 나오면 그때 넣으면 되고, 넣은 것은 그대로 쌓입니다.
   */
  // 통계 — 지자체가 묻는 것을 한 자리에
  stats: (year: number, month?: number | null) =>
    get(`/api/stats?year=${year}${month ? `&month=${month}` : ''}`),

  // 백업 — 자료함 파일을 한 부 더 떠 두는 일
  근무시간: () => get('/api/settings/hours'),
  자동시작고치기: (autoStart: boolean) => patch('/api/settings/hours', { autoStart }),
  종료예약: (hours: number) => post('/api/settings/hours/shutdown', { hours }),
  종료예약취소: () => post('/api/settings/hours/cancel', {}),

  /*
   * 사무실 안 다른 컴퓨터에서 들어오게 잠깐 열기.
   * 사무보조원이 자기 자리에서 대상자를 등록하고 서식을 뽑습니다.
   */
  사무실열림: () => get('/api/settings/lan'),
  사무실열기: (hours: number) => post('/api/settings/lan', { hours }),
  사무실닫기: () => del('/api/settings/lan'),

  /*
   * 제공인력이 **새 휴대폰으로 들어온** 것. 승인을 기다리지 않고 바로
   * 들어가되, 사무실이 나중에 봅니다. 모르는 사람이면 「이 기기 끊기」.
   */
  /*
   * 사무실이 현장 몫을 직접 적습니다 — 폰이 고장 났거나, 아직 폰을
   * 안 쓰는 인력이거나, 종이로 적어 온 것을 옮길 때.
   */
  현장적기: (b: { assignId: number; on: string; 값: any }) =>
    post('/api/records/field', b),
  실적사진: (b: { assignId: number; on: string; 그림들: string[] }) =>
    post('/api/records/photo', b),

  기기바뀜: () => get('/api/devices/changes'),
  들어온기록: () => get('/api/devices/log'),
  기기바뀜지우기: (때?: string) =>
    call('/api/devices/changes', { method: 'DELETE', body: JSON.stringify({ 때 }) }),
  기기끊기: (인력번호: string, 때?: string) =>
    post('/api/devices/cut', { 인력번호, 때 }),

  backup: () => get('/api/settings/backup'),
  backupNow: () => post('/api/settings/backup', {}),
  setBackupDir: (dir: string) => patch('/api/settings/backup/dir', { dir }),
  /*
   * 주소 찾기는 여기 없습니다 — 화면이 카카오 우편번호 서비스를 바로 띄웁니다.
   * 승인키가 없으니 서버가 대신 물어봐 줄 일이 없습니다 (RecipientForm.tsx).
   */

  /** 폴더 고르개 — 경로를 손으로 치지 않게 서버가 폴더를 훑어 줍니다. */
  browseFolders: (path?: string) =>
    get('/api/settings/backup/browse' + (path ? `?path=${encodeURIComponent(path)}` : '')),
  setBackupSchedule: (every: number, keep: number) =>
    patch('/api/settings/backup/schedule', { every, keep }),
  // 되돌리기 — 들여다보고, 예약하고, 다시 켤 때 바뀝니다
  inspectBackup: (path: string) => post('/api/settings/backup/inspect', { path }),
  restoreBackup: (path: string) => post('/api/settings/backup/restore', { path }),
  cancelRestore: () => post('/api/settings/backup/restore/cancel', {}),

  addHoliday: (on: string, name: string) => post('/api/settings/holiday', { on, name }),
  removeHoliday: (on: string) => del(`/api/settings/holiday/${encodeURIComponent(on)}`),

  // 서비스 단가표 — 지침에 없는 서비스가 오면 여기서 새로 만듭니다.
  // **지우는 길은 없습니다.** 안 쓰게 된 것은 active:false 로 접어 둡니다.
  addService: (b: Record<string, unknown>) => post('/api/settings/service', b),
  saveService: (id: number, b: Record<string, unknown>) =>
    patch(`/api/settings/service/${id}`, b),

  /*
   * 본인부담 구간 — 지자체마다 구간 수도 비율도 다릅니다
   * (지침: 「광역지자체별로 본인부담률을 차등 설정하도록 함」).
   * 쓰는 대상자가 있는 구간은 서버가 지우기를 막습니다.
   */
  addCopayTier: (b: Record<string, unknown>) => post('/api/settings/copay', b),
  saveCopayTier: (id: number, b: Record<string, unknown>) =>
    patch(`/api/settings/copay/${id}`, b),
  removeCopayTier: (id: number) => del(`/api/settings/copay/${id}`),

  /**
   * 계획을 **저장하기 전에** 재 봅니다 — 한 달에 몇 시간·얼마,
   * 월·연간 한도를 넘는지. 아무것도 바꾸지 않습니다.
   */
  previewAssign: (b: Record<string, unknown>) => post('/api/assign/preview', b),

  /**
   * USB 로 오간 자료 — 살펴보기 · 견주기 · 가져오기.
   *
   * `사라질건수` 를 같이 보내는 까닭: 서버가 **화면이 본 숫자와 지금
   * 숫자가 같은지** 확인합니다. 그 사이에 USB 를 다시 꽂았거나 백업이
   * 새로 떴으면 다르고, 그때는 막습니다 — 자료함을 통째로 바꾸는 일이라
   * 「본 것과 다른 것을 덮는」 일이 있으면 안 됩니다.
   */
  usbSync: () => get('/api/settings/backup/usb'),
  usbCompare: (path: string) => post('/api/settings/backup/usb/compare', { path }),
  usbImport: (path: string, 사라질건수: number) =>
    post('/api/settings/backup/usb/import', { path, 사라질건수 }),

  /** 확인사항 항목 — 목록을 통째로 주고받습니다 (순서가 곧 폰 화면 순서). */
  checkItems: () => get('/api/settings/check-items'),
  saveCheckItems: (items: string[], reason = '') =>
    post('/api/settings/check-items', { items, reason }),

  recipients: (q = '', status = '', dong = '', sort = 'name', dir: 'asc' | 'desc' = 'asc') => {
    const s = new URLSearchParams()
    if (q) s.set('q', q)
    if (status) s.set('status', status)
    if (dong) s.set('dong', dong)
    s.set('sort', sort); s.set('dir', dir)
    return get('/api/recipients?' + s.toString())
  },
  createRecipient: (b: Record<string, unknown>) => post('/api/recipients', b),
  recipient: (id: string) => get(`/api/recipients/${id}`),
  updateRecipient: (id: string, b: Record<string, unknown>) => patch(`/api/recipients/${id}`, b),
  deleteRecipient: (id: string) => del(`/api/recipients/${id}`),
  changeStatus: (id: string, b: Record<string, unknown>) =>
    post(`/api/recipients/${id}/status`, b),
  /** 식사지원 대면 수령 기록. received=false 면 연속 미수령이 1 늘어납니다. */
  noShow: (id: string, received: boolean, on?: string) =>
    post(`/api/recipients/${id}/noshow`, { received, on }),

  // ── 업데이트 안내 (관리자만) ────────────────────────────
  업데이트: () => get('/api/update'),
  업데이트확인: () => post('/api/update/check'),
  업데이트나중에: (버전: string) => post('/api/update/later', { 버전 }),
  업데이트하기: () => post('/api/update/apply'),
  업데이트설정: (b: { 켜짐: boolean }) => patch('/api/update/settings', b),

  /** 관리자 자리를 이 사람에게 넘깁니다. 부른 사람은 그 자리에서 사무직원이 됩니다. */
  관리자넘기기: (id: number | string) => post(`/api/staff/${id}/admin`),
}
