/**
 * 현장앱을 **파일 하나**로 짓습니다.
 *
 *   bun 도구/현장앱짓기.ts
 *   → 현장앱/올릴것/index.html
 *
 * 왜 이렇게 하나 —
 *
 *   1. **자물쇠 코드를 손으로 안 베낍니다.** server/우편함자물쇠.ts 를
 *      그대로 심습니다. 두 곳에 같은 코드가 따로 살면 언젠가 어긋나고,
 *      어긋나면 현장에서 못 엽니다.
 *   2. **파일이 하나라 올리기 쉽습니다.** 폴더째 끌어다 놓으면 끝입니다.
 *   3. 어르신 댁에서 **빨리 뜹니다.** 받을 것이 하나뿐입니다.
 *
 * 주소와 공개 열쇠는 .env 에서 읽어 심습니다.
 * ★ 개발 열쇠(sb_secret_)는 절대 안 들어갑니다 — 아래에서 확인합니다.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const 뿌리 = fileURLToPath(new URL("..", import.meta.url));
const 읽기 = (p: string) => readFileSync(뿌리 + p, "utf8");

const 주소 = process.env.TONGDOL_SUPABASE_URL?.trim();
const 열쇠 = process.env.TONGDOL_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!주소 || !열쇠) {
  console.error("\n  .env 에 TONGDOL_SUPABASE_URL 과 PUBLISHABLE_KEY 가 있어야 합니다.\n");
  process.exit(1);
}

/*
 * ── QR 읽개 (jsQR) ──────────────────────────────────────────
 *
 * 왜 심어 넣나 — 바깥에서 받아 오게 하면 **신호가 약한 마당에서**
 * 그것 하나 때문에 카메라가 안 열립니다. 파일 하나에 다 있으면
 * 한 번 열린 앱은 어디서든 똑같이 돕니다.
 *
 * 왜 브라우저가 가진 BarcodeDetector 를 안 쓰나 —
 *   그것을 쓰면 0바이트로 끝나지만 **안드로이드에만** 있습니다.
 *   아이폰에서는 없는 길이 되고, 그러면 길이 두 개가 됩니다.
 *   길이 둘이면 시험도 둘이고, 현장에서 한쪽만 깨집니다.
 *   127KB 를 한 번 더 받는 값으로 **길을 하나로** 둡니다.
 */
const 읽개묶음 = await Bun.build({
  entrypoints: [뿌리 + "도구/읽개입구.js"],
  minify: true, format: "iife", target: "browser",
});
if (!읽개묶음.success) {
  console.error("\n  QR 읽개를 묶지 못했습니다. `bun install` 을 해 보세요.\n", 읽개묶음.logs);
  process.exit(1);
}
const 읽개 = await 읽개묶음.outputs[0].text();

// ── 자물쇠 코드를 브라우저가 읽을 수 있게 ────────────────────
const 자물쇠 = new Bun.Transpiler({ loader: "ts", target: "browser" })
  .transformSync(읽기("server/우편함자물쇠.ts"))
  .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, "")
  .replace(/\bexport\s+(?=(async\s+)?function|const|let|var)/g, "");

/*
 * ── ★ 이름이 부딪히는지 봅니다 ──────────────────────────────
 *
 * 자물쇠 코드를 앱 파일 **안에** 심습니다. 그래서 둘이 같은 이름을
 * 쓰면 **나중 것이 앞의 것을 덮습니다.** 조용히 덮습니다.
 *
 * 실제로 그랬습니다 (2026-09-05):
 *   자물쇠의 `잠그기(열쇠, 글)` = 글을 암호로 잠그는 것
 *   앱의   `잠그기(까닭)`       = 화면을 잠그고 여섯 자리를 묻는 것
 *
 * 앱이 나중에 오니 앱 것이 이겼습니다. 그래서 보고를 우편함에 올리려고
 * `짐싸기` 를 부르면, 그 안의 `잠그기` 가 **화면을 잠갔습니다.**
 * 서명을 마치는 순간 앱이 잠기고, 여섯 자리 칸에 기관 열쇠가
 * 빨갛게 찍혀 나왔습니다. 몇 달 뒤에 만났으면 원인을 못 찾았을 것입니다.
 *
 * 그래서 **짓기 전에 막습니다.** 이름 하나라도 겹치면 안 짓습니다.
 */
