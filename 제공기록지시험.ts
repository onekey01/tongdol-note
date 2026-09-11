/**
 * 제공기록지(서식3·4·5) 시험 —  bun 제공기록지시험.ts
 *
 * ── 여기서 보는 것 ─────────────────────────────────────────
 *
 *   1. 만든 파일을 **다시 열어** 값이 제자리에 있는가
 *   2. ★ **서식을 안 고쳤는가** — 줄 수·칸 수·이름표가 원본과 똑같은가
 *   3. 서식이 시키는 대로 **‘○’** 를 찍는가 (☑ 나 V 가 아니라)
 *   4. 한 장에 6일, 넘치면 **장을 나누는가**
 *   5. 안 한 항목 칸은 **비어 있는가** (○ 가 흘러가면 안 한 일이 적힙니다)
 *   6. 고르기 칸의 **서식 글자를 안 지우는가** (네모만 채웁니다)
 *   7. 미제공한 날은 **안 들어가는가**
 *
 * ── 왜 「다시 열어」 보나 ───────────────────────────────────
 *
 * 만드는 코드가 「넣었다」고 하는 것과 파일에 **실제로 들어간 것**은
 * 다른 일입니다. 한글이 안 여는 파일을 만들어 놓고 통과하면 아무 쓸모가
 * 없습니다. 그래서 만든 것을 그대로 다시 파싱해서 봅니다.
 */
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { db, initDb } from "./server/db";
import { Hwpx } from "./server/hwpx";
import { 서식폴더 } from "./server/서식자리";
import { 만들기, 모으기 } from "./server/제공기록지";
initDb();

let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: unknown, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}

const 달 = "2026-07";                 // 다른 시험과 안 겹치게 지난달로
const 사람 = randomUUID();
const 만든서비스: number[] = [];
const 배정: number[] = [];
let 만든사람: number | null = null;
let 만든종사자: number | null = null;

