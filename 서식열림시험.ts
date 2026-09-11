/**
 * 서식이 **한글에서 열리는가** — 파일 자체의 앞뒤가 맞는지 봅니다.
 *
 *   bun 서식열림시험.ts
 *
 * ── 무슨 일이 있었나 (2026-09-01) ────────────────────────────────
 *
 * 뽑은 영수증이 한글에서 **「알 수 없는 오류입니다」**로 안 열렸습니다.
 * 채우기 코드를 두 번 고쳤는데도 그대로였고, 마지막에 **통돌 Note 가 전혀
 * 손대지 않은 원본 서식**을 열어 보니 그것도 똑같이 안 열렸습니다.
 * 범인은 채우기가 아니라 **편람에서 오려 내는 과정**이었습니다.
 *
 *     <ha:CaretPosition listIDRef="0" paraIDRef="36" pos="37"/>
 *
 * `settings.xml` 에 남아 있던 **편람 저장 당시의 커서 자리**입니다.
 * 「36번째 문단」은 오려 낸 서식에 없으니, 한글이 커서를 놓으려다 넘어집니다.
 * **서식 열다섯 장이 전부** 이 병을 앓고 있었고 아무도 몰랐습니다.
 *
 * ── 그래서 이 시험이 생겼습니다 ──────────────────────────────────
 *
 * 서식은 **채우기 전에 이미 성해야** 합니다. 여기서 서식 폴더의 모든 장을
 * 열어 「한글이 짚을 자리가 실제로 있는가」를 하나하나 봅니다.
 * 새 서식을 오려 넣을 때마다 이 시험이 먼저 걸러 줍니다.
 *
 * 못박는 것 —
 *   1) 커서 자리(paraIDRef)가 **실제로 있는 문단**을 가리킨다
 *   2) 빠진 구역이 없다 — content.hpf 가 말하는 것이 zip 안에 다 있다
 *   3) 지운 부품을 아직 가리키고 있지 않다 (그림·붙임)
 *   4) 글자 모양·문단 모양 번호가 header 에 다 정의돼 있다
 *   5) 용지 설정(secPr)이 첫 문단에 있다
 *   6) 짝이 있어야 하는 표시(fieldBegin/End)의 짝이 맞는다
 *   7) 채운 뒤에도 1~6 이 그대로다 (서식7 로 실제 확인)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { Zip } from './server/zip'
import { 서식폴더 } from './server/서식자리'
import { db, initDb } from './server/db'
initDb()

let 통과수 = 0, 실패수 = 0
const 통과 = (n: string, ok: unknown, d = '') => {
  if (ok) { 통과수++; console.log(`  통과  ${n}${d ? '   — ' + d : ''}`) }
  else { 실패수++; console.log(`✗ 실패  ${n}${d ? '   — ' + d : ''}`) }
}

/**
 * 이 글이 **XML 로 읽히는가.** 안 읽히면 무엇이 틀렸는지 돌려줍니다.
 *
 * ── 이 검사가 없어서 나흘을 헤맸습니다 (2026-09-01) ─────────────
 *
 * 서식 열네 장이 한글에서 안 열렸습니다. 저는 커서 자리·부품 목록·구역 수를
 * 하나씩 짚어 세 번 고쳐 배포했고 세 번 다 틀렸습니다. 진짜 원인은
 * `content.hpf` 가 **XML 로 아예 안 읽히는 것**이었습니다 —
 *
 *     <opf:title><서식7> 본인부담금 영수증</opf:title>
 *
 * 서식 이름의 꺾쇠를 감싸지 않고 넣어 `<서식7>` 이 여는 태그로 읽혔습니다.
 * **파일을 XML 로 읽어 보기만 했으면 첫날에 나왔을 일입니다.**
 * 그래서 이제 꾸러미 안의 모든 XML 을 읽어 봅니다. 짚지 않고 읽습니다.
 */
export function xml성한가(글: string): string | null {
  const 열린것: string[] = []
  let i = 0
  while (i < 글.length) {
    const lt = 글.indexOf('<', i)
    if (lt < 0) {
      if (글.slice(i).includes('>') === false) break
      break
    }
    // 태그 사이의 글자에는 날 것의 `<` 가 있을 수 없습니다 (위에서 이미 걸림)
    const gt = 글.indexOf('>', lt)
    if (gt < 0) return `여는 꺾쇠가 닫히지 않음 (${글.slice(lt, lt + 40)}…)`
    const 속 = 글.slice(lt + 1, gt)
    i = gt + 1
    if (속.startsWith('?') ||속.startsWith('!')) continue         // 선언·주석
    if (속.endsWith('/')) continue                                 // 혼자 닫는 태그
    if (속.startsWith('/')) {
      const 이름 = 속.slice(1).trim()
      const 마지막 = 열린것.pop()
      if (마지막 !== 이름)
        return `닫는 태그가 안 맞음 — 「${마지막 ?? '(없음)'}」 를 열어 두고 「${이름}」 를 닫음`
      continue
    }
    열린것.push(속.split(/[\s/>]/)[0])
  }
  if (열린것.length) return `닫지 않은 태그 — ${열린것.slice(-3).join(' > ')}`
  return null
}

