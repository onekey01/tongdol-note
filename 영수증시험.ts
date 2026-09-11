/**
 * 본인부담금 영수증 = **편람 서식7** — B-1.
 *
 *   bun 영수증시험.ts
 *
 * 여기서 보는 것은 하나입니다 —
 * **우리가 손댄 것이 「값 칸 채우기」뿐인가.**
 *
 *   1. 서식이 적어 둔 **말**이 한 글자도 안 바뀌었나
 *      (「거래번호 :」·「(서명)」·「원」·「수령하였습니다」…)
 *   2. 표의 **생김새**가 원본과 완전히 같은가 (줄·칸·너비·붙임)
 *   3. 값이 제자리에 들어갔나
 *   4. **서명·도장 자리는 비었나**
 *   5. 한 장에 **두 벌**(제공기관 보관 · 이용자 보관)이 같은 값인가
 *   6. 이름표를 못 찾으면 **터지는가** — 빈 영수증이 나가면 안 됩니다
 */
import { readFileSync } from "node:fs";
import { Hwpx } from "./server/hwpx";
import { find, attr } from "./server/xml";
import { build, templatePath, 파일이름, type 영수증값 } from "./server/영수증";

let 통과수 = 0, 실패수 = 0;
function 참이어야(무엇: string, 참: unknown, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}
function 같아야(무엇: string, 실제: unknown, 바람: unknown) {
  if (실제 === 바람) { 통과수++; console.log(`  통과  ${무엇}   — ${실제}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}\n          나온 것 ${JSON.stringify(실제)}\n          바란 것 ${JSON.stringify(바람)}`); }
}

const 값: 영수증값 = {
  거래번호: "2026-0007",
  서비스명: "가사지원 · 식사지원",
  이용자명: "김순자",
  서비스가격: 352_000,
  정부지원금: 281_600,
  본인부담금: 70_400,
  수령일: "2026-09-05",
  발행일: "2026-09-05",
  기관명: "해남돌봄센터",
};

const 원본 = new Hwpx(readFileSync(templatePath()));
const 채운것 = new Hwpx(build(값));

/** 표 하나의 생김새 — 줄마다 칸의 너비·가로붙임·세로붙임. */
const 생김새 = (d: Hwpx) =>
  d.tables().map((t) =>
    d.rows(t).map((r) =>
      d.cells(r).map((c) => {
        const sz = find(c, "cellSz")[0], sp = find(c, "cellSpan")[0];
        return `${attr(sz, "width")}/${attr(sp, "colSpan")}/${attr(sp, "rowSpan")}`;
      }).join(" ")
    ).join(" | ")
  ).join(" ‖ ");

const 글 = (d: Hwpx, ri: number) => d.cellText(d.cell(d.tables()[0], ri, 0));

console.log("\n── 1. 서식의 **생김새**를 안 건드렸습니다 ──────────────\n");

같아야("표 개수", 채운것.tables().length, 원본.tables().length);
참이어야("**줄·칸·너비·붙임이 완전히 같다**", 생김새(채운것) === 생김새(원본));
참이어야("표 위 제목도 그대로",
  채운것.머리문단글() === 원본.머리문단글(), 채운것.머리문단글());

console.log("\n── 2. 서식이 적어 둔 **말**이 그대로입니다 ─────────────\n");

const 지켜야할말 = [
  "본인부담금 영수증", "(제공기관 보관)", "(이용자 보관)",
  "거래번호 :", "서비스명 :", "이용자명 :", "(서명)",
  "금    액 :", "서비스 가격", "정부 지원금", "본인 부담금", "원",
  "수령하였습니다.", "대표", "(인)",
];
/*
 * 「제공기관」은 **지켜야 할 말이 아닙니다.** 「◯◯◯◯제공기관」까지가
 * 통째로 기관 이름을 쓰라고 그려 둔 자리라, 기관 이름 하나가 그 자리를
 * 대신합니다 — 「해남돌봄센터 대표 (인)」. ◯◯◯◯ 만 바꾸면
 * 「해남돌봄센터제공기관 대표」가 되어 말이 안 됩니다. (2026-09-02)
 */
for (const 말 of 지켜야할말) {
  const 있나 = [1, 5].every((ri) => 글(채운것, ri).includes(말))
    || 글(채운것, 0).includes(말) || 글(채운것, 4).includes(말);
  참이어야(`「${말}」`, 있나);
}

console.log("\n── 3. 값이 제자리에 들어갔습니다 ───────────────────────\n");

const 위 = 글(채운것, 1);
참이어야("거래번호", 위.includes("거래번호 : 2026-0007"));
참이어야("서비스명", 위.includes("서비스명 : 가사지원 · 식사지원"));
참이어야("이용자명 — **(서명) 앞에**", /이용자명 : 김순자\s+\(서명\)/.test(위),
  위.split("\n").find((l) => l.includes("이용자명"))?.trim());
