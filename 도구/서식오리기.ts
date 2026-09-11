/**
 * ── 편람에서 서식 한 장을 오려 냅니다 ────────────────────────────
 *
 * 지자체에 내는 서류의 서식은 **우리가 그리는 것이 아닙니다.**
 * 편람 안에 원본이 다 들어 있으므로 **오려서** 씁니다.
 * 오려낸 것은 글자 모양·선 굵기·글꼴 정의(`header.xml`)까지 편람 것 그대로입니다.
 *
 * 쓰는 법
 * ───────
 *   1. `편람 hwpx로 바꾸기.bat` 로 편람 .hwp 를 .hwpx 로 바꿉니다 (한글이 합니다)
 *   2. 무엇이 들어 있는지 봅니다
 *        bun run 도구/서식오리기.ts --목록 "…업무편람.hwpx"
 *   3. 하나를 오려 냅니다
 *        bun run 도구/서식오리기.ts "…업무편람.hwpx" "서식9" "서식/모니터링 기록지(서식9).hwpx"
 *
 * 어떻게 자르나
 * ─────────────
 * 편람은 서식마다 **「<서식N> 이름」 문단**으로 시작합니다.
 * 그 문단부터 **다음 서식 제목(또는 [별표]) 앞까지**를 통째로 들어냅니다.
 * 사이에 있는 표·빈 문단·주석을 다 데려옵니다 — 하나도 안 고칩니다.
 *
 * 용지(`secPr`)는 그 구역 맨 앞 문단에만 붙어 있으므로,
 * 그 부품만 떼어 오려낸 첫 문단에 옮겨 답니다. **숫자는 안 건드립니다** —
 * 한때 용지를 만졌다가 한글에서 표의 마지막 칸이 통째로 사라진 적이 있습니다.
 *
 * 안 하는 것
 * ──────────
 * 칸을 더하거나 빼지 않고, 글자를 다듬지 않고, 폭을 조정하지 않습니다.
 * **오려 오기만 합니다.** 채우는 것은 `recordbook.ts` 같은 곳의 일입니다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Zip } from "../server/zip";
import { parse, serialize, find, kids, plain, isNode, type Node } from "../server/xml";

/**
 * 글자를 **XML 안에 넣어도 되게** 감쌉니다.
 *
 * 서식 이름에는 「<서식7>」처럼 꺾쇠가 들어 있습니다. 감싸지 않고 넣으면
 * XML 이 깨져 한글이 파일을 아예 못 엽니다. `&` 를 **먼저** 바꿔야 합니다 —
 * 나중에 바꾸면 방금 만든 `&lt;` 의 `&` 까지 다시 바꿔 버립니다.
 */
