/**
 * 최초 설정 마법사 — **눌러서 끝까지 가 봅니다** (v35).
 *
 *   bun 첫설정화면시험.ts
 *
 * ── ★ 끝난 것으로 치는 기준 ★ ──────────────────────────────
 *
 *   (`할일.md` 7-하) 「**빈 자료함으로 처음 켜서 설명서를 한 줄도
 *   안 읽고 끝까지 갔을 때**, 단가·한도·부담률이 우리 지자체 값으로
 *   들어가 있다.」
 *
 * 그래서 이 시험은 **글을 안 읽고 눌러만 갑니다.** 화면에 적힌 것만
 * 보고 끝까지 가지는지 봅니다.
 *
 * 여기서 보는 것:
 *   1) 기관을 개설하면 **홈이 아니라 마법사**가 뜬다
 *   2) 값이 **이미 채워져** 있다 (빈칸이 없다)
 *   3) **건너뛰기 단추가 없다**
 *   4) 왜 묻는지 **한 줄씩** 적혀 있다
 *   5) 단추 하나로 끝나고 **홈이 열린다**
 *   6) 다시 들어가도 **안 뜬다**
 *   7) 고친 값이 **설정 화면에도** 그대로 보인다
 *   8) 홈에 **설정 점검**이 뜬다 (공휴일)
 */
import { chromium } from 'playwright'
import { 빈자료함띄우기 } from './도구/빈자료함'

let 통과수 = 0, 실패수 = 0
function 통과(무엇: string, 참: unknown, 덧말 = '') {
  if (참) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? '   — ' + 덧말 : ''}`) }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? '   — ' + 덧말 : ''}`) }
}

const 집 = await 빈자료함띄우기()
const 터 = 집.주소
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 1500, height: 1200 } })
page.on('pageerror', (e) => 통과('화면 오류 없음', false, String(e)))

