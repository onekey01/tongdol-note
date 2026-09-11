/**
 * 시간 셈하기 — 서비스마다 따로 —  bun 시간셈하기시험.ts
 *
 * ═══════════════════════════════════════════════════════════
 *  왜 이 시험이 있나
 * ═══════════════════════════════════════════════════════════
 *
 * (2026-09-06 무무 — 「지침의 예시 단가와 편람의 내용이 다른 부분은
 *  지자체마다 차이가 있음을 의미」 / 「년도가 바뀌면 수정되는 부분이
 *  있을텐데 **고정하면 절대 안 되는 부분**이야」)
 *
 * 편람은 **30분 단위 · 15분부터 올림**입니다. 그런데 그건 해남군이
 * 그렇게 정한 것이지 법이 그런 것이 아닙니다. 1시간 단위로 세라는 데도
 * 있고, 자투리는 무조건 버리라는 데도 있고, 해가 바뀌면 또 달라집니다.
 * 프로그램에 못박아 두면 그때마다 저를 부르셔야 합니다.
 *
 * 그래서 `service.round_unit` / `service.round_half` 두 칸을 두고
 * **서비스마다 따로** 정합니다 — 가사는 30분, 동행은 1시간처럼.
 *
 * ── 이 시험이 지키는 것 ─────────────────────────────────────
 *
 *  ①  네 조합이 다 맞는가 (30·올림 / 30·버림 / 60·올림 / 60·버림)
 *  ②  **안 건드리면 옛날 그대로인가** — 이게 제일 중요합니다.
 *      기본값이 흔들리면 이미 낸 청구서가 통째로 틀립니다.
 *  ③  **서비스마다 따로 도는가** — 한 기관 안에서 가사 30분·동행 1시간
 *  ④  끼·회 서비스는 이 규칙에 안 걸리는가 (한 번 = 한 시간)
 *  ⑤  하루 상한과 같이 걸리면 어느 쪽이 먼저인가
 *  ⑥  **이미 확정한 청구서는 안 흔들리는가** (calc_snapshot)
 *  ⑦  월 한도(`월사용`)·제공계획 달력(`record.month`)도 같은 셈인가
 *  ⑧  설정 화면의 미리보기가 **서버와 같은 숫자**를 내는가
 *      — 화면이 「30분」 해 놓고 청구서가 다른 값을 내면
 *        기관은 군에 낸 뒤에야 압니다
 *  ⑨  30·60 말고 다른 단위는 못 넣는가 (10분을 열면 시간당 단가와
 *      나눠떨어지지 않아 1원 오차가 청구서에 남습니다)
 *
 * ── 무는지 확인했습니다 ─────────────────────────────────────
 *
 *   money.ts 에서 `단위` 를 30 으로 못박으면      → 6가지 실패
 *   `반올림` 을 늘 true 로 두면                  → 4가지 실패
 *   billing.ts 의 `셈규칙읽기(r)` 를 빼면        → 5가지 실패
 *   한도.ts 의 `셈규칙읽기(r)` 를 빼면           → 2가지 실패
 *   record.ts 의 `셈규칙읽기(r)` 를 빼면         → 1가지 실패
 *   Settings.tsx 미리보기를 30 으로 못박으면     → 1가지 실패
 *   api.ts 의 `셈단위()` 검사를 빼면             → 1가지 실패
 *   api.ts 의 UPDATE 에서 두 칸을 빼면           → 3가지 실패 (⑩)
 *
 * ⑩ 은 **돌고 있는 서버를 실제로 두드립니다.** 글만 훑는 시험은
 * 「검사하는 줄이 있다」까지만 압니다 — 저장이 진짜 되는지는 저장을
 * 시켜 봐야 압니다. (api.ts 의 UPDATE 문에서 두 칸을 지우는 실험을
 * 했을 때, 글 훑기 시험 3가지는 전부 통과했습니다.)
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { hashPassword } from "./server/auth";
import { db, initDb } from "./server/db";
initDb();
import { 인정분, 셈규칙읽기 } from "./server/money";
import { 실적줄들, issue, one } from "./server/billing";
import { 월사용 } from "./server/한도";
import { month as 계획달 } from "./server/record";

let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: unknown, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}

const 오늘 = new Date().toISOString().slice(0, 10);
const 올해 = Number(오늘.slice(0, 4));
const 지난달 = (() => {
  const d = new Date(`${오늘}T00:00:00Z`);
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
})();

const 사람 = randomUUID();
const 서비스들: number[] = [];
let 배정들: number[] = [], 계정: number | null = null, 인력: number | null = null;
const 지울계정: number[] = [];

/** 시험용 시간제 서비스 하나. */
function 서비스만들기(
  프로필: number, 이름: string, 단가: number,
  단위: number, 반올림: boolean, 옵션: { 월한도분?: number } = {}
): number {
  const id = Number(db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          round_unit, round_half, sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','시험','시험',?,'hour',?,NULL,'time',
             NULL,0,?,0,0,?,?,950,1,1)`,
    [프로필, `TRND-${randomUUID().slice(0, 6)}`, 이름, 단가,
     옵션.월한도분 ?? 0, 단위, 반올림 ? 1 : 0]).lastInsertRowid);
  서비스들.push(id);
  return id;
}

function 배정만들기(서비스: number, 주간 = "[]"): number {
  db.run(
    `INSERT INTO referral (batch_label, recipient_id, service_id, period_from,
                           cycle_unit, cycle_count, cycle_text, diff_state, created_at)
     VALUES ('시험', ?, ?, ?, 'month', 20, '월 20회', '신규', 'x')`,
    [사람, 서비스, `${올해 - 1}-01-01`]);
  const id = Number(db.run(
    `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
     VALUES (?,?,?,?,?,'x')`,
    [사람, 서비스, 인력, 주간, `${올해 - 1}-01-01`]).lastInsertRowid);
  배정들.push(id);
  return id;
}

function 다녀옴(배정: number, 서비스: number, 날: string, 분: number) {
  db.run(
    `INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                           is_holiday,planned,minutes,created_at)
     VALUES (?,?,?,?,'제공',0,1,?,'x')`,
    [배정, 사람, 서비스, 날, 분]);
}

try {
  const 프로필: any = db.query(
    `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id
      WHERE o.id = 1`).get();
  if (!프로필) throw new Error("기관이 없습니다. 통돌 Note 를 한 번 켜 주세요.");

  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at)
          VALUES (?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: "셈시험" }), "해남읍", "이용", `${올해 - 1}-01-01`, "x"]);
  const u = db.run(
    `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload, created_at)
     VALUES ('셈인력', ?, 'x', 'worker', '["worker"]', 'active', '{}', 'x')`,
    [`t-${randomUUID().slice(0, 8)}`]);
  계정 = Number(u.lastInsertRowid);
  인력 = Number(db.run(
    `INSERT INTO worker (user_id, hired_on, status, created_at) VALUES (?,?, 'active','x')`,
    [계정, `${올해 - 1}-01-01`]).lastInsertRowid);

  // ══════════════════════════════════════════════════════════
  //  ① 네 조합
  // ══════════════════════════════════════════════════════════
  console.log("\n── ① 네 조합 ★ ─────────────────────────────────\n");
  {
    const 삼올 = { 단위: 30, 반올림: true };
    const 삼버 = { 단위: 30, 반올림: false };
    const 육올 = { 단위: 60, 반올림: true };
    const 육버 = { 단위: 60, 반올림: false };

    본다("30분·올림 — 14분은 안 셈", 인정분(14, 삼올) === 0, "15분을 못 넘겼습니다");
    본다("★ 30분·올림 — 15분은 30분", 인정분(15, 삼올) === 30, "딱 절반이면 올립니다");
    본다("30분·올림 — 44분은 30분", 인정분(44, 삼올) === 30);
    본다("★ 30분·올림 — 45분은 1시간", 인정분(45, 삼올) === 60);
    본다("30분·올림 — 1시간 20분은 1시간 30분", 인정분(80, 삼올) === 90);

    본다("★ 30분·버림 — 29분은 안 셈", 인정분(29, 삼버) === 0, "자투리를 버립니다");
    본다("30분·버림 — 30분은 30분", 인정분(30, 삼버) === 30);
    본다("★ 30분·버림 — 59분은 30분", 인정분(59, 삼버) === 30,
      "여기가 올림으로 새면 한 건에 30분씩 더 청구됩니다");

    본다("★ 1시간·올림 — 29분은 안 셈", 인정분(29, 육올) === 0);
    본다("★ 1시간·올림 — 30분은 1시간", 인정분(30, 육올) === 60, "절반이면 올립니다");
    본다("1시간·올림 — 89분은 1시간", 인정분(89, 육올) === 60);
    본다("★ 1시간·올림 — 90분은 2시간", 인정분(90, 육올) === 120);

    본다("★ 1시간·버림 — 59분은 안 셈", 인정분(59, 육버) === 0,
      "한 시간을 못 채웠으면 0 입니다");
    본다("1시간·버림 — 119분은 1시간", 인정분(119, 육버) === 60);

    본다("0분·음수는 0", 인정분(0, 삼올) === 0 && 인정분(-5, 육올) === 0);
  }

  // ══════════════════════════════════════════════════════════
  //  ② 안 건드리면 옛날 그대로 ★★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ② **기본값은 편람 그대로** ★★ ────────────────\n");
  {
    // 규칙을 아예 안 주는 옛 부름 자리 — 예전 못박은 셈과 같아야 합니다.
    const 옛셈 = (m: number) => Math.floor((Math.floor(m) + 15) / 30) * 30;
    let 다름 = 0;
    for (let m = 1; m <= 600; m++) if (인정분(m) !== 옛셈(m)) 다름++;
    본다("★★ 규칙을 안 주면 옛 셈과 1분도 안 다르다", 다름 === 0,
      `1~600분 전부 맞음 (다른 곳 ${다름}군데)`);

    본다("★ 자료함 기본값이 30분·반올림이다",
      셈규칙읽기({}).단위 === 30 && 셈규칙읽기({}).반올림 === true,
      "칸이 비어 있는 옛 서비스도 편람대로 셉니다");
    본다("★ round_half = 0 이면 버림으로 읽는다",
      셈규칙읽기({ round_unit: 30, round_half: 0 }).반올림 === false);
    본다("★ 이상한 단위가 들어와도 30 으로 읽는다",
      셈규칙읽기({ round_unit: 17 }).단위 === 30,
      "자료함이 더러워도 청구가 이상해지지는 않게");
  }

  // ══════════════════════════════════════════════════════════
  //  ③ 서비스마다 따로 ★★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ③ **한 기관 안에서 서비스마다 따로** ★★ ──────\n");
  const 가사 = 서비스만들기(프로필.id, "셈시험가사", 24000, 30, true);
  const 동행 = 서비스만들기(프로필.id, "셈시험동행", 27000, 60, true);
  const 가사배정 = 배정만들기(가사);
  const 동행배정 = 배정만들기(동행);

  const 날 = `${지난달}-10`;
  const 날2 = `${지난달}-11`;
  다녀옴(가사배정, 가사, 날, 80);      // 30분·올림 → 90분
  다녀옴(동행배정, 동행, 날2, 80);     // 1시간·올림 → 60분
  {
    const 줄 = 실적줄들(사람, `${지난달}-01`, `${지난달}-31`);
    const g = 줄.find((x) => x.service_id === 가사);
    const d = 줄.find((x) => x.service_id === 동행);
    본다("★★ 같은 80분인데 가사는 1시간 30분", g?.인정분 === 90, `${g?.인정분}분`);
    본다("★★ 같은 80분인데 동행은 1시간", d?.인정분 === 60,
      `${d?.인정분}분 — 여기가 같아지면 서비스별 규칙이 죽은 것입니다`);
    본다("★ 돈도 따로 나온다 (가사 36,000 · 동행 27,000)",
      Math.round(24000 * (g!.인정분 / 60)) === 36000 &&
      Math.round(27000 * (d!.인정분 / 60)) === 27000);
  }

  // ── 규칙을 바꾸면 그 서비스만 따라 움직인다 ─────────────────
  {
    db.run("UPDATE service SET round_unit = 60, round_half = 0 WHERE id = ?", [가사]);
    const 줄 = 실적줄들(사람, `${지난달}-01`, `${지난달}-31`);
    const g = 줄.find((x) => x.service_id === 가사);
    const d = 줄.find((x) => x.service_id === 동행);
    본다("★ 가사를 1시간·버림으로 바꾸면 80분이 1시간", g?.인정분 === 60, `${g?.인정분}분`);
    본다("★ 동행은 그대로다", d?.인정분 === 60, "옆 서비스를 안 건드립니다");
    db.run("UPDATE service SET round_unit = 30, round_half = 1 WHERE id = ?", [가사]);
  }

  // ══════════════════════════════════════════════════════════
  //  ④ 끼·회는 이 규칙에 안 걸린다
  // ══════════════════════════════════════════════════════════
  console.log("\n── ④ 끼·회는 「한 번 = 한 시간」 ────────────────\n");
  {
    const 식사 = Number(db.run(
      `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                            holiday_price, record_type, lifetime_cap, outside_annual_cap,
                            monthly_cap_minutes, monthly_cap_count, noshow_billable,
                            round_unit, round_half, sort_order, active, custom)
       VALUES (?,?,'일상생활돌봄','시험','시험','셈시험식사','meal',10100,NULL,'meal',
               NULL,0,0,0,0,60,0,951,1,1)`,
      [프로필.id, `TRNM-${randomUUID().slice(0, 6)}`]).lastInsertRowid);
    서비스들.push(식사);
    const 식사배정 = 배정만들기(식사);
    다녀옴(식사배정, 식사, `${지난달}-12`, 20);   // 20분 — 1시간·버림이면 0이 될 값
    const 줄 = 실적줄들(사람, `${지난달}-01`, `${지난달}-31`);
    const m = 줄.find((x) => x.service_id === 식사);
    본다("★ 끼 단위는 규칙이 뭐든 한 번 = 한 시간", m?.인정분 === 60,
      `${m?.인정분}분 — 1시간·버림 규칙이 붙어 있어도 20분이 0 이 되면 안 됩니다`);
    본다("잰 분은 안 봅니다", m?.잰분 === null);
  }

  // ══════════════════════════════════════════════════════════
  //  ⑤ 하루 상한과 같이 걸릴 때
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑤ 하루 상한이 **셈한 뒤에** 깎는다 ──────────\n");
  {
    // 주간계획에 하루 60분을 박아 그 날 상한을 60분으로 만듭니다.
    const 상한서비스 = 서비스만들기(프로필.id, "셈시험상한", 24000, 30, true);
    const 요일 = new Date(`${지난달}-13T00:00:00Z`).getUTCDay();
    const 상한배정 = 배정만들기(상한서비스,
      JSON.stringify([{ dow: 요일, minutes: 60 }]));
    다녀옴(상한배정, 상한서비스, `${지난달}-13`, 80);   // 셈하면 90분, 상한이 60분
    const 줄 = 실적줄들(사람, `${지난달}-01`, `${지난달}-31`);
    const x = 줄.find((r) => r.service_id === 상한서비스);
    본다("★ 90분으로 셈한 뒤 하루 상한 60분으로 깎인다", x?.인정분 === 60, `${x?.인정분}분`);
    본다("★ 깎였다고 표시된다", x?.깎였나 === true,
      "말없이 줄면 기관이 왜 돈이 적은지 모릅니다");
  }

  // ══════════════════════════════════════════════════════════
  //  ⑦ 월 한도·제공계획 달력도 같은 셈인가
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑦ 월 한도·달력도 **같은 숫자** ★ ───────────\n");
  {
    const 한도서비스 = 서비스만들기(프로필.id, "셈시험한도", 24000, 60, true,
      { 월한도분: 120 });
    const 한도배정 = 배정만들기(한도서비스);
    다녀옴(한도배정, 한도서비스, `${지난달}-14`, 80);   // 1시간·올림 → 60분
    const 줄 = 월사용(사람, 지난달).find((x) => x.serviceId === 한도서비스);
    본다("★ 월 한도도 서비스 규칙으로 센다", 줄?.인정분합 === 60,
      `${줄?.인정분합}분 — 30분 규칙이면 90분이 나옵니다`);
    본다("잰 분은 잰 대로 따로 보인다", 줄?.쓴분 === 80,
      "「1시간 20분 다녀왔는데 1시간만 셈합니다」를 화면이 말할 수 있어야 합니다");

    const 달: any = 계획달(지난달, { q: "셈시험" });
    const 목록: any[] = 달.items ?? 달.rows ?? (Array.isArray(달) ? 달 : []);
    const 항목 = 목록.find((x: any) => Number(x.serviceId) === 한도서비스);
    const 칸 = 항목?.cells?.find((c: any) => c.on === `${지난달}-14`);
    본다("★ 제공계획 달력의 인정 시간도 같다", 칸?.인정 === 60,
      `${칸?.인정}분`);
  }

  // ══════════════════════════════════════════════════════════
  //  ⑥ 이미 확정한 청구서는 안 흔들린다 ★★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑥ **확정한 청구서는 안 흔들린다** ★★ ────────\n");
  {
    const 앞 = issue(사람, 지난달, "시험", undefined as any);
    const 확정액 = 앞.total;
    본다("확정이 됐다", 확정액 > 0, `${확정액.toLocaleString()}원`);

    // 규칙을 통째로 바꿉니다 — 살아 있는 셈은 달라져야 하고,
    for (const s of 서비스들)
      db.run("UPDATE service SET round_unit = 60, round_half = 0 WHERE id = ? AND unit = 'hour'", [s]);

    const 살아있는 = 실적줄들(사람, `${지난달}-01`, `${지난달}-31`)
      .reduce((s, r) => s + Math.round(Number(r.unit_price ?? 0) * (r.인정분 / 60)), 0);
    본다("★ 살아 있는 셈은 달라진다", 살아있는 !== 확정액,
      `지금 셈 ${살아있는.toLocaleString()}원 ≠ 확정 ${확정액.toLocaleString()}원`);

    const 종이 = one(사람, 지난달) as any;
    본다("★★ 확정한 종이는 그대로다", 종이.total === 확정액,
      `${Number(종이.total).toLocaleString()}원 — 얼려 둔 값을 봅니다`);
    본다("얼린 종이라고 표시된다", 종이.frozen === true);

    for (const s of 서비스들)
      db.run("UPDATE service SET round_unit = 30, round_half = 1 WHERE id = ?", [s]);
  }

  // ══════════════════════════════════════════════════════════
  //  ⑧ 설정 화면 미리보기가 서버와 같은가 ★★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑧ **설정 미리보기 = 서버 셈** ★★ ───────────\n");
  {
    /*
     * Settings.tsx 안의 `인정분미리()` 를 **글에서 그대로 떼어다** 돌립니다.
     * 베껴 적으면 두 곳이 갈라져도 시험이 통과해 버립니다 —
     * 그러면 이 시험이 지키려던 것을 못 지킵니다.
     */
    const 글 = readFileSync("web/src/pages/Settings.tsx", "utf8");
    const m = 글.match(/function 인정분미리\([\s\S]*?\n\}/);
    본다("설정 화면에서 미리보기 셈을 찾았다", !!m);
    if (m) {
      // 타입을 붙인 채라 그대로는 못 돌립니다 — 번 자체 변환기로 벗깁니다.
      const 민 = new Bun.Transpiler({ loader: "ts" }).transformSync(m[0]);
      const 미리 = new Function(`${민}; return 인정분미리;`)() as
        (분: number, 단위: number, 반올림: boolean) => number;
      let 다름 = 0, 첫: string | null = null;
      for (const [단위, 반올림] of [[30, true], [30, false], [60, true], [60, false]] as const)
        for (let 분 = 0; 분 <= 400; 분++) {
          const a = 미리(분, 단위, 반올림);
          const b = 인정분(분, { 단위, 반올림 });
          if (a !== b) { 다름++; 첫 ??= `${분}분 ${단위}분단위 ${반올림 ? "올림" : "버림"} → 화면 ${a} ≠ 서버 ${b}`; }
        }
      본다("★★ 네 조합 · 0~400분 전부 서버와 같다", 다름 === 0,
        다름 ? `${다름}군데 다름 (처음: ${첫})`
             : "화면이 말한 숫자가 청구서에 그대로 나옵니다");
    }
  }

  // ══════════════════════════════════════════════════════════
  //  ⑨ 30·60 말고는 못 넣는다
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑨ 단위는 30분과 1시간뿐 ★ ──────────────────\n");
  {
    const 글 = readFileSync("server/api.ts", "utf8");
    본다("★ 서버에 단위 검사가 있다",
      /const 셈단위 = [\s\S]{0,400}n !== 30 && n !== 60/.test(글),
      "10분·15분을 열면 시간당 단가와 안 나눠떨어져 1원 오차가 남습니다");
    본다("★ 새 서비스·고칠 때 둘 다 그 검사를 쓴다",
      (글.match(/셈단위\(b\.roundUnit\)/g) ?? []).length >= 2);
    본다("★ 안 보낸 칸은 있던 값을 지킨다",
      /"roundUnit" in b \? 셈단위\(b\.roundUnit\) : cur\.round_unit/.test(글),
      "일부만 보냈는데 안 보낸 칸이 소리 없이 30 으로 돌아가면 안 됩니다");
  }

  // ══════════════════════════════════════════════════════════
  //  ⑩ 돌고 있는 서버에 **진짜로 저장해 봅니다** ★★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑩ **설정에서 저장이 진짜 되는가** ★★ ────────\n");
  if (프로필.is_builtin) {
    console.log("     (건너뜀 — 지금 「복지부 지침 표준」이라 설정을 못 고칩니다)");
  } else {
    const 주소 = "http://127.0.0.1:5757";
    const 아이디 = `rnd-${randomUUID().slice(0, 8)}`;
    const 관리자 = Number(db.run(
      `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload, created_at)
       VALUES ('셈시험관리자',?,?, 'admin','["admin"]','active','{}',?)`,
      [아이디, await hashPassword("시험1234"), new Date().toISOString()]).lastInsertRowid);
    지울계정.push(관리자);

    const 로그 = await fetch(`${주소}/api/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ loginId: 아이디, password: "시험1234" }),
    });
    const 쿠키 = 로그.headers.get("set-cookie")?.split(";")[0] ?? "";
    본다("관리자로 들어갔다", !!쿠키);

    const 두드리기 = async (길: string, 옵션: RequestInit = {}) => {
      const r = await fetch(주소 + 길, {
        ...옵션,
        headers: { cookie: 쿠키, "content-type": "application/json", ...(옵션.headers ?? {}) },
      });
      let 몸: any = null; try { 몸 = await r.json(); } catch { }
      return { 상태: r.status, 몸 };
    };
    const 자료함 = (id: number) => db.query<any, [number]>(
      "SELECT round_unit, round_half, name FROM service WHERE id = ?").get(id);

    // ── 새로 만들 때 ───────────────────────────────────────
    const 만듦 = await 두드리기("/api/settings/service", {
      method: "POST",
      body: JSON.stringify({
        name: "셈저장시험", unit: "hour", unitPrice: 20000, recordType: "time",
        roundUnit: 60, roundHalf: false,
      }),
    });
    본다("새 서비스가 만들어졌다", 만듦.상태 === 200 && !!만듦.몸?.id,
      JSON.stringify(만듦.몸));
    const 새것 = Number(만듦.몸?.id ?? 0);
    if (새것) 서비스들.push(새것);
    본다("★★ 만들 때 준 규칙이 자료함에 그대로 들어간다",
      자료함(새것)?.round_unit === 60 && 자료함(새것)?.round_half === 0,
      JSON.stringify(자료함(새것)));

    // ── 안 보낸 칸은 지킨다 ────────────────────────────────
    const 이름만 = await 두드리기(`/api/settings/service/${새것}`, {
      method: "PATCH", body: JSON.stringify({ name: "셈저장시험2" }),
    });
    본다("이름만 보내도 저장된다", 이름만.상태 === 200, JSON.stringify(이름만.몸));
    본다("★★ 안 보낸 시간 규칙이 그대로 남는다",
      자료함(새것)?.round_unit === 60 && 자료함(새것)?.round_half === 0,
      `${JSON.stringify(자료함(새것))} — 소리 없이 30분·반올림으로 돌아가면 ` +
      `그 서비스의 청구가 통째로 틀립니다`);

    // ── 고칠 때 ────────────────────────────────────────────
    const 고침 = await 두드리기(`/api/settings/service/${새것}`, {
      method: "PATCH", body: JSON.stringify({ roundUnit: 30, roundHalf: true }),
    });
    본다("★★ 고친 규칙이 자료함에 들어간다",
      고침.상태 === 200 && 자료함(새것)?.round_unit === 30 && 자료함(새것)?.round_half === 1,
      JSON.stringify(자료함(새것)));

    // ── 30·60 말고는 막는다 ────────────────────────────────
    const 나쁜것 = await 두드리기(`/api/settings/service/${새것}`, {
      method: "PATCH", body: JSON.stringify({ roundUnit: 45 }),
    });
    본다("★ 45분 같은 단위는 막는다", 나쁜것.상태 >= 400,
      String(나쁜것.몸?.error ?? 나쁜것.상태));
    본다("★ 왜 안 되는지 말해 준다",
      String(나쁜것.몸?.error ?? "").includes("30분") &&
      String(나쁜것.몸?.error ?? "").includes("1시간"),
      String(나쁜것.몸?.error ?? ""));
    본다("막힌 뒤에도 있던 값은 안 다친다", 자료함(새것)?.round_unit === 30);

    // ── 설정 화면이 그 값을 돌려주는가 ─────────────────────
    const 설정 = await 두드리기("/api/settings");
    const 보임 = (설정.몸?.services ?? []).find((x: any) => x.id === 새것);
    본다("★ 설정 화면이 그 칸을 받아 본다",
      보임 && "round_unit" in 보임 && "round_half" in 보임,
      "화면이 못 받으면 늘 30분으로 보이고, 저장할 때마다 30분으로 덮습니다");
  }

} catch (e: any) {
  실패수++;
  console.log(`\n✗ 실패  시험 도중 터짐 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 5).join("\n"));
} finally {
  db.run("DELETE FROM billing   WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM delivery  WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM referral  WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM assignment WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM recipient WHERE id = ?", [사람]);
  for (const s of 서비스들) { try { db.run("DELETE FROM service WHERE id = ?", [s]); } catch { } }
  try {
    if (인력) db.run("DELETE FROM worker WHERE id = ?", [인력]);
    if (계정) db.run("DELETE FROM app_user WHERE id = ?", [계정]);
    for (const a of 지울계정) db.run("DELETE FROM app_user WHERE id = ?", [a]);
  } catch { }
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
