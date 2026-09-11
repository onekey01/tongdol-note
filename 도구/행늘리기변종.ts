/**
 * ── 행 늘리기 변종 만들기 ────────────────────────────────────
 *
 * 「행을 복제하면 한글이 파일을 열지 않는다」가 오래된 규칙이었습니다.
 * 이번엔 **다섯 곳**(rowCnt · rowAddr · 표 높이 · 감싼 문단 lineseg · 기준값)
 * 을 다 맞췄습니다. 그런데 그게 맞는지는 **한글에게 직접 물어봐야** 압니다.
 *
 * 그래서 한 벌만 만들지 않고, **무엇을 안 고쳤을 때 안 열리는지**까지
 * 알 수 있게 변종을 만듭니다. 지난번 서식7 때 이 방법이 답을 줬습니다 —
 * 「B 는 열리는데 진짜 서식7은 안 열린다」가 원인을 짚어 줬습니다.
 *
 * 그 물음에는 답이 났습니다 — **여섯 장 다 열립니다.** 열림을 가르는 것은
 * rowCnt 와 rowAddr 뿐이고, 표 높이·lineseg 는 종이가 제대로 보이게 하는
 * 것이었습니다. 테두리도 「가운데 빈 줄을 본뜬다」로 잡았습니다.
 *
 * ── 이번에 볼 것: 쪽 넘김 ───────────────────────────────────
 *
 * 줄을 늘리니 표가 한 쪽을 넘었고, 그러자 **표가 통째로 다음 쪽으로**
 * 넘어갔습니다. 표가 「글자처럼 취급」이라 글자 한 개처럼 줄바꿈된 것입니다.
 * 취급을 끄면 `pageBreak="CELL"` 이 살아나 쪽을 넘어가며 이어집니다.
 *
 *   A  6줄 늘림 + 글자처럼 취급 끔   ← **우리가 쓰려는 것**
 *   B  6줄 늘림만 (취급 그대로)      ← 무무 님이 보신 그 증상
 *   C  손 안 대고 취급만 끔          ← 취급 끄기 하나만 따로 보기
 *   F  손 안 댐                      ← 견줄 자리
 *
 *   bun 도구/행늘리기변종.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Hwpx } from "../server/hwpx";
import { parse, find, attr, kids } from "../server/xml";
import { Zip } from "../server/zip";

const 서식길 = join(import.meta.dir, "..", "서식",
  "개인별 서비스 비용총괄(서식8).hwpx");
const 낼곳 = join(import.meta.dir, "..", "산출", "행늘리기");
mkdirSync(낼곳, { recursive: true });

const 원본 = readFileSync(서식길);
/*
 * **가운데 빈 줄**을 본뜹니다(r13). 마지막 줄(r14)은 아래 테두리가
 * 굵은 실선 0.7mm 이라, 본뜨면 그 굵은 줄이 표 한가운데 그어집니다 —
 * 처음 시험지에서 무무 님이 바로 알아보신 것이 이것이었습니다.
 */
const 본뜰행자리 = 13;

type 변종 = { 표: string; 설명: string; 몇줄: number; 취급끔?: boolean };
const 변종들: 변종[] = [
  { 표: "A", 설명: "6줄 늘림 + 취급 끔", 몇줄: 6, 취급끔: true },
  { 표: "B", 설명: "6줄 늘림만", 몇줄: 6 },
  { 표: "C", 설명: "취급만 끔", 몇줄: 0, 취급끔: true },
  { 표: "F", 설명: "손 안 댐 (견줄 자리)", 몇줄: 0 },
];

console.log("변종  설명                    행  바이트  XML   표가 놓인 방식");
console.log("─".repeat(90));

for (const v of 변종들) {
  const d = new Hwpx(원본);
  const tbl = d.tables()[1];

  if (v.몇줄 > 0) {
    const rows = d.rows(tbl);
    const 새것 = d.행늘리기(tbl, rows[본뜰행자리], v.몇줄);
    새것.forEach((tr, i) => {
      const cs = d.cells(tr);
      if (cs[0]) d.setCell(cs[0], `늘${i + 1}`);
    });
  }
  if (v.취급끔) d.글자처럼취급끄기(tbl);

  const 나온것 = d.save();
  const 이름 = `${v.표} ${v.설명}.hwpx`;
  writeFileSync(join(낼곳, 이름), 나온것);

  // 꾸러미 안 XML 이 성한지
  const z = new Zip(나온것);
  let 나쁜것 = 0;
  for (const n of z.names()) {
    if (!/\.(xml|rdf|hpf)$/.test(n)) continue;
    try { parse(z.text(n)); } catch { 나쁜것++; }
  }
  const 행 = d.rows(d.tables()[1]).length;
  const 다시 = new Hwpx(나온것);
  const t2 = 다시.tables()[1];
  const pos = kids(t2, "pos")[0];
  const 취급 = pos ? attr(pos, "treatAsChar") : "?";
  const p2 = find((다시 as any).doc.root, "p")
    .find((p: any) => kids(p, "run").some((r: any) => kids(r, "tbl").includes(t2)));
  const 줄 = p2 ? kids(p2, "linesegarray").flatMap((a: any) => kids(a, "lineseg"))[0] : null;
  console.log(
    `${v.표}     ${v.설명.padEnd(22)}${String(행).padStart(2)}` +
    ` ${String(나온것.length).padStart(7)}  ${나쁜것 ? `✗${나쁜것}` : "성함"}` +
    `   글자처럼=${취급}  문단줄 vertsize=${줄 ? attr(줄, "vertsize") : "?"}` +
    ` horzsize=${줄 ? attr(줄, "horzsize") : "?"}`);
}

console.log(`\n${낼곳} 에 ${변종들.length}장을 만들었습니다.`);
