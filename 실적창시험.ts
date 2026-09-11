/**
 * 제공실적 창 시험 —  bun 실적창시험.ts
 *
 * ── 왜 이 시험이 생겼나 ─────────────────────────────────────
 *
 * 칸을 누르면 **창이 뜨고 그 안에서 고칩니다** (2026-09-05 무무 지시).
 * 예전처럼 눌러 돌면 「제공」을 보려다 「미제공」이 되어 실적이 틀어집니다.
 *
 * 그 창을 만들면서 **두 번 크게 넘어졌습니다.** 둘 다 여기서 막습니다.
 *
 *   ① 화면이 통째로 하얘졌습니다 (React #310).
 *      `열린칸` 의 useState 를 `if (!d) return …` **뒤에** 두었습니다.
 *      자료가 오기 전에는 갈고리가 여덟 개, 온 뒤에는 아홉 개가 되어
 *      리액트가 화면을 버렸습니다. 화면이 하얗게 되면 사무실은
 *      「프로그램이 죽었다」고 봅니다 — 가장 무서운 갈래의 잘못입니다.
 *
 *   ② 창은 떴는데 **속이 비었습니다.**
 *      현장앱에서 사진도 서명도 다 올라왔는데 창에는
 *      「현장앱에서 온 것이 없습니다」만 떴습니다.
 *      `record.ts` 가 칸에 `현장` 을 안 실어 보냈기 때문입니다.
 *      **화면이 있어도 자료가 안 실리면 없는 것과 같습니다.**
 */
import { db, initDb } from "./server/db";
initDb();
const { month } = await import("./server/record");

let 통과수 = 0, 실패수 = 0;
function 맞아야(무엇: string, 참인가: boolean, 곁 = "") {
  if (참인가) { 통과수++; console.log(`  통과  ${무엇}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${곁 ? "\n          " + 곁 : ""}`); }
}

const 이제 = new Date().toISOString();
const 날 = 이제.slice(0, 10);
const 달 = 날.slice(0, 7);
const 치울것: { 표: string; id: any }[] = [];

