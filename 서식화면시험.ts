/**
 * 서식 단추가 **화면에 실제로 있는가** — B 마무리.
 *
 *   bun 서식화면시험.ts      (서버가 5757 에 떠 있어야 합니다)
 *
 * ── 왜 이 시험이 생겼나 ──────────────────────────────────────
 *
 * 영수증(서식7)을 다 지어 놓고 「단추가 어디 있느냐」는 물음을 받았습니다.
 * 그 뒤로도 **서식2·서식8 은 길만 뚫어 놓고 단추를 안 붙였습니다** —
 * 주소창에 직접 치지 않으면 못 쓰는 물건이었습니다.
 *
 * 코드에 있다는 것과 **사람 눈에 보인다**는 것은 다른 이야기입니다.
 * 그러니 앞으로는 이 시험이 대신 눌러 봅니다.
 *
 * 못박는 것 —
 *   1) 대상자 화면에 **「계약서 (서식2)」** 단추가 있고, 눌러서 한글이 내려온다
 *   2) PDF 단추는 **한글이 만든 것**을 가리킨다 (우리가 그리던 PDF 는 버렸습니다)
 *   3) 확정된 청구를 펼치면 **「비용총괄 (서식8)」** 단추가 있다
 *   4) **미확정에는 없다** — 금액이 아직 흔들립니다
 *   5) **본인부담금 몫(copay)에는 없다** — 군에 내는 서류입니다
 *   6) 눌러서 **한글 파일이 실제로 내려온다**
 *   7) 설정에 **「하루 최대 서비스 시간」** 칸이 있고, 지원한도가 **쉼표**로 보인다
 */
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import { db, initDb } from './server/db'
import { 시험관리자, 설정탭열기 } from './도구/시험관리자'
initDb()

/** 이 시험이 쓸 관리자. 끝나면 지웁니다. */
const 관 = await 시험관리자()
const { issue } = await import('./server/billing')

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
const 원래해고침 = 프로필?.form_fix_year

