/**
 * 분을 적는 자리가 **화면에 있는가** — A-1 (7-바).
 *
 * 서버 시험은 셈이 맞는지만 봅니다. 사람이 보는 것은 실적 달력입니다.
 * 시간제 서비스에만 뜨는지, 식사에는 안 뜨는지, 적으면 인정 분이 보이는지.
 */
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import { db, initDb } from './server/db'
import { 시험관리자 } from './도구/시험관리자'
initDb()

/** 이 시험이 쓸 관리자. 끝나면 지웁니다. */
const 관 = await 시험관리자()

const 결과: { n: string; ok: boolean; d?: string }[] = []
const 통과 = (n: string, ok: unknown, d = '') => 결과.push({ n, ok: !!ok, d })
const 주소 = 'http://127.0.0.1:5757'
const 오늘 = new Date().toISOString().slice(0, 10)
const 달 = 오늘.slice(0, 7)

const 사람 = randomUUID()
const 프로필: any = db.query(
  `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`).get()
const 만든것: number[] = []
function 서비스(name: string, unit: string, 단가: number) {
  const i = db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','시험','시험',?,?,?,NULL,'time',NULL,900,1,1)`,
    [프로필.id, `UICONV-${randomUUID().slice(0, 6)}`, name, unit, 단가])
  const id = Number(i.lastInsertRowid); 만든것.push(id); return id
}
const 가사 = 서비스('시험가사(시간)', 'hour', 24000)
const 식사 = 서비스('시험식사(끼)', 'meal', 11000)
const 배정: number[] = []
let 만든사람: number | null = null
let 만든종사자: number | null = null

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 1400, height: 1000 } })
try {
  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: '환산화면시험' }), '해남읍', '이용', '2026-01-01', 'x'])
  /*
   * 배정에는 제공인력이 하나 필요합니다. 시험 마당에 없으면 만들어 씁니다 —
   * 남의 자료를 빌리면 그 사람 화면이 시험 때문에 달라집니다.
   */
  let w: any = db.query(`SELECT id FROM worker ORDER BY id LIMIT 1`).get()
  if (!w) {
    const u = db.run(
      `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload, created_at)
       VALUES ('시험제공인력', ?, 'x', 'worker', '["worker"]', 'active', '{}', 'x')`,
      [`t-${randomUUID().slice(0, 8)}`])
    만든사람 = Number(u.lastInsertRowid)
    const k = db.run(
      `INSERT INTO worker (user_id, hired_on, created_at) VALUES (?, ?, 'x')`,
      [만든사람, `${달}-01`])
    만든종사자 = Number(k.lastInsertRowid)
    w = { id: 만든종사자 }
  }
  for (const svc of [가사, 식사]) {
    const i = db.run(
      `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
       VALUES (?,?,?,?,?,?)`,
      [사람, svc, w.id, JSON.stringify([{ dow: 0 }, { dow: 1 }, { dow: 2 }, { dow: 3 },
        { dow: 4 }, { dow: 5 }, { dow: 6 }]), `${달}-01`, 'x'])
    배정.push(Number(i.lastInsertRowid))
  }
  // 오늘 둘 다 「제공」으로 찍어 둡니다.
  for (const [i, svc] of [가사, 식사].entries())
    db.run(`INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                                  is_holiday,planned,created_at)
            VALUES (?,?,?,?,'제공',0,1,'x')`, [배정[i], 사람, svc, 오늘])

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
  /*
   * ★ 찾기 칸을 **꼭 찾아야** 합니다.
   *
   *   예전에는 `.catch(() => {})` 로 감싸 두었습니다. 그래서 칸을 못 찾으면
   *   **조용히 넘어갔고**, 자료함에 다른 시험이 남긴 대상자가 있으면
   *   그 사람의 줄이 먼저 펼쳐져 시험이 엉뚱한 것을 보고 있었습니다.
   *   못 찾으면 그 자리에서 실패해야 합니다. (2026-09-05 에 고침)
   */
  await page.fill('#r-q', '환산화면시험')
  await page.waitForTimeout(1200)

  const 오늘칸 = page.locator(`[data-on="${오늘}"]`)
  통과('오늘 칸이 보인다', await 오늘칸.count() > 0, 오늘)

  const 분단추 = 오늘칸.locator('button.chip-min')
  const 개수 = await 분단추.count()
  통과('**시간제 서비스에만 「분 적기」가 뜬다** (식사에는 안 뜸)',
    개수 === 1, `${개수}개`)
  통과('아직 안 적었으면 「분 적기」', (await 분단추.first().innerText()).includes('분 적기'),
    (await 분단추.first().innerText()).trim())

  // 40분을 적습니다.
  page.once('dialog', (dlg) => dlg.accept('40'))
  await 분단추.first().click()
  await page.waitForTimeout(2000)

  const 뒤 = (await 오늘칸.locator('button.chip-min').first().innerText()).trim()
  통과('**40분을 적으면 「40분 → 30분」으로 보인다**', 뒤.includes('40분') && 뒤.includes('30분'), 뒤)

  const 값: any = db.query(`SELECT minutes FROM delivery WHERE recipient_id=? AND service_id=?`)
    .get(사람, 가사)
  통과('자료함에도 40 이 들어갔다', Number(값?.minutes) === 40, String(값?.minutes))

  // 10분 — 인정 안 되는 경우가 눈에 띄어야 합니다.
  page.once('dialog', (dlg) => dlg.accept('10'))
  await 오늘칸.locator('button.chip-min').first().click()
  await page.waitForTimeout(2000)
  const 뒤2 = (await 오늘칸.locator('button.chip-min').first().innerText()).trim()
  통과('**15분을 못 넘기면 「인정 안 됨」이라고 말해 준다**', 뒤2.includes('인정 안 됨'), 뒤2)
  통과('그 칸은 눈에 띄게 표시된다',
    (await 오늘칸.locator('button.chip-min').first().getAttribute('class') ?? '').includes('미산정'))

  // 비우면 예전으로 돌아갑니다.
  page.once('dialog', (dlg) => dlg.accept(''))
  await 오늘칸.locator('button.chip-min').first().click()
  await page.waitForTimeout(2000)
  const 값3: any = db.query(`SELECT minutes FROM delivery WHERE recipient_id=? AND service_id=?`)
    .get(사람, 가사)
  통과('**비우면 다시 「한 번 = 한 시간」**', 값3?.minutes == null, String(값3?.minutes))
} catch (e: any) {
  통과(`시험 도중 터짐 — ${e?.message ?? e}`, false)
} finally {
  관.치우기()
  db.run('DELETE FROM delivery WHERE recipient_id = ?', [사람])
  for (const a of 배정) db.run('DELETE FROM assignment WHERE id = ?', [a])
  db.run('DELETE FROM recipient WHERE id = ?', [사람])
  for (const s of 만든것) db.run('DELETE FROM service WHERE id = ?', [s])
  try {
    if (typeof 만든종사자 === 'number' && 만든종사자)
      db.run('DELETE FROM worker WHERE id = ?', [만든종사자])
    if (typeof 만든사람 === 'number' && 만든사람)
      db.run('DELETE FROM app_user WHERE id = ?', [만든사람])
  } catch { }
  await b.close()
  let 실패 = 0
  for (const r of 결과) { if (!r.ok) 실패++; console.log(`${r.ok ? '  통과' : '✗ 실패'}  ${r.n}${r.d ? '   — ' + r.d : ''}`) }
  console.log(`\n${결과.length}가지 중 ${결과.length - 실패}가지 통과, ${실패}가지 실패`)
  process.exit(실패 ? 1 : 0)
}
