/**
 * 식사지원 대면 / 비대면 — A-4.
 *
 *   bun 대면배달시험.ts
 *
 * **함수보다 이 시험이 먼저 나왔습니다.** A-1~A-3 과 같은 차례입니다.
 *
 * 편람 —
 *   「<대면> 배달 원칙 준수 · **비대면 배달이 3회 연속**이면 서비스 중단」
 * 계약서 5-2조 —
 *   「3회 연속 대면 수령하지 않은 경우 **통합돌봄 서비스가 중지**됩니다」
 *
 * 여기서 보는 것:
 *   1) 안 적은 것은 **대면**으로 본다 (원칙이 대면입니다)
 *   2) **비대면도 제공이라 돈이 나간다** — 음식이 이미 만들어졌습니다
 *   3) 연속은 **뒤에서부터**, 대면 한 번이면 0으로 돌아간다
 *   4) **미제공은 건너뛴다** — 안 간 날은 배달이 아닙니다
 *   5) **옛 버그** — 미제공 연속을 세지 않는다
 *   6) 식사지원이 아닌 서비스는 이 셈에 안 든다
 *   7) 노쇼 갈래는 **꺼진 서비스에서 안 뜬다** (기본 꺼짐)
 *   8) **연속으로 세나 누적으로 세나**를 설정이 정한다 (v33 · 2026-09-08)
 */
import { randomUUID } from "node:crypto";
import { db, initDb } from "./server/db";
initDb();
import {
  대면이었나, 대면원칙인가, 비대면연속, 비대면다시셈, 비대면한도, 비대면방식,
} from "./server/대면배달";
import { 기본갈래 } from "./server/미제공";
import { linesOf } from "./server/billing";
import { setCell } from "./server/record";
import { today } from "./server/util";

let 통과수 = 0, 실패수 = 0;
function 같아야(무엇: string, 실제: unknown, 바람: unknown) {
  if (실제 === 바람) { 통과수++; console.log(`  통과  ${무엇}   — ${실제}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}   — ${실제} (${바람} 이어야 함)`); }
}
function 참이어야(무엇: string, 참: unknown, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}

const 사람 = randomUUID();
const 프로필: any = db.query(
  `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`
).get();
const 만든서비스: number[] = [];
const 만든배정: number[] = [];

