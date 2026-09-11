/**
 * 확인사항 항목 — 고치고, 얼리고, 서식에 담기까지 —  bun 확인사항시험.ts
 *
 * ═══════════════════════════════════════════════════════════
 *  왜 이 시험이 있나
 * ═══════════════════════════════════════════════════════════
 *
 * (2026-09-06 무무 — 「가사지원 확인사항은 **기관의 입맛에 변경하여
 *  사용할 수 있도록** 설정에서 항목을 추가/삭제 할 수 있는 기능을 넣자」)
 *
 * (2026-09-06 무무 — 「확인사항 항목이 바뀔 경우 **실행 시의 목록**으로
 *  서식을 뽑아. 변경된 항목으로 뽑을 경우 **일을 한 기록이 표시되지
 *  않는 문제**가 발생 되.」)
 *
 * ── 이 기능이 잘못되면 나는 일 ──────────────────────────────
 *
 *  ① 3월에 「말벗」을 눌러 둔 기록이, 6월에 「말벗」을 목록에서 지우는
 *     순간 **종이에서 사라집니다.** 다녀와서 한 일이 목록을 고쳤다는
 *     이유로 없어지는 것입니다. 군에 이미 낸 3월치와 다시 뽑은 3월치가
 *     다른 종이가 됩니다.
 *  ② 기관이 더한 항목(「약 챙겨 드리기」)이 갈 데가 없어 **버려집니다.**
 *     일을 하고도 종이에 안 남습니다.
 *  ③ 서식3 에 줄을 더해 버리면 **지자체에 내는 서식을 고친 것**이
 *     됩니다 (무무 — 「세상에 지자체에 제출하는 서류의 서식을 마음대로
 *     수정하는 경우는 없어」).
 *  ④ 목록을 앱에 박아 두면 항목 하나 더할 때마다 **앱을 다시 올리고
 *     제공인력 폰마다 새로 받아야** 합니다.
 *
 * ── 그래서 이 시험이 보는 것 ────────────────────────────────
 *
 *  ①  손 안 댄 기관은 편람 열한 가지 그대로
 *  ②  고치면 **새 버전**이 생긴다 (옛 버전은 그대로 남는다)
 *  ③  같은 목록을 다시 저장하면 버전이 안 늘어난다
 *  ④  못 쓸 목록은 막는다 (빈 목록 · 겹침 · 너무 긴 글 · 너무 많은 항목)
 *  ⑤  ★ **옛 실적은 옛 목록으로 읽힌다** — 지운 항목도 그대로
 *  ⑥  ★ 서식3 은 **열한 줄 그대로**, 더한 항목은 **「기타」 칸으로**
 *  ⑦  ★ 목록이 **오늘 갈 곳 짐에 실려** 폰으로 간다
 *  ⑧  ★ 폰이 보낸 버전이 실적에 박힌다
 *  ⑨  사무실이 손으로 적은 건도 그때 목록으로 얼린다
 *  ⑩  돌고 있는 서버에서 진짜로 저장된다 · 관리자만 고친다
 *
 * ── 무는지 확인했습니다 (아래 「망가뜨려 보기」에 자세히) ───
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { db, initDb } from "./server/db";
import { hashPassword } from "./server/auth";
initDb();
import {
  편람항목, 지금목록, 버전목록, 목록정하기, 목록이력,
  서식몫나누기, 기타한줄,
} from "./server/확인사항";
import { 그날갈곳 } from "./server/할일보내기";
import { 실적에넣기 } from "./server/보고받기";
import { month as 계획달, 현장적기 } from "./server/record";

let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: unknown, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}
const 터지나 = (f: () => unknown): string | null => {
  try { f(); return null; } catch (e: any) { return String(e?.message ?? e); }
};

const 오늘 = new Date().toISOString().slice(0, 10);
const 올해 = Number(오늘.slice(0, 4));

const 사람 = randomUUID();
let 서비스 = 0, 배정 = 0, 계정: number | null = null, 인력: number | null = null;
const 지울계정: number[] = [];
const 지울버전: number[] = [];
/** 시험 전 상태로 되돌리려고 들고 있습니다. */
const 시작한때 = new Date().toISOString();
const 처음버전 = 지금목록();

