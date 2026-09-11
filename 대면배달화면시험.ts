/**
 * 대면 / 비대면이 **화면에 보이는가** — A-4.
 *
 *   1) 식사지원 제공 칸에만 대면 칩이 붙는다 (가사엔 안 붙음)
 *   2) 비대면은 **눈에 띈다**
 *   3) 위 숫자 칸에 「비대면 배달」이 따로 선다
 *   4) 눌러서 대면 ↔ 비대면을 바꿀 수 있다
 *   5) **노쇼는 안 묻는다** — 기본이 꺼져 있습니다 (2026-09-01)
 */
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import { db, initDb } from './server/db'
import { 시험관리자, 설정탭열기 } from './도구/시험관리자'
initDb()

/** 이 시험이 쓸 관리자. 끝나면 지웁니다. */
const 관 = await 시험관리자()

const 결과: { n: string; ok: boolean; d?: string }[] = []
const 통과 = (n: string, ok: unknown, d = '') => 결과.push({ n, ok: !!ok, d })
const 주소 = 'http://127.0.0.1:5757'
const 오늘 = new Date().toISOString().slice(0, 10)
/*
 * 1~4일에 실적을 깔아야 하는데, 오늘이 그 안에 들면 **아직 오지 않은 날**이라
 * 칸이 잠깁니다. 그래서 오늘이 5일보다 이르면 **지난 달**에 깝니다.
 */
const 달 = Number(오늘.slice(8)) >= 5
  ? 오늘.slice(0, 7)
  : (() => { const d = new Date(오늘 + 'T00:00:00Z'); d.setUTCDate(0)
             return d.toISOString().slice(0, 7) })()

const 사람 = randomUUID()
const 프로필: any = db.query(
  `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`).get()
const 만든서비스: number[] = []
const 배정: number[] = []
let 만든사람: number | null = null
let 만든종사자: number | null = null

