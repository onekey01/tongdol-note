/**
 * 정산 — 지자체 청구와 본인부담금의 **시점이 다를 때** 청구서가 둘로 갈리는가.
 *
 *   bun 청구갈라짐시험.ts
 *
 * ── 왜 갈라야 하는가 ───────────────────────────────────────
 * 기관이 「지자체는 달마다, 본인부담금은 끝날 때 한 번」으로 정할 수 있습니다.
 * 그러면 **묶는 기간 자체가 서로 다릅니다** — 8월 지자체 청구는 8.1~8.31 인데
 * 본인부담금은 5.11~8.10 을 통째로 받는 식입니다.
 * 기간이 다른 두 금액을 한 장에 적으면 **그 종이는 거짓말이 됩니다.**
 *
 * 여기서 보는 것:
 *   1) 시점이 같으면 지금까지와 **똑같이** 한 장 (회귀 검사)
 *   2) 다르면 몫이 둘, 각자 제 기간·제 상태
 *   3) 한쪽만 확정해도 다른 쪽은 안 흔들린다
 *   4) 두 종이를 더해도 **돈을 두 번 세지 않는다**
 *   5) 어르신께 드리는 청구서는 **본인부담금 기간**으로 나온다
 *   6) 안 끝난 기간은 확정을 막는다
 *
 * 시험이 끝나면 설정을 원래대로 돌려놓고 넣은 자료를 치웁니다.
 */

import { db } from "./server/db";
import { month, issue, issueAll, one } from "./server/billing";

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
// 본인부담률이 있어야 두 몫이 모두 0이 아닙니다.
const tier = db.query<any, []>(
  "SELECT id, rate, label FROM copay_tier WHERE rate > 0 ORDER BY rate LIMIT 1").get();
const rid = crypto.randomUUID();
const now = new Date().toISOString();
db.run(
  `INSERT INTO recipient (id, payload, search_text, dong, status, status_since,
                          copay_tier_id, memo, created_at, updated_at)
   VALUES (?, ?, '', '시험동', '이용', '2026-05-11', ?, '', ?, ?)`,
  [rid, JSON.stringify({ name: "시험갈라짐", birth: "1940-01-01" }), tier?.id ?? null, now, now]
);
const svc = db.query<any, []>("SELECT id, unit_price FROM service ORDER BY id LIMIT 1").get();

// 의뢰 — 5.11 ~ 8.10 (석 달, **이미 끝난** 기간)
db.run(
  `INSERT INTO referral (batch_label, recipient_id, service_id, period_from, period_to,
                         period_months, cycle_unit, cycle_count, cycle_text,
                         copay_type, note, diff_state, created_at)
   VALUES ('갈라짐시험', ?, ?, '2026-05-11', '2026-08-10', NULL, '주', 1, '주1회', '', '', '추가', ?)`,
  [rid, svc.id, now]
);

const 실적넣기 = (day: string) =>
  db.run(
    `INSERT INTO delivery (recipient_id, service_id, served_on, outcome, is_holiday,
                           planned, note, created_at)
     VALUES (?, ?, ?, '제공', 0, 1, '시험', ?)`,
    [rid, svc.id, day, now]
  );
// 6월·7월·8월 초에 하나씩. 7월 것 하나만 「7월 지자체 청구」에 들어갑니다.
실적넣기("2026-06-15");
실적넣기("2026-07-06");
실적넣기("2026-08-03");

/*
 * **지난 달**로 시험합니다. 이번 달은 아직 안 끝나서 무엇을 해도
 * 「쌓이는 중」에 걸립니다 — 확정 자체를 못 시험합니다.
 */
const 달 = "2026-07";
const 나 = () => month(달).items.find((x: any) => x.id === rid) as any;
const 치우기 = () => {
  db.run("DELETE FROM billing WHERE recipient_id = ?", [rid]);
};

