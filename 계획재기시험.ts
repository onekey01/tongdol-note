/**
 * 계획을 미리 재기 —  bun 계획재기시험.ts
 *
 * ═══════════════════════════════════════════════════════════
 *  왜 이 시험이 있나
 * ═══════════════════════════════════════════════════════════
 *
 * (2026-09-07 무무 — 계획 수립 시 100%가 넘어가는 계획이 수립되면
 *  경고창을 띄우자 / 「단계적으로 막음… **한도가 넘어갈 경우 지자체
 *  예산의 문제가 발생할 수 있습니다. 정말로 계획 할까요?** 라고 한번만
 *  더 묻는거지」)
 *
 * 한도 경고가 전부 **사후**였습니다. 다녀온 기록이 쌓여 넘고 나서야
 * 홈에 떴는데, 그때는 **이미 나간 돈**입니다.
 *
 * ═══════════════════════════════════════════════════════════
 *  ★★★ 첫 버전이 틀렸습니다 — 그래서 이 시험이 있습니다 ★★★
 * ═══════════════════════════════════════════════════════════
 *
 * 첫 버전은 「주 3회 × **4.35주**」로 밀어서 셌습니다. 화면에 이렇게
 * 떴습니다 —  「한 달 **13.05회**」 · 「**26시간 6분**」
 *
 *   (무무 — 「시간 한도는 지원인력이 **실행 했다고 인정되는 시간**을
 *    말 하는거야. **기간으로 계산되는게 아니고.**」
 *    「실제로 실행되었다고 인정되는 **횟수(소수점은 말도 안되지) ×
 *     시간**으로 계산이 되어야 해. **6분 자체가 말이 안되는 거야.**」)
 *
 * 사람은 4.35번 갈 수 없고, 30분 단위로 세는 서비스에서 「6분」이라는
 * 자투리는 어디에서도 안 생깁니다. 그래서 세 가지를 바로잡았고,
 * 이 시험이 그 셋을 지킵니다 —
 *
 *   ① **달력을 그대로 세어 정수 횟수**로 냅니다
 *   ② **개시일부터 2개월**까지만 셉니다 (편람)
 *   ③ 연간 한도에는 **월 한도까지만** 더합니다
 *
 * ── 이 기능이 잘못되면 나는 일 ──────────────────────────────
 *
 *  · **넘는데 안 뜹니다** — 「경고가 없었으니 괜찮은 줄 알았다」가 됩니다
 *  · **안 넘는데 뜹니다** — 매번 뜨는 창은 아무도 안 읽습니다
 *  · **미리 잰 값과 청구서가 다릅니다** — 그 줄을 다시는 안 믿습니다
 *  · **막아 버립니다** — 지자체가 승인한 계획을 못 넣습니다
 *  · **같은 초과를 두 번 셉니다** — 월 한도 경고와 연간 경고가 겹칩니다
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { db, initDb } from "./server/db";
initDb();
import { 시험관리자 } from "./도구/시험관리자";
import { 계획재기, 요일센다 } from "./server/계획재기";
import { 연간쓴돈 } from "./server/한도";

const 주소 = "http://127.0.0.1:5757";
let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: unknown, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}
const 칸찾기 = (r: any, 조각: string) =>
  (r.칸들 ?? []).find((x: any) => String(x.이름).includes(조각));

const 오늘 = new Date().toISOString().slice(0, 10);
const 올해 = Number(오늘.slice(0, 4));
/** 시험이 쓰는 개시일 — 지난 날은 「앞으로 갈 것」에서 빠지므로 오늘로 잡습니다. */
const 개시 = 오늘;

const 사람 = randomUUID();
let 가사 = 0, 동행 = 0, 공사 = 0, 배정 = 0, 계정: number | null = null, 인력: number | null = null;
let 관: any = null;
let 옛기준 = "total";
let 프로필: any = null;

