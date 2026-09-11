/**
 * **도구를 곧장 돌려도 자료함이 열리는지** 봅니다 — bun 도구초기화시험.ts
 *
 * ── 왜 있나 (2026-09-11) ───────────────────────────────────
 *
 * 무무 님이 열쇠를 바꾸신 뒤 우편함을 들여다보려 하니 이렇게 멈췄습니다 —
 *
 *     SQLiteError: no such column: a.monthly_times
 *
 * 자료함에 새로 생긴 칸을 덧붙이는 일(migrate)은 `initDb()` 안에서 돕니다.
 * 그런데 그것을 부르는 것은 **프로그램 본체뿐**입니다. 그래서 `도구\` 의
 * 무언가를 `bun` 으로 곧장 돌리면 **옛 모습의 자료함을 그대로 열고**,
 * 새 칸을 쓰는 줄에서 무너집니다.
 *
 * 한 줄(`initDb()`)이면 끝나는 일인데, 빠뜨리면 **그 도구를 쓸 때가 되어야**
 * 알게 됩니다. 그때는 대개 급한 때입니다. 그래서 미리 셉니다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, 참: boolean, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}

const 도구칸 = join(import.meta.dir, "도구");
const 것들 = readdirSync(도구칸).filter((n) => n.endsWith(".ts")).sort();

/**
 * 주석을 걷어 냅니다.
 *
 * ★ 이것이 없으면 시험이 **거짓으로 통과합니다.** 설명 주석 안에 적힌
 *   「initDb()」라는 글자까지 세어 버리기 때문입니다. 실제로 이 시험을
 *   만들자마자 그 일이 났습니다 — 일부러 한 줄을 빼 봤는데도 통과했습니다.
 */
const 주석빼기 = (글: string) =>
  글.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

console.log("\n── 자료함을 여는 도구는 initDb() 를 불러야 합니다 ──────\n");

let 본것 = 0;
for (const 이름 of 것들) {
  const 글 = 주석빼기(readFileSync(join(도구칸, 이름), "utf8"));
  // 자료함을 직접 여는 것만 봅니다 (server/db 를 들여오는 것).
  if (!/from\s+"\.\.\/server\/db"/.test(글)) continue;
  본것++;
  본다(`도구\\${이름}`, /\binitDb\s*\(\s*\)/.test(글),
    /\binitDb\s*\(\s*\)/.test(글) ? "" : "맨 앞에 initDb() 한 줄을 넣으세요");
}
본다("자료함을 여는 도구를 찾았다", 본것 > 0, `${본것}개`);

/*
 * 본체가 정말 그 자리에서 갱신을 돌리는지도 봅니다.
 * 여기가 바뀌면 위의 규칙 자체가 뜻을 잃습니다.
 */
console.log("\n── initDb() 가 갱신을 돌리는 그 자리인가 ──────────────\n");
const db글 = 주석빼기(readFileSync(join(import.meta.dir, "server", "db.ts"), "utf8"));
본다("initDb() 안에서 migrate() 를 부른다", /export function initDb[\s\S]*?migrate\(db\)/.test(db글));
본다("initDb() 안에서 createTables() 를 부른다", /export function initDb[\s\S]*?createTables\(db\)/.test(db글));

console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
process.exit(실패수 ? 1 : 0);
