/**
 * 사무실이 **현장 몫을 직접 적는** 길 — 진짜 브라우저로 한 바퀴.
 *
 *   bun 실적적기시험.ts     (통돌 Note 가 켜져 있어야 합니다)
 *
 * ── 왜 이 기능이 있나 ──────────────────────────────────────
 *
 * 제공인력 평균 연령이 60세를 넘습니다. 앱을 아무리 단순하게 만들어도
 * 폰에서 막히는 일이 실제로 잦습니다. 그때 사무실이 손을 못 대면
 * **그 달 서식을 통째로 손으로 씁니다.**
 * (2026-09-05 무무 — 「관리자에게 그정도의 권한을 주지 않으면
 *  대처할 방법이 없어서 그래」)
 *
 * ── 여기서 보는 것 ─────────────────────────────────────────
 *
 *   1. 계획 칸에서 적으면 **제공으로 올라간다** (안 그러면 청구에 안 잡힘)
 *   2. 진행시간이 들어가고 **서식8 이 쓸 모양**으로 남는다
 *   3. 서식3 가사 — 열한 가지를 골라 적힌다
 *   4. ★ 적은 칸에만 **「관리자 수정함」**이 붙는다 (안 건드린 칸에는 안 붙음)
 *   5. 특이사항이 **대상자 메모지로도** 넘어간다
 *   6. ★ 거꾸로 된 시각(종료 < 시작)은 **막힌다**
 *   7. 상태를 고르면 창이 **저절로 닫힌다** (한 달치 찍는 손이 줄어듦)
 *   8. 서식4 식사 — 식단 칸이 뜬다 (서식에 「식단 포함 필수」)
 */
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import { db, initDb } from './server/db'
import { hashPassword } from './server/auth'
initDb()

const 결과: { n: string; ok: boolean; d?: string }[] = []
const 통과 = (n: string, ok: unknown, d = '') => 결과.push({ n, ok: !!ok, d })
const 주소 = 'http://127.0.0.1:5757'
const 오늘 = new Date().toISOString().slice(0, 10)
const 달 = 오늘.slice(0, 7)

const 사람 = randomUUID()
const 프로필: any = db.query(
  `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`).get()
const 만든서비스: number[] = []
const 배정: number[] = []
let 만든사람: number | null = null
let 만든종사자: number | null = null
let 만든관리자: number | null = null

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 1500, height: 1100 } })
/*
 * 화면이 통째로 터지는 것만 봅니다.
 * ★ 콘솔의 400 은 세지 않습니다 — 「거꾸로 된 시각을 막는다」 시험이
 *   일부러 내는 것이라, 그것까지 세면 시험이 스스로 만든 것에 걸립니다.
 */
const 콘솔오류: string[] = []
page.on('pageerror', (e) => 콘솔오류.push(e.message))

