/**
 * 시범자료 점검 시험 —  bun 시범점검시험.ts
 *
 * ═══════════════════════════════════════════════════════════
 *  무엇을 보나
 * ═══════════════════════════════════════════════════════════
 *
 * 2026-09-05 시범자료를 넣고 화면을 하나씩 열어 보다가 **돈과 관련된
 * 결함 셋**이 나왔습니다. 셋 다 「화면은 멀쩡한데 숫자가 틀린」 갈래라
 * 눈으로는 안 잡힙니다. 그래서 시험으로 못을 박아 둡니다.
 *
 *   ① 연간 한도가 **시간을 안 셌습니다**
 *      세 시간 다녀온 것을 한 시간 값으로 세어, 정산은 3,096,000원
 *      한도는 1,032,000원. 150만원을 두 배 넘겼는데 「69% 썼습니다」.
 *
 *   ② 현장에서 올라온 건에 **진행시간(분)이 안 적혔습니다**
 *      폰이 시작·종료를 찍어 보내는데 분 칸이 비어, 청구가
 *      「한 번 = 한 시간」으로 셌습니다. **기관이 손해 보는 쪽**이라
 *      아무도 항의하지 않아 더 안 드러납니다.
 *
 *   ③ 현장에서 고른 **「비대면배달」이 자료함에 안 남았습니다**
 *      계약서 5-2조(3회 연속이면 통합돌봄 전체 중지) 셈이 한 번도
 *      안 돌았습니다.
 *
 *   ④ 홈의 「대기중」이 **퇴사한 사람의 배정을 「붙었다」로** 봤습니다
 *
 * ── 시험이 진짜로 무는지 확인했습니다 ─────────────────────
 *
 * 고친 자리를 하나씩 되돌려 놓고 돌려 보았습니다. 되돌리면
 *   ①에서 3가지 · ②에서 2가지 · ③에서 3가지 · ④에서 2가지가
 * 실패합니다. 안 무는 시험은 없느니만 못합니다.
 */
import { randomUUID } from "node:crypto";
import { db, initDb } from "./server/db";
initDb();

import { 연간쓴돈 } from "./server/한도";
import { 실적줄들 } from "./server/billing";
import { 분재기 } from "./server/util";
import { 비대면연속 } from "./server/대면배달";
import { home as homeData } from "./server/home";

let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: unknown, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}

const 오늘 = new Date().toISOString().slice(0, 10);
const 올해 = Number(오늘.slice(0, 4));
const 사람 = randomUUID();
const 사람2 = randomUUID();
const 지울서비스: number[] = [];
const 지울배정: number[] = [];
let 만든계정: number | null = null;
let 만든인력: number | null = null;
let 퇴사계정: number | null = null;
let 퇴사인력: number | null = null;

/**
 * n 일 전.
 *
 * ★ 날짜를 **하나씩 못박아** 씁니다. 「최근 세 날」처럼 겹칠 수 있게
 *   고르면, ③의 비대면 연속이 ①에서 넣은 밥 한 끼에 끊깁니다 —
 *   처음에 그렇게 짜서 시험이 엉뚱하게 실패했습니다.
 */
const 며칠전 = (n: number) =>
  new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);