try {
  // ── 1. 기관 개설 ──────────────────────────────────────────
  console.log('\n── 1. 기관을 개설합니다 ─────────────────────────────────\n')
  await page.goto(터 + '/'); await page.waitForTimeout(1200)
  통과('기관 개설 화면이 뜬다', /기관을 개설합니다/.test(await page.locator('body').innerText()))

  await page.locator('#orgName').fill('첫설정화면복지관')
  await page.locator('#phone').fill('061-000-0000')
  for (const [칸, 값] of [['adminName', '박관리'], ['loginId', 'screen-admin'],
                          ['password', 'abcd1234'], ['password2', 'abcd1234']] as const) {
    const x = page.locator(`#${칸}`)
    if (await x.count()) await x.fill(값)
  }
  await page.locator('button[type=submit], button.primary').first().click()
  await page.waitForTimeout(2500)

  // ── 2. 홈이 아니라 마법사 ────────────────────────────────
  console.log('\n── 2. ★ 홈이 아니라 마법사가 뜬다 ★ ────────────────────\n')
  const 마법 = await page.locator('body').innerText()
  통과('★ 마법사가 떴다', /이 값들이 맞는지만 봐 주세요/.test(마법),
    (마법.split('\n').find((x) => x.trim())?.trim() ?? '').slice(0, 40))
  통과('★ **홈이 아니다**', !/오늘 할 일|대기중/.test(마법))
  통과('기관 이름이 보인다', /첫설정화면복지관/.test(마법))
  통과('**1분**이라고 알려 준다', /1분/.test(마법))

  // ── 3. 값이 이미 채워져 있다 ─────────────────────────────
  console.log('\n── 3. 값이 **이미 채워져** 있다 ────────────────────────\n')
  const 빈칸 = await page.locator('input[type=number]').evaluateAll(
    (칸들) => 칸들.filter((x: any) => x.value === '').length)
  통과('★ 숫자 칸에 **빈칸이 하나도 없다**', 빈칸 === 0, `빈칸 ${빈칸}개`)
  통과('연간 한도가 채워져 있다',
    await page.locator('#w-annual').inputValue() === '1500000',
    await page.locator('#w-annual').inputValue())
  통과('생애한도가 채워져 있다',
    await page.locator('#w-house').inputValue() === '1000000',
    await page.locator('#w-house').inputValue())
  통과('비대면 한도가 채워져 있다', await page.locator('#w-f2f').inputValue() === '3')
  통과('세는 법이 「연속」이다', await page.locator('#w-f2fmode').inputValue() === '연속')
  통과('편람 단가가 화면에 보인다 (식사 11,000)', /11000/.test(await page.content()))
  통과('일곱 마당이 다 있다',
    ['① 우리 지자체', '② 서비스 단가', '③ 지원한도', '④ 서비스별 월 한도',
     '⑤ 식사지원', '⑥ 본인부담', '⑦ 공휴일'].every((x) => 마법.includes(x)))

  /* ── 3-나. ★ 사람이 친 값을 브라우저가 막지 않나 ★ ────────
   *
   * 2026-09-11 파일럿 첫날. 「월 시간」 칸에 `step="30"` 이 붙어 있어
   * **20·25·45 를 치면 브라우저가 영문 창으로 막았습니다.**
   *
   *   Please enter a valid value. The two nearest valid values are 0 and 30.
   *
   * 무무 님이 그 창을 보고 30 을 넣은 채 수행기관에 세팅하고 오셨습니다.
   * 가사지원 월 한도가 30분 — 그 기관은 배정을 하나도 저장할 수
   * 없는 상태였습니다.
   *
   * 글자로만 보는 것(`숫자칸시험.ts`)으로는 모자랍니다. **진짜 브라우저가
   * 정말 받아 주는지**를 여기서 봅니다.
   */
  console.log('\n── 3-나. ★ 브라우저가 사람이 친 값을 막지 않나 ★ ──────\n')
  {
    const 칸들 = page.locator('input[type=number]')
    const 몇 = await 칸들.count()
    const 막힌것: string[] = []
    for (let i = 0; i < 몇; i++) {
      const 칸 = 칸들.nth(i)
      const 옛값 = await 칸.inputValue()
      const 한계 = await 칸.evaluate((e: any) => ({ min: e.min, max: e.max, id: e.id || e.name || '' }))
      // 그 칸이 받을 만한 **어중간한 값** 셋을 넣어 봅니다.
      for (const 값 of ['20', '25', '45']) {
        const 위 = Number(한계.max || '999999999')
        if (Number(값) > 위) continue
        await 칸.fill(값)
        const r = await 칸.evaluate((e: any) => ({ 맞나: e.checkValidity(), 말: e.validationMessage }))
        if (!r.맞나) 막힌것.push(`${한계.id || i}번 칸 · ${값} → ${r.말}`)
      }
      await 칸.fill(옛값)
    }
    통과('★★ 20·25·45 를 막는 숫자 칸이 하나도 없다', 막힌것.length === 0,
      막힌것.slice(0, 4).join(' / '))

    // 월 시간 칸에 **편람 값**을 그대로 칠 수 있어야 합니다.
    const 시간칸 = 칸들.nth(await 칸들.evaluateAll((칸들: any[]) =>
      칸들.findIndex((x: any) => x.value === '720')))
    if (await 시간칸.count()) {
      for (const 값 of ['720', '360', '80', '75']) {
        await 시간칸.fill(값)
        const 맞나 = await 시간칸.evaluate((e: any) => e.checkValidity())
        통과(`월 시간 칸에 ${값} 을 칠 수 있다`, 맞나)
      }
      await 시간칸.fill('720')
    }
  }

  /* ── 3-다. ★ 1회 서비스 시간이 마법사에 보이나 ★ (v36) ────
   *
   * (무무 2026-09-11 — 「마법사에서도 적용이 되어야 해. 그래야 수행기관에서
   *  어? 이게 맞을텐데 왜 안되지? 하는 오해를 하지 않을 수 있어.」)
   *
   * 설정에만 있으면 관리자는 마법사에서 월 한도만 보고 넘어갔다가
   * 배정에서 막히고, **까닭을 찾을 길이 없습니다.**
   */
  console.log('\n── 3-다. ★ 1회 서비스 시간이 마법사에 보이나 ★ ────────\n')
  {
    // 3-나 에서 칸에 값을 넣었다 뺐다 했으므로, 새로 불러 처음 모습을 봅니다.
    await page.reload(); await page.waitForTimeout(2000)
    const 글2 = await page.locator('body').innerText()
    통과('★★ 「1회 시간」 칸이 마법사에 있다', /1회 시간/.test(글2))
    통과('무엇인지 한 줄로 적혀 있다', /한 번 가면 보통 몇 분/.test(글2))
    통과('★ 「한도 안에 들면 어떻게 나누어도 된다」고 말해 준다',
      /한도 안에 들면 어떻게 나누셔도/.test(글2))
    통과('★ 지금 값이면 한 달 몇 번인지 셈해 준다',
      /한 달 \d+번.*까지/.test(글2.replace(/\n/g, ' ')),
      (글2.match(/[^\n]*한 달 \d+번[^\n]*/) ?? [''])[0].slice(0, 70))
  }

  // ── 4. 건너뛰기가 없다 · 왜 묻는지 적혀 있다 ─────────────
  console.log('\n── 4. 건너뛰기 없음 · 까닭 적힘 ────────────────────────\n')
  const 단추들 = await page.locator('button').allInnerTexts()
  통과('★ **건너뛰기 단추가 없다**',
    !단추들.some((t) => /건너뛰|나중에 하기|생략/.test(t)), 단추들.join(' | '))
  통과('건너뛰기를 왜 안 두었는지도 적혀 있다', /빠져나갈 구멍/.test(마법))
  통과('★ 「청구 금액이 그대로 틀립니다」', /청구 금액이 그대로 틀립니다/.test(마법))
  통과('★ 「군이 안 줍니다 — 기관이 떠안습니다」', /기관이 떠안습니다/.test(마법))
  통과('★ 「어르신 서비스가 끊기는」 기준이라고 적힌다', /서비스가 끊기는/.test(마법))
  통과('나중에 설정에서 고칠 수 있다고 알려 준다', /언제든 고칠 수 있습니다/.test(마법))
  통과('공휴일만 「나중에」라고 적혀 있다', /공휴일 — 나중에/.test(마법))

  // ── 5. 값을 하나 고치고 끝까지 ───────────────────────────
  console.log('\n── 5. 단추 하나로 끝난다 ───────────────────────────────\n')
  await page.locator('#w-name').fill('해남군 규칙')
  await page.locator('button.primary').first().click()
  await page.waitForTimeout(3000)
  const 홈글 = await page.locator('body').innerText()
  통과('★ **홈이 열렸다**', !/이 값들이 맞는지만/.test(홈글),
    (홈글.split('\n').find((x) => x.trim())?.trim() ?? '').slice(0, 40))

  // ── 6. 다시 들어가도 안 뜬다 ─────────────────────────────
  console.log('\n── 6. 다시 들어가도 안 뜬다 ────────────────────────────\n')
  await page.goto(터 + '/'); await page.waitForTimeout(2000)
  통과('★ 마법사가 **다시 안 뜬다**',
    !/이 값들이 맞는지만/.test(await page.locator('body').innerText()))
  await page.goto(터 + '/recipients'); await page.waitForTimeout(1500)
  통과('다른 주소로 들어가도 안 뜬다',
    !/이 값들이 맞는지만/.test(await page.locator('body').innerText()))

  // ── 7. 고친 값이 설정 화면에도 ───────────────────────────
  console.log('\n── 7. 고친 값이 설정에도 그대로 ────────────────────────\n')
  /* 설정은 세 탭입니다 — 규칙은 「계산 규칙」 탭에 있습니다. */
  await page.goto(터 + '/settings'); await page.waitForTimeout(2000)
  await page.locator('button', { hasText: '계산 규칙' }).first().click()
  await page.waitForTimeout(2000)
  const 설 = await page.locator('body').innerText()
  통과('★ 규칙 이름이 「해남군 규칙」이다', /해남군 규칙/.test(설),
    (설.split('\n').find((x) => x.includes('해남군')) ?? '(없음)').trim().slice(0, 50))
  통과('마법사에서 고친 값이 설정에도 그대로다 (같은 표를 씁니다)',
    /1,500,000|1500000/.test(설.replace(/\s/g, '')) || /150만/.test(설))

  // ── 8. 홈이 스스로 말한다 ────────────────────────────────
  console.log('\n── 8. 홈에 설정 점검이 뜬다 ────────────────────────────\n')
  await page.goto(터 + '/'); await page.waitForTimeout(2500)
  const 홈2 = await page.locator('body').innerText()
  통과('★ **공휴일이 없다고 홈이 말한다**', /공휴일이 하나도 없습니다/.test(홈2),
    (홈2.split('\n').find((x) => x.includes('공휴일')) ?? '(없음)').trim().slice(0, 60))
  통과('설정으로 가는 길이 있다',
    await page.locator('a', { hasText: '설정에서 고치기' }).count() > 0)
  통과('별표(**)가 화면에 안 보인다', !/\*\*/.test(홈2))
} catch (e: any) {
  실패수++
  console.log(`\n✗ 시험 도중 터졌습니다 — ${e?.message ?? e}`)
  if (e?.stack) console.log(String(e.stack).split('\n').slice(1, 5).join('\n'))
} finally {
  await b.close(); await 집.끄기()
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`)
  process.exit(실패수 ? 1 : 0)
}
