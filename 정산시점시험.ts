/**
 * 정산 — 청구 시점 세 가지가 실제로 먹히는가.
 *
 *   bun 정산시점시험.ts
 *
 * 가장 중요한 것은 **「달마다」가 지금까지와 똑같이 도는 것**입니다.
 * 새 기능을 넣다가 이미 잘 돌던 것을 망가뜨리면, 그건 기능이 아니라 사고입니다.
 * 그래서 회귀 검사부터 합니다.
 *
 * 시험이 끝나면 설정을 원래대로 돌려놓고 넣은 자료를 치웁니다.
 */

import { db } from "./server/db";
import { month, issue, linesOf } from "./server/billing";

let 통과수 = 0, 실패수 = 0;
function 통과해야(무엇: string, 참: boolean, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}

const 프로필 = db.query<any, []>(
  "SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1"
).get();
const 원래 = { claim: 프로필?.claim_timing, copay: 프로필?.copay_timing };
const 시점바꾸기 = (claim: string, copay: string) =>
  db.run("UPDATE region_profile SET claim_timing = ?, copay_timing = ? WHERE id = ?",
         [claim, copay, 프로필.id]);

// ── 시험용 어르신 한 분 ────────────────────────────────────
const rid = crypto.randomUUID();
const now = new Date().toISOString();
db.run(
  `INSERT INTO recipient (id, payload, search_text, dong, status, status_since,
                          copay_tier_id, memo, created_at, updated_at)
   VALUES (?, ?, '', '시험동', '이용', '2026-05-11', NULL, '', ?, ?)`,
  [rid, JSON.stringify({ name: "시험정산", birth: "1940-01-01" }), now, now]
);
const svc = db.query<any, []>("SELECT id, unit_price FROM service ORDER BY id LIMIT 1").get();

// 의뢰 — 5.11 ~ 8.10 (석 달)
db.run(
  `INSERT INTO referral (batch_label, recipient_id, service_id, period_from, period_to,
                         period_months, cycle_unit, cycle_count, cycle_text,
                         copay_type, note, diff_state, created_at)
   VALUES ('시험차수', ?, ?, '2026-05-11', '2026-08-10', NULL, '주', 1, '주1회', '', '', '추가', ?)`,
  [rid, svc.id, now]
);

// 실적 — 6월과 7월에 한 번씩, 그리고 7.20 에 한 번 더
const 실적넣기 = (day: string) =>
  db.run(
    `INSERT INTO delivery (recipient_id, service_id, served_on, outcome, is_holiday,
                           planned, note, created_at)
     VALUES (?, ?, ?, '제공', 0, 1, '시험', ?)`,
    [rid, svc.id, day, now]
  );
실적넣기("2026-06-15");
실적넣기("2026-07-05");
실적넣기("2026-07-20");

console.log("\n── 1. 「달마다」 — 지금까지와 똑같아야 한다 (회귀) ───────\n");

시점바꾸기("monthly", "monthly");
{
  const 줄 = linesOf(rid, "2026-07");
  통과해야("7월 실적은 2회 — 달력 달 그대로",
           줄.reduce((s, x) => s + x.count, 0) === 2,
           JSON.stringify(줄.map((x) => x.count)));

  const d = month("2026-07");
  const 나 = d.items.find((x: any) => x.id === rid) as any;
  통과해야("정산표에 잡힌다", !!나);
  통과해야("기간이 7.1~7.31", 나?.periodFrom === "2026-07-01" && 나?.periodTo === "2026-07-31",
           `${나?.periodFrom}~${나?.periodTo}`);
  통과해야("이미 지난 달이니 「미확정」 (쌓이는 중이 아님)", 나?.state === "미확정", 나?.state);
  통과해야("금액이 나온다", (나?.total ?? 0) > 0, String(나?.total));
}

console.log("\n── 2. 「시작일부터 한 달씩」 ──────────────────────────────\n");

