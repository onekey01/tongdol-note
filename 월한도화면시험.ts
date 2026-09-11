/**
 * 월 한도가 **화면에 보이는가** — A-2 (7-사).
 *
 * 실적 달력 줄에 「이 달 3시간/12시간」이 뜨는지, 넘으면 눈에 띄는지,
 * 동행지원처럼 **둘 다 걸리는** 것이 둘 다 보이는지.
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
const 달 = 오늘.slice(0, 7)

const 사람 = randomUUID()
const 프로필: any = db.query(
  `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`).get()
const 만든서비스: number[] = []
const 배정: number[] = []
let 만든사람: number | null = null
let 만든종사자: number | null = null

function 서비스(name: string, unit: string, 분: number, 회: number) {
  const i = db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','시험','시험',?,?,24000,NULL,'time',NULL,0,?,?,900,1,1)`,
    [프로필.id, `UIMC-${randomUUID().slice(0, 6)}`, name, unit, 분, 회])
  const id = Number(i.lastInsertRowid); 만든서비스.push(id); return id
}

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 1500, height: 1000 } })
try {
  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: '월한도화면' }), '해남읍', '이용', `${달}-01`, 'x'])
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

  const 가사 = 서비스('시험가사(월12시간)', 'hour', 720, 0)
  const 동행 = 서비스('시험동행(6시간·2회)', 'hour', 360, 2)
  const 모든요일 = JSON.stringify([0,1,2,3,4,5,6].map((dow) => ({ dow })))
  for (const svc of [가사, 동행]) {
    const i = db.run(
      `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
       VALUES (?,?,?,?,?,'x')`, [사람, svc, w.id, 모든요일, `${달}-01`])
    배정.push(Number(i.lastInsertRowid))
  }
  const 날 = (d: number) => `${달}-${String(d).padStart(2, '0')}`
  // 가사 3시간 (한도 안), 동행 3회 (한도 2회 초과 · 시간은 3시간뿐)
  for (const [i, d] of [1, 2, 3].entries())
    db.run(`INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                                  is_holiday,planned,minutes,created_at)
            VALUES (?,?,?,?,'제공',0,1,60,'x')`, [배정[0], 사람, 가사, 날(d)])
  for (const d of [1, 2, 3])
    db.run(`INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                                  is_holiday,planned,minutes,created_at)
            VALUES (?,?,?,?,'제공',0,1,60,'x')`, [배정[1], 사람, 동행, 날(d)])

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
  await page.fill('#r-q', '월한도화면')
  await page.waitForTimeout(1400)

  const 글 = await page.locator('body').innerText()
  통과('**「이 달 3시간/12시간」이 보인다**', /이 달 3시간\/12시간/.test(글),
    (글.split('\n').find((x) => x.includes('이 달')) ?? '(없음)').trim())
  통과('**동행지원은 시간과 횟수 둘 다 보인다**', /3시간\/6시간 · 3\/2회/.test(글),
    (글.split('\n').find((x) => x.includes('/2회')) ?? '(없음)').trim())
  통과('넘긴 것은 「넘음」이라고 말해 준다', /넘음/.test(글))

  const 넘은칸 = page.locator('.rec-cap.over')
  통과('**넘긴 줄만 눈에 띈다** (가사는 안 넘었으므로 하나)',
    await 넘은칸.count() === 1, `${await 넘은칸.count()}개`)
  const 밑줄 = await page.locator('.rec-cap.over .over').allInnerTexts()
  통과('**무엇 때문에 넘었는지 갈라 보인다** — 횟수 쪽만',
    밑줄.length === 1 && 밑줄[0].includes('회'), 밑줄.join(' · ') || '(없음)')

  // 설정에도 보이는가
  /*
   * ★ 설정이 세 탭으로 갈렸습니다 (2026-09-07). 「계산 규칙」 탭을 열지 않으면
   *   여기서 보려는 칸이 **화면에 아예 없습니다.**
   */
  await 설정탭열기(page, 주소, '계산 규칙')
  await page.waitForTimeout(1500)
  const 설 = await page.locator('body').innerText()
  await page.screenshot({ path: "/tmp/샷_설정서비스.png", fullPage: true })
  통과('설정 서비스 표에 **월 한도** 칸이 있다', 설.includes('월 한도'))
  통과('편람 값이 보인다 — 12시간', /12시간/.test(설))
} catch (e: any) {
  통과(`시험 도중 터짐 — ${e?.message ?? e}`, false)
} finally {
  관.치우기()
  db.run('DELETE FROM delivery WHERE recipient_id = ?', [사람])
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