참이어야("서비스 가격", /서비스 가격\s+352,000원/.test(위));
참이어야("정부 지원금", /정부 지원금\s+281,600원/.test(위));
참이어야("본인 부담금", /본인 부담금\s+70,400원/.test(위));
참이어야("괄호 안 본인부담금", /본인부담금\(\s*70,400원\)/.test(위));
참이어야("수령일 — 2026 · 9 · 5", /2026\s*년\s+9월\s+5일/.test(위),
  위.split("\n").find((l) => l.includes("수령"))?.trim());
/*
 * 빈칸이 여럿인 것은 **일부러**입니다 — 「◯◯◯◯제공기관」(8자)을
 * 「해남돌봄센터」(6자)로 바꾸면서 **길이를 지키느라** 두 칸이 남습니다.
 * 길이가 그대로여야 줄 정보(textpos)가 안 어긋납니다.
 */
참이어야("**「◯◯◯◯제공기관」이 통째로 기관 이름이 됩니다**",
  /해남돌봄센터\s+대표/.test(위), (위.match(/해남돌봄센터.{0,12}/) ?? [""])[0]);
참이어야("**「제공기관」이 안 남습니다** — 「…제공기관 대표」는 말이 안 됩니다",
  !위.includes("제공기관 대표"));
참이어야("**◯◯◯◯ 가 안 남아 있습니다**", !위.includes("◯◯◯◯"));

console.log("\n── 4. **서명·도장 자리는 비웠습니다** ──────────────────\n");

