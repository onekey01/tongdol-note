/**
 * 노쇼가 **화면에 보이는가** — A-3 (7-아).
 *
 * 같은 ✕ 인데 노쇼만 돈이 나갑니다(계약서 4조). 그러니
 *   1) 칸 밑에 무엇으로 적었는지 그대로 보이고
 *   2) 노쇼는 **눈에 띄고**
 *   3) 사전취소인데 늦게 알린 것은 **늦었다고 말해 주고**
 *   4) 위 숫자 칸에 「노쇼」가 따로 서고
 *
 *   5) 실제로 눌러 고칠 수 있어야 합니다.
 *
 * **노쇼를 켠 지자체**를 흉내 냅니다 (`noshow_billable = 1`).
 * 기본은 꺼짐이고, 껐을 때 어떻게 되는지는 `대면배달화면시험` 이 봅니다.
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
const 만든서비스: number[] = []
const 배정: number[] = []
let 만든사람: number | null = null
let 만든종사자: number | null = null

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 1500, height: 1100 } })
try {
  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: '노쇼화면' }), '해남읍', '이용', `${달}-01`, 'x'])

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

  const i = db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','시험','시험','시험가사(노쇼)','hour',24000,NULL,'time',NULL,0,0,0,1,900,1,1)`,
    [프로필.id, `UINS-${randomUUID().slice(0, 6)}`])
  const 가사 = Number(i.lastInsertRowid); 만든서비스.push(가사)

  const 모든요일 = JSON.stringify([0, 1, 2, 3, 4, 5, 6].map((dow) => ({ dow })))
  const a = db.run(
    `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
     VALUES (?,?,?,?,?,'x')`, [사람, 가사, w.id, 모든요일, `${달}-01`])
  배정.push(Number(a.lastInsertRowid))

  const 날 = (d: number) => `${달}-${String(d).padStart(2, '0')}`
  const 넣기 = (d: number, 갈래: string | null, 사유: string, 알린날: string | null = null) =>
    db.run(
      `INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                             is_holiday,planned,reason,miss_kind,notified_on,created_at)
       VALUES (?,?,?,?, '미제공',0,1,?,?,?,'x')`,
      [배정[0], 사람, 가사, 날(d), 사유, 갈래, 알린날])

  넣기(1, '노쇼', '부재')
  넣기(2, '사전취소', '입원', 날(1))        // 하루 전 — 안 늦음
  넣기(3, '사전취소', '입원', 날(3))        // 당일  — 늦음
  넣기(4, null, '기타')                     // 갈래 없는 옛 미제공

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
  await page.fill('#r-q', '노쇼화면')
  await page.waitForTimeout(1400)
  await page.screenshot({ path: '/tmp/샷_노쇼.png', fullPage: true })

  const 글 = await page.locator('body').innerText()
  const 갈래칩 = await page.locator('button.chip-kind').allInnerTexts()

  통과('**네 칸 모두 갈래가 보인다**', 갈래칩.length === 4, 갈래칩.join(' | '))
  통과('**노쇼는 「비용 발생」이라고 못박아 말한다**',
    갈래칩.some((x) => x.includes('노쇼') && x.includes('비용')),
    갈래칩.find((x) => x.includes('노쇼')) ?? '(없음)')
  통과('갈래 없는 옛 미제공은 「기타」로 보인다',
    갈래칩.filter((x) => x.trim() === '기타').length === 1)

  const 노쇼칩 = page.locator('button.chip-kind.노쇼')
  통과('**노쇼만 눈에 띈다** (하나)', await 노쇼칩.count() === 1,
    `${await 노쇼칩.count()}개`)

  const 늦음칩 = page.locator('button.chip-kind.늦음')
  통과('**당일에 알린 사전취소는 「늦음」으로 뜬다**', await 늦음칩.count() === 1,
    (await 늦음칩.allInnerTexts()).join(' · ') || '(없음)')
  통과('하루 전에 알린 것은 조용하다 (사전취소 둘 중 하나만 늦음)',
    갈래칩.filter((x) => x.trim() === '사전취소').length === 1)

  통과('**위 숫자 칸에 「노쇼」가 따로 선다**', /노쇼/.test(글))
  const 노쇼칸 = page.locator('.card.노쇼칸')
  통과('노쇼가 있으면 그 칸이 눈에 띈다', await 노쇼칸.count() === 1)
  통과('서비스 줄에도 「노쇼 1」이 적힌다', /노쇼 1/.test(글),
    (글.split('\n').find((x) => x.includes('노쇼 1')) ?? '(없음)').trim())

  // ── 눌러서 고칠 수 있는가 ───────────────────────────────
  page.once('dialog', (dlg) => dlg.accept('기관사정'))
  await 노쇼칩.first().click()
  await page.waitForTimeout(1800)
  const 뒤 = await page.locator('button.chip-kind').allInnerTexts()
  통과('**눌러서 갈래를 고칠 수 있다** — 노쇼가 기관사정으로',
    뒤.filter((x) => x.includes('노쇼')).length === 0 &&
    뒤.filter((x) => x.trim() === '기관사정').length === 1,
    뒤.join(' | '))
  통과('고치고 나면 노쇼 칸도 사라진다', await page.locator('.card.노쇼칸').count() === 0)
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
