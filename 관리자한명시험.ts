/**
 * 관리자는 한 명뿐 —  bun 관리자한명시험.ts
 *
 * ═══════════════════════════════════════════════════════════
 *  왜 이 시험이 있나
 * ═══════════════════════════════════════════════════════════
 *
 * (2026-09-08 무무 — 「관리자는 현재는 1명으로 제한 해야해. 추후에
 *  관리자를 추가하는 경우엔 **PC 백업 문제 등 얽히는 문제들**이 다수
 *  발생할 여지가 있어서 제한 하는게 맞을 것 같아.」)
 *
 * 이 프로그램의 자료는 **그 PC 한 대**에 있습니다. 관리자가 둘이면 백업을
 * 각자 다른 곳에 뜨고, USB 를 각자 들고 다니고, 둘 다 「내가 마지막에 적은
 * 것이 맞다」고 여깁니다. 그 순간 **어느 자료함이 진짜인지 아무도
 * 모릅니다.**
 *
 * ── ★ 여기서 제일 무서운 것 ★ ──────────────────────────────
 *
 * 「둘이 되는 것」보다 **「0 명이 되는 것」이 더 위험합니다.** 관리자가
 * 없으면 계정을 만들 수도, 설정을 고칠 수도 없습니다. **기관이 통째로
 * 잠깁니다.** 그래서 천장(한 명까지)과 바닥(한 명은 있어야)을 **같이**
 * 시험합니다. 하나만 있으면 반드시 어느 날 잠깁니다.
 */
import { db, initDb } from "./server/db";
initDb();
import {
  createStaff, updateStaff, resign, restore, startLeave,
  관리자넘기기, 관리자들, parseRoles,
} from "./server/staff";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: unknown, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}
async function 던지나(무엇: string, 한다: () => any, 말조각 = "") {
  try {
    await 한다();
    실패수++; console.log(`✗ 실패  ${무엇}  — 막지 않고 그냥 됐습니다`);
  } catch (e) {
    const 말 = e instanceof Error ? e.message : String(e);
    if (말조각 && !말.includes(말조각)) {
      실패수++; console.log(`✗ 실패  ${무엇}  — 다른 까닭으로 막혔습니다: ${말}`);
    } else { 통과수++; console.log(`  통과  ${무엇}  — ${말.split("\n")[0]}`); }
  }
}

const 꼬리 = randomUUID().slice(0, 6);
const 치울것: number[] = [];
const 역할 = (id: number) =>
  parseRoles(db.query<any, [number]>("SELECT roles, role FROM app_user WHERE id = ?").get(id)?.roles);

/*
 * 시험을 돌리는 자료함에는 **이미 관리자가 있습니다**(기관을 개설할 때
 * 만들어집니다). 그 사람을 건드리지 않고, 옆에 시험용 사람만 붙였다 뗍니다.
 */
const 원래관리자 = 관리자들();
console.log("\n  관리자 한 명 시험");
console.log("  ═══════════════════════════════════════════════════\n");
본다("시작할 때 관리자는 정확히 한 명이다",
  원래관리자.length === 1, 원래관리자.map((a) => a.name).join(", ") || "(없음)");
if (원래관리자.length !== 1) {
  console.log("\n  ★ 관리자가 한 명이 아니라 나머지를 못 봅니다. 자료함을 먼저 보세요.\n");
  process.exit(1);
}
const 지금관리자 = 원래관리자[0];

/*
 * ★ **시험이 자료함을 망가뜨리면 안 됩니다.**
 *
 * 이 시험은 진짜 관리자를 상대로 「내려놓기·계약종료·휴직」을 눌러 봅니다.
 * 막히는지 보려는 것인데, **막히지 않으면 그 사람이 정말 잘립니다.**
 * 처음 짤 때 그 일이 실제로 났습니다 — 관리자가 계약종료되고 역할이
 * 사무직원으로 바뀐 채 남았습니다. 그래서 무슨 일이 있어도 돌려놓습니다.
 */
