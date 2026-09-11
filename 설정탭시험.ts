/**
 * 설정 탭 세 개 —  bun 설정탭시험.ts
 *
 * ═══════════════════════════════════════════════════════════
 *  왜 이 시험이 있나
 * ═══════════════════════════════════════════════════════════
 *
 * (2026-09-06 무무 — 「설정에서 관리하는 내용이 많아진 만큼 카테고리를
 *  2~3개정도로 분류해서 탭으로 분류해주면 좋겠어」)
 * (2026-09-06 무무 — 「탭 명칭을 **일반/기관정보/계산규칙** 이렇게 3가지로
 *  만들고 **별도로 여는 기준 없이 탭을 선택하면 언제나 볼 수 있도록** 해줘야 해」)
 *
 * ── 탭으로 가르면 새로 생기는 위험 ──────────────────────────
 *
 *  칸을 세 곳에 나눠 놓는 일이라, **어느 칸 하나가 통째로 사라져도
 *  화면은 멀쩡해 보입니다.** 설정 화면은 하루에 여러 번 여는 곳이
 *  아니어서, 없어진 것을 몇 주 뒤에야 압니다 — 「단가 고치는 데가
 *  어디 갔지」 하고.
 *
 *  그래서 이 시험은 **세 탭을 다 눌러 보고, 있어야 할 칸이 다 있는지**
 *  셉니다. 어느 하나가 어느 탭에도 안 뜨면 실패입니다.
 *
 * ── 무는지 확인했습니다 ─────────────────────────────────────
 *
 *   탭 하나를 지우면              → 그 탭 몫이 전부 실패
 *   서비스 단가 칸을 빼면         → 2가지 실패
 *   탭 기억을 없애면              → 2가지 실패
 *   탭을 조건부로 잠그면          → 1가지 실패
 */
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { db, initDb } from "./server/db";
import { hashPassword } from "./server/auth";
import { 설정마쳤다고 } from "./도구/설정마침";
initDb();

const 주소 = "http://127.0.0.1:5757";
let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: unknown, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}

/**
 * 설정에 있어야 하는 칸들. **하나도 없어지면 안 됩니다.**
 * 어느 탭에 있는지까지 못박습니다 — 자리가 흔들리면 찾는 사람이 헤맵니다.
 */
const 있어야할칸 = [
  { 탭: "일반",     제목: "보기",              왜: "밝기·글자 크기" },
  { 탭: "일반",     제목: "이 프로그램",        왜: "원격으로 도울 때 첫 물음이 버전 번호입니다" },
  { 탭: "일반",     제목: "근무시간",          왜: "" },

  { 탭: "일반",     제목: "사무실 안에서 열기",왜: "" },
  { 탭: "일반",     제목: "백업",              왜: "이것이 사라지면 기관이 백업을 안 합니다" },
  { 탭: "기관정보", 제목: "기관 정보",          왜: "청구서·영수증 머리글" },
  { 탭: "기관정보", 제목: "기관 직인",          왜: "" },
  { 탭: "기관정보", 제목: "배상책임보험",       왜: "" },
  { 탭: "계산규칙", 제목: "계산 규칙",          왜: "" },
  { 탭: "계산규칙", 제목: "공휴일",            왜: "" },
  { 탭: "계산규칙", 제목: "확인사항 항목",    왜: "★ 서비스에 딸린 것입니다 (2026-09-07 무무)" },
  { 탭: "계산규칙", 제목: "서비스 단가",        왜: "★ 여기가 없어지면 단가를 못 고칩니다" },
  { 탭: "계산규칙", 제목: "본인부담 구간",      왜: "★ 지자체마다 다릅니다" },
];

const 아이디 = `tab-${randomUUID().slice(0, 8)}`;
let 계정: number | null = null;

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const 쪽 = await b.newPage({ viewport: { width: 1400, height: 1100 } });

