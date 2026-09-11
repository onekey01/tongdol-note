/**
 * ── 단계 5 시험 — 포스트잇 · 휴직 · 배정 메모 ──────────────────
 *
 * 두 가지를 다 봅니다.
 *   **되어야 하는 것이 되는가** (통과해야)
 *   **막아야 하는 것이 막히는가** (막혀야)
 *
 * 두 번째가 더 중요합니다. 되는 것은 눈에 보이지만 안 막히는 것은
 * 사고가 난 뒤에야 보입니다.
 *
 * 시험이 끝나면 넣었던 자료를 전부 치웁니다.
 */
import { randomUUID } from "node:crypto";
import { initDb, db } from "./server/db";
import { createStaff, listStaff, startLeave, endLeave, resign, isOnLeave } from "./server/staff";
import {
  listStickies, addSticky, updateSticky, setDone, removeSticky, stickyCounts,
  placeSticky, 자리규칙, 대상자보드요약,
} from "./server/sticky";
import { listAssign, saveAssign, workerOptions } from "./server/assign";
import { today, addDays } from "./server/util";

initDb();

let 실패 = 0;
const 확인 = (이름: string, 참인가: boolean, 덧 = "") => {
  console.log(`  ${참인가 ? "★" : "✕"} ${이름}${덧 ? " — " + 덧 : ""}`);
  if (!참인가) 실패 += 1;
};

/** 되어야 하는 일. 예외가 나면 실패입니다. */
function 통과해야<T>(이름: string, 하기: () => T): T | undefined {
  try {
    const r = 하기();
    확인(이름, true);
    return r;
  } catch (e: any) {
    확인(이름, false, e.message);
    return undefined;
  }
}

/** 막혀야 하는 일. 예외가 **안** 나면 실패입니다. */
function 막혀야(이름: string, 하기: () => unknown, 말에담길것?: string) {
  try {
    하기();
    확인(이름, false, "막히지 않고 그냥 됐습니다");
  } catch (e: any) {
    const ok = !말에담길것 || String(e.message).includes(말에담길것);
    확인(이름, ok, ok ? `막힘: ${e.message}` : `막히긴 했는데 말이 다름: ${e.message}`);
  }
}

const 관리자 = { id: 0, name: "시험관리자", roles: '["admin"]' };
const 사무원 = { id: 0, name: "시험사무원", roles: '["staff"]' };
const 치울것: { users: number[]; recipients: string[]; stickies: number[] } =
  { users: [], recipients: [], stickies: [] };

async function 사람만들기(이름: string, 아이디: string, 역할: string[]) {
  const id = await createStaff({ name: 이름, loginId: 아이디, password: "1234", roles: 역할 });
  치울것.users.push(id);
  return id;
}

function 대상자만들기(이름: string, 메모 = "") {
  const id = randomUUID();
  db.run(
    `INSERT INTO recipient (id, payload, dong, status, memo, created_at, updated_at)
     VALUES (?, ?, ?, '이용', ?, ?, ?)`,
    [id, JSON.stringify({ name: 이름, birth: "1940-01-01" }), "해남읍", 메모,
     today(), today()]
  );
  치울것.recipients.push(id);
  return id;
}

