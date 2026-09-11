/**
 * 인쇄 — 일곱 화면 —  bun 인쇄시험.ts
 *
 * ═══════════════════════════════════════════════════════════
 *  왜 이 시험이 있나
 * ═══════════════════════════════════════════════════════════
 *
 * `인쇄목록.md` 에 적어 둔 원칙 —
 *
 * > 화면마다 따로 붙이면 **어떤 건 A4에 맞고 어떤 건 잘리는 일이 반드시
 * > 생깁니다.** 머리글에 기관명·뽑은 날짜·뽑은 사람.
 * > **종이가 돌아다니다 출처를 잃습니다.**
 *
 * ── ★★★ 이 기능이 잘못되면 나는 일 ★★★ ────────────────────
 *
 * 대상자 명단은 **지금 화면의 거르기 그대로** 나갑니다. 그런데 거르개는
 * 화면에만 있고 종이에는 안 찍힙니다. 그러면 「이용 중인 분만」 걸러
 * 뽑은 12명짜리 종이가 **전체 명단처럼** 보입니다.
 *
 * 회의 탁자에 놓인 그 장을 보고 「우리 기관 대상자가 12명이구나」 하면,
 * 실제 40명 중 28명이 없는 채로 이야기가 굴러갑니다. **종이는 스스로를
 * 설명할 수 없습니다.**
 *
 * ── 그래서 이 시험이 보는 것 ────────────────────────────────
 *
 *   ①  일곱 화면에 인쇄 단추가 다 있는가
 *   ②  ★★★ **거른 조건이 종이에 찍히는가** (화면에는 안 보이고)
 *   ③  ★★ 거르기를 바꾸면 종이의 글도 따라 바뀌는가
 *   ④  ★ 기관명 · 뽑은 때 · 뽑은 사람이 모든 화면에 붙는가
 *   ⑤  ★★ 종이에서 차림표 · 단추 · 메모장이 빠지는가
 *   ⑥  ★ 몇 건짜리인지 적히는가 (한 장 빠진 것을 알아채는 실마리)
 *   ⑦  ★★ 개인정보가 담긴 종이에 파기 안내가 붙는가
 *
 * ★ **진짜 브라우저를 인쇄 모드로 두고 잽니다** (`emulateMedia`).
 *   글만 훑으면 「`.print-when` 이 있다」까지만 알 수 있고, 정작
 *   `display:none` 이 안 풀려 종이에 안 찍히는 것은 못 잡습니다.
 */
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { db, initDb } from "./server/db";
initDb();
import { 시험관리자 } from "./도구/시험관리자";

const 주소 = "http://127.0.0.1:5757";
let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: unknown, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}

const 올해 = new Date().getFullYear();
const 사람 = randomUUID();
let 서비스 = 0, 계정: number | null = null, 인력: number | null = null, 관: any = null;

/** 일곱 화면. 「무엇을 뽑는가」가 종이에 이 말로 찍혀야 합니다. */
const 화면들 = [
  { 길: "/", 이름: "홈", 종이말: "오늘 손댈 것" },
  { 길: "/recipients", 이름: "대상자 명단", 종이말: "대상자 명단" },
  { 길: "/staff", 이름: "종사자 명부", 종이말: "종사자 명부" },
  { 길: "/assign", 이름: "배정·주간계획", 종이말: "배정 · 주간계획" },
  { 길: "/records", 이름: "제공실적", 종이말: "제공실적" },
  { 길: "/billing", 이름: "정산", 종이말: "본인부담금 청구 대장" },
  { 길: "/stats", 이름: "통계", 종이말: "통계 · 계획 대비 실적" },
];

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const 쪽 = await b.newPage({ viewport: { width: 1400, height: 1000 } });