시점바꾸기("anniversary", "anniversary");
{
  // 5.11 시작 → 3회차는 7.11~8.10
  const d = month("2026-08");
  const 나 = d.items.find((x: any) => x.id === rid) as any;
  통과해야("8월에 끝나는 회차를 잡는다 — 7.11~8.10",
           나?.periodFrom === "2026-07-11" && 나?.periodTo === "2026-08-10",
           `${나?.periodFrom}~${나?.periodTo}`);
  통과해야("3회차다", 나?.회차 === 3, String(나?.회차));

  const 줄 = linesOf(rid, "2026-08", { from: "2026-07-11", to: "2026-08-10" });
  통과해야("7.20 실적만 이 회차에 든다 (7.5 는 앞 회차)",
           줄.reduce((s, x) => s + x.count, 0) === 1,
           JSON.stringify(줄.map((x) => x.count)));

  // 7월 화면에서는 2회차(6.11~7.10)가 잡혀야 합니다
  const d7 = month("2026-07");
  const 나7 = d7.items.find((x: any) => x.id === rid) as any;
  통과해야("7월 화면은 2회차 — 6.11~7.10",
           나7?.periodFrom === "2026-06-11" && 나7?.periodTo === "2026-07-10",
           `${나7?.periodFrom}~${나7?.periodTo}`);
}

console.log("\n── 3. 「일괄」 — 기간이 끝날 때 한 장 ────────────────────\n");

시점바꾸기("on_end", "on_end");
{
  const d = month("2026-08");
  const 나 = d.items.find((x: any) => x.id === rid) as any;
  통과해야("의뢰 기간 전체가 한 구간 — 5.11~8.10",
           나?.periodFrom === "2026-05-11" && 나?.periodTo === "2026-08-10",
           `${나?.periodFrom}~${나?.periodTo}`);
  const 줄 = linesOf(rid, "2026-08", { from: "2026-05-11", to: "2026-08-10" });
  통과해야("세 번 간 것이 전부 한 장에 들어간다",
           줄.reduce((s, x) => s + x.count, 0) === 3,
           JSON.stringify(줄.map((x) => x.count)));
}

console.log("\n── 4. 안 끝난 구간은 확정하지 않는다 ─────────────────────\n");
{
  // 끝을 안 적은 의뢰를 하나 더 붙이면 「아직 안 끝남」이 됩니다.
  const 열린의뢰 = Number(db.run(
    `INSERT INTO referral (batch_label, recipient_id, service_id, period_from, period_to,
                           period_months, cycle_unit, cycle_count, cycle_text,
                           copay_type, note, diff_state, created_at)
     VALUES ('시험열림', ?, ?, '2026-05-11', NULL, NULL, '주', 1, '주1회', '', '', '추가', ?)`,
    [rid, svc.id, now]
  ).lastInsertRowid);

  const d = month("2026-08");
  const 나 = d.items.find((x: any) => x.id === rid) as any;
  통과해야("끝을 모르는 의뢰가 있으면 「쌓이는중」", 나?.state === "쌓이는중", 나?.state);
  통과해야("그래도 얼마가 쌓였는지는 보여 준다", (나?.total ?? 0) > 0, String(나?.total));

  let 막혔나 = false;
  try { issue(rid, "2026-08", "시험"); } catch (e: any) {
    막혔나 = e.message.includes("끝나지 않았");
  }
  통과해야("**안 끝난 구간은 확정이 막힌다**", 막혔나);

  db.run("DELETE FROM referral WHERE id = ?", [열린의뢰]);
}

console.log("\n── 5. 되돌리기 · 뒷정리 ──────────────────────────────────\n");

시점바꾸기(원래.claim ?? "monthly", 원래.copay ?? "monthly");
{
  const 지금 = db.query<any, [number]>(
    "SELECT claim_timing, copay_timing FROM region_profile WHERE id = ?").get(프로필.id);
  통과해야("설정을 원래대로 돌려놓았다",
           지금.claim_timing === (원래.claim ?? "monthly"),
           `${지금.claim_timing}/${지금.copay_timing}`);
}

db.run("DELETE FROM billing WHERE recipient_id = ?", [rid]);
db.run("DELETE FROM delivery WHERE recipient_id = ?", [rid]);
db.run("DELETE FROM referral WHERE recipient_id = ?", [rid]);
db.run("DELETE FROM recipient WHERE id = ?", [rid]);
통과해야("시험 자료를 모두 치웠다",
         !db.query<any, [string]>("SELECT id FROM recipient WHERE id = ?").get(rid));

console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
process.exit(실패수 ? 1 : 0);
