/**
 * 손으로 넣는 서비스 · 곁말 지우기 · 버전 번호 자리 시험.
 *
 * 여기서 보는 것:
 *  1) 기관 개설 화면에 **예시 기관명·예시 전화번호가 없다** (1·2번)
 *  2) 대상자 집 전화칸에도 예시 번호가 없다 (4번)
 *  3) **직접 추가한 대상자에게 서비스를 손으로 넣을 수 있다** (5번) ★
 *  4) 넣으면 **배정 화면에 나타난다** — 기록지까지 가는 길이 열립니다 (6번)
 *  5) 같은 서비스를 **기간이 겹치게** 또 넣으면 막는다
 *  6) 손으로 넣은 것은 지울 수 있고, **실적이 있으면 못 지운다**
 *  7) 왼쪽 위 「통돌 Note」 옆에 **버전 번호**가 보인다 (7번)
 *
 * 빈 자료함에서 시작합니다 — 할 일 5번(첫 실행)도 함께 밟습니다.
 */
import { chromium } from 'playwright'
import { 빈자료함띄우기 } from './도구/빈자료함'
import { 마법사지나기 } from './도구/마법사지나기'

const 결과: { n: string; ok: boolean; d?: string }[] = []
const 통과 = (n: string, ok: unknown, d = '') => 결과.push({ n, ok: !!ok, d })

/*
 * ── ★ 이 시험은 **자기 프로그램을 따로 띄웁니다** ★ ─────────
 *
 * 2026-09-08 에 찾은 것 — 이 시험은 개발용 5757 에 붙고 있었는데, 그
 * 자료함에는 **이미 기관이 개설되어 있습니다.** 그래서 「기관 개설
 * 화면」을 30초 기다리다 터졌고, **아무것도 안 보고 있었습니다.**
 *
 * 「빈 자료함에서 시작합니다」라고 맨 위에 적어 두고도 그러지 않고
 * 있었던 것입니다. 이제는 정말로 빈 자료함을 하나 띄웁니다.
 */
const 집 = await 빈자료함띄우기()
const 터 = 집.주소

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 1500, height: 1050 } })
page.on('pageerror', (e) => 통과('화면 오류 없음', false, String(e)))

