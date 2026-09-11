/**
 * 자물쇠가 **진짜 브라우저에서도** 도는지 봅니다.
 *   bun 도구/브라우저자물쇠시험.ts
 *
 * 기관 PC(Bun)가 잠근 것을 휴대폰(브라우저)이 풀어야 하고, 그 반대도 되어야 합니다.
 * 한 쪽만 되면 현장에서 못 엽니다. 그래서 진짜 크롬에 넣어 확인합니다.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { 새열쇠, 잠그기, 풀기, 싸기, 싼것풀기 } from "../server/우편함자물쇠";

/*
 * 정규식으로 타입을 벗기면 부실합니다. Bun 의 진짜 변환기를 씁니다 —
 * 브라우저에 넣는 것이 **실제로 도는 코드**여야 의미가 있습니다.
 */
const 원본 = readFileSync(new URL("../server/우편함자물쇠.ts", import.meta.url), "utf8");
const 자바 = new Bun.Transpiler({ loader: "ts", target: "browser" })
  .transformSync(원본)
  .replace(/^\s*export\s+\{[^}]*\};?\s*$/gm, "")
  .replace(/\bexport\s+(?=(async\s+)?function|const|let|var)/g, "");

const 열쇠 = 새열쇠();
const 글 = "김복순 · 해남군 해남읍 성내리 12-3 · 010-1234-5678";
const 번들 = await 잠그기(열쇠, 글);

const 브라우저 = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
/*
 * ★ 여기가 중요합니다 ★
 * WebCrypto(crypto.subtle)는 **안전한 자리에서만** 열립니다 —
 * https 또는 localhost. 그냥 about:blank 나 http://192.168.x.x 에서는
 * crypto.subtle 이 undefined 입니다.
 * 그래서 시험도 localhost 로 띄워 놓고 합니다. 진짜와 같은 조건입니다.
 */
const 서버 = Bun.serve({
  port: 0,
  fetch: () => new Response("<!doctype html><meta charset=utf-8><title>시험</title>",
                            { headers: { "content-type": "text/html; charset=utf-8" } }),
});
const 쪽 = await 브라우저.newPage();
await 쪽.goto(`http://localhost:${서버.port}/`);
console.log(`  (localhost:${서버.port} 에서 봅니다 — 안전한 자리)`);
같은자리확인: {
  const 열렸나 = await 쪽.evaluate(() => typeof crypto?.subtle);
  if (열렸나 !== "object") throw new Error(`crypto.subtle 이 안 열렸습니다 (${열렸나})`);
}

const 결과 = await 쪽.evaluate(async (짐: string[]) => {
  const [코드, 열쇠, 덩어리, 글] = 짐;
  const m = new Function(코드 + "\nreturn { 잠그기, 풀기, 키쌍만들기, 싼것풀기 };")();
  // 휴대폰이 하는 일 그대로 — 브라우저에서 쌍을 만듭니다
  const 쌍 = await m.키쌍만들기();
  return {
    푼것: await m.풀기(열쇠, 덩어리),
    브라우저가잠근것: await m.잠그기(열쇠, 글),
    폰공개: 쌍.공개,
    폰개인: 쌍.개인,
  };
}, [자바, 열쇠, 번들, 글]);

/*
 * ★ 여기가 진짜 확인입니다 ★
 * 기관 PC(Bun)가 싼 기관 열쇠를, 휴대폰(브라우저)이 푸는가.
 * 한 쪽만 되면 현장에서 등록이 안 됩니다.
 */
const 기관열쇠 = 새열쇠();
const 싼것 = await 싸기(결과.폰공개, 기관열쇠);
const 푼기관열쇠 = await 쪽.evaluate(async (짐: string[]) => {
  const [코드, 개인, 싼것] = 짐;
  const m = new Function(코드 + "\nreturn { 싼것풀기 };")();
  return m.싼것풀기(개인, 싼것);
}, [자바, 결과.폰개인, 싼것]);
await 브라우저.close();
서버.stop();

let 실패 = 0;
const 본다 = (무엇: string, ok: boolean) => {
  console.log(`  ${ok ? "통과" : "✗ 실패"}  ${무엇}`);
  if (!ok) 실패++;
};

console.log("\n── 기관 PC ↔ 휴대폰 자물쇠 맞춰보기 ────────────────\n");
본다("Bun 이 잠근 것을 브라우저가 품", 결과.푼것 === 글);
본다("브라우저가 잠근 것을 Bun 이 품", (await 풀기(열쇠, 결과.브라우저가잠근것)) === 글);
본다("브라우저 덩어리도 v1 모양", 결과.브라우저가잠근것.startsWith("v1."));
본다("덩어리에 이름이 안 비침", !결과.브라우저가잠근것.includes("김복순"));
본다("휴대폰이 쌍을 만들 수 있음", 결과.폰공개.length > 50 && 결과.폰개인.length > 100);
본다("기관 PC 가 싼 열쇠를 휴대폰이 품", 푼기관열쇠 === 기관열쇠);
본다("싼 것에 기관 열쇠가 안 비침", !싼것.includes(기관열쇠));

console.log(`\n  ${실패 ? `★ ${실패}가지 실패` : "일곱 가지 다 통과 — 양쪽이 같은 자물쇠를 씁니다"}\n`);
if (실패) process.exit(1);
