/**
 * 숫자 칸에 **밟아야 하는 눈금(step)**이 붙어 있지 않은지 봅니다.
 *
 *   bun 숫자칸시험.ts
 *
 * ── 왜 있나 ────────────────────────────────────────────────
 *
 * 2026-09-11, 파일럿 첫날. 최초 설정 마법사의 「월 시간」 칸에
 * `step="30"` 이 붙어 있었습니다. 화살표로 30씩 오르내리게 하려던
 * 것이었는데, 브라우저는 그것을 **「30의 배수만 유효한 값」**으로 받습니다.
 *
 *   20 → ✗   25 → ✗   45 → ✗   30 → ○   720 → ○
 *
 * 그리고 막을 때 **우리 문구가 아니라 브라우저의 영문 창**이 뜹니다 —
 *
 *   Please enter a valid value. The two nearest valid values are 0 and 30.
 *
 * 무무 님이 그 창을 보고 30 을 넣은 채 수행기관에 세팅하고 오셨습니다.
 * 가사지원 월 한도가 30분이 되어 **그 기관은 배정을 하나도 저장할 수
 * 없는 상태**였습니다. 눈금 하나가 파일럿을 세웁니다.
 *
 * ── 그래서 무엇을 막나 ─────────────────────────────────────
 *
 * `<input type="number">` 에 `step` 을 붙이는 것을 막습니다.
 * 봐 주는 것은 둘뿐입니다 —
 *   `step="any"`  「아무 값이나 좋다」 (소수를 받을 때)
 *   `step="1"`    「정수만」 — min 이 0 이상이면 모든 정수가 통과합니다
 *
 * ★ min·max 는 막지 않습니다. 그건 **정말로 그 밖의 값이 틀린** 것이고,
 *   0~1440분처럼 뜻이 분명합니다. step 은 그렇지 않습니다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, 참: boolean, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}

const 뿌리 = join(import.meta.dir, "web", "src");

function 파일들(자리: string): string[] {
  const 나온것: string[] = [];
  for (const 이름 of readdirSync(자리)) {
    const 길 = join(자리, 이름);
    if (statSync(길).isDirectory()) 나온것.push(...파일들(길));
    else if (/\.(tsx|ts)$/.test(이름)) 나온것.push(길);
  }
  return 나온것;
}

console.log("\n── 숫자 칸에 눈금(step)이 붙어 있나 ────────────────────\n");

const 걸린것: string[] = [];
for (const 길 of 파일들(뿌리)) {
  const 글 = readFileSync(길, "utf8");
  /*
   * `<input ... type="number" ... step="…" ...>` 를 찾습니다.
   * 태그가 여러 줄에 걸쳐 있으므로 `<input` 부터 `>` 까지를 한 덩이로 봅니다.
   */
  for (const m of 글.matchAll(/<input\b[^>]*>/gs)) {
    const 태그 = m[0];
    if (!/type=["']number["']/.test(태그)) continue;
    const s = /step=["']([^"']+)["']/.exec(태그);
    if (!s) continue;
    /*
     * `step="1"` 만은 봐 줍니다 — **정수만 받는다**는 뜻이고,
     * min 이 0 이상이면 **모든 정수가 다 통과**합니다. 「회」·「%」처럼
     * 소수가 뜻이 없는 칸입니다. 사람이 칠 수 있는 값을 막지 않습니다.
     * (2·30·1000 이면 막습니다 — 그게 파일럿을 세운 그 눈금입니다.)
     */
    if (s[1] === "any" || s[1] === "1") continue;
    const 줄 = 글.slice(0, m.index).split("\n").length;
    걸린것.push(`${길.replace(뿌리 + "/", "")}:${줄}  step="${s[1]}"`);
  }
}

본다("★★ 눈금이 붙은 숫자 칸이 하나도 없다", 걸린것.length === 0,
  걸린것.length ? "\n          " + 걸린것.join("\n          ") : "");

/*
 * 파일럿에서 실제로 걸린 세 칸은 이름을 대고 다시 한 번 봅니다.
 * 위 훑기가 언젠가 헐거워져도 이 셋만은 지켜집니다.
 */
console.log("\n── 파일럿에서 걸렸던 칸들 ──────────────────────────────\n");
for (const [무엇, 길, 표] of [
  ["마법사 · 월 시간", "pages/규칙마법사.tsx", "s.월한도분"],
  ["마법사 · 서비스 단가", "pages/규칙마법사.tsx", "s.단가"],
  ["마법사 · 연간 한도", "pages/규칙마법사.tsx", "w-annual"],
  ["배정 · 1회 서비스 시간", "components/AssignBox.tsx", "a-mins"],
  ["설정 · 하루 최대 시간", "pages/Settings.tsx", "rule-daily"],
] as const) {
  const 글 = readFileSync(join(뿌리, 길), "utf8");
  const m = new RegExp(`<input[^>]*${표.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}[^>]*>`, "s").exec(글)
    ?? new RegExp(`<input[^>]*>`, "s").exec("");
  본다(`${무엇} — 눈금이 없다`, !!m && !/step=["'](?!any)/.test(m[0]),
    m ? (/step=["']([^"']+)["']/.exec(m[0])?.[0] ?? "step 없음") : "칸을 못 찾음");
}

/*
 * ★ 20·25·45 같은 값이 정말 들어가는지는 **진짜 브라우저**로 봐야
 *   압니다. 위는 글자를 본 것뿐입니다. 브라우저로 보는 것은
 *   `첫설정화면시험.ts` 에 붙여 두었습니다.
 */

console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
process.exit(실패수 ? 1 : 0);