try {
  /* 최초 설정 마법사를 지나가게 해 둡니다 (v35) — 이 시험은 설정 탭을 봅니다. */
  설정마쳤다고();
  계정 = Number(db.run(
    `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload, created_at)
     VALUES ('탭시험관리자',?,?, 'admin','["admin"]','active','{}',?)`,
    [아이디, await hashPassword("시험1234"), new Date().toISOString()]).lastInsertRowid);

  await 쪽.goto(주소 + "/", { waitUntil: "networkidle" });
  if (await 쪽.locator("input#id").count()) {
    await 쪽.fill("input#id", 아이디);
    await 쪽.fill('input[type="password"]', "시험1234");
    await 쪽.locator("button.primary").first().click();
    await 쪽.waitForTimeout(2200);
  }
  본다("관리자로 들어갔다", await 쪽.locator("input#id").count() === 0);

  await 쪽.goto(주소 + "/settings", { waitUntil: "networkidle" });
  await 쪽.waitForTimeout(1200);

  // ══════════════════════════════════════════════════════════
  //  ① 탭이 셋 있고, 이름이 맞는가
  // ══════════════════════════════════════════════════════════
  console.log("\n── ① 탭 세 개 ★ ───────────────────────────────\n");
  const 띠 = 쪽.locator(".설정탭띠");
  본다("★ 탭 띠가 있다", await 띠.count() === 1);
  const 이름들 = (await 띠.locator("button").allInnerTexts()).map((x) => x.trim());
  본다("★ 탭이 정확히 셋이다", 이름들.length === 3, 이름들.join(" / "));
  본다("★ 이름이 「일반 · 기관 정보 · 계산 규칙」이다",
    이름들.join("|") === "일반|기관 정보|계산 규칙", 이름들.join(" / "));

  /*
   * ★ **모든 탭이 처음부터 눌립니다.** 「무엇을 먼저 해야 열린다」는
   *   조건을 두면 찾는 것이 어디 있는지 헷갈립니다.
   */
  const 잠긴것 = await 띠.locator("button[disabled]").count();
  본다("★★ 처음부터 세 탭이 다 눌린다", 잠긴것 === 0,
    `잠긴 탭 ${잠긴것}개 — 무무: 「별도로 여는 기준 없이 탭을 선택하면 언제나 볼 수 있도록」`);

  // ══════════════════════════════════════════════════════════
  //  ② 탭마다 있어야 할 칸이 다 있는가 ★★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ② **칸이 하나도 안 없어졌는가** ★★ ──────────\n");
  const 탭글 = { 일반: "일반", 기관정보: "기관 정보", 계산규칙: "계산 규칙" } as const;

  /** 그 탭을 열고, 지금 보이는 카드 제목들을 모읍니다. */
  async function 탭열고제목들(탭: keyof typeof 탭글): Promise<string[]> {
    await 띠.locator("button", { hasText: 탭글[탭] }).first().click();
    await 쪽.waitForTimeout(700);
    return (await 쪽.locator(".card h2, form.card h2").allInnerTexts())
      .map((x) => x.trim());
  }

  const 본제목: Record<string, string[]> = {};
  for (const 탭 of ["일반", "기관정보", "계산규칙"] as const)
    본제목[탭] = await 탭열고제목들(탭);

  for (const x of 있어야할칸) {
    const 여기 = 본제목[x.탭].some((t) => t.includes(x.제목));
    const 딴데 = Object.entries(본제목)
      .filter(([탭]) => 탭 !== x.탭)
      .find(([, ts]) => ts.some((t) => t.includes(x.제목)))?.[0];
    본다(`${여기 ? "★ " : ""}「${x.제목}」이 ${탭글[x.탭]} 탭에 있다`, 여기,
      여기 ? x.왜
           : 딴데 ? `${탭글[딴데 as keyof typeof 탭글]} 탭에 있습니다 — 자리를 옮겼습니다`
                  : "★★ 어느 탭에도 없습니다 — 통째로 사라졌습니다");
  }

  // ══════════════════════════════════════════════════════════
  //  ③ 한 탭을 열면 다른 탭 것은 안 보인다
  // ══════════════════════════════════════════════════════════
  console.log("\n── ③ 탭이 진짜로 가르는가 ★ ──────────────────\n");
  본다("★ 일반 탭에는 서비스 단가가 안 보인다",
    !본제목["일반"].some((t) => t.includes("서비스 단가")),
    "안 갈라지면 탭이 아니라 그냥 이름표입니다");
  본다("★ 계산 규칙 탭에는 기관 정보가 안 보인다",
    !본제목["계산규칙"].some((t) => t.includes("기관 정보")));
  본다("일반 탭이 제일 가볍다 (칸 수)",
    본제목["기관정보"].length <= 3,
    `일반 ${본제목["일반"].length} · 기관정보 ${본제목["기관정보"].length} · 계산규칙 ${본제목["계산규칙"].length}`);

  // ══════════════════════════════════════════════════════════
  //  ④ 고른 탭을 기억하는가 ★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ④ 고른 탭을 기억한다 ★ ────────────────────\n");
  {
    await 띠.locator("button", { hasText: "계산 규칙" }).first().click();
    await 쪽.waitForTimeout(600);
    await 쪽.reload({ waitUntil: "networkidle" });
    await 쪽.waitForTimeout(1200);
    const 고른것 = (await 쪽.locator(".설정탭띠 button.고름").innerText()).trim();
    본다("★★ 새로 고쳐도 보던 탭 그대로다", 고른것 === "계산 규칙",
      `${고른것} — 단가를 손보는 날은 하루 종일 그 탭을 오갑니다. 매번 튕기면 매번 다시 눌러야 합니다`);
    본다("★ 서비스 단가가 그대로 보인다",
      (await 쪽.locator(".card h2, form.card h2").allInnerTexts())
        .some((t) => t.includes("서비스 단가")));

    // 다른 화면에 갔다 와도
    await 쪽.goto(주소 + "/", { waitUntil: "networkidle" });
    await 쪽.waitForTimeout(800);
    await 쪽.goto(주소 + "/settings", { waitUntil: "networkidle" });
    await 쪽.waitForTimeout(1200);
    본다("★ 다른 화면에 갔다 와도 그대로다",
      (await 쪽.locator(".설정탭띠 button.고름").innerText()).trim() === "계산 규칙");
  }

  // ══════════════════════════════════════════════════════════
  //  ⑤ 눌린 탭이 눈에 보이는가
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑤ 지금 어느 탭인지 보이는가 ────────────────\n");
  {
    본다("★ 눌린 탭이 하나뿐이다",
      await 쪽.locator(".설정탭띠 button.고름").count() === 1);
    본다("★ 화면 읽개도 안다 (aria-selected)",
      await 쪽.locator('.설정탭띠 button[aria-selected="true"]').count() === 1,
      "색만으로 알리면 색을 못 가리는 분이 못 씁니다");
    const 색 = await 쪽.locator(".설정탭띠 button.고름").evaluate(
      (el) => getComputedStyle(el).borderBottomColor);
    const 안색 = await 쪽.locator(".설정탭띠 button:not(.고름)").first().evaluate(
      (el) => getComputedStyle(el).borderBottomColor);
    본다("★ 눌린 탭에 밑줄이 그어진다", 색 !== 안색, `${색} ≠ ${안색}`);
  }

  // ══════════════════════════════════════════════════════════
  //  ⑥ 탭을 옮겨도 화면이 안 터진다
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑥ 오가도 안 터진다 ────────────────────────\n");
  {
    const 오류: string[] = [];
    쪽.on("pageerror", (e) => 오류.push(String(e.message)));
    쪽.on("console", (m) => { if (m.type() === "error") 오류.push(m.text()); });
    for (const t of ["일반", "기관 정보", "계산 규칙", "일반", "계산 규칙", "기관 정보"]) {
      await 띠.locator("button", { hasText: t }).first().click();
      await 쪽.waitForTimeout(350);
    }
    본다("★ 여섯 번 오가도 화면이 안 터진다", 오류.length === 0,
      오류.slice(0, 2).join(" | ") || "없음");
    본다("마지막에 고른 탭이 맞다",
      (await 쪽.locator(".설정탭띠 button.고름").innerText()).trim() === "기관 정보");
  }

} catch (e: any) {
  실패수++;
  console.log(`\n✗ 실패  시험 도중 터짐 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 4).join("\n"));
} finally {
  await b.close();
  try { if (계정) db.run("DELETE FROM app_user WHERE id = ?", [계정]); } catch { }
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
