/**
 * 연간 지원한도 150만원 — 7-마.
 *
 *   bun 한도시험.ts
 *
 * 여기서 보는 것:
 *   1) 한도는 **설정에서** 나온다 (코드에 안 박혀 있다)
 *   2) 0원 · 149만 · **150만 정각** · 150만 1원 — 경계에서 안 흔들리나
 *   3) **안전생활환경개선은 아무리 넣어도 그 숫자가 안 움직인다**
 *      (연간 한도 바깥. 대신 생애 100만원으로 따로 셉니다)
 *   4) **해가 바뀌면 0 으로 돌아간다** — 12/31 과 1/1 이 갈라지나
 *   5) 미제공은 안 센다 (노쇼 갈래가 생기면 7-아 에서 다시 봅니다)
 *   6) **확정한 청구는 얼린 단가로 센다** — 나중에 단가를 고쳐도 안 흔들린다
 *   7) 한도 임박 목록에 뜨나 · 못 미치면 안 뜨나
 *
 * 시험이 끝나면 넣은 것을 전부 치우고 설정을 원래대로 돌려놓습니다.
 */
import { randomUUID } from "node:crypto";
import { db, initDb } from "./server/db";

/*
 * 시험은 프로그램을 안 켜고 자료함만 엽니다. 그래서 **새로 생긴 칸이
 * 아직 없을 수 있습니다** — `initDb()` 를 불러 구조를 맞춰 놓고 시작합니다.
 * (안 하면 「no such column: annual_cap」이 납니다. 한 번 겪었습니다.)
 */
initDb();
import { 한도설정, 연간쓴돈, 한도임박, 한도에드나 } from "./server/한도";

let 통과수 = 0, 실패수 = 0;
function 통과해야(무엇: string, 참: unknown, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}
const 만원 = (n: number) => `${Math.round(n / 10000)}만`;

// ── 시험 마당 ────────────────────────────────────────────────
const 사람 = randomUUID();
const 프로필 = db.query<any, []>(
  `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`
).get();
const 원래한도 = { 연간: 프로필?.annual_cap, 주거: 프로필?.housing_cap };