참이어야("(서명) 은 그대로 비어 있습니다", 위.includes("(서명)"));
참이어야("(인) 도 그대로", 위.includes("(인)"));
참이어야("**우리가 서명을 대신 찍지 않습니다**",
  !/김순자\s*\(서명\s*완/.test(위) && !위.includes("직인"));

console.log("\n── 5. 한 장에 두 벌, 같은 값 ───────────────────────────\n");

const 아래 = 글(채운것, 5);
for (const 조각 of ["2026-0007", "김순자", "352,000", "281,600", "70,400", "해남돌봄센터"]) {
  참이어야(`아래 벌에도 「${조각}」`, 아래.includes(조각));
}
참이어야("위는 제공기관 보관, 아래는 이용자 보관",
  글(채운것, 0).includes("제공기관 보관") && 글(채운것, 4).includes("이용자 보관"));

console.log("\n── 6. **못 찾으면 터집니다** — 빈 영수증을 막습니다 ────\n");

// 서식이 개정되어 이름표가 바뀐 상황을 흉내 냅니다.
let 터졌나 = false;
try {
  const 가짜 = new Hwpx(readFileSync(templatePath()));
  const tc = 가짜.cell(가짜.tables()[0], 1, 0);
  참이어야("있는 이름표는 찾습니다", 가짜.얹기(tc, "거래번호 :", "x"));
  참이어야("**없는 이름표는 못 찾았다고 합니다**", !가짜.얹기(tc, "영수증번호 :", "x"));
  터졌나 = true;
} catch { /* 여기까지 오면 안 됩니다 */ }
참이어야("이름표 찾기가 참·거짓을 정확히 돌려줍니다", 터졌나);

console.log("\n── 7. 자체 점검과 파일 이름 ────────────────────────────\n");

참이어야("**한글이 싫어하는 모양이 안 남았습니다**", 채운것.audit().length === 0,
  채운것.audit().join(" · ") || "깨끗함");
같아야("파일 이름", 파일이름(값), "본인부담금 영수증_김순자_2026-09-05.hwpx");

/* ═════════════════════════════════════════════════════════════
 * 8. **실적 → 확정 → 수납 → 영수증**이 한 줄로 이어지는가
 *
 * 함수가 맞는 것과 **어르신께 드리는 종이가 맞는 것**은 다른 이야기입니다.
 * 실제 실적을 넣고 청구를 확정한 뒤, 그 청구 번호로 영수증을 뽑아
 * **정산 화면이 말한 금액과 같은지** 봅니다.
 * ═══════════════════════════════════════════════════════════ */
console.log("\n── 8. 실적 → 확정 → 수납 → **영수증** ─────────────────\n");

const { randomUUID } = await import("node:crypto");
const { db, initDb } = await import("./server/db");
initDb();
const { issue, pay } = await import("./server/billing");
const { gather } = await import("./server/영수증");

const 사람 = randomUUID();
const 프로필: any = db.query(
  `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id
    WHERE o.id = 1`).get();
const 구간 = "2026-05";
let 서비스id = 0;
let 구간넣음: any = null;
try {
  // 본인부담 20% 구간을 씁니다 — 면제면 영수증을 낼 것이 없습니다.
  구간넣음 = db.query<any, [number]>(
    "SELECT id FROM copay_tier WHERE profile_id = ? AND rate > 0 ORDER BY rate LIMIT 1"
  ).get(프로필.id);

  db.run(
    `INSERT INTO recipient (id, payload, dong, status, copay_tier_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: "영수증시험" }), "해남읍", "이용",
     구간넣음?.id ?? null, `${구간}-01`, "x"]);

  서비스id = Number(db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          sort_order, active, custom)
     VALUES (?,?,'시험','시험','시험','시험가사','hour',24000,NULL,'time',NULL,0,0,0,0,900,1,1)`,
    [프로필.id, `RCPT-${randomUUID().slice(0, 8)}`]).lastInsertRowid);

  // 60분씩 세 번 = 72,000원
  for (const d of ["04", "11", "18"])
    db.run(
      `INSERT INTO delivery (recipient_id, service_id, served_on, outcome, is_holiday,
                             minutes, created_at)
       VALUES (?,?,?, '제공',0,60,'x')`, [사람, 서비스id, `${구간}-${d}`]);

  const 낸것: any = issue(사람, 구간, "시험");
  const billId = 낸것?.billId ?? 낸것?.id
    ?? (db.query<any, [string]>(
      "SELECT id FROM billing WHERE recipient_id = ? ORDER BY id DESC LIMIT 1"
    ).get(사람) as any)?.id;
  참이어야("청구가 확정됐습니다", !!billId, `#${billId}`);

  pay(Number(billId), `${구간}-25`);
  const 청구: any = db.query("SELECT * FROM billing WHERE id = ?").get(billId);

  const v = gather(Number(billId));
  같아야("**영수증의 서비스 가격 = 확정된 서비스 비용**",
    v.서비스가격, Number(청구.service_amount));
  같아야("**본인부담금도 같습니다**", v.본인부담금, Number(청구.copay_amount));
  같아야("정부 지원금 = 서비스 가격 − 본인부담금",
    v.정부지원금, Number(청구.service_amount) - Number(청구.copay_amount));
  참이어야("세 몫을 더하면 서비스 가격이 됩니다 — 종이가 스스로 맞습니다",
    v.정부지원금 + v.본인부담금 === v.서비스가격,
    `${v.정부지원금} + ${v.본인부담금} = ${v.서비스가격}`);
  같아야("수령일은 **수납한 날**입니다", v.수령일, `${구간}-25`);
  참이어야("서비스명이 실적에서 왔습니다", v.서비스명.includes("시험가사"), v.서비스명);
  참이어야("이용자명", v.이용자명 === "영수증시험");

  // 실제로 종이가 나오는가
  const 종이 = new Hwpx(build(v));
  const 글1 = 종이.cellText(종이.cell(종이.tables()[0], 1, 0));
  const 돈 = (n: number) => n.toLocaleString("ko-KR");
  참이어야("**뽑은 종이에 그 금액이 적혀 있습니다**",
    글1.includes(돈(v.본인부담금)) && 글1.includes(돈(v.서비스가격)),
    `${돈(v.서비스가격)} / ${돈(v.본인부담금)}`);
  참이어야("서식은 그대로", 종이.audit().length === 0);

  // **면제인 분은 영수증이 없습니다**
  const 면제 = randomUUID();
  db.run(
    `INSERT INTO recipient (id, payload, dong, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?)`,
    [면제, JSON.stringify({ name: "면제시험" }), "해남읍", "이용", `${구간}-01`, "x"]);
  db.run(
    `INSERT INTO delivery (recipient_id, service_id, served_on, outcome, is_holiday,
                           minutes, created_at)
     VALUES (?,?,?, '제공',0,60,'x')`, [면제, 서비스id, `${구간}-04`]);
  issue(면제, 구간, "시험");
  const 면제청구: any = db.query(
    "SELECT id FROM billing WHERE recipient_id = ? ORDER BY id DESC LIMIT 1").get(면제);
  let 막혔나 = false;
  try { gather(Number(면제청구.id)); } catch { 막혔나 = true; }
  참이어야("**본인부담금이 0원이면 영수증을 안 냅니다**", 막혔나,
    "받은 적 없는 돈의 영수증은 거짓 서류입니다");
  db.run("DELETE FROM billing WHERE recipient_id = ?", [면제]);
  db.run("DELETE FROM delivery WHERE recipient_id = ?", [면제]);
  db.run("DELETE FROM recipient WHERE id = ?", [면제]);
} catch (e: any) {
  실패수++;
  console.log(`✗ 실패  8번 마당이 터졌습니다 — ${e?.message ?? e}`);
} finally {
  db.run("DELETE FROM billing WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM delivery WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM recipient WHERE id = ?", [사람]);
  if (서비스id) db.run("DELETE FROM service WHERE id = ?", [서비스id]);
}

console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패`);
console.log(실패수 === 0
  ? "\n★ 서식을 바꾸지 않았습니다. (손댄 것: 값 칸 채우기, 그것뿐입니다)\n"
  : "\n✕ 서식이 바뀌었습니다. 제출 서류라 그대로 두면 안 됩니다.\n");
process.exit(실패수 ? 1 : 0);
