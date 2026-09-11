/**
 * 파일럿 예행 — **수행기관 관리자가 되어 첫날을 처음부터 끝까지 걸어 봅니다.**
 *
 *   bun 파일럿예행.ts
 *
 * ── 이 시험이 다른 시험과 다른 점 ──────────────────────────
 *
 * 다른 시험들은 「이 규칙이 맞나」를 봅니다. 이건 **「사람이 갈 수
 * 있나」**를 봅니다. 프로그램은 도는데 관리자가 다음 단추를 못 찾으면
 * 파일럿은 그 자리에서 끝납니다. 그래서 여기서는
 *
 *   ✗  막힌 것          — 고치지 않으면 못 넘어갑니다
 *   △  헤맬 자리        — 넘어는 가는데 **길이 안 보입니다**
 *
 * 두 갈래로 나눠 셉니다. △ 가 더 무섭습니다.
 *
 * ── 설명서를 안 읽습니다 ───────────────────────────────────
 *
 * 화면에 적힌 것만 보고 갑니다. 「사용설명서에 있으니 됐다」는
 * 파일럿에서 안 통합니다 — 아무도 안 읽습니다.
 *
 * ── 빈 자료함에서 합니다 ───────────────────────────────────
 *
 * 개발용 자료함에는 이미 기관도 종사자도 있습니다. 수행기관이 받는
 * 것은 **아무것도 없는 자료함**입니다. 거기서 시작해야 첫날이 보입니다.
 */
import { chromium } from 'playwright'
import { 빈자료함띄우기 } from './도구/빈자료함'
import { mkdirSync } from 'node:fs'

// ── 셈 ─────────────────────────────────────────────────────
let 됨 = 0
const 막힌것: string[] = []
const 헤맬자리: string[] = []

function 통과(무엇: string, 참: unknown, 덧말 = '') {
  if (참) { 됨++; console.log(`  ✓  ${무엇}${덧말 ? '   — ' + 덧말 : ''}`) }
  else { 막힌것.push(무엇 + (덧말 ? ' — ' + 덧말 : '')); console.log(`✗  ${무엇}${덧말 ? '   — ' + 덧말 : ''}`) }
}
/** 막히진 않는데 관리자가 헤맬 자리. */
function 짚기(무엇: string, 괜찮나: unknown, 덧말 = '') {
  if (괜찮나) { 됨++; console.log(`  ✓  ${무엇}`) }
  else { 헤맬자리.push(무엇 + (덧말 ? ' — ' + 덧말 : '')); console.log(`△  ${무엇}${덧말 ? '   — ' + 덧말 : ''}`) }
}

/** 이 파일이 있는 폴더 — 시험용 엑셀을 절대 경로로 가리키려고 씁니다. */
const 뿌리 = import.meta.dir

const 찍는곳 = '/tmp/예행사진'
mkdirSync(찍는곳, { recursive: true })
let 사진번호 = 0

const 집 = await 빈자료함띄우기()
const 터 = 집.주소
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 1500, height: 1300 } })

const 화면오류: string[] = []
page.on('pageerror', (e) => 화면오류.push(String(e)))

const 글 = () => page.locator('body').innerText()
const 찍기 = async (이름: string) => {
  사진번호++
  await page.screenshot({ path: `${찍는곳}/${String(사진번호).padStart(2, '0')}-${이름}.png`, fullPage: true })
}
/** 창(alert/confirm)이 뜨면 무엇이라 했는지 적어 두고 「예」를 누릅니다. */
const 창말: string[] = []
page.on('dialog', async (d) => { 창말.push(d.message()); await d.accept().catch(() => {}) })

/**
 * 파일 고르개에 파일을 넣습니다.
 *
 * ★ 경로만 주면 **아무 일도 안 일어납니다.** 브라우저가 딴 사람 권한으로
 *   돌아 그 파일을 못 읽는데도 조용히 0개로 넘어갑니다(2026-09-10 에
 *   여기서 30초를 버렸습니다). 그래서 **속을 읽어서** 넣습니다.
 */
async function 파일넣기(page: any, 고르개: string, 길: string, 이름?: string) {
  const 속 = await Bun.file(길).arrayBuffer()
  await page.locator(고르개).setInputFiles({
    name: 이름 ?? 길.split('/').pop()!,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(속),
  })
}

const 오늘 = new Date()
const 이달 = `${오늘.getFullYear()}-${String(오늘.getMonth() + 1).padStart(2, '0')}`
const 이달1일 = `${이달}-01`
const 올해말 = `${오늘.getFullYear()}-12-31`