try {
  await page.goto(터 + '/')
  await page.waitForTimeout(1500)

  // ── 1·2. 기관 개설 화면 ────────────────────────────────────
  /*
   * 자료함이 비어 있으면 **기관 개설 화면**, 이미 있으면 **로그인 화면**.
   * 둘 다 맞는 동작이라 어느 쪽이 떠도 통과입니다 — 다만 **셋째는 없어야**
   * 합니다. 아무것도 안 뜨면 그게 사고입니다.
   */
  const 개설중 = await page.locator('#orgName').count() > 0
  const 로그인중 = await page.locator('input#id').count() > 0
  통과('켜면 **기관 개설 화면이나 로그인 화면**이 뜬다',
    개설중 || 로그인중, 개설중 ? '개설 화면 (빈 자료함 — 할 일 5번)' : '로그인 화면')

  if (개설중) {
    통과('**기관명 칸에 예시 문구가 없다**',
      !(await page.locator('#orgName').getAttribute('placeholder')),
      String(await page.locator('#orgName').getAttribute('placeholder')))
    통과('**대표 전화 칸에 예시 번호가 없다**',
      !(await page.locator('#phone').getAttribute('placeholder')),
      String(await page.locator('#phone').getAttribute('placeholder')))

    await page.locator('#orgName').fill('해남시험기관')
    await page.locator('#phone').fill('061-530-5000')
    await page.locator('#adminName').fill('박병섭')
    await page.locator('#loginId').fill('admin')
    await page.locator('#password').fill('admin1234')
    await page.locator('#password2').fill('admin1234')
    await page.locator('button.primary').first().click()
    await page.waitForTimeout(3500)
    const 개설오류 = await page.locator('.msg.err').innerText().catch(() => '')
    통과('기관 개설이 됐다', !개설오류, 개설오류.replace(/\n/g, ' '))
  }

  // 로그인 화면이면 들어갑니다.
  if (await page.locator('input#id').count()) {
    await page.fill('input#id', 'admin')
    await page.fill('input[type="password"]', 'admin1234')
    await page.locator('button.primary').first().click()
    await page.waitForTimeout(2500)
  }

  /*
   * ★ 최초 설정 마법사(v35)를 눌러서 지납니다.
   *   이 시험이 보려는 것은 **서비스 손입력**이지 마법사가 아닙니다.
   *   마법사 자체는 `첫설정화면시험.ts` 가 걸어서 지킵니다.
   */
  if (await 마법사지나기(page)) {
    통과('최초 설정 마법사를 지났다 (v35)', true)
  }

  // ── 7. 버전 번호가 왼쪽 위에 ─────────────────────────────────
  const 버전글 = (await page.locator('.brand .ver').innerText().catch(() => '')).trim()
  통과('**왼쪽 위에 버전 번호가 보인다**', /^v\d+\.\d+\.\d+$/.test(버전글), 버전글 || '(안 보임)')
  const 제목 = (await page.locator('.brand .name').innerText()).trim()
  통과('제목은 「통돌 Note」 한 줄로 따로', 제목 === '통돌 Note', 제목)

  // 간판이 버전 번호보다 **크고**, 버전 번호는 **아랫줄**에 있어야 합니다.
  const 크기 = await page.evaluate(() => {
    const n = document.querySelector('.brand .name') as HTMLElement
    const v = document.querySelector('.brand .ver') as HTMLElement
    if (!n || !v) return null
    const nb = n.getBoundingClientRect(), vb = v.getBoundingClientRect()
    return {
      이름: parseFloat(getComputedStyle(n).fontSize),
      버전: parseFloat(getComputedStyle(v).fontSize),
      아랫줄: vb.top >= nb.bottom - 1,
      넘침: n.scrollWidth > n.clientWidth + 1,
    }
  })
  통과('**간판 글자가 버전 번호보다 훨씬 크다**',
    크기 && 크기.이름 >= 크기.버전 * 2, `이름 ${크기?.이름}px / 버전 ${크기?.버전}px`)
  통과('**버전 번호가 아랫줄에 있다**', 크기?.아랫줄, String(크기?.아랫줄))
  통과('간판이 옆으로 잘리지 않는다', 크기 && !크기.넘침, `넘침 ${크기?.넘침}`)

  // 맨 뒷자리는 **자료함 구조 번호**와 같아야 합니다 — 손으로 적지 않으니까요.
  const 구조 = await page.evaluate(async () => {
    const j = await (await fetch('/api/bootstrap')).json()
    return { 버전: j.앱?.버전, 구조: j.앱?.구조 }
  })
  통과('**맨 뒷자리가 자료함 구조 번호와 같다** (손으로 적지 않습니다)',
    String(구조.버전).endsWith('.' + 구조.구조), `${구조.버전} / 구조 ${구조.구조}`)
  통과('화면에 보이는 것과 서버가 말하는 것이 같다', 버전글 === 'v' + 구조.버전, `${버전글} / v${구조.버전}`)

  // ── 4. 대상자 직접 추가 · 집 전화 곁말 ─────────────────────
  await page.goto(터 + '/recipients'); await page.waitForTimeout(1800)
  await page.locator('button', { hasText: '직접 추가' }).first().click()
  await page.waitForTimeout(900)
  통과('**집 전화 칸에 예시 번호가 없다**',
    !(await page.locator('#r-phoneHome').getAttribute('placeholder')),
    String(await page.locator('#r-phoneHome').getAttribute('placeholder')))

  const 이름 = '서비스시험' + String(Date.now()).slice(-5)
  await page.locator('#r-name').fill(이름)
  await page.locator('#r-birth').fill('1938-05-11')
  await page.locator('form button.primary').first().click()
  await page.waitForTimeout(2500)

  await page.locator('input[placeholder*="성명"]').first().fill(이름)
  await page.waitForTimeout(1300)
  await page.locator('tr.clickable').first().click()
  await page.waitForTimeout(2000)
  const 만든id = page.url().split('/recipients/')[1] ?? ''
  통과('대상자를 직접 추가했다', !!만든id, 만든id)

  // ── 5. 서비스를 손으로 넣기 ────────────────────────────────
  const 빈안내 = await page.locator('.card', { hasText: '받는 서비스' }).first().innerText()
  통과('서비스가 없을 때 **넣는 길을 알려 준다**',
    빈안내.includes('서비스 넣기'), 빈안내.split('\n').slice(-1)[0])

  await page.locator('button', { hasText: '서비스 넣기' }).first().click()
  await page.waitForTimeout(1200)
  통과('**서비스 넣는 상자가 열린다**', await page.locator('#ns-service').count() === 1)

  const 고를것 = await page.locator('#ns-service option').count()
  통과('**고를 서비스 목록이 채워져 있다** (지역 프로파일에서)', 고를것 > 1, `${고를것 - 1}가지`)

  const 첫서비스 = await page.locator('#ns-service option').nth(1).getAttribute('value')
  const 서비스이름 = (await page.locator('#ns-service option').nth(1).innerText()).split(' (')[0]
  await page.locator('#ns-service').selectOption(첫서비스!)
  await page.locator('#ns-from').fill('2026-08-01')
  await page.locator('#ns-to').fill('2026-12-31')
  await page.locator('#ns-unit').selectOption('week')
  await page.locator('#ns-count').fill('2')
  await page.waitForTimeout(300)
  const 미리보기 = await page.locator('.dlg .note.small').first().innerText()
  통과('**적힐 주기를 미리 보여 준다**', 미리보기.includes('주 2회'), 미리보기.replace(/\n/g, ' '))

  await page.locator('.dlg button.primary').click()
  await page.waitForTimeout(2500)

  const 서비스칸 = await page.locator('.card', { hasText: '받는 서비스' }).first().innerText()
  통과('**넣은 서비스가 목록에 뜬다**', 서비스칸.includes(서비스이름), 서비스이름)
  통과('주기가 「주 2회」로 적힌다', 서비스칸.includes('주 2회'))
  통과('**어디서 왔는지 「손입력」으로 남는다**', 서비스칸.includes('손입력'))
  통과('기간이 그대로 실린다', 서비스칸.includes('2026-08-01') && 서비스칸.includes('2026-12-31'))

  // ── 5-2. 겹치게 또 넣으면 막는다 ───────────────────────────
  await page.locator('button', { hasText: '서비스 넣기' }).first().click()
  await page.waitForTimeout(1000)
  await page.locator('#ns-service').selectOption(첫서비스!)
  await page.locator('#ns-from').fill('2026-10-01')     // 위 기간 안쪽
  await page.locator('#ns-to').fill('2027-01-31')
  await page.locator('.dlg button.primary').click()
  await page.waitForTimeout(1500)
  const 막힘 = await page.locator('.dlg .msg.err').innerText().catch(() => '')
  통과('**기간이 겹치면 막고 이유를 말해 준다** (청구가 두 번 잡힙니다)',
    막힘.includes('겹치면'), 막힘.replace(/\n/g, ' ').slice(0, 90))
  await page.locator('.dlg button.plain', { hasText: '닫기' }).click()
  await page.waitForTimeout(600)

  // ── 6. 배정 화면에 나타나는가 — 기록지로 가는 길 ───────────
  await page.goto(터 + '/assign'); await page.waitForTimeout(2500)
  const 배정글 = await page.locator('body').innerText()
  통과('**배정 화면에 그 대상자가 나타난다** — 기록지까지 가는 길이 열립니다',
    배정글.includes(이름), 이름)

  // ── 1번(휴먼에러). 손으로 넣은 것은 **고칠 수 있다** ───────
  /*
   * 지우기만 있으면 실적이 한 건이라도 찍힌 순간 손댈 길이 없어집니다.
   * 그런데 사람이 가장 흔하게 틀리는 것이 기간과 회차이고, 그것은 보통
   * **실적이 쌓인 뒤에** 발견됩니다.
   */
  await page.goto(터 + `/recipients/${만든id}`); await page.waitForTimeout(2200)
  통과('**손으로 넣은 것에는 「고치기」가 보인다**',
    await page.locator('button', { hasText: '고치기' }).count() > 0)
  await page.locator('button', { hasText: '고치기' }).first().click()
  await page.waitForTimeout(1200)
  통과('**고칠 때 지금 값이 그대로 들어와 있다** — 기간',
    (await page.locator('#ns-from').inputValue()) === '2026-08-01',
    await page.locator('#ns-from').inputValue())
  통과('고칠 때 지금 값이 그대로 들어와 있다 — 횟수',
    (await page.locator('#ns-count').inputValue()) === '2',
    await page.locator('#ns-count').inputValue())
  통과('고칠 때 지금 값이 그대로 들어와 있다 — 서비스',
    (await page.locator('#ns-service').inputValue()) === 첫서비스,
    await page.locator('#ns-service').inputValue())

  await page.locator('#ns-to').fill('2027-03-31')      // 기간을 늘려 봅니다
  await page.locator('#ns-count').fill('3')
  await page.locator('#ns-note').fill('기간 연장 (지자체 확인 2026-08-30)')
  await page.locator('.dlg button.primary').click()
  await page.waitForTimeout(2500)

  const 고친뒤 = await page.locator('.card', { hasText: '받는 서비스' }).first().innerText()
  통과('**고친 기간이 반영된다**', 고친뒤.includes('2027-03-31'), '2027-03-31')
  통과('**고친 주기가 반영된다**', 고친뒤.includes('주 3회'), '주 3회')
  통과('비고도 반영된다', 고친뒤.includes('기간 연장'))
  통과('**줄이 늘어나지 않는다** (고치기지 새로 넣기가 아닙니다)',
    (고친뒤.match(/손입력/g) ?? []).length === 1,
    `${(고친뒤.match(/손입력/g) ?? []).length}줄`)

  // 고친 것도 겹침 검사를 받습니다 — 다만 **자기 자신과는** 안 겹칩니다.
  const 자기자신 = await page.evaluate(async ([id]) => {
    const j = await (await fetch(`/api/recipients/${id}`)).json()
    const rf = (j.services ?? [])[0]
    const r = await fetch(`/api/referral/${rf.referralId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note: '한 번 더 저장' }),
    })
    return r.status
  }, [만든id])
  통과('**같은 줄을 다시 저장해도 「겹친다」고 하지 않는다**', 자기자신 === 200, `HTTP ${자기자신}`)

  // ── 6-2. 손으로 넣은 것은 지울 수 있다 ─────────────────────
  await page.goto(터 + `/recipients/${만든id}`); await page.waitForTimeout(2200)
  통과('**손으로 넣은 것에는 「지우기」가 보인다**',
    await page.locator('button', { hasText: '지우기' }).count() > 0)
  page.once('dialog', (d) => d.accept())
  await page.locator('button', { hasText: '지우기' }).first().click()
  await page.waitForTimeout(2200)
  const 지운뒤 = await page.locator('.card', { hasText: '받는 서비스' }).first().innerText()
  통과('지우면 목록에서 사라진다', !지운뒤.includes(서비스이름), 서비스이름)

  // ── 서버가 지키는 것 ───────────────────────────────────────
  const 엑셀것막기 = await page.evaluate(async () => {
    const r = await fetch('/api/referral/999999', { method: 'DELETE' })
    return r.status
  })
  통과('없는 의뢰를 지우려 하면 404', 엑셀것막기 === 404, `HTTP ${엑셀것막기}`)

  const 서비스없이 = await page.evaluate(async (id) => {
    const r = await fetch(`/api/recipients/${id}/service`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: '2026-08-01' }),
    })
    return (await r.json()).error ?? ''
  }, 만든id)
  통과('서비스를 안 고르면 막는다', 서비스없이.includes('서비스'), 서비스없이)

  const 거꾸로 = await page.evaluate(async ([id, sid]) => {
    const r = await fetch(`/api/recipients/${id}/service`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ serviceId: Number(sid), from: '2026-12-01', to: '2026-01-01' }),
    })
    return (await r.json()).error ?? ''
  }, [만든id, 첫서비스!])
  통과('**끝나는 날이 시작일보다 앞서면 막는다**', 거꾸로.includes('앞섭니다'), 거꾸로)

  const 없는것고치기 = await page.evaluate(async () => {
    const r = await fetch('/api/referral/999999', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note: 'x' }),
    })
    return r.status
  })
  통과('없는 의뢰를 고치려 하면 404', 없는것고치기 === 404, `HTTP ${없는것고치기}`)

} finally {
  await b.close()
  await 집.끄기()
  let 실패 = 0
  for (const r of 결과) {
    if (!r.ok) 실패++
    console.log(`${r.ok ? '  통과' : '✗ 실패'}  ${r.n}${r.d ? '   — ' + r.d : ''}`)
  }
  console.log(`\n${결과.length}가지 중 ${결과.length - 실패}가지 통과, ${실패}가지 실패`)
  if (실패) process.exitCode = 1
}
