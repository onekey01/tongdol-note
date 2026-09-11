/**
 * 한도가 **화면에 실제로 보이는가** — 7-마.
 *
 * 서버 시험은 셈이 맞는지만 봅니다. 사람이 보는 것은 화면입니다.
 * 홈 · 대상자 · 설정 세 곳을 진짜 브라우저로 열어 봅니다.
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

const 사람 = randomUUID()

/*
 * 한도는 **「우리 지자체 규칙」**에 들어 있습니다.
 * 「복지부 지침 표준」은 기준선이라 한도가 0(= 안 봄)입니다 —
 * 150만원은 편람 값이지 지침에 있는 것이 아니기 때문입니다.
 * 그래서 시험은 지자체 규칙으로 바꿔 놓고 봅니다. 끝나면 되돌립니다.
 */
const 원래프로필: any = db.query('SELECT profile_id FROM organization WHERE id = 1').get()
const 우리규칙: any = db.query('SELECT * FROM region_profile WHERE is_builtin = 0 ORDER BY id LIMIT 1').get()
if (!우리규칙) throw new Error('「우리 지자체 규칙」이 없습니다.')
const 원래캡 = { a: 우리규칙.annual_cap, h: 우리규칙.housing_cap }
db.run('UPDATE organization SET profile_id = ? WHERE id = 1', [우리규칙.id])
db.run('UPDATE region_profile SET annual_cap = 1500000, housing_cap = 1000000 WHERE id = ?', [우리규칙.id])

const 프로필: any = 우리규칙
let svc: any = db.query('SELECT id FROM service WHERE profile_id = ? AND outside_annual_cap = 0 ORDER BY id LIMIT 1').get(프로필.id)
if (!svc) {
  const info = db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          sort_order, active, custom)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,0,900,1,1)`,
    [프로필.id, `TESTUI-${randomUUID().slice(0, 6)}`, '시험', '시험', '시험',
     '화면시험서비스', 'time', 24000, null, 'time', null])
  svc = { id: Number(info.lastInsertRowid), 지운다: true }
}

db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
  [사람, JSON.stringify({ name: '한도화면시험', birth: '1937-07-07', address: '전남 해남군 해남읍 1' }),
   '해남읍', '이용', '2026-01-01', '2026-01-01'])
// 연간 한도를 넘기도록 실적을 잔뜩
const 단가 = Number((db.query('SELECT unit_price FROM service WHERE id = ?').get(svc.id) as any).unit_price) || 24000
const 필요 = Math.ceil(1_600_000 / 단가)
for (let i = 0; i < 필요; i++)
  db.run(`INSERT INTO delivery (recipient_id,service_id,served_on,outcome,is_holiday,created_at)
          VALUES (?,?,?,'제공',0,?)`, [사람, svc.id, `2026-0${(i % 9) + 1}-1${i % 9}`, 'x'])

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage()
try {
  await page.goto(주소 + '/', { waitUntil: 'networkidle' })
  // 로그인이 필요하면 넘어갑니다 — 시험 목적은 「보이는가」입니다.
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

  // ── 홈 ────────────────────────────────────────────────────
  await page.goto(주소 + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const 홈글 = await page.locator('body').innerText()
  통과('홈에 **올해 지원한도** 목록이 뜬다',
    홈글.includes('올해 지원한도가 다 되어 가는 대상자'),
    홈글.includes('올해 지원한도') ? '' : 홈글.slice(0, 120).replace(/\n/g, ' '))
  통과('그 사람 이름이 보인다', 홈글.includes('한도화면시험'))
  통과('**넘긴 금액을 사람 말로** 알려 준다', /넘겼습니다/.test(홈글))
  통과('안전생활환경개선은 안 든다고 적혀 있다',
    홈글.includes('안전생활환경개선은 이 숫자에 안 들어갑니다'))

  // ── 대상자 ────────────────────────────────────────────────
  await page.goto(`${주소}/recipients/${사람}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const 대글 = await page.locator('body').innerText()
  통과('대상자 화면에 **남은 한도 한 줄**이 있다', /남은 한도/.test(대글),
    (대글.split('\n').find((x) => x.includes('남은 한도')) ?? '(없음)').trim())
  통과('넘겼으면 넘겼다고 한다', /넘겼습니다/.test(대글))
  통과('한도와 쓴 비율이 함께 보인다', /% 씀/.test(대글))

  // ── 설정 ──────────────────────────────────────────────────
  /*
   * ★ 설정이 세 탭으로 갈렸습니다 (2026-09-07). 「계산 규칙」 탭을 열지 않으면
   *   여기서 보려는 칸이 **화면에 아예 없습니다.**
   */
  await 설정탭열기(page, 주소, '계산 규칙')
  await page.waitForTimeout(1200)
  const 설글 = await page.locator('body').innerText()
  통과('설정에 **1인 연간 지원한도** 칸이 있다', 설글.includes('1인 연간 지원한도'))
  통과('설정에 **안전생활환경 생애한도** 칸이 있다', 설글.includes('안전생활환경 생애한도'))
  통과('**막지 않고 알려만 준다**고 적혀 있다', /막지 않고 알려만 줍니다/.test(설글))
} catch (e: any) {
  통과(`시험 도중 터짐 — ${e?.message ?? e}`, false)
} finally {
  관.치우기()
  db.run('DELETE FROM delivery WHERE recipient_id = ?', [사람])
  db.run('DELETE FROM recipient WHERE id = ?', [사람])
  if (svc?.지운다) db.run('DELETE FROM service WHERE id = ?', [svc.id])
  db.run('UPDATE region_profile SET annual_cap = ?, housing_cap = ? WHERE id = ?',
    [원래캡.a, 원래캡.h, 우리규칙.id])
  db.run('UPDATE organization SET profile_id = ? WHERE id = 1', [원래프로필.profile_id])
  await b.close()
  let 실패 = 0
  for (const r of 결과) { if (!r.ok) 실패++; console.log(`${r.ok ? '  통과' : '✗ 실패'}  ${r.n}${r.d ? '   — ' + r.d : ''}`) }
  console.log(`\n${결과.length}가지 중 ${결과.length - 실패}가지 통과, ${실패}가지 실패`)
  process.exit(실패 ? 1 : 0)
}
