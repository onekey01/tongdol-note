/**
 * 하루 최대 서비스 시간 — 편람 「1일 최대 3시간」.
 *
 *   bun 하루상한시험.ts
 *
 * 편람 원문 —
 *
 *   가사지원 「○ (제 공 기 준) **1일 최대 3시간**(평일 오전 9시 ~오후 6시)」
 *   동행지원 「○ (제공기준) **1일 최대 3시간**(평일 오전9시 ~ 오후 6시)」
 *   비용산정 「**30분단위로 환산** — 15분 미만은 미산정 / 15분이상 45분
 *            미만인 경우는 30분으로 산정 / 45분이상은 1시간으로 산정」
 *
 * 두 줄을 겹치면 하루에 나올 수 있는 값은 **여섯 가지뿐**입니다 —
 * 30분 · 1시간 · 1시간30분 · 2시간 · 2시간30분 · 3시간.
 *
 * 여기서 보는 것 —
 *
 *   1. 여섯 갈래 말고는 **아무 값도 안 나온다**
 *   2. 세 시간을 넘으면 **세 시간으로 깎인다**
 *   3. 계획에 시간을 적어 두면 **그 시간이 상한**이 된다
 *   4. 설정을 0 으로 두면 **안 본다**
 *   5. 끼·회(식사·이미용)는 시간 상한과 **상관없다**
 *   6. 청구서와 서식8 이 **같은 금액**을 말한다
 *
 * 돈이 걸린 셈이라 자료함에 진짜로 넣고 확인합니다.
 * 끝나면 넣은 것을 전부 치웁니다.
 */
import { randomUUID } from "node:crypto";
import { db, initDb } from "./server/db";
initDb();
import { 실적줄들, linesOf } from "./server/billing";

let 통과수 = 0, 실패수 = 0;
function 같아야(무엇: string, 실제: unknown, 바람: unknown) {
  if (실제 === 바람) { 통과수++; console.log(`  통과  ${무엇}   — ${JSON.stringify(실제)}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}\n          나온 것 ${JSON.stringify(실제)}\n          바란 것 ${JSON.stringify(바람)}`); }
}

// ── 시험 마당 ────────────────────────────────────────────────
const 사람 = randomUUID();
const 프로필 = db.query<any, []>(
  `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id
    WHERE o.id = 1`).get();
const 원래상한 = 프로필?.daily_cap_minutes;
const now = new Date().toISOString();

db.run(
  `INSERT INTO recipient (id, payload, dong, status, created_at, updated_at)
   VALUES (?, ?, '시험동', 'active', ?, ?)`,
  [사람, JSON.stringify({ name: "상한시험" }), now, now]);

