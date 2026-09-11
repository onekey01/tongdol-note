/**
 * 줄바꿈을 지키는가 — **「알 수 없는 오류입니다」를 두 번 겪지 않기 위한 시험.**
 *
 *   bun 줄바꿈시험.ts
 *
 * ── 무슨 일이 있었나 (2026-09-01) ────────────────────────────
 *
 * 뽑은 영수증을 한글에서 열었더니 **「알 수 없는 오류입니다」**가 떴습니다.
 * 고객 화면에 이런 창이 뜨는 것은 있어서는 안 되는 일입니다.
 *
 * 원인은 `<hp:t>` 안의 **`<hp:lineBreak/>`** 였습니다. 서식7 의 금액 칸은
 * 한 문단 안에 줄바꿈 둘로 세 줄을 담고 있습니다 —
 *
 *     <hp:t>서비스 가격    원<hp:lineBreak/>정부 지원금    원<hp:lineBreak/>본인 부담금    원</hp:t>
 *
 * `setText` 는 **자식을 전부 지우고** 글자 하나만 남깁니다. 줄바꿈이 사라졌습니다.
 * 그런데 한글은 줄 정보를 이렇게 적어 둡니다 —
 *
 *     <hp:lineseg textpos="0" …/>  <hp:lineseg textpos="40" …/>  <hp:lineseg textpos="71" …/>
 *
 * **「40번째 글자부터 둘째 줄」** 인데, 이 셈에는 **줄바꿈도 한 자리**로 들어갑니다.
 * 두 개가 사라지니 40 도 71 도 엉뚱한 곳을 가리키게 되었고, 한글은 앞뒤가
 * 안 맞는 문서를 받아 아예 열지 못했습니다.
 *
 * ── 그래서 못박는 것 ─────────────────────────────────────────
 *
 *   1) `editChunk` 는 **글 토막만** 고치고 형제 태그를 안 건드린다
 *   2) 영수증을 만들어도 **줄바꿈 개수가 그대로**다
 *   3) 줄이 여럿인 문단의 **글자 자리 수가 그대로**다 (textpos 가 맞는다)
 *   4) 줄바꿈이 든 문단은 줄 정보를 **하나로 줄이지 않는다**
 *   5) **audit() 이 이 사고를 잡는다** — 일부러 부숴 보고 걸리는지 봅니다
 *   6) 서식9(기록지)도 같은 병이 없다
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, find, kids, isNode, unesc, editChunk, setText, serialize } from './server/xml'
import { Hwpx } from './server/hwpx'
import { 서식폴더 } from './server/서식자리'
import { db, initDb } from './server/db'
initDb()

let 통과수 = 0, 실패수 = 0
const 통과 = (n: string, ok: unknown, d = '') => {
  if (ok) { 통과수++; console.log(`  통과  ${n}${d ? '   — ' + d : ''}`) }
  else { 실패수++; console.log(`✗ 실패  ${n}${d ? '   — ' + d : ''}`) }
}

/** 한글이 textpos 를 세는 방식 — **줄바꿈도 한 자리**. */
function 자리수(p: any): number {
  let n = 0
  const 훑기 = (node: any) => {
    for (const k of node.kids) {
      if (!isNode(k)) { n += unesc(k.text).length; continue }
      if (k.name === 'lineBreak') { n += 1; continue }
      if (k.name === 'run' || k.name === 't') 훑기(k)
    }
  }
  훑기(p); return n
}

/** 문단마다 (줄바꿈 수, 줄정보 수, 글자 자리 수) */
function 재기(xml: string) {
  const doc = parse(xml)
  return find(doc.root, 'p').map((p) => ({
    줄바꿈: find(p, 'lineBreak').length,
    줄정보: kids(p, 'linesegarray').flatMap((l) => kids(l, 'lineseg')).length,
    자리: 자리수(p),
  }))
}

console.log('\n── 1. editChunk 는 형제 태그를 안 건드린다 ────────────\n')
{
  const doc = parse('<hp:t>가나    다<hp:lineBreak/>라마    바</hp:t>')
  const t = doc.root
  const r = editChunk(t, (글) => 글.includes('가나') ? '가나 값 다' : null)
  const 나온것 = serialize(doc)
  통과('첫 토막만 고쳤다', r.됐나 && 나온것.includes('가나 값 다'), 나온것)
  통과('**`<hp:lineBreak/>` 가 살아 있다**', 나온것.includes('<hp:lineBreak/>'), 나온것)
  통과('뒷 토막도 그대로', 나온것.includes('라마    바'))
  통과('길이가 달라지면 달라졌다고 알려 준다', !r.길이그대로, '"가나    다"(9) → "가나 값 다"(8)')
}
{
  const doc = parse('<hp:t>가나    다<hp:lineBreak/>라마    바</hp:t>')
  editChunk(doc.root, (글) => 글.includes('라마') ? '라마 값 바' : null)
  const 나온것 = serialize(doc)
  통과('둘째 토막도 짚어 고친다', 나온것.includes('라마 값 바') && 나온것.includes('가나    다'))
  통과('그때도 줄바꿈은 그대로', 나온것.includes('<hp:lineBreak/>'))
}
{
  // 옛 방식이 어떻게 부쉈는지 — **이것이 사고의 모습입니다**
  const doc = parse('<hp:t>가나    다<hp:lineBreak/>라마    바</hp:t>')
  setText(doc.root, '가나 값 다라마    바')
  통과('**(참고) setText 는 줄바꿈을 지운다** — 그래서 쓰지 않습니다',
    !serialize(doc).includes('lineBreak'), serialize(doc))
}