function xml글(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 문단에서 글자만 뽑습니다 (표 안 글자까지 이어 붙입니다). */
function 글(n: Node): string {
  return find(n, "t").map((t) => plain(t)).join("");
}

/** 「<서식9> …」·「[별표 1]」처럼 **새 서식이 시작되는 문단**인가. */
const 제목인가 = (s: string) => /^\s*<\s*서식\s?[0-9]/.test(s) || /^\s*\[별표/.test(s);

/** 「<서식9> 모니터링…」 → 「서식9」 */
function 이름(s: string): string {
  const m = s.match(/<\s*(서식\s?[0-9][0-9\-]*)\s*>/);
  return m ? m[1].replace(/\s+/g, "") : "";
}

type 조각 = { 이름: string; 제목: string; 구역: number; 처음: number; 끝: number; 표수: number };

/** 편람을 열어 서식이 어디부터 어디까지인지 훑습니다. */
function 훑기(파일: string) {
  const zip = new Zip(readFileSync(파일));
  const 구역이름: string[] = [];
  for (let i = 0; i < 50; i++) {
    const n = `Contents/section${i}.xml`;
    try { zip.text(n); 구역이름.push(n); } catch { break; }
  }

  const 조각들: 조각[] = [];
  const 문서: Record<string, any> = {};

  구역이름.forEach((경로, si) => {
    const doc = parse(zip.text(경로));
    문서[경로] = doc;
    const 문단 = doc.root.kids.filter((k) => isNode(k) && k.name === "p") as Node[];
    let 열림: 조각 | null = null;
    문단.forEach((p, pi) => {
      const t = 글(p).trim();
      if (제목인가(t)) {
        if (열림) { 열림.끝 = pi; 조각들.push(열림); }
        열림 = { 이름: 이름(t) || t.slice(0, 12), 제목: t.slice(0, 70),
                 구역: si, 처음: pi, 끝: 문단.length, 표수: 0 };
      }
    });
    if (열림) 조각들.push(열림);
    // 조각마다 표가 몇 개인지 세어 둡니다 — 「제대로 잘렸나」의 첫 눈금입니다.
    for (const c of 조각들.filter((x) => x.구역 === si)) {
      c.표수 = 문단.slice(c.처음, c.끝).reduce((n, p) => n + find(p, "tbl").length, 0);
    }
  });

  return { zip, 구역이름, 문서, 조각들 };
}

/**
 * 오려낸 문단들로 새 hwpx 를 만듭니다.
 *
 * `찾는이름` 이 「서식9」면 그 제목 문단부터 다음 제목 앞까지,
 * 「구역3」이면 **그 구역 통째로**입니다.
 *
 * 구역 통째로가 필요한 이유 — 편람의 서식6-1·6-2 는 제목을
 * 「<서식 6-2>」가 아니라 **「<안전생활환경 컨설팅 서식2>」**로 달아 두었습니다.
 * 이름이 규칙에서 벗어나 있어 제목으로는 못 찾습니다. 대신 그 서식들은
 * **한 구역을 통째로 쓰고 있어** 구역째 들어내면 정확히 그 한 장이 나옵니다.
 */
function 오리기(파일: string, 찾는이름: string, 낼곳: string) {
  const { zip, 구역이름, 문서, 조각들 } = 훑기(파일);

  const 구역짚기 = 찾는이름.match(/^구역\s*(\d+)$/);
  let 것: 조각 | undefined;
  if (구역짚기) {
    const si = Number(구역짚기[1]);
    const doc0 = 문서[구역이름[si]];
    if (!doc0) throw new Error(`구역 ${si} 이 없습니다.`);
    const ps = doc0.root.kids.filter((k: any) => isNode(k) && k.name === "p") as Node[];
    것 = { 이름: `구역${si}`, 제목: 글(ps[0]).trim().slice(0, 70),
           구역: si, 처음: 0, 끝: ps.length,
           표수: ps.reduce((n, p) => n + find(p, "tbl").length, 0) };
  } else {
    것 = 조각들.find((c) => c.이름 === 찾는이름.replace(/\s+/g, ""));
  }
  if (!것) {
    throw new Error(`「${찾는이름}」을 못 찾았습니다. --목록 으로 뭐가 있는지 보세요.\n` +
      조각들.map((c) => "  " + c.이름).join("\n"));
  }

  const 경로 = 구역이름[것.구역];
  const doc = 문서[경로];
  const 전체 = doc.root.kids.filter((k: any) => isNode(k) && k.name === "p") as Node[];
  const 뽑은것 = 전체.slice(것.처음, 것.끝);

  /*
   * 용지 설정(secPr)은 **구역의 맨 앞 문단**에만 달려 있습니다.
   * 오려낸 첫 문단이 그 문단이 아니면, 그 부품이 든 run 을 통째로 앞에 붙입니다.
   * 숫자는 한 글자도 안 고칩니다.
   */
  const 첫문단 = 전체[0];
  const 용지run = kids(첫문단, "run").find((r) => find(r, "secPr").length > 0);
  if (용지run && !find(뽑은것[0], "secPr").length) {
    뽑은것[0].kids.unshift(용지run);
  }

  /*
   * 뿌리(`<hs:sec>`)는 그대로 두고 **자식만** 오려낸 문단으로 갈아 끼웁니다.
   * 그러면 여는 태그(이름공간 선언 열두 개)와 닫는 태그가 원본 그대로 남습니다.
   */
  doc.root.kids = 뽑은것;
  const 새구역 = serialize(doc);

  // ── 꾸러미 다시 묶기 ────────────────────────────────────────
  const hpf0 = zip.text("Contents/content.hpf");
  let hpf = hpf0;
  for (let i = 1; i < 50; i++) {
    hpf = hpf.replace(new RegExp(`<opf:item id="section${i}"[^>]*/>`), "")
             .replace(new RegExp(`<opf:itemref idref="section${i}"[^>]*/>`), "");
  }
  /*
   * ── 제목은 **반드시 XML 로 감싸서** 넣습니다 ────────────────
   *
   * 서식 이름은 「<서식7> 본인부담금 영수증」입니다. 꺾쇠가 들어 있습니다.
   * 이것을 그대로 XML 에 넣으면 —
   *
   *     <opf:title><서식7> 본인부담금 영수증</opf:title>
   *
   * `<서식7>` 이 **여는 태그로 읽혀** 파일이 XML 로 아예 안 읽힙니다.
   * 한글은 그 자리에서 「알 수 없는 오류입니다」만 내놓습니다.
   *
   * **이것이 서식 열네 장이 안 열린 진짜 원인이었습니다** (2026-09-01).
   * 서식9 하나만 열렸는데, 그 이름에만 꺾쇠가 없었기 때문입니다.
   */
  hpf = hpf.replace(/<opf:item id="image\d+"[^>]*\/>/g, "")
           .replace(/<opf:title>[^<]*<\/opf:title>/, `<opf:title>${xml글(것.제목)}</opf:title>`);

  const 빼기 = new Set<string>(["Preview/PrvImage.png"]);   // 편람 표지 그림 — 우리 것이 아닙니다
  for (let i = 1; i < 50; i++) 빼기.add(`Contents/section${i}.xml`);
  for (const n of zip.names()) if (n.startsWith("BinData/")) 빼기.add(n);

  /*
   * ── 커서 자리를 맨 앞으로 ──────────────────────────────────
   *
   * `settings.xml` 에는 **편람을 저장할 때 커서가 있던 자리**가 들어 있습니다 —
   *
   *     <ha:CaretPosition listIDRef="0" paraIDRef="36" pos="37"/>
   *
   * 「36번째 문단의 37번째 글자」라는 뜻인데, 서식 한 장만 오려 냈으니
   * **그 문단이 없습니다.** 한글은 문서를 열면서 커서를 그 자리에 놓으려다
   * 없는 곳을 짚고 **「알 수 없는 오류입니다」**를 냅니다.
   *
   * 여기를 안 고쳐서 서식 열다섯 장이 **전부** 안 열렸습니다 (2026-09-01).
   * `settings.xml` 은 **한글의 기억**이지 서식이 아니므로 고쳐도 됩니다 —
   * 종이에 찍히는 것은 한 글자도 안 바뀝니다.
   */
  const 첫id = /<hp:p\b[^>]*\bid="(\d+)"/.exec(새구역)?.[1] ?? "0";
  const 설정 = zip.text("settings.xml").replace(
    /<ha:CaretPosition\b[^>]*\/>/,
    `<ha:CaretPosition listIDRef="0" paraIDRef="${첫id}" pos="0"/>`
  );

  /*
   * ── 꾸러미 설명(container.rdf)에서 들어낸 부품을 지웁니다 ──────
   *
   * 편람에는 구역이 다섯(section0~4) 있습니다. 위에서 넷을 들어냈는데
   * `container.rdf` 는 **아직도 넷이 문서의 부품이라고 말합니다.**
   * 한글은 이 목록대로 부품을 불러오려다 없는 것을 만나 넘어집니다.
   *
   * **이것이 서식 열다섯 장을 전부 못 열게 한 진짜 원인이었습니다** (2026-09-01).
   * `content.hpf` 만 고치고 이쪽을 잊었습니다. 꾸러미를 설명하는 종이는
   * **둘**이라는 것을 그때는 몰랐습니다.
   */
  const 남는파일 = new Set(zip.names().filter((n) => !빼기.has(n)));
  const rdf = zip.text("META-INF/container.rdf")
    .replace(/<rdf:Description\b[\s\S]*?<\/rdf:Description>/g, (덩이) => {
      const 가리킴 = [...덩이.matchAll(/(?:rdf:resource|rdf:about)="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((x) => x && !x.startsWith("http") && x.includes("/"));
      return 가리킴.some((x) => !남는파일.has(x)) ? "" : 덩이;
    });

  /*
   * ── header 의 「구역이 몇 개다」 ────────────────────────────
   *
   * `<hh:head … secCnt="5">` — 편람은 구역이 다섯입니다. 한 장만 남기면
   * 하나뿐인데 이 숫자를 안 고치면 **한글이 다섯을 찾다가 넷을 못 찾습니다.**
   * 이것이 서식 열다섯 장이 안 열린 가장 큰 원인이었습니다 (2026-09-01).
   *
   * header.xml 은 1.2MB 에 글꼴·글자모양·문단모양 정의가 다 들어 있으므로
   * **여는 태그 안의 그 속성 하나만** 바꿉니다.
   */
  const 머리 = zip.text("Contents/header.xml");
  const 머리끝 = 머리.indexOf(">", 머리.indexOf("<hh:head"));
  const 새머리 = 머리.slice(0, 머리끝 + 1).replace(/\bsecCnt="\d+"/, 'secCnt="1"')
               + 머리.slice(머리끝 + 1);

  const 바꾸기: Record<string, Buffer> = {
    "Contents/header.xml": Buffer.from(새머리, "utf8"),
    "Contents/section0.xml": Buffer.from(새구역, "utf8"),
    "Contents/content.hpf": Buffer.from(hpf, "utf8"),
    "META-INF/container.rdf": Buffer.from(rdf, "utf8"),
    "settings.xml": Buffer.from(설정, "utf8"),
    "Preview/PrvText.txt": Buffer.from(것.제목 + "\n", "utf8"),
  };

  writeFileSync(낼곳, zip.write(바꾸기, 빼기));
  return { 것, 뽑은문단: 뽑은것.length };
}

// ── 부르는 자리 ────────────────────────────────────────────────
const 인자 = process.argv.slice(2);
if (인자[0] === "--목록") {
  const { 조각들 } = 훑기(인자[1]);
  console.log(`\n  ${인자[1]}\n`);
  for (const c of 조각들)
    console.log(`  ${c.이름.padEnd(10)} 구역${c.구역} 문단 ${c.처음}~${c.끝}` +
                ` 표 ${c.표수}개   ${c.제목.slice(0, 52)}`);
  console.log("");
} else if (인자.length >= 3) {
  const r = 오리기(인자[0], 인자[1], 인자[2]);
  console.log(`  오렸습니다 — ${r.것.이름} · 문단 ${r.뽑은문단}개 · 표 ${r.것.표수}개`);
  console.log(`  → ${인자[2]}`);
} else {
  console.log(`
  쓰는 법
    bun run 도구/서식오리기.ts --목록 "편람.hwpx"
    bun run 도구/서식오리기.ts "편람.hwpx" "서식9"  "서식/모니터링 기록지(서식9).hwpx"
    bun run 도구/서식오리기.ts "편람.hwpx" "구역3"  "서식/….hwpx"      (구역 통째로)
`);
}