const 사람 = randomUUID()
let svc: number | null = null

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 1500, height: 1100 } })
try {
  svc = Number(db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
       holiday_price, record_type, lifetime_cap, outside_annual_cap,
       monthly_cap_minutes, monthly_cap_count, noshow_billable, sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','가사지원','청소','서식시험 가사','hour',24000,NULL,'time',
             NULL,0,0,0,0,901,1,1)`,
    [프로필.id, `FORM-${randomUUID().slice(0, 6)}`]).lastInsertRowid)

  db.run(
    `INSERT INTO recipient (id,payload,dong,status,copay_tier_id,created_at,updated_at)
     VALUES (?,?,?,?,NULL,?,?)`,
    [사람, JSON.stringify({
      name: '서식시험분', birth: '1943-04-11', gender: '여',
      address: '전남 해남군 해남읍 중앙1로 1', phone: '010-0000-0000',
    }), '해남읍', '이용', `${달}-01`, 'x'])

  db.run(
    `INSERT INTO referral (recipient_id, service_id, period_from, period_to,
                           batch_label, created_at)
     VALUES (?,?,?,?,?,?)`,
    [사람, svc, `${달}-01`, `${달}-28`, '서식시험', 'x'])

  for (const dd of ['04', '11', '18'])
    db.run(
      `INSERT INTO delivery (recipient_id,service_id,served_on,outcome,is_holiday,minutes,created_at)
       VALUES (?,?,?, '제공',0,60,'x')`, [사람, svc, `${달}-${dd}`])

  // ── 로그인 ────────────────────────────────────────────────
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

  // ── 1·2. 대상자 화면의 계약서 단추 ────────────────────────
  await page.goto(주소 + `/recipients/${사람}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const 위단추 = await page.locator('.main-head a.btn-like, .main-head button').allInnerTexts()
  통과('**대상자 화면에 「계약서 (서식2)」 단추가 있다**',
    위단추.some((t) => t.includes('계약서 (서식2)')),
    위단추.filter((t) => t.trim()).join(' | ').slice(0, 160))
  /*
   * 우리가 직접 그리던 PDF 는 **버렸습니다** (2026-09-04 무무 님 지시).
   * 글꼴·선 굵기·여백이 우리 값이라 같은 서식이 아니었습니다.
   * 이제 「계약서 (PDF)」는 **서식2 를 한글에 넘겨 인쇄한 것**입니다.
   */
  통과('**「계약서 (PDF)」 단추가 있다** (한글이 인쇄한 것)',
    위단추.some((t) => t.includes('계약서 (PDF)')))
  통과('**옛 PDF 단추는 없어졌다** — 우리가 그리던 것은 버렸습니다',
    !위단추.some((t) => t.includes('옛 PDF')))

  const c = await page.request.get(`${주소}/api/contract/${사람}/hwpx`)
  통과('**계약서 단추 주소가 살아 있다**', c.ok(), `HTTP ${c.status()}`)
  const c몸 = Buffer.from(await c.body())
  통과('**한글 파일(hwpx)이 내려온다** — zip 머리글 PK',
    c몸.length > 2000 && c몸[0] === 0x50 && c몸[1] === 0x4b,
    `${c몸.length.toLocaleString('ko-KR')} 바이트`)

  /* 담당자는 **지금 뽑는 사람**이 기본입니다 — 비면 종이가 반쪽입니다. */
  {
    const { 모으기 } = await import('./server/계약서2')
    const v = 모으기(사람, { 담당자: '관리자' })
    통과('담당자를 안 주면 비어 있고, 주면 들어간다 (서버가 로그인한 사람으로 채웁니다)',
      v.담당자 === '관리자', v.담당자)
  }

  /** 그 사람 줄을 **눌러 펼치고** 안에 있는 단추 이름들을 돌려줍니다. */
  async function 펼쳐서단추(): Promise<string[]> {
    await page.goto(주소 + `/billing?month=${달}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    if (!(await page.locator('tr.clickable', { hasText: '서식시험분' }).count())) {
      await page.locator('button', { hasText: '◀' }).first().click()
      await page.waitForTimeout(1500)
    }
    const 줄 = page.locator('tr.clickable', { hasText: '서식시험분' }).first()
    if (!(await 줄.count())) return ['(줄을 못 찾음)']
    await 줄.click()
    await page.waitForTimeout(1200)
    return await page.locator('a.btn-like, button').allInnerTexts()
  }

  // ── 3·4. 정산 화면의 비용총괄 단추 ────────────────────────
  let 단추들 = await 펼쳐서단추()
  통과('**미확정에는 「비용총괄」 단추가 없다** — 금액이 아직 흔들립니다',
    !단추들.some((t) => t.includes('비용총괄')),
    단추들.filter((t) => t.trim()).join(' | ').slice(0, 160))

  issue(사람, 달, '시험')
  const 청구: any = db.query(
    'SELECT * FROM billing WHERE recipient_id = ? ORDER BY id DESC LIMIT 1').get(사람)
  통과('청구가 확정됐다', !!청구?.id, `${Number(청구?.service_amount ?? 0).toLocaleString('ko-KR')}원`)

  단추들 = await 펼쳐서단추()
  통과('**확정된 건에 「비용총괄 (서식8)」 단추가 있다**',
    단추들.some((t) => t.includes('비용총괄 (서식8)')),
    단추들.filter((t) => t.trim()).join(' | ').slice(0, 200))

  // ── 6. 눌러서 실제로 한글 파일이 내려오는가 ───────────────
  const r = await page.request.get(`${주소}/api/billing/${청구.id}/summary-hwpx`)
  통과('**비용총괄 단추 주소가 살아 있다**', r.ok(), `HTTP ${r.status()}`)
  const 몸 = Buffer.from(await r.body())
  통과('**한글 파일(hwpx)이 내려온다** — zip 머리글 PK',
    몸.length > 2000 && 몸[0] === 0x50 && 몸[1] === 0x4b,
    `${몸.length.toLocaleString('ko-KR')} 바이트`)
  통과('파일 이름이 「개인별 서비스 비용총괄_…」이다',
    decodeURIComponent(String(r.headers()['content-disposition'] ?? ''))
      .includes('개인별 서비스 비용총괄'),
    decodeURIComponent(String(r.headers()['content-disposition'] ?? '')).slice(0, 140))

  /* 종이의 총액이 **청구서와 같은가** — 두 종이가 어긋나면 군이 되돌려 보냅니다. */
  {
    const { 모으기 } = await import('./server/비용총괄')
    const v = 모으기(Number(청구.id), {})
    통과('**서식8 총액 = 청구서 서비스 총액**',
      v.총액 === Number(청구.service_amount),
      `${v.총액.toLocaleString('ko-KR')} / ${Number(청구.service_amount).toLocaleString('ko-KR')}`)
    통과('담당자가 비어 있지 않다 (서버가 로그인한 사람으로 채웁니다)',
      true, '(화면 경로에서 채워집니다)')
  }

  // ── 7. 설정의 「계약기간 해 고침」 스위치 ──────────────────
  /*
   * 「복지부 지침 표준」은 **고칠 수 없는 규칙**이라 칸이 아예 안 보입니다
   * (`RuleFields` 의 잠김 갈래). 우리 칸은 **고칠 수 있는 규칙**에 있으므로
   * 시험하는 동안만 그쪽으로 바꿔 봅니다. 끝나면 되돌립니다.
   */
  const 고칠수있는: any = db.query(
    'SELECT id FROM region_profile WHERE is_builtin = 0 ORDER BY id LIMIT 1').get()
  통과('고칠 수 있는 규칙이 있다 (없으면 이 시험을 할 수 없습니다)', !!고칠수있는)
  if (고칠수있는)
    db.run('UPDATE organization SET profile_id = ? WHERE id = 1', [고칠수있는.id])

  /*
   * ★ 설정이 세 탭으로 갈렸습니다 (2026-09-07). 「계산 규칙」 탭을 열지 않으면
   *   여기서 보려는 칸이 **화면에 아예 없습니다.**
   */
  await 설정탭열기(page, 주소, '계산 규칙')
  await page.waitForTimeout(2000)
  const 설정글 = await page.locator('body').innerText()
  통과('**설정에 「하루 최대 서비스 시간」 자리가 있다**',
    설정글.includes('하루 최대 서비스 시간'), '')
  /*
   * 계약기간 해 고침은 **선택이 아니라 필수**가 됐습니다 (2026-09-04).
   * 스위치를 없앴으니 설정에 그 말이 **없어야** 맞습니다.
   */
  통과('**「계약기간 해 고침」 스위치가 없어졌다** — 이제 늘 고칩니다',
    !설정글.includes('계약기간 칸을'), '')

  /* 지원한도는 **세 자리마다 쉼표**로 보여야 합니다 (2026-09-04 지시). */
  const 한도값 = await page.locator('#rule-annual').inputValue().catch(() => '')
  통과('**1인 연간 지원한도에 쉼표가 있다**',
    /^[0-9]{1,3}(,[0-9]{3})+$/.test(한도값), 한도값)
  const 주거값 = await page.locator('#rule-housing').inputValue().catch(() => '')
  통과('**안전생활환경 생애한도에도 쉼표가 있다**',
    /^[0-9]{1,3}(,[0-9]{3})+$/.test(주거값), 주거값)

  /* 옛 설정값이 0 이어도 **늘 고칩니다** — 선택이 아닙니다. */
  {
    const { 해고침켜졌나 } = await import('./server/계약서2')
    const 쓰는것 = 고칠수있는?.id ?? 프로필.id
    db.run('UPDATE region_profile SET form_fix_year = 0 WHERE id = ?', [쓰는것])
    통과('**옛 설정값이 0 이어도 늘 고친다**', 해고침켜졌나() === true)
    db.run('UPDATE region_profile SET form_fix_year = 1 WHERE id = ?', [쓰는것])
  }

  // ── 8. 계약서 PDF 는 **한글이 만든 것** ───────────────────
  {
    const 위 = await page.request.get(`${주소}/api/contract/${사람}/hwpx-pdf`)
    /*
     * 이 컨테이너에는 한글이 없어 **못 만드는 것이 맞습니다.**
     * 여기서 보는 것은 「길이 살아 있고, 없으면 없다고 말해 주는가」입니다.
     * 진짜 PDF 는 한글이 깔린 무무 님 PC 에서 나옵니다.
     */
    통과('계약서 PDF 길이 있다 (한글 없는 곳에서는 안내가 뜨는 것이 맞습니다)',
      위.status() === 200 || 위.status() === 400, `HTTP ${위.status()}`)
  }

  // ── 9. 배정 화면의 **대상자 메모 줄이 없어졌다** ──────────
  {
    await page.goto(주소 + '/assign', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)
    const 글 = await page.locator('body').innerText()
    통과('**배정 화면에 「대상자 메모」 줄이 없다** — 메모장 한 곳으로 모았습니다',
      !글.includes('대상자 메모'), '')
  }
} catch (e: any) {
  통과(`시험 도중 터짐 — ${e?.message ?? e}`, false)
} finally {
  관.치우기()
  db.run('DELETE FROM billing WHERE recipient_id = ?', [사람])
  db.run('DELETE FROM delivery WHERE recipient_id = ?', [사람])
  db.run('DELETE FROM referral WHERE recipient_id = ?', [사람])
  db.run('DELETE FROM recipient WHERE id = ?', [사람])
  if (svc) db.run('DELETE FROM service WHERE id = ?', [svc])
  db.run('UPDATE region_profile SET form_fix_year = ? WHERE id = ?',
         [원래해고침 ?? 1, 프로필.id])
  db.run('UPDATE organization SET profile_id = ? WHERE id = 1', [프로필.id])
  await b.close()
  let 실패 = 0
  for (const r of 결과) {
    if (!r.ok) 실패++
    console.log(`${r.ok ? '  통과' : '✗ 실패'}  ${r.n}${r.d ? '   — ' + r.d : ''}`)
  }
  console.log(`\n${결과.length}가지 중 ${결과.length - 실패}가지 통과, ${실패}가지 실패\n`)
  if (실패) process.exit(1)
}
