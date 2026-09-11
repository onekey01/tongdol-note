/**
 * 계획을 어떻게 세는가 — **요일은 안내, 셈은 횟수.**
 *
 *   bun 계획셈시험.ts
 *
 * ── 무엇이 바뀌었나 ────────────────────────────────────────
 *
 * 예전에는 「주 2회 화·목」인데 수요일에 다녀오면
 *   · 그 수요일을 **「계획밖(◆)」**으로 갈라 놓고
 *   · **계획 수를 3으로 부풀렸습니다** (깔린 칸을 세었으니까요)
 * 채웠는데도 「계획을 안 지켰다」처럼 읽혔습니다.
 *
 * 지자체가 정한 것은 **횟수**입니다. 요일은 그것을 어디에 놓을지 정한
 * 안내일 뿐입니다. 그래서 지금은 —
 *   · 다녀왔으면 **그냥 「제공」**
 *   · 계획은 **가야 할 횟수**(계획 요일 칸 수)이지 깔린 칸 수가 아님
 *
 * 시험이 끝나면 넣은 자료를 치웁니다.
 */

import { db } from "./server/db";
import { month, setCell } from "./server/record";

let 통과수 = 0, 실패수 = 0;
function 통과해야(무엇: string, 참: boolean, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}

const rid = crypto.randomUUID();
const now = new Date().toISOString();
const svc = db.query<any, []>("SELECT id FROM service ORDER BY id LIMIT 1").get();

db.run(
  `INSERT INTO recipient (id, payload, search_text, dong, status, status_since,
                          copay_tier_id, memo, created_at, updated_at)
   VALUES (?, ?, '', '시험동', '이용', '2026-07-01', NULL, '', ?, ?)`,
  [rid, JSON.stringify({ name: "시험계획" }), now, now]
);
// 주 1회 — 의뢰가 있어야 `cycle_unit='week'` 가 되어 요일 계획이 섭니다.
db.run(
  `INSERT INTO referral (batch_label, recipient_id, service_id, period_from, period_to,
                         period_months, cycle_unit, cycle_count, cycle_text,
                         copay_type, note, diff_state, created_at)
   VALUES ('계획셈시험', ?, ?, '2026-07-01', '2026-07-31', NULL, 'week', 1, '주1회', '', '', '추가', ?)`,
  [rid, svc.id, now]
);
// 계획은 **화요일**(dow 2)만. 2026년 7월의 화요일은 7·14·21·28 — 네 번입니다.
db.run(
  `INSERT INTO assignment (recipient_id, service_id, weekly_plan, period_from, period_to, created_at)
   VALUES (?, ?, '[{"dow":2}]', '2026-07-01', '2026-07-31', ?)`,
  [rid, svc.id, now]
);
const aid = db.query<any, [string]>(
  "SELECT id FROM assignment WHERE recipient_id = ?").get(rid).id as number;

const 나 = () => month("2026-07").items.find((x: any) => x.assignId === aid) as any;