try {

// ── 시험 마당 ──────────────────────────────────────────────
const u = db.run(
  `INSERT INTO app_user (login_id, pw_hash, name, role, roles, status, created_at)
   VALUES (?, 'x', '시험인력_실적창', 'worker', '["worker"]', 'active', ?)`,
  [`실적창-${Date.now()}`, 이제]);
const uid = Number(u.lastInsertRowid);
치울것.push({ 표: "app_user", id: uid });
const w = db.run("INSERT INTO worker (user_id, created_at) VALUES (?, ?)", [uid, 이제]);
const wid = Number(w.lastInsertRowid);
치울것.push({ 표: "worker", id: wid });

const sv = db.query<{ id: number; name: string }, []>(
  "SELECT id, name FROM service WHERE record_type = 'time' LIMIT 1").get();
if (!sv) { console.error("\n  시간제 서비스가 있어야 시험이 됩니다.\n"); process.exit(1); }

const rid = crypto.randomUUID();
db.run(`INSERT INTO recipient (id, payload, search_text, dong, status, created_at, updated_at)
        VALUES (?, ?, ?, '해남읍', '이용', ?, ?)`,
  [rid, JSON.stringify({ name: "시험_실적창어르신" }), "시험_실적창어르신", 이제, 이제]);
치울것.push({ 표: "recipient", id: rid });
db.run(`INSERT INTO referral (batch_label, recipient_id, service_id, period_from, period_to, created_at)
        VALUES ('시험', ?, ?, '2026-01-01', '2026-12-31', ?)`, [rid, sv.id, 이제]);

const a = db.run(`INSERT INTO assignment (recipient_id, worker_id, service_id,
                    period_from, period_to, weekly_plan, planned_count, created_at)
                  VALUES (?, ?, ?, '2026-01-01', '2026-12-31', '[]', 0, ?)`,
  [rid, wid, sv.id, 이제]);
const aid = Number(a.lastInsertRowid);
치울것.push({ 표: "assignment", id: aid });

const 보고번호 = crypto.randomUUID();
const 현장 = {
  적은것: { 한것: ["청소", "세탁"], 기타: "약 봉투 정리", 특이사항: "무릎이 아프시다고 하셨습니다." },
  서명: "data:image/png;base64,iVBORw0KGgo=",
  서명받은때: `${날}T10:36:00.000Z`,
  갈래: "가사",
  표없이: false,
  보고번호,
  사진: [{ 파일: "가.jpg", 자리: `${달}/${보고번호}/가.jpg` }],
  고침: [`${날}T18:20:00.000Z`],
};
const d = db.run(
  `INSERT INTO delivery (assignment_id, recipient_id, service_id, served_on, actor_type, actor_id,
     start_at, end_at, qty, outcome, payload, verdict, planned, minutes, created_at)
   VALUES (?, ?, ?, ?, '제공인력', ?, ?, ?, 1, '제공', ?, '확인필요', 1, 90, ?)`,
  [aid, rid, sv.id, 날, wid,
   `${날}T09:05:00.000Z`, `${날}T10:35:00.000Z`, JSON.stringify({ 현장 }), 이제]);
치울것.push({ 표: "delivery", id: Number(d.lastInsertRowid) });

/** 그 배정의 그날 칸을 꺼냅니다. */
function 그칸() {
  const 표 = month(달, {}) as any;
  const 줄 = (표.items as any[]).find((x) => x.assignId === aid);
  return (줄?.cells ?? []).find((c: any) => c.on === 날);
}

console.log("\n── 1. ★ 칸이 현장 기록을 싣고 옵니다 ───────────────\n");
{
  const c = 그칸();
  맞아야("그날 칸이 있음", !!c);
  맞아야("★ 현장 기록이 실려 옴", !!c?.현장,
    "안 실리면 창은 뜨는데 「현장앱에서 온 것이 없습니다」만 뜹니다");
  맞아야("★ 시작·종료 시각이 실려 옴", !!c?.시작 && !!c?.종료,
    JSON.stringify({ 시작: c?.시작, 종료: c?.종료 }));
  맞아야("★ 판정이 실려 옴 (확인필요)", c?.판정 === "확인필요", String(c?.판정));
  맞아야("한 것이 그대로 옴", JSON.stringify(c?.현장?.적은것?.한것) === '["청소","세탁"]');
  맞아야("사진 한 장이 그대로 옴", (c?.현장?.사진 ?? []).length === 1);
  맞아야("사진 자리가 그대로 옴", c?.현장?.사진?.[0]?.자리 === `${달}/${보고번호}/가.jpg`);
  맞아야("서명이 그대로 옴", !!c?.현장?.서명);
  맞아야("고친 기록이 그대로 옴", (c?.현장?.고침 ?? []).length === 1);
}

console.log("\n── 2. 손으로 찍은 칸에는 현장이 없습니다 ───────────\n");
{
  const 어제 = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const d2 = db.run(
    `INSERT INTO delivery (assignment_id, recipient_id, service_id, served_on, actor_type, actor_id,
       qty, outcome, planned, created_at)
     VALUES (?, ?, ?, ?, '사무직원', ?, 1, '제공', 1, ?)`,
    [aid, rid, sv.id, 어제, wid, 이제]);
  치울것.push({ 표: "delivery", id: Number(d2.lastInsertRowid) });
  const 표 = month(달, {}) as any;
  const 줄 = (표.items as any[]).find((x) => x.assignId === aid);
  const c = (줄?.cells ?? []).find((x: any) => x.on === 어제);
  맞아야("어제 칸이 있음", !!c);
  맞아야("현장은 null (사무실이 손으로 찍음)", c?.현장 === null, JSON.stringify(c?.현장));
  맞아야("그래도 화면이 안 죽음 — 시작·종료는 null", c?.시작 === null && c?.종료 === null);
}

console.log("\n── 3. 망가진 payload 가 섞여도 죽지 않습니다 ───────\n");
{
  db.run("UPDATE delivery SET payload = ? WHERE assignment_id = ? AND served_on = ?",
    ["{이건 짐이 아닙니다", aid, 날]);
  let 죽었나 = false;
  let c: any = null;
  try { c = 그칸(); } catch { 죽었나 = true; }
  맞아야("★ 망가진 짐에도 표가 나옴", !죽었나,
    "옛 자료가 섞여 있어도 제공실적 화면 전체가 안 열리면 안 됩니다");
  맞아야("망가진 짐은 현장 null 로", c?.현장 === null);
  db.run("UPDATE delivery SET payload = ? WHERE assignment_id = ? AND served_on = ?",
    [JSON.stringify({ 현장 }), aid, 날]);
}

console.log("\n── 4. ★ 갈고리는 이른 return 앞에 있어야 합니다 ────\n");
{
  /*
   * 리액트의 갈고리(useState·useEffect·useMemo…)는 **그릴 때마다 같은 수**로
   * 불려야 합니다. `if (!d) return …` 뒤에 갈고리를 두면 자료가 오는 순간
   * 수가 달라지고, 리액트는 화면을 통째로 버립니다 (#310).
   *
   * 눈으로는 안 보입니다 — 자료가 오기 전 한 번은 멀쩡히 그려지기 때문입니다.
   * 그래서 **글자를 읽어서** 막습니다.
   */
  const 글 = await Bun.file("web/src/pages/Records.tsx").text();
  const 줄들 = 글.split("\n");
  const 이른return = 줄들.findIndex((L) => /^\s+if \(!d\) return /.test(L));
  맞아야("Records 에 이른 return 이 있음", 이른return >= 0);

  const 늦은갈고리: string[] = [];
  for (let i = 이른return + 1; i < 줄들.length; i++)
    if (/(^|[^A-Za-z가-힣])use(State|Effect|Memo|Callback|Ref|Reducer|Context)\s*[(<]/.test(줄들[i]))
      늦은갈고리.push(`${i + 1}줄: ${줄들[i].trim().slice(0, 60)}`);

  맞아야("★ 이른 return 뒤에 갈고리가 없음", 늦은갈고리.length === 0,
    늦은갈고리.join("\n          ") || undefined);
}

console.log("\n── 5. 창이 쓰는 값들이 정말 있습니다 ───────────────\n");
{
  /*
   * 창은 `c.현장.적은것.…` 처럼 깊이 들어가 읽습니다.
   * 이름이 하나만 어긋나도 그 줄만 조용히 사라집니다 — 오류도 안 납니다.
   * 그래서 창이 읽는 이름을 여기서 한 번 더 맞춰 둡니다.
   */
  const 창글 = await Bun.file("web/src/pages/실적창.tsx").text();
  for (const 이름 of ["적은것", "특이사항", "서명받은때", "표없이", "고침", "사진"])
    맞아야(`창이 「${이름}」 을 읽음`, 창글.includes(이름));
  맞아야("창이 사진을 /api/photo 로 부름", 창글.includes("/api/photo/"));
  맞아야("★ 토요일을 「공휴일」이라 안 부름",
    !/'\s*·\s*공휴일'/.test(창글.replace(/휴일말[\s\S]*?\n}/, "")),
    "달력은 토·일과 공휴일을 한 덩어리로 다루지만, 화면에 그렇게 적으면 안 됩니다");
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
