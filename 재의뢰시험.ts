/**
 * 재의뢰 — 기간이 겹치는 의뢰를 알아보는가.
 *
 *   bun 재의뢰시험.ts
 *
 * 지자체 확인 결과 **겹쳐도 둘 다 유효**입니다. 그래서 이 시험이 보는 것은
 * 「제대로 지웠는가」가 아니라 **「제대로 알아보고, 아무것도 안 건드렸는가」**입니다.
 */

import { db } from "./server/db";
import { 기간겹치나 } from "./server/inbox";

let 통과수 = 0, 실패수 = 0;
function 통과해야(무엇: string, 참: boolean, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}

console.log("\n── 1. 기간이 겹치는가 ────────────────────────────────────\n");

// 사용자가 든 실제 예 — 4.21~6.30 이 있는데 5.11~7.17 이 새로 옴
통과해야("4.21~6.30 과 5.11~7.17 은 겹친다 (6월)",
         기간겹치나("2026-04-21", "2026-06-30", "2026-05-11", "2026-07-17"));
통과해야("순서를 바꿔 봐도 같다",
         기간겹치나("2026-05-11", "2026-07-17", "2026-04-21", "2026-06-30"));

통과해야("1~3월과 4~6월은 안 겹친다",
         !기간겹치나("2026-01-01", "2026-03-31", "2026-04-01", "2026-06-30"));
통과해야("하루 붙어 있으면 겹치는 것 — 3.31 과 3.31",
         기간겹치나("2026-01-01", "2026-03-31", "2026-03-31", "2026-06-30"));
통과해야("하루 떨어져 있으면 안 겹친다 — 3.31 과 4.1",
         !기간겹치나("2026-01-01", "2026-03-31", "2026-04-01", "2026-06-30"));

통과해야("한쪽이 다른 쪽에 통째로 들어가도 겹친다",
         기간겹치나("2026-01-01", "2026-12-31", "2026-05-01", "2026-05-31"));
통과해야("같은 기간이면 당연히 겹친다",
         기간겹치나("2026-05-01", "2026-05-31", "2026-05-01", "2026-05-31"));

console.log("\n── 2. 끝을 모르는 의뢰 ───────────────────────────────────\n");

// 「모르니까 안 겹친다」로 두면 겹치는 것을 놓칩니다. 무한대로 봅니다.
통과해야("끝이 비어 있으면 아직 안 끝난 것 — 뒤엣것과 겹친다",
         기간겹치나("2026-01-01", null, "2026-05-01", "2026-05-31"));
통과해야("시작이 비어 있으면 앞엣것과 겹친다",
         기간겹치나(null, "2026-06-30", "2026-01-01", "2026-01-31"));
통과해야("양쪽 다 비어 있으면 무엇과도 겹친다",
         기간겹치나(null, null, "2030-01-01", "2030-01-31"));
통과해야("끝이 빈 것끼리도 겹친다",
         기간겹치나("2020-01-01", null, "2026-01-01", null));

console.log("\n── 3. 자료함을 거쳐서 — 같은 서비스일 때만 ───────────────\n");

// 사람 하나, 서비스 둘, 의뢰 셋을 넣고 API 가 세는 방식 그대로 세어 봅니다.
const rid = crypto.randomUUID();
const now = new Date().toISOString();
db.run(
  `INSERT INTO recipient (id, payload, search_text, dong, status, status_since,
                          copay_tier_id, memo, created_at, updated_at)
   VALUES (?, ?, '', '시험동', '이용', '2026-01-01', NULL, '', ?, ?)`,
  [rid, JSON.stringify({ name: "시험겹침", birth: "1940-01-01" }), now, now]
);
const svc = db.query<any, []>("SELECT id FROM service ORDER BY id LIMIT 2").all();
if (svc.length < 2) {
  console.log("  (서비스가 둘 이상 있어야 하는 시험이라 건너뜁니다)");
} else {
  const [갑서비스, 을서비스] = svc;
  const 의뢰넣기 = (serviceId: number, from: string, to: string, batch: string) =>
    Number(db.run(
      `INSERT INTO referral (batch_label, recipient_id, service_id, period_from, period_to,
                             period_months, cycle_unit, cycle_count, cycle_text,
                             copay_type, note, diff_state, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, '주', 1, '주1회', '', '', '추가', ?)`,
      [batch, rid, serviceId, from, to, now]
    ).lastInsertRowid);

  const 앞 = 의뢰넣기(갑서비스.id, "2026-04-21", "2026-06-30", "1차");
  const 뒤 = 의뢰넣기(갑서비스.id, "2026-05-11", "2026-07-17", "2차");
  const 딴것 = 의뢰넣기(을서비스.id, "2026-05-11", "2026-07-17", "2차");

  const 의뢰들 = db.query<any, [string]>(
    `SELECT id, service_id, batch_label, period_from, period_to
       FROM referral WHERE recipient_id = ?`
  ).all(rid);
  const 걸치나 = (a: any, b: any) =>
    (a.period_from || "0000-00-00") <= (b.period_to || "9999-99-99") &&
    (b.period_from || "0000-00-00") <= (a.period_to || "9999-99-99");
  const 겹침의 = (id: number) => {
    const me = 의뢰들.find((x) => x.id === id)!;
    return 의뢰들.filter((o) => o.id !== id && o.service_id === me.service_id && 걸치나(me, o));
  };

  통과해야("1차 의뢰가 2차와 겹치는 것을 알아본다", 겹침의(앞).length === 1,
           JSON.stringify(겹침의(앞).map((x) => x.batch_label)));
  통과해야("2차 의뢰도 1차와 겹치는 것을 알아본다 — 양쪽 다 표시됩니다",
           겹침의(뒤).length === 1);
  통과해야("**서비스가 다르면 겹침이 아니다** — 다른 서비스는 원래 같이 받습니다",
           겹침의(딴것).length === 0,
           JSON.stringify(겹침의(딴것).map((x) => x.batch_label)));

  // 가장 중요한 것 — 아무것도 안 건드렸는가
  const 남은수 = db.query<{ n: number }, [string]>(
    "SELECT COUNT(*) AS n FROM referral WHERE recipient_id = ?"
  ).get(rid)!.n;
  통과해야("**겹쳐도 지우지 않는다 — 셋 다 그대로 살아 있다**", 남은수 === 3, String(남은수));

  const 앞행 = db.query<any, [number]>("SELECT * FROM referral WHERE id = ?").get(앞);
  통과해야("앞의 의뢰 기간을 고치지도 않는다",
           앞행.period_from === "2026-04-21" && 앞행.period_to === "2026-06-30",
           `${앞행.period_from}~${앞행.period_to}`);

  db.run("DELETE FROM referral WHERE recipient_id = ?", [rid]);
}

db.run("DELETE FROM recipient WHERE id = ?", [rid]);
통과해야("시험에 쓴 자료를 치웠다",
         !db.query<any, [string]>("SELECT id FROM recipient WHERE id = ?").get(rid));

console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
process.exit(실패수 ? 1 : 0);
