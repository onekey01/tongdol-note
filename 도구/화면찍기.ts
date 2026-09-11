/**
 * **설명서에 넣을 화면을 진짜로 찍습니다** —  bun 도구/화면찍기.ts
 *
 * ── 왜 그림을 그리지 않나 ──────────────────────────────────
 *
 * (무무 2026-09-11 — 「실제와 같은 테스트 화면과 함께 설명이 되어야
 *  수행기관의 관리자의 이해를 높이는데 더 도움이 되」)
 *
 * 손으로 그린 그림은 **언젠가 실제와 달라집니다.** 그리고 달라진 줄
 * 아무도 모릅니다. 그래서 프로그램을 진짜로 띄워 찍습니다 —
 * 화면이 바뀌면 이것을 다시 돌리기만 하면 됩니다.
 *
 * ── 빈 자료함이 아니라 **시범자료**로 찍습니다 ─────────────
 *
 * 빈 화면을 보여 주면 기관은 「내 것도 이렇게 비어 있겠구나」로 읽습니다.
 * 대상자 10명 · 실적 117건이 든 화면이라야 「아, 이렇게 되는구나」가 됩니다.
 *
 * 개발용 자료함은 시험이 남긴 이름들(막기시험담당 …)로 지저분해서
 * **새 자료함을 하나 띄워** 거기에 시범자료를 넣고 찍습니다.
 */
import { chromium, type Page } from "playwright";
import { 빈자료함띄우기 } from "./빈자료함";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const 찍는곳 = process.argv[2] ?? "/tmp/설명서화면";
mkdirSync(찍는곳, { recursive: true });

const 뿌리 = join(import.meta.dir, "..");
const 집 = await 빈자료함띄우기();
const 터 = 집.주소;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await b.newPage({ viewport: { width: 1480, height: 1000 },
                               deviceScaleFactor: 1 });
page.on("dialog", async (d) => { await d.accept().catch(() => { }); });

let 몇 = 0;
const 찍은것: { 이름: string; 파일: string }[] = [];

/** 화면 한 장. `자리` 를 주면 그 부분만 잘라 찍습니다. */
async function 찍기(이름: string, 옵션: { 자리?: string; 통째로?: boolean } = {}) {
  몇++;
  const 파일 = `${String(몇).padStart(2, "0")}-${이름}.png`;
  const 길 = join(찍는곳, 파일);
  if (옵션.자리) {
    const it = page.locator(옵션.자리).first();
    await it.scrollIntoViewIfNeeded().catch(() => { });
    await page.waitForTimeout(300);
    await it.screenshot({ path: 길 });
  } else {
    await page.screenshot({ path: 길, fullPage: !!옵션.통째로 });
  }
  찍은것.push({ 이름, 파일 });
  console.log(`  ${파일}`);
}

const 가서 = async (길: string, 기다림 = 2200) => {
  await page.goto(터 + 길);
  await page.waitForTimeout(기다림);
};

