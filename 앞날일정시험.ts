/**
 * 앞날 일정 시험 —  bun 앞날일정시험.ts
 *
 * ── 무엇을 보나 ────────────────────────────────────────────
 *
 * 폰이 「이번 주」·「이번 달」을 보려면 **사무실이 그만큼 올려야** 합니다.
 * 지금까지는 오늘치만 올라가서, 폰에 앞날 화면을 붙여도 빈 화면이었습니다.
 *
 *   1. ★ 오늘부터 **이번 달 말까지** 올리는가
 *   2. ★ 말일이 가까우면 **14일까지 늘리는가**
 *      (9월 28일에 「이번 달」이 사흘뿐이면 다음 주가 안 보입니다)
 *   3. ★ **지난 날은 안 올리는가** — 다녀온 집 주소를 폰이 들고 있을
 *      까닭이 없습니다
 *   4. 올린 범위에서 **없어진 일정을 치우는가**
 *      (배정을 지웠는데 폰에 남으면 멈춘 집에 사람이 갑니다)
 *   5. 요일이 안 맞는 날은 안 올라가는가
 */
import { randomUUID } from "node:crypto";
import { db, initDb } from "./server/db";
import { 보낼범위, 그날갈곳, 며칠치 } from "./server/할일보내기";
initDb();

let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: unknown, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}

const 사람 = randomUUID();
const 지울서비스: number[] = [];
const 지울배정: number[] = [];
let 만든사람: number | null = null;
let 만든인력: number | null = null;