try {
  관 = await 시험관리자("인쇄시험관리자");

  const 프로필: any = db.query(
    `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id
      WHERE o.id = 1`).get();
  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at)
          VALUES (?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: "인쇄시험대상" }), "인쇄동", "이용", `${올해}-01-01`, "x"]);
  계정 = Number(db.run(
    `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload, created_at)
     VALUES ('인쇄인력', ?, 'x', 'worker', '["worker"]', 'active', '{}', 'x')`,
    [`pr-${randomUUID().slice(0, 8)}`]).lastInsertRowid);
  인력 = Number(db.run(
    `INSERT INTO worker (user_id, hired_on, status, created_at) VALUES (?,?, 'active','x')`,
    [계정, `${올해}-01-01`]).lastInsertRowid);
  서비스 = Number(db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','가사지원','청소','인쇄시험가사','hour',24000,NULL,'time',
             NULL,0,720,0,0,995,1,1)`,
    [프로필.id, `PR-${randomUUID().slice(0, 6)}`]).lastInsertRowid);

  await 쪽.goto(주소 + "/", { waitUntil: "networkidle" });
  await 관.들어가기(쪽);

  const 기관이름 = String((db.query<any, []>(
    "SELECT name FROM organization WHERE id = 1").get())?.name ?? "");

  /** 그 화면을 열고, **화면에서 보이는 글**과 **종이에 나올 글**을 둘 다 잽니다. */
  async function 재기(길: string) {
    await 쪽.emulateMedia({ media: "screen" });
    await 쪽.goto(주소 + 길, { waitUntil: "networkidle" });
    await 쪽.waitForTimeout(1200);
    const 화면글 = await 쪽.locator("body").innerText();
    const 단추수 = await 쪽.locator(".인쇄단추 button").count();
    /* 화면에서는 안 보여야 하는 줄 */
    const 화면에보이나 = await 쪽.locator(".print-when").first()
      .isVisible().catch(() => false);

    await 쪽.emulateMedia({ media: "print" });
    await 쪽.waitForTimeout(500);
    const 종이글 = await 쪽.evaluate(() => {
      const 보이는것 = (el: Element) => {
        const s = getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden";
      };
      const 모으기 = (el: Element): string =>
        !보이는것(el) ? "" :
        [...el.childNodes].map((n) =>
          n.nodeType === 3 ? (n.textContent ?? "")
          : n.nodeType === 1 ? 모으기(n as Element) : "").join(" ");
      return 모으기(document.body).replace(/\s+/g, " ").trim();
    });
    const 차림표보이나 = await 쪽.locator(".side").first().isVisible().catch(() => false);
    const 단추보이나 = await 쪽.locator(".인쇄단추 button").first()
      .isVisible().catch(() => false);
    await 쪽.emulateMedia({ media: "screen" });
    return { 화면글, 종이글, 단추수, 화면에보이나, 차림표보이나, 단추보이나 };
  }

  // ══════════════════════════════════════════════════════════
  //  ① 일곱 화면에 단추가 있는가
  // ══════════════════════════════════════════════════════════
  console.log("\n── ① 일곱 화면에 인쇄 단추 ★★ ────────────────\n");
  const 잰것: Record<string, any> = {};
  for (const 화 of 화면들) {
    잰것[화.길] = await 재기(화.길);
    본다(`★ ${화.이름} 에 인쇄 단추가 있다`, 잰것[화.길].단추수 > 0);
  }

  // ══════════════════════════════════════════════════════════
  //  ② ★★★ 거른 조건이 종이에 찍히는가
  // ══════════════════════════════════════════════════════════
  console.log("\n── ② **거른 조건이 종이에** ★★★ ──────────────\n");
  for (const 화 of 화면들) {
    const x = 잰것[화.길];
    본다(`★★ ${화.이름} — 종이에 「${화.종이말}」이 찍힌다`,
      x.종이글.includes(화.종이말),
      x.종이글.slice(0, 90));
    본다(`★★★ ${화.이름} — 그 줄이 **화면에는 안 보인다**`,
      x.화면에보이나 === false && !x.화면글.includes(화.종이말 + " —"),
      "화면에까지 뜨면 자리만 차지하고, 관리자는 이미 거르개를 보고 있습니다");
  }

  // ══════════════════════════════════════════════════════════
  //  ③ 거르기를 바꾸면 종이 글도 따라 바뀌는가
  // ══════════════════════════════════════════════════════════
  console.log("\n── ③ **거르기를 바꾸면 따라 바뀐다** ★★★ ──────\n");
  {
    await 쪽.goto(주소 + "/recipients", { waitUntil: "networkidle" });
    await 쪽.waitForTimeout(1200);

    const 종이보기 = async () => {
      await 쪽.emulateMedia({ media: "print" });
      await 쪽.waitForTimeout(300);
      const t = (await 쪽.locator(".print-when").first().innerText()).replace(/\s+/g, " ");
      await 쪽.emulateMedia({ media: "screen" });
      return t;
    };

    const 처음 = await 종이보기();
    본다("★★ 처음에는 「상태 이용」이 찍힌다", 처음.includes("상태 이용"), 처음);
    본다("★ 몇 건인지도 찍힌다", /모두 \d+건/.test(처음),
      "한 장 빠진 것을 나중에 알아채는 유일한 실마리입니다");

    /* 찾기 칸에 글을 넣으면 그 말이 종이에도 나와야 합니다 */
    const 찾기 = 쪽.locator("#q");
    if (await 찾기.count()) {
      await 찾기.fill("인쇄시험대상");
      await 쪽.waitForTimeout(1200);
      const 뒤 = await 종이보기();
      본다("★★★ 찾기 말이 종이에 그대로 찍힌다",
        뒤.includes("인쇄시험대상"), 뒤);
      본다("★★★ 건수도 따라 줄어든다", 뒤 !== 처음,
        `${처음}  →  ${뒤}`);
      await 찾기.fill("");
      await 쪽.waitForTimeout(1000);
    }

    /* 상태 거르개를 바꾸면 그것도 */
    const 상태칸 = 쪽.locator("#status");
    if (await 상태칸.count()) {
      await 상태칸.selectOption("");
      await 쪽.waitForTimeout(1200);
      const 전체 = await 종이보기();
      본다("★★★ 「상태 전체」로 바꾸면 종이도 그렇게 적힌다",
        전체.includes("상태 전체"), 전체);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  ④ 기관명 · 뽑은 때 · 뽑은 사람
  // ══════════════════════════════════════════════════════════
  console.log("\n── ④ 종이가 출처를 잃지 않는가 ★★ ────────────\n");
  for (const 화 of 화면들) {
    const x = 잰것[화.길];
    본다(`★ ${화.이름} — 기관명이 종이에 있다`,
      !기관이름 || x.종이글.includes(기관이름));
  }
  본다("★★ 뽑은 사람 이름이 종이에 있다",
    잰것["/recipients"].종이글.includes("인쇄시험관리자"),
    "종이가 돌아다니다 출처를 잃습니다");
  본다("★★ 뽑은 때가 종이에 있다",
    new RegExp(`${올해}`).test(잰것["/recipients"].종이글));
  /*
   * ★ **화면에는 안 보여야 합니다.** 머리글이 화면에까지 뜨면 모든
   *   화면 맨 위에 기관명이 한 줄씩 더 붙어 자리만 차지합니다.
   *   반 이름이 바뀌어 CSS 가 안 걸리면 이렇게 됩니다 —
   *   종이만 보는 시험으로는 안 잡힙니다 (2026-09-07 확인).
   */
  {
    /*
     * ★ **있으면서 화면에서는 안 보여야** 합니다. 「안 보인다」만 보면
     *   반 이름이 바뀌어 아예 없어진 것도 통과합니다 (2026-09-07 확인) —
     *   그때는 CSS 가 안 걸려 화면에 그대로 뜨는데도 시험이 조용합니다.
     */
    const 있나 = await 쪽.locator(".print-head").count();
    const 보이나 = 있나 > 0 &&
      await 쪽.locator(".print-head").first().isVisible().catch(() => true);
    본다("★★ 머리글 자리가 있다", 있나 > 0,
      "반 이름이 바뀌면 CSS 가 안 걸려 화면에 그대로 뜹니다");
    본다("★★ 그 머리글이 **화면에는 안 보인다**", 있나 > 0 && !보이나,
      "화면 맨 위에 기관명이 한 줄 더 붙으면 자리만 차지합니다");
  }

  // ══════════════════════════════════════════════════════════
  //  ⑤ 종이에서 빠져야 하는 것
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑤ 종이에서 빠지는 것 ★★ ──────────────────\n");
  for (const 화 of 화면들.slice(0, 4)) {
    const x = 잰것[화.길];
    본다(`★ ${화.이름} — 종이에서 차림표가 빠진다`, x.차림표보이나 === false);
    본다(`★ ${화.이름} — 종이에서 인쇄 단추 자신이 빠진다`, x.단추보이나 === false,
      "종이에 「인쇄」 단추가 찍혀 있으면 우스운 종이가 됩니다");
  }
  본다("★ 종이에 안내문(브라우저 머리글 켜기)은 안 나온다",
    !잰것["/recipients"].종이글.includes("머리글 및 바닥글"),
    "화면에서 읽을 안내이지 종이에 남길 말이 아닙니다");

  {
    /*
     * ★★★ **열 이름이 종이에 남는가** (2026-09-07 화면에서 잡았습니다)
     *
     *   열 이름이 「이름 ⇅」처럼 정렬 **단추**로 되어 있습니다. 인쇄에서
     *   단추를 통째로 숨겼더니 종이에 열 이름이 하나도 안 남았습니다 —
     *   「연번」만 있고 나머지는 빈 칸. 숫자만 있고 그게 무엇인지 없는
     *   종이는 못 읽습니다.
     */
    await 쪽.emulateMedia({ media: "screen" });
    await 쪽.goto(주소 + "/recipients", { waitUntil: "networkidle" });
    await 쪽.waitForTimeout(1200);
    await 쪽.emulateMedia({ media: "print" });
    await 쪽.waitForTimeout(400);
    const 머리줄 = (await 쪽.locator("thead").first().innerText()).replace(/\s+/g, " ").trim();
    const 거르개보이나 = await 쪽.locator("#q").first().isVisible().catch(() => false);
    const 링크단추보이나 = await 쪽.locator(".btn-like").first().isVisible().catch(() => false);
    await 쪽.emulateMedia({ media: "screen" });

    본다("★★★ 종이에 **열 이름이 남는다**",
      머리줄.includes("이름") || 머리줄.includes("성명"),
      `${머리줄} — 열 이름이 정렬 단추라 통째로 사라지고 있었습니다`);
    본다("★★ 열이 두 개는 넘게 남는다", 머리줄.split(/\s+/).length >= 3, 머리줄);
    본다("★ 정렬 화살표(⇅▲▼)는 종이에서 뺀다", !/[⇅▲▼]/.test(머리줄),
      "화면에서 누르라는 표시일 뿐입니다");
    본다("★★ 거르개(찾기 칸)는 종이에서 빠진다", 거르개보이나 === false,
      "무엇으로 걸렀는지는 이미 맨 윗줄에 적혀 있습니다 — 빈 칸이 종이 한 뼘을 먹습니다");
    본다("★ 링크로 만든 단추도 종이에서 빠진다", 링크단추보이나 === false,
      "「방문표 전부 인쇄」 같은 것이 종이에 찍혀 있으면 우스운 종이가 됩니다");

    /*
     * ★ 거르개 **카드 통째로** 빠져야 합니다. 입력칸만 숨기면
     *   「찾기 / 상태 / 읍면동」 이름표만 남은 빈 상자가 종이 한 뼘을
     *   차지합니다 (2026-09-07 화면에서 잡았습니다).
     */
    await 쪽.emulateMedia({ media: "print" });
    await 쪽.waitForTimeout(300);
    const 거르개카드 = await 쪽.locator(".거르개").first().isVisible().catch(() => false);
    await 쪽.emulateMedia({ media: "screen" });
    본다("★★ 거르개 **상자가 통째로** 빠진다", 거르개카드 === false,
      "입력칸만 숨기면 이름표만 남은 빈 상자가 종이 한 뼘을 먹습니다");
  }

  // ══════════════════════════════════════════════════════════
  //  ⑤-2 ★★★ 메모장을 펼친 채 인쇄해도 되는가
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑤-2 **메모장을 펼친 채 인쇄** ★★★ ─────────\n");
  {
    /*
     * (2026-09-07 무무 — 「오른쪽 메모장을 펼치면 **인쇄화면이 엉망이
     *  되.** 메모장은 인쇄범위에 포함되지 않아야 해.」)
     *
     * ★ 인쇄 CSS 에 `.memo-panel` 이라고 적혀 있었는데 **그런 반 이름은
     *   없었습니다.** 진짜 이름은 `.memo-drawer` 입니다. 규칙은 있는데
     *   아무 데도 안 걸린 채로 있었고, 아무도 그것을 몰랐습니다 —
     *   **접힌 채로 인쇄하면 멀쩡했기 때문입니다.**
     *
     * 그래서 **펴 놓고** 재야 합니다. 접힌 채로 재면 영영 안 걸립니다.
     */
    await 쪽.emulateMedia({ media: "screen" });
    await 쪽.goto(주소 + "/recipients", { waitUntil: "networkidle" });
    await 쪽.waitForTimeout(1200);

    const 탭 = 쪽.locator(".memo-tab");
    본다("메모장 탭이 있다", await 탭.count() > 0);
    await 탭.click();
    await 쪽.waitForTimeout(1200);
    본다("메모장이 펼쳐졌다", await 쪽.locator(".memo-drawer").isVisible());

    await 쪽.emulateMedia({ media: "print" });
    await 쪽.waitForTimeout(500);
    const 서랍보이나 = await 쪽.locator(".memo-drawer").isVisible().catch(() => true);
    const 메모지보이나 = await 쪽.locator(".memo-note").first()
      .isVisible().catch(() => false);
    /* 서랍이 밀어 두었던 오른쪽 여백이 되돌아왔는가 — 안 그러면 표가 잘립니다. */
    const 오른여백 = await 쪽.locator(".shell").evaluate(
      (el) => getComputedStyle(el).paddingRight);
    await 쪽.emulateMedia({ media: "screen" });

    본다("★★★ 펼친 메모장이 **종이에 안 나온다**", 서랍보이나 === false,
      "메모지가 종이에 통째로 얹혀 화면이 엉망이 됐습니다");
    본다("★★★ 메모지 한 장도 안 나온다", 메모지보이나 === false);
    본다("★★★ 서랍이 밀어 둔 **오른쪽 여백이 되돌아온다**",
      오른여백 === "0px",
      `${오른여백} — 여백이 남으면 표가 왼쪽으로 밀려 오른쪽 열이 잘립니다`);

    /* 다시 접어 둡니다 — 뒤에 오는 시험이 영향받지 않게 */
    const 닫기 = 쪽.locator(".memo-drawer button", { hasText: /접기|닫기|×/ }).first();
    if (await 닫기.count()) await 닫기.click().catch(() => {});
    await 쪽.waitForTimeout(500);
  }

  // ══════════════════════════════════════════════════════════
  //  ⑥ 대상자 한 명 요약 — 개인정보 종이
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑥ 대상자 한 명 요약 ★★ ───────────────────\n");
  {
    const x = await 재기(`/recipients/${사람}`);
    본다("★ 인쇄 단추가 있다", x.단추수 > 0);
    본다("★★ 누구 것인지 종이에 찍힌다",
      x.종이글.includes("대상자 요약") && x.종이글.includes("인쇄시험대상"),
      x.종이글.slice(0, 90));
    /*
     * ★ `인쇄목록.md` — 「개인정보가 담긴 출력물에는 **「보관 기한」**을
     *   꼬리말에 넣습니다.」 이 종이는 기본정보·연락처가 통째로 담깁니다.
     */
    본다("★★★ 개인정보 종이라고 알려 준다",
      x.종이글.includes("파기"),
      "인쇄목록.md: 「개인정보가 담긴 출력물에는 「보관 기한」을 넣습니다」");
  }

  // ══════════════════════════════════════════════════════════
  //  ⑦ 부품이 한 곳인가
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑦ 부품이 한 곳인가 ★ ─────────────────────\n");
  {
    const { readFileSync, readdirSync } = await import("node:fs");
    const 화면파일 = readdirSync("web/src/pages").filter((f) => f.endsWith(".tsx"));
    const 제것 = 화면파일.filter((f) =>
      /window\.print\(\)/.test(readFileSync(`web/src/pages/${f}`, "utf8")));
    본다("★★ 화면이 저마다 window.print() 를 부르지 않는다",
      제것.length === 0,
      제것.length ? 제것.join(" · ") + " — 부품 한 곳(components/인쇄단추.tsx)을 써야 합니다"
                  : "일곱 화면이 같은 부품을 씁니다");
  }

} catch (e: any) {
  실패수++;
  console.log(`\n✗ 실패  시험 도중 터짐 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 5).join("\n"));
} finally {
  await b.close();
  db.run("DELETE FROM sticky WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM delivery WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM assignment WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM recipient WHERE id = ?", [사람]);
  if (서비스) { try { db.run("DELETE FROM service WHERE id = ?", [서비스]); } catch { } }
  try {
    if (인력) db.run("DELETE FROM worker WHERE id = ?", [인력]);
    if (계정) db.run("DELETE FROM app_user WHERE id = ?", [계정]);
  } catch { }
  관?.치우기();
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