try {
  관 = await 시험관리자("계획시험관리자");
  프로필 = db.query(
    `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id
      WHERE o.id = 1`).get();
  if (!프로필) throw new Error("기관이 없습니다. 통돌 Note 를 한 번 켜 주세요.");
  옛기준 = String((프로필 as any).cap_basis ?? "total");
  db.run("UPDATE region_profile SET cap_basis = 'total' WHERE id = ?", [프로필.id]);

  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at)
          VALUES (?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: "계획시험" }), "해남읍", "이용", `${올해}-01-01`, "x"]);
  계정 = Number(db.run(
    `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload, created_at)
     VALUES ('계획인력', ?, 'x', 'worker', '["worker"]', 'active', '{}', 'x')`,
    [`plan-${randomUUID().slice(0, 8)}`]).lastInsertRowid);
  인력 = Number(db.run(
    `INSERT INTO worker (user_id, hired_on, status, created_at) VALUES (?,?, 'active','x')`,
    [계정, `${올해}-01-01`]).lastInsertRowid);

  /** 가사 — 시간제 · 24,000원 · 월 720분(12시간) · 30분 반올림 · 2개월 */
  가사 = Number(db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          round_unit, round_half, period_cap_months, sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','가사지원','청소','계획시험가사','hour',24000,NULL,'time',
             NULL,0,720,0,0,30,1,2,980,1,1)`,
    [프로필.id, `PL1-${randomUUID().slice(0, 6)}`]).lastInsertRowid);

  /** 동행 — 월 360분 **그리고** 월 2회 (둘 다 걸립니다) */
  동행 = Number(db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          round_unit, round_half, period_cap_months, sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','이동지원','동행','계획시험동행','hour',27000,NULL,'time',
             NULL,0,360,2,0,30,1,2,981,1,1)`,
    [프로필.id, `PL2-${randomUUID().slice(0, 6)}`]).lastInsertRowid);

  /** 안전생활환경 — 생애 1회 · 연간 한도 바깥 · 기간 제한 없음 */
  공사 = Number(db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          period_cap_months, sort_order, active, custom)
     VALUES (?,?,'주거지원','안전생활환경','공사','계획시험공사','time',500000,NULL,'work',
             1000000,1,0,0,0,0,982,1,1)`,
    [프로필.id, `PL3-${randomUUID().slice(0, 6)}`]).lastInsertRowid);

  const 주3회 = [{ dow: 1, minutes: 120 }, { dow: 3, minutes: 120 }, { dow: 5, minutes: 120 }];
  const 주1회 = [{ dow: 1, minutes: 120 }];

  // ══════════════════════════════════════════════════════════
  //  ① 달력을 그대로 세어 **정수**로
  // ══════════════════════════════════════════════════════════
  console.log("\n── ① **달력을 그대로 세어 정수로** ★★★ ────────\n");
  {
    본다("★★★ 2026-09-07 ~ 09-30 월·수·금은 **11번**",
      요일센다("2026-09-07", "2026-09-30", [1, 3, 5]) === 11,
      `${요일센다("2026-09-07", "2026-09-30", [1, 3, 5])}번 — 「4.35주」로 밀면 13.05번이 나옵니다`);
    본다("★★★ 2026-10 한 달 월·수·금은 **13번**",
      요일센다("2026-10-01", "2026-10-31", [1, 3, 5]) === 13,
      "달마다 다릅니다 — 그게 사실입니다");
    본다("★ 요일을 안 고르면 0", 요일센다("2026-09-01", "2026-09-30", []) === 0);
    본다("★ 거꾸로 된 구간은 0", 요일센다("2026-09-30", "2026-09-01", [1]) === 0);
    본다("★ 하루짜리도 센다 (9월 7일은 월요일)",
      요일센다("2026-09-07", "2026-09-07", [1]) === 1);

    const r = 계획재기(사람, 가사, 주3회, { from: 개시, to: `${올해}-12-31` });
    본다("대상자와 서비스를 알아본다",
      r.대상자 === "계획시험" && r.서비스 === "계획시험가사");
    본다("★★★ 횟수가 **모두 정수다**",
      r.달들.length > 0 && r.달들.every((m) => Number.isInteger(m.횟수)),
      r.달들.map((m) => `${m.달} ${m.횟수}번`).join(" · "));
    본다("★★★ 시간에 **자투리 분이 안 생긴다**",
      r.달들.every((m) => m.인정분 % 30 === 0),
      r.달들.map((m) => `${m.달} ${m.인정분 / 60}시간`).join(" · ") +
      " — 「26시간 6분」 같은 값이 나오면 안 됩니다");
    본다("★ 그 달 인정분 = 횟수 × 한 번 인정분",
      r.달들.every((m) => m.인정분 === m.횟수 * 120));
    본다("요일을 안 고르면 달이 안 생긴다", 계획재기(사람, 가사, []).달들.length === 0);
  }

  // ══════════════════════════════════════════════════════════
  //  ② 개시일부터 2개월
  // ══════════════════════════════════════════════════════════
  console.log("\n── ② **개시일부터 2개월까지만** ★★★ ──────────\n");
  {
    const r = 계획재기(사람, 가사, 주3회, { from: `${올해}-09-07`, to: `${올해}-12-31` });
    본다("★★★ 배정이 연말까지여도 **2개월로 자른다**",
      r.마지막날 === `${올해}-11-06`,
      `${r.개시일} ~ ${r.마지막날} — 편람: 가사지원은 「개시일부터 2개월」`);
    본다("★★ 달이 셋을 안 넘는다 (9·10·11월 일부)", r.달들.length <= 3,
      r.달들.map((m) => m.달).join(" · "));
    본다("★ 기간 제한을 화면에 알려 준다", r.기간개월 === 2);

    /* 배정이 2개월보다 짧으면 그 짧은 쪽을 씁니다 */
    const 짧 = 계획재기(사람, 가사, 주3회, { from: `${올해}-09-07`, to: `${올해}-09-20` });
    본다("★ 배정이 더 짧으면 그쪽을 쓴다", 짧.마지막날 === `${올해}-09-20`);

    /* 기간 제한이 0 인 서비스는 안 자릅니다 */
    const 안자름 = 계획재기(사람, 공사, [{ dow: 2 }], { from: `${올해}-09-07`, to: `${올해}-12-31` });
    본다("★ 기간 제한이 0 이면 안 자른다", 안자름.마지막날 === `${올해}-12-31`,
      "지자체마다 다를 수 있어 서비스마다 정합니다");

    /* 설정에서 고칠 수 있어야 합니다 */
    db.run("UPDATE service SET period_cap_months = 3 WHERE id = ?", [가사]);
    본다("★★ 설정에서 개월 수를 고치면 따라간다",
      계획재기(사람, 가사, 주3회, { from: `${올해}-09-07`, to: `${올해}-12-31` })
        .마지막날 === `${올해}-12-06`,
      "해가 바뀌면 고쳐질 수 있어 프로그램에 못박지 않았습니다");
    db.run("UPDATE service SET period_cap_months = 2 WHERE id = ?", [가사]);
  }

  // ══════════════════════════════════════════════════════════
  //  ③ 시간 셈 규칙 · 하루 최대
  // ══════════════════════════════════════════════════════════
  console.log("\n── ③ 시간 셈 규칙을 청구와 같이 쓰는가 ★★ ──────\n");
  {
    const a = 계획재기(사람, 가사, [{ dow: 1, minutes: 40 }], { from: 개시 });
    본다("★★ 40분 다녀오면 **30분으로** 셈한다",
      a.달들.length > 0 && a.달들.every((m) => m.인정분 === m.횟수 * 30),
      a.달들.map((m) => `${m.달} ${m.횟수}번 × 30분`).join(" · "));

    db.run("UPDATE service SET round_unit = 60, round_half = 0 WHERE id = ?", [가사]);
    본다("★★ 서비스의 셈 규칙을 바꾸면 미리 재는 값도 따라간다",
      계획재기(사람, 가사, [{ dow: 1, minutes: 40 }], { from: 개시 }).앞으로돈 === 0,
      "「1시간·버림」이면 40분은 안 셉니다");
    db.run("UPDATE service SET round_unit = 30, round_half = 1 WHERE id = ?", [가사]);

    const 하루최대 = Number((db.query<any, []>(
      `SELECT rp.daily_cap_minutes AS n FROM region_profile rp
         JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`).get() as any)?.n ?? 180);
    const b = 계획재기(사람, 가사, [{ dow: 1, minutes: 600 }], { from: 개시 });
    본다("★ 하루 10시간을 적어도 하루 최대까지만 센다",
      b.달들.every((m) => m.인정분 === m.횟수 * 하루최대),
      `한 번 ${하루최대}분 — 청구도 여기까지만 셉니다`);
  }

  // ══════════════════════════════════════════════════════════
  //  ④ 월 한도 — 가장 많이 가는 달로
  // ══════════════════════════════════════════════════════════
  console.log("\n── ④ **월 한도** ★★★ ────────────────────────\n");
  {
    const 넘 = 계획재기(사람, 가사, 주3회, { from: `${올해}-09-07`, to: `${올해}-12-31` });
    const 칸 = 칸찾기(넘, "월 한도(시간)");
    본다("★★ 월 시간 한도를 넘는 것을 안다", 칸?.넘나 === true, 칸?.말);
    본다("★★★ 말에 **소수점도 「분」 자투리도 없다**",
      !!칸 && !/\.\d/.test(칸.말) && !/[0-9]분/.test(칸.말.replace(/30분|시간/g, "")),
      칸?.말);
    본다("★★ 가장 많이 가는 달로 본다",
      칸?.더쓸것 === Math.max(...넘.달들.map((m) => m.인정분)),
      "달마다 요일 수가 달라, 넘는 달이 하나라도 있으면 넘는 것입니다");
    본다("★★★ **무엇이 어떻게 되는지 설명이 붙는다**",
      !!칸?.설명 && 칸.설명.includes("군이 안 줍니다"),
      칸?.설명);
    본다("★★ **어떻게 줄이면 되는지도 알려 준다**",
      !!칸?.설명 && 칸.설명.includes("한도 안에 들려면"),
      "「넘었습니다」로 끝나면 관리자가 요일을 하나씩 눌러 보며 맞춰야 합니다");
    본다("★ 전체가 「넘음」으로 잡힌다", 넘.넘나 === true);
    본다("★ 무엇을 넘는지 한 줄로 말해 준다", 넘.한줄.includes("넘습니다"), 넘.한줄);
    본다("★ 받침에 맞춰 「을/를」을 붙인다", !넘.한줄.includes("을(를)"), 넘.한줄);

    const 안넘 = 계획재기(사람, 가사, 주1회, { from: `${올해}-09-07`, to: `${올해}-12-31` });
    본다("★★ 안 넘으면 조용하다", 안넘.넘나 === false,
      `${칸찾기(안넘, "월 한도(시간)")?.말} — 매번 뜨는 창은 아무도 안 읽습니다`);
    본다("★ 안 넘으면 설명도 안 붙는다", !칸찾기(안넘, "월 한도(시간)")?.설명);

    const 동 = 계획재기(사람, 동행, [{ dow: 1, minutes: 60 }], { from: `${올해}-09-07` });
    const 시 = 칸찾기(동, "월 한도(시간)"), 횟 = 칸찾기(동, "월 한도(횟수)");
    본다("★★ 동행은 시간·횟수 두 칸이 다 뜬다", !!시 && !!횟, `${시?.말} / ${횟?.말}`);
    본다("★★ 시간은 남아도 횟수가 넘으면 넘는 것이다",
      시?.넘나 === false && 횟?.넘나 === true && 동.넘나 === true,
      "월 6시간이면서 월 2회 — 시간이 남아도 세 번째 방문은 안 됩니다");
    본다("★ 횟수 초과에도 설명이 붙는다", !!횟?.설명, 횟?.설명);
  }

  // ══════════════════════════════════════════════════════════
  //  ⑤ 연간 한도 — 월 한도까지만
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑤ **연간 한도 — 월 한도까지만** ★★★ ────────\n");
  {
    배정 = Number(db.run(
      `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
       VALUES (?,?,?,'[]',?,'x')`,
      [사람, 가사, 인력, `${올해}-01-01`]).lastInsertRowid);
    db.run(
      /*
       * ★ 의뢰 기간을 **오늘 시작**으로 둡니다.
       *   1월 1일 개시로 두면 「개시일부터 2개월」이 이미 지나서
       *   앞으로 잴 것이 없습니다 — 그건 그것대로 맞는 동작이라
       *   ⑧-3 에서 따로 봅니다. 여기서는 살아 있는 계획을 재야 합니다.
       */
      `INSERT INTO referral (batch_label, recipient_id, service_id, period_from, period_to,
                             cycle_unit, cycle_count, cycle_text, diff_state, created_at)
       VALUES ('시험', ?, ?, ?, ?, 'week', 3, '주 3회', '신규', 'x')`,
      [사람, 가사, 개시, `${올해}-12-31`]);

    const 넘 = 계획재기(사람, 가사, 주3회, { from: 개시, to: `${올해}-12-31` });
    const 연 = 칸찾기(넘, "연간 지원한도");
    본다("연간 칸이 있다", !!연, 연?.말);
    본다("★★ 「일상생활돌봄 전체」라고 밝힌다",
      연?.이름.includes("일상생활돌봄 전체"),
      `${연?.이름} — 이 서비스 하나가 아니라 이 분이 올해 받는 것 전부입니다`);

    /*
     * ★★★ 이 시험의 핵심 하나.
     *   월 한도(12시간)를 훌쩍 넘기는 계획인데, 연간에 더하는 값은
     *   **월 한도까지만**이어야 합니다. 안 그러면 같은 초과를 두 번 셉니다.
     */
    const 달수 = 넘.달들.length;
    본다("★★★ 연간에 더하는 값이 **월 한도까지만**이다",
      넘.앞으로돈 <= 24000 * 12 * 달수 + 1,
      `${넘.앞으로돈.toLocaleString()}원 ≤ 월 288,000원 × ${달수}달 — ` +
      `계획대로면 ${넘.계획대로돈.toLocaleString()}원입니다`);
    본다("★★★ 계획대로 갔을 때의 값도 따로 낸다",
      넘.계획대로돈 > 넘.앞으로돈,
      `${넘.계획대로돈.toLocaleString()}원 vs ${넘.앞으로돈.toLocaleString()}원 — 견주어 보라고 같이 냅니다`);
    본다("★★ 연간 칸이 그 까닭을 설명한다",
      !!연?.설명 && 연.설명.includes("월 한도까지만"), 연?.설명);

    /* 이미 쓴 것 */
    for (let i = 1; i <= 30; i++)
      db.run(
        `INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                               is_holiday,planned,minutes,created_at)
         VALUES (?,?,?,?,'제공',0,1,120,'x')`,
        [배정, 사람, 가사, `${올해}-0${1 + (i % 6)}-${String(1 + (i % 27)).padStart(2, "0")}`]);

    const 이미쓴것 = 연간쓴돈(사람, 올해).일상.쓴돈;
    const 연2 = 칸찾기(계획재기(사람, 가사, 주1회, { from: 개시, to: `${올해}-12-31` }),
      "연간 지원한도");
    본다("★★★ 이미 쓴 것을 **한도 화면과 똑같이** 가져온다",
      연2?.쓴것 === 이미쓴것,
      `${연2?.쓴것?.toLocaleString()}원 — 계획할 때와 정산할 때 숫자가 다르면 아무도 안 믿습니다`);
    본다("★★ 둘을 더한 값으로 넘는지 본다",
      연2?.합 === (연2?.쓴것 ?? 0) + (연2?.더쓸것 ?? 0));
    본다("★★ 이미 많이 썼으면 앞으로 조금만 가도 넘는다", 연2?.넘나 === true,
      `${연2?.말} — 「지금까지는 안 넘었으니 괜찮다」가 가장 위험합니다`);
    본다("★ 넘으면 설명이 바뀐다",
      !!연2?.설명 && 연2.설명.includes("넘깁니다"), 연2?.설명);

    const 바깥 = 계획재기(사람, 공사, [{ dow: 2 }], { from: 개시 });
    본다("★ 안전생활환경은 연간 칸이 안 뜬다", !칸찾기(바깥, "연간 지원한도"),
      "편람: 「1인당 연간 지원한도 150만원 (※ 안전생활환경은 별도 적용)」");
  }

  // ══════════════════════════════════════════════════════════
  //  ⑥ 생애 1회
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑥ 생애 1회 ★ ──────────────────────────────\n");
  {
    본다("아직 안 받았으면 아무 말 없다",
      !칸찾기(계획재기(사람, 공사, [{ dow: 2 }], { from: 개시 }), "생애 1회"));
    const 공사배정 = Number(db.run(
      `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
       VALUES (?,?,?,'[]',?,'x')`,
      [사람, 공사, 인력, `${올해}-01-01`]).lastInsertRowid);
    db.run(
      `INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                             is_holiday,planned,created_at)
       VALUES (?,?,?,?,'제공',0,1,'x')`,
      [공사배정, 사람, 공사, `${올해}-03-10`]);
    const 칸 = 칸찾기(계획재기(사람, 공사, [{ dow: 2 }], { from: 개시 }), "생애 1회");
    본다("★★ 이미 받았으면 알려 준다", 칸?.넘나 === true, 칸?.말);
    본다("★★ 무엇이 어떻게 되는지 설명한다",
      !!칸?.설명 && 칸.설명.includes("기관이 떠안습니다"), 칸?.설명);
  }

  // ══════════════════════════════════════════════════════════
  //  ⑦ 한도 기준 — 총액 / 군 부담액
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑦ 한도를 무엇으로 재나 ★★ ────────────────\n");
  {
    const 구간 = Number(db.run(
      `INSERT INTO copay_tier (profile_id, label, rate, sort_order) VALUES (?,?,?,999)`,
      [프로필.id, "계획시험20%", 0.2]).lastInsertRowid);
    db.run("UPDATE recipient SET copay_tier_id = ? WHERE id = ?", [구간, 사람]);
    try {
      db.run("UPDATE region_profile SET cap_basis = 'total' WHERE id = ?", [프로필.id]);
      const 총 = 칸찾기(계획재기(사람, 가사, 주1회, { from: 개시 }), "연간 지원한도");
      본다("★ 기본은 총 서비스 비용이다",
        계획재기(사람, 가사, 주1회, { from: 개시 }).기준 === "total");

      db.run("UPDATE region_profile SET cap_basis = 'claim' WHERE id = ?", [프로필.id]);
      const 군 = 칸찾기(계획재기(사람, 가사, 주1회, { from: 개시 }), "연간 지원한도");
      본다("★ 설정을 바꾸면 기준이 바뀐다",
        계획재기(사람, 가사, 주1회, { from: 개시 }).기준 === "claim");
      본다("★★★ 군 부담액 기준이면 이미 쓴 것이 80%로 준다",
        Math.abs((군?.쓴것 ?? 0) - Math.round((총?.쓴것 ?? 0) * 0.8)) <= 2,
        `${총?.쓴것?.toLocaleString()} → ${군?.쓴것?.toLocaleString()}`);
      본다("★★★ **두 번 빼지 않는다**",
        (군?.쓴것 ?? 0) > Math.round((총?.쓴것 ?? 0) * 0.6),
        "두 번 빼면 64% 가 되어 한도가 널널해 보입니다");
      본다("★★ 한도 화면도 같은 기준으로 센다",
        연간쓴돈(사람, 올해).일상.쓴돈 === (군?.쓴것 ?? -1),
        "계획 줄과 홈 경고가 다른 숫자를 말하면 둘 다 못 믿습니다");
    } finally {
      db.run("UPDATE region_profile SET cap_basis = 'total' WHERE id = ?", [프로필.id]);
      db.run("UPDATE recipient SET copay_tier_id = NULL WHERE id = ?", [사람]);
      db.run("DELETE FROM copay_tier WHERE id = ?", [구간]);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  ⑧ 재기만 한다 · 서버로도 된다
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑧ 재기만 한다 · 서버로도 된다 ★★ ──────────\n");
  {
    const 셈 = () => ({
      배정: Number((db.query<any, []>("SELECT COUNT(*) AS n FROM assignment").get() as any).n),
      실적: Number((db.query<any, []>("SELECT COUNT(*) AS n FROM delivery").get() as any).n),
      메모: Number((db.query<any, []>("SELECT COUNT(*) AS n FROM sticky").get() as any).n),
    });
    const 앞 = 셈();
    for (let i = 0; i < 5; i++) 계획재기(사람, 가사, 주3회, { from: 개시 });
    const 뒤 = 셈();
    본다("★★ 다섯 번 재도 자료함이 그대로다",
      앞.배정 === 뒤.배정 && 앞.실적 === 뒤.실적 && 앞.메모 === 뒤.메모,
      "화면이 요일을 누를 때마다 부릅니다 — 자료함에 손대면 안 됩니다");

    const 쿠키 = await 관.쿠키받기(주소);
    const r = await fetch(`${주소}/api/assign/preview`, {
      method: "POST", headers: { cookie: 쿠키, "content-type": "application/json" },
      body: JSON.stringify({ recipientId: 사람, serviceId: 가사, slots: 주3회,
                             from: 개시, to: `${올해}-12-31` }),
    });
    const 몸: any = await r.json().catch(() => ({}));
    본다("★ 서버가 재어 준다", r.status === 200 && 몸.넘나 === true, 몸.한줄);
    본다("★ 달마다 몇 번 가는지도 같이 온다", (몸.달들 ?? []).length > 0,
      (몸.달들 ?? []).map((m: any) => `${m.달} ${m.횟수}번`).join(" · "));

    const 인 = await 시험관리자("계획시험인력", ["worker"]);
    try {
      const 력 = await 인.쿠키받기(주소);
      const r2 = await fetch(`${주소}/api/assign/preview`, {
        method: "POST", headers: { cookie: 력, "content-type": "application/json" },
        body: JSON.stringify({ recipientId: 사람, serviceId: 가사, slots: 주3회 }),
      });
      본다("★★ 제공인력은 못 본다", r2.status === 403,
        "누가 얼마를 쓰고 있는지는 사무실 몫입니다");
    } finally { 인.치우기(); }
  }

  // ══════════════════════════════════════════════════════════
  //  ⑧-2 ★ 지금 받고 있는 것 · 한도 · 남은 한도
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑧-2 **현황 · 한도 · 잔여한도** ★★★ ────────\n");
  {
    /*
     * (2026-09-07 무무 — 「막지만 계획을 넣을 때 경고창만 띄워주자는거지.
     *  **현재 서비스 들어간 현황과 한도, 잔여한도등을 함께** 말이야.」)
     *
     * 「가사 월 한도를 넘습니다」만 띄우면 관리자는 다른 서비스까지
     * 얼마나 남았는지 모릅니다. 연간 150만원은 일상생활돌봄 전체를
     * 합한 것이라, 무엇을 줄여야 할지는 전체를 봐야 정합니다.
     */
    const r = 계획재기(사람, 가사, 주3회, { from: 개시, to: `${올해}-12-31` });
    본다("★★ 현황이 함께 온다", !!r.현황, `${r.현황?.줄들?.length ?? 0}줄`);
    본다("★★ 이번 달이 어느 달인지 밝힌다",
      r.현황?.달 === 오늘.slice(0, 7), r.현황?.달);
    본다("★★★ **연간 한도와 남은 한도**가 온다",
      r.현황?.연간?.봄 === true &&
      r.현황.연간.남은돈 === Math.max(0, r.현황.연간.한도 - r.현황.연간.쓴돈),
      `${r.현황?.연간?.쓴돈?.toLocaleString()}원 / ` +
      `${r.현황?.연간?.한도?.toLocaleString()}원 · ` +
      `남음 ${r.현황?.연간?.남은돈?.toLocaleString()}원`);
    본다("★★ 연간 현황이 **한도 화면과 같은 값**이다",
      r.현황?.연간?.쓴돈 === 연간쓴돈(사람, 올해).일상.쓴돈,
      "두 화면이 다른 숫자를 말하면 둘 다 못 믿습니다");

    /* 이번 달에 실적을 넣으면 현황 줄이 생겨야 합니다 */
    const 이번달날 = `${오늘.slice(0, 7)}-02`;
    db.run(
      `INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                             is_holiday,planned,minutes,created_at)
       VALUES (?,?,?,?,'제공',0,1,120,'x')`,
      [배정, 사람, 가사, 이번달날]);
    const r2 = 계획재기(사람, 가사, 주3회, { from: 개시, to: `${올해}-12-31` });
    const 줄 = (r2.현황?.줄들 ?? []).find((x: any) => x.serviceId === 가사);
    본다("★★★ 이번 달에 다녀온 것이 현황에 뜬다", !!줄, 줄?.말);
    본다("★★★ **남은 월 한도**를 셈해 준다",
      줄?.남은분 === Math.max(0, 720 - (줄?.이번달분 ?? 0)),
      `이 달 ${줄?.이번달분}분 / 720분 · 남음 ${줄?.남은분}분`);
    본다("★★ 사람이 읽는 말로도 준다",
      !!줄?.말 && 줄.말.includes("남음"), 줄?.말);
  }

  // ══════════════════════════════════════════════════════════
  //  ⑧-3 지난 기간은 안 재는가
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑧-3 지난 기간은 안 잰다 ★ ─────────────────\n");
  {
    /*
     * ★ 여기는 「앞으로 이렇게 하면」을 재는 자리입니다. 이미 지난
     *   달의 계획을 지금 와서 경고해 봐야 되돌릴 것이 없습니다 —
     *   그건 제공실적 화면이 실적으로 말해 줍니다.
     */
    const 옛 = 계획재기(사람, 가사, 주3회,
      { from: `${올해 - 1}-01-01`, to: `${올해 - 1}-12-31` });
    본다("★★ 제공 기간이 이미 끝났으면 그렇다고 말한다",
      옛.기간끝났나 === true && 옛.한줄.includes("끝났습니다"), 옛.한줄);
    본다("★★ 지난 달 계획으로 경고하지 않는다",
      옛.달들.length === 0 && 옛.넘나 === false,
      "되돌릴 수 없는 것을 경고하면 창만 늘어납니다");
    /*
     * ★ (2026-09-07 무무 — 「생애한도이기 때문에 기간을 다 받은 후엔
     *  **재의뢰는 현재 사업안내 및 편람 상 불가능** 한 것으로 알고있어」)
     *
     * 할 수 없는 길을 알려 주면 기관이 그 길을 알아보느라 시간을 쓰고,
     * 군에 물어보고 나서야 안 된다는 것을 압니다.
     */
    본다("★★★ **재의뢰하라고 말하지 않는다**", !옛.한줄.includes("재의뢰"),
      "지금 지침·편람으로는 안 되는 길입니다");
    본다("★★ 다시 받을 수 없다고 분명히 적는다",
      옛.한줄.includes("다시 받으실 수 없습니다"), 옛.한줄);
  }

  // ══════════════════════════════════════════════════════════
  //  ⑨ 화면 — 알려 주고, 설명이 붙고, **막는가**
  //     (2026-09-08 무무 「막지만 … 알려야 함」 — 규칙이 바뀌었습니다)
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑨ 화면이 하는 말 ★★ ──────────────────────\n");
  {
    const 글 = readFileSync("web/src/components/AssignBox.tsx", "utf8");
    본다("★ 저장하기 전에 미리 재어 둔다", /previewAssign/.test(글));
    본다("★★ 넘을 때만 묻는다", /if \(잰것\?\.넘나\)/.test(글),
      "늘 뜨는 확인창은 아무도 안 읽고 「예」만 누르게 됩니다");
    /*
     * ★★ 2026-09-08 — **두 번 묻고 지나가던 것을 없앴습니다.**
     *   이제 서버가 막습니다. 물어 놓고 「예」를 눌렀는데 그 다음에
     *   거절당하면 그건 **묻지 말았어야 할 것을 물은 것**입니다.
     */
    본다("★★★ **묻지 않고 알려 준다** (물어 놓고 거절하면 안 됩니다)",
      /alert\(/.test(글) && !글.includes("이대로 저장할까요?"),
      "confirm 으로 두 번 묻던 자리를 alert 하나로 바꿨습니다");
    본다("★★★ 「저장할 수 없습니다」라고 화면이 먼저 말한다",
      글.includes("이대로는 저장할 수 없습니다"));
    본다("★★★ **화면이 못 박지는 않는다** (줄이는 저장은 서버가 통과시킵니다)",
      !/alert\([\s\S]{0,4000}?\)\s*\n\s*return\b/.test(글),
      "화면이 앞서 막으면 이미 넘겨 저장된 배정을 영영 못 고칩니다");
    본다("★★ **주기로 풀라**는 길잡이가 화면에도 있다",
      글.includes("가는 주기") && /횟수칸/.test(글),
      "월 2회짜리는 요일만 줄여서는 못 듭니다");
    본다("★★ 확인창에도 **설명**이 들어간다", /x\.설명/.test(글),
      "무무: 「한도가 초과되었다고 하면서 설명이 같이 들어가면 좋겠지」");
    본다("★★ 화면 표에도 설명 줄이 붙는다", /넘음풀이|굵게\(x\.설명\)/.test(글));
    본다("★ 달마다 몇 번 가는지 표로 보인다", /계획달표/.test(글));
    본다("★ 별표(**)를 진짜 굵은 글씨로 바꾼다", /function 굵게/.test(글),
      "지우기만 하면 강조가 사라지고, 두면 별표가 화면에 보입니다");
    본다("★★★ 확인창에 **현황·한도·잔여한도**가 들어간다",
      /지금 받고 있는 것/.test(글) && /남음 \$\{Number\(현\.연간\.남은돈\)/.test(글),
      "무무: 「현재 서비스 들어간 현황과 한도, 잔여한도등을 함께」");
    본다("★★ 화면에도 현황 칸이 있다", /계획현황/.test(글));
    본다("★ 한 줄 요약의 별표도 굵은 글씨로 바꾼다", /굵게\(잰것\.한줄\)/.test(글),
      "안 그러면 「**다시 받으실 수 없습니다**」처럼 별표가 그대로 보입니다");
  }

  // ══════════════════════════════════════════════════════════
  //  ⑩ 진짜 화면에서 눌러 본다
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑩ **진짜로 눌러 본다** ★★★ ────────────────\n");
  {
    /*
     * ★ 글만 훑는 시험(⑨)은 **막아 버리는 손질에 안 걸립니다.**
     *   「넘으면 그냥 return」 한 줄을 위에 끼워 넣어도 아래 확인창
     *   코드는 그대로 남아 글 훑기는 다 통과합니다 (2026-09-07 확인).
     */
    const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
    const 쪽 = await b.newPage({ viewport: { width: 1500, height: 1100 } });
    const 물어본말: string[] = [];
    쪽.on("dialog", async (d) => { 물어본말.push(d.message()); await d.accept(); });
    try {
      db.run("DELETE FROM assignment WHERE recipient_id = ? AND service_id = ?", [사람, 가사]);
      await 쪽.goto(주소 + "/", { waitUntil: "networkidle" });
      await 관.들어가기(쪽);
      await 쪽.goto(`${주소}/recipients/${사람}`, { waitUntil: "networkidle" });
      await 쪽.waitForTimeout(1500);

      await 쪽.locator("button", { hasText: /담당 (붙이기|바꾸기)|배정/ }).first().click();
      await 쪽.waitForTimeout(1400);
      await 쪽.locator("#a-worker").selectOption({ index: 1 });
      for (const d of ["월", "수", "금"]) {
        const x = 쪽.locator("[aria-pressed]").filter({ hasText: new RegExp(`^${d}`) }).first();
        if (await x.count()) await x.click();
      }
      await 쪽.locator("#a-mins").fill("120");
      await 쪽.waitForTimeout(1600);

      const 화면 = await 쪽.locator("body").innerText();
      본다("★★ 화면에 「이 계획대로 가면」 줄이 뜬다", /넘습니다|한도 안입니다/.test(화면),
        (화면.split("\n").find((x) => /넘습니다/.test(x)) ?? "").trim());
      본다("★★★ 화면에 **소수점 횟수가 없다**", !/\d+\.\d+회|\d+\.\d+번/.test(화면),
        "「13.05회」 같은 값이 보이면 안 됩니다");
      본다("★★★ 화면에 **설명**이 붙는다", /군이 안 줍니다/.test(화면),
        (화면.split("\n").find((x) => /군이 안 줍니다/.test(x)) ?? "").trim().slice(0, 80));
      본다("★★ 어떻게 줄이면 되는지도 보인다", /한도 안에 들려면/.test(화면));
      본다("★ 별표가 화면에 안 보인다", !/\*\*/.test(화면));
      본다("★ 달마다 몇 번인지 보인다", /\d+번/.test(화면));
      본다("★★★ 화면에 **지금 받고 있는 것**이 보인다",
        /지금 받고 있는 것/.test(화면),
        (화면.split("\n").find((x) => /지금 받고 있는 것/.test(x)) ?? "").trim());
      본다("★★★ 화면에 **남은 한도**가 보인다", /남음/.test(화면),
        (화면.split("\n").find((x) => /올해 지원한도/.test(x)) ?? "").trim());

      await 쪽.locator("button", { hasText: "배정 저장" }).first().click();
      await 쪽.waitForTimeout(2500);

      /*
       * ★★ 2026-09-08 에 규칙이 **바뀌었습니다.**
       *
       *   (무무 — 「연간 150만원/월한도 넘길 때 — **막지만** 한도를 넘게
       *    계획했다고 관리자에게 알려야 함」 / 막는 자리는 「**가. 계획**.
       *    계획이 안되면 실적도 따라서 할 수가 없어.」)
       *
       *   예전에는 **두 번 묻고 지나갔습니다.** 이제 막습니다. 그래서
       *   물어보는 창(confirm)이 아니라 **알려 주는 창(alert)**이 뜨고,
       *   자료함에는 아무것도 안 들어가야 합니다.
       */
      본다("★★★ 한도를 넘으면 **알려 준다**", 물어본말.length >= 1,
        `${물어본말.length}번`);
      본다("★★★ 「저장할 수 없습니다」라고 분명히 말한다",
        물어본말.some((x) => x.includes("저장할 수 없습니다")),
        물어본말[0]?.split("\n")[0] ?? "(없음)");
      본다("★★★ 창에 **설명**이 들어 있다",
        물어본말.some((x) => x.includes("군이 안 줍니다")),
        물어본말[0]?.split("\n").find((l) => l.includes("군이 안")) ?? "(없음)");
      본다("★ 창에 별표가 안 보인다", !물어본말.some((x) => x.includes("**")));
      본다("★★★ 창에 **지금 현황**이 들어 있다",
        물어본말.some((x) => x.includes("지금 받고 있는 것")),
        물어본말[0]?.split("\n").find((l) => l.includes("지금 받고")) ?? "(없음)");
      본다("★★★ 창에 **남은 한도**가 들어 있다",
        물어본말.some((x) => x.includes("올해 지원한도") && x.includes("남음")),
        물어본말[0]?.split("\n").find((l) => l.includes("올해 지원한도")) ?? "(없음)");
      본다("★★★ **어떻게 고치라**는 말이 있다 (막기만 하면 안 됩니다)",
        물어본말.some((x) => x.includes("고쳐 한도 안에 들게")));

      const 생김: any = db.query(
        "SELECT id, weekly_plan FROM assignment WHERE recipient_id = ? AND service_id = ?"
      ).get(사람, 가사);
      본다("★★★ 한도를 넘는 계획은 **저장되지 않는다**", !생김,
        생김 ? `들어감: ${생김.weekly_plan} — 막혔어야 합니다` : "자료함이 비어 있습니다");

      const 화면2 = await 쪽.locator("body").innerText();
      본다("★★ 화면에도 **막힌 까닭**이 남는다",
        /한도를 넘습니다|저장할 수 없습니다/.test(화면2),
        (화면2.split("\n").find((x) => /저장할 수 없습니다/.test(x)) ?? "").trim().slice(0, 60));
    } finally { await b.close(); }
  }

} catch (e: any) {
  실패수++;
  console.log(`\n✗ 실패  시험 도중 터짐 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 5).join("\n"));
} finally {
  try {
    if (프로필) db.run("UPDATE region_profile SET cap_basis = ? WHERE id = ?", [옛기준, 프로필.id]);
  } catch { }
  db.run("DELETE FROM sticky WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM delivery WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM referral WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM assignment WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM recipient WHERE id = ?", [사람]);
  for (const s of [가사, 동행, 공사])
    if (s) { try { db.run("DELETE FROM service WHERE id = ?", [s]); } catch { } }
  try {
    if (인력) db.run("DELETE FROM worker WHERE id = ?", [인력]);
    if (계정) db.run("DELETE FROM app_user WHERE id = ?", [계정]);
  } catch { }
  관?.치우기();
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