try {
  // ══ 1. 범위 셈 ══════════════════════════════════════════
  console.log("\n── 1. 며칠치를 올리나 ★ ────────────────────────────\n");
  {
    // 달 한가운데 — 말일까지
    const a = 보낼범위("2026-09-05");
    본다("★ 오늘부터 시작한다", a.첫날 === "2026-09-05", a.첫날);
    본다("★ 이번 달 말일까지 간다", a.끝날 === "2026-09-30", a.끝날);

    /*
     * ★ 말일이 가까우면 늘립니다. 9월 28일에 「이번 달」을 보면
     *   사흘치뿐인데, 그때가 다음 주 일정이 제일 궁금한 때입니다.
     */
    const b = 보낼범위("2026-09-28");
    본다("★ 말일이 가까우면 14일까지 늘린다", b.끝날 === "2026-10-11",
      `${b.첫날} ~ ${b.끝날} (${며칠치}일 보장)`);

    // 달 마지막 날
    const c = 보낼범위("2026-09-30");
    본다("말일에도 앞이 보인다", c.끝날 === "2026-10-13", `${c.첫날} ~ ${c.끝날}`);

    // 2월 같은 짧은 달
    const d = 보낼범위("2026-02-20");
    본다("짧은 달에서도 14일은 채운다", d.끝날 === "2026-03-05", `${d.첫날} ~ ${d.끝날}`);

    // 윤달 없는 해의 2월 말
    const e = 보낼범위("2026-12-25");
    본다("연말에도 해를 넘겨 채운다", e.끝날 === "2027-01-07", `${e.첫날} ~ ${e.끝날}`);
  }

  // ══ 2. 실제로 그 범위가 나오나 ═══════════════════════════
  console.log("\n── 2. 그 범위에 진짜 일정이 나오나 ────────────────\n");

  const 프로필: any = db.query(
    `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`).get();
  if (!프로필) throw new Error("기관이 없습니다. 통돌 Note 를 한 번 켜 주세요.");

  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at)
          VALUES (?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: "앞날시험" }), "해남읍", "이용", "2026-01-01", "x"]);

  const u = db.run(
    `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload, created_at)
     VALUES ('앞날인력', ?, 'x', 'worker', '["worker"]', 'active', '{}', 'x')`,
    [`t-${randomUUID().slice(0, 8)}`]);
  만든사람 = Number(u.lastInsertRowid);
  const k = db.run(
    `INSERT INTO worker (user_id, hired_on, created_at) VALUES (?,?,'x')`,
    [만든사람, "2026-01-01"]);
  만든인력 = Number(k.lastInsertRowid);
  // 우편함 번호가 있어야 그날갈곳 이 냅니다 (등록된 기기만 보냅니다).
  db.run("UPDATE app_user SET mailbox_worker_id = ? WHERE id = ?",
    [randomUUID(), 만든사람]);

  const i = db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','가사지원','가사지원','앞날시험서비스','hour',24000,NULL,'time',NULL,0,0,0,0,910,1,1)`,
    [프로필.id, `UFWD-${randomUUID().slice(0, 6)}`]);
  const 서비스 = Number(i.lastInsertRowid); 지울서비스.push(서비스);

  /*
   * ★ **월·수요일만** 배정합니다. 그래야 「요일이 안 맞는 날은
   *   안 올라간다」를 볼 수 있습니다. 모든 요일로 두면 무엇이든 통과합니다.
   */
  const a2 = db.run(
    `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
     VALUES (?,?,?,?,?,'x')`,
    [사람, 서비스, 만든인력, JSON.stringify([{ dow: 1 }, { dow: 3 }]), "2026-01-01"]);
  지울배정.push(Number(a2.lastInsertRowid));

  {
    const 오늘 = new Date().toISOString().slice(0, 10);
    const { 첫날, 끝날 } = 보낼범위(오늘);

    // 그 범위를 하루씩 훑어 봅니다 (할일보내기 가 하는 것과 같은 셈).
    const 나온날: string[] = [];
    for (let d = new Date(`${첫날}T00:00:00`);
         d <= new Date(`${끝날}T00:00:00`);
         d = new Date(d.getTime() + 86400_000)) {
      const 하루 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-` +
                   `${String(d.getDate()).padStart(2, "0")}`;
      if (그날갈곳(하루).some((j) => j.사람 === "앞날시험")) 나온날.push(하루);
    }

    본다("★ 앞날에도 일정이 나온다", 나온날.length >= 2, `${나온날.length}일`);
    본다("★ 월·수요일만 나온다",
      나온날.every((x) => [1, 3].includes(new Date(`${x}T00:00:00`).getDay())),
      나온날.slice(0, 5).map((x) =>
        `${x}(${["일","월","화","수","목","금","토"][new Date(`${x}T00:00:00`).getDay()]})`).join(" "));

    /*
     * ★ 지난 날은 안 옵니다 — 사무실이 오늘부터만 올리기 때문입니다.
     *   다녀온 집의 주소를 폰이 계속 들고 있을 까닭이 없습니다.
     */
    본다("★ 지난 날은 범위에 안 들어간다", 나온날.every((x) => x >= 오늘),
      `첫날 ${나온날[0] ?? "(없음)"} · 오늘 ${오늘}`);

    // 어제를 따로 물어보면 배정은 있지만 **올릴 범위 밖**입니다.
    const 어제 = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
    본다("어제는 범위 밖이다", 어제 < 첫날, `${어제} < ${첫날}`);
  }

  // ══ 3. 기간이 끝난 배정 ══════════════════════════════════
  console.log("\n── 3. 기간이 끝나면 ────────────────────────────────\n");
  {
    /*
     * 배정 기간을 어제까지로 줄이면, 앞날에는 한 곳도 안 나와야 합니다.
     * 이것이 안 되면 **끝난 계약의 집이 폰에 계속 뜹니다.**
     */
    const 어제 = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
    db.run("UPDATE assignment SET period_to = ? WHERE id = ?", [어제, 지울배정[0]]);

    const { 첫날, 끝날 } = 보낼범위();
    let 남은것 = 0;
    for (let d = new Date(`${첫날}T00:00:00`);
         d <= new Date(`${끝날}T00:00:00`);
         d = new Date(d.getTime() + 86400_000)) {
      const 하루 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-` +
                   `${String(d.getDate()).padStart(2, "0")}`;
      if (그날갈곳(하루).some((j) => j.사람 === "앞날시험")) 남은것++;
    }
    본다("★ 기간이 끝나면 앞날에 한 곳도 안 나온다", 남은것 === 0,
      `${남은것}곳 — 끝난 계약의 집이 폰에 뜨면 안 됩니다`);
  }

  console.log("\n── 4. 대상자가 중단되면 ────────────────────────────\n");
  {
    db.run("UPDATE assignment SET period_to = NULL WHERE id = ?", [지울배정[0]]);
    db.run("UPDATE recipient SET status = '중단' WHERE id = ?", [사람]);

    const { 첫날, 끝날 } = 보낼범위();
    let 남은것 = 0;
    for (let d = new Date(`${첫날}T00:00:00`);
         d <= new Date(`${끝날}T00:00:00`);
         d = new Date(d.getTime() + 86400_000)) {
      const 하루 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-` +
                   `${String(d.getDate()).padStart(2, "0")}`;
      if (그날갈곳(하루).some((j) => j.사람 === "앞날시험")) 남은것++;
    }
    본다("★ 중단하면 앞날에서도 사라진다", 남은것 === 0,
      `${남은것}곳 — 멈춘 집에 사람이 가면 안 됩니다`);
    db.run("UPDATE recipient SET status = '이용' WHERE id = ?", [사람]);
  }

} catch (e: any) {
  실패수++;
  console.log(`\n✗ 실패  시험 도중 터짐 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 4).join("\n"));
} finally {
  db.run("DELETE FROM delivery WHERE recipient_id = ?", [사람]);
  for (const id of 지울배정) db.run("DELETE FROM assignment WHERE id = ?", [id]);
  db.run("DELETE FROM recipient WHERE id = ?", [사람]);
  for (const id of 지울서비스) db.run("DELETE FROM service WHERE id = ?", [id]);
  try {
    if (만든인력) db.run("DELETE FROM worker WHERE id = ?", [만든인력]);
    if (만든사람) db.run("DELETE FROM app_user WHERE id = ?", [만든사람]);
  } catch { }
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