/** 단가를 우리가 정한 값으로 만든 시험용 서비스. */
function 서비스만들기(name: string, 단가: number, 바깥 = 0) {
  const info = db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit,
                          unit_price, holiday_price, record_type, lifetime_cap,
                          outside_annual_cap, sort_order, active, custom)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,1)`,
    [프로필.id, `TEST-${randomUUID().slice(0, 8)}`, "시험", "시험", "시험",
     name, "time", 단가, null, "time", null, 바깥, 900]
  );
  return Number(info.lastInsertRowid);
}
function 실적넣기(serviceId: number, 날: string, outcome = "제공") {
  db.run(
    `INSERT INTO delivery (recipient_id, service_id, served_on, outcome, is_holiday, created_at)
     VALUES (?,?,?,?,0,?)`,
    [사람, serviceId, 날, outcome, new Date().toISOString()]
  );
}
const 치우기: (() => void)[] = [];

try {
  db.run(
    `INSERT INTO recipient (id, payload, dong, status, copay_tier_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: "한도시험", birth: "1938-03-03" }),
     "해남읍", "이용중", null, "2026-01-01", "2026-01-01"]
  );
  치우기.push(() => db.run("DELETE FROM recipient WHERE id = ?", [사람]));
  치우기.push(() => db.run("DELETE FROM delivery WHERE recipient_id = ?", [사람]));
  치우기.push(() => db.run("DELETE FROM billing WHERE recipient_id = ?", [사람]));

  // ── 1. 한도는 설정에서 나온다 ──────────────────────────────
  console.log("\n── 1. 한도는 설정에서 나옵니다 ───────────────────────────\n");
  db.run("UPDATE region_profile SET annual_cap = 1500000, housing_cap = 1000000 WHERE id = ?",
    [프로필.id]);
  치우기.push(() => db.run(
    "UPDATE region_profile SET annual_cap = ?, housing_cap = ? WHERE id = ?",
    [원래한도.연간 ?? 1500000, 원래한도.주거 ?? 1000000, 프로필.id]));

  통과해야("연간 한도 150만원", 한도설정().연간 === 1_500_000, 만원(한도설정().연간));
  통과해야("안전생활환경 생애 100만원", 한도설정().주거 === 1_000_000, 만원(한도설정().주거));

  db.run("UPDATE region_profile SET annual_cap = 2000000 WHERE id = ?", [프로필.id]);
  통과해야("**설정을 고치면 따라온다** (코드에 안 박혀 있다)",
    한도설정().연간 === 2_000_000, 만원(한도설정().연간));
  db.run("UPDATE region_profile SET annual_cap = 1500000 WHERE id = ?", [프로필.id]);

  /*
   * 0 은 「한도를 안 봅니다」입니다.
   * 「복지부 지침 표준」이 그렇습니다 — 150만원은 **해남군 편람**의 값이지
   * 지침에 있는 것이 아니라, 기준선에 그 숫자를 안 박았습니다.
   * 이때 「0원 한도를 넘겼습니다」 같은 **아무 뜻도 없는 말**이 나오면 안 됩니다.
   */
  db.run("UPDATE region_profile SET annual_cap = 0 WHERE id = ?", [프로필.id]);
  const 안봄 = 연간쓴돈(사람, 2026);
  통과해야("**한도 0 은 「안 봅니다」** — 넘겼다고 하지 않는다",
    !안봄.일상.봄 && !안봄.일상.넘었나);
  통과해야("그때는 남은 돈도 0 으로 둔다 (마이너스로 겁주지 않게)",
    안봄.일상.남은돈 === 0 && 안봄.일상.비율 === 0);
  db.run("UPDATE region_profile SET annual_cap = 1500000 WHERE id = ?", [프로필.id]);
  통과해야("다시 넣으면 본다", 연간쓴돈(사람, 2026).일상.봄);

  // ── 2. 경계 ────────────────────────────────────────────────
  console.log("\n── 2. 경계에서 안 흔들립니다 ─────────────────────────────\n");
  const 가사 = 서비스만들기("시험가사", 10_000);
  치우기.push(() => db.run("DELETE FROM service WHERE id = ?", [가사]));

  통과해야("아무것도 안 했으면 0원", 연간쓴돈(사람, 2026).일상.쓴돈 === 0);
  통과해야("남은 돈은 150만원", 연간쓴돈(사람, 2026).일상.남은돈 === 1_500_000);
  통과해야("안 넘었다", !연간쓴돈(사람, 2026).일상.넘었나);

  // 149회 × 1만원 = 149만
  for (let i = 0; i < 149; i++) 실적넣기(가사, `2026-0${(i % 9) + 1}-0${(i % 9) + 1}`);
  let h = 연간쓴돈(사람, 2026);
  통과해야("149만원 — 아직 안 넘음", h.일상.쓴돈 === 1_490_000 && !h.일상.넘었나, 만원(h.일상.쓴돈));

  실적넣기(가사, "2026-09-09");     // 150만 정각
  h = 연간쓴돈(사람, 2026);
  통과해야("**150만원 정각은 넘은 것이 아니다**",
    h.일상.쓴돈 === 1_500_000 && !h.일상.넘었나 && h.일상.남은돈 === 0, 만원(h.일상.쓴돈));

  실적넣기(가사, "2026-09-10");     // 151만
  h = 연간쓴돈(사람, 2026);
  통과해야("**한 번 더 가면 넘는다**", h.일상.넘었나, 만원(h.일상.쓴돈));
  통과해야("남은 돈이 마이너스로 보인다 (감추지 않습니다)",
    h.일상.남은돈 === -10_000, String(h.일상.남은돈));

  // ── 3. 안전생활환경개선은 이 숫자를 안 움직인다 ────────────
  console.log("\n── 3. 안전생활환경개선은 연간 한도 바깥 ──────────────────\n");
  const 주거 = 서비스만들기("시험주거", 300_000, 1);
  치우기.push(() => db.run("DELETE FROM service WHERE id = ?", [주거]));

  const 전 = 연간쓴돈(사람, 2026).일상.쓴돈;
  실적넣기(주거, "2026-05-05");
  실적넣기(주거, "2026-06-06");
  h = 연간쓴돈(사람, 2026);
  통과해야("**아무리 넣어도 일상 쪽 숫자가 안 움직인다**",
    h.일상.쓴돈 === 전, `${만원(전)} → ${만원(h.일상.쓴돈)}`);
  통과해야("대신 주거 쪽에 쌓인다", h.주거.쓴돈 === 600_000, 만원(h.주거.쓴돈));
  통과해야("주거는 생애 100만원으로 잰다", h.주거.한도 === 1_000_000 && !h.주거.넘었나);

  실적넣기(주거, "2026-07-07");
  실적넣기(주거, "2026-08-08");
  h = 연간쓴돈(사람, 2026);
  통과해야("**주거도 넘으면 넘었다고 한다**", h.주거.넘었나, 만원(h.주거.쓴돈));

  // ── 4. 해가 바뀌면 ─────────────────────────────────────────
  console.log("\n── 4. 해가 바뀌면 0 으로 돌아갑니다 ──────────────────────\n");
  const 사람2 = randomUUID();
  db.run(
    `INSERT INTO recipient (id, payload, dong, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?)`,
    [사람2, JSON.stringify({ name: "해넘이시험" }), "해남읍", "이용중",
     "2026-12-01", "2026-12-01"]
  );
  치우기.push(() => db.run("DELETE FROM delivery WHERE recipient_id = ?", [사람2]));
  치우기.push(() => db.run("DELETE FROM recipient WHERE id = ?", [사람2]));

  db.run(
    `INSERT INTO delivery (recipient_id, service_id, served_on, outcome, is_holiday, created_at)
     VALUES (?,?,?,?,0,?)`, [사람2, 가사, "2026-12-31", "제공", "x"]);
  db.run(
    `INSERT INTO delivery (recipient_id, service_id, served_on, outcome, is_holiday, created_at)
     VALUES (?,?,?,?,0,?)`, [사람2, 가사, "2027-01-01", "제공", "x"]);

  통과해야("**12월 31일은 2026 에만 든다**",
    연간쓴돈(사람2, 2026).일상.쓴돈 === 10_000, 만원(연간쓴돈(사람2, 2026).일상.쓴돈));
  통과해야("**1월 1일은 2027 에만 든다**",
    연간쓴돈(사람2, 2027).일상.쓴돈 === 10_000, 만원(연간쓴돈(사람2, 2027).일상.쓴돈));
  통과해야("두 해가 안 섞인다",
    연간쓴돈(사람2, 2026).일상.쓴돈 + 연간쓴돈(사람2, 2027).일상.쓴돈 === 20_000);
  통과해야("**주거는 해를 안 가린다** (생애 한도이므로)",
    연간쓴돈(사람, 2027).주거.쓴돈 === 연간쓴돈(사람, 2026).주거.쓴돈);

  // ── 5. 미제공 ──────────────────────────────────────────────
  console.log("\n── 5. 미제공은 아직 안 셉니다 (7-아 에서 다시) ───────────\n");
  const 전2 = 연간쓴돈(사람2, 2026).일상.쓴돈;
  실적넣기(가사, "2026-12-30", "미제공");
  db.run("UPDATE delivery SET recipient_id = ? WHERE recipient_id = ? AND served_on = '2026-12-30'",
    [사람2, 사람]);
  통과해야("미제공은 한도에 안 든다",
    연간쓴돈(사람2, 2026).일상.쓴돈 === 전2, 만원(연간쓴돈(사람2, 2026).일상.쓴돈));
  통과해야("판단은 **한 곳에서만** 합니다 (`한도에드나`)",
    한도에드나("제공") && !한도에드나("미제공"));
  통과해야("**노쇼 갈래가 생기면 여기만 고치면 됩니다** (7-아)",
    한도에드나.length >= 1, "사유를 받을 자리를 열어 두었습니다");

  // ── 6. 확정한 청구는 얼린 단가로 ───────────────────────────
  console.log("\n── 6. 확정한 청구는 얼린 단가로 셉니다 ───────────────────\n");
  const 사람3 = randomUUID();
  db.run(
    `INSERT INTO recipient (id, payload, dong, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?)`,
    [사람3, JSON.stringify({ name: "얼린단가시험" }), "해남읍", "이용중", "2026-03-01", "x"]);
  치우기.push(() => db.run("DELETE FROM delivery WHERE recipient_id = ?", [사람3]));
  치우기.push(() => db.run("DELETE FROM billing WHERE recipient_id = ?", [사람3]));
  치우기.push(() => db.run("DELETE FROM recipient WHERE id = ?", [사람3]));

  for (const 날 of ["2026-03-02", "2026-03-03"])
    db.run(
      `INSERT INTO delivery (recipient_id, service_id, served_on, outcome, is_holiday, created_at)
       VALUES (?,?,?,?,0,?)`, [사람3, 가사, 날, "제공", "x"]);

  통과해야("확정 전에는 지금 단가로 (1만 × 2)",
    연간쓴돈(사람3, 2026).일상.쓴돈 === 20_000, 만원(연간쓴돈(사람3, 2026).일상.쓴돈));

  // 3월을 1만원 단가로 확정해 둡니다.
  db.run(
    `INSERT INTO billing (recipient_id, period_from, period_to, kind, service_amount,
                          copay_rate, copay_amount, claim_amount, calc_snapshot,
                          issued_on, created_at)
     VALUES (?,?,?,'both',?,0,0,?,?,?,?)`,
    [사람3, "2026-03-01", "2026-03-31", 20000, 20000,
     JSON.stringify({ lines: [{ serviceId: 가사, unitPrice: 10000, holidayPrice: null }] }),
     "2026-04-01", "x"]);

  // 이제 설정에서 단가를 두 배로 올립니다.
  db.run("UPDATE service SET unit_price = 20000 WHERE id = ?", [가사]);
  const h3 = 연간쓴돈(사람3, 2026);
  통과해야("**단가를 올려도 확정한 몫은 안 흔들린다**",
    h3.일상.쓴돈 === 20_000, 만원(h3.일상.쓴돈));
  통과해야("얼린 단가로 셌다고 표시된다", h3.얼린구간 === 1 && h3.줄[0]?.얼렸나);

  // 확정 안 된 4월 실적은 새 단가로 셉니다.
  db.run(
    `INSERT INTO delivery (recipient_id, service_id, served_on, outcome, is_holiday, created_at)
     VALUES (?,?,?,?,0,?)`, [사람3, 가사, "2026-04-02", "제공", "x"]);
  통과해야("**확정 안 된 몫은 지금 단가로** (2만 더해져 4만)",
    연간쓴돈(사람3, 2026).일상.쓴돈 === 40_000, 만원(연간쓴돈(사람3, 2026).일상.쓴돈));
  db.run("UPDATE service SET unit_price = 10000 WHERE id = ?", [가사]);

  // ── 7. 한도 임박 목록 ──────────────────────────────────────
  console.log("\n── 7. 넘기기 전에 알려 줍니다 ────────────────────────────\n");
  const 임박 = 한도임박(2026, 0.9);
  const 이름들 = 임박.map((x: any) => x.name);
  통과해야("**넘긴 사람이 목록에 뜬다**", 이름들.includes("한도시험"), 이름들.join(" · ") || "(빔)");
  통과해야("조금 쓴 사람은 안 뜬다", !이름들.includes("얼린단가시험"));
  통과해야("많이 쓴 사람이 맨 위에 온다",
    임박.length === 0 || 임박[0].일상.비율 >= (임박[임박.length - 1]?.일상.비율 ?? 0));

  const 널널 = 한도임박(2026, 999);
  통과해야("기준을 아주 높이면 아무도 안 뜬다 (넘긴 사람 빼고)",
    널널.every((x: any) => x.일상.넘었나 || x.주거.넘었나), `${널널.length}명`);
} catch (e: any) {
  /*
   * 터진 것을 **삼키지 않습니다.**
   * finally 안에서 process.exit 을 하면 예외가 조용히 사라져,
   * 「0가지 중 0가지 통과」라는 아무 말도 안 하는 결과가 나옵니다.
   */
  실패수++;
  console.log(`\n✗ 시험 도중 터졌습니다 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 4).join("\n"));
} finally {
  for (const f of 치우기.reverse()) { try { f(); } catch { } }
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
