/**
 * ── 오려 낸 서식을 **수리**합니다 ────────────────────────────────
 *
 *   bun run 도구/서식수리.ts            (서식 폴더 전부 점검·수리)
 *   bun run 도구/서식수리.ts --볼것만    (수리하지 않고 보기만)
 *
 * ── 무슨 일이 있었나 (2026-09-01) ────────────────────────────────
 *
 * 오려 낸 서식이 한글에서 **「알 수 없는 오류입니다」**로 안 열렸습니다.
 * 통돌 Note 가 채운 것뿐 아니라 **손대지 않은 원본 서식도** 그랬습니다.
 * 서식 열다섯 장이 전부 그랬고, 우리는 아무도 열어 본 적이 없어 몰랐습니다.
 *
 * `서식오리기.ts` 는 `section0.xml` 과 `content.hpf` 는 다시 썼는데
 * **꾸러미를 설명하는 나머지 두 곳을 안 고쳤습니다.**
 *
 *   ① `META-INF/container.rdf`
 *      편람에는 구역이 다섯(section0~4) 있습니다. 서식 한 장만 남기고
 *      넷을 들어냈는데, 이 파일은 **아직도 넷이 문서의 부품이라고
 *      말합니다.** 한글은 이 목록대로 부품을 불러오려다 없는 것을 만납니다.
 *      **이것이 진짜 원인이었습니다.**
 *
 *   ② `settings.xml` 의 커서 자리
 *      `<ha:CaretPosition paraIDRef="36" pos="37"/>` — 편람을 저장할 때
 *      커서가 있던 자리입니다. 오려 낸 서식에 그 문단은 없습니다.
 *
 * ── 이것은 서식을 고치는 것이 **아닙니다** ───────────────────────
 *
 * 둘 다 **꾸러미를 설명하는 종이**이지 서식이 아닙니다. 글자·표·글꼴·용지가
 * 든 `section0.xml`·`header.xml` 은 **손도 대지 않습니다.**
 * 종이에 찍히는 것은 한 글자도 안 바뀝니다.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Zip } from "../server/zip";
import { 서식폴더 } from "../server/서식자리";

const 볼것만 = process.argv.includes("--볼것만");

export type 수리할것 = {
  header?: string;      // 새 header.xml (secCnt)
  container?: string;   // 새 container.rdf
  settings?: string;    // 새 settings.xml
  hpf?: string;         // 새 content.hpf (제목의 꺾쇠)
  까닭: string[];
};

/** 글자를 XML 안에 넣어도 되게 감쌉니다. `&` 를 **먼저** 바꿔야 합니다. */
const xml글 = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * `content.hpf` 의 **제목에 든 꺾쇠**를 감쌉니다.
 *
 *     <opf:title><서식7> 본인부담금 영수증</opf:title>
 *
 * `<서식7>` 이 여는 태그로 읽혀 파일이 XML 로 아예 안 읽힙니다.
 * **이것이 서식 열네 장이 안 열린 진짜 원인이었습니다** (2026-09-01).
 * 서식9 하나만 열렸는데, 그 이름에만 꺾쇠가 없었기 때문입니다.
 */
export function 제목고치기(hpf: string): { 새것: string; 옛제목: string } | null {
  const i = hpf.indexOf("<opf:title>");
  if (i < 0) return null;
  const j = hpf.indexOf("</opf:title>", i);
  if (j < 0) return null;
  const 속 = hpf.slice(i + "<opf:title>".length, j);
  if (!/[<>]/.test(속) && !/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(속)) return null;
  return {
    옛제목: 속,
    새것: hpf.slice(0, i) + "<opf:title>" + xml글(속) + hpf.slice(j),
  };
}

/**
 * `header.xml` 맨 첫 태그의 **`secCnt`** — 「이 문서는 구역이 몇이다」입니다.
 *
 * 편람은 다섯이라 `secCnt="5"` 인데, 서식 한 장만 남기면 하나뿐입니다.
 * 그대로 두면 한글이 다섯을 찾다가 넷을 못 찾고 넘어집니다.
 *
 * **여는 태그 안의 그 속성만** 바꿉니다 — header.xml 은 1.2MB 이고
 * 글꼴·글자모양·문단모양 정의가 다 들어 있어 한 글자도 건드리면 안 됩니다.
 */
export function secCnt고치기(header: string, 구역수: number): string | null {
  const 끝 = header.indexOf(">", header.indexOf("<hh:head"));
  if (끝 < 0) return null;
  const 여는태그 = header.slice(0, 끝 + 1);
  const m = /\bsecCnt="(\d+)"/.exec(여는태그);
  if (!m || Number(m[1]) === 구역수) return null;
  return 여는태그.replace(/\bsecCnt="\d+"/, `secCnt="${구역수}"`) + header.slice(끝 + 1);
}

/**
 * `container.rdf` 에서 **꾸러미에 없는 부품**을 지웁니다.
 *
 * 부품 하나가 이런 두 덩이로 적혀 있습니다 —
 *
 *   <rdf:Description rdf:about=""><ns0:hasPart … rdf:resource="Contents/section1.xml"/></rdf:Description>
 *   <rdf:Description rdf:about="Contents/section1.xml"><rdf:type …/></rdf:Description>
 *
 * 없는 것을 가리키는 덩이는 **통째로** 들어냅니다. 남은 것은 안 건드립니다.
 */
