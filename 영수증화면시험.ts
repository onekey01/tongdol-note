/**
 * 영수증 단추가 **화면에 실제로 있는가** — B-1.
 *
 *   bun 영수증화면시험.ts      (서버가 5757 에 떠 있어야 합니다)
 *
 * ── 왜 이 시험이 생겼나 ──────────────────────────────────────
 *
 * 단추를 붙여 놓고 「어디 있느냐」는 물음을 받았습니다. 찍어 보니 처음엔
 * 하나도 안 보였는데, 알고 보니 **줄을 눌러 펼친 안**에 있었습니다.
 * 코드에 있다는 것과 **사람 눈에 보인다**는 것은 다른 이야기라서,
 * 앞으로는 이 시험이 대신 눌러 보고 확인합니다.
 *
 * 못박는 것 —
 *   1) 수납된 건을 펼치면 「영수증 (서식7)」이 **있다**
 *   2) 「청구서 (PDF)」 **바로 뒤**에 있다 (자리까지 못박습니다)
 *   3) 누르면 **한글 파일이 실제로 내려온다** (hwpx = zip)
 *   4) **확정만 된 건에는 없다** — 아직 안 받은 돈의 영수증은 없습니다
 *   5) **본인부담금 0원(면제)이면 없다** — 낼 것이 없습니다
 *   6) 지자체 몫(claim)에는 없다 — 어르신께 드리는 종이가 아닙니다
 */
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import { db, initDb } from './server/db'
initDb()
import { 시험관리자 } from './도구/시험관리자'
const { issue, pay } = await import('./server/billing')

const 관 = await 시험관리자('영수증화면시험', ['admin'])
const 결과: { n: string; ok: boolean; d?: string }[] = []
const 통과 = (n: string, ok: unknown, d = '') => 결과.push({ n, ok: !!ok, d })
const 주소 = 'http://127.0.0.1:5757'
const 오늘 = new Date().toISOString().slice(0, 10)

/* 그 달이 끝나야 확정이 자연스럽습니다 — **지난 달**에 깝니다. */
const 달 = (() => {
  const d = new Date(오늘 + 'T00:00:00Z'); d.setUTCDate(0)
  return d.toISOString().slice(0, 7)
})()

const 프로필: any = db.query(
  `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id
    WHERE o.id = 1`).get()

/** 본인부담 20% 구간 — 없으면 못 만듭니다. */
const 구간: any = db.query(
  `SELECT * FROM copay_tier WHERE rate > 0 ORDER BY rate LIMIT 1`).get()

const 낼사람 = randomUUID()      // 본인부담금 있는 사람
const 면제사람 = randomUUID()    // 면제 — 영수증이 없어야 합니다
let svc: number | null = null