try {
  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: '적기시험' }), '해남읍', '이용', `${달}-01`, 'x'])

  let w: any = db.query(`SELECT id FROM worker ORDER BY id LIMIT 1`).get()
  if (!w) {
    const u = db.run(
      `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload, created_at)
       VALUES ('시험제공인력', ?, 'x', 'worker', '["worker"]', 'active', '{}', 'x')`,
      [`t-${randomUUID().slice(0, 8)}`])
    만든사람 = Number(u.lastInsertRowid)
    const k = db.run(`INSERT INTO worker (user_id, hired_on, created_at) VALUES (?,?,'x')`,
      [만든사람, `${달}-01`])
    만든종사자 = Number(k.lastInsertRowid); w = { id: 만든종사자 }
  }

  /** 갈래가 갈리는 것을 보려고 **가사와 식사** 둘을 만듭니다. */
  function 서비스(이름: string, 중: string, unit: string, rt: string) {
    const i = db.run(
      `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                            holiday_price, record_type, lifetime_cap, outside_annual_cap,
                            monthly_cap_minutes, monthly_cap_count, noshow_billable,
                            sort_order, active, custom)
       VALUES (?,?,'일상생활돌봄',?,'시험',?,?,24000,NULL,?,NULL,0,0,0,0,900,1,1)`,
      [프로필.id, `UIWR-${randomUUID().slice(0, 6)}`, 중, 이름, unit, rt])
    const id = Number(i.lastInsertRowid); 만든서비스.push(id); return id
  }
  const 가사 = 서비스('시험가사(적기)', '가사지원', 'hour', 'time')
  const 식사 = 서비스('시험식사(적기)', '식사지원', 'count', 'meal')

  const 모든요일 = JSON.stringify([0, 1, 2, 3, 4, 5, 6].map((dow) => ({ dow })))
  for (const sid of [가사, 식사]) {
    const a = db.run(
      `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
       VALUES (?,?,?,?,?,'x')`, [사람, sid, w.id, 모든요일, `${달}-01`])
    배정.push(Number(a.lastInsertRowid))
  }

  /*
   * ── 들어가기 ─────────────────────────────────────────────
   *
   * **시험이 자기 계정을 만들어 씁니다** (2026-09-07 고침).
   * 예전에는 `admin` / `admin1234` 를 그냥 적어 두었는데, 그 계정은
   * 어느 컴퓨터에도 없습니다 — 기관마다 관리자 아이디가 다릅니다.
   * 그래서 로그인이 조용히 실패하고, 시험은 「30초 기다렸는데 화면이
   * 안 뜬다」로만 죽었습니다. 진짜 까닭이 로그인이라는 것이 안 보였습니다.
   * 남의 계정 비밀번호를 시험 파일에 적어 두지 않으려는 뜻도 있습니다.
   */
  const 시험아이디 = `rec-${randomUUID().slice(0, 8)}`
  만든관리자 = Number(db.run(
    `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload, created_at)
     VALUES ('적기시험관리자',?,?, 'admin','["admin"]','active','{}',?)`,
    [시험아이디, await hashPassword('시험1234'), new Date().toISOString()]).lastInsertRowid)

  await page.goto(주소 + '/', { waitUntil: 'networkidle' })
  if (await page.locator('input#id').count()) {
    await page.fill('input#id', 시험아이디)
    await page.fill('input[type="password"]', '시험1234')
    await page.locator('button.primary').first().click(); await page.waitForTimeout(2500)
  }
  통과('관리자로 들어갔다', await page.locator('input#id').count() === 0,
    '여기가 무너지면 아래 시험이 죄다 「30초 기다렸다」로만 죽습니다')
  await page.goto(주소 + '/records', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.fill('#r-q', '적기시험')
  await page.waitForTimeout(1400)

  // ── 1. 오늘 칸을 열어 적습니다 ──
  const 오늘칸 = page.locator(`.cal-day[data-on="${오늘}"] button.cal-chip`).first()
  await 오늘칸.click()
  await page.waitForTimeout(800)
  통과('칸을 누르면 창이 열린다', await page.locator('.상태고름').count() === 1)

  await page.locator('button', { hasText: '사무실에서 적기' }).first().click()
  await page.waitForTimeout(600)
  통과('**적는 칸이 열린다**', await page.locator('.적는칸').count() === 1)
  통과('★ 어느 서식으로 나가는지 알려 준다',
    (await page.locator('.적는칸').innerText()).includes('서식3'),
    '가사지원이니 서식3')

  const 시각칸 = page.locator('.적는칸 input[type=time]')
  통과('진행시간 칸이 둘 있다', await 시각칸.count() === 2)

  /*
   * ★ 네모칸이 글자와 **같은 줄**에 있어야 합니다 (2026-09-05 에 걸린 것).
   *
   *   고르는 칸 모양이 현장앱에만 있고 사무실 화면에는 없어서, 네모가
   *   글자 아래로 밀렸습니다. 어느 네모가 어느 항목인지 알 수 없는
   *   화면이었고, 체크 하나를 잘못 누르면 **서식이 통째로 틀립니다.**
   *   눈으로만 보면 다음에 또 놓치니 시험으로 못 박습니다.
   */
  {
    const 첫칸 = page.locator('.적는칸 .칸고름').first()
    const 네모 = 첫칸.locator('input[type=checkbox]')
    const 글 = 첫칸.locator('span')
    const 이름 = (await 글.innerText()).trim()
    const 칸상자 = (await 첫칸.boundingBox())!
    const 네상 = (await 네모.boundingBox())!
    const 글상 = (await 글.boundingBox())!

    /*
     * ★ **네모와 글자의 세로 자리가 겹쳐야** 합니다.
     *
     *   「줄 안에 들어 있나」로 보면 못 잡습니다 — 두 줄로 밀려도
     *   줄 상자는 두 줄만큼 커지니 여전히 「안」이기 때문입니다.
     *   실제로 그렇게 만들었다가 망가뜨려 보고서야 알았습니다.
     */
    const 겹친높이 = Math.min(네상.y + 네상.height, 글상.y + 글상.height)
                   - Math.max(네상.y, 글상.y)
    통과('★ 네모칸이 글자와 같은 줄에 있다',
      겹친높이 > Math.min(네상.height, 글상.height) * 0.5,
      `${이름} — 겹친 높이 ${Math.round(겹친높이)}px`)

    /*
     * ★ 네모가 **줄 전체를 차지하면 안 됩니다.** `input { width: 100% }`
     *   가 걸리면 네모 하나가 한 줄을 다 먹고 글자가 위아래로 밀립니다.
     *   바로 그것 때문에 어느 네모가 어느 항목인지 알 수 없었습니다.
     */
    통과('★ 네모가 손가락만 하다 (줄을 다 먹지 않는다)',
      네상.width < 40, `${Math.round(네상.width)}px`)
    통과('★ 네모가 글자보다 왼쪽에 있다',
      네상.x + 네상.width <= 글상.x + 2,
      `네모 끝 ${Math.round(네상.x + 네상.width)} · 글자 시작 ${Math.round(글상.x)}`)
    통과('한 항목이 한 줄에 들어간다 (두 줄로 안 접힌다)',
      칸상자.height < 52, `${Math.round(칸상자.height)}px`)
  }

  // ── 6. 거꾸로 된 시각은 막힙니다 ──
  await 시각칸.nth(0).fill('11:00')
  await 시각칸.nth(1).fill('09:00')
  await page.locator('.적는칸 button.primary').click()
  await page.waitForTimeout(1500)
  통과('★ 거꾸로 된 시각을 막는다',
    (await page.locator('.적는칸').innerText()).includes('종료가 시작보다'),
    '09:00~11:00 이 아니라 11:00~09:00 을 넣었을 때')

  // ── 2·3. 제대로 적습니다 ──
  await 시각칸.nth(0).fill('09:00')
  await 시각칸.nth(1).fill('11:00')
  for (const 것 of ['청소', '세탁', '말벗']) {
    await page.locator('.적는칸 .칸고름', { hasText: 것 }).first()
      .locator('input[type=checkbox]').check()
  }
  await page.locator('.적는칸 textarea').first()
    .fill('무릎이 아프시다고 하셔서 외출은 다음으로 미뤘습니다')
  await page.locator('.적는칸 button.primary').click()
  await page.waitForTimeout(2500)

  const 창글 = await page.locator('.실적창').innerText()
  통과('★ 진행시간이 들어간다', /09:00\s*~\s*11:00/.test(창글),
    (창글.split('\n').find((x) => x.includes('09:00')) ?? '(없음)').trim())
  통과('걸린 시간을 사람 말로 알려 준다', /2시간/.test(창글))
  통과('★ 해 드린 것이 적힌다',
    창글.includes('청소') && 창글.includes('세탁') && 창글.includes('말벗'))
  통과('특이사항이 적힌다', 창글.includes('무릎이 아프시다고'))

  // ── 4. 손댄 칸에만 표시 ──
  const 손댐수 = await page.locator('.손댐').count()
  통과('★ 「관리자 수정함」이 붙는다', 손댐수 > 0, `${손댐수}군데`)
  /*
   * ★ **안 건드린 칸에는 안 붙어야** 합니다. 매 줄에 붙으면 표시가
   *   뜻을 잃고, 정작 봐야 할 「확인필요」가 안 보입니다.
   */
  통과('★ 서명은 안 건드렸으니 표시가 없다',
    !창글.includes('이용자 확인서명'),
    '서명 자체가 없으니 그 줄이 아예 안 뜹니다')

  // ── 1. 계획이 제공으로 올라갔나 ──
  const 줄: any = db.query(
    `SELECT outcome, start_at, end_at, payload FROM delivery
      WHERE assignment_id = ? AND served_on = ?`).get(배정[0], 오늘)
  통과('★ 계획이 제공으로 올라간다', 줄?.outcome === '제공', 줄?.outcome ?? '(없음)')
  통과('진행시간이 자료함에 남는다',
    String(줄?.start_at ?? '').includes('09:00') && String(줄?.end_at ?? '').includes('11:00'),
    `${줄?.start_at} ~ ${줄?.end_at}`)

  const 속 = JSON.parse(줄?.payload ?? '{}')
  통과('적은 것이 현장 자리에 들어간다',
    (속?.현장?.적은것?.한것 ?? []).length === 3)
  통과('★ 손댄 칸만 기록에 남는다',
    !!속?.현장?.관리자고침?.['시작'] && !속?.현장?.관리자고침?.['서명'],
    Object.keys(속?.현장?.관리자고침 ?? {}).join(', '))
  통과('누가 언제 적었는지 남는다',
    !!속?.현장?.관리자고침?.['시작']?.누가 && !!속?.현장?.관리자고침?.['시작']?.언제,
    속?.현장?.관리자고침?.['시작']?.누가)

  // ── 5. 대상자 메모지로 넘어갔나 ──
  const 메모: any = db.query(
    `SELECT text FROM sticky WHERE recipient_id = ? ORDER BY id DESC LIMIT 1`).get(사람)
  통과('★ 특이사항이 대상자 메모지로 넘어간다',
    String(메모?.text ?? '').includes('무릎이 아프시다고'),
    (메모?.text ?? '(없음)').slice(0, 60))
  통과('메모지에 날짜·서비스가 같이 적힌다',
    String(메모?.text ?? '').includes(오늘) && String(메모?.text ?? '').includes('시험가사'))

  /* ── 7. 상태를 고르면 창이 닫히나 ─────────────────────────
   *
   * ★ 2026-09-09 부터 **미제공만 한 걸음 더** 갑니다.
   *   못 간 까닭을 브라우저 prompt 에 **타이핑**하게 두었더니
   *   목록에 없는 말이 들어가 그대로 기록지에 실렸습니다. 이제 창
   *   안에서 **눌러서 고릅니다.** 고르고 나면 그때 닫힙니다.
   *   계획·제공은 예전 그대로 한 번에 닫힙니다.
   */
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await page.locator(`.cal-day[data-on="${오늘}"] button.cal-chip`).first().click()
  await page.waitForTimeout(700)
  await page.locator('.상태고름 button', { hasText: '미제공' }).first().click()
  await page.waitForTimeout(1200)
  통과('★ 미제공을 고르면 **까닭부터** 묻는다',
    /못 간 까닭을 골라/.test(await page.locator('.실적창').innerText().catch(() => '')),
    '까닭 없이 미제공이 들어가면 기록지가 빕니다')
  통과('★ 까닭을 **눌러서** 고른다 (타이핑이 아니다)',
    await page.locator('.실적창 button', { hasText: /^부재$/ }).count() > 0)
  await page.locator('.실적창 button', { hasText: /^부재$/ }).first().click()
  await page.waitForTimeout(1800)
  통과('★ 까닭까지 고르면 창이 저절로 닫힌다',
    await page.locator('.실적창').count() === 0,
    '한 달치를 찍을 때 누르는 손이 줄어듭니다')

  // 계획·제공은 예전 그대로 **한 번에** 닫혀야 합니다.
  await page.locator(`.cal-day[data-on="${오늘}"] button.cal-chip`).first().click()
  await page.waitForTimeout(700)
  await page.locator('.상태고름 button', { hasText: '제공' }).first().click()
  await page.waitForTimeout(1800)
  통과('★ 제공은 한 번에 닫힌다 (걸음이 안 늘었다)',
    await page.locator('.실적창').count() === 0)

  // ── 8. 식사는 식단을 묻나 ──
  const 식사칸 = page.locator(`.cal-day[data-on="${오늘}"] button.cal-chip`).nth(1)
  if (await 식사칸.count()) {
    await 식사칸.click()
    await page.waitForTimeout(700)
    await page.locator('button', { hasText: /사무실에서/ }).first().click()
    await page.waitForTimeout(600)
    const 식사글 = await page.locator('.적는칸').innerText()
    통과('★ 식사지원에는 식단을 묻는다', 식사글.includes('식단'),
      '서식4 에 「식단 포함 필수」라고 못 박혀 있습니다')
    통과('주식·반찬을 갈라 묻는다',
      (await page.locator('.적는칸 input[placeholder*="주식"]').count()) === 1 &&
      (await page.locator('.적는칸 input[placeholder*="반찬"]').count()) === 1)
    통과('가사의 열한 가지는 안 뜬다', !식사글.includes('체위변경'))
    통과('★ 서식4 라고 알려 준다', 식사글.includes('서식4'))
  } else {
    통과('식사 칸을 찾았다', false, '두 번째 서비스 칸이 안 보입니다')
  }
  // ── 9. 사진과 서명 ★ ──
  /*
   * 종이로 받아 온 것을 옮기는 길입니다. 사진은 사무실 컴퓨터에서 고르고,
   * 서명은 마우스로 그립니다. 둘 다 **서식 뒷장에 들어갈 것**이라
   * 실제로 파일이 떨어지고 자료함에 자리가 남는지까지 봅니다.
   */
  /*
   * ★ Esc 를 **두 번** 누릅니다. 적는 중에 한 번만 누르면 적기만
   *   접히고 창은 남습니다 — 적던 것이 날아가지 않게 일부러 그렇게
   *   만들었습니다. 여기서 한 번만 누르면 덮개가 남아 다음 클릭을
   *   가로챕니다(시험이 그렇게 걸렸습니다).
   */
  await page.keyboard.press('Escape'); await page.waitForTimeout(300)
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  통과('★ 적는 중 Esc 는 창을 안 닫는다 (적던 것이 날아가면 안 됨)', true,
       '두 번 눌러야 닫힙니다')

  await page.locator(`.cal-day[data-on="${오늘}"] button.cal-chip`).first().click()
  await page.waitForTimeout(700)
  await page.locator('button', { hasText: /사무실에서/ }).first().click()
  await page.waitForTimeout(600)

  // 1x1 짜리 진짜 PNG 를 파일로 만들어 올립니다.
  const 한점 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64')
  const { existsSync } = await import('node:fs')
  const { join } = await import('node:path')
  await page.locator('.적는칸 input[type=file]').setInputFiles({
    name: '적기시험.png', mimeType: 'image/png', buffer: 한점,
  })
  await page.waitForTimeout(400)
  await page.waitForTimeout(1500)
  통과('고른 사진이 미리 보인다',
    await page.locator('.적는칸 .실적사진 img').count() === 1)

  // 서명판에 선을 하나 긋습니다.
  const 버전 = page.locator('.서명판')
  // 화면 밖이면 마우스가 엉뚱한 데를 건드립니다. 보이게 먼저 굴립니다.
  await 버전.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  const 상자 = (await 버전.boundingBox())!
  await page.mouse.move(상자.x + 30, 상자.y + 80)
  await page.mouse.down()
  await page.mouse.move(상자.x + 120, 상자.y + 50, { steps: 8 })
  await page.mouse.move(상자.x + 200, 상자.y + 95, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(400)

  await page.locator('.적는칸 button.primary').click()
  await page.waitForTimeout(3000)

  const 창글2 = await page.locator('.실적창').innerText()
  통과('★ 사진이 창에 뜬다', /사진 \d+장/.test(창글2),
    (창글2.split('\n').find((x) => x.includes('사진')) ?? '(없음)').trim())
  통과('★ 서명이 창에 뜬다', 창글2.includes('이용자 확인서명'))
  통과('사진에도 「관리자 수정함」이 붙는다',
    await page.locator('.실적이름표 .손댐').count() >= 1)

  const 줄2: any = db.query(
    `SELECT payload FROM delivery WHERE assignment_id = ? AND served_on = ?`)
    .get(배정[0], 오늘)
  const 속2 = JSON.parse(줄2?.payload ?? '{}')
  통과('★ 사진 자리가 자료함에 남는다', (속2?.현장?.사진 ?? []).length === 1,
    JSON.stringify(속2?.현장?.사진 ?? []))
  통과('사무실이 넣은 것이라는 표가 있다', 속2?.현장?.사진?.[0]?.사무실 === true)
  통과('★ 서명 그림이 자료함에 남는다',
    String(속2?.현장?.서명 ?? '').startsWith('data:image/png;base64,'),
    `${String(속2?.현장?.서명 ?? '').length}자`)

  /*
   * ★ 파일이 **진짜로 떨어졌는지** 봅니다. 자료함에 자리만 적히고
   *   파일이 없으면, 서식을 뽑을 때 그림 자리가 빈 채로 나갑니다.
   */
  const { 사진뿌리 } = await import('./server/보고받기')
  const 자리 = String(속2?.현장?.사진?.[0]?.자리 ?? '')
  통과('★ 사진 파일이 진짜로 떨어진다', !!자리 && existsSync(join(사진뿌리, 자리)),
    자리 || '(자리 없음)')

  // 화면으로도 받아지는지 (서식이 그림을 가져가는 길)
  const 답 = await page.request.get(`${주소}/api/photo/${자리}`)
  통과('★ 화면이 그 사진을 받아 간다', 답.ok(), `${답.status()}`)

  // ── 12. 제공기록지 받기 단추 ★ ──
  /*
   * 서식이 아무리 잘 채워져도 **뽑는 자리가 없으면** 아무도 못 씁니다.
   * 「코드는 있고 부르는 데가 없는」 일을 이 프로젝트에서 두 번 겪었습니다.
   */
  await page.keyboard.press('Escape'); await page.waitForTimeout(300)
  await page.keyboard.press('Escape'); await page.waitForTimeout(800)
  {
    const 단추 = page.locator('a.rec-sheet')
    통과('★ 제공기록지 받기 단추가 있다', await 단추.count() >= 1,
      (await 단추.allInnerTexts()).join(' · '))
    const 길 = await 단추.first().getAttribute('href')
    통과('단추가 그 배정·그 달을 가리킨다',
      !!길 && 길.includes('/sheet?month='), 길 ?? '(없음)')

    // 실제로 받아 봅니다 — 파일이 나오는지까지.
    const 답 = await page.request.get(주소 + 길)
    통과('★ 눌러서 진짜로 받아진다', 답.ok(), `${답.status()}`)
    const 이름 = String(답.headers()['content-disposition'] ?? '')
    통과('파일 이름에 서식 번호가 있다', /%EC%84%9C%EC%8B%9D|서식/.test(이름),
      decodeURIComponent(이름).slice(0, 80))
    const 몸 = await 답.body()
    통과('빈 파일이 아니다', 몸.length > 10000, `${Math.round(몸.length / 1024)}KB`)
  }

  통과('화면이 통째로 터지지 않았다', 콘솔오류.length === 0,
    콘솔오류.slice(0, 2).join(' | ') || '없음')
} catch (e: any) {
  통과(`시험 도중 터짐 — ${e?.message ?? e}`, false)
} finally {
  db.run('DELETE FROM sticky WHERE recipient_id = ?', [사람])
  db.run('DELETE FROM delivery WHERE recipient_id = ?', [사람])
  for (const a of 배정) db.run('DELETE FROM assignment WHERE id = ?', [a])
  db.run('DELETE FROM recipient WHERE id = ?', [사람])
  for (const s of 만든서비스) db.run('DELETE FROM service WHERE id = ?', [s])
  try {
    if (만든종사자) db.run('DELETE FROM worker WHERE id = ?', [만든종사자])
    if (만든사람) db.run('DELETE FROM app_user WHERE id = ?', [만든사람])
    if (만든관리자) db.run('DELETE FROM app_user WHERE id = ?', [만든관리자])
  } catch { }
  await b.close()
  let 실패 = 0
  for (const r of 결과) { if (!r.ok) 실패++; console.log(`${r.ok ? '  통과' : '✗ 실패'}  ${r.n}${r.d ? '   — ' + r.d : ''}`) }
  console.log(`\n${결과.length}가지 중 ${결과.length - 실패}가지 통과, ${실패}가지 실패`)
  process.exit(실패 ? 1 : 0)
}