try {
  // ── 1. 손대기 전 ────────────────────────────────────────────────
  {
    const x = 나();
    통과해야("계획 요일이 넷이면 계획도 넷", x.계획 === 4, String(x.계획));
    통과해야("아직 아무 데도 안 갔으니 제공 0", x.제공 === 0, String(x.제공));
    통과해야("남음 = 계획", x.남음 === 4, String(x.남음));
    통과해야("칸도 넷만 깔린다", x.cells.length === 4, String(x.cells.length));
  }

  // ── 2. 계획 요일에 다녀오기 ─────────────────────────────────────
  setCell({ assignId: aid, on: "2026-07-07", state: "제공" });   // 화
  {
    const x = 나();
    통과해야("계획 요일에 가면 제공 1", x.제공 === 1, String(x.제공));
    통과해야("계획은 그대로 넷", x.계획 === 4, String(x.계획));
    통과해야("남음 셋", x.남음 === 3, String(x.남음));
  }

  // ── 3. **계획에 없던 요일**에 다녀오기 ──────────────────────────
  // 여기가 이번에 바뀐 자리입니다.
  setCell({ assignId: aid, on: "2026-07-15", state: "제공" });   // 수요일
  {
    const x = 나();
    통과해야("**계획에 없던 날도 그냥 「제공」**",
             x.cells.find((c: any) => c.on === "2026-07-15")?.state === "제공",
             x.cells.find((c: any) => c.on === "2026-07-15")?.state);
    통과해야("**「계획밖」이라는 상태는 이제 없다**",
             !x.cells.some((c: any) => c.state === "계획밖"),
             JSON.stringify(x.cells.map((c: any) => c.state)));
    통과해야("제공이 둘로 센다", x.제공 === 2, String(x.제공));
    통과해야("**계획이 안 부푼다** (예전에는 다섯이 됐습니다)",
             x.계획 === 4, String(x.계획));
    통과해야("남음 둘", x.남음 === 2, String(x.남음));
    통과해야("칸은 다섯 (수요일 칸이 하나 늘어남)", x.cells.length === 5,
             String(x.cells.length));
    통과해야("그 수요일 칸은 계획 요일이 아니라고 표시된다",
             x.cells.find((c: any) => c.on === "2026-07-15")?.planned === false,
             String(x.cells.find((c: any) => c.on === "2026-07-15")?.planned));
  }

  // ── 4. 못 간 날 ─────────────────────────────────────────────────
  setCell({ assignId: aid, on: "2026-07-21", state: "미제공", reason: "부재" });
  {
    const x = 나();
    통과해야("못 간 것은 따로 센다", x.미제공 === 1, String(x.미제공));
    통과해야("남음 하나 (계획 4 − 제공 2 − 못 감 1)", x.남음 === 1, String(x.남음));
  }

  // ── 5. **주 횟수를 다 채우면 남음 0** ───────────────────────────
  // 계획 요일이 아닌 날로만 나머지를 채워도 채운 것으로 봐야 합니다.
  setCell({ assignId: aid, on: "2026-07-29", state: "제공" });   // 수요일
  {
    const x = 나();
    통과해야("**계획 요일이 아닌 날로 채워도 채운 것으로 센다**",
             x.제공 === 3, String(x.제공));
    통과해야("**남음이 0 이 된다** (4 − 3 − 1)", x.남음 === 0, String(x.남음));
    통과해야("계획은 끝까지 넷", x.계획 === 4, String(x.계획));
  }

  // ── 6. 통계도 같은 말을 하는가 ──────────────────────────────────
  {
    const { 해통계 } = await import("./server/stats");
    const s = 해통계(2026, 7);
    const 줄 = s.대상자별.find((r: any) => r.이름 === "시험계획") as any;
    통과해야("통계도 계획 넷", 줄?.계획 === 4, String(줄?.계획));
    통과해야("통계도 제공 셋", 줄?.제공 === 3, String(줄?.제공));
    통과해야("통계에 「계획밖」 칸이 없다", !("계획밖" in (줄 ?? {})),
             Object.keys(줄 ?? {}).join(","));
    통과해야("처리율 100% (제공 3 + 못 감 1 ÷ 계획 4)", 줄?.달성률 === 100,
             String(줄?.달성률));
  }

} finally {
  db.run("DELETE FROM delivery WHERE recipient_id = ?", [rid]);
  db.run("DELETE FROM assignment WHERE recipient_id = ?", [rid]);
  db.run("DELETE FROM referral WHERE recipient_id = ?", [rid]);
  db.run("DELETE FROM recipient WHERE id = ?", [rid]);
  const 남음 = db.query<any, [string]>(
    "SELECT COUNT(*) AS n FROM recipient WHERE id = ?").get(rid)?.n;
  통과해야("시험 자료를 모두 치웠다", 남음 === 0);
}

console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패`);
process.exit(실패수 ? 1 : 0);