try {
  // ── 1. 회귀 — 시점이 같으면 지금까지와 똑같다 ────────────────────
  시점바꾸기("monthly", "monthly");
  치우기();
  {
    const x = 나();
    통과해야("**시점이 같으면 몫이 하나** (지금까지와 똑같음)",
             x?.몫들?.length === 1 && x.몫들[0].kind === "both",
             JSON.stringify(x?.몫들?.map((k: any) => k.kind)));
    통과해야("한 장이라고 알려 준다", x?.한장인가 === true);
    통과해야("총액 = 본인부담 + 지자체 청구",
             x.total === x.copay + x.claim, `${x.total} = ${x.copay} + ${x.claim}`);
    통과해야("7월 구간은 달력 달 그대로",
             x.몫들[0].periodFrom === "2026-07-01" && x.몫들[0].periodTo === "2026-07-31",
             `${x.몫들[0].periodFrom}~${x.몫들[0].periodTo}`);

    const r = issue(rid, 달, "시험");
    통과해야("몫을 안 골라도 한 장이면 그냥 확정된다", r.kind === "both");
    const y = 나();
    통과해야("확정 뒤 상태가 「확정」", y.몫들[0].state === "확정", y.몫들[0].state);
    통과해야("확정한 줄의 kind 가 both",
             db.query<any, [string]>("SELECT kind FROM billing WHERE recipient_id = ?")
               .get(rid)?.kind === "both");
  }

  // ── 2. 시점이 다르면 둘로 갈린다 ─────────────────────────────────
  치우기();
  시점바꾸기("monthly", "on_end");   // 지자체는 달마다, 본인부담금은 끝날 때 한 번
  const x = 나();
  통과해야("**시점이 다르면 몫이 둘**", x?.몫들?.length === 2,
           JSON.stringify(x?.몫들?.map((k: any) => k.kind)));
  통과해야("한 장이 아니라고 알려 준다", x?.한장인가 === false);

  const 지자체 = x.몫들.find((k: any) => k.kind === "claim");
  const 본인 = x.몫들.find((k: any) => k.kind === "copay");
  통과해야("지자체 몫은 **달력 달**",
           지자체.periodFrom === "2026-07-01" && 지자체.periodTo === "2026-07-31",
           `${지자체.periodFrom}~${지자체.periodTo}`);
  통과해야("본인부담금 몫은 **의뢰 기간 통째로**",
           본인.periodFrom === "2026-05-11" && 본인.periodTo === "2026-08-10",
           `${본인.periodFrom}~${본인.periodTo}`);

  // ── 3. 각 몫은 제 돈만 적는다 ────────────────────────────────────
  통과해야("**지자체 몫에는 본인부담금이 0**", 지자체.copay === 0, String(지자체.copay));
  통과해야("**본인부담금 몫에는 지자체 청구가 0**", 본인.claim === 0, String(본인.claim));
  통과해야("지자체 몫에 청구액이 있다", 지자체.claim > 0, String(지자체.claim));
  통과해야("본인부담금 몫에 부담금이 있다", 본인.copay > 0, String(본인.copay));

  // 7월 구간에는 실적이 하나(7.6), 의뢰 기간 전체에는 셋.
  통과해야("**몫마다 세는 실적이 다르다** (기간이 다르니까)",
           지자체.count === 1 && 본인.count === 3,
           `지자체 ${지자체.count}회 · 본인 ${본인.count}회`);

  // ── 4. 두 종이를 더해도 두 번 세지 않는다 ────────────────────────
  통과해야("사람 합계 = 지자체 몫 + 본인 몫",
           x.claim === 지자체.claim && x.copay === 본인.copay &&
           x.total === 지자체.claim + 본인.copay,
           `${x.total} / ${지자체.claim} + ${본인.copay}`);

  const t = month(달).tally;
  통과해야("표 합계도 두 번 안 센다", t.total === t.claim + t.copay,
           `${t.total} = ${t.claim} + ${t.copay}`);
  통과해야("**사람 수와 종이 수를 따로 센다**", t.papers > t.people,
           `사람 ${t.people} · 종이 ${t.papers}`);

  // ── 5. 한쪽만 확정해도 다른 쪽은 안 흔들린다 ─────────────────────
  통과해야("**몫을 안 고르면 확정을 막는다**", (() => {
    try { issue(rid, 달, "시험"); return false; }
    catch (e: any) { return String(e.message).includes("골라"); }
  })());

  issue(rid, 달, "시험", "claim");
  {
    const y = 나();
    const 지 = y.몫들.find((k: any) => k.kind === "claim");
    const 본 = y.몫들.find((k: any) => k.kind === "copay");
    통과해야("지자체 몫만 확정됐다", 지.state === "확정", 지.state);
    통과해야("**본인부담금 몫은 그대로 미확정**", 본.state === "미확정", 본.state);
    통과해야("확정한 줄이 하나뿐", db.query<any, [string]>(
      "SELECT COUNT(*) AS n FROM billing WHERE recipient_id = ?").get(rid)?.n === 1);
  }

  issue(rid, 달, "시험", "copay");
  {
    const y = 나();
    통과해야("**둘 다 확정되면 줄이 둘**", db.query<any, [string]>(
      "SELECT COUNT(*) AS n FROM billing WHERE recipient_id = ?").get(rid)?.n === 2);
    const 종류 = db.query<any, [string]>(
      "SELECT group_concat(kind) AS n FROM billing WHERE recipient_id = ?").get(rid)?.n;
    통과해야("각각 제 이름으로 저장된다", String(종류).split(",").sort().join() === "claim,copay",
             String(종류));
    통과해야("확정 뒤에도 금액이 안 섞인다",
             y.claim === 지자체.claim && y.copay === 본인.copay,
             `${y.claim} / ${y.copay}`);
  }

  // ── 6. 어르신께 드리는 청구서는 본인부담금 기간으로 ──────────────
  {
    const 종이 = one(rid, 달);
    통과해야("**청구서 기간이 본인부담금 기간이다**",
             종이.from === "2026-05-11" && 종이.to === "2026-08-10",
             `${종이.from}~${종이.to}`);
    통과해야("청구서에 본인부담금이 찍힌다", 종이.copay > 0, String(종이.copay));
    통과해야("청구서에 확정 표시가 있다", 종이.frozen === true);
  }

  // ── 7. 안 끝난 기간은 막는다 ─────────────────────────────────────
  치우기();
  db.run("UPDATE referral SET period_to = NULL WHERE recipient_id = ?", [rid]);
  {
    const y = 나();
    const 본 = y.몫들.find((k: any) => k.kind === "copay");
    통과해야("끝을 안 적은 의뢰는 **쌓이는 중**", 본.state === "쌓이는중", 본.state);
    통과해야("쌓인 금액은 보여 준다", 본.copay > 0, String(본.copay));
    통과해야("**쌓이는 중은 확정을 막는다**", (() => {
      try { issue(rid, 달, "시험", "copay"); return false; }
      catch (e: any) { return String(e.message).includes("끝나지 않"); }
    })());

    // 한꺼번에 확정 — 지자체 몫은 되고 본인 몫은 건너뛰어야 합니다.
    const before = db.query<any, [string]>(
      "SELECT COUNT(*) AS n FROM billing WHERE recipient_id = ?").get(rid)?.n ?? 0;
    issueAll(달, "시험");
    const rows = db.query<any, [string]>(
      "SELECT group_concat(kind) AS n FROM billing WHERE recipient_id = ?").get(rid)?.n ?? "";
    통과해야("**한꺼번에 확정은 될 것만 한다** (지자체 몫만)",
             before === 0 && String(rows) === "claim", String(rows));
  }
  db.run("UPDATE referral SET period_to = '2026-08-10' WHERE recipient_id = ?", [rid]);

} finally {
  // ── 치우기 ─────────────────────────────────────────────────────
  db.run("DELETE FROM billing WHERE recipient_id = ?", [rid]);
  db.run("DELETE FROM delivery WHERE recipient_id = ?", [rid]);
  db.run("DELETE FROM referral WHERE recipient_id = ?", [rid]);
  db.run("DELETE FROM recipient WHERE id = ?", [rid]);
  시점바꾸기(원래.claim ?? "monthly", 원래.copay ?? "monthly");
  const 남음 = db.query<any, [string]>(
    "SELECT COUNT(*) AS n FROM recipient WHERE id = ?").get(rid)?.n;
  통과해야("시험 자료를 모두 치웠다", 남음 === 0);
  const p = db.query<any, []>(
    "SELECT rp.claim_timing c, rp.copay_timing y FROM region_profile rp " +
    "JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1").get();
  통과해야("설정을 원래대로 돌려놓았다",
           p.c === (원래.claim ?? "monthly") && p.y === (원래.copay ?? "monthly"),
           `${p.c}/${p.y}`);
}

console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패`);
process.exit(실패수 ? 1 : 0);