function 서비스만들기(name: string, unit: string, 단가: number) {
  const info = db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit,
                          unit_price, holiday_price, record_type, lifetime_cap,
                          sort_order, active, custom)
     VALUES (?,?,?,?,?,?,?,?,NULL,'기본',NULL,?,1,1)`,
    [프로필.id, `CAP-${randomUUID().slice(0, 8)}`, "시험", "시험", "시험",
     name, unit, 단가, 0]);
  return Number(info.lastInsertRowid);
}
const 가사 = 서비스만들기("상한시험 가사", "hour", 24_000);
const 식사 = 서비스만들기("상한시험 식사", "meal", 10_000);

function 실적넣기(날: string, serviceId: number, 분: number | null) {
  db.run(
    `INSERT INTO delivery (served_on, recipient_id, service_id, outcome,
                           minutes, is_holiday, planned, created_at)
     VALUES (?, ?, ?, '제공', ?, 0, 1, ?)`,
    [날, 사람, serviceId, 분, now]);
}
const 실적치우기 = () => db.run("DELETE FROM delivery WHERE recipient_id = ?", [사람]);
const 배정치우기 = () => db.run("DELETE FROM assignment WHERE recipient_id = ?", [사람]);

function 상한두기(분: number) {
  db.run("UPDATE region_profile SET daily_cap_minutes = ? WHERE id = ?", [분, 프로필.id]);
}
/** 그 요일에 계획 시간을 적어 둔 배정 하나. */
function 계획두기(serviceId: number, dow: number, 분: number) {
  db.run(
    `INSERT INTO assignment (recipient_id, worker_id, service_id,
                             period_from, period_to, weekly_plan,
                             planned_count, created_at)
     VALUES (?, NULL, ?, NULL, NULL, ?, 1, ?)`,
    [사람, serviceId, JSON.stringify([{ dow, minutes: 분 }]), now]);
}

/** 그 날 그 서비스의 인정 분 합. */
const 인정합 = (from: string, to: string) =>
  실적줄들(사람, from, to).reduce((s, r) => s + r.인정분, 0);
const 줄들 = (from: string, to: string) => 실적줄들(사람, from, to);

const 달 = "2026-10";
// 2026-10-05 는 월요일입니다 (계획 시험에서 씁니다).
const 요일확인 = new Date("2026-10-05T00:00:00Z").getUTCDay();

try {
  상한두기(180);

  console.log("\n── 1. 세 시간까지는 잰 대로 ─────────────────────────────\n");
  {
    실적치우기();
    실적넣기("2026-10-05", 가사, 120);
    같아야("2시간은 그대로 120분", 인정합("2026-10-01", "2026-10-31"), 120);
    같아야("깎이지 않음", 줄들("2026-10-01", "2026-10-31")[0].깎였나, false);
  }
  {
    실적치우기();
    실적넣기("2026-10-05", 가사, 180);
    같아야("정각 3시간도 그대로", 인정합("2026-10-01", "2026-10-31"), 180);
    같아야("깎이지 않음", 줄들("2026-10-01", "2026-10-31")[0].깎였나, false);
  }

  console.log("\n── 2. 세 시간을 넘으면 깎입니다 ─────────────────────────\n");
  {
    실적치우기();
    실적넣기("2026-10-05", 가사, 240);          // 4시간
    같아야("4시간 → 3시간", 인정합("2026-10-01", "2026-10-31"), 180);
    같아야("깎였다고 표시", 줄들("2026-10-01", "2026-10-31")[0].깎였나, true);
    const l = linesOf(사람, 달);
    같아야("청구 금액도 3시간치", l[0].amount, 72_000);
    같아야("깎인 건수", (l[0] as any).깎인건수, 1);
  }

  console.log("\n── 3. 여섯 갈래 말고는 안 나옵니다 ─────────────────────\n");
  {
    /*
     * 편람의 두 줄(30분 환산 · 1일 3시간)을 겹치면 나올 수 있는 값은
     * **30 · 60 · 90 · 120 · 150 · 180** 여섯 가지와 미산정 0 뿐입니다.
     * 1분부터 400분까지 다 넣어 보고, 그 밖의 값이 하나라도 나오면 걸립니다.
     */
    const 갈래 = new Set<number>();
    for (let m = 1; m <= 400; m++) {
      실적치우기();
      실적넣기("2026-10-05", 가사, m);
      갈래.add(줄들("2026-10-01", "2026-10-31")[0].인정분);
    }
    같아야("나온 갈래", [...갈래].sort((a, b) => a - b).join(" · "),
           "0 · 30 · 60 · 90 · 120 · 150 · 180");
  }

  console.log("\n── 4. 계획에 시간을 적으면 그것이 상한입니다 ────────────\n");
  {
    실적치우기(); 배정치우기();
    같아야("2026-10-05 는 월요일", 요일확인, 1);
    계획두기(가사, 1, 90);                      // 월요일 90분
    실적넣기("2026-10-05", 가사, 240);          // 4시간 갔어도
    같아야("계획이 90분이면 90분", 인정합("2026-10-01", "2026-10-31"), 90);
    같아야("청구 금액", linesOf(사람, 달)[0].amount, 36_000);
  }
  {
    실적치우기();
    실적넣기("2026-10-06", 가사, 240);          // 화요일 — 계획에 없는 요일
    같아야("계획에 없는 요일은 설정값(3시간)", 인정합("2026-10-01", "2026-10-31"), 180);
    배정치우기();
  }

  console.log("\n── 5. 설정을 0 으로 두면 안 봅니다 ──────────────────────\n");
  {
    상한두기(0);
    실적치우기();
    실적넣기("2026-10-05", 가사, 300);          // 5시간
    같아야("0 이면 잰 대로 다 인정", 인정합("2026-10-01", "2026-10-31"), 300);
    같아야("깎이지 않음", 줄들("2026-10-01", "2026-10-31")[0].깎였나, false);
    상한두기(180);
  }

  console.log("\n── 6. 끼·회는 시간 상한과 상관없습니다 ──────────────────\n");
  {
    실적치우기();
    실적넣기("2026-10-05", 식사, null);
    실적넣기("2026-10-05", 식사, null);
    실적넣기("2026-10-05", 식사, null);
    실적넣기("2026-10-05", 식사, null);          // 하루 네 끼
    const l = linesOf(사람, 달);
    같아야("네 끼 다 셉니다", l[0].count, 4);
    같아야("금액도 네 끼치", l[0].amount, 40_000);
  }
  {
    실적치우기();
    실적넣기("2026-10-05", 가사, 240);           // 4시간 → 3시간으로 깎임
    실적넣기("2026-10-05", 식사, null);          // 같은 날 식사 한 끼
    const l = linesOf(사람, 달);
    const 가 = l.find((x) => x.serviceId === 가사)!;
    const 식 = l.find((x) => x.serviceId === 식사)!;
    같아야("가사는 3시간으로 깎임", 가.amount, 72_000);
    같아야("식사는 그대로", 식.amount, 10_000);
  }

  console.log("\n── 7. 옛 실적(분이 없는 것)은 안 흔들립니다 ─────────────\n");
  {
    실적치우기();
    실적넣기("2026-10-05", 가사, null);          // 분을 안 적은 옛 실적
    같아야("한 번 = 한 시간 그대로", 인정합("2026-10-01", "2026-10-31"), 60);
    같아야("청구 금액", linesOf(사람, 달)[0].amount, 24_000);
  }
} finally {
  실적치우기();
  배정치우기();
  db.run("DELETE FROM recipient WHERE id = ?", [사람]);
  for (const id of [가사, 식사]) db.run("DELETE FROM service WHERE id = ?", [id]);
  db.run("UPDATE region_profile SET daily_cap_minutes = ? WHERE id = ?",
         [원래상한 ?? 180, 프로필.id]);
  console.log("\n  시험 자료를 모두 치웠습니다.");
}

console.log(`\n${"─".repeat(56)}\n  ${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
if (실패수) process.exit(1);