const 자물쇠이름 = [...읽기("server/우편함자물쇠.ts")
  .matchAll(/^export\s+(?:async\s+)?(?:function|const|let|var)\s+([^\s(<:=]+)/gm)]
  .map((m) => m[1]);
const 앱글 = 읽기("현장앱/앱.html");
const 부딪힌것 = 자물쇠이름.filter((이름) =>
  new RegExp(`^\\s*(?:async\\s+)?function\\s+${이름}\\s*\\(`, "m").test(앱글) ||
  new RegExp(`^\\s*(?:const|let|var)\\s+${이름}\\s*=`, "m").test(앱글));

if (부딪힌것.length) {
  console.error("");
  console.error("  ★ 이름이 부딪힙니다 — 짓지 않았습니다.");
  console.error("");
  for (const 이름 of 부딪힌것)
    console.error(`      ${이름}   자물쇠에도 있고 앱에도 있습니다`);
  console.error("");
  console.error("  자물쇠 코드를 앱 안에 심기 때문에, 같은 이름이면");
  console.error("  **앱 것이 자물쇠 것을 덮습니다.** 그러면 암호가 엉뚱하게 돕니다.");
  console.error("  앱 쪽 이름을 바꿔 주세요 (예: 잠그기 → 화면잠그기).");
  console.error("");
  process.exit(1);
}

let 글 = 앱글
  .replace("/*{{설정}}*/", JSON.stringify({ 주소, 열쇠 }))
  .replace("/*{{자물쇠}}*/", 자물쇠)
  .replace("/*{{QR읽개}}*/", 읽개);

// ── 나가기 전 확인 ───────────────────────────────────────────

/** 있으면 안 새는지 보고, 없으면 아무 확인도 만들지 않습니다. */
function 몰래나갔나(무엇: string, 값?: string): [string, boolean][] {
  const v = 값?.trim();
  if (!v) {
    console.log(`  건너뜀  ★ ${무엇}가 안 들어갔나 — .env 에 값이 없어 확인 못 함`);
    return [];
  }
  return [[`★ ${무엇}가 안 들어갔나`, !글.includes(v)]];
}

const 확인: [string, boolean][] = [
  ["설정이 심어졌나", 글.includes(주소) && 글.includes(열쇠)],
  ["자물쇠가 심어졌나", 글.includes("키쌍만들기") && 글.includes("싼것풀기")],
  ["QR 읽개가 심어졌나", 글.includes("globalThis.jsQR") || /jsQR\s*=/.test(글)],
  ["자물쇠와 앱의 이름이 안 부딪히나", 부딪힌것.length === 0],
  ["심다 만 자리가 없나", !글.includes("{{")],
  ["★ 개발 열쇠가 안 들어갔나", !글.includes("sb_secret_")],
  /*
   * ── 안 들어갔는지 보는 확인은 **없는 값으로 하면 안 됩니다** ──
   *
   * 처음에는 값이 없을 때 " 없음 " 이라는 글자를 대신 넣어 찾았습니다.
   * 그런데 앱 주석에 「오늘 목록에 없음  → 물리침」이 생기자
   * **그 글자에 걸려서** 「기관 열쇠가 들어갔다」고 나왔습니다 (2026-09-04).
   *
   * 확인하려는 것이 없으면 **확인을 안 했다고 말해야** 합니다.
   * 있지도 않은 값으로 찾은 것을 「통과」라고 부르면, 진짜로 새는 날
   * 그 통과가 우리를 안심시킵니다.
   */
  ...몰래나갔나("기관 열쇠", process.env.TONGDOL_ORG_KEY),
  ...몰래나갔나("기관 비밀번호", process.env.TONGDOL_ORG_PASSWORD),
  ["export 가 안 남았나", !/^\s*export\b/m.test(글)],
];

let 실패 = 0;
console.log("\n  현장앱 짓기\n  " + "─".repeat(44));
for (const [무엇, ok] of 확인) {
  console.log(`  ${ok ? "통과" : "✗ 실패"}  ${무엇}`);
  if (!ok) 실패++;
}
if (실패) {
  console.error(`\n  ${실패}가지 실패 — 짓지 않았습니다.\n`);
  process.exit(1);
}

const 낼곳 = 뿌리 + "현장앱/올릴것";
mkdirSync(낼곳, { recursive: true });
writeFileSync(낼곳 + "/index.html", 글, "utf8");

console.log("  " + "─".repeat(44));
console.log(`  현장앱/올릴것/index.html   ${(글.length / 1024).toFixed(1)}KB`);
console.log("");
console.log("  이 폴더를 통째로 끌어다 놓으시면 됩니다:");
console.log("      현장앱\\올릴것\\");
console.log("");