try {
  const 프로필: any = db.query(
    `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id
      WHERE o.id = 1`).get();
  if (!프로필) throw new Error("기관이 없습니다. 통돌 Note 를 한 번 켜 주세요.");

  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at)
          VALUES (?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: "확인시험", phone: "010-0000-0000" }),
     "해남읍", "이용", `${올해 - 1}-01-01`, "x"]);

  const u = db.run(
    `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload,
                           mailbox_worker_id, created_at)
     VALUES ('확인인력', ?, 'x', 'worker', '["worker"]', 'active', '{}', ?, 'x')`,
    [`chk-${randomUUID().slice(0, 8)}`, randomUUID()]);
  계정 = Number(u.lastInsertRowid);
  인력 = Number(db.run(
    `INSERT INTO worker (user_id, hired_on, status, created_at) VALUES (?,?, 'active','x')`,
    [계정, `${올해 - 1}-01-01`]).lastInsertRowid);

  서비스 = Number(db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','가사지원','청소·빨래','확인시험가사','hour',24000,NULL,'time',
             NULL,0,0,0,0,960,1,1)`,
    [프로필.id, `CHK-${randomUUID().slice(0, 6)}`]).lastInsertRowid);

  db.run(
    `INSERT INTO referral (batch_label, recipient_id, service_id, period_from,
                           cycle_unit, cycle_count, cycle_text, diff_state, created_at)
     VALUES ('시험', ?, ?, ?, 'month', 20, '월 20회', '신규', 'x')`,
    [사람, 서비스, `${올해 - 1}-01-01`]);
  배정 = Number(db.run(
    `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
     VALUES (?,?,?,'[]',?,'x')`,
    [사람, 서비스, 인력, `${올해 - 1}-01-01`]).lastInsertRowid);

  // ══════════════════════════════════════════════════════════
  //  ① 손 안 댄 기관
  // ══════════════════════════════════════════════════════════
  console.log("\n── ① 손 안 댄 기관은 편람 그대로 ★ ─────────────\n");
  본다("편람이 열한 가지다", 편람항목.length === 11, 편람항목.join(" · "));
  본다("★ 「목욕보조」로 시작해 「말벗」으로 끝난다",
    편람항목[0] === "목욕보조" && 편람항목[10] === "말벗",
    "편람 서식3 의 번호와 말을 그대로 씁니다");
  본다("★ 버전이 없으면 편람으로 푼다", 버전목록(null).join("|") === 편람항목.join("|"));
  본다("★ 없는 버전을 물어도 편람으로 푼다", 버전목록(999999).length === 11,
    "버전이 사라졌다고 그날 한 일이 화면에서 없어지면 안 됩니다");

  // ══════════════════════════════════════════════════════════
  //  ② 고치면 새 버전
  // ══════════════════════════════════════════════════════════
  console.log("\n── ② 고치면 **새 버전**이 생긴다 ★★ ──────────────\n");
  /*
   * ★ **편람 그대로를 저장하면 버전을 안 만듭니다.**
   *
   *   손 안 댄 기관의 자료함에 뜻 없는 줄이 쌓이지 않게 하려는 것입니다.
   *   그 상태의 실적은 버전이 비고, 읽을 때 편람으로 풀립니다 — 결과가
   *   같으므로 종이도 같습니다.
   */
  본다("★ 편람 그대로를 저장하면 버전을 안 만든다",
    목록정하기([...편람항목], "시험").버전 === null,
    "손 안 댄 기관의 자료함에 뜻 없는 줄이 쌓이면 안 됩니다");

  const 첫버전 = 목록정하기([...편람항목, "옛날에만 있던 것"], "시험");
  if (첫버전.버전) 지울버전.push(첫버전.버전);
  본다("★ 항목을 더하면 버전이 생긴다", !!첫버전.버전, `버전 ${첫버전.버전}`);
  본다("그때는 「말벗」이 아직 있다", 버전목록(첫버전.버전).includes("말벗"));
  본다("그때는 「약 챙겨 드리기」가 아직 없다",
    !버전목록(첫버전.버전).includes("약 챙겨 드리기"));

  const 새목록 = [...편람항목.filter((x) => x !== "말벗"), "약 챙겨 드리기"];
  const 둘째 = 목록정하기(새목록, "시험", "기관 사정");
  if (둘째.버전) 지울버전.push(둘째.버전);
  본다("★★ 고치면 버전 번호가 달라진다", 둘째.버전 !== 첫버전.버전,
    `${첫버전.버전} → ${둘째.버전} — 같은 줄을 고치면 옛 기록이 갈 곳을 잃습니다`);
  본다("지금 목록이 새것이다", 지금목록().버전 === 둘째.버전);
  본다("★★ 옛 버전은 그대로 남아 있다",
    버전목록(첫버전.버전).includes("말벗"),
    "지운 「말벗」이 옛 버전에는 아직 있습니다");
  본다("★ 새 버전에는 지운 것이 없다", !버전목록(둘째.버전).includes("말벗"));
  본다("★ 더한 것이 새 버전에 있다", 버전목록(둘째.버전).includes("약 챙겨 드리기"));
  본다("바꾼 기록이 남는다",
    (db.query<any, []>(
      `SELECT COUNT(*) AS c FROM rule_change_log WHERE field = '확인사항 항목'`
    ).get()?.c ?? 0) > 0,
    "「왜 6월부터 종이 모양이 다르지」를 나중에 설명할 수 있어야 합니다");
  본다("이력에 새것이 맨 위로 온다", 목록이력()[0]?.버전 === 둘째.버전);

  // ══════════════════════════════════════════════════════════
  //  ③ 같은 목록은 버전을 안 늘린다
  // ══════════════════════════════════════════════════════════
  console.log("\n── ③ 같은 목록을 다시 저장해도 ─────────────────\n");
  {
    const 또 = 목록정하기([...새목록], "시험");
    본다("★ 버전이 안 늘어난다", 또.버전 === 둘째.버전,
      "저장을 두 번 눌렀다고 버전이 갈리면, 나오는 종이는 같은데 버전만 늘어납니다");
    const 셋째 = 목록정하기([...새목록].reverse(), "시험");
    if (셋째.버전) 지울버전.push(셋째.버전);
    본다("★ 순서만 바꿔도 새 버전이다", 셋째.버전 !== 둘째.버전,
      "순서가 곧 폰 화면의 순서라, 순서를 바꾸는 것도 고치는 일입니다");
    목록정하기(새목록, "시험");   // 되돌려 둡니다
  }

  // ══════════════════════════════════════════════════════════
  //  ④ 못 쓸 목록은 막는다
  // ══════════════════════════════════════════════════════════
  console.log("\n── ④ 못 쓸 목록은 막는다 ★ ────────────────────\n");
  본다("★ 빈 목록은 막는다",
    (터지나(() => 목록정하기([], "시험")) ?? "").includes("하나는"),
    터지나(() => 목록정하기([], "시험")) ?? "");
  본다("★ 공백만 적은 것도 빈 목록으로 본다",
    !!터지나(() => 목록정하기(["  ", ""], "시험")));
  본다("★ 겹치는 항목은 막는다",
    (터지나(() => 목록정하기(["청소", "세탁", "청소"], "시험")) ?? "").includes("두 번"),
    터지나(() => 목록정하기(["청소", "세탁", "청소"], "시험")) ?? "");
  본다("★ 너무 긴 항목은 막는다",
    (터지나(() => 목록정하기(["가".repeat(21)], "시험")) ?? "").includes("20자"),
    "폰 화면에 한 줄로 들어가야 합니다");
  본다("★ 스무 가지를 넘으면 막는다",
    !!터지나(() => 목록정하기(
      Array.from({ length: 21 }, (_, i) => `항목${i}`), "시험")),
    "폰에서 스무 칸을 넘으면 아무도 안 누릅니다");
  본다("목록이 아닌 것을 주면 막는다", !!터지나(() => 목록정하기("청소" as any, "시험")));
  본다("앞뒤 공백은 다듬는다",
    (() => { const r = 목록정하기(["  청소  ", "세탁"], "시험");
             if (r.버전) 지울버전.push(r.버전);
             return r.항목[0] === "청소"; })());
  본다("막힌 뒤에도 지금 목록은 안 다쳤다", 지금목록().항목.length === 2,
    "위에서 막힌 것들이 조용히 반쯤 저장되면 안 됩니다");
  { const r = 목록정하기(새목록, "시험"); if (r.버전) 지울버전.push(r.버전); }

  // ══════════════════════════════════════════════════════════
  //  ⑤ ★★ 옛 실적은 옛 목록으로 ★★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑤ **옛 실적은 옛 목록으로 읽힌다** ★★ ───────\n");
  const 옛날 = `${오늘.slice(0, 7)}-03`;
  {
    // 첫 버전(말벗이 있던 때)으로 적힌 건
    db.run(
      `INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                             is_holiday,planned,minutes,payload,check_set_id,created_at)
       VALUES (?,?,?,?,'제공',0,1,120,?,?,'x')`,
      [배정, 사람, 서비스, 옛날,
       JSON.stringify({ 현장: { 적은것: { 한것: ["청소", "말벗"], 기타: "" } } }),
       첫버전.버전]);

    const 달: any = 계획달(오늘.slice(0, 7), { q: "확인시험" });
    const 목록: any[] = 달.items ?? [];
    const 항 = 목록.find((x) => Number(x.serviceId) === 서비스);
    const 칸 = 항?.cells?.find((c: any) => c.on === 옛날);
    본다("그 칸을 찾았다", !!칸);
    본다("★★ 그 칸은 **옛 목록**으로 온다", 칸?.확인사항?.includes("말벗") === true,
      `${(칸?.확인사항 ?? []).length}가지 — 지금 목록에는 「말벗」이 없습니다`);
    본다("★★ 지금 목록으로 오지 않는다", !칸?.확인사항?.includes("약 챙겨 드리기"),
      "지금 목록으로 그리면 관리자가 저장하는 순간 「말벗」이 진짜로 없어집니다");

    const 빈칸 = 항?.cells?.find((c: any) => c.on !== 옛날 && c.state === "계획");
    if (빈칸) 본다("★ 아직 안 적은 칸은 **지금 목록**", 빈칸.확인사항?.includes("약 챙겨 드리기") === true,
      "이제부터 적을 것이니까요");
    본다("맨 위에 지금 목록도 같이 온다", 달.확인사항?.includes("약 챙겨 드리기") === true);
  }

  // ══════════════════════════════════════════════════════════
  //  ⑥ ★★ 서식3 은 열한 줄 그대로 ★★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑥ **서식은 안 건드리고, 더한 것은 「기타」로** ★★ ─\n");
  {
    const 서식이름 = [...편람항목];
    const 몫 = 서식몫나누기(
      ["청소", "세탁", "약 챙겨 드리기", "화분 물주기"], 서식이름);
    본다("★ 서식에 있는 것은 그 줄에 찍는다",
      몫.서식줄.has("청소") && 몫.서식줄.has("세탁"));
    본다("★★ 서식에 없는 것은 서식 줄에 안 들어간다",
      !몫.서식줄.has("약 챙겨 드리기"),
      "밀어 넣으면 지자체에 내는 서식을 고치는 일이 됩니다");
    본다("★★ 서식에 없는 것이 **버려지지 않는다**",
      몫.기타몫.length === 2 &&
      몫.기타몫.includes("약 챙겨 드리기") && 몫.기타몫.includes("화분 물주기"),
      `${몫.기타몫.join(" · ")} — 버리면 일을 하고도 종이에 안 남습니다`);
    본다("★ 「기타」 칸 한 줄로 이어 붙는다",
      기타한줄(몫.기타몫, "") === "약 챙겨 드리기 · 화분 물주기",
      기타한줄(몫.기타몫, ""));
    본다("★ 손으로 적은 기타가 **뒤에** 붙는다",
      기타한줄(몫.기타몫, "약 봉투 정리") === "약 챙겨 드리기 · 화분 물주기 · 약 봉투 정리",
      "눌러서 남은 사실이 앞, 덧붙인 말이 뒤");
    본다("고른 것이 없으면 손으로 적은 것만", 기타한줄([], "약 봉투 정리") === "약 봉투 정리");
    본다("둘 다 없으면 빈 칸", 기타한줄([], "") === "");
    본다("★ 서식 항목 수는 안 늘어난다", 서식이름.length === 11,
      "서식3 은 열한 줄입니다. 한 줄도 안 늘립니다");

    const 글 = readFileSync("server/제공기록지.ts", "utf8");
    본다("★★ 서식3 만드는 자리가 이 가름을 쓴다",
      /서식몫나누기\(하루\?\.한것[\s\S]{0,200}몫\.서식줄\.has\(이름\)/.test(글),
      "여기가 옛날 코드로 돌아가면 더한 항목이 조용히 사라집니다");
    본다("★★ 「기타」 칸이 그 나머지를 받는다",
      /기타한줄\(몫\.기타몫, 하루\?\.기타/.test(글));
  }

  // ══════════════════════════════════════════════════════════
  //  ⑦ ★ 목록이 폰으로 간다 ★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑦ **목록이 오늘 갈 곳 짐에 실린다** ★★ ──────\n");
  {
    const 갈곳 = 그날갈곳(오늘).filter((j) => j.배정번호 === 배정);
    본다("그 배정이 오늘 갈 곳에 있다", 갈곳.length === 1, `${갈곳.length}곳`);
    const 짐: any = 갈곳[0]?.짐 ?? {};
    본다("★★ 짐에 확인사항 목록이 실려 있다",
      Array.isArray(짐.확인사항) && 짐.확인사항.length > 0,
      `${(짐.확인사항 ?? []).length}가지 — 앱에 박아 두면 항목 하나 더할 때마다 앱을 다시 올려야 합니다`);
    본다("★★ 지금 목록이 실린다", 짐.확인사항?.includes("약 챙겨 드리기") === true);
    본다("★ 지운 항목은 안 실린다", !짐.확인사항?.includes("말벗"));
    본다("★★ 버전 번호도 같이 간다", Number(짐.확인버전) === Number(지금목록().버전),
      `버전 ${짐.확인버전} — 이 번호가 돌아와야 그때 목록으로 종이를 뽑습니다`);
  }

  // ══════════════════════════════════════════════════════════
  //  ⑧ ★ 폰이 보낸 버전이 실적에 박힌다 ★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑧ **폰이 보낸 버전이 실적에 박힌다** ★ ────────\n");
  {
    const 글 = readFileSync("server/보고받기.ts", "utf8");
    본다("★ 새 실적에 버전을 넣는다", /check_set_id, created_at\)/.test(글));
    본다("★ 있던 실적도 버전을 채운다",
      /check_set_id = COALESCE\(\?, check_set_id\)/.test(글),
      "COALESCE 라 이미 박힌 버전을 덮어쓰지 않습니다");

    /*
     * ★ **글만 훑지 않고 진짜로 넣어 봅니다.**
     *   위의 세 가지는 코드 모양을 보는 시험이라, 값을 바꾸는 손질에는
     *   안 걸립니다 (2026-09-07 에 확인했습니다 — `Number(짐.확인버전)` 을
     *   `null` 로 바꿔도 세 가지가 다 통과했습니다).
     */
    const 온날 = `${오늘.slice(0, 7)}-07`;
    const 지금버전 = 지금목록().버전;
    실적에넣기({
      id: randomUUID(), job_id: randomUUID(), worker_id: "x",
      started_at: `${온날}T09:00:00`, ended_at: `${온날}T11:00:00`, qr_ok: true,
      짐: {
        served_on: 온날, 이름: "확인시험", 서비스: "확인시험가사", 갈래: "가사",
        적은것: { 한것: ["청소", "약 챙겨 드리기"], 기타: "" },
        확인버전: 지금버전,
      },
    } as any, 배정);
    const 온줄: any = db.query(
      "SELECT check_set_id FROM delivery WHERE assignment_id = ? AND served_on = ?"
    ).get(배정, 온날);
    본다("★★ 폰이 보낸 버전이 진짜로 실적에 박힌다",
      Number(온줄?.check_set_id) === Number(지금버전),
      `버전 ${온줄?.check_set_id} (보낸 것 ${지금버전}) — 안 박히면 나중에 목록을 ` +
      `고쳤을 때 이 건이 새 목록으로 읽혀 누른 적 없는 칸에 ○ 가 찍힙니다`);

    /*
     * ── 옛 이름(`확인판`)으로 보낸 폰 ────────────────────────
     *
     * 2026-09-08 에 「판」을 모두 「버전」으로 바꿨습니다. 그런데
     * **제공인력 휴대폰에는 옛 화면이 캐시로 남아 있습니다.** 그 폰은
     * 아직 `확인판` 이라는 이름으로 보냅니다. 이름 하나 때문에 확인사항이
     * 조용히 빠지면 기록지에 체크가 안 찍히고, 아무도 못 알아챕니다.
     */
    const 옛이름날 = `${오늘.slice(0, 7)}-09`;
    실적에넣기({
      id: randomUUID(), job_id: randomUUID(), worker_id: "x",
      started_at: `${옛이름날}T09:00:00`, ended_at: `${옛이름날}T11:00:00`, qr_ok: true,
      짐: {
        served_on: 옛이름날, 갈래: "가사",
        적은것: { 한것: ["청소"] },
        확인판: 지금버전,                     // ← 옛 이름
      },
    } as any, 배정);
    const 옛이름줄: any = db.query(
      "SELECT check_set_id FROM delivery WHERE assignment_id = ? AND served_on = ?"
    ).get(배정, 옛이름날);
    본다("★★ 옛 이름(확인판)으로 보낸 폰의 것도 박힌다",
      Number(옛이름줄?.check_set_id) === Number(지금버전),
      `버전 ${옛이름줄?.check_set_id} (보낸 것 ${지금버전}) — 캐시가 남은 폰이 ` +
      `보낸 건입니다. 안 박히면 그 건만 확인사항이 통째로 빕니다`);

    // 버전을 안 보낸 옛 앱이 보낸 건
    const 옛온날 = `${오늘.slice(0, 7)}-08`;
    실적에넣기({
      id: randomUUID(), job_id: randomUUID(), worker_id: "x",
      started_at: `${옛온날}T09:00:00`, ended_at: `${옛온날}T10:00:00`, qr_ok: true,
      짐: { served_on: 옛온날, 갈래: "가사", 적은것: { 한것: ["청소"] } },
    } as any, 배정);
    const 옛줄: any = db.query(
      "SELECT check_set_id FROM delivery WHERE assignment_id = ? AND served_on = ?"
    ).get(배정, 옛온날);
    본다("★ 버전을 안 보낸 옛 앱의 건은 비워 둔다", 옛줄?.check_set_id == null,
      "억지로 지금 버전을 박으면, 그 폰이 실제로 보던 목록과 다른 목록으로 종이가 나옵니다");

    // 이미 박힌 건에 다시 보고가 와도 안 덮어씁니다
    실적에넣기({
      id: randomUUID(), job_id: randomUUID(), worker_id: "x",
      started_at: `${온날}T09:00:00`, ended_at: `${온날}T12:00:00`, qr_ok: true,
      짐: { served_on: 온날, 갈래: "가사", 적은것: { 한것: ["청소"] } },
    } as any, 배정);
    const 다시: any = db.query(
      "SELECT check_set_id FROM delivery WHERE assignment_id = ? AND served_on = ?"
    ).get(배정, 온날);
    본다("★ 이미 박힌 버전은 안 지운다", Number(다시?.check_set_id) === Number(지금버전),
      "COALESCE 라 뒤에 온 빈 값이 앞의 버전을 못 덮습니다");

    const 앱 = readFileSync("현장앱/올릴것/index.html", "utf8");
    본다("★★ 앱이 짐에서 목록을 읽는다", /function 확인사항목록\(p\)/.test(앱));
    본다("★★ 앱이 그 목록으로 칸을 그린다", /확인사항목록\(p\)\.map/.test(앱),
      "여기가 `가사항목.map` 으로 돌아가면 설정에서 고쳐도 폰은 옛 목록입니다");
    본다("★★ 앱이 버전을 되돌려 보낸다", /확인버전: p\.확인버전/.test(앱));
    본다("목록이 안 왔으면 편람으로 돈다",
      /Array\.isArray\(온것\) && 온것\.length \? 온것 : 가사항목/.test(앱),
      "옛 사무실 프로그램이 보낸 건도 화면이 비면 안 됩니다");
  }

  // ══════════════════════════════════════════════════════════
  //  ⑨ 사무실이 손으로 적은 건
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑨ 사무실이 손으로 적은 건도 얼린다 ★ ────────\n");
  {
    const 날 = `${오늘.slice(0, 7)}-05`;
    현장적기({
      assignId: 배정, on: 날, 누가: "시험관리자",
      값: { 시작: "09:00", 종료: "11:00", 적은것: { 한것: ["청소"], 기타: "" } },
    } as any);
    const 줄: any = db.query(
      "SELECT check_set_id FROM delivery WHERE assignment_id = ? AND served_on = ?"
    ).get(배정, 날);
    본다("★ 손으로 적은 건에도 버전이 박힌다",
      Number(줄?.check_set_id) === Number(지금목록().버전),
      `버전 ${줄?.check_set_id} — 안 박으면 나중에 목록을 고쳤을 때 이 건만 새 목록으로 읽힙니다`);

    // 목록을 또 고쳐도 이 건은 안 흔들립니다
    const 그때버전 = Number(줄?.check_set_id);
    const 넷째 = 목록정하기(["청소", "세탁"], "시험");
    if (넷째.버전) 지울버전.push(넷째.버전);
    현장적기({
      assignId: 배정, on: 날, 누가: "시험관리자",
      값: { 시작: "09:00", 종료: "12:00" },
    } as any);
    const 줄2: any = db.query(
      "SELECT check_set_id FROM delivery WHERE assignment_id = ? AND served_on = ?"
    ).get(배정, 날);
    본다("★★ 뒤에 시각만 고쳐도 버전이 안 바뀐다", Number(줄2?.check_set_id) === 그때버전,
      `버전 ${줄2?.check_set_id} — 시각 하나 고치려고 연 것이 그날 한 일을 지우면 안 됩니다`);
    { const r = 목록정하기(새목록, "시험"); if (r.버전) 지울버전.push(r.버전); }
  }

  // ══════════════════════════════════════════════════════════
  //  ⑩ 돌고 있는 서버
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑩ **설정에서 진짜로 저장되는가** ★★ ─────────\n");
  {
    const 주소 = "http://127.0.0.1:5757";
    const 계정만들기 = async (이름: string, 역할: string[]) => {
      const login = `chk-${randomUUID().slice(0, 8)}`;
      const id = Number(db.run(
        `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload, created_at)
         VALUES (?,?,?,?,?,'active','{}',?)`,
        [이름, login, await hashPassword("시험1234"), 역할[0], JSON.stringify(역할),
         new Date().toISOString()]).lastInsertRowid);
      지울계정.push(id);
      const r = await fetch(`${주소}/api/login`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ loginId: login, password: "시험1234" }),
      });
      return r.headers.get("set-cookie")?.split(";")[0] ?? "";
    };
    const 두드리기 = async (쿠키: string, 길: string, 옵션: RequestInit = {}) => {
      const r = await fetch(주소 + 길, {
        ...옵션,
        headers: { cookie: 쿠키, "content-type": "application/json", ...(옵션.headers ?? {}) },
      });
      let 몸: any = null; try { 몸 = await r.json(); } catch { }
      return { 상태: r.status, 몸 };
    };

    const 관 = await 계정만들기("확인시험관리자", ["admin"]);
    const 무 = await 계정만들기("확인시험사무", ["staff"]);
    const 력 = await 계정만들기("확인시험인력", ["worker"]);
    본다("관리자·사무·인력으로 들어갔다", !!관 && !!무 && !!력);

    const 봄 = await 두드리기(관, "/api/settings/check-items");
    본다("★ 지금 목록을 받아 온다",
      봄.상태 === 200 && Array.isArray(봄.몸?.지금?.항목),
      `${(봄.몸?.지금?.항목 ?? []).length}가지`);
    본다("편람 열한 가지도 같이 준다", (봄.몸?.편람 ?? []).length === 11,
      "화면의 「편람 열한 가지로」 단추가 이것을 씁니다");
    본다("바꾼 기록도 같이 준다", Array.isArray(봄.몸?.이력) && 봄.몸.이력.length > 0);

    const 냄 = await 두드리기(관, "/api/settings/check-items", {
      method: "POST",
      body: JSON.stringify({ items: ["청소", "세탁", "약 챙겨 드리기", "말동무"] }),
    });
    본다("★★ 관리자가 저장하면 저장된다", 냄.상태 === 200, JSON.stringify(냄.몸));
    if (냄.몸?.지금?.버전) 지울버전.push(Number(냄.몸.지금.버전));
    본다("★★ 자료함에 그대로 들어간다",
      지금목록().항목.join("|") === "청소|세탁|약 챙겨 드리기|말동무",
      지금목록().항목.join(" · "));

    const 나쁜 = await 두드리기(관, "/api/settings/check-items", {
      method: "POST", body: JSON.stringify({ items: [] }),
    });
    본다("★ 빈 목록은 서버가 막는다", 나쁜.상태 >= 400,
      String(나쁜.몸?.error ?? 나쁜.상태));
    본다("막힌 뒤에도 있던 목록은 안 다쳤다", 지금목록().항목.length === 4);

    const 사무 = await 두드리기(무, "/api/settings/check-items", {
      method: "POST", body: JSON.stringify({ items: ["청소"] }),
    });
    본다("★★ 사무직원은 못 고친다", 사무.상태 === 403,
      "설정을 바꾸는 것은 관리자만입니다");
    const 인력봄 = await 두드리기(력, "/api/settings/check-items");
    본다("★★ 제공인력은 보지도 못한다", 인력봄.상태 === 403);
    본다("막힌 뒤에도 목록이 그대로다", 지금목록().항목.length === 4,
      "403 인데 값이 바뀌어 있으면 막은 것이 아닙니다");
  }

} catch (e: any) {
  실패수++;
  console.log(`\n✗ 실패  시험 도중 터짐 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 5).join("\n"));
} finally {
  /*
   * ★ 시험 전 목록으로 되돌립니다. 안 그러면 시험을 한 번 돌릴 때마다
   *   기관의 확인사항 목록이 「청소·세탁·약 챙겨 드리기·말동무」로
   *   바뀐 채 남습니다.
   */
  try {
    /*
     * ★ **시험이 만든 버전만 골라 지웁니다.**
     *
     *   `지울버전` 에 담아 두는 것으로는 샙니다 — 시험 중간에 목록을
     *   되돌리는 부름이 여럿이라 하나만 빠뜨려도 줄이 남고, 그 줄이
     *   **다음 번 시험의 출발 상태를 바꿔서** 「두 번째로 돌리면
     *   실패하는」 시험이 됩니다 (2026-09-07 에 실제로 났습니다).
     *
     *   그래서 시작한 뒤에 생긴 것 중 시험이 만든 것을 통째로 지웁니다.
     */
    const 되돌릴것 = 처음버전.버전 == null ? null : 처음버전.항목;
    db.run(
      `DELETE FROM check_set
        WHERE made_at >= ? AND (who LIKE '시험%' OR who LIKE '확인시험%')`,
      [시작한때]);
    if (되돌릴것 && 지금목록().항목.join("|") !== 되돌릴것.join("|")) {
      // 되돌릴 버전까지 지워졌으면 같은 내용으로 하나 다시 세웁니다.
      목록정하기(되돌릴것, "시험되돌리기");
    }
    db.run(
      `DELETE FROM rule_change_log
        WHERE field = '확인사항 항목' AND changed_at >= ?
          AND (who LIKE '시험%' OR who LIKE '확인시험%')`, [시작한때]);
  } catch (e: any) {
    console.log(`  (뒷정리 중 — ${e?.message ?? e})`);
  }
  db.run("DELETE FROM delivery WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM sticky WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM referral WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM assignment WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM recipient WHERE id = ?", [사람]);
  if (서비스) { try { db.run("DELETE FROM service WHERE id = ?", [서비스]); } catch { } }
  try {
    if (인력) db.run("DELETE FROM worker WHERE id = ?", [인력]);
    if (계정) db.run("DELETE FROM app_user WHERE id = ?", [계정]);
    for (const a of 지울계정) db.run("DELETE FROM app_user WHERE id = ?", [a]);
  } catch { }
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
