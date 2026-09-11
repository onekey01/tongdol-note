/**
 * 화면 훑기 — 사무실 화면을 **한 장씩 열어 보고** 그림으로 남깁니다.
 *
 *   bun 도구/화면훑기.ts
 *
 * 시험 파일들은 「이 값이 맞나」를 봅니다. 이것은 다릅니다 —
 * **사람 눈에 어떻게 보이나**를 봅니다. 그래서 그림을 남기고,
 * 콘솔에 뜬 빨간 글씨와 실패한 요청을 같이 적어 둡니다.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const 주소 = "http://127.0.0.1:5757";
const 그림방 = "/tmp/shots";
mkdirSync(그림방, { recursive: true });

const 탈: { 화면: string; 갈래: string; 글: string }[] = [];

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await b.newPage({ viewport: { width: 1440, height: 980 } });

let 지금화면 = "(시작)";
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning")
    탈.push({ 화면: 지금화면, 갈래: m.type() === "error" ? "콘솔오류" : "콘솔경고", 글: m.text().slice(0, 300) });
});
page.on("pageerror", (e) => 탈.push({ 화면: 지금화면, 갈래: "터짐", 글: String(e).slice(0, 300) }));
page.on("requestfailed", (r) =>
  탈.push({ 화면: 지금화면, 갈래: "요청실패", 글: `${r.method()} ${r.url()} — ${r.failure()?.errorText}` }));
page.on("response", (r) => {
  if (r.status() >= 400)
    탈.push({ 화면: 지금화면, 갈래: `HTTP ${r.status()}`, 글: `${r.request().method()} ${r.url()}` });
});

async function 찍기(이름: string, 길: string, 준비?: () => Promise<void>) {
  지금화면 = 이름;
  await page.goto(`${주소}${길}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(700);
  if (준비) await 준비().catch((e) => 탈.push({ 화면: 이름, 갈래: "손질실패", 글: String(e).slice(0, 200) }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${그림방}/${이름}.png`, fullPage: true });
  const 글 = (await page.locator("body").innerText().catch(() => "")).slice(0, 4000);
  writeFileSync(`${그림방}/${이름}.txt`, 글);
  console.log(`  찍음  ${이름}`);
}

try {
  // ── 로그인 ────────────────────────────────────────────────
  지금화면 = "로그인";
  await page.goto(주소, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${그림방}/00-로그인.png`, fullPage: true });
  await page.fill("#id", "onekey01");
  await page.fill("#pw", "test1234");
  await page.click('button:has-text("들어가기")');
  await page.waitForTimeout(1800);

  await 찍기("01-홈", "/home");
  await 찍기("02-대상자", "/recipients");
  await 찍기("03-배정", "/assign");
  await 찍기("04-제공실적", "/records");
  await 찍기("05-정산", "/billing");
  await 찍기("06-통계", "/stats");
  await 찍기("07-기록지", "/recordbook");
  await 찍기("08-종사자", "/staff");
  await 찍기("09-의뢰접수", "/inbox");
  await 찍기("10-설정", "/settings");

  // 대상자 상세 — 첫 사람
  await page.goto(`${주소}/recipients`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const 첫줄 = page.locator('a[href^="/recipients/"], tr[data-id], .r-row').first();
  const href = await 첫줄.getAttribute("href").catch(() => null);
  if (href) await 찍기("11-대상자상세", href);
  else 탈.push({ 화면: "대상자상세", 갈래: "못 감", 글: "목록에서 링크를 못 찾았습니다" });

  // 종사자 상세
  await 찍기("12-종사자상세", "/staff/2");

  console.log("\n─── 눈에 걸린 것 ───");
  if (!탈.length) console.log("  (없음)");
  const 본것 = new Set<string>();
  for (const t of 탈) {
    const k = `${t.화면}|${t.갈래}|${t.글.slice(0, 90)}`;
    if (본것.has(k)) continue; 본것.add(k);
    console.log(`  [${t.화면}] ${t.갈래} — ${t.글}`);
  }
  writeFileSync(`${그림방}/탈.json`, JSON.stringify(탈, null, 1));
} finally {
  await b.close();
}
