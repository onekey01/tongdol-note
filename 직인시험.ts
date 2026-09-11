/**
 * 직인이 **서식 안에 제대로 들어가는가** — B-1 뒷마무리.
 *
 *   bun 직인시험.ts
 *
 * ── 그림 하나에 세 곳이 맞아야 합니다 ──────────────────────────
 *
 * hwpx 에 그림을 넣으려면 **세 곳**을 함께 손대야 합니다 —
 *
 *   1. 꾸러미 안의 `BinData/stampN.png`
 *   2. `Contents/content.hpf` 의 목록에 그 파일
 *   3. 문단 안의 `<hp:pic>` 이 `binaryItemIDRef` 로 그걸 가리킴
 *
 * 하나라도 어긋나면 한글은 **「알 수 없는 오류입니다」**만 내놓습니다.
 * 2026-09-01 에 나흘을 그렇게 헤맸으므로, 여기서는 셋을 다 세어 봅니다.
 * 그리고 **모든 XML 이 XML 로 읽히는지**도 봅니다 — 그날의 진짜 원인이었습니다.
 *
 * 못박는 것 —
 *   1) 직인이 없으면 아무것도 안 넣는다 (「(인)」만 남습니다)
 *   2) 직인이 있으면 세 곳이 다 생긴다
 *   3) **「(인)」은 그대로 남는다** — 서식이 적어 둔 글자입니다
 *   4) 글자 수가 안 바뀐다 — 떠 있는 그림이라 줄 정보가 그대로입니다
 *   5) 꾸러미의 모든 XML 이 여전히 XML 로 읽힌다
 *   6) 「◯◯◯◯제공기관」이 통째로 기관 이름이 된다
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Hwpx } from './server/hwpx'
import { Zip } from './server/zip'
import { find, plain } from './server/xml'
import { 서식폴더 } from './server/서식자리'
import { db, initDb } from './server/db'
import { 살피기 } from './서식열림시험'
initDb()

let 통과수 = 0, 실패수 = 0
const 통과 = (n: string, ok: unknown, d = '') => {
  if (ok) { 통과수++; console.log(`  통과  ${n}${d ? '   — ' + d : ''}`) }
  else { 실패수++; console.log(`✗ 실패  ${n}${d ? '   — ' + d : ''}`) }
}

/** 진짜 PNG 한 장 (빨간 점 8×8). base64 로 박아 둡니다. */
const 시험직인 =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAKUlEQVQokWP8//8/AzGAiShV' +
  'oxpHNY5qHNU4qnFU46jGUY2jGkc1DjeNAJhcBAVjKmwUAAAAAElFTkSuQmCC'

const 값 = {
  거래번호: '2026-0001', 서비스명: '동행지원', 이용자명: '문재길',
  서비스가격: 34000, 정부지원금: 27200, 본인부담금: 6800,
  수령일: '2026-06-30', 발행일: '2026-09-01', 기관명: '해남돌봄센터',
}

const 원래직인: any = db.query('SELECT stamp_png FROM organization WHERE id = 1').get()
const { build } = await import('./server/영수증')

function 글전부(buf: Buffer): string {
  const d = new Hwpx(buf)
  return find((d as any).doc.root, 'p')
    .map((p) => find(p, 't').map((t) => plain(t)).join('')).join('\n')
}