/** 한 장을 살핍니다. 흠이 있으면 사람 말로 돌려줍니다. */
export function 살피기(버퍼: Buffer): string[] {
  const 흠: string[] = []
  const zip = new Zip(버퍼)
  const 있는파일 = new Set(zip.names())

  /*
   * ── 0. **모든 XML 이 XML 로 읽히는가** ───────────────────────
   * 다른 무엇보다 먼저 봅니다. 여기서 걸리면 나머지 검사는 뜻이 없습니다.
   */
  for (const n of [...있는파일].sort()) {
    if (!/\.(xml|hpf|rdf)$/i.test(n)) continue
    let 글: string
    try { 글 = zip.text(n) } catch { 흠.push(`${n} 을 읽지 못함`); continue }
    const 탈 = xml성한가(글)
    if (탈) 흠.push(`${n} 이 XML 로 안 읽힘 — ${탈}`)
  }
  const 구역 = zip.text('Contents/section0.xml')
  const 머리 = zip.text('Contents/header.xml')
  const 설정 = zip.text('settings.xml')
  const hpf = zip.text('Contents/content.hpf')

  // 1. 커서 자리 — **이것이 서식 15장을 전부 못 열게 했습니다**
  const c = /<ha:CaretPosition\b[^>]*\/>/.exec(설정)
  if (c) {
    const para = /paraIDRef="(\d+)"/.exec(c[0])?.[1]
    const 있는id = new Set([...구역.matchAll(/<hp:p\b[^>]*\bid="(\d+)"/g)].map((m) => m[1]))
    if (para !== undefined && !있는id.has(para))
      흠.push(`커서가 없는 문단 ${para} 을 가리킴 — 한글이 「알 수 없는 오류」를 냅니다`)
  }

  // 2. content.hpf 가 말하는 것이 실제로 들어 있는가
  for (const href of [...hpf.matchAll(/href="([^"]+)"/g)].map((m) => m[1])) {
    const 길 = href.startsWith('Contents/') || href.includes('/') ? href : href
    const 후보 = [길, 'Contents/' + 길]
    if (!후보.some((x) => 있는파일.has(x))) 흠.push(`content.hpf 가 말하는 ${href} 가 없음`)
  }
  for (let i = 1; i < 50; i++)
    if (new RegExp(`idref="section${i}"`).test(hpf)) 흠.push(`없는 구역 section${i} 을 아직 가리킴`)

  /*
   * 2-나. **container.rdf** — 꾸러미를 설명하는 **두 번째** 종이입니다.
   *
   * `content.hpf` 만 보고 여기를 안 봐서 서식 열다섯 장이 전부 안 열렸습니다.
   * 편람의 구역 다섯 중 넷을 들어냈는데 이 파일은 넷을 아직 부품이라고
   * 말하고 있었고, 한글은 그 목록대로 불러오려다 넘어졌습니다.
   */
  if (있는파일.has('META-INF/container.rdf')) {
    const rdf = zip.text('META-INF/container.rdf')
    const 가리킴 = [...rdf.matchAll(/(?:rdf:resource|rdf:about)="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((x) => x && !x.startsWith('http') && x.includes('/'))
    const 없는것 = [...new Set(가리킴.filter((x) => !있는파일.has(x)))]
    if (없는것.length)
      흠.push(`container.rdf 가 없는 부품 ${없는것.join(' · ')} 을 가리킴 — ` +
              `한글이 「알 수 없는 오류」를 냅니다`)
  }

  /*
   * 2-다. **「몇 개다」라고 선언한 숫자를 전부 세어 봅니다.**
   *
   * 여기서 하나씩 짚어 가는 방식을 그만두었습니다. hwpx 는 곳곳에
   * 「이 안에 몇 개가 들었다」를 미리 적어 둡니다 —
   *
   *     <hh:head secCnt="5">              구역이 다섯
   *     <hh:charProperties itemCnt="544"> 글자 모양이 544가지
   *     <hh:fontface fontCnt="25">        글꼴이 25가지
   *
   * 적힌 수와 실제가 다르면 한글은 없는 것을 찾다가 넘어집니다.
   * **`secCnt` 가 그랬습니다** — 편람에서 서식 한 장만 오려 냈는데
   * 「구역이 다섯」이라고 적힌 채였습니다. 그래서 이제 **짚지 않고 셉니다.**
   */
  {
    const 머리끝 = 머리.indexOf('>', 머리.indexOf('<hh:head'))
    const 여는태그 = 머리.slice(0, 머리끝 + 1)
    const 구역수 = [...있는파일].filter((n) => /^Contents\/section\d+\.xml$/.test(n)).length
    const dec = /\bsecCnt="(\d+)"/.exec(여는태그)
    if (dec && Number(dec[1]) !== 구역수)
      흠.push(`header 가 구역이 ${dec[1]}개라고 선언 (실제 ${구역수}개) — ` +
              `한글이 없는 구역을 찾다가 「알 수 없는 오류」를 냅니다`)

    // 나머지 itemCnt·fontCnt 도 모두 자식 수와 견줍니다
    for (const m of 머리.matchAll(/<(hh:\w+)\b[^>]*?\b(\w*[Cc]nt)="(\d+)"[^>]*>/g)) {
      const [, 태그, 이름, 값] = m
      if (태그 === 'hh:head') continue
      const 닫기 = 머리.indexOf(`</${태그}>`, m.index! + m[0].length)
      if (닫기 < 0) continue
      const 속 = 머리.slice(m.index! + m[0].length, 닫기)
      const 첫 = /<(hh:\w+)/.exec(속)
      if (!첫) continue
      const 직속 = [...속.matchAll(new RegExp(`<${첫[1]}\\b`, 'g'))].length
      if (직속 !== Number(값))
        흠.push(`<${태그} ${이름}="${값}"> 인데 실제로는 ${직속}개`)
    }
  }

  // 3. 지운 그림·붙임을 아직 가리키나
  const 붙임 = new Set([
    ...[...구역.matchAll(/bin(?:ary)?ItemIDRef="([^"]+)"/g)].map((m) => m[1]),
    ...[...머리.matchAll(/bin(?:ary)?ItemIDRef="([^"]+)"/g)].map((m) => m[1]),
  ])
  if (붙임.size && ![...있는파일].some((n) => n.startsWith('BinData/')))
    흠.push(`지운 그림·붙임 ${[...붙임].slice(0, 5).join(',')} 을 아직 가리킴`)

  // 4. 번호가 header 에 다 있는가
  for (const [ref, defn] of [
    ['charPrIDRef', 'hh:charPr'], ['paraPrIDRef', 'hh:paraPr'],
    ['styleIDRef', 'hh:style'], ['borderFillIDRef', 'hh:borderFill'],
  ] as const) {
    const 쓴것 = new Set([...구역.matchAll(new RegExp(`${ref}="(\\d+)"`, 'g'))].map((m) => m[1]))
    const 있는것 = new Set(
      [...머리.matchAll(new RegExp(`<${defn}[^>]*\\bid="(\\d+)"`, 'g'))].map((m) => m[1]))
    const 없는것 = [...쓴것].filter((x) => !있는것.has(x))
    if (없는것.length) 흠.push(`${ref} ${없는것.slice(0, 5).join(',')} 이 header 에 없음`)
  }

  // 5. 용지 설정
  const 첫문단 = /<hp:p\b[\s\S]*?<\/hp:p>/.exec(구역)?.[0] ?? ''
  if (!첫문단.includes('<hp:secPr')) 흠.push('첫 문단에 용지 설정(secPr)이 없음')

  // 6. 짝
  if (구역.split('fieldBegin').length !== 구역.split('fieldEnd').length)
    흠.push('fieldBegin 과 fieldEnd 의 짝이 안 맞음')

  return 흠
}

/*
 * 아래는 **혼자 돌릴 때만** 움직입니다. `살피기` 는 다른 곳에서도
 * 가져다 쓰라고 밖에 내어 둡니다 (지킴이·서식오리기).
 */
if (import.meta.main) {
  // ── 1~6. 서식 폴더 전부 ──────────────────────────────────────────
  const 폴더 = 서식폴더()
  통과('서식 폴더가 있다', existsSync(폴더), 폴더)

  const 파일들 = existsSync(폴더)
    ? readdirSync(폴더).filter((f) => f.endsWith('.hwpx')).sort() : []
  통과('서식이 들어 있다', 파일들.length > 0, `${파일들.length}장`)

  console.log('\n── 서식 한 장씩 ────────────────────────────────────────\n')
  let 성한것 = 0
  for (const f of 파일들) {
    const 흠 = 살피기(readFileSync(join(폴더, f)))
    통과(f, 흠.length === 0, 흠.join(' · '))
    if (!흠.length) 성한것++
  }
  통과(`**서식 ${파일들.length}장이 모두 성하다**`, 성한것 === 파일들.length,
    `${성한것}/${파일들.length}`)

  // ── 7. 채운 뒤에도 그대로인가 ────────────────────────────────────
  console.log('\n── 채운 뒤에도 성한가 (서식7 로 확인) ──────────────────\n')
  {
    const { build } = await import('./server/영수증')
    const 나온것 = build({
      거래번호: '2026-0001', 서비스명: '동행지원', 이용자명: '문재길',
      서비스가격: 34000, 정부지원금: 27200, 본인부담금: 6800,
      수령일: '2026-06-30', 발행일: '2026-09-01', 기관명: '해남돌봄센터',
    })
    const 흠 = 살피기(나온것)
    통과('**채운 영수증도 성하다**', 흠.length === 0, 흠.join(' · ') || '흠 없음')

    // 커서가 실제로 맨 앞을 가리키는지 눈으로도 확인
    const 설정 = new Zip(나온것).text('settings.xml')
    통과('채운 뒤에도 커서가 있는 문단을 가리킨다',
      /paraIDRef="0"|paraIDRef="2147483648"/.test(설정),
      /<ha:CaretPosition[^>]*\/>/.exec(설정)?.[0] ?? '(없음)')
  }

  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`)
  process.exit(실패수 ? 1 : 0)

}