try {
  // ── 준비 ──────────────────────────────────────────────
  const 원래관리자수 = db.query<{ c: number }, []>(
    "SELECT COUNT(*) AS c FROM app_user WHERE status = 'active' AND roles LIKE '%admin%'"
  ).get()?.c ?? 0;

  관리자.id = await 사람만들기("시험관리자", `t_admin_${Date.now()}`, ["admin"]);
  사무원.id = await 사람만들기("시험사무원", `t_staff_${Date.now()}`, ["staff"]);
  const 돌봄id = await 사람만들기("시험돌봄", `t_worker_${Date.now()}`, ["worker"]);

  console.log("\n■ 1. 포스트잇 — 되어야 하는 것");

  const s1 = 통과해야("붙이기", () => addSticky({ text: "김순자 어르신 목요일 병원" }, 관리자));
  if (s1) 치울것.stickies.push(s1.id);
  const s2 = 통과해야("기한 있는 것 붙이기", () =>
    addSticky({ text: "군청에 8월 명단 문의", dueOn: addDays(today(), 3), color: "pink" }, 사무원));
  if (s2) 치울것.stickies.push(s2.id);
  const s3 = 통과해야("꽂아 두기(pinned)", () =>
    addSticky({ text: "사무실 열쇠는 서랍 둘째 칸", pinned: true, color: "blue" }, 관리자));
  if (s3) 치울것.stickies.push(s3.id);

  {
    const 목록 = listStickies();
    const 내것 = 목록.filter((x) => 치울것.stickies.includes(x.id));
    확인("붙인 것이 목록에 다 있음", 내것.length === 3, `${내것.length}장`);
    확인("꽂아 둔 것이 맨 위", 내것[0]?.id === s3?.id, `맨 위: 「${내것[0]?.text}」`);
    확인("붙인 사람 이름이 남음",
      내것.some((x) => x.author === "시험사무원"), 내것.map((x) => x.author).join(","));
  }

  console.log("\n■ 2. 포스트잇 — 막아야 하는 것");
  막혀야("빈 메모", () => addSticky({ text: "   " }, 관리자), "내용을 적어");
  막혀야("500자 넘는 메모", () => addSticky({ text: "가".repeat(501) }, 관리자), "500자");
  막혀야("날짜가 아닌 기한", () => addSticky({ text: "ㅇ", dueOn: "내일" }, 관리자), "날짜로");
  막혀야("없는 대상자에 붙이기",
    () => addSticky({ text: "ㅇ", recipientId: randomUUID() }, 관리자), "찾을 수 없");
  막혀야("남이 붙인 것을 사무원이 고치기",
    () => updateSticky(s1!.id, { text: "몰래 고침" }, 사무원), "관리자만");
  막혀야("남이 붙인 것을 사무원이 떼기",
    () => setDone(s1!.id, true, 사무원), "관리자만");
  막혀야("없는 메모 고치기", () => updateSticky(999999, { text: "ㅇ" }, 관리자), "찾을 수 없");

  console.log("\n■ 3. 포스트잇 — 고치기·떼기");
  통과해야("붙인 사람이 자기 것 고치기", () => updateSticky(s2!.id, { text: "군청 박주무관 통화함" }, 사무원));
  통과해야("관리자는 남의 것도 고칠 수 있음", () => updateSticky(s2!.id, { color: "green" }, 관리자));
  {
    const x = listStickies().find((v) => v.id === s2!.id)!;
    확인("색만 바꿨는데 글이 안 지워짐", x.text === "군청 박주무관 통화함", `「${x.text}」`);
    확인("색이 바뀜", x.color === "green", x.color);
  }

  통과해야("떼기", () => setDone(s1!.id, true, 관리자));
  {
    const 붙은것 = listStickies();
    확인("뗀 것은 기본 목록에서 빠짐", !붙은것.some((x) => x.id === s1!.id));
    const 전부 = listStickies({ done: true });
    const 뗀것 = 전부.find((x) => x.id === s1!.id);
    확인("뗀 것도 지워지지 않고 남음", !!뗀것 && 뗀것.done, 뗀것?.doneAt ?? "");
    확인("뗀 것은 맨 아래", 전부[전부.length - 1]?.done === true);
  }
  통과해야("다시 붙이기", () => setDone(s1!.id, false, 관리자));
  확인("다시 붙으면 목록에 돌아옴", listStickies().some((x) => x.id === s1!.id));

  console.log("\n■ 4. 포스트잇 — 기한 지난 것");
  const s4 = addSticky({ text: "어제까지 했어야 하는 일", dueOn: addDays(today(), -1) }, 관리자);
  치울것.stickies.push(s4.id);
  {
    const x = listStickies().find((v) => v.id === s4.id)!;
    확인("기한 지난 것에 표가 붙음", x.overdue === true);
    const 앞쪽 = listStickies().filter((v) => !v.pinned)[0];
    확인("기한 지난 것이 앞으로 옴", 앞쪽?.id === s4.id, `맨 앞: 「${앞쪽?.text}」`);
    확인("숫자 세기", stickyCounts().open >= 4 && stickyCounts().overdue >= 1,
         JSON.stringify(stickyCounts()));
  }

  console.log("\n■ 5. 휴직 — 되어야 하는 것");
  const 언제부터 = today();
  const 언제까지 = addDays(today(), 60);
  const 결과 = 통과해야("휴직 시키기", () =>
    startLeave(돌봄id, { from: 언제부터, to: 언제까지, reason: "병가" }));
  확인("휴직으로 바뀜", isOnLeave(돌봄id));
  {
    const 명단 = listStaff();
    const 나 = 명단.find((x) => x.id === 돌봄id);
    확인("휴직자도 기본 명단에 남음", !!나, 나 ? `${나.name} — ${나.statusKo}` : "없음");
    확인("「휴직」으로 보임", 나?.statusKo === "휴직" && 나?.onLeave === true);
    확인("휴직 시작·복귀 예정일이 남음",
      나?.leaveFrom === 언제부터 && 나?.leaveTo === 언제까지,
      `${나?.leaveFrom} ~ ${나?.leaveTo}`);
  }
  확인("맡고 있던 건수를 돌려줌", 결과?.openCount === 0, String(결과?.openCount));
  확인("쉬는 동안 로그인이 끊김",
    (db.query<{ c: number }, [number]>("SELECT COUNT(*) AS c FROM session WHERE user_id = ?")
      .get(돌봄id)?.c ?? 0) === 0);

  console.log("\n■ 6. 휴직 — 배정이 막히는가");
  const 대상 = 대상자만들기("시험대상", "대문 왼쪽에 개가 있습니다");
  const 서비스 = db.query<{ id: number }, []>(
    "SELECT id FROM service WHERE profile_id = 2 ORDER BY id LIMIT 1"
  ).get()!;
  /*
   * 배정 화면은 **의뢰에서 출발합니다.** 지자체가 「이 사람에게 이 서비스를」
   * 이라고 보내 준 것이 있어야 배정할 거리가 생깁니다.
   * (이 줄을 빼먹었더니 시험이 「배정이 사라졌다」고 잡아냈습니다. 맞는 지적이었습니다.)
   */
  db.run(
    `INSERT INTO referral (batch_label, recipient_id, service_id,
                           period_from, period_to, cycle_unit, cycle_count, cycle_text, created_at)
     VALUES ('시험차수', ?, ?, ?, ?, 'week', 2, '주 2회', ?)`,
    [대상, 서비스.id, today(), addDays(today(), 90), new Date().toISOString()]
  );

  막혀야("휴직 중인 사람에게 새 배정",
    () => saveAssign({ recipientId: 대상, serviceId: 서비스.id, userId: 돌봄id, allowRoleAdd: true }),
    "휴직 중");
  {
    const 고를수있는사람 = workerOptions("해남읍");
    const 나 = 고를수있는사람.find((x) => x.userId === 돌봄id);
    확인("휴직자가 목록에서 사라지지 않음", !!나);
    확인("휴직 표가 붙음", 나?.onLeave === true);
    확인("휴직자는 맨 아래로",
      고를수있는사람.findIndex((x) => x.userId === 돌봄id) === 고를수있는사람.length - 1 ||
      고를수있는사람.filter((x) => !x.onLeave).every(
        (x) => 고를수있는사람.indexOf(x) < 고를수있는사람.findIndex((y) => y.userId === 돌봄id)));
  }

  console.log("\n■ 7. 휴직 — 막아야 하는 것");
  막혀야("날짜가 아닌 휴직 시작일",
    () => startLeave(사무원.id, { from: "내일" }), "날짜로");
  막혀야("복귀일이 시작일보다 빠름",
    () => startLeave(사무원.id, { from: today(), to: addDays(today(), -5) }), "빠릅니다");
  막혀야("없는 사람 휴직", () => startLeave(999999, {}), "찾을 수 없");
  막혀야("휴직 중이 아닌 사람 복직", () => endLeave(사무원.id), "휴직 중인 분이 아닙니다");

  console.log("\n■ 8. 휴직 — 복직");
  통과해야("복직", () => endLeave(돌봄id));
  확인("다시 재직", !isOnLeave(돌봄id));
  {
    const 나 = listStaff().find((x) => x.id === 돌봄id);
    확인("휴직 기록이 지워짐", !나?.leaveFrom && !나?.leaveTo, `${나?.leaveFrom}/${나?.leaveTo}`);
  }
  const 배정 = 통과해야("복직하면 배정이 됨", () =>
    saveAssign({ recipientId: 대상, serviceId: 서비스.id, userId: 돌봄id, allowRoleAdd: true }));

  console.log("\n■ 9. 휴직 — 이미 맡고 있는 배정은 그대로");
  {
    const r = 통과해야("맡은 채로 휴직", () => startLeave(돌봄id, {}));
    확인("맡고 있던 건수를 알려 줌", (r?.openCount ?? 0) >= 1, String(r?.openCount));
    확인("무엇을 맡고 있었는지도 알려 줌",
      (r?.openList ?? []).some((x: any) => x.recipient === "시험대상"),
      JSON.stringify(r?.openList));
    const 줄 = listAssign({ state: "__all" }).find(
      (x) => x.recipientId === 대상 && x.serviceId === 서비스.id);
    확인("배정이 사라지지 않음", !!줄 && 줄.workerId !== null);
    확인("담당이 휴직 중이라고 표시됨", 줄?.workerOnLeave === true);
    확인("담당 이름은 그대로 보임", 줄?.worker === "시험돌봄", 줄?.worker ?? "");
  }
  endLeave(돌봄id);

  console.log("\n■ 10. 휴직 — 관리자가 한 명뿐이면");
  {
    // 지금 있는 관리자를 시험용 하나만 남기고 잠시 접어 둡니다.
    const 다른관리자 = db.query<{ id: number }, [number]>(
      "SELECT id FROM app_user WHERE status = 'active' AND roles LIKE '%admin%' AND id <> ?"
    ).all(관리자.id);
    for (const a of 다른관리자) db.run("UPDATE app_user SET status = 'resigned' WHERE id = ?", [a.id]);
    막혀야("마지막 관리자 휴직", () => startLeave(관리자.id, {}), "관리자가 한 명은");
    for (const a of 다른관리자) db.run("UPDATE app_user SET status = 'active' WHERE id = ?", [a.id]);
    확인("원래 관리자 수가 돌아옴",
      (db.query<{ c: number }, []>(
        "SELECT COUNT(*) AS c FROM app_user WHERE status = 'active' AND roles LIKE '%admin%'"
      ).get()?.c ?? 0) === 원래관리자수 + 1);
  }

  console.log("\n■ 11. 휴직과 퇴직이 섞이지 않는가");
  {
    const 임시 = await 사람만들기("시험임시", `t_tmp_${Date.now()}`, ["worker"]);
    startLeave(임시, { from: today(), reason: "출산" });
    막혀야("퇴직자를 휴직", () => { resign(임시); return startLeave(임시, {}); }, "퇴직 처리된");
    const 나 = listStaff({ includeResigned: true }).find((x) => x.id === 임시);
    확인("퇴직하면 휴직 기록이 지워짐", !나?.leaveFrom && 나?.statusKo === "퇴직",
         `${나?.statusKo} / ${나?.leaveFrom}`);
    확인("퇴직자는 기본 명단에서 빠짐", !listStaff().some((x) => x.id === 임시));
  }

  console.log("\n■ 12. 배정 목록의 대상자 메모");
  {
    const 줄 = listAssign({ state: "__all" }).find((x) => x.recipientId === 대상);
    확인("메모가 배정 줄에 실려 옴", 줄?.memo === "대문 왼쪽에 개가 있습니다", 줄?.memo ?? "");
    db.run("UPDATE recipient SET memo = ? WHERE id = ?", ["", 대상]);
    const 줄2 = listAssign({ state: "__all" }).find((x) => x.recipientId === 대상);
    확인("메모를 지우면 빈 값", 줄2?.memo === "");
  }

  console.log("\n■ 13. 보드 — 메모지끼리 겹치지 않는가");
  {
    /*
     * 여기가 이 기능의 핵심입니다.
     * 겹치면 아래 것이 안 보이고, 안 보이는 메모는 없는 메모입니다.
     */
    const 겹치나 = (a: any, b: any) => {
      const g = 자리규칙.틈;
      return !(a.x + a.w + g <= b.x || b.x + b.w + g <= a.x ||
               a.y + a.h + g <= b.y || b.y + b.h + g <= a.y);
    };

    // 여러 장을 잇달아 붙여 놓고 서로 겹치는 것이 하나라도 있는지 봅니다.
    const 여러장 = [];
    for (let i = 0; i < 8; i++) {
      const m = addSticky({ text: `보드시험 ${i + 1}` }, 관리자);
      치울것.stickies.push(m.id);
      여러장.push(m.id);
    }
    const 붙은것 = listStickies().filter((x) => 여러장.includes(x.id));
    확인("여덟 장 모두 자리를 받음",
      붙은것.length === 8 && 붙은것.every((x) => x.x !== null && x.y !== null));
    let 겹친쌍 = "";
    for (let i = 0; i < 붙은것.length; i++)
      for (let j = i + 1; j < 붙은것.length; j++)
        if (겹치나(붙은것[i], 붙은것[j])) 겹친쌍 = `${붙은것[i].text} ↔ ${붙은것[j].text}`;
    확인("새로 붙인 것끼리 하나도 안 겹침", !겹친쌍, 겹친쌍 || "겹침 없음");

    // 남의 자리에 일부러 겹쳐 놓아 봅니다 — 비켜서야 합니다.
    const 첫장 = 붙은것[0], 둘째 = 붙은것[1];
    const 답 = placeSticky(둘째.id, { x: 첫장.x, y: 첫장.y }, 관리자);
    확인("겹치는 자리에 놓으면 비켜섬", 답.비켜섬 === true,
         `바란 곳 (${첫장.x},${첫장.y}) → 놓인 곳 (${답.x},${답.y})`);
    확인("비켜선 자리도 안 겹침",
      !겹치나({ x: 답.x, y: 답.y, w: 답.w, h: 답.h }, 첫장));
    확인("첫 장은 그대로 (남의 자리를 밀지 않음)", (() => {
      const 다시 = listStickies().find((x) => x.id === 첫장.id)!;
      return 다시.x === 첫장.x && 다시.y === 첫장.y;
    })());

    // 빈 곳으로 옮기면 그대로 놓여야 합니다.
    const 먼곳 = placeSticky(둘째.id, { x: 1500, y: 900 }, 관리자);
    확인("빈 곳으로 옮기면 바란 자리 그대로",
      먼곳.x === 1500 && 먼곳.y === 900 && !먼곳.비켜섬, `(${먼곳.x},${먼곳.y})`);

    // 눈금 맞추기
    const 어중간 = placeSticky(둘째.id, { x: 1503, y: 907 }, 관리자);
    확인("눈금에 맞춰 붙음",
      어중간.x % 자리규칙.격자 === 0 && 어중간.y % 자리규칙.격자 === 0,
      `(${어중간.x},${어중간.y})`);

    // 음수는 0 으로
    const 밖으로 = placeSticky(둘째.id, { x: -500, y: -300 }, 관리자);
    확인("보드 밖으로는 못 나감", 밖으로.x >= 0 && 밖으로.y >= 0, `(${밖으로.x},${밖으로.y})`);
  }

  console.log("\n■ 14. 보드 — 크기 바꾸기");
  {
    const a = addSticky({ text: "크기시험 A" }, 관리자); 치울것.stickies.push(a.id);
    const b = addSticky({ text: "크기시험 B" }, 관리자); 치울것.stickies.push(b.id);

    // 아무도 없는 곳에 나란히 놓고
    placeSticky(a.id, { x: 2000, y: 2000 }, 관리자);
    const bb = placeSticky(b.id, { x: 2000 + 자리규칙.기본너비 + 자리규칙.틈 + 40, y: 2000 }, 관리자);

    const 큰것 = placeSticky(a.id, { w: 자리규칙.최대너비, h: 자리규칙.기본높이 }, 관리자);
    확인("옆 메모에 닿기 직전까지만 커짐",
      큰것.덜커짐 === true && 큰것.x + 큰것.w + 자리규칙.틈 <= bb.x,
      `너비 ${큰것.w} (오른쪽 끝 ${큰것.x + 큰것.w}, 옆 메모 시작 ${bb.x})`);
    확인("크기만 바꾸면 자리는 그대로", 큰것.x === 2000 && 큰것.y === 2000);

    const 작은것 = placeSticky(a.id, { w: 10, h: 10 }, 관리자);
    확인("너무 작게는 못 줄임",
      작은것.w === 자리규칙.최소너비 && 작은것.h === 자리규칙.최소높이,
      `${작은것.w}×${작은것.h}`);

    // 사방이 빈 곳으로 옮기면 최대까지 커집니다
    placeSticky(a.id, { x: 4000, y: 4000 }, 관리자);
    const 최대 = placeSticky(a.id, { w: 9999, h: 9999 }, 관리자);
    확인("빈 곳에서는 최대까지 커짐",
      최대.w === 자리규칙.최대너비 && 최대.h === 자리규칙.최대높이,
      `${최대.w}×${최대.h}`);
  }

  console.log("\n■ 15. 보드 — 막아야 하는 것");
  {
    const t = addSticky({ text: "뗄 것" }, 관리자); 치울것.stickies.push(t.id);
    setDone(t.id, true, 관리자);
    막혀야("뗀 메모 옮기기", () => placeSticky(t.id, { x: 10, y: 10 }, 관리자), "뗀 메모는");
    막혀야("없는 메모 옮기기", () => placeSticky(999999, { x: 0, y: 0 }, 관리자), "찾을 수 없");
    setDone(t.id, false, 관리자);

    // 숫자가 아닌 값을 보내도 무너지지 않아야 합니다.
    const 이상한것 = placeSticky(t.id, { x: "저쪽", y: null, w: NaN, h: undefined } as any, 관리자);
    확인("이상한 값을 보내도 자리가 성함",
      Number.isFinite(이상한것.x) && Number.isFinite(이상한것.y) &&
      이상한것.w >= 자리규칙.최소너비 && 이상한것.h >= 자리규칙.최소높이,
      JSON.stringify({ x: 이상한것.x, y: 이상한것.y, w: 이상한것.w, h: 이상한것.h }));
  }

  console.log("\n■ 16. 보드 — 자리 없는 옛 메모");
  {
    // 보드가 생기기 전에 붙은 메모(자리 없음)를 흉내 냅니다.
    const 옛것 = addSticky({ text: "옛 메모" }, 관리자); 치울것.stickies.push(옛것.id);
    db.run("UPDATE sticky SET x = NULL, y = NULL, w = NULL, h = NULL WHERE id = ?", [옛것.id]);
    const 한번 = listStickies().find((x) => x.id === 옛것.id)!;
    확인("목록을 만들 때 자리를 받음", 한번.x !== null && 한번.y !== null,
         `(${한번.x},${한번.y})`);
    const 두번 = listStickies().find((x) => x.id === 옛것.id)!;
    확인("다시 봐도 그 자리 그대로 (볼 때마다 안 바뀜)",
      두번.x === 한번.x && 두번.y === 한번.y, `(${두번.x},${두번.y})`);
    확인("자료함에도 적혔음",
      (db.query<any, [number]>("SELECT x FROM sticky WHERE id = ?").get(옛것.id)?.x) === 한번.x);
  }

  console.log("\n■ 17. 보드 나누기 — 기관 / 대상자");
  {
    /*
     * 섞이면 둘 다 못 씁니다.
     * 기관 일이 대상자 쪽지에 묻히고, 김순자 어르신 화면에 남의 쪽지가 뜹니다.
     */
    const 갑 = 대상자만들기("보드시험갑");
    const 을 = 대상자만들기("보드시험을");

    const 기관것 = addSticky({ text: "기관 — 사례회의 금요일" }, 관리자);
    치울것.stickies.push(기관것.id);
    const 갑것 = addSticky({ text: "갑 — 목요일 병원", recipientId: 갑 }, 관리자);
    치울것.stickies.push(갑것.id);
    const 을것 = addSticky({ text: "을 — 대문 열쇠 화분 밑", recipientId: 을 }, 관리자);
    치울것.stickies.push(을것.id);

    const 기관보드 = listStickies().map((x) => x.id);
    const 갑보드 = listStickies({ board: 갑 }).map((x) => x.id);
    const 을보드 = listStickies({ board: 을 }).map((x) => x.id);

    확인("기관 보드에 기관 메모가 있음", 기관보드.includes(기관것.id));
    확인("기관 보드에 대상자 메모가 안 보임",
      !기관보드.includes(갑것.id) && !기관보드.includes(을것.id));
    확인("갑 보드에는 갑 것만", 갑보드.includes(갑것.id) &&
      !갑보드.includes(을것.id) && !갑보드.includes(기관것.id),
      `갑 보드 ${갑보드.length}장`);
    확인("을 보드에는 을 것만", 을보드.includes(을것.id) && !을보드.includes(갑것.id));

    /*
     * **핵심** — 보드가 다르면 같은 자리에 있어도 겹친 것이 아닙니다.
     *
     * (기관 보드에는 앞 시험이 붙여 둔 메모가 남아 있어 바란 자리에 못 갈 수 있습니다.
     *  그래서 「바란 자리」가 아니라 **실제로 놓인 자리**를 기준으로 봅니다.)
     */
    const 기관자리 = placeSticky(기관것.id, { x: 300, y: 300 }, 관리자);
    const 갑자리 = placeSticky(갑것.id, { x: 기관자리.x, y: 기관자리.y }, 관리자);
    확인("보드가 다르면 남의 자리와 겹쳐도 그대로 놓임",
      갑자리.x === 기관자리.x && 갑자리.y === 기관자리.y && !갑자리.비켜섬,
      `기관 (${기관자리.x},${기관자리.y}) · 갑 (${갑자리.x},${갑자리.y})`);
    확인("기관 것은 밀려나지 않음",
      (() => { const x = listStickies().find((v) => v.id === 기관것.id)!;
               return x.x === 기관자리.x && x.y === 기관자리.y; })());

    // 같은 보드 안에서는 여전히 막힙니다.
    const 갑두번째 = addSticky({ text: "갑 — 두 번째", recipientId: 갑 }, 관리자);
    치울것.stickies.push(갑두번째.id);
    const 부딪힘 = placeSticky(갑두번째.id, { x: 갑자리.x, y: 갑자리.y }, 관리자);
    확인("같은 보드 안에서는 겹치면 비켜섬", 부딪힘.비켜섬 === true,
      `(${부딪힘.x},${부딪힘.y})`);

    // 숫자 세기도 보드별
    확인("숫자를 보드마다 따로 셈",
      stickyCounts(갑).open === 2 && stickyCounts(을).open === 1,
      `갑 ${stickyCounts(갑).open} · 을 ${stickyCounts(을).open}`);

    // 기관 보드만 보는 사람도 「대상자 쪽지가 있다」는 것은 알아야 합니다.
    const 요약 = 대상자보드요약();
    확인("대상자 보드 요약이 나옴",
      요약.find((r) => r.name === "보드시험갑")?.n === 2 &&
      요약.find((r) => r.name === "보드시험을")?.n === 1,
      JSON.stringify(요약.filter((r) => r.name.startsWith("보드시험"))));

    // 보드 옮기기 — 「이거 갑 어르신 이야기네」
    통과해야("기관 메모를 대상자 보드로 옮기기",
      () => updateSticky(기관것.id, { recipientId: 갑 }, 관리자));
    확인("옮긴 뒤 기관 보드에서 사라짐",
      !listStickies().some((x) => x.id === 기관것.id));
    확인("옮긴 뒤 갑 보드에 나타남",
      listStickies({ board: 갑 }).some((x) => x.id === 기관것.id));
    {
      const 갑것들 = listStickies({ board: 갑 });
      const 겹치나 = (a: any, b: any) => {
        const g = 자리규칙.틈;
        return !(a.x + a.w + g <= b.x || b.x + b.w + g <= a.x ||
                 a.y + a.h + g <= b.y || b.y + b.h + g <= a.y);
      };
      let 겹침 = "";
      for (let i = 0; i < 갑것들.length; i++)
        for (let j = i + 1; j < 갑것들.length; j++)
          if (겹치나(갑것들[i], 갑것들[j])) 겹침 = `${갑것들[i].text} ↔ ${갑것들[j].text}`;
      확인("옮겨 온 것이 새 보드에서 자리를 다시 잡아 안 겹침", !겹침, 겹침 || "겹침 없음");
    }

    통과해야("다시 기관 보드로 돌리기",
      () => updateSticky(기관것.id, { recipientId: "" }, 관리자));
    확인("기관 보드로 돌아옴", listStickies().some((x) => x.id === 기관것.id));

    막혀야("없는 대상자 보드로 옮기기",
      () => updateSticky(기관것.id, { recipientId: randomUUID() }, 관리자), "찾을 수 없");
  }

  console.log("\n■ 18. 포스트잇 지우기");
  {
    const 임시 = addSticky({ text: "지울 것" }, 사무원);
    막혀야("남의 것 지우기(관리자 아님)", () => removeSticky(임시.id, { id: 999, roles: '["staff"]' }), "관리자만");
    통과해야("붙인 사람이 지우기", () => removeSticky(임시.id, 사무원));
    확인("지운 것은 정말 없어짐", !listStickies({ done: true }).some((x) => x.id === 임시.id));
  }
} finally {
  // ── 치우기 ────────────────────────────────────────────
  for (const id of 치울것.stickies) db.run("DELETE FROM sticky WHERE id = ?", [id]);
  for (const id of 치울것.recipients) {
    db.run("DELETE FROM sticky WHERE recipient_id = ?", [id]);
    db.run("DELETE FROM referral WHERE recipient_id = ?", [id]);
    db.run("DELETE FROM assignment WHERE recipient_id = ?", [id]);
    db.run("DELETE FROM recipient WHERE id = ?", [id]);
  }
  for (const id of 치울것.users) {
    db.run("DELETE FROM sticky WHERE author_id = ?", [id]);
    db.run("DELETE FROM assignment WHERE worker_id IN (SELECT id FROM worker WHERE user_id = ?)", [id]);
    db.run("DELETE FROM worker WHERE user_id = ?", [id]);
    db.run("DELETE FROM session WHERE user_id = ?", [id]);
    db.run("DELETE FROM app_user WHERE id = ?", [id]);
  }
}

console.log(실패 === 0
  ? "\n★ 단계 5 — 되어야 하는 것은 되고, 막아야 하는 것은 막힙니다.\n"
  : `\n✕ ${실패}가지가 어긋납니다.\n`);
process.exit(실패 === 0 ? 0 : 1);