const 원래모습 = db.query<any, [number]>(
  "SELECT role, roles, status, resigned_at, leave_from, leave_to, leave_reason FROM app_user WHERE id = ?"
).get(지금관리자.id);
function 되돌리기() {
  db.run(
    `UPDATE app_user SET role = ?, roles = ?, status = ?, resigned_at = ?,
            leave_from = ?, leave_to = ?, leave_reason = ? WHERE id = ?`,
    [원래모습.role, 원래모습.roles, 원래모습.status, 원래모습.resigned_at ?? null,
     원래모습.leave_from ?? null, 원래모습.leave_to ?? null, 원래모습.leave_reason ?? null,
     지금관리자.id]
  );
}

try {
  // ═══ ① 천장 — 두 번째 관리자를 못 만듭니다 ═══════════════
  console.log("\n  ① 천장 — 두 번째 관리자를 못 만듭니다");
  await 던지나("★ 관리자로 새 사람을 못 만든다",
    () => createStaff({ name: `시험관리자${꼬리}`, loginId: `t-a-${꼬리}`,
      password: "시험1234", roles: ["admin"] } as any),
    "관리자는 한 명뿐입니다");

  await 던지나("★ 관리자를 겸하게도 못 만든다 (제공인력+관리자)",
    () => createStaff({ name: `시험겸직${꼬리}`, loginId: `t-b-${꼬리}`,
      password: "시험1234", roles: ["worker", "admin"] } as any),
    "관리자는 한 명뿐입니다");

  본다("막힌 뒤에도 관리자는 여전히 한 명이다", 관리자들().length === 1);

  // ═══ ② 천장 — 있던 사람을 관리자로 못 올립니다 ═══════════
  console.log("\n  ② 천장 — 있던 사람을 관리자로 못 올립니다");
  const 사무 = await createStaff({ name: `시험사무${꼬리}`, loginId: `t-c-${꼬리}`,
    password: "시험1234", roles: ["staff"] } as any);
  치울것.push(사무);
  본다("사무직원은 만들어진다", 역할(사무).includes("staff"));

  await 던지나("★ 사무직원을 관리자로 못 올린다",
    () => updateStaff(사무, { roles: ["admin"] } as any),
    "관리자는 한 명뿐입니다");
  본다("막힌 뒤 그 사람 역할이 안 바뀌었다",
    !역할(사무).includes("admin"), 역할(사무).join(","));

  await 던지나("★ 관리자를 덧붙이는 것도 못 한다",
    () => updateStaff(사무, { roles: ["staff", "admin"] } as any),
    "관리자는 한 명뿐입니다");

  // 관리자 아닌 값으로 고치는 것은 그대로 됩니다 — 막는 것이 지나치면 안 됩니다.
  await updateStaff(사무, { roles: ["staff", "worker"] } as any);
  본다("관리자가 아닌 역할 바꾸기는 그대로 된다",
    역할(사무).includes("worker") && !역할(사무).includes("admin"), 역할(사무).join(","));

  // ═══ ③ 바닥 — 마지막 관리자를 못 내려놓습니다 ════════════
  console.log("\n  ③ 바닥 — 0 명이 되는 길을 다 막습니다");
  await 던지나("★★ 마지막 관리자의 역할을 못 뺀다",
    () => updateStaff(지금관리자.id, { roles: ["staff"] } as any),
    "한 명은 있어야");
  await 던지나("★★ 마지막 관리자를 계약종료 못 시킨다",
    () => resign(지금관리자.id),
    "한 명은 있어야");
  await 던지나("★★ 마지막 관리자를 휴직 못 시킨다",
    () => startLeave(지금관리자.id, { from: "2026-10-01", to: "2026-10-31", reason: "시험" }),
    "한 명은 있어야");
  본다("세 번 막힌 뒤에도 관리자는 한 명이다", 관리자들().length === 1);
  본다("그 관리자는 여전히 다니고 있다",
    db.query<any, [number]>("SELECT status FROM app_user WHERE id = ?")
      .get(지금관리자.id)?.status === "active");

  // ═══ ④ 넘기기 — 한 번에, 0 명도 2 명도 안 거칩니다 ═══════
  console.log("\n  ④ 넘기기 — 한 번에 넘어갑니다");
  await 던지나("자기 자신에게는 못 넘긴다",
    () => 관리자넘기기(지금관리자.id, 지금관리자.id), "자기 자신");
  await 던지나("관리자가 아닌 사람은 못 넘긴다",
    () => 관리자넘기기(사무, 지금관리자.id), "관리자만");

  const 넘김 = 관리자넘기기(지금관리자.id, 사무);
  본다("★ 넘기면 받은 사람이 관리자가 된다", 역할(사무).includes("admin"), 역할(사무).join(","));
  본다("★ 넘긴 사람은 관리자가 아니게 된다",
    !역할(지금관리자.id).includes("admin"), 역할(지금관리자.id).join(","));
  본다("★★ 넘긴 뒤에도 관리자는 **정확히 한 명**이다",
    관리자들().length === 1, 관리자들().map((a) => a.name).join(","));
  본다("★ 넘긴 사람은 사무직원으로 남는다 (화면에서 쫓겨나지 않게)",
    역할(지금관리자.id).includes("staff"), 역할(지금관리자.id).join(","));
  본다("넘긴 결과를 말로 돌려준다", !!넘김.준이 && !!넘김.받은이,
    `${넘김.준이} → ${넘김.받은이}`);

  // 이제 새 관리자가 마지막 한 명입니다. 바닥이 다시 지켜지는지.
  await 던지나("★★ 넘겨받은 사람도 마지막 한 명이라 못 내려놓는다",
    () => resign(사무), "한 명은 있어야");

  // 되돌려 놓습니다.
  관리자넘기기(사무, 지금관리자.id);
  본다("도로 넘기면 처음 관리자로 돌아온다",
    역할(지금관리자.id).includes("admin") && 관리자들().length === 1);

  // ═══ ⑤ 되살리기 — 옛 관리자가 살아 돌아와도 둘이 안 됩니다 ═
  console.log("\n  ⑤ 계약종료된 옛 관리자가 돌아와도");
  const 옛 = await createStaff({ name: `시험옛${꼬리}`, loginId: `t-d-${꼬리}`,
    password: "시험1234", roles: ["staff"] } as any);
  치울것.push(옛);
  // 관리자를 그 사람에게 넘겼다가, 다시 받아 오고, 그 사람을 계약종료시킵니다.
  관리자넘기기(지금관리자.id, 옛);
  관리자넘기기(옛, 지금관리자.id);
  resign(옛);
  본다("계약종료된 사람은 관리자 수에 안 들어간다", 관리자들().length === 1);
  restore(옛);
  본다("★★ 되살려도 관리자는 한 명이다 (되살아난 사람이 관리자를 안 물고 옴)",
    관리자들().length === 1, 관리자들().map((a) => a.name).join(","));

  // ═══ ⑥ 세는 법은 하나 ════════════════════════════════════
  /*
   * ★★ **이 대목이 실제로 뚫렸습니다** (2026-09-08).
   *
   *   관리자를 세는 길이 둘이었습니다 —
   *     · `parseRoles(...)` 로 세는 길 (관리자들)
   *     · SQL 의 `roles LIKE '%admin%'` 로 세는 길
   *
   *   자료함에 `roles` 가 `'"admin"'`(따옴표까지 저장된) 줄이 하나
   *   있었는데, 앞쪽은 **사무직원**으로 읽고 뒤쪽은 **관리자**로 셌습니다.
   *   그래서 「관리자가 한 명은 있어야 합니다」가 **2 명으로 알고 통과**,
   *   마지막 관리자가 계약종료되었습니다.
   *
   *   그래서 세는 법을 하나로 합쳤고, 여기서 **두 길이 같은 답을 내는지**
   *   봅니다. 나중에 누가 SQL 로 세는 길을 다시 만들면 여기서 웁니다.
   */
  console.log("\n  ⑥ 관리자를 세는 법은 하나뿐");
  본다("★★ 따옴표까지 저장된 홑 이름도 관리자로 읽는다",
    parseRoles('"admin"').includes("admin"), parseRoles('"admin"').join(","));
  본다("맨 글자 홑 이름도 관리자로 읽는다 (옛 자료함)",
    parseRoles("admin").includes("admin"));
  본다("배열은 그대로 읽는다", parseRoles('["worker","admin"]').includes("admin"));
  본다("아무것도 아니면 사무직원으로 (권한이 저절로 오르지 않게)",
    parseRoles("뭔가이상한것").join(",") === "staff");

  const 셈A = 관리자들().length;
  const 셈B = Number(db.query<any, []>(
    `SELECT COUNT(*) c FROM app_user
      WHERE status = 'active' AND (role = 'admin' OR roles LIKE '%admin%')`).get()?.c ?? -1);
  본다("★★ 두 가지 세는 법이 같은 답을 낸다", 셈A === 셈B, `parseRoles ${셈A} · SQL ${셈B}`);

  본다("★ 코드에 SQL 로 관리자를 세는 자리가 남아 있지 않다",
    !readFileSync("server/staff.ts", "utf8").includes("roles LIKE '%admin%'\"") &&
    (readFileSync("server/staff.ts", "utf8").match(/COUNT\(\*\)[^\n]*admin/g) ?? []).length === 0,
    "세는 자리가 둘이 되면 언젠가 서로 다른 답을 냅니다");

} catch (e) {
  /*
   * 여기까지 오면 **시험이 예상 못 한 데서 터진 것**입니다. 그대로 두면
   * 요약도 못 찍고 뒷정리도 반만 됩니다. 실패로 세고 마저 갑니다.
   */
  실패수++;
  console.log(`✗ 실패  시험 도중 터짐 — ${e instanceof Error ? e.message.split("\n")[0] : e}`);
} finally {
  되돌리기();                      // 무슨 일이 있어도 관리자를 원래대로
  /*
   * ★ **막혔어야 할 것이 안 막히면 사람이 하나 더 생깁니다.**
   *   그 사람은 `치울것` 에 안 담깁니다 — 담는 줄이 안 돌았으니까요.
   *   그래서 id 로 지우는 것에 더해 **이번 판에서 쓴 아이디를 통째로**
   *   지웁니다. 안 그러면 시험이 한 번 깨진 뒤로 **영영 못 돌아갑니다**
   *   (실제로 변이 시험 중에 그렇게 됐습니다).
   */
  db.run(`DELETE FROM worker WHERE user_id IN
            (SELECT id FROM app_user WHERE login_id LIKE ?)`, [`t-%-${꼬리}`]);
  db.run(`DELETE FROM session WHERE user_id IN
            (SELECT id FROM app_user WHERE login_id LIKE ?)`, [`t-%-${꼬리}`]);
  db.run("DELETE FROM app_user WHERE login_id LIKE ?", [`t-%-${꼬리}`]);
  for (const id of 치울것) {
    db.run("DELETE FROM worker WHERE user_id = ?", [id]);
    db.run("DELETE FROM session WHERE user_id = ?", [id]);
    db.run("DELETE FROM app_user WHERE id = ?", [id]);
  }
  const 끝 = 관리자들();
  본다("치우고 나서도 관리자는 한 명이다", 끝.length === 1, 끝.map((a) => a.name).join(","));
  본다("★ 시험이 관리자를 원래대로 돌려놓았다",
    끝.length === 1 && 끝[0].id === 지금관리자.id &&
    db.query<any, [number]>("SELECT status FROM app_user WHERE id = ?")
      .get(지금관리자.id)?.status === 원래모습.status,
    `${끝[0]?.name} · ${원래모습.status}`);
}

console.log("\n  ═══════════════════════════════════════════════════");
console.log(`  통과 ${통과수} · 실패 ${실패수}\n`);
process.exit(실패수 ? 1 : 0);