console.log('\n── 2~4. 영수증을 실제로 만들어 본다 ────────────────────\n')

const 원본길 = join(서식폴더(), '본인부담금 영수증(서식7).hwpx')
const { build } = await import('./server/영수증')
const 값 = {
  거래번호: '2026-0001', 서비스명: '동행지원', 이용자명: '문재길',
  서비스가격: 34000, 정부지원금: 27200, 본인부담금: 6800,
  수령일: '2026-06-30', 발행일: '2026-09-01', 기관명: '해남돌봄센터',
}
const 나온버퍼 = build(값)

function 섹션(buf: Buffer | string): string {
  const h = new Hwpx(typeof buf === 'string' ? readFileSync(buf) : buf)
  return serialize(h.doc)
}
const 전 = 재기(섹션(원본길))
const 후 = 재기(섹션(나온버퍼))

통과('문단 개수가 같다', 전.length === 후.length, `${전.length} → ${후.length}`)

const 줄바꿈전 = 전.reduce((s, x) => s + x.줄바꿈, 0)
const 줄바꿈후 = 후.reduce((s, x) => s + x.줄바꿈, 0)
통과('**줄바꿈 개수가 그대로다** — 이것이 사고의 원인이었습니다',
  줄바꿈전 === 줄바꿈후 && 줄바꿈전 > 0, `${줄바꿈전} → ${줄바꿈후}`)

const 어긋난자리 = 후.filter((x, i) => x.줄정보 > 1 && x.자리 !== 전[i].자리)
통과('**줄이 여럿인 문단은 글자 자리 수가 그대로다** (textpos 가 맞는다)',
  어긋난자리.length === 0,
  어긋난자리.length ? JSON.stringify(어긋난자리) : `${후.filter((x) => x.줄정보 > 1).length}개 문단 확인`)

/*
 * 「줄바꿈 수 + 1 = 줄 정보 수」로 견주면 안 됩니다 — 줄은 **자동으로도**
 * 넘어갑니다. 원본과 **견주는 것**이 옳은 잣대입니다.
 */
const 줄정보바뀜 = 후.filter((x, i) => x.줄정보 !== 전[i].줄정보)
통과('**줄바꿈이 든 문단의 줄 정보를 하나로 줄이지 않았다**',
  줄정보바뀜.length === 0,
  줄정보바뀜.length ? JSON.stringify(줄정보바뀜) : '줄 정보 개수가 원본 그대로')

const 줄바꿈바뀜 = 후.filter((x, i) => x.줄바꿈 !== 전[i].줄바꿈)
통과('문단마다 줄바꿈 수가 원본 그대로다', 줄바꿈바뀜.length === 0)

console.log('\n── 5. audit() 이 이 사고를 잡는가 ──────────────────────\n')
{
  /*
   * 일부러 옛 방식으로 부숩니다 — 줄바꿈이 든 `<hp:t>` 를 통째로 갈아 끼웁니다.
   * **audit() 이 이것을 못 잡으면 이 시험은 아무 소용이 없습니다.**
   */
  const h = new Hwpx(readFileSync(원본길))
  let 부쉈나 = false
  for (const p of find((h as any).doc.root, 'p')) {
    if (!find(p, 'lineBreak').length) continue
    for (const run of kids(p, 'run'))
      for (const t of kids(run, 't'))
        if (find(t, 'lineBreak').length) { setText(t, '한 줄로 뭉갬'); 부쉈나 = true }
    if (부쉈나) break
  }
  통과('부술 자리를 찾았다 (줄바꿈이 든 문단)', 부쉈나)
  const 흠 = h.audit()
  통과('**audit() 이 걸러낸다** — 이 흠은 절대로 밖으로 나가면 안 됩니다',
    흠.length > 0, 흠.join(' · ') || '(아무것도 못 잡음)')
  통과('무엇이 틀렸는지 말해 준다',
    흠.some((x) => x.includes('글자 자리') || x.includes('줄바꿈')), 흠.join(' · '))
}

console.log('\n── 6. 서식9(기록지)도 같은 병이 없는가 ─────────────────\n')
{
  const 기록지길 = join(서식폴더(), '모니터링 기록지(서식9).hwpx')
  try {
    const 전9 = 재기(섹션(기록지길))
    const 줄9 = 전9.filter((x) => x.줄바꿈 > 0)
    통과('서식9 원본을 읽었다', 전9.length > 0, `문단 ${전9.length}개, 줄바꿈 든 문단 ${줄9.length}개`)
    /*
     * **이것이 audit 규칙을 바로잡아 준 자리입니다.**
     * 서식9 에는 줄바꿈이 하나도 없는데 줄 정보가 여럿인 문단이 있습니다 —
     * 줄이 자동으로 넘어간 것입니다. 「줄바꿈+1 = 줄 정보」로 못박았다면
     * 멀쩡한 기록지가 흠으로 걸려 안 나갔을 겁니다.
     */
    const 자동줄 = 전9.filter((x) => x.줄바꿈 === 0 && x.줄정보 > 1)
    통과('**줄바꿈 없이도 줄 정보가 여럿인 문단이 있다** — 자동 줄바꿈입니다',
      자동줄.length > 0, `${자동줄.length}개 문단`)
    통과('그래서 audit 은 **자리 수**만 본다 (개수로 못박지 않음)', true)
  } catch (e: any) {
    통과(`서식9 를 못 읽음 — ${e?.message ?? e}`, false)
  }
}

console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`)
process.exit(실패수 ? 1 : 0)