try {
  // ── 1. 프로그램을 처음 켭니다 ─────────────────────────────
  console.log('\n━━ 1. 처음 켭니다 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await page.goto(터 + '/'); await page.waitForTimeout(1200)
  const 첫화면 = await 글()
  통과('첫 화면이 뜬다', 첫화면.length > 0)
  통과('무엇을 하라는지 적혀 있다', /기관을 개설합니다/.test(첫화면))
  짚기('첫 화면에 「이거 하나만 하면 됩니다」가 보인다',
    /개설|시작/.test(첫화면.split('\n').slice(0, 6).join(' ')),
    첫화면.split('\n').filter((x) => x.trim()).slice(0, 3).join(' / '))
  await 찍기('첫화면')

  await page.locator('#orgName').fill('해남돌봄복지관')
  await page.locator('#phone').fill('061-530-0000')
  for (const [칸, 값] of [['adminName', '박병섭'], ['loginId', 'haenam'],
                          ['password', 'haenam1234'], ['password2', 'haenam1234']] as const) {
    const x = page.locator(`#${칸}`)
    if (await x.count()) await x.fill(값)
  }
  await page.locator('button[type=submit], button.primary').first().click()
  await page.waitForTimeout(2500)

  // ── 2. 최초 설정 마법사 ───────────────────────────────────
  console.log('\n━━ 2. 최초 설정 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  const 마법 = await 글()
  통과('개설하자마자 최초 설정이 뜬다', /이 값들이 맞는지만 봐 주세요/.test(마법))
  짚기('얼마나 걸리는지 알려 준다', /1분|분이면/.test(마법))
  await 찍기('마법사')

  // 우리 군은 편람과 같다고 보고 그대로 마칩니다 (관리자가 하는 일).
  await page.locator('button.primary').first().click()
  await page.waitForTimeout(2500)
  const 홈 = await 글()
  통과('마치면 홈이 열린다', !/이 값들이 맞는지만 봐 주세요/.test(홈))
  await 찍기('홈')

  // ── 3. 설정에 정말 들어갔나 ──────────────────────────────
  console.log('\n━━ 3. 설정에 정말 들어갔나 ━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await page.goto(터 + '/settings'); await page.waitForTimeout(1500)
  const 설정첫 = await 글()
  // 설정은 일반 / 기관 정보 / 계산 규칙 세 탭입니다. 한도·단가는 계산 규칙에 있습니다.
  짚기('단가·한도가 어느 탭에 있는지 이름으로 짐작된다', /계산 규칙/.test(설정첫))
  await page.locator('button, a', { hasText: '계산 규칙' }).first().click()
  await page.waitForTimeout(1500)
  const 설정 = await 글()
  // 숫자는 입력칸 **안**에 들어 있어 글자만 훑으면 안 보입니다.
  // 숫자 칸은 「1,500,000」처럼 쉼표를 넣어 보여 줍니다.
  const 칸값 = await page.locator('input').evaluateAll(
    (칸들) => 칸들.map((x: any) => String(x.value).replace(/,/g, '')))
  통과('연간 한도 150만이 설정에 들어가 있다',
    칸값.includes('1500000') || /1,?500,?000/.test(설정), 칸값.slice(0, 8).join(' · '))
  통과('식사 단가 11,000이 설정에 들어가 있다',
    칸값.includes('11000') || /11,?000/.test(설정))
  await 찍기('설정-계산규칙')

  // ── 4. 종사자 한 명 넣기 ─────────────────────────────────
  console.log('\n━━ 4. 제공인력 한 명 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await page.goto(터 + '/staff'); await page.waitForTimeout(1200)
  const 종사자빈 = await 글()
  짚기('종사자가 없을 때 무엇을 하라는지 보인다',
    /등록|추가|없습니다/.test(종사자빈), 종사자빈.slice(0, 120).replace(/\n/g, ' '))
  const 등록단추 = page.locator('button', { hasText: /종사자 등록|직접 추가|\+ /}).first()
  통과('종사자 넣는 단추가 있다', await 등록단추.count() > 0)
  if (await 등록단추.count()) { await 등록단추.click(); await page.waitForTimeout(1500) }

  await page.locator('#s-name').fill('최돌봄')
  const 전화 = page.locator('#s-phone'); if (await 전화.count()) await 전화.fill('010-1111-2222')
  const 입사 = page.locator('#s-hired'); if (await 입사.count()) await 입사.fill(이달1일)
  await 찍기('종사자넣기')

  /*
   * ★ 여기서 한 번 일부러 틀립니다 ★
   * 이름만 적고 「등록」을 누릅니다. 아이디·비밀번호가 **꼭 있어야 하는
   * 칸**이면, 관리자는 눌렀는데 아무 일도 안 일어난 것처럼 느낍니다.
   * 무엇이 모자라다고 **말해 주는지**를 봅니다.
   */
  await page.locator('button', { hasText: /^등록$/ }).first().click()
  await page.waitForTimeout(1200)
  const 안채우고 = await 글()
  const 아직등록화면 = /종사자 등록/.test(안채우고)
  짚기('이름만 적고 눌렀을 때 무엇이 모자란지 화면에 말해 준다',
    !아직등록화면 || /적어|필요|모자|비어/.test(안채우고),
    아직등록화면 ? '등록 화면에 그대로 머무는데 화면에 뜬 말이 없습니다 (브라우저 말풍선뿐)' : '')

  const 아이디 = page.locator('#s-login')
  if (await 아이디.count()) {
    await 아이디.fill('choi')
    await page.locator('#s-pw').fill('choi1234')
    await page.locator('button', { hasText: /^등록$/ }).first().click()
    await page.waitForTimeout(2200)
  }
  await page.goto(터 + '/staff'); await page.waitForTimeout(1500)
  통과('넣은 종사자가 목록에 보인다', /최돌봄/.test(await 글()))
  await 찍기('종사자목록')

  // ── 5. 대상자 직접 추가 ──────────────────────────────────
  console.log('\n━━ 5. 대상자 한 분 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await page.goto(터 + '/recipients'); await page.waitForTimeout(1200)
  const 대상빈 = await 글()
  짚기('대상자가 없을 때 어디로 가라는지 적혀 있다',
    /의뢰 접수|직접 추가/.test(대상빈), 대상빈.slice(0, 160).replace(/\n/g, ' '))
  await page.locator('button', { hasText: /직접 추가/ }).first().click()
  await page.waitForTimeout(900)
  await page.locator('#r-name').fill('김순자')
  const 동 = page.locator('#r-dong'); if (await 동.count()) await 동.fill('해남읍')
  const 생 = page.locator('#r-birth'); if (await 생.count()) await 생.fill('1940-03-03')
  await 찍기('대상자넣기')
  await page.locator('.modal button.primary').first().click()
  await page.waitForTimeout(2000)
  await page.goto(터 + '/recipients'); await page.waitForTimeout(1200)
  통과('넣은 대상자가 목록에 보인다', /김순자/.test(await 글()))

  // ── 6. ★ 여기서 첫날이 갈립니다 ★ ────────────────────────
  console.log('\n━━ 6. ★ 배정 화면에 안 뜬다 — 길이 보이나 ★ ━━━━━━━━━\n')
  await page.goto(터 + '/assign'); await page.waitForTimeout(1500)
  const 배정빈 = await 글()
  통과('배정 화면이 열린다', !/오류|Error/.test(배정빈.slice(0, 80)))
  짚기('★ 「서비스가 없어 안 나온다」고 알려 준다',
    /받는 서비스가 아직 없는 대상자/.test(배정빈),
    배정빈.slice(0, 200).replace(/\n/g, ' '))
  짚기('★ 어디로 가서 무엇을 하라는지 적혀 있다',
    /서비스 추가|서비스 넣기/.test(배정빈))
  await 찍기('배정빈')

  // ── 7. 받는 서비스 넣기 ──────────────────────────────────
  console.log('\n━━ 7. 받는 서비스 넣기 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await page.goto(터 + '/recipients'); await page.waitForTimeout(1200)
  await page.locator('tr.clickable', { hasText: '김순자' }).first().click()
  await page.waitForTimeout(1800)
  const 상세 = await 글()
  짚기('대상자 상세에 「서비스 넣기」가 보인다', /서비스 넣기/.test(상세))
  await page.locator('button', { hasText: '서비스 넣기' }).first().click()
  await page.waitForTimeout(1200)
  const 고를것 = page.locator('#ns-service')
  통과('서비스를 고를 수 있다', await 고를것.count() > 0)
  const 것들 = await 고를것.locator('option').allInnerTexts()
  짚기('고를 서비스에 단가가 같이 보인다', 것들.some((x) => /원/.test(x)), 것들.slice(0, 4).join(' | '))
  const 가사 = 것들.find((x) => /가사/.test(x))
  await 고를것.selectOption({ label: 가사 ?? 것들[1] })
  await page.locator('#ns-from').fill(이달1일)
  await page.locator('#ns-to').fill(올해말)
  await page.locator('#ns-unit').selectOption('week')
  await page.locator('#ns-count').fill('2')
  await 찍기('서비스넣기')
  await page.locator('.modal button.primary, button.primary', { hasText: /넣기/ }).first().click()
  await page.waitForTimeout(2000)
  통과('받는 서비스가 붙었다', /가사/.test(await 글()))

  // ── 8. 이제 배정에 뜨나 ──────────────────────────────────
  console.log('\n━━ 8. 이제 배정에 뜨나 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await page.goto(터 + '/assign'); await page.waitForTimeout(1800)
  const 배정 = await 글()
  통과('★ 아까 넣은 대상자가 배정 화면에 보인다', /김순자/.test(배정))
  짚기('무엇이 밀려 있는지 위에 적혀 있다', /기다리고 있습니다|미배정/.test(배정))
  await 찍기('배정목록')

  // ── 9. 담당·요일 붙이기 ─────────────────────────────────
  console.log('\n━━ 9. 담당과 요일 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await page.locator('tr', { hasText: '김순자' }).first().click()
  await page.waitForTimeout(1600)
  const 배정창 = await 글()
  통과('배정 창이 열린다', /가는 요일/.test(배정창))
  짚기('의뢰가 「주 2회」라는 것이 창 안에 보인다', /주 2회/.test(배정창))

  const 담당 = page.locator('select').filter({ has: page.locator('option', { hasText: '최돌봄' }) }).first()
  통과('담당을 고를 수 있다', await 담당.count() > 0)
  if (await 담당.count()) {
    const 있는것 = await 담당.locator('option').allInnerTexts()
    await 담당.selectOption({ label: 있는것.find((x) => /최돌봄/.test(x))! })
    await page.waitForTimeout(900)
  }

  // 요일 단추는 안에 「이미 n곳」이 같이 들어 있어 글자가 딱 「월」이 아닙니다.
  const 요일단추 = page.locator('button[aria-pressed]')
  const 요일수 = await 요일단추.count()
  통과('요일을 누를 자리가 있다', 요일수 >= 7, `요일 단추 ${요일수}개`)
  await 요일단추.nth(2).click(); await page.waitForTimeout(500)   // 화
  await 요일단추.nth(4).click(); await page.waitForTimeout(1200)  // 목
  const 골랐을때 = await 글()
  짚기('요일을 고르면 「이 계획대로 가면」이 바로 셈해 준다',
    /이 계획대로|앞으로 갈|한도/.test(골랐을때))
  await 찍기('요일고름')

  /*
   * ★★ 여기가 파일럿 첫날의 고비입니다 ★★
   *
   * 의뢰 그대로 **주 2회**만 골랐을 뿐인데 「가사지원 월 한도(시간)」을
   * 넘습니다. 1회 서비스 시간을 안 적으면 **설정의 하루 최대(3시간)**로
   * 세기 때문입니다 — 월 9번 × 3시간 = 27시간, 한도는 12시간.
   *
   * 관리자는 아무 잘못을 안 했는데 저장이 안 됩니다.
   */
  const 안적었을때 = await 글()
  통과('★★ 의뢰 그대로 「주 2회」만 골랐을 때 한도에 안 걸린다',
    !/한도\(시간\)을 넘습니다|넘습니다/.test(안적었을때),
    (안적었을때.match(/[^\n]*넘습니다[^\n]*/) ?? [''])[0].slice(0, 80))

  // 걸리든 안 걸리든 나머지 길을 마저 걸어야 하므로 1회 시간을 적어 줍니다.
  const 시간칸 = page.locator('input[type=number]').first()
  if (await 시간칸.count()) { await 시간칸.fill('60'); await page.waitForTimeout(1200) }
  await 찍기('1회시간적음')

  await page.locator('button', { hasText: /배정 저장/ }).first().click()
  await page.waitForTimeout(2500)
  await page.goto(터 + '/assign'); await page.waitForTimeout(1800)
  const 저장뒤 = await 글()
  통과('★ 배정이 저장되어 담당·요일이 목록에 보인다',
    /최돌봄/.test(저장뒤) && /화|목/.test(저장뒤))
  짚기('「기다리고 있습니다」 빨간 띠가 사라졌다', !/기다리고 있습니다/.test(저장뒤),
    (저장뒤.match(/[^\n]*기다리고 있습니다[^\n]*/) ?? [''])[0])
  await 찍기('배정끝')

  // ── 9-나. ★ 한도를 넘겨 봅니다 ★ ────────────────────────
  console.log('\n━━ 9-나. 일부러 한도를 넘겨 봅니다 ━━━━━━━━━━━━━━━━━\n')
  await page.locator('tr', { hasText: '김순자' }).first().click()
  await page.waitForTimeout(1600)
  // 요일을 다 켜서 주 7회로 만듭니다 — 연간 150만이 금세 넘습니다.
  for (const i of [0, 1, 3, 5, 6]) {
    const b2 = page.locator('button[aria-pressed]').nth(i)
    if (await b2.getAttribute('aria-pressed') === 'false') { await b2.click(); await page.waitForTimeout(250) }
  }
  await page.waitForTimeout(1200)
  const 넘겼을때 = await 글()
  짚기('★ 한도를 넘으면 저장 전에 화면이 먼저 말해 준다',
    /넘|초과|한도/.test(넘겼을때), 넘겼을때.slice(0, 60).replace(/\n/g, ' '))
  await 찍기('한도넘김')
  const 창수 = 창말.length
  await page.locator('button', { hasText: /배정 저장/ }).first().click()
  await page.waitForTimeout(2500)
  const 막았나 = await 글()
  통과('★ 한도를 넘긴 계획은 막힌다 (창이 뜨거나 저장이 안 된다)',
    창말.length > 창수 || /넘|초과/.test(막았나),
    창말.slice(창수).join(' / ').slice(0, 120))
  await 찍기('한도막힘')
  const 닫기 = page.locator('button', { hasText: /^닫기$/ })
  if (await 닫기.count()) { await 닫기.first().click(); await page.waitForTimeout(800) }

  // ── 10. 제공실적 — 한 달치를 실제로 찍어 봅니다 ──────────
  console.log('\n━━ 10. 제공실적 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await page.goto(터 + '/records'); await page.waitForTimeout(2500)
  const 실적 = await 글()
  통과('★ 배정한 사람이 실적 달력에 깔린다', /김순자/.test(실적),
    /이 달에 배정된 것이 없습니다/.test(실적) ? '「이 달에 배정된 것이 없습니다」' : '')
  짚기('무엇을 하면 되는지 적혀 있다', /제공 처리|눌러|고르/.test(실적))
  await 찍기('실적-처음')

  /*
   * 지난 계획을 한꺼번에 제공 처리 — 관리자가 실제로 제일 먼저 누를 단추입니다.
   */
  const 한꺼번에 = page.locator('button', { hasText: /한꺼번에 제공 처리/ })
  통과('「한꺼번에 제공 처리」 단추가 있다', await 한꺼번에.count() > 0)
  const 눌림 = await 한꺼번에.count() > 0 && await 한꺼번에.first().isEnabled()
  짚기('그 단추를 지금 누를 수 있다 (지난 계획이 있으면)', 눌림,
    눌림 ? '' : '이 달 첫 계획이 아직 안 지났으면 꺼져 있는 것이 맞습니다')
  if (눌림) {
    await 한꺼번에.first().click(); await page.waitForTimeout(3000)
    const 처리뒤 = await 글()
    짚기('무엇을 몇 건 처리했는지 알려 준다', /건|처리|제공/.test(처리뒤))
    await 찍기('실적-한꺼번에')
  }

  // 달력 칸 하나를 눌러 「제공」으로 찍어 봅니다.
  const 칸 = page.locator('.cal-chip')
  const 칸수 = await 칸.count()
  통과('달력에 누를 칸이 깔려 있다', 칸수 > 0, `칸 ${칸수}개`)
  if (칸수 > 0) {
    // 오늘 이후 칸은 꺼져 있습니다 — 켜져 있는 칸을 찾아 누릅니다.
    let 눌렀나 = false
    for (let i = 0; i < Math.min(칸수, 12); i++) {
      const c = 칸.nth(i)
      if (await c.isEnabled()) { await c.click(); await page.waitForTimeout(1200); 눌렀나 = true; break }
    }
    통과('지난 날짜 칸을 누를 수 있다', 눌렀나)
    const 창 = await 글()
    짚기('칸을 누르면 무엇을 고르는 창이 뜬다', /제공|미제공|계획/.test(창))
    await 찍기('실적-칸창')

    // 「미제공」으로 바꿔 봅니다 — 까닭을 **골라서** 넣는지 봅니다.
    const 미제공단추 = page.locator('button.상태단추', { hasText: /^미제공$/ })
    통과('미제공으로 바꿀 자리가 있다', await 미제공단추.count() > 0)
    if (await 미제공단추.count()) {
      const 창수0 = 창말.length
      await 미제공단추.first().click(); await page.waitForTimeout(1500)
      const 미제공뒤 = await 글()
      통과('★ 미제공을 누르면 **못 간 까닭**을 묻는다',
        /못 간 까닭을 골라/.test(미제공뒤), 미제공뒤.slice(0, 80).replace(/\n/g, ' '))
      통과('★★ 까닭을 **손으로 치게 하지 않는다** (브라우저 창이 안 뜬다)',
        창말.length === 창수0, 창말.slice(창수0).join(' / ').slice(0, 80))
      const 사유단추 = page.locator('button.상태단추', { hasText: /^부재$/ })
      통과('정해진 사유를 눌러서 고를 수 있다', await 사유단추.count() > 0,
        (await page.locator('button.상태단추').allInnerTexts()).join(' · ').slice(0, 100))
      await 찍기('실적-까닭고르기')
      if (await 사유단추.count()) {
        await 사유단추.first().click(); await page.waitForTimeout(2500)
        const 고른뒤 = await 글()
        통과('★★ 고른 까닭이 달력 칸에 그대로 보인다', /부재/.test(고른뒤),
          고른뒤.slice(0, 80).replace(/\n/g, ' '))
      }
      await 찍기('실적-미제공')
    }
  }

  const 실적끝 = await 글()
  짚기('제공·미제공이 몇 건인지 위에 세어 준다', /제공|미제공/.test(실적끝))
  await 찍기('실적-끝')

  // ── 11. 정산 ────────────────────────────────────────────
  console.log('\n━━ 11. 정산 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await page.goto(터 + '/billing'); await page.waitForTimeout(2500)
  const 정산 = await 글()
  통과('정산 화면이 열린다', 정산.length > 60)
  짚기('★ 실적을 찍은 사람이 정산에 나온다', /김순자/.test(정산),
    정산.slice(0, 140).replace(/\n/g, ' '))
  await 찍기('정산')

  const 확정 = page.locator('button', { hasText: /^확정$/ })
  const 확정수 = await 확정.count()
  짚기('확정할 것이 있으면 「확정」 단추가 보인다', 확정수 > 0,
    확정수 === 0 ? '아직 기간이 안 끝나 「쌓이는중」일 수 있습니다' : `${확정수}건`)
  if (확정수 > 0) {
    await 확정.first().click(); await page.waitForTimeout(2800)
    const 확정뒤 = await 글()
    짚기('확정하면 「수납 처리」로 넘어간다', /수납/.test(확정뒤))
    await 찍기('정산-확정')
  }

  // ── 12. 영수증(청구서) ──────────────────────────────────
  console.log('\n━━ 12. 본인부담금 청구서 ━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  const 청구서 = page.locator('a', { hasText: /청구서|영수증/ })
  const 청구수 = await 청구서.count()
  짚기('청구서를 받을 자리가 있다', 청구수 > 0,
    청구수 === 0 ? '확정 전에는 안 보이는 것이 맞을 수 있습니다' : `${청구수}개`)
  if (청구수 > 0) {
    const 주소 = await 청구서.first().getAttribute('href')
    const r = await page.request.get(터 + String(주소))
    통과('★ 청구서 파일이 실제로 내려온다', r.ok(), `${r.status()} ${r.headers()['content-type'] ?? ''}`)
    const 몸 = await r.body()
    통과('청구서가 빈 파일이 아니다', 몸.length > 1000, `${몸.length} 바이트`)
  }

  // ── 13. 기록지 뽑기 ─────────────────────────────────────
  console.log('\n━━ 13. 기록지 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await page.goto(터 + '/recordbook'); await page.waitForTimeout(2500)
  const 기록지 = await 글()
  통과('기록지 화면이 열린다', 기록지.length > 60)
  짚기('★ 실적을 찍은 사람이 기록지 목록에 나온다', /김순자/.test(기록지),
    기록지.slice(0, 140).replace(/\n/g, ' '))
  짚기('매달 무엇을 내는 것인지 한 줄로 적혀 있다', /지자체에 내는 것은/.test(기록지))
  await 찍기('기록지')

  const 한글받기 = page.locator('a', { hasText: /한글 \(zip\)/ })
  const 있나 = await 한글받기.count() > 0
  통과('★ 기록지를 받을 단추가 있다', 있나,
    있나 ? '' : '대상자가 목록에 없으면 단추가 안 나옵니다')
  if (있나) {
    const 주소2 = await 한글받기.first().getAttribute('href')
    const r2 = await page.request.get(터 + String(주소2))
    통과('★★ 기록지 파일이 실제로 만들어져 내려온다', r2.ok(),
      `${r2.status()} ${r2.headers()['content-type'] ?? ''}`)
    const 몸2 = await r2.body()
    통과('기록지가 빈 파일이 아니다', 몸2.length > 2000, `${몸2.length} 바이트`)
    // zip 은 PK 로 시작합니다. 껍데기만 온 것이 아닌지 봅니다.
    통과('받은 것이 정말 zip 이다', 몸2[0] === 0x50 && 몸2[1] === 0x4b,
      `첫 두 바이트 ${몸2[0]} ${몸2[1]}`)
  }

  // ── 14. 통계 · 의뢰 접수 ────────────────────────────────
  console.log('\n━━ 14. 나머지 화면 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  for (const [이름, 길] of [['통계', '/stats'], ['의뢰 접수', '/inbox']] as const) {
    await page.goto(터 + 길); await page.waitForTimeout(1800)
    const t2 = await 글()
    통과(`${이름} 화면이 열린다`,
      t2.length > 40 && !/문제가 생겼습니다|Unexpected|undefined is not/.test(t2))
    await 찍기(이름)
  }

  // ── 15. 계약서(서식2) 뽑기 ──────────────────────────────
  console.log('\n━━ 15. 계약서 (서식2) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await page.goto(터 + '/recipients'); await page.waitForTimeout(1500)
  await page.locator('tr.clickable', { hasText: '김순자' }).first().click()
  await page.waitForTimeout(2000)
  const 계약 = page.locator('a', { hasText: /계약서 \(서식2\)/ })
  통과('대상자 화면에서 계약서를 뽑을 수 있다', await 계약.count() > 0)
  if (await 계약.count()) {
    const 주소3 = await 계약.first().getAttribute('href')
    const r3 = await page.request.get(터 + String(주소3))
    통과('★ 계약서(한글) 파일이 실제로 내려온다', r3.ok(),
      `${r3.status()} ${r3.headers()['content-type'] ?? ''}`)
    const 몸3 = await r3.body()
    통과('계약서가 빈 파일이 아니다', 몸3.length > 2000, `${몸3.length} 바이트`)
    통과('받은 것이 정말 hwpx(zip) 이다', 몸3[0] === 0x50 && 몸3[1] === 0x4b)
  }
  await 찍기('대상자상세')

  // ── 16. 지금 백업 ───────────────────────────────────────
  console.log('\n━━ 16. 지금 백업 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await page.goto(터 + '/settings'); await page.waitForTimeout(1500)
  const 일반탭0 = page.locator('button, a', { hasText: /^일반$/ })
  if (await 일반탭0.count()) { await 일반탭0.first().click(); await page.waitForTimeout(1200) }
  const 백업단추 = page.locator('button', { hasText: /^지금 백업$/ })
  통과('「지금 백업」 단추가 있다', await 백업단추.count() > 0)
  if (await 백업단추.count()) {
    await 백업단추.first().click(); await page.waitForTimeout(3500)
    const 백업뒤 = await 글()
    짚기('★ 백업하고 나면 됐다는 말이 화면에 남는다',
      /백업했|떴습니다|저장했|방금|마지막 백업/.test(백업뒤),
      (백업뒤.match(/[^\n]*마지막 백업[^\n]*/) ?? [''])[0].slice(0, 50))
    await 찍기('백업')
  }

  // ── 17. 로그아웃하고 다시 들어오기 ──────────────────────
  console.log('\n━━ 17. 로그아웃 · 다시 로그인 ━━━━━━━━━━━━━━━━━━━━━\n')
  const 나가기 = page.locator('button, a', { hasText: /^로그아웃$/ })
  통과('로그아웃 자리가 있다', await 나가기.count() > 0)
  if (await 나가기.count()) {
    await 나가기.first().click(); await page.waitForTimeout(2500)
    const 나간뒤 = await 글()
    통과('★ 로그아웃하면 로그인 화면으로 간다', /로그인|아이디/.test(나간뒤))
    짚기('왜 로그아웃해야 하는지 적혀 있다', /자리를 비울 때|대상자 정보/.test(나간뒤))
    await 찍기('로그아웃')

    await page.locator('input').first().fill('haenam')
    await page.locator('input[type=password]').first().fill('haenam1234')
    await page.locator('button', { hasText: /들어가기|로그인/ }).first().click()
    await page.waitForTimeout(3000)
    const 다시 = await 글()
    통과('★★ 만든 아이디로 다시 들어와진다', !/로그인 화면|아이디가|비밀번호가/.test(다시)
      && /홈|배정|대상자/.test(다시), 다시.slice(0, 60).replace(/\n/g, ' '))
    통과('다시 들어오면 넣어 둔 자료가 그대로 있다',
      await (async () => {
        await page.goto(터 + '/recipients'); await page.waitForTimeout(1800)
        return /김순자/.test(await 글())
      })())
    await 찍기('다시로그인')
  }

  // ── 18. ★ 지자체 엑셀을 실제로 올려 봅니다 ★ ────────────
  /*
   * 파일럿 기관이 **실제로 시작하는 길**입니다. 손으로 한 명씩 넣는 것은
   * 나중 일이고, 첫날은 군이 보낸 명단 파일 하나로 시작합니다.
   * 그 파일이 안 읽히면 그날 아무것도 못 합니다.
   */
  console.log('\n━━ 18. 지자체 의뢰 엑셀 올리기 ━━━━━━━━━━━━━━━━━━━━\n')
  await page.goto(터 + '/inbox'); await page.waitForTimeout(2000)
  const 접수 = await 글()
  통과('의뢰 접수 화면이 열린다', /의뢰 접수/.test(접수))
  짚기('무엇을 올리는 곳인지 한 줄로 적혀 있다', /지자체가 보낸/.test(접수))
  짚기('시트를 안 골라도 된다고 말해 준다', /시트를 고르지 않아도/.test(접수))
  짚기('암호 걸린 파일도 된다고 말해 준다', /암호/.test(접수))
  await 찍기('접수-처음')

  const 엑셀 = 뿌리 + '/서식시험/의뢰명단_예시(배정시험).xlsx'
  await 파일넣기(page, '#xl', 엑셀)
  await page.waitForTimeout(1200)
  const 미리보기 = page.locator('button', { hasText: /미리보기/ })
  통과('파일을 고르면 「미리보기」를 누를 수 있다', await 미리보기.first().isEnabled())
  await 미리보기.first().click()
  await page.waitForTimeout(6000)
  const 읽은뒤 = await 글()
  통과('★ 엑셀을 읽어 냈다', !/못 읽|오류|실패/.test(읽은뒤.slice(0, 200)),
    읽은뒤.slice(0, 120).replace(/\n/g, ' '))
  통과('★ 읽은 차수가 보인다', /읽은 차수/.test(읽은뒤))
  짚기('몇 건인지 세어서 보여 준다', /신규|추가|변경|건/.test(읽은뒤))
  await 찍기('접수-미리보기')

  const 반영 = page.locator('button', { hasText: /건 반영하기/ })
  통과('★ 「n건 반영하기」 단추가 있다', await 반영.count() > 0,
    (await 반영.allInnerTexts()).join(' / '))
  if (await 반영.count()) {
    const 반영글 = (await 반영.first().innerText()).trim()
    통과('반영할 것이 0건이 아니다', !/^0건/.test(반영글), 반영글)
    짚기('무엇이 안 들어가는지도 적혀 있다', /유지.*지난차수|넣지 않습니다/.test(읽은뒤))

    await 반영.first().click()
    await page.waitForTimeout(6000)
    const 반영뒤 = await 글()
    통과('★★ 반영하면 됐다고 알려 준다', /반영|넣었|들어/.test(반영뒤),
      반영뒤.slice(0, 120).replace(/\n/g, ' '))
    await 찍기('접수-반영')
  }

  // 정말로 들어왔나 — 화면 세 곳에서 확인합니다.
  await page.goto(터 + '/recipients'); await page.waitForTimeout(2200)
  const 대상자뒤 = await 글()
  const 줄수 = await page.locator('tr.clickable').count()
  통과('★★ 엑셀로 들어온 대상자가 목록에 보인다', 줄수 >= 2, `${줄수}명`)
  짚기('읍면동이 채워져 있다', /읍|면|동/.test(대상자뒤))
  await 찍기('접수-대상자')

  await page.goto(터 + '/assign'); await page.waitForTimeout(2500)
  const 배정뒤2 = await 글()
  const 배정줄 = await page.locator('tbody tr').count()
  통과('★★ 엑셀로 들어온 의뢰가 배정 화면에 깔린다', 배정줄 >= 2, `${배정줄}줄`)
  짚기('배정할 것이 몇 건 남았는지 위에 뜬다', /기다리고 있습니다/.test(배정뒤2))
  짚기('의뢰 주기(주 n회)가 줄에 보인다', /주 \d회|월 \d회|생애/.test(배정뒤2))
  await 찍기('접수-배정')

  // ── 19. 암호 걸린 엑셀 ──────────────────────────────────
  /*
   * 군이 개인정보가 든 파일을 보낼 때는 **암호를 겁니다.** 암호 파일을
   * 못 읽으면 관리자는 파일을 풀어서 다시 저장하는 법을 찾아야 합니다.
   */
  console.log('\n━━ 19. 암호 걸린 엑셀 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await page.goto(터 + '/inbox'); await page.waitForTimeout(2000)
  await 파일넣기(page, '#xl', 뿌리 + '/서식시험/의뢰명단_예시_암호5052.xlsx')
  await page.waitForTimeout(1000)

  // 먼저 **암호를 안 넣고** 눌러 봅니다 — 뭐라고 하는지가 중요합니다.
  await page.locator('button', { hasText: /미리보기/ }).first().click()
  await page.waitForTimeout(5000)
  const 암호없이 = await 글()
  통과('★ 암호를 안 넣으면 **암호가 필요하다고** 말해 준다',
    /암호/.test(암호없이) && !/읽은 차수/.test(암호없이),
    (암호없이.match(/[^\n]*암호[^\n]*/) ?? [''])[0].slice(0, 70))
  await 찍기('접수-암호없이')

  await page.locator('#pw').fill('5052')
  await page.locator('button', { hasText: /미리보기/ }).first().click()
  await page.waitForTimeout(7000)
  const 암호넣고 = await 글()
  통과('★★ 암호를 넣으면 읽힌다', /읽은 차수/.test(암호넣고),
    암호넣고.slice(0, 120).replace(/\n/g, ' '))
  await 찍기('접수-암호넣고')

  // ── 20. 엑셀이 아닌 것을 올려 봅니다 ────────────────────
  console.log('\n━━ 20. 엉뚱한 파일을 올려 봅니다 ━━━━━━━━━━━━━━━━━━\n')
  await page.goto(터 + '/inbox'); await page.waitForTimeout(2000)
  const 엉뚱 = 뿌리 + '/package.json'
  await 파일넣기(page, '#xl', 엉뚱, '엉뚱한파일.xlsx').catch(() => {})
  await page.waitForTimeout(1000)
  const 볼수있나 = await page.locator('button', { hasText: /미리보기/ }).first().isEnabled()
  if (볼수있나) {
    await page.locator('button', { hasText: /미리보기/ }).first().click()
    await page.waitForTimeout(5000)
    const 엉뚱뒤 = await 글()
    통과('★ 엑셀이 아닌 파일은 **까닭을 말하고** 막는다',
      !/읽은 차수/.test(엉뚱뒤) && /못 읽|엑셀|파일/.test(엉뚱뒤),
      (엉뚱뒤.match(/[^\n]*(못 읽|엑셀)[^\n]*/) ?? [''])[0].slice(0, 80))
    짚기('무슨 파일을 올려야 하는지 알려 준다', /xlsx|엑셀/.test(엉뚱뒤))
    await 찍기('접수-엉뚱한파일')
  } else {
    짚기('엑셀이 아닌 파일은 아예 못 고른다', true, '파일 고르개가 .xlsx 만 받습니다')
  }

  // ── 21. ★ 제공인력 휴대폰과의 왕복 ★ ────────────────────
  /*
   * 폰이 올린 것이 **사무실 화면에 어떻게 뜨는가**를 봅니다.
   * (자료함까지 오는지는 `보고왕복시험.ts` 가 따로 봅니다.)
   *
   * 우편함(Supabase)은 흉내 냅니다 — 인터넷도 열쇠도 없이 돌아야 합니다.
   * 받아 넣는 길은 **진짜 `보고받기()`** 를 그대로 씁니다.
   */
  console.log('\n━━ 21. 제공인력 휴대폰과의 왕복 ━━━━━━━━━━━━━━━━━━━\n')

  // ① 관리자 화면에 폰을 잇는 자리가 있나
  await page.goto(터 + '/staff'); await page.waitForTimeout(1800)
  await page.locator('tr.clickable, tbody tr', { hasText: '최돌봄' }).first().click()
  await page.waitForTimeout(2200)
  const 종사자상세 = await 글()
  통과('★ 종사자 화면에 **휴대폰 잇는 자리**가 있다',
    /기기 등록|휴대폰|폰 잇기|QR/.test(종사자상세),
    종사자상세.slice(0, 120).replace(/\n/g, ' '))
  짚기('비밀번호를 본인이 친다고 적혀 있다', /본인이|그 자리에서/.test(종사자상세))
  await 찍기('종사자-폰잇기')

  /*
   * ② ★ 폰이 안 이어졌으면 **사무실이 그걸 아나** ★
   *
   * `할일보내기.ts` 는 폰이 안 이어진 사람을 건너뜁니다. 보낼 곳이
   * 없으니 맞는 동작인데, 사무실이 아무 말도 안 하면 관리자는
   * 배정을 다 해 놓고 「왜 폰에 아무것도 안 뜨죠」에서 막힙니다.
   */
  await page.goto(터 + '/home'); await page.waitForTimeout(2500)
  const 홈글 = await 글()
  통과('★★ 폰이 안 이어진 제공인력이 있으면 홈이 알려 준다',
    /휴대폰이 안 이어져/.test(홈글),
    (홈글.match(/[^\n]*휴대폰[^\n]*/) ?? ['(홈에 아무 말이 없습니다)'])[0].slice(0, 80))
  짚기('어디로 가서 고치라는지도 알려 준다', /종사자/.test(홈글))
  await 찍기('홈-폰안이어짐')

  // ③ 폰이 보고를 하나 올립니다.
  const 배정번호 = await (async () => {
    const r = await page.request.get(터 + '/api/assign')
    if (!r.ok()) return 0
    const j: any = await r.json()
    const 것 = (j.items ?? []).find((x: any) => x.recipient === '김순자' && x.assignId)
    return Number(것?.assignId ?? 0)
  })()
  통과('배정 번호를 찾았다', 배정번호 > 0, String(배정번호))

  let 넣은날 = ''
  if (배정번호 > 0) {
    /*
     * 가는 요일(화·목) 중 **오늘까지 온 날** 하나를 고릅니다.
     * 앞날에 보고가 올라올 수는 없습니다.
     */
    const 후보: string[] = []
    for (let d = 1; d <= Number(오늘.getDate()); d++)
      후보.push(`${이달}-${String(d).padStart(2, '0')}`)

    let 마지막말 = ''
    for (const 날 of 후보.reverse()) {
      const p2 = Bun.spawn({
        cmd: ['bun', 뿌리 + '/도구/폰보고넣기.ts', String(배정번호), 날],
        cwd: 집.폴더, stdout: 'pipe', stderr: 'pipe',
      })
      const 코드 = await p2.exited
      마지막말 = (await new Response(p2.stderr).text()).trim().split('\n').slice(-2).join(' ')
      if (코드 === 0) { 넣은날 = 날; break }
    }
    통과('★★ 폰이 올린 보고가 사무실 자료함에 들어갔다', !!넣은날,
      넣은날 ? `${넣은날} 에 넣었습니다` : 마지막말.slice(0, 160))
  }

  // ④ 그것이 화면에 보이나
  if (넣은날) {
    await page.goto(터 + '/records'); await page.waitForTimeout(2500)
    const 실적2 = await 글()
    통과('실적 화면이 열린다', /김순자/.test(실적2))

    await page.locator(`.cal-day[data-on="${넣은날}"] button.cal-chip`).first()
      .click().catch(() => {})
    await page.waitForTimeout(1600)
    const 칸창 = await 글()
    통과('★★ 현장에서 올라온 것이라고 화면이 말해 준다',
      /현장앱|현장에서|폰|올라온/.test(칸창), 칸창.slice(0, 140).replace(/\n/g, ' '))
    통과('★ 진행시간(시작·끝)이 보인다', /09:05|9:05|10:35|시작|끝/.test(칸창))
    짚기('한 것(청소·세탁)이 보인다', /청소|세탁/.test(칸창))
    짚기('서명을 받았다는 것이 보인다', /서명/.test(칸창))
    await 찍기('폰왕복-실적창')

    await page.keyboard.press('Escape'); await page.waitForTimeout(800)
    await page.goto(터 + '/recipients'); await page.waitForTimeout(1500)
    await page.locator('tr.clickable', { hasText: '김순자' }).first().click()
    await page.waitForTimeout(2200)
    /*
     * 현장에서 올라온 **특이사항**은 오른쪽 「메모장」으로 갑니다.
     * 접혀 있고 딱지에 숫자만 뜨므로, 펼쳐서 확인합니다.
     */
    const 메모딱지 = page.locator('button.memo-tab')
    통과('오른쪽에 메모장 딱지가 있다', await 메모딱지.count() > 0)
    짚기('★ 새 메모가 몇 개인지 딱지에 숫자로 뜬다',
      /\d/.test(await 메모딱지.first().innerText().catch(() => '')),
      (await 메모딱지.first().innerText().catch(() => '')).replace(/\n/g, ' '))
    if (await 메모딱지.count()) { await 메모딱지.first().click(); await page.waitForTimeout(1800) }
    const 상세2 = await 글()
    통과('★★ 특이사항이 **대상자 메모장**으로 넘어왔다',
      /무릎이 아프시다고/.test(상세2),
      (상세2.match(/[^\n]*무릎[^\n]*/) ?? ['(메모장에 없습니다)'])[0].slice(0, 70))
    짚기('언제·누가·무슨 서비스였는지도 함께 적힌다',
      /가사지원/.test(상세2) && new RegExp(이달).test(상세2))
    await 찍기('폰왕복-메모')
  }

  // ── 22. ★ 달을 넘기는 자리 ★ ────────────────────────────
  /*
   * 배정은 12월까지인데 실적·정산·기록지는 **달마다** 끊깁니다.
   * 다음 달로 넘어가면 칸이 새로 깔리고, 이번 달 실적이 다음 달로
   * 새어 나오지 않아야 합니다. 파일럿은 9월에 시작해 **10월 초에
   * 처음 정산을 냅니다** — 그때 이 자리가 처음 열립니다.
   */
  console.log('\n━━ 22. 달을 넘기는 자리 ━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  const 다음달 = (() => {
    const d = new Date(오늘.getFullYear(), 오늘.getMonth() + 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const 지난달 = (() => {
    const d = new Date(오늘.getFullYear(), 오늘.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()

  for (const [이름, 길] of [['제공실적', '/records'], ['정산', '/billing'],
                            ['기록지', '/recordbook']] as const) {
    await page.goto(터 + 길); await page.waitForTimeout(2200)
    const 이번달글 = await 글()
    통과(`${이름} — 이번 달(${이달})이 먼저 열린다`, 이번달글.includes(String(오늘.getFullYear())),
      (이번달글.match(/\d{4}년\s*\d+월/) ?? [''])[0])

    // ▶ 를 눌러 다음 달로.
    const 다음 = page.locator('button', { hasText: '▶' })
    통과(`${이름} — 다음 달로 넘기는 단추가 있다`, await 다음.count() > 0)
    if (await 다음.count()) {
      await 다음.first().click(); await page.waitForTimeout(2500)
      const 다음달글 = await 글()
      통과(`★ ${이름} — 다음 달로 넘어간다`,
        !/문제가 생겼습니다|Unexpected|undefined is not/.test(다음달글)
        && 다음달글.length > 60,
        다음달글.slice(0, 60).replace(/\n/g, ' '))
      짚기(`${이름} — 다음 달은 아직 빈 것이 보인다`,
        !넣은날 || !다음달글.includes('무릎이'),
        '이번 달 것이 다음 달로 새면 안 됩니다')
      await 찍기(`달넘김-${이름}-다음달`)

      // ◀ 를 두 번 눌러 지난 달로.
      const 이전 = page.locator('button', { hasText: '◀' })
      await 이전.first().click(); await page.waitForTimeout(1800)
      await 이전.first().click(); await page.waitForTimeout(2500)
      const 지난달글 = await 글()
      통과(`★ ${이름} — 지난 달로도 넘어간다 (${지난달})`,
        !/문제가 생겼습니다|Unexpected|undefined is not/.test(지난달글)
        && 지난달글.length > 60)
      짚기(`${이름} — 지난 달에 「이번 달」로 돌아오는 길이 있다`,
        /이번 달/.test(지난달글))
      await 찍기(`달넘김-${이름}-지난달`)
    }
  }

  /*
   * ★ 배정이 두 달에 걸쳐 있으면 **다음 달에도 칸이 깔려야** 합니다.
   *   깔리지 않으면 10월에 관리자가 실적을 못 찍습니다.
   */
  await page.goto(터 + '/records'); await page.waitForTimeout(2200)
  await page.locator('button', { hasText: '▶' }).first().click()
  await page.waitForTimeout(2800)
  const 다음달실적 = await 글()
  const 다음달칸 = await page.locator('.cal-chip').count()
  통과('★★ 다음 달에도 계획 칸이 깔린다 (배정이 12월까지이므로)',
    다음달칸 > 0, `칸 ${다음달칸}개 · ${다음달실적.slice(0, 60).replace(/\n/g, ' ')}`)
  await 찍기('달넘김-다음달칸')

  // ── 10. 백업 ─────────────────────────────────────────────
  console.log('\n━━ 10. 자료 지키기 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await page.goto(터 + '/settings'); await page.waitForTimeout(1500)
  const 일반탭 = page.locator('button, a', { hasText: /^일반$/ })
  if (await 일반탭.count()) { await 일반탭.first().click(); await page.waitForTimeout(1200) }
  const 설정글 = await 글()
  짚기('설정 「일반」에서 백업이 바로 보인다', /백업/.test(설정글),
    (설정글.match(/[^\n]*백업[^\n]*/) ?? ['백업 글자 없음'])[0].slice(0, 60))
  짚기('백업이 어디에 떨어지는지 자리가 적혀 있다', /따로 둘 곳|USB|폴더/.test(설정글))
  await 찍기('설정-일반')

} catch (e: any) {
  막힌것.push('예행이 도중에 끊겼습니다 — ' + String(e?.message ?? e))
  console.log('\n✗✗ 끊김: ' + String(e?.message ?? e))
  await 찍기('끊긴자리').catch(() => {})
} finally {
  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  된 것 ${됨} · 막힌 것 ${막힌것.length} · 헤맬 자리 ${헤맬자리.length}`)
  if (막힌것.length) {
    console.log('\n── ✗ 막힌 것 (고쳐야 넘어갑니다) ────────────────────')
    막힌것.forEach((x, i) => console.log(`  ${i + 1}. ${x}`))
  }
  if (헤맬자리.length) {
    console.log('\n── △ 헤맬 자리 (넘어는 가는데 길이 안 보입니다) ─────')
    헤맬자리.forEach((x, i) => console.log(`  ${i + 1}. ${x}`))
  }
  if (화면오류.length) {
    console.log('\n── 화면 오류 ───────────────────────────────────────')
    화면오류.slice(0, 8).forEach((x) => console.log('  ' + x.slice(0, 200)))
  }
  if (창말.length) {
    console.log('\n── 뜬 창 ───────────────────────────────────────────')
    창말.forEach((x) => console.log('  「' + x.slice(0, 160) + '」'))
  }
  console.log(`\n  사진: ${찍는곳}`)
  await b.close(); await 집.끄기()
  process.exit(막힌것.length ? 1 : 0)
}