try {
  const 프로필: any = db.query(
    `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`).get();
  if (!프로필) throw new Error("기관이 없습니다. 통돌 Note 를 한 번 켜서 기관을 만들어 주세요.");

  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: "기록지시험", birth: "1945-03-02" }), "해남읍", "이용", `${달}-01`, "x"]);

  const u = db.run(
    `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload, created_at)
     VALUES ('기록지인력', ?, 'x', 'worker', '["worker"]', 'active', '{}', 'x')`,
    [`t-${randomUUID().slice(0, 8)}`]);
  만든사람 = Number(u.lastInsertRowid);
  const k = db.run(`INSERT INTO worker (user_id, hired_on, created_at) VALUES (?,?,'x')`,
    [만든사람, `${달}-01`]);
  만든종사자 = Number(k.lastInsertRowid);

  const i = db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','가사지원','가사지원','시험가사(기록지)','hour',24000,NULL,'time',NULL,0,0,0,0,900,1,1)`,
    [프로필.id, `URB-${randomUUID().slice(0, 6)}`]);
  const 가사 = Number(i.lastInsertRowid); 만든서비스.push(가사);

  const 모든요일 = JSON.stringify([0, 1, 2, 3, 4, 5, 6].map((dow) => ({ dow })));
  const a = db.run(
    `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
     VALUES (?,?,?,?,?,'x')`, [사람, 가사, 만든종사자, 모든요일, `${달}-01`]);
  배정.push(Number(a.lastInsertRowid));

  /** 하루치 실적을 넣습니다. */
  function 넣기(일: number, 속: any, 상태 = "제공") {
    const 날 = `${달}-${String(일).padStart(2, "0")}`;
    db.run(
      `INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                             is_holiday,planned,start_at,end_at,payload,created_at)
       VALUES (?,?,?,?,?,0,1,?,?,?,'x')`,
      [배정[0], 사람, 가사, 날, 상태,
       속.시작 ? `${날}T${속.시작}:00` : null,
       속.종료 ? `${날}T${속.종료}:00` : null,
       JSON.stringify({ 현장: { 적은것: 속.적은것 ?? {}, 서명: 속.서명 ?? null } })]);
  }

  // 일곱 날 — 여섯을 넘겨서 **장이 나뉘는지** 봅니다.
  넣기(1, { 시작: "09:00", 종료: "11:00",
    적은것: { 한것: ["청소", "세탁"], 특이사항: "무릎이 아프시다고 하셨습니다" },
    서명: "data:image/png;base64,AAAA" });
  넣기(2, { 시작: "13:30", 종료: "15:00", 적은것: { 한것: ["취사", "말벗"] } });
  넣기(3, { 시작: "09:00", 종료: "10:30", 적은것: { 한것: ["목욕보조"], 기타: "화분에 물 줌" } });
  넣기(6, { 시작: "10:00", 종료: "12:00", 적은것: { 한것: ["청소"] } });
  넣기(7, { 시작: "09:00", 종료: "11:00", 적은것: { 한것: ["세탁", "취사"] } });
  넣기(8, { 시작: "14:00", 종료: "16:00", 적은것: { 한것: ["말벗"] } });
  넣기(9, { 시작: "09:00", 종료: "11:00", 적은것: { 한것: ["체위변경"] } });
  // 미제공 — 서식에 들어가면 안 됩니다.
  넣기(10, { 적은것: {} }, "미제공");

  // ── 모으기 ──
  console.log("\n── 1. 값을 모읍니다 ────────────────────────────────\n");
  const g = 모으기(배정[0], 달);
  본다("제공한 날만 모은다", g.것들.length === 7, `${g.것들.length}일`);
  본다("★ 미제공한 날은 안 들어간다",
    !g.것들.some((x) => x.날.endsWith("-10")));
  본다("갈래를 가사로 가린다", g.갈래 === "가사", g.갈래);
  본다("대상자·생년월일이 실린다",
    g.대상자.이름 === "기록지시험" && g.대상자.생년월일 === "1945-03-02");
  본다("제공인력이 실린다", g.인력 === "기록지인력", g.인력);

  // ── 만들기 ──
  console.log("\n── 2. 서식3 을 만듭니다 ────────────────────────────\n");
  const 파일들 = 만들기(배정[0], 달);
  본다("★ 일곱 날이면 두 장이 나온다", 파일들.length === 2,
    파일들.map((f) => f.name).join(" · "));
  본다("파일 이름에 달·서식·이름이 들어간다",
    파일들[0].name.startsWith(`${달}_서식3_기록지시험`), 파일들[0].name);

  // ── 다시 열어 봅니다 ──
  console.log("\n── 3. 만든 파일을 다시 열어 봅니다 ★ ───────────────\n");
  const 원본 = new Hwpx(readFileSync(join(서식폴더(), "가사지원 제공기록지(서식3).hwpx")));
  const 원표 = 원본.tables()[0];

  const d = new Hwpx(파일들[0].data);
  const t = d.tables()[0];
  const 칸 = (r: number, c: number) => String(d.cellText(d.cell(t, r, c))).trim();

  /*
   * ★ 여기가 이 시험의 고갱이입니다.
   *   줄이 하나라도 늘거나 줄면 한글이 파일을 안 엽니다. 그리고
   *   지자체에 내는 서식이 달라지는 것은 그 자체로 안 될 일입니다.
   */
  본다("★ 줄 수가 원본과 같다",
    d.rows(t).length === 원본.rows(원표).length,
    `${d.rows(t).length} / 원본 ${원본.rows(원표).length}`);
  본다("★ 표가 하나 그대로다", d.tables().length === 원본.tables().length);
  {
    const 칸수같나 = d.rows(t).every((tr, r) =>
      d.cells(tr).length === 원본.cells(원본.rows(원표)[r]).length);
    본다("★ 줄마다 칸 수도 같다", 칸수같나);
  }
  {
    // 이름표 기둥(c0)은 서식이 적어 둔 글자입니다. 한 글자도 달라지면 안 됩니다.
    const 이름표같나 = d.rows(t).every((tr, r) =>
      String(d.cellText(d.cells(tr)[0])).trim() ===
      String(원본.cellText(원본.cells(원본.rows(원표)[r])[0])).trim());
    본다("★ 이름표 기둥이 한 글자도 안 바뀌었다", 이름표같나);
  }

  console.log("\n── 4. 값이 제자리에 들어갔나 ───────────────────────\n");
  본다("이용자 이름", 칸(0, 1) === "기록지시험", 칸(0, 1));
  본다("생년월일", 칸(0, 3) === "1945-03-02", 칸(0, 3));
  본다("제공인력", 칸(1, 1) === "기록지인력", 칸(1, 1));
  본다("제공기관이 채워진다", 칸(1, 3).length > 0, 칸(1, 3));

  본다("첫 날짜가 7. 1. 로 적힌다", 칸(3, 1) === "7. 1.", 칸(3, 1));
  본다("여섯째 날짜가 7. 8. 로 적힌다", 칸(3, 6) === "7. 8.", 칸(3, 6));
  본다("시작시간", 칸(4, 1) === "09:00", 칸(4, 1));
  본다("종료시간", 칸(5, 1) === "11:00", 칸(5, 1));

  /*
   * 서식 맨 아래에 「* 당일 제공한 서비스 해당란에 ‘○’ 표시」라고
   * 적혀 있습니다. ☑ 도 V 도 아니고 **○** 입니다.
   */
  const R청소 = 6 + 6, R세탁 = 6 + 7, R목욕 = 6 + 0;
  본다("★ 한 것에 ‘○’ 가 찍힌다", 칸(R청소, 1) === "○", `청소 칸: 「${칸(R청소, 1)}」`);
  본다("★ 두 가지를 했으면 둘 다 찍힌다", 칸(R세탁, 1) === "○");
  본다("★ 안 한 것은 비어 있다", 칸(R목욕, 1) === "",
    `첫날 목욕보조: 「${칸(R목욕, 1)}」 — ○ 가 흘러가면 안 한 일이 적힙니다`);
  본다("셋째 날은 목욕보조만 찍힌다",
    칸(R목욕, 3) === "○" && 칸(R청소, 3) === "");

  본다("기타를 적는다", 칸(17, 3) === "화분에 물 줌", 칸(17, 3));
  /*
   * ★ 우리가 줄을 끊지 않았는지도 봅니다. 좁은 칸이라 `setCell` 의
   *   자동 줄바꿈을 켜 두면 「무릎이 / 아프시다고」로 잘립니다 —
   *   어디서 넘길지는 한글이 정할 일입니다.
   */
  본다("특이사항을 적는다", 칸(18, 1).replace(/\s+/g, " ").includes("무릎이 아프시다고"),
    JSON.stringify(칸(18, 1)));
  본다("★ 우리가 어절마다 줄을 끊지 않는다", !칸(18, 1).includes("\n"),
    "줄을 어디서 넘길지는 한글이 정합니다");
  본다("서명 받은 날에만 표시한다",
    칸(19, 1) === "(서명 받음)" && 칸(19, 2) === "",
    `1일 「${칸(19, 1)}」 · 2일 「${칸(19, 2)}」`);

  console.log("\n── 5. 서식이 적어 둔 글자 ★ ───────────────────────\n");
  /*
   * ★ 고르기 칸은 **네모만 채웁니다.** 칸을 통째로 갈아 끼우면
   *   「가사서비스」라는 서식의 글자까지 지우는 일이 됩니다.
   */
  본다("★ 「가사서비스」 글자가 그대로 있다", 칸(0, 5).includes("가사서비스"), 칸(0, 5));
  본다("★ 네모가 채워졌다", 칸(0, 5).includes("■"), 칸(0, 5));
  본다("★ 「월 12시간」 글자가 그대로 있다", 칸(1, 5).includes("12시간"), 칸(1, 5));
  본다("맨 아랫줄 안내문이 그대로다",
    칸(20, 0).includes("‘○’"), 칸(20, 0).slice(0, 40));

  console.log("\n── 6. 둘째 장 ─────────────────────────────────────\n");
  const d2 = new Hwpx(파일들[1].data);
  const t2 = d2.tables()[0];
  const 칸2 = (r: number, c: number) => String(d2.cellText(d2.cell(t2, r, c))).trim();
  본다("둘째 장에 일곱째 날이 들어간다", 칸2(3, 1) === "7. 9.", 칸2(3, 1));
  본다("★ 둘째 장의 남는 기둥은 비어 있다", 칸2(3, 2) === "" && 칸2(4, 2) === "",
    "안 간 날에 값이 남아 있으면 안 됩니다");
  본다("둘째 장에도 이용자 이름이 있다", 칸2(0, 1) === "기록지시험");

  // ══════════════════════════════════════════════════════════
  //  서식5 — 병원동행 · 이미용
  // ══════════════════════════════════════════════════════════
  console.log("\n── 7. 서식5 동행·이미용 ★ ─────────────────────────\n");

  const j = db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','이동지원','병원동행','시험동행(기록지)','hour',24000,NULL,'time',NULL,0,0,0,0,901,1,1)`,
    [프로필.id, `URB2-${randomUUID().slice(0, 6)}`]);
  const 동행 = Number(j.lastInsertRowid); 만든서비스.push(동행);

  const a2 = db.run(
    `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
     VALUES (?,?,?,?,?,'x')`, [사람, 동행, 만든종사자, 모든요일, `${달}-01`]);
  배정.push(Number(a2.lastInsertRowid));

  function 동행넣기(일: number, 속: any) {
    const 날 = `${달}-${String(일).padStart(2, "0")}`;
    db.run(
      `INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                             is_holiday,planned,start_at,end_at,payload,created_at)
       VALUES (?,?,?,?, '제공',0,1,?,?,?,'x')`,
      [배정[1], 사람, 동행, 날,
       속.시작 ? `${날}T${속.시작}:00` : null,
       속.종료 ? `${날}T${속.종료}:00` : null,
       JSON.stringify({ 현장: { 적은것: 속.적은것 ?? {}, 서명: 속.서명 ?? null } })]);
  }

  동행넣기(5, {
    시작: "09:30", 종료: "12:00",
    적은것: {
      장소: "해남종합병원 정형외과",
      내용: "1. 병원까지 동행\n2. 접수·수납 도움\n3. 처방전 수령\n4. 귀가 동행",
      특이사항: "다음 진료 예약 8월 3일",
    },
    서명: "data:image/png;base64,AAAA",
  });
  동행넣기(12, {
    시작: "14:00", 종료: "15:30",
    적은것: { 장소: "해남 미용실", 내용: "1. 이발\n2. 귀가 동행" },
  });

  const g5 = 모으기(배정[1], 달);
  본다("동행을 서식5 갈래로 가린다", g5.갈래 === "동행", g5.갈래);

  const 동행파일 = 만들기(배정[1], 달);
  본다("두 회차면 한 장이다", 동행파일.length === 1, 동행파일[0].name);
  본다("파일 이름이 서식5", 동행파일[0].name.includes("_서식5_"), 동행파일[0].name);

  const 원본5 = new Hwpx(readFileSync(join(서식폴더(), "병원동행·이미용 제공기록지(서식5).hwpx")));
  const 원표5 = 원본5.tables()[0];
  const d5 = new Hwpx(동행파일[0].data);
  const t5 = d5.tables()[0];
  const 칸5 = (r: number, c: number) => String(d5.cellText(d5.cell(t5, r, c))).trim();

  본다("★ 줄 수가 원본과 같다",
    d5.rows(t5).length === 원본5.rows(원표5).length,
    `${d5.rows(t5).length} / 원본 ${원본5.rows(원표5).length}`);
  {
    const 칸수같나 = d5.rows(t5).every((tr, r) =>
      d5.cells(tr).length === 원본5.cells(원본5.rows(원표5)[r]).length);
    본다("★ 줄마다 칸 수도 같다 (서식5 는 줄마다 다릅니다)", 칸수같나);
  }

  본다("이용자 이름", 칸5(2, 1) === "기록지시험", 칸5(2, 1));
  본다("제공인력", 칸5(2, 5) === "기록지인력", 칸5(2, 5));
  /*
   * ★ **기관 이름을 못박지 않습니다** (2026-09-07 고침).
   *   예전에는 「해남」이 들어 있는지 봤는데, 기관 이름은 설정에서
   *   바꾸는 값입니다. 이름을 바꾸는 순간 멀쩡한 서식이 시험에서
   *   틀린 것이 됩니다 — 실제로 그렇게 됐습니다.
   *   봐야 할 것은 **서식이 적어 둔 이름표가 안 지워졌는가**와
   *   **그 자리에 우리 기관 이름이 들어갔는가** 둘입니다.
   */
  const 기관이름 = String(
    (db.query<any, []>("SELECT name FROM organization WHERE id = 1").get())?.name ?? "");
  본다("제공기관명 이름표가 남아 있다",
    칸5(1, 0).includes("제공기관명") &&
    (!기관이름 || 칸5(1, 0).includes(기관이름)),
    `${칸5(1, 0)} (기관 「${기관이름}」)`);

  /*
   * ★ 회차 칸은 「1회차 ( / ) ( : ) ( : )」 모양입니다.
   *   괄호 **안쪽만** 채워야 합니다 — 「1회차」와 괄호는 서식이 그린 것입니다.
   */
  const 회차1 = 칸5(4, 0).replace(/\s+/g, " ");
  본다("★ 「1회차」 글자가 그대로 있다", 회차1.startsWith("1회차"), 회차1);
  본다("★ 괄호 안에 월/일이 들어간다", /\(\s*7\s*\/\s*5\s*\)/.test(회차1), 회차1);
  본다("★ 시작·종료가 차례로 들어간다",
    회차1.includes("09:30") && 회차1.includes("12:00"), 회차1);

  본다("제공 장소", 칸5(4, 1) === "해남종합병원 정형외과", 칸5(4, 1));
  {
    // 내용은 서식이 갈라 놓은 칸 수만큼 나뉩니다 (r4 는 둘).
    const 앞 = 칸5(4, 2), 뒤 = 칸5(4, 3);
    본다("★ 서비스 내용이 갈라진 칸에 나뉘어 들어간다",
      앞.includes("병원까지 동행") && 뒤.includes("귀가 동행"),
      `앞「${앞.replace(/\n/g, " / ")}」 뒤「${뒤.replace(/\n/g, " / ")}」`);
    본다("줄이 가운데서 안 끊긴다",
      !앞.includes("1. 병원까지 동") || 앞.includes("1. 병원까지 동행"));
  }
  본다("이용자 서명", 칸5(4, 4) === "(서명 받음)", 칸5(4, 4));

  // 둘째 회차는 칸이 넷인 줄입니다 — 서명 자리가 c3.
  본다("★ 칸이 넷인 줄도 서명이 마지막 칸에 간다",
    칸5(5, 0).includes("2회차") && 칸5(5, 3) === "",
    `2회차 서명칸: 「${칸5(5, 3)}」 (서명 안 받은 회차)`);
  본다("둘째 회차 장소", 칸5(5, 1) === "해남 미용실", 칸5(5, 1));

  본다("★ 안 쓴 회차는 서식 모양 그대로다",
    칸5(6, 0).includes("3회차") && !/\d+\s*\/\s*\d+/.test(칸5(6, 0)),
    칸5(6, 0).replace(/\s+/g, " "));

  본다("비고에 그 달 특이사항이 모인다",
    칸5(11, 0).includes("다음 진료 예약"), 칸5(11, 0).slice(0, 50));
  본다("맨 아랫줄 안내문이 그대로다", 칸5(12, 0).includes("본 양식은"));

  // ══════════════════════════════════════════════════════════
  //  서식4 — 식사 관리 (가장 까다로운 것)
  // ══════════════════════════════════════════════════════════
  console.log("\n── 8. 서식4 식사관리 ★ ────────────────────────────\n");

  const m = db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','식사지원','식사배달','시험식사(기록지)','count',7000,NULL,'meal',NULL,0,0,0,0,902,1,1)`,
    [프로필.id, `URB3-${randomUUID().slice(0, 6)}`]);
  const 식사 = Number(m.lastInsertRowid); 만든서비스.push(식사);

  const a3 = db.run(
    `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
     VALUES (?,?,?,?,?,'x')`, [사람, 식사, 만든종사자, 모든요일, `${달}-01`]);
  배정.push(Number(a3.lastInsertRowid));

  function 식사넣기(일: number, 속: any) {
    const 날 = `${달}-${String(일).padStart(2, "0")}`;
    db.run(
      `INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                             is_holiday,planned,start_at,end_at,payload,created_at)
       VALUES (?,?,?,?, '제공',0,1,?,?,?,'x')`,
      [배정[2], 사람, 식사, 날,
       속.시작 ? `${날}T${속.시작}:00` : null, null,
       JSON.stringify({ 현장: { 적은것: 속.적은것 ?? {}, 서명: 속.서명 ?? null } })]);
  }

  식사넣기(2, { 시작: "09:10", 적은것: {
    제공형태: "대면 배달", 장소: "자택 현관",
    주식: "흰죽", 반찬: "계란찜, 김치",
    특이사항: "간을 싱겁게 해 달라고 하셨습니다" } });
  식사넣기(4, { 시작: "09:20", 적은것: {
    제공형태: "비대면 배달", 장소: "문 앞",
    주식: "잣죽", 반찬: "두부조림, 나물" } });
  식사넣기(7, { 시작: "09:05", 적은것: {
    제공형태: "대면 배달", 장소: "자택 현관", 주식: "호박죽", 반찬: "생선구이" },
    서명: "data:image/png;base64,AAAA" });

  const g4 = 모으기(배정[2], 달);
  본다("식사를 서식4 갈래로 가린다", g4.갈래 === "식사", g4.갈래);

  const 식사파일 = 만들기(배정[2], 달);
  본다("세 회차면 한 장이다", 식사파일.length === 1, 식사파일[0].name);
  본다("파일 이름이 서식4", 식사파일[0].name.includes("_서식4_"));

  const 원본4 = new Hwpx(readFileSync(join(서식폴더(), "식사 관리 제공기록지(서식4).hwpx")));
  const 원표4 = 원본4.tables()[0];
  const d4 = new Hwpx(식사파일[0].data);
  const t4 = d4.tables()[0];
  const 칸4 = (r: number, c: number) => String(d4.cellText(d4.cell(t4, r, c))).trim();
  const 한줄 = (r: number, c: number) => 칸4(r, c).replace(/\s+/g, " ");

  본다("★ 줄 수가 원본과 같다",
    d4.rows(t4).length === 원본4.rows(원표4).length,
    `${d4.rows(t4).length} / 원본 ${원본4.rows(원표4).length}`);
  {
    const 칸수같나 = d4.rows(t4).every((tr, r) =>
      d4.cells(tr).length === 원본4.cells(원본4.rows(원표4)[r]).length);
    본다("★ 줄마다 칸 수도 같다", 칸수같나);
  }

  본다("이용자 이름", 칸4(2, 1) === "기록지시험");
  본다("제공기관명 이름표가 남아 있다", 칸4(1, 0).includes("제공기관명"));

  // ── 회차 칸 (두 회차가 한 칸) ──
  const 첫묶음 = 한줄(4, 0);
  본다("★ 「1회차」·「2회차」 글자가 그대로 있다",
    첫묶음.includes("1회차") && 첫묶음.includes("2회차"), 첫묶음);
  본다("★ 첫 회차 날짜가 들어간다", /\(\s*7\s*\/\s*2\s*\)/.test(첫묶음), 첫묶음);
  본다("★ 둘째 회차 날짜도 같은 칸에 들어간다",
    /\(\s*7\s*\/\s*4\s*\)/.test(첫묶음), 첫묶음);
  본다("★ 배달시간이 들어간다",
    첫묶음.includes("09 : 10") && 첫묶음.includes("09 : 20"), 첫묶음);

  /*
   * ★★ 여기가 서식4 의 고갱이입니다 ★★
   *   편람 작성예시가 서식에 그대로 박혀 있습니다. 안 지우면
   *   **남의 집 식단이 우리 어르신 기록지에 실려 나갑니다.**
   */
  console.log("\n── 9. 편람 예시가 남지 않았나 ★★ ──────────────────\n");
  const 온글 = d4.rows(t4).map((tr) =>
    d4.cells(tr).map((tc) => String(d4.cellText(tc))).join(" ")).join("\n");
  for (const 예시 of ["콩나물 무침", "미역줄기", "닭갈비", "훈제오리",
                      "저염 식단 요청", "치과치료"]) {
    본다(`★ 예시 「${예시}」가 지워졌다`, !온글.includes(예시));
  }
  본다("★ 예시 날짜 11월이 안 남았다", !/\(\s*11\s*\/\s*[47]\s*\)/.test(온글),
    "안 지우면 11월 4일이 7월 기록지에 남습니다");

  console.log("\n── 10. 식단이 제자리에 ─────────────────────────────\n");
  본다("첫 회차 주식", 칸4(5, 1) === "흰죽", 칸4(5, 1));
  본다("둘째 회차 주식은 옆 칸에", 칸4(5, 2) === "잣죽", 칸4(5, 2));
  본다("첫 회차 반찬", 칸4(6, 1) === "계란찜, 김치", 칸4(6, 1));
  본다("둘째 회차 반찬", 칸4(6, 2) === "두부조림, 나물", 칸4(6, 2));
  본다("제공 형태가 둘 다 적힌다",
    한줄(4, 1).includes("대면 배달") && 한줄(4, 1).includes("비대면 배달"),
    한줄(4, 1));
  본다("특이사항에 날짜가 붙는다",
    칸4(7, 1).includes("7. 2.") && 칸4(7, 1).includes("싱겁게"), 한줄(7, 1));
  본다("셋째 회차는 둘째 묶음으로", 한줄(8, 0).includes("3회차")
    && /\(\s*7\s*\/\s*7\s*\)/.test(한줄(8, 0)), 한줄(8, 0));
  본다("★ 안 쓴 네 번째 회차는 빈 괄호다",
    !/\d/.test(한줄(8, 0).split("4회차")[1] ?? ""),
    (한줄(8, 0).split("4회차")[1] ?? "").trim());
  본다("맨 아랫줄 안내문이 그대로다", 칸4(39, 0).includes("본 양식은"));

} catch (e: any) {
  실패수++;
  console.log(`\n✗ 실패  시험 도중 터짐 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 4).join("\n"));
} finally {
  db.run("DELETE FROM delivery WHERE recipient_id = ?", [사람]);
  for (const a of 배정) db.run("DELETE FROM assignment WHERE id = ?", [a]);
  db.run("DELETE FROM recipient WHERE id = ?", [사람]);
  for (const s of 만든서비스) db.run("DELETE FROM service WHERE id = ?", [s]);
  try {
    if (만든종사자) db.run("DELETE FROM worker WHERE id = ?", [만든종사자]);
    if (만든사람) db.run("DELETE FROM app_user WHERE id = ?", [만든사람]);
  } catch { }
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