try {
  console.log("\n── ① 처음 켰을 때 ──────────────────────────────────\n");
  await 가서("/", 1500);
  await 찍기("기관개설");

  await page.locator("#orgName").fill("해남돌봄복지관");
  await page.locator("#phone").fill("061-530-0000");
  for (const [칸, 값] of [["adminName", "박병섭"], ["loginId", "haenam"],
                          ["password", "haenam1234"], ["password2", "haenam1234"]] as const) {
    const x = page.locator(`#${칸}`);
    if (await x.count()) await x.fill(값);
  }
  await 찍기("기관개설-채운것");
  await page.locator("button[type=submit], button.primary").first().click();
  await page.waitForTimeout(3000);

  console.log("\n── ② 최초 설정 마법사 ──────────────────────────────\n");
  await 찍기("마법사-전체", { 통째로: true });
  // ④ 서비스별 월 한도 · 1회 시간 — 새로 생긴 자리
  const 넷째표 = page.locator("table.grid").nth(1);
  if (await 넷째표.count()) await 찍기("마법사-서비스한도", { 자리: "table.grid >> nth=1" });
  await page.locator("button.primary").first().click();
  await page.waitForTimeout(3000);

  console.log("\n── ③ 시범자료를 넣습니다 ───────────────────────────\n");
  {
    const p = Bun.spawn({
      cmd: ["bun", join(뿌리, "도구", "시범자료.ts")],
      cwd: 집.폴더, stdout: "pipe", stderr: "pipe",
    });
    const 코드 = await p.exited;
    const 말 = (await new Response(p.stdout).text()).trim().split("\n").slice(-6).join("\n");
    console.log(코드 === 0 ? 말 : "✗ 시범자료를 못 넣었습니다\n" +
      (await new Response(p.stderr).text()).slice(0, 400));
  }

  console.log("\n── ④ 자료가 든 화면들 ─────────────────────────────\n");
  await 가서("/home", 3000);
  await 찍기("홈");

  await 가서("/inbox"); await 찍기("의뢰접수");

  await 가서("/recipients", 2600); await 찍기("대상자목록");
  const 첫사람 = page.locator("tr.clickable").first();
  if (await 첫사람.count()) {
    await 첫사람.click(); await page.waitForTimeout(2600);
    await 찍기("대상자상세", { 통째로: true });
    const 메모딱지 = page.locator("button.memo-tab");
    if (await 메모딱지.count()) {
      await 메모딱지.first().click(); await page.waitForTimeout(1500);
      await 찍기("메모장");
      await page.keyboard.press("Escape").catch(() => { });
    }
  }

  await 가서("/staff", 2400); await 찍기("종사자목록");
  const 첫종사자 = page.locator("tr.clickable, tbody tr").first();
  if (await 첫종사자.count()) {
    await 첫종사자.click(); await page.waitForTimeout(2600);
    await 찍기("종사자상세", { 통째로: true });
  }

  console.log("\n── ⑤ 배정 ─────────────────────────────────────────\n");
  await 가서("/assign", 2800); await 찍기("배정목록");
  const 배정줄 = page.locator("tbody tr").first();
  if (await 배정줄.count()) {
    await 배정줄.click(); await page.waitForTimeout(2600);
    await 찍기("배정창", { 통째로: true });
    const 닫기 = page.locator("button", { hasText: /^닫기$/ });
    if (await 닫기.count()) { await 닫기.first().click(); await page.waitForTimeout(800); }
  }

  console.log("\n── ⑥ 제공실적 ─────────────────────────────────────\n");
  await 가서("/records", 3000); await 찍기("실적달력");
  const 칸 = page.locator(".cal-chip");
  if (await 칸.count()) {
    for (let i = 0; i < Math.min(await 칸.count(), 20); i++) {
      const c = 칸.nth(i);
      if (await c.isEnabled()) { await c.click(); await page.waitForTimeout(1600); break; }
    }
    await 찍기("실적-칸창");
    const 미제공 = page.locator("button.상태단추", { hasText: /^미제공$/ });
    if (await 미제공.count()) {
      await 미제공.first().click(); await page.waitForTimeout(1400);
      await 찍기("실적-못간까닭");
      const 그만 = page.locator("button", { hasText: /^그만두기$/ });
      if (await 그만.count()) await 그만.first().click();
    }
    await page.keyboard.press("Escape").catch(() => { });
    await page.waitForTimeout(600);
  }

  console.log("\n── ⑦ 정산 · 기록지 · 통계 ─────────────────────────\n");
  await 가서("/billing", 3000); await 찍기("정산");
  await 가서("/recordbook", 2800); await 찍기("기록지");
  await 가서("/stats", 3000); await 찍기("통계");

  console.log("\n── ⑧ 설정 ─────────────────────────────────────────\n");
  await 가서("/settings", 2600); await 찍기("설정-일반", { 통째로: true });
  const 계산 = page.locator("button, a", { hasText: /^계산 규칙$/ });
  if (await 계산.count()) {
    await 계산.first().click(); await page.waitForTimeout(2200);
    await 찍기("설정-계산규칙", { 통째로: true });
  }
  const 기관 = page.locator("button, a", { hasText: /^기관 정보$/ });
  if (await 기관.count()) {
    await 기관.first().click(); await page.waitForTimeout(2000);
    await 찍기("설정-기관정보", { 통째로: true });
  }

} catch (e: any) {
  console.log("\n✗ 도중에 끊겼습니다 — " + (e?.message ?? e));
} finally {
  writeFileSync(join(찍는곳, "목록.json"), JSON.stringify(찍은것, null, 2), "utf8");
  console.log(`\n  ${찍은것.length}장 · ${찍는곳}\n`);
  await b.close(); await 집.끄기();
}