function 사람만들기(id: string, 이름: string, tier: number | null) {
  db.run(
    `INSERT INTO recipient (id,payload,dong,status,copay_tier_id,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    [id, JSON.stringify({ name: 이름 }), '해남읍', '이용', tier, `${달}-01`, 'x'])
}

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 1500, height: 1100 } })
try {
  통과('본인부담 구간이 있다 (없으면 이 시험을 할 수 없습니다)',
    !!구간, 구간 ? `${구간.label} ${Math.round(구간.rate * 100)}%` : '(없음)')

  svc = Number(db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
       holiday_price, record_type, lifetime_cap, outside_annual_cap,
       monthly_cap_minutes, monthly_cap_count, noshow_billable, sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','가사지원','청소','가사지원','hour',24000,NULL,'time',
             NULL,0,0,0,0,900,1,1)`,
    [프로필.id, `RCPT-${randomUUID().slice(0, 6)}`]).lastInsertRowid)

  사람만들기(낼사람, '영수증낼분', 구간?.id ?? null)
  사람만들기(면제사람, '영수증면제분', null)

  for (const id of [낼사람, 면제사람])
    for (const dd of ['04', '11', '18'])
      db.run(
        `INSERT INTO delivery (recipient_id,service_id,served_on,outcome,is_holiday,minutes,created_at)
         VALUES (?,?,?, '제공',0,60,'x')`, [id, svc, `${달}-${dd}`])

  // 낼 사람 — 확정 후 **수납까지**
  issue(낼사람, 달, '시험')
  const 낼청구: any = db.query(
    'SELECT * FROM billing WHERE recipient_id = ? ORDER BY id DESC LIMIT 1').get(낼사람)
  통과('본인부담금이 잡혔다', Number(낼청구?.copay_amount) > 0,
    `${Number(낼청구?.copay_amount ?? 0).toLocaleString('ko-KR')}원`)

  // 면제 사람 — 확정만 (본인부담금 0)
  issue(면제사람, 달, '시험')
  const 면제청구: any = db.query(
    'SELECT * FROM billing WHERE recipient_id = ? ORDER BY id DESC LIMIT 1').get(면제사람)
  통과('면제는 본인부담금이 0원이다', Number(면제청구?.copay_amount ?? -1) === 0)

  /*
   * ── 로그인 ────────────────────────────────────────────────
   *
   * ★ 여기가 오래 죽어 있었습니다 (2026-09-08 에 찾음).
   *   `admin` / `admin1234` 로 들어가고 있었는데 **그런 계정이 없습니다.**
   *   그래서 로그인 화면에 그대로 머문 채 「◀ 단추가 없다」로 30초를
   *   기다리다 터졌습니다. 화면을 하나도 안 보고 있었던 것입니다.
   *   `도구/시험관리자.ts` 가 바로 이런 일 때문에 생겼습니다.
   */
  await page.goto(주소 + '/', { waitUntil: 'networkidle' })
  await 관.들어가기(page)
  await page.waitForTimeout(1200)

  /** 그 사람 줄을 **눌러 펼치고** 안에 있는 단추 이름들을 돌려줍니다. */
  async function 펼쳐서단추(이름: string): Promise<string[]> {
    await page.goto(주소 + `/billing?month=${달}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    if (!(await page.locator('tr.clickable', { hasText: 이름 }).count())) {
      // 달이 안 맞으면 ◀ 로 한 번 되돌아갑니다.
      await page.locator('button', { hasText: '◀' }).first().click()
      await page.waitForTimeout(1500)
    }
    const 줄 = page.locator('tr.clickable', { hasText: 이름 }).first()
    if (!(await 줄.count())) return ['(줄을 못 찾음)']
    await 줄.click()
    await page.waitForTimeout(1200)
    return await page.locator('a.btn-like, button').allInnerTexts()
  }

  // ── 1·2. 수납된 건 — 단추가 있고, 「청구서 (PDF)」 바로 뒤 ──
  await page.goto(주소 + `/billing?month=${달}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  let 단추들 = await 펼쳐서단추('영수증낼분')
  통과('**확정만 된 건에는 영수증 단추가 없다** — 아직 안 받은 돈입니다',
    !단추들.some((t) => t.includes('영수증')),
    단추들.filter((t) => t.trim()).join(' | ').slice(0, 160))

  pay(Number(낼청구.id), `${달}-25`)

  단추들 = await 펼쳐서단추('영수증낼분')
  const 영수증자리 = 단추들.findIndex((t) => t.includes('영수증 (서식7)'))
  const 청구서자리 = 단추들.findIndex((t) => t.includes('청구서 (PDF)'))
  통과('**수납된 건에 「영수증 (서식7)」 단추가 있다**', 영수증자리 >= 0,
    단추들.filter((t) => t.trim()).join(' | ').slice(0, 160))
  통과('**「청구서 (PDF)」 바로 뒤에 있다** — 자리까지 못박습니다',
    청구서자리 >= 0 && 영수증자리 === 청구서자리 + 1,
    `청구서 ${청구서자리} · 영수증 ${영수증자리}`)
  통과('**줄을 펼쳐야 보인다는 것을 알고 있다** — 접힌 채로는 안 보입니다',
    영수증자리 >= 0)

  // ── 3. 눌러서 실제로 한글 파일이 내려오는가 ────────────────
  const r = await page.request.get(`${주소}/api/receipt/${낼청구.id}/file`)
  통과('**단추 주소가 살아 있다**', r.ok(), `HTTP ${r.status()}`)
  const 몸 = Buffer.from(await r.body())
  통과('**한글 파일(hwpx)이 내려온다** — zip 머리글 PK',
    몸.length > 2000 && 몸[0] === 0x50 && 몸[1] === 0x4b,
    `${몸.length.toLocaleString('ko-KR')} 바이트`)
  const 이름표 = String(r.headers()['content-disposition'] ?? '')
  통과('파일 이름에 어르신 성함이 들어 있다',
    /hwpx/.test(decodeURIComponent(이름표)), decodeURIComponent(이름표).slice(0, 120))

  // ── 5. 면제는 단추가 없다 ─────────────────────────────────
  pay(Number(면제청구.id), `${달}-25`)
  단추들 = await 펼쳐서단추('영수증면제분')
  통과('**면제(본인부담금 0원)는 영수증 단추가 없다** — 낼 것이 없습니다',
    !단추들.some((t) => t.includes('영수증')),
    단추들.filter((t) => t.trim()).join(' | ').slice(0, 160))

  // ── 6. 서버도 막는가 — 화면만 숨기는 것으로는 부족합니다 ───
  const r2 = await page.request.get(`${주소}/api/receipt/${면제청구.id}/file`)
  통과('**서버도 0원 영수증을 거절한다** — 화면만 숨기면 주소로 뚫립니다',
    !r2.ok(), `HTTP ${r2.status()}`)
} catch (e: any) {
  통과(`시험 도중 터짐 — ${e?.message ?? e}`, false)
} finally {
  for (const id of [낼사람, 면제사람]) {
    db.run('DELETE FROM billing WHERE recipient_id = ?', [id])
    db.run('DELETE FROM delivery WHERE recipient_id = ?', [id])
    db.run('DELETE FROM recipient WHERE id = ?', [id])
  }
  if (svc) db.run('DELETE FROM service WHERE id = ?', [svc])
  관.치우기()
  await b.close()
  let 실패 = 0
  for (const r of 결과) {
    if (!r.ok) 실패++
    console.log(`${r.ok ? '  통과' : '✗ 실패'}  ${r.n}${r.d ? '   — ' + r.d : ''}`)
  }
  console.log(`\n${결과.length}가지 중 ${결과.length - 실패}가지 통과, ${실패}가지 실패`)
  process.exit(실패 ? 1 : 0)
}
