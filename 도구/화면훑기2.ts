/**
 * 화면 훑기 ② — **눌러 보는** 것들.
 *
 *   bun 도구/화면훑기2.ts
 *
 * 첫 훑기는 주소를 쳐서 여는 화면만 봤습니다. 여기서는 눌러야 열리는
 * 것들을 봅니다 — 대상자 상세, 실적 달력 칸, 사무실에서 적기, 메모장,
 * 인쇄 미리보기, 필터.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const 주소 = "http://127.0.0.1:5757";
const 그림방 = "/tmp/shots2";
mkdirSync(그림방, { recursive: true });

const 탈: { 화면: string; 갈래: string; 글: string }[] = [];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await b.newPage({ viewport: { width: 1440, height: 980 } });
let 지금 = "(시작)";
page.on("console", (m) => {
  if (m.type() === "error") 탈.push({ 화면: 지금, 갈래: "콘솔오류", 글: m.text().slice(0, 300) });
});
page.on("pageerror", (e) => 탈.push({ 화면: 지금, 갈래: "터짐", 글: String(e).slice(0, 300) }));
page.on("response", (r) => {
  if (r.status() >= 400)
    탈.push({ 화면: 지금, 갈래: `HTTP ${r.status()}`, 글: `${r.request().method()} ${r.url()}` });
});

const 찍 = async (이름: string) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${그림방}/${이름}.png`, fullPage: true });
  writeFileSync(`${그림방}/${이름}.txt`,
    (await page.locator("body").innerText().catch(() => "")).slice(0, 6000));
  console.log(`  찍음  ${이름}`);
};

try {
  await page.goto(주소, { waitUntil: "networkidle" });
  await page.fill("#id", "onekey01");
  await page.fill("#pw", "test1234");
  await page.click('button:has-text("들어가기")');
  await page.waitForTimeout(1800);

  // ── ① 대상자 상세 ────────────────────────────────────────
  지금 = "대상자상세";
  await page.goto(`${주소}/recipients`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.getByText("박옥례", { exact: false }).first().click();
  await page.waitForTimeout(1500);
  await 찍("20-대상자상세-박옥례");

  지금 = "대상자상세2";
  await page.goto(`${주소}/recipients`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.getByText("이복순", { exact: false }).first().click();
  await page.waitForTimeout(1500);
  await 찍("21-대상자상세-이복순");

  // ── ② 제공실적 — 달력 칸 누르기 ───────────────────────────
  지금 = "실적창";
  await page.goto(`${주소}/records`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  // 왼쪽에서 박옥례(식사지원)를 고릅니다 — 대면/비대면이 있는 자리
  await page.getByText("박옥례", { exact: false }).first().click();
  await page.waitForTimeout(1200);
  await 찍("22-실적-박옥례달력");

  // 제공으로 찍힌 칸 하나를 눌러 봅니다
  const 칸 = page.locator(".cal-cell, .날칸, td .칸, [data-on]").first();
  if (await 칸.count()) {
    await 칸.click({ force: true }).catch(() => {});
    await page.waitForTimeout(900);
    await 찍("23-실적-칸누름");
    await page.keyboard.press("Escape");
  } else {
    탈.push({ 화면: "실적창", 갈래: "못 누름", 글: "달력 칸 선택자를 못 찾았습니다" });
  }

  // ── ③ 이복순 — 노쇼가 있는 달력 ──────────────────────────
  지금 = "실적-노쇼";
  await page.getByText("이복순", { exact: false }).first().click();
  await page.waitForTimeout(1200);
  await 찍("24-실적-이복순노쇼");

  // ── ④ 최말순 — 월 단위(요일 없음) 달력 ────────────────────
  지금 = "실적-월단위";
  await page.getByText("최말순", { exact: false }).first().click();
  await page.waitForTimeout(1200);
  await 찍("25-실적-최말순월단위");

  // ── ⑤ 지난달 ─────────────────────────────────────────────
  지금 = "실적-지난달";
  await page.locator("button", { hasText: "◀" }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await 찍("26-실적-지난달");

  // ── ⑥ 메모장 ─────────────────────────────────────────────
  지금 = "메모장";
  await page.goto(`${주소}/home`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const 메모탭 = page.getByText("메모장", { exact: false }).first();
  if (await 메모탭.count()) {
    await 메모탭.click({ force: true }).catch(() => {});
    await page.waitForTimeout(900);
    await 찍("27-메모장");
  }

  // ── ⑦ 종사자 상세 ────────────────────────────────────────
  지금 = "종사자상세";
  await page.goto(`${주소}/staff`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.getByText("한나눔", { exact: false }).first().click();
  await page.waitForTimeout(1400);
  await 찍("28-종사자상세-휴직");

  // ── ⑧ 종사자 목록 · 계약종료 함께 보기 ────────────────────
  지금 = "종사자-퇴사포함";
  await page.goto(`${주소}/staff`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const 체크 = page.locator('input[type="checkbox"]').first();
  if (await 체크.count()) { await 체크.check().catch(() => {}); await page.waitForTimeout(800); }
  await 찍("29-종사자-퇴사포함");

  // ── ⑨ 배정 · 상태 전체 ───────────────────────────────────
  지금 = "배정-전체";
  await page.goto(`${주소}/assign`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const 상태 = page.locator("select").nth(0);
  await 상태.selectOption({ index: 1 }).catch(() => {});
  await page.waitForTimeout(900);
  await 찍("30-배정-상태바꿈");

  // ── ⑩ 정산 지난달 ────────────────────────────────────────
  지금 = "정산-지난달";
  await page.goto(`${주소}/billing`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.locator("button", { hasText: "◀" }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await 찍("31-정산-지난달");

  // ── ⑪ 기록지 지난달 (일지를 적어 둔 달) ───────────────────
  지금 = "기록지-지난달";
  await page.goto(`${주소}/recordbook`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.locator("button", { hasText: "◀" }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await 찍("32-기록지-지난달");

  // ── ⑫ 의뢰 접수 ──────────────────────────────────────────
  지금 = "의뢰접수";
  await page.goto(`${주소}/inbox`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await 찍("33-의뢰접수");

  console.log("\n─── 눈에 걸린 것 ───");
  const 본것 = new Set<string>();
  for (const t of 탈) {
    const k = `${t.화면}|${t.갈래}|${t.글.slice(0, 90)}`;
    if (본것.has(k)) continue; 본것.add(k);
    console.log(`  [${t.화면}] ${t.갈래} — ${t.글}`);
  }
  if (!탈.length) console.log("  (없음)");
} catch (e: any) {
  console.log("터짐:", e?.message ?? e);
  await page.screenshot({ path: `${그림방}/터진자리.png`, fullPage: true }).catch(() => {});
} finally {
  await b.close();
}