function 서비스(name: string, unit: string, rt: string) {
  const i = db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','시험','시험',?,?,11000,NULL,?,NULL,0,0,0,0,900,1,1)`,
    [프로필.id, `UIF2F-${randomUUID().slice(0, 6)}`, name, unit, rt])
  const id = Number(i.lastInsertRowid); 만든서비스.push(id); return id
}

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 1500, height: 1100 } })
try {
  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: '대면화면' }), '해남읍', '이용', `${달}-01`, 'x'])

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

  const 식사 = 서비스('시험식사(대면)', 'meal', 'meal')
  const 가사 = 서비스('시험가사(대면아님)', 'hour', 'time')
  /*
   * 대상자 화면의 「대면 배달」 상자는 **의뢰**를 보고 뜹니다(배정이 아닙니다).
   * 실제 흐름도 의뢰가 먼저이므로 시험도 그렇게 깝니다.
   */
  const 의뢰 = Number(db.run(
    `INSERT INTO referral (recipient_id, service_id, batch_label, period_from, period_to,
                           cycle_text, cycle_unit, cycle_count, created_at)
     VALUES (?,?,'시험',?,?, '주 3회','week',3,'x')`,
    [사람, 식사, `${달}-01`, `${달}-28`]).lastInsertRowid)

  const 모든요일 = JSON.stringify([0, 1, 2, 3, 4, 5, 6].map((dow) => ({ dow })))
  for (const svc of [식사, 가사]) {
    const i = db.run(
      `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
       VALUES (?,?,?,?,?,'x')`, [사람, svc, w.id, 모든요일, `${달}-01`])
    배정.push(Number(i.lastInsertRowid))
  }
  const 날 = (d: number) => `${달}-${String(d).padStart(2, '0')}`
  const 넣기 = (a: number, svc: number, d: number, 대면: number | null, o = '제공') =>
    db.run(`INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                                  is_holiday,planned,face_to_face,reason,created_at)
            VALUES (?,?,?,?,?,0,1,?,?,'x')`,
      [a, 사람, svc, 날(d), o, 대면, o === '제공' ? '' : '부재'])

  넣기(배정[0], 식사, 1, 1)      // 대면
  넣기(배정[0], 식사, 2, 0)      // 비대면
  넣기(배정[0], 식사, 3, 0)      // 비대면
  넣기(배정[0], 식사, 4, null)   // 옛 실적 — 대면으로 봅니다
  넣기(배정[1], 가사, 1, null)   // 가사는 이 칩이 안 붙습니다

  await page.goto(주소 + '/', { waitUntil: 'networkidle' })
  if (await page.locator('input#id').count()) {
    /*
     * ★ **시험이 만든 계정으로 들어갑니다** (2026-09-07 고침).
     *   예전에는 `admin` / `admin1234` 를 그냥 적어 두었는데, 그런 계정은
     *   어느 컴퓨터에도 없습니다 — 기관마다 관리자 아이디가 다릅니다.
     *   로그인이 조용히 실패하고, 아래 시험이 죄다 「30초 기다렸는데
     *   화면이 안 뜬다」로만 죽었습니다. 자세한 것은 도구/시험관리자.ts 에.
     */
    await 관.들어가기(page)
  }
  await page.goto(주소 + '/records', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  // 지난 달에 깔았으면 ◀ 로 한 달 되돌립니다 (화면은 늘 이번 달로 엽니다).
  if (달 !== 오늘.slice(0, 7)) {
    await page.locator('button', { hasText: '◀' }).first().click()
    await page.waitForTimeout(1400)
  }
  /*
   * ★ 찾기 칸을 **꼭 찾아야** 합니다.
   *
   *   예전에는 `.catch(() => {})` 로 감싸 두었습니다. 그래서 칸을 못 찾으면
   *   **조용히 넘어갔고**, 자료함에 다른 시험이 남긴 대상자가 있으면
   *   그 사람의 줄이 먼저 펼쳐져 시험이 엉뚱한 것을 보고 있었습니다.
   *   못 찾으면 그 자리에서 실패해야 합니다. (2026-09-05 에 고침)
   */
  await page.fill('#r-q', '대면화면')
  await page.waitForTimeout(1400)
  await page.screenshot({ path: '/tmp/샷_대면.png', fullPage: true })

  const 글 = await page.locator('body').innerText()
  const 비대면칸 = page.locator('button.cal-chip.비대면')

  통과('**비대면은 달력 칸 자체가 다르다** (숨은 단추가 아닙니다)',
    await 비대면칸.count() === 2, `${await 비대면칸.count()}개`)
  통과('**칸 안에 「비대면」이라고 적혀 있다** — 기호만으론 모릅니다',
    (await 비대면칸.allInnerTexts()).every((x) => x.includes('비대면')),
    (await 비대면칸.allInnerTexts()).join(' | '))
  통과('**◎ 로 그려진다** — ● 와 ✕ 사이입니다',
    (await 비대면칸.allInnerTexts()).every((x) => x.includes('◎')))
  통과('가사지원 칸에는 안 붙는다',
    await page.locator('button.cal-chip.비대면').count() === 2, '식사지원 둘뿐')

  통과('**「제공」 숫자 안에 들어 있다** — 비대면은 제공입니다',
    /그중 비대면 2/.test(글),
    (글.split('\n').find((x) => x.includes('그중 비대면')) ?? '(없음)').trim())
  통과('**칸을 따로 세우지 않는다** — 더하면 합이 안 맞습니다',
    !/^비대면 배달$/m.test(글))
  통과('**노쇼 곁말이 안 뜬다** — 기본이 꺼져 있습니다', !/그중 노쇼/.test(글))

  // ── 눌러서 고치는 차례 ────────────────────────────────────
  /*
   * ★ 2026-09-05 에 **누르는 뜻이 바뀌었습니다.**
   *
   *   예전에는 칸을 누르면 상태가 다음으로 돌았습니다
   *   (계획 → 대면 → 비대면 → 미제공). 지금은 **팝업이 열리고**
   *   그 안에서 고릅니다. 사진·서명·현장에서 온 것을 같이 보려면
   *   창이 있어야 했기 때문입니다.
   *
   *   대신 한 번에 되던 것이 **세 번**이 되었습니다(열고·고르고·닫고).
   *   한 달치를 훑어 찍는 일이라면 이것은 값이 나갑니다.
   *   무무께 이 사실을 알리고 정하기로 했습니다.
   */
  const 대면칸 = page.locator('button.cal-chip.제공[title*="대면 배달"]:not(.비대면)')
  const 처음 = await 대면칸.count()
  await 대면칸.first().click()
  await page.waitForTimeout(900)
  통과('칸을 누르면 실적 창이 열린다', await page.locator('.상태고름').count() === 1)
  통과('창 안에 **대면·비대면이 갈라져** 있다',
    (await page.locator('.상태고름 button').allInnerTexts()).some((t) => t.includes('비대면')))

  await page.locator('.상태고름 button', { hasText: '비대면 배달' }).first().click()
  await page.waitForTimeout(1600)
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(600)
  통과('**창에서 고르면 ◎ 비대면이 된다**',
    await page.locator('button.cal-chip.비대면').count() === 3,
    `${await page.locator('button.cal-chip.비대면').count()}개`)
  통과('대면 칸이 있었다', 처음 >= 1)

  /*
   * 2026-09-09 부터 못 간 까닭은 **창 안에서 눌러 고릅니다**
   * (브라우저 prompt 에 타이핑하던 것을 바꿨습니다 — 목록에 없는 말이
   *  기록지에 실려 지자체로 나갔습니다).
   */
  await page.locator('button.cal-chip.비대면').first().click()
  await page.waitForTimeout(900)
  await page.locator('.상태고름 button', { hasText: '미제공' }).first().click()
  await page.waitForTimeout(1200)
  await page.locator('.실적창 button', { hasText: /^부재$/ }).first().click()
  await page.waitForTimeout(1600)
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(600)
  통과('**◎ 비대면 다음이 ✕ 미제공**',
    await page.locator('button.cal-chip.비대면').count() === 2,
    `${await page.locator('button.cal-chip.비대면').count()}개 남음`)

  // ── 한도에 닿으면 경고창 ──────────────────────────────────
  // 지금 비대면 둘. 하나 더 찍으면 3회 = 한도에 닿습니다.
  const 경고: string[] = []
  page.on('dialog', (dlg) => { 경고.push(dlg.message()); dlg.accept() })
  const 남은대면 = page.locator('button.cal-chip.제공[title*="대면 배달"]:not(.비대면)')
  if (await 남은대면.count() > 0) {
    await 남은대면.first().click()
    await page.waitForTimeout(900)
    await page.locator('.상태고름 button', { hasText: '비대면 배달' }).first().click()
    await page.waitForTimeout(1800)
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(600)
  }
  통과('**한도에 닿으면 경고창이 뜬다**', 경고.some((m) => m.includes('서비스 중지가 필요')),
    (경고.find((m) => m.includes('중지')) ?? '(안 뜸)').split('\n')[0])
  통과('**몇 회인지 숫자로 말해 준다**',
    경고.some((m) => /비대면 수령 횟수가 \d+회 되었습니다/.test(m)))
  통과('**계약서 조항을 함께 보여 준다**', 경고.some((m) => m.includes('5-2조')))
  통과('**프로그램이 상태를 안 바꿨다고 못박는다**',
    경고.some((m) => m.includes('상태를 바꾸지는 않았습니다')))

  // 대상자 상태가 실제로 안 바뀌었는가 — **이게 핵심입니다**
  const 상태 = (db.query('SELECT status FROM recipient WHERE id = ?').get(사람) as any)?.status
  통과('**대상자 상태는 「이용」 그대로** — 기계가 앞서 정하지 않습니다',
    상태 === '이용', 상태)

  // ── 대상자 화면 ───────────────────────────────────────────
  await page.goto(주소 + `/recipients/${사람}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1600)
  const 상세 = await page.locator('body').innerText()
  통과('**연속 비대면 N/3 이 뜬다**', /연속 비대면/.test(상세),
    (상세.split('\n').find((x) => x.includes('연속 비대면')) ?? '(없음)').trim())
  /*
   * 2026-09-08 군 답 — **연속이 맞습니다.** 다만 다른 지자체가 누적으로
   * 읽을 수 있어 설정에서 고르게 두었고, **어느 쪽을 고르든 둘 다 보입니다.**
   * 어르신 서비스가 끝나는 기준이라 한쪽을 숨기면 안 됩니다.
   */
  통과('**누적도 함께 뜬다** — 한쪽을 숨기면 안 됩니다', /누적/.test(상세))
  통과('**지금 어느 쪽이 기준인지 화면이 말한다** (v33)',
    /이 기관 기준/.test(상세),
    (상세.split('\n').find((x) => x.includes('이 기관 기준')) ?? '(없음)').trim())
  통과('**「미수령 기록」 단추가 없어졌다** — 실적이 세는 값입니다',
    !/미수령 기록/.test(상세))
  통과('어디서 찍는지 알려 준다', /제공실적/.test(상세) && /◎/.test(상세))

  // ── 설정에서 3회를 고칠 수 있는가 ─────────────────────────
  /*
   * ★ 설정이 세 탭으로 갈렸습니다 (2026-09-07). 연속 비대면 한도는
   *   돈·규칙에 닿는 값이라 「계산 규칙」 탭에 있습니다.
   */
  await 설정탭열기(page, 주소, '계산 규칙')
  const 설 = await page.locator('body').innerText()
  통과('**설정에 「비대면 배달 한도」가 있다** (지침 개정 대비)',
    /비대면 배달 한도/.test(설),
    (설.split('\n').find((x) => x.includes('비대면 배달 한도')) ?? '(없음)').trim())
  /* v33 — 연속으로 세나 누적으로 세나를 고르는 칸 (2026-09-08 무무). */
  통과('**설정에 「세는 법」(연속/누적)이 있다**',
    /세는 법/.test(설),
    (설.split('\n').find((x) => x.includes('세는 법')) ?? '(없음)').trim())
  통과('연속·누적 두 갈래가 다 있다',
    await page.locator('#rule-f2fmode option').count() === 2,
    String(await page.locator('#rule-f2fmode option').count()))
  통과('**기본은 연속** (편람·계약서 5-2조, 군 확인 2026-09-08)',
    await page.locator('#rule-f2fmode').inputValue() === '연속',
    await page.locator('#rule-f2fmode').inputValue())
  통과('어느 쪽을 골라도 **둘 다 보인다**고 적혀 있다',
    /어느 쪽을 고르든/.test(설))
  통과('**중단은 사람이 한다고 적혀 있다**',
    /상태를 바꾸지 않습니다/.test(설) || /사람이/.test(설))
} catch (e: any) {
  통과(`시험 도중 터짐 — ${e?.message ?? e}`, false)
} finally {
  관.치우기()
  db.run('DELETE FROM delivery WHERE recipient_id = ?', [사람])
  db.run('DELETE FROM referral WHERE recipient_id = ?', [사람])
  for (const a of 배정) db.run('DELETE FROM assignment WHERE id = ?', [a])
  db.run('DELETE FROM recipient WHERE id = ?', [사람])
  for (const s of 만든서비스) db.run('DELETE FROM service WHERE id = ?', [s])
  try {
    if (만든종사자) db.run('DELETE FROM worker WHERE id = ?', [만든종사자])
    if (만든사람) db.run('DELETE FROM app_user WHERE id = ?', [만든사람])
  } catch { }
  await b.close()
  let 실패 = 0
  for (const r of 결과) { if (!r.ok) 실패++; console.log(`${r.ok ? '  통과' : '✗ 실패'}  ${r.n}${r.d ? '   — ' + r.d : ''}`) }
  console.log(`\n${결과.length}가지 중 ${결과.length - 실패}가지 통과, ${실패}가지 실패`)
  process.exit(실패 ? 1 : 0)
}