try {
  // ── 1. 직인이 없을 때 ─────────────────────────────────────
  db.run('UPDATE organization SET stamp_png = NULL WHERE id = 1')
  const 민것 = build(값)
  const z1 = new Zip(민것)
  통과('**직인이 없으면 그림을 안 넣는다**',
    !z1.names().some((n) => n.startsWith('BinData/')), z1.names().join(' '))
  통과('그래도 「(인)」은 남는다 — 손도장을 찍으시면 됩니다',
    글전부(민것).includes('(인)'))
  통과('직인 없이도 성한 파일이다', 살피기(민것).length === 0, 살피기(민것).join(' · '))

  // ── 2. 직인이 있을 때 ─────────────────────────────────────
  db.run('UPDATE organization SET stamp_png = ? WHERE id = 1', [시험직인])
  const 찍은것 = build(값)
  const z2 = new Zip(찍은것)

  const 그림파일 = z2.names().filter((n) => n.startsWith('BinData/'))
  통과('**① 꾸러미에 그림 파일이 들어갔다**', 그림파일.length === 2,
    `${그림파일.length}장 — ${그림파일.join(' ')}  (영수증은 두 벌이라 둘)`)

  const hpf = z2.text('Contents/content.hpf')
  const 목록 = [...hpf.matchAll(/<opf:item id="(stamp\d+)"[^>]*href="([^"]+)"/g)]
  통과('**② content.hpf 목록에 적혔다**', 목록.length === 그림파일.length,
    목록.map((m) => `${m[1]}→${m[2]}`).join(' · '))
  통과('목록이 가리키는 파일이 진짜 있다',
    목록.every((m) => z2.names().includes(m[2])))

  const 구역 = z2.text('Contents/section0.xml')
  const 가리킴 = [...구역.matchAll(/binaryItemIDRef="(stamp\d+)"/g)].map((m) => m[1])
  통과('**③ 문단 안의 그림이 그것을 가리킨다**', 가리킴.length === 그림파일.length,
    가리킴.join(' · '))
  통과('**셋이 서로 아귀가 맞는다** — 하나만 어긋나도 한글이 못 엽니다',
    가리킴.every((id) => hpf.includes(`id="${id}"`)) &&
    목록.every((m) => 가리킴.includes(m[1])))

  // ── 3. 서식 글자는 그대로인가 ─────────────────────────────
  const 글 = 글전부(찍은것)
  /*
   * 바깥 칸 문단이 두 벌을 통째로 물고 있어 셈이 겹칩니다.
   * **두 벌 모두에 남아 있는가**만 봅니다.
   */
  const 벌 = 글.split('본인부담금 영수증').filter((x) => x.includes('보관'))
  통과('**「(인)」이 두 벌 모두에 그대로 남는다** — 서식이 적어 둔 글자입니다',
    벌.length >= 2 && 벌.every((x) => x.includes('(인)')), `${벌.length}벌`)
  통과('**「◯◯◯◯제공기관」이 통째로 기관 이름이 됐다**',
    /해남돌봄센터\s+대표 \(인\)/.test(글) && !글.includes('제공기관 대표'),
    (글.match(/해남돌봄센터.{0,12}/) ?? [''])[0])
  통과('◯◯◯◯ 가 안 남았다', !글.includes('◯◯◯◯'))

  // ── 4. 글자 수가 안 바뀌었나 (떠 있는 그림) ───────────────
  통과('**직인을 찍어도 글자는 한 자도 안 늘었다** — 떠 있는 그림입니다',
    글전부(민것) === 글)

  // ── 5. 파일이 성한가 ──────────────────────────────────────
  const 흠 = 살피기(찍은것)
  통과('**직인을 찍은 뒤에도 모든 XML 이 XML 로 읽힌다**', 흠.length === 0,
    흠.join(' · ') || '흠 없음')
  통과('원본 서식보다 파일이 커졌다 (그림이 들어갔으니)',
    찍은것.length > readFileSync(join(서식폴더(), '본인부담금 영수증(서식7).hwpx')).length,
    `${찍은것.length.toLocaleString('ko-KR')} 바이트`)

  // ── 6. 떠 있는 그림인지 (글자를 안 민다) ──────────────────
  통과('**글자가 아니라 떠 있는 그림이다** (treatAsChar="0")',
    /<hp:pos treatAsChar="0"[^>]*horzAlign="RIGHT"/.test(구역))
  통과('글자를 덮는다 — 종이에 도장 찍은 모습',
    구역.includes('textWrap="IN_FRONT_OF_TEXT"'))
} catch (e: any) {
  통과(`시험 도중 터짐 — ${e?.message ?? e}`, false)
} finally {
  db.run('UPDATE organization SET stamp_png = ? WHERE id = 1', [원래직인?.stamp_png ?? null])
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`)
  process.exit(실패수 ? 1 : 0)
}