function 서비스(name: string, unit: string, rt: string, 단가: number, 노쇼쓰나 = 0) {
  const i = db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          sort_order, active, custom)
     VALUES (?,?,'시험','시험','시험',?,?,?,NULL,?,NULL,0,0,0,?,900,1,1)`,
    [프로필.id, `F2F-${randomUUID().slice(0, 8)}`, name, unit, 단가, rt, 노쇼쓰나]);
  const id = Number(i.lastInsertRowid); 만든서비스.push(id); return id;
}
/** 대면: true=대면 · false=비대면 · null=안 적음 */
function 실적(svc: number, 날: string, 대면: boolean | null, outcome = "제공") {
  db.run(
    `INSERT INTO delivery (recipient_id, service_id, served_on, outcome, is_holiday,
                           face_to_face, created_at)
     VALUES (?,?,?,?,0,?,'x')`,
    [사람, svc, 날, outcome, 대면 === null ? null : 대면 ? 1 : 0]);
}
const 지움 = () => db.run("DELETE FROM delivery WHERE recipient_id = ?", [사람]);

try {
  db.run(
    `INSERT INTO recipient (id, payload, dong, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: "대면배달시험" }), "해남읍", "이용", "2026-01-01", "x"]);

  const 식사 = 서비스("시험식사", "meal", "meal", 11000);
  const 가사 = 서비스("시험가사", "hour", "time", 24000);

  // ── 1. 안 적은 것은 대면 ──────────────────────────────────
  console.log("\n── 1. **안 적은 것은 대면**입니다 (원칙이 대면) ────────\n");

  참이어야("1 은 대면", 대면이었나(1));
  참이어야("**0 은 비대면**", !대면이었나(0));
  참이어야("**비어 있으면 대면** — 옛 실적으로 없던 경고가 안 뜹니다", 대면이었나(null));
  참이어야("아예 없는 값도 대면", 대면이었나(undefined));

  참이어야("**식사지원만 대면 원칙**", 대면원칙인가({ record_type: "meal", name: "식사지원" }));
  참이어야("이름으로도 알아봅니다", 대면원칙인가({ record_type: null, name: "식사지원" }));
  참이어야("가사지원은 아닙니다", !대면원칙인가({ record_type: "time", name: "가사지원" }),
    "대면이 아니면 애초에 일이 안 됩니다");

  // ── 2. 비대면도 돈이 나간다 ───────────────────────────────
  console.log("\n── 2. **비대면도 제공이라 돈이 나갑니다** ──────────────\n");

  실적(식사, "2026-03-02", true);    // 대면
  실적(식사, "2026-03-03", false);   // 비대면 — 그래도 11,000
  실적(식사, "2026-03-04", null, "미제공");   // 안 감 — 0원
  const 줄: any = linesOf(사람, "2026-03").find((x: any) => x.serviceId === 식사);
  같아야("**대면 1 + 비대면 1 = 22,000원**", 줄?.amount, 22_000);
  같아야("미제공은 안 셉니다", 줄?.count, 2);
  참이어야("**음식이 이미 만들어졌으니 놓고 와도 비용입니다**", 줄?.amount === 22_000);

  // ── 3. 연속은 뒤에서부터 ──────────────────────────────────
  console.log("\n── 3. 연속은 **뒤에서부터**, 대면 한 번이면 0 ──────────\n");

  지움();
  실적(식사, "2026-03-01", true); 실적(식사, "2026-03-02", true);
  같아야("대면만 있으면 0", 비대면연속(사람).연속, 0);

  실적(식사, "2026-03-03", false);
  같아야("비대면 한 번 → 1", 비대면연속(사람).연속, 1);
  실적(식사, "2026-03-04", false);
  const 둘 = 비대면연속(사람);
  같아야("두 번 → 2", 둘.연속, 2);
  참이어야("**두 번째에 미리 알려 줍니다** — 닿고 나서 알면 이미 끊깁니다", 둘.경고);
  참이어야("아직 끊긴 것은 아닙니다", !둘.닿음);

  실적(식사, "2026-03-05", false);
  const 셋 = 비대면연속(사람);
  같아야("**세 번 → 3, 통합돌봄 전체 중지**", 셋.연속, 비대면한도());
  참이어야("닿았습니다 (계약서 5-2조)", 셋.닿음);
  같아야("마지막 비대면이 언제였는지 남습니다", 셋.마지막, "2026-03-05");

  실적(식사, "2026-03-06", true);
  const 뒤 = 비대면연속(사람);
  같아야("**대면 한 번이면 0 으로 돌아갑니다**", 뒤.연속, 0);
  같아야("마지막 날짜도 지워집니다", 뒤.마지막, null);

  // ── 4. 미제공은 건너뛴다 ──────────────────────────────────
  console.log("\n── 4. **미제공은 건너뜁니다** — 안 간 날은 배달이 아닙니다\n");

  지움();
  실적(식사, "2026-03-01", false);
  실적(식사, "2026-03-02", null, "미제공");   // 안 감
  실적(식사, "2026-03-03", false);
  같아야("**미제공이 끼어도 연속은 이어집니다** — 2", 비대면연속(사람).연속, 2);

  지움();
  실적(식사, "2026-03-01", null, "미제공");
  실적(식사, "2026-03-02", null, "미제공");
  실적(식사, "2026-03-03", null, "미제공");
  const 옛버그 = 비대면연속(사람);
  참이어야("**미제공 세 번은 0 입니다** ← 어제까지 3 이라고 세던 그 버그",
    옛버그.연속 === 0 && !옛버그.닿음,
    "안 간 것과 놓고 온 것은 다른 일입니다");

  // ── 5. 옛 자료 ────────────────────────────────────────────
  console.log("\n── 5. 갈래를 안 적은 옛 실적은 대면으로 봅니다 ─────────\n");

  지움();
  for (const d of ["01", "02", "03", "04"]) 실적(식사, `2026-03-${d}`, null);
  참이어야("**옛 실적 넉 장으로 없던 경고가 안 뜹니다**", 비대면연속(사람).연속 === 0);

  // ── 6. 다른 서비스는 안 센다 ──────────────────────────────
  console.log("\n── 6. 식사지원이 아닌 것은 이 셈에 안 듭니다 ───────────\n");

  지움();
  for (const d of ["01", "02", "03"]) 실적(가사, `2026-03-${d}`, false);
  같아야("가사지원은 아무리 찍어도 0", 비대면연속(사람).연속, 0);

  // ── 7. 실적에서 적고, 대상자 줄에 셈해 둔다 ───────────────
  console.log("\n── 7. 실적에서 적으면 대상자 줄이 따라옵니다 ───────────\n");

  지움();
  const 오늘 = today();
  const 달 = Number(오늘.slice(8)) >= 3
    ? 오늘.slice(0, 7)
    : `${Number(오늘.slice(0, 4))}-${String(Number(오늘.slice(5, 7)) - 1).padStart(2, "0")}`;
  const 날 = (n: number) => `${달}-0${n}`;

  const 배정 = Number(db.run(
    `INSERT INTO assignment (recipient_id, service_id, weekly_plan, period_from, created_at)
     VALUES (?,?,?,?,'x')`, [사람, 식사, "1,2,3", 날(1)]).lastInsertRowid);
  만든배정.push(배정);

  let r: any = setCell({ assignId: 배정, on: 날(1), state: "제공", faceToFace: false });
  같아야("비대면으로 적힙니다", r.faceToFace, false);
  setCell({ assignId: 배정, on: 날(2), state: "제공", faceToFace: false });
  const rec: any = db.query("SELECT no_show_streak, last_no_show_on FROM recipient WHERE id = ?")
    .get(사람);
  같아야("**대상자 줄이 저절로 따라옵니다** — 손으로 세는 칸이 아닙니다",
    rec?.no_show_streak, 2);
  같아야("마지막 날도", rec?.last_no_show_on, 날(2));

  r = setCell({ assignId: 배정, on: 날(2), state: "제공", faceToFace: true });
  같아야("대면으로 고치면 줄어듭니다",
    (db.query("SELECT no_show_streak FROM recipient WHERE id = ?").get(사람) as any)
      ?.no_show_streak, 0);
  같아야("적어 보내지 않으면 있던 값 그대로 (현장앱이 안 보낼 수 있습니다)",
    (setCell({ assignId: 배정, on: 날(1), state: "제공" }) as any).faceToFace, false);

  같아야("다시셈은 같은 답을 냅니다", 비대면다시셈(사람).연속, 0);

  // ── 8. 한도를 설정에서 고칠 수 있다 ───────────────────────
  console.log("\n── 8. **3회는 설정값**입니다 (지침이 바뀌면 고칩니다) ───\n");

  const 원래 = 비대면한도();
  같아야("기본은 3회 (편람·계약서 5-2조)", 원래, 3);

  const 프로필id = (db.query<any, []>(
    "SELECT profile_id AS id FROM organization WHERE id = 1").get() as any).id;
  const 되돌리기 = () =>
    db.run("UPDATE region_profile SET f2f_limit = ? WHERE id = ?", [원래, 프로필id]);
  try {
    db.run("UPDATE region_profile SET f2f_limit = 5 WHERE id = ?", [프로필id]);
    같아야("5로 고치면 5로 셉니다", 비대면한도(), 5);

    지움();
    for (const d of ["01", "02", "03"]) 실적(식사, `2026-03-${d}`, false);
    const 셋뿐 = 비대면연속(사람);
    참이어야("**5회로 바꾸면 3회에서는 안 닿습니다**", !셋뿐.닿음, `${셋뿐.연속}회 / 5회`);
    참이어야("아직 경고도 아닙니다", !셋뿐.경고);
    for (const d of ["04", "05"]) 실적(식사, `2026-03-${d}`, false);
    const 다섯 = 비대면연속(사람);
    참이어야("**5회에서 닿습니다**", 다섯.닿음, `${다섯.연속}회 / ${다섯.한계}회`);

    db.run("UPDATE region_profile SET f2f_limit = 0 WHERE id = ?", [프로필id]);
    지움();
    for (const d of ["01", "02", "03", "04", "05", "06"]) 실적(식사, `2026-03-${d}`, false);
    const 안봄 = 비대면연속(사람);
    참이어야("**0 이면 「안 봅니다」** — 아무리 쌓여도 경고가 없습니다",
      !안봄.닿음 && !안봄.경고 && !안봄.봄, `${안봄.연속}회`);
    같아야("그래도 몇 번인지는 셉니다", 안봄.연속, 6);
  } finally { 되돌리기(); }
  같아야("시험이 끝나면 되돌려 놓습니다", 비대면한도(), 원래);

  // ── 9. 노쇼 갈래는 꺼진 서비스에서 안 뜬다 ────────────────
  console.log("\n── 9. 노쇼 갈래는 **기본 꺼짐** (현장에 없는 개념입니다) ─\n");

  참이어야("**꺼져 있으면 부재도 노쇼가 아닙니다**", 기본갈래("부재", false) === "기타",
    기본갈래("부재", false));
  같아야("거부도 마찬가지", 기본갈래("거부", false), "기타");
  같아야("사전취소는 그대로 (조율해 다시 잡은 것입니다)",
    기본갈래("입원", false), "사전취소");
  같아야("기관사정도 그대로", 기본갈래("기관사정", false), "기관사정");
  같아야("**켠 지자체에서는 예전처럼 노쇼**", 기본갈래("부재", true), "노쇼");

  const 노쇼끔: any = db.query("SELECT noshow_billable FROM service WHERE id = ?").get(식사);
  같아야("**심을 때 기본이 꺼짐**", Number(노쇼끔?.noshow_billable), 0);

  // ── 8. 연속으로 세나, 누적으로 세나 (v33) ────────────────
  console.log("\n── 8. 연속 / 누적 — **설정이 정합니다** ────────────────\n");
  /*
   * (2026-09-08 무무 — 「비대면 식사배달 3회 누적이 아님 → **연속**임.
   *  편람에서의 유의사항이고, **다른 지자체에선 적용을 다르게 할 수도**
   *  있으므로 누적/연속 선택할 수 있도록 설정에서 반영.」)
   *
   * ★ 세는 것은 **둘 다 그대로** 셉니다. 설정이 바꾸는 것은
   *   「어느 쪽으로 경고하고 끊나」 하나뿐입니다 — 그래서 여기서
   *   **연속·누적 값 자체가 안 흔들리는지**도 함께 봅니다.
   */
  db.run("DELETE FROM delivery WHERE recipient_id = ?", [사람]);
  /* 비대면 · 대면 · 비대면 · 대면 · 비대면 — **연속 1, 누적 3** */
  실적(식사, "2026-05-01", false);
  실적(식사, "2026-05-02", true);
  실적(식사, "2026-05-03", false);
  실적(식사, "2026-05-04", true);
  실적(식사, "2026-05-05", false);

  const 옛방식: any = db.query(
    `SELECT rp.f2f_mode m, rp.id FROM region_profile rp
       JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`).get();

  db.run("UPDATE region_profile SET f2f_mode = '연속' WHERE id = ?", [옛방식.id]);
  const ㄱ = 비대면연속(사람);
  같아야("설정이 「연속」", 비대면방식(), "연속");
  같아야("연속은 1", ㄱ.연속, 1);
  같아야("누적은 3 (연속을 골라도 **누적은 그대로 셉니다**)", ㄱ.누적, 3);
  같아야("**볼값은 연속 쪽**", ㄱ.볼값, 1);
  참이어야("한도 3회에 연속 1 이면 **안 닿습니다**", !ㄱ.닿음);
  참이어야("경고도 아직", !ㄱ.경고);

  db.run("UPDATE region_profile SET f2f_mode = '누적' WHERE id = ?", [옛방식.id]);
  const ㄴ = 비대면연속(사람);
  같아야("설정이 「누적」", 비대면방식(), "누적");
  같아야("연속은 **여전히 1** (세는 것은 안 바뀝니다)", ㄴ.연속, 1);
  같아야("누적도 여전히 3", ㄴ.누적, 3);
  같아야("**볼값이 누적 쪽으로 바뀝니다**", ㄴ.볼값, 3);
  참이어야("★ 같은 실적인데 누적으로 보면 **닿습니다**", ㄴ.닿음);
  참이어야("경고도 켜집니다", ㄴ.경고);

  db.run("UPDATE region_profile SET f2f_mode = ? WHERE id = ?",
         [옛방식.m ?? "연속", 옛방식.id]);
  같아야("(되돌림) 설정을 원래대로", 비대면방식(), 옛방식.m ?? "연속");
} catch (e: any) {
  실패수++;
  console.log(`\n✗ 시험 도중 터졌습니다 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 4).join("\n"));
} finally {
  db.run("DELETE FROM delivery WHERE recipient_id = ?", [사람]);
  for (const a of 만든배정) db.run("DELETE FROM assignment WHERE id = ?", [a]);
  db.run("DELETE FROM recipient WHERE id = ?", [사람]);
  for (const s of 만든서비스) db.run("DELETE FROM service WHERE id = ?", [s]);
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