export function rdf고치기(rdf: string, 있는파일: Set<string>): { 새것: string; 지운것: string[] } {
  const 지운것: string[] = [];
  const 새것 = rdf.replace(/<rdf:Description\b[\s\S]*?<\/rdf:Description>/g, (덩이) => {
    // 이 덩이가 가리키는 부품 이름들
    const 가리킴 = [...덩이.matchAll(/(?:rdf:resource|rdf:about)="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((x) => x && !x.startsWith("http") && x.includes("/"));
    const 없는것 = 가리킴.filter((x) => !있는파일.has(x));
    if (!없는것.length) return 덩이;
    지운것.push(...없는것);
    return "";
  });
  return { 새것, 지운것: [...new Set(지운것)] };
}

/** 한 장을 살펴 무엇을 고쳐야 하는지 알아냅니다. */
export function 살피기(버퍼: Buffer): 수리할것 {
  const zip = new Zip(버퍼);
  const 있는파일 = new Set(zip.names());
  const 까닭: string[] = [];
  const 낼것: 수리할것 = { 까닭 };

  // ⓪ header.xml 의 secCnt — **이것이 가장 큰 원인이었습니다**
  if (있는파일.has("Contents/header.xml")) {
    const 구역수 = [...있는파일].filter((n) => /^Contents\/section\d+\.xml$/.test(n)).length;
    const h = zip.text("Contents/header.xml");
    const 새것 = secCnt고치기(h, 구역수);
    if (새것) {
      낼것.header = 새것;
      const 옛 = /\bsecCnt="(\d+)"/.exec(h.slice(0, h.indexOf(">", h.indexOf("<hh:head"))))?.[1];
      까닭.push(`header 가 구역이 ${옛}개라고 선언 (실제 ${구역수}개)`);
    }
  }

  // ⓪-나. content.hpf 의 제목 — **이것이 진짜 원인이었습니다**
  if (있는파일.has("Contents/content.hpf")) {
    const hpf = zip.text("Contents/content.hpf");
    const r = 제목고치기(hpf);
    if (r) {
      낼것.hpf = r.새것;
      까닭.push(`content.hpf 의 제목에 꺾쇠가 그대로 — 「${r.옛제목}」 (XML 이 깨집니다)`);
    }
  }

  // ① container.rdf — 없는 부품을 가리키나
  if (있는파일.has("META-INF/container.rdf")) {
    const rdf = zip.text("META-INF/container.rdf");
    const { 새것, 지운것 } = rdf고치기(rdf, 있는파일);
    if (지운것.length) {
      낼것.container = 새것;
      까닭.push(`container.rdf 가 없는 부품 ${지운것.join(" · ")} 을 가리킴`);
    }
  }

  // ② settings.xml — 커서가 없는 문단을 가리키나
  if (있는파일.has("settings.xml") && 있는파일.has("Contents/section0.xml")) {
    const 설정 = zip.text("settings.xml");
    const 구역 = zip.text("Contents/section0.xml");
    const m = /<ha:CaretPosition\b[^>]*\/>/.exec(설정);
    if (m) {
      const para = /paraIDRef="(\d+)"/.exec(m[0])?.[1];
      const 있는id = new Set([...구역.matchAll(/<hp:p\b[^>]*\bid="(\d+)"/g)].map((x) => x[1]));
      if (para !== undefined && !있는id.has(para)) {
        const 첫 = /<hp:p\b[^>]*\bid="(\d+)"/.exec(구역)?.[1] ?? "0";
        낼것.settings = 설정.replace(
          m[0], `<ha:CaretPosition listIDRef="0" paraIDRef="${첫}" pos="0"/>`);
        까닭.push(`커서가 없는 문단 ${para} 을 가리킴 (맨 앞 ${첫} 로)`);
      }
    }
  }

  return 낼것;
}

/** 살핀 대로 고칩니다. 고칠 것이 없으면 아무것도 안 합니다. */
export function 고치기(파일: string, 수리: 수리할것): boolean {
  const 바꾸기: Record<string, Buffer> = {};
  if (수리.header) 바꾸기["Contents/header.xml"] = Buffer.from(수리.header, "utf8");
  if (수리.hpf) 바꾸기["Contents/content.hpf"] = Buffer.from(수리.hpf, "utf8");
  if (수리.container) 바꾸기["META-INF/container.rdf"] = Buffer.from(수리.container, "utf8");
  if (수리.settings) 바꾸기["settings.xml"] = Buffer.from(수리.settings, "utf8");
  if (!Object.keys(바꾸기).length) return false;
  writeFileSync(파일, new Zip(readFileSync(파일)).write(바꾸기));
  return true;
}

// ── 부르는 자리 ────────────────────────────────────────────────
if (import.meta.main) {
  const 폴더 = 서식폴더();
  if (!existsSync(폴더)) { console.log(`  서식 폴더가 없습니다 — ${폴더}`); process.exit(1); }

  const 파일들 = readdirSync(폴더).filter((f) => f.endsWith(".hwpx")).sort();
  console.log(`\n  ${폴더}\n  서식 ${파일들.length}장\n`);

  let 고친수 = 0, 멀쩡 = 0;
  for (const f of 파일들) {
    const 길 = join(폴더, f);
    const 수리 = 살피기(readFileSync(길));
    if (!수리.까닭.length) { 멀쩡++; console.log(`     그대로  ${f}`); continue; }
    if (!볼것만) 고치기(길, 수리);
    고친수++;
    console.log(`  ★ ${볼것만 ? "고칠것" : "고쳤음"}  ${f}`);
    for (const c of 수리.까닭) console.log(`              ${c}`);
  }
  console.log(
    `\n  ${볼것만 ? "고칠 것" : "고친 것"} ${고친수}장 · 그대로 둔 것 ${멀쩡}장\n` +
    `  (글자·표·글꼴·용지는 한 글자도 안 건드렸습니다 — 꾸러미 설명만입니다)\n`
  );
}
