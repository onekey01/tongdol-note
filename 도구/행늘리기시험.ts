/**
 * ── 행 늘리기, 한글이 여는지 보기 ────────────────────────────
 *
 * 「행을 복제하거나 지우면 한글이 파일을 열지 않는다」는 것이 오래된
 * 규칙이었습니다(`기록지_만들기.py`). 서식8 은 실적 줄이 다섯 개뿐이라
 * 그 규칙 안에서는 지을 수가 없습니다.
 *
 * 그래서 **한 줄만 늘린 파일**을 먼저 만들어 봅니다. 짐작으로 넘어가지
 * 않습니다 — 한글이 실제로 여는 것을 무무 님이 확인한 뒤에 서식8 을 짓습니다.
 *
 *   bun 도구/행늘리기시험.ts
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

/* ── 먼저 표 생김새를 봅니다 ──────────────────────────────── */
{
  const d = new Hwpx(원본);
  d.tables().forEach((t, ti) => {
    const rows = d.rows(t);
    const sz = kids(t, "sz")[0];
    console.log(`표${ti}: rowCnt=${attr(t, "rowCnt")} 실제행=${rows.length}` +
      ` colCnt=${attr(t, "colCnt")} 높이=${sz ? attr(sz, "height") : "?"}`);
    rows.forEach((tr, ri) => {
      const cs = d.cells(tr);
      const h = attr(kids(cs[0], "cellSz")[0] ?? tr, "height");
      const 글 = cs.map((c) => d.cellText(c).replace(/\n/g, "⏎")).join(" | ");
      console.log(`  r${ri} (칸${cs.length} 높이${h}) ${글.slice(0, 90)}`);
    });
  });
}

/* ── 한 줄 늘립니다 ───────────────────────────────────────── */
const 몇줄 = Number(process.argv[2] ?? 1);
const 본뜰 = Number(process.argv[3] ?? -1);   // -1 이면 아래에서 고릅니다

const d = new Hwpx(원본);
const tbl = d.tables()[1];             // 표0 은 제목 한 칸짜리입니다
const rows = d.rows(tbl);
const 본뜰행자리 = 본뜰 >= 0 ? 본뜰 : rows.length - 2;   // 빈 실적 줄 하나(r14)
console.log(`\n본뜰 행 = r${본뜰행자리}, ${몇줄}줄 늘립니다.`);

const 새것 = d.행늘리기(tbl, rows[본뜰행자리], 몇줄);
console.log(`늘린 뒤 행 = ${d.rows(tbl).length}, rowCnt=${attr(tbl, "rowCnt")}`);

// 늘린 줄에 눈에 띄는 글자를 넣어 봅니다 — 종이에서 바로 보이게.
새것.forEach((tr, i) => {
  const cs = d.cells(tr);
  if (cs[0]) d.setCell(cs[0], `늘${i + 1}`);
});

const 흠 = d.audit();
console.log("자체 점검:", 흠.length ? 흠.join(" · ") : "깨끗");

const 나온것 = d.save();
const 이름 = `행늘리기 시험 ${몇줄}줄.hwpx`;
writeFileSync(join(낼곳, 이름), 나온것);
console.log(`\n만들었습니다 — ${이름} (${나온것.length.toLocaleString()} 바이트)`);

/* ── 꾸러미 안 XML 이 성한지 ──────────────────────────────── */
{
  const z = new Zip(나온것);
  let 나쁜것 = 0;
  for (const 이름 of z.names()) {
    if (!이름.endsWith(".xml") && !이름.endsWith(".rdf") && !이름.endsWith(".hpf")) continue;
    try { parse(z.text(이름)); } catch (e) {
      console.log(`  ✗ ${이름} — ${(e as Error).message}`); 나쁜것++;
    }
  }
  console.log(나쁜것 ? `XML ${나쁜것}장이 깨졌습니다.` : "꾸러미 안 XML 모두 성합니다.");
}

/* ── 늘린 뒤 다시 읽어 대조 ───────────────────────────────── */
{
  const e = new Hwpx(나온것);
  const t = e.tables()[1];
  const rs = e.rows(t);
  console.log(`다시 읽음: 행 ${rs.length}, rowCnt=${attr(t, "rowCnt")}`);
  let 어긋남 = 0;
  rs.forEach((tr, ri) => {
    for (const tc of e.cells(tr))
      for (const a of kids(tc, "cellAddr"))
        if (attr(a, "rowAddr") !== String(ri)) 어긋남++;
  });
  console.log(어긋남 ? `rowAddr 어긋남 ${어긋남}곳` : "rowAddr 모두 맞습니다.");
}