try {
  const 프로필: any = db.query(
    `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id
      WHERE o.id = 1`).get();
  if (!프로필) throw new Error("기관이 없습니다. 통돌 Note 를 한 번 켜 주세요.");

  // ── 시험용 자료 ───────────────────────────────────────────
  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at)
          VALUES (?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: "한도시험" }), "해남읍", "이용", `${올해}-01-01`, "x"]);
  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at)
          VALUES (?,?,?,?,?,?)`,
    [사람2, JSON.stringify({ name: "대기시험" }), "해남읍", "이용", `${올해}-01-01`, "x"]);

  const u = db.run(
    `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload, created_at)
     VALUES ('시험인력', ?, 'x', 'worker', '["worker"]', 'active', '{}', 'x')`,
    [`t-${randomUUID().slice(0, 8)}`]);
  만든계정 = Number(u.lastInsertRowid);
  만든인력 = Number(db.run(
    `INSERT INTO worker (user_id, hired_on, status, created_at) VALUES (?,?, 'active','x')`,
    [만든계정, `${올해}-01-01`]).lastInsertRowid);

  // ★ 퇴사한 사람 — 홈의 「대기중」을 보려면 있어야 합니다
  const u2 = db.run(
    `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, resigned_at, payload, created_at)
     VALUES ('시험퇴사', ?, 'x', 'worker', '["worker"]', 'resigned', ?, '{}', 'x')`,
    [`t-${randomUUID().slice(0, 8)}`, 오늘]);
  퇴사계정 = Number(u2.lastInsertRowid);
  퇴사인력 = Number(db.run(
    `INSERT INTO worker (user_id, hired_on, status, created_at) VALUES (?,?, 'resigned','x')`,
    [퇴사계정, `${올해}-01-01`]).lastInsertRowid);

  const 시간서비스 = Number(db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','가사지원','청소','시험가사','hour',24000,NULL,'time',
             NULL,0,0,0,0,930,1,1)`,
    [프로필.id, `TCAP-${randomUUID().slice(0, 6)}`]).lastInsertRowid);
  지울서비스.push(시간서비스);

  const 식사서비스 = Number(db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','식사지원','도시락','시험식사','meal',11000,NULL,'meal',
             NULL,0,0,0,0,931,1,1)`,
    [프로필.id, `TMEA-${randomUUID().slice(0, 6)}`]).lastInsertRowid);
  지울서비스.push(식사서비스);

  const 모든요일 = JSON.stringify([0, 1, 2, 3, 4, 5, 6].map((dow) => ({ dow })));
  const 배정 = Number(db.run(
    `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
     VALUES (?,?,?,?,?,'x')`,
    [사람, 시간서비스, 만든인력, 모든요일, `${올해}-01-01`]).lastInsertRowid);
  지울배정.push(배정);

  const 식사배정 = Number(db.run(
    `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
     VALUES (?,?,?,?,?,'x')`,
    [사람, 식사서비스, 만든인력, 모든요일, `${올해}-01-01`]).lastInsertRowid);
  지울배정.push(식사배정);

  // ══════════════════════════════════════════════════════════
  //  ① 연간 한도가 시간을 세는가 ★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ① 연간 한도가 **시간**을 세는가 ★ ─────────────\n");
  {
    /*
     * 하루 상한(편람 1일 3시간)에 걸리지 않게 **하루 한 건**씩,
     * 서로 다른 날에 세 시간짜리를 세 번 넣습니다.
     */
    const 날들 = [며칠전(30), 며칠전(29), 며칠전(28)];
    for (const d of 날들)
      db.run(
        `INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                               is_holiday,planned,minutes,start_at,end_at,created_at)
         VALUES (?,?,?,?,'제공',0,1,180,?,?,'x')`,
        [배정, 사람, 시간서비스, d, `${d}T09:00:00`, `${d}T12:00:00`]);

    const x = 연간쓴돈(사람, 올해);
    const 줄 = x.줄.find((l) => l.serviceId === 시간서비스)!;

    본다("★ 세 시간짜리 세 번이면 아홉 시간 값이다",
      줄.금액 === 3 * 3 * 24000, `${줄.금액.toLocaleString()}원 (한 시간 값으로 세면 72,000원)`);
    본다("★ 한 시간 값으로 세지 않는다", 줄.금액 !== 3 * 24000,
      "여기가 무너지면 한도를 실제의 1/3 로 봅니다");

    /*
     * ★ **정산과 같은 숫자여야 합니다.** 두 화면이 다른 금액을 말하면
     *   어느 쪽을 믿어야 할지 아무도 모릅니다.
     */
    const 정산셈 = 실적줄들(사람, `${올해}-01-01`, `${올해}-12-31`)
      .filter((l) => l.service_id === 시간서비스)
      .reduce((s, l) => s + Math.round(l.unit_price * (l.인정분 / 60)), 0);
    본다("★ 정산이 세는 금액과 똑같다", 줄.금액 === 정산셈,
      `한도 ${줄.금액.toLocaleString()} · 정산 ${정산셈.toLocaleString()}`);

    // 40분짜리는 편람대로 30분으로 인정됩니다 (한 시간이 아닙니다).
    const 짧은날 = 며칠전(27);
    db.run(
      `INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                             is_holiday,planned,minutes,created_at)
       VALUES (?,?,?,?,'제공',0,1,40,'x')`,
      [배정, 사람, 시간서비스, 짧은날]);
    const y = 연간쓴돈(사람, 올해).줄.find((l) => l.serviceId === 시간서비스)!;
    본다("40분은 30분으로 인정된다 (한 시간이 아니다)",
      y.금액 === 3 * 3 * 24000 + 12000, `${y.금액.toLocaleString()}원`);

    // 끼 단위(식사)는 그대로 「한 번 = 한 회」입니다.
    const 밥날 = 며칠전(26);
    db.run(
      `INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                             is_holiday,planned,created_at)
       VALUES (?,?,?,?,'제공',0,1,'x')`,
      [식사배정, 사람, 식사서비스, 밥날]);
    const z = 연간쓴돈(사람, 올해).줄.find((l) => l.serviceId === 식사서비스)!;
    본다("끼 단위는 한 번 = 한 회분 그대로다", z.금액 === 11000, `${z.금액.toLocaleString()}원`);
  }

  // ══════════════════════════════════════════════════════════
  //  ② 진행시간에서 분을 재는가 ★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ② 시작·종료에서 **분**을 재는가 ★ ─────────────\n");
  {
    본다("★ 두 시간이면 120분", 분재기("2026-09-05T09:00:00", "2026-09-05T11:00:00") === 120);
    본다("40분도 그대로 잰다", 분재기("2026-09-05T09:00:00", "2026-09-05T09:40:00") === 40);
    본다("한쪽이 없으면 지어내지 않는다", 분재기("2026-09-05T09:00:00", null) === null);
    /*
     * ★ 거꾸로 된 것과 하루가 넘는 것은 버립니다. 폰에서 끝을 잘못 찍고
     *   되돌린 흔적이 남으면 그런 값이 나오는데, 그대로 청구에 넣으면
     *   **하루 상한에 걸려 그날의 다른 방문까지 깎입니다.**
     */
    본다("★ 거꾸로 된 시각은 버린다",
      분재기("2026-09-05T11:00:00", "2026-09-05T09:00:00") === null);
    본다("★ 하루가 넘는 값은 버린다",
      분재기("2026-09-05T09:00:00", "2026-09-07T09:00:00") === null);
  }

  // ══════════════════════════════════════════════════════════
  //  ③ 비대면이 자료함 칸에 남는가 ★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ③ **비대면**이 자료함에 남는가 ★ ──────────────\n");
  {
    /*
     * 현장앱이 보낸 것과 같은 모양으로 넣습니다 — 겉(payload)에는
     * 「비대면배달」이라고 적혀 있고, 자료함 칸(face_to_face)에도
     * 0 이 들어가야 합니다. 칸이 비면 **대면으로 읽힙니다.**
     */
    const 밥날들 = [며칠전(5), 며칠전(4), 며칠전(3)];
    밥날들.forEach((d, i) => {
      db.run(
        `INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                               is_holiday,planned,face_to_face,payload,created_at)
         VALUES (?,?,?,?,'제공',0,1,?,?,'x')`,
        [식사배정, 사람, 식사서비스, d, i === 0 ? 1 : 0,
         JSON.stringify({ 현장: { 적은것: { 제공형태: i === 0 ? "대면배달" : "비대면배달" } } })]);
    });

    const x = 비대면연속(사람);
    본다("★ 비대면 두 번이 연속으로 세어진다", x.연속 === 2, `연속 ${x.연속}회`);
    본다("★ 3회에 닿기 전에 경고가 뜬다", x.경고 === true && x.닿음 === false,
      `경고 ${x.경고} · 닿음 ${x.닿음}`);

    // 칸이 비어 있으면 대면으로 읽습니다 — 그래서 칸을 꼭 채워야 합니다.
    db.run("UPDATE delivery SET face_to_face = NULL WHERE recipient_id = ? AND service_id = ?",
      [사람, 식사서비스]);
    const y = 비대면연속(사람);
    본다("★ 칸이 비면 대면으로 읽힌다 — 그래서 채워야 한다", y.연속 === 0,
      `${y.연속}회 — 겉(payload)에는 「비대면배달」이라고 적혀 있는데도 0 입니다`);
  }

  // ══════════════════════════════════════════════════════════
  //  ④ 퇴사한 사람의 배정은 「붙은 것」이 아니다 ★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ④ **퇴사한 사람**이 담당이면 대기중인가 ★ ─────\n");
  {
    /*
     * 의뢰가 있어야 홈이 「이 사람에게 이 서비스가 필요하다」를 압니다.
     * 그다음 배정을 **퇴사한 사람**에게 붙입니다.
     */
    db.run(
      `INSERT INTO referral (batch_label, recipient_id, service_id, period_from,
                             cycle_unit, cycle_count, cycle_text, diff_state, created_at)
       VALUES ('시험', ?, ?, ?, 'week', 2, '주 2회', '신규', 'x')`,
      [사람2, 시간서비스, `${올해}-01-01`]);
    const 퇴사배정 = Number(db.run(
      `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
       VALUES (?,?,?,?,?,'x')`,
      [사람2, 시간서비스, 퇴사인력, 모든요일, `${올해}-01-01`]).lastInsertRowid);
    지울배정.push(퇴사배정);

    const h: any = homeData();
    const 대기 = (h.unassigned ?? []).some((x: any) => x.name === "대기시험");
    본다("★ 퇴사한 분이 담당이면 대기중으로 뜬다", 대기,
      "안 뜨면 그날 아무도 안 가고 기록지에 구멍이 납니다");

    // 담당을 살아 있는 사람으로 바꾸면 대기에서 빠집니다.
    db.run("UPDATE assignment SET worker_id = ? WHERE id = ?", [만든인력, 퇴사배정]);
    const h2: any = homeData();
    본다("★ 살아 있는 분으로 바꾸면 대기에서 빠진다",
      !(h2.unassigned ?? []).some((x: any) => x.name === "대기시험"));

    // 담당이 아예 비어 있어도 대기중입니다.
    db.run("UPDATE assignment SET worker_id = NULL WHERE id = ?", [퇴사배정]);
    const h3: any = homeData();
    본다("담당이 비어 있어도 대기중으로 뜬다",
      (h3.unassigned ?? []).some((x: any) => x.name === "대기시험"));
  }

} catch (e: any) {
  실패수++;
  console.log(`\n✗ 실패  시험 도중 터짐 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 5).join("\n"));
} finally {
  for (const id of [사람, 사람2]) {
    db.run("DELETE FROM delivery WHERE recipient_id = ?", [id]);
    db.run("DELETE FROM referral WHERE recipient_id = ?", [id]);
    db.run("DELETE FROM assignment WHERE recipient_id = ?", [id]);
    db.run("DELETE FROM status_change WHERE recipient_id = ?", [id]);
    db.run("DELETE FROM sticky WHERE recipient_id = ?", [id]);
    db.run("DELETE FROM recipient WHERE id = ?", [id]);
  }
  for (const id of 지울서비스) db.run("DELETE FROM service WHERE id = ?", [id]);
  try {
    for (const w of [만든인력, 퇴사인력]) if (w) db.run("DELETE FROM worker WHERE id = ?", [w]);
    for (const u of [만든계정, 퇴사계정]) if (u) db.run("DELETE FROM app_user WHERE id = ?", [u]);
  } catch { }
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
