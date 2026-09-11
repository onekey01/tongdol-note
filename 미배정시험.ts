/**
 * 홈 화면 「대기중(제공인력 미배정)」 시험 —  bun 미배정시험.ts
 *
 * ── 왜 이 시험이 생겼나 ─────────────────────────────────────
 *
 * 한 분이 **가사지원과 식사지원을 함께** 받는데 가사지원에만 사람을
 * 붙였더니, 그분이 미배정 목록에서 **통째로 사라졌습니다.**
 * 식사지원은 여전히 갈 사람이 없는데 화면은 「다 붙었습니다」였습니다.
 * (2026-09-05 무무가 현장에서 발견.)
 *
 * 까닭은 셈을 **사람 단위**로 했기 때문입니다 —
 * `SELECT DISTINCT recipient_id FROM assignment`.
 * 사람에게 배정이 하나라도 있으면 다 붙은 것으로 봤습니다.
 *
 * 이 갈래의 잘못은 **놓치는 쪽으로** 틀려서 더 나쁩니다.
 * 없는 일을 있다고 하면 한 번 확인하고 끝이지만,
 * 있는 일을 없다고 하면 그날 서비스가 그냥 안 나갑니다.
 *
 * 그래서 고친 뒤 **시험을 남깁니다.** 다음에 누가 셈을 만질 때
 * 같은 자리로 돌아가지 않게.
 */
import { db, initDb } from "./server/db";
initDb();
const { home } = await import("./server/home");

let 통과수 = 0, 실패수 = 0;
function 맞아야(무엇: string, 참인가: boolean, 곁 = "") {
  if (참인가) { 통과수++; console.log(`  통과  ${무엇}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${곁 ? "\n          " + 곁 : ""}`); }
}

const 이제 = new Date().toISOString();
const 치울것: { 표: string; id: any }[] = [];

/** 시험용 제공인력 한 사람. 없으면 배정을 걸 데가 없습니다. */
function 인력만들기() {
  const 있던것 = db.query<{ id: number }, []>("SELECT id FROM worker LIMIT 1").get();
  if (있던것) return 있던것.id;
  const u = db.run(
    `INSERT INTO app_user (login_id, pw_hash, name, role, roles, status, created_at)
     VALUES (?, 'x', '시험인력', 'worker', '["worker"]', 'active', ?)`,
    [`시험인력-${Date.now()}`, 이제]);
  const uid = Number(u.lastInsertRowid);
  치울것.push({ 표: "app_user", id: uid });
  const w = db.run(
    "INSERT INTO worker (user_id, created_at) VALUES (?, ?)", [uid, 이제]);
  const wid = Number(w.lastInsertRowid);
  치울것.push({ 표: "worker", id: wid });
  return wid;
}

const 인력 = 인력만들기();
const 서비스들 = db.query<{ id: number; name: string }, []>(
  "SELECT id, name FROM service ORDER BY id LIMIT 2").all();
if (서비스들.length < 2) {
  console.error("\n  서비스가 둘 이상 있어야 시험이 됩니다.\n");
  process.exit(1);
}
const [갑서비스, 을서비스] = 서비스들;

/** 서비스 둘을 받는 대상자 한 분. */
function 대상자만들기(이름: string) {
  const rid = crypto.randomUUID();
  db.run(`INSERT INTO recipient (id, payload, search_text, dong, status, created_at, updated_at)
          VALUES (?, ?, ?, '해남읍', '이용', ?, ?)`,
    [rid, JSON.stringify({ name: 이름 }), 이름, 이제, 이제]);
  for (const s of 서비스들)
    db.run(`INSERT INTO referral (batch_label, recipient_id, service_id,
                                  period_from, period_to, created_at)
            VALUES ('시험', ?, ?, '2026-01-01', '2026-12-31', ?)`, [rid, s.id, 이제]);
  치울것.push({ 표: "recipient", id: rid });
  return rid;
}

function 배정걸기(rid: string, serviceId: number) {
  db.run(`INSERT INTO assignment (recipient_id, worker_id, service_id,
                                  period_from, period_to, weekly_plan, planned_count, created_at)
          VALUES (?, ?, ?, '2026-01-01', '2026-12-31', '[]', 0, ?)`,
    [rid, 인력, serviceId, 이제]);
}

const 찾기 = (이름: string) =>
  (home().unassigned as any[]).find((x) => x.name === 이름);

try {

console.log("\n── 1. 둘 다 안 붙었으면 ────────────────────────────\n");
const 갑 = 대상자만들기("시험_아무것도안붙음");
{
  const 그분 = 찾기("시험_아무것도안붙음");
  맞아야("미배정 목록에 있음", !!그분);
  맞아야("서비스 둘 다 적힘", (그분?.services?.length ?? 0) === 2,
    JSON.stringify(그분?.services?.map((s: any) => s.name)));
}

console.log("\n── 2. ★ 둘 중 하나만 붙였으면 ──────────────────────\n");
const 을 = 대상자만들기("시험_하나만붙음");
배정걸기(을, 갑서비스.id);
{
  const 그분 = 찾기("시험_하나만붙음");
  맞아야(`★ 「${갑서비스.name}」만 붙였는데도 목록에 남아 있음`, !!그분,
    "사라졌다면 사람 단위로 세고 있는 것입니다");
  const 적힌 = (그분?.services ?? []).map((s: any) => s.name);
  맞아야(`★ 아직 안 붙은 「${을서비스.name}」만 적힘`,
    적힌.length === 1 && 적힌[0] === 을서비스.name, JSON.stringify(적힌));
  맞아야(`★ 이미 붙은 「${갑서비스.name}」은 안 적힘`, !적힌.includes(갑서비스.name));
}

console.log("\n── 3. 둘 다 붙였으면 빠져야 합니다 ─────────────────\n");
배정걸기(을, 을서비스.id);
맞아야("둘 다 붙으면 목록에서 빠짐", !찾기("시험_하나만붙음"));
맞아야("아무것도 안 붙은 분은 그대로 남아 있음", !!찾기("시험_아무것도안붙음"));

console.log("\n── 4. 끝난 배정은 붙은 것으로 안 칩니다 ────────────\n");
const 병 = 대상자만들기("시험_배정이끝남");
db.run(`INSERT INTO assignment (recipient_id, worker_id, service_id,
                                period_from, period_to, weekly_plan, planned_count, created_at)
        VALUES (?, ?, ?, '2026-01-01', '2026-01-31', '[]', 0, ?)`,
  [병, 인력, 갑서비스.id, 이제]);
{
  const 그분 = 찾기("시험_배정이끝남");
  맞아야("기간이 끝난 배정은 안 친다", !!그분);
  맞아야("그래서 서비스 둘 다 적힘", (그분?.services?.length ?? 0) === 2,
    JSON.stringify(그분?.services?.map((s: any) => s.name)));
}

} finally {
  for (const x of 치울것.reverse())
    try { db.run(`DELETE FROM ${x.표} WHERE id = ?`, [x.id]); } catch { }
  console.log(`\n  치움    시험용으로 만든 ${치울것.length}줄을 지웠습니다`);
}

console.log("\n" + "─".repeat(52));
console.log(`  통과 ${통과수} · 실패 ${실패수}`);
console.log("");
process.exit(실패수 ? 1 : 0);
