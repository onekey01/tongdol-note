/**
 * 시범자료 넣기 · 지우기
 *
 *   「시범자료 넣기.bat」   —  bun 도구/시범자료.ts
 *   「시범자료 지우기.bat」 —  bun 도구/시범자료.ts 지우기
 *
 * ═══════════════════════════════════════════════════════════
 *  무엇에 쓰는 것인가
 * ═══════════════════════════════════════════════════════════
 *
 * 화면을 하나씩 눌러 보려면 **자료가 있어야** 합니다. 빈 자료함에서는
 * 달력도 비어 있고 정산도 0원이라, 무엇이 맞고 무엇이 틀렸는지
 * 알 길이 없습니다.
 *
 * 그래서 실제 기관 한 곳이 두 달쯤 돌아간 것처럼 채웁니다.
 * **모든 경우가 한 번씩** 나오게 골랐습니다 — 잘 된 것만 넣으면
 * 경고·한도·노쇼 화면을 볼 수가 없기 때문입니다.
 *
 * ═══════════════════════════════════════════════════════════
 *  ★ 지울 수 있게 만듭니다 ★
 * ═══════════════════════════════════════════════════════════
 *
 * 넣은 것은 전부 **표를 달아** 둡니다.
 *
 *   대상자 · 종사자 · 메모지 → 자기 칸(payload) 안에 `"시범": true`
 *   배정 · 실적 · 상태이력   → 시범 대상자에게 딸린 것이라 같이 지워집니다
 *
 * 「시범자료 지우기」는 **그 표가 달린 것만** 지웁니다. 손으로 넣으신
 * 진짜 자료는 건드리지 않습니다. 그래서 실제 기관 자료함에 대고
 * 실행하셔도 됩니다 — 다만 굳이 그러실 까닭은 없습니다.
 *
 * ── 서비스는 만들지 않습니다 ───────────────────────────────
 *
 * 서비스와 단가는 **기관이 설정에서 정하는 것**입니다. 시범자료가
 * 마음대로 만들면 「우리가 안 만든 서비스가 왜 있지」가 됩니다.
 * 지금 기관이 쓰는 지역 규칙에 이미 있는 서비스를 **찾아서** 씁니다.
 */
import { db, initDb } from "../server/db";
import { 글에맞는크기 } from "../server/sticky";
import { createStaff } from "../server/staff";
import { 집표 } from "../server/방문표";
import { 비대면다시셈 } from "../server/대면배달";

initDb();

const 지우기인가 = process.argv.slice(2).some((x) => x === "지우기" || x === "clear");

// ══════════════════════════════════════════════════════════════
//  날짜 셈 — 오늘을 기준으로 잡습니다
// ══════════════════════════════════════════════════════════════

const 이제 = () => new Date().toISOString();
const 오늘 = new Date().toISOString().slice(0, 10);
const 이번달 = 오늘.slice(0, 7);
const 지난달 = (() => {
  const d = new Date(`${오늘}T00:00:00`);
  d.setDate(1); d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();
/** 그 달의 마지막 날. */
const 말일 = (달: string) => {
  const [y, m] = 달.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};
const 날 = (달: string, d: number) => `${달}-${String(d).padStart(2, "0")}`;
const 요일 = (ymd: string) => new Date(`${ymd}T00:00:00`).getDay();
/** 달 안에서 그 요일에 해당하는 날들. 오늘까지만. */
function 그달의요일(달: string, dows: number[], 오늘까지 = true): string[] {
  const 것들: string[] = [];
  for (let d = 1; d <= 말일(달); d++) {
    const x = 날(달, d);
    if (오늘까지 && x > 오늘) break;
    if (dows.includes(요일(x))) 것들.push(x);
  }
  return 것들;
}
const 며칠전 = (n: number) =>
  new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);

// ══════════════════════════════════════════════════════════════
//  지우기
// ══════════════════════════════════════════════════════════════

function 지우기() {
  /*
   * 순서가 있습니다. 실적 → 배정 → 대상자.
   * 외래키가 CASCADE 로 걸려 있어도, 켜져 있지 않은 자료함이 있을 수
   * 있어 **손으로 순서를 지킵니다.**
   */
  const 사람들 = db.query<{ id: string }, []>(
    `SELECT id FROM recipient WHERE json_extract(payload,'$.시범') = 1`).all().map((r) => r.id);

  let 실적 = 0, 배정 = 0, 메모 = 0, 일지 = 0, 이력 = 0;
  for (const id of 사람들) {
    실적 += db.run("DELETE FROM delivery WHERE recipient_id = ?", [id]).changes;
    db.run("DELETE FROM field_reset WHERE assignment_id IN (SELECT id FROM assignment WHERE recipient_id = ?)", [id]);
    배정 += db.run("DELETE FROM assignment WHERE recipient_id = ?", [id]).changes;
    메모 += db.run("DELETE FROM sticky WHERE recipient_id = ?", [id]).changes;
    /* 대상자에 안 붙은 메모지는 아래 「적어 둔 번호」로 따로 지웁니다. */
    일지 += db.run("DELETE FROM record_note WHERE recipient_id = ?", [id]).changes;
    이력 += db.run("DELETE FROM status_change WHERE recipient_id = ?", [id]).changes;
    db.run("DELETE FROM consent WHERE recipient_id = ?", [id]);
    db.run("DELETE FROM billing WHERE recipient_id = ?", [id]);
    db.run("DELETE FROM referral WHERE recipient_id = ?", [id]);
    db.run("DELETE FROM recipient_change WHERE recipient_id = ?", [id]);
  }
  const 사람 = db.run(
    `DELETE FROM recipient WHERE json_extract(payload,'$.시범') = 1`).changes;

  /*
   * ★ **대상자에 안 붙은 메모지.**
   *
   * 「이번 달 마감은 5일까지」 같은 것은 어느 대상자의 것도 아닙니다.
   * 메모지 칸에는 표를 달 자리(payload)가 없어서, 넣을 때 **번호를
   * 적어 두었다가** 그 번호만 지웁니다.
   *
   * 글자를 맞춰 지우면 안 됩니다 — 관리자가 그 메모를 고쳐 두었으면
   * 안 지워지고, 우연히 같은 글을 쓰셨으면 **남의 메모가 지워집니다.**
   */
  let 떠있는메모 = 0;
  const 적어둔것 = db.query<{ value: string }, []>(
    "SELECT value FROM meta WHERE key = 'demo_sticky'").get();
  if (적어둔것) {
    for (const sid of JSON.parse(적어둔것.value || "[]") as number[])
      떠있는메모 += db.run("DELETE FROM sticky WHERE id = ?", [sid]).changes;
    db.run("DELETE FROM meta WHERE key = 'demo_sticky'");
  }
  메모 += 떠있는메모;

  /*
   * 종사자는 **계정**이라 조심합니다. 표가 달린 사람만, 그리고
   * 그 사람에게 남은 배정이 없을 때만 지웁니다.
   */
  const 인력들 = db.query<{ id: number; wid: number | null; name: string }, []>(
    `SELECT u.id, w.id AS wid, u.name FROM app_user u
       LEFT JOIN worker w ON w.user_id = u.id
      WHERE json_extract(u.payload,'$.시범') = 1`).all();
  let 사람지움 = 0, 남김: string[] = [];
  for (const u of 인력들) {
    const 남은 = u.wid
      ? db.query<{ c: number }, [number]>(
          "SELECT count(*) c FROM assignment WHERE worker_id = ?").get(u.wid)!.c
      : 0;
    if (남은 > 0) { 남김.push(`${u.name}(배정 ${남은}건)`); continue; }
    if (u.wid) db.run("DELETE FROM worker WHERE id = ?", [u.wid]);
    db.run("DELETE FROM session WHERE user_id = ?", [u.id]);
    db.run("DELETE FROM app_user WHERE id = ?", [u.id]);
    사람지움++;
  }

  console.log("");
  console.log(`  대상자   ${사람}명`);
  console.log(`  종사자   ${사람지움}명` + (남김.length ? `  (남김: ${남김.join(" · ")})` : ""));
  console.log(`  배정     ${배정}건`);
  console.log(`  제공실적 ${실적}건`);
  console.log(`  메모지   ${메모}장 · 월일지 ${일지}건 · 상태이력 ${이력}건`);
  console.log("\n시범자료를 지웠습니다.\n");
}

if (지우기인가) { 지우기(); process.exit(0); }

// ══════════════════════════════════════════════════════════════
//  넣기 — 준비
// ══════════════════════════════════════════════════════════════

const 기관 = db.query<any, []>("SELECT * FROM organization WHERE id = 1").get();
if (!기관) { console.log("기관이 없습니다. 통돌 Note 를 한 번 켜 주세요."); process.exit(1); }

/*
 * ★ **지금 기관이 쓰는 지역 규칙**의 서비스를 씁니다.
 *   설정에서 규칙을 바꾸면 서비스 묶음도 통째로 바뀌기 때문에,
 *   여기서 profile_id 를 못박으면 다른 기관에서 엉뚱한 것이 붙습니다.
 */
const 서비스들 = db.query<any, [number]>(
  "SELECT * FROM service WHERE profile_id = ? AND active = 1 ORDER BY sort_order, id"
).all(기관.profile_id);
if (!서비스들.length) {
  console.log("서비스가 없습니다. 설정 → 서비스에서 한 번 확인해 주세요.");
  process.exit(1);
}
const 서비스 = (조각: string) => {
  const x = 서비스들.find((s) => (s.name ?? "").includes(조각));
  if (!x) throw new Error(`「${조각}」 서비스를 못 찾았습니다. 설정 → 서비스를 봐 주세요.`);
  return x;
};

const 부담 = db.query<any, [number]>(
  "SELECT * FROM copay_tier WHERE profile_id = ? ORDER BY sort_order"
).all(기관.profile_id);
const 부담칸 = (율: number) => 부담.find((t) => Math.abs(t.rate - 율) < 0.001)?.id ?? null;

const 이미있나 = db.query<{ c: number }, []>(
  `SELECT count(*) c FROM recipient WHERE json_extract(payload,'$.시범') = 1`).get()!.c;
if (이미있나) {
  console.log(`\n이미 시범자료가 ${이미있나}명 들어 있습니다.`);
  console.log("먼저 「시범자료 지우기」를 하시고 다시 넣어 주세요.\n");
  process.exit(1);
}

// ══════════════════════════════════════════════════════════════
//  ① 종사자
// ══════════════════════════════════════════════════════════════

type 인력정의 = {
  이름: string; 아이디: string; 읍면동: string; 주소: string;
  역할: string[]; 사번: string; 입사: string;
  자격: { name: string; no: string; on: string }[];
  교육: { name: string; on: string; hours: string }[];
  휴직?: { 부터: string; 까지: string; 까닭: string };
  퇴사?: string;
  임금제외?: string;
  뜻: string;      // 이 사람이 무슨 경우를 맡는가 (화면에 설명할 때 씁니다)
};

const 인력들: 인력정의[] = [
  {
    이름: "최돌봄", 아이디: "care01", 읍면동: "해남읍",
    주소: "전남 해남군 해남읍 수성리 18", 역할: ["worker"], 사번: "W-001",
    입사: "2026-03-02",
    자격: [{ name: "요양보호사 1급", no: "제12345호", on: "2020-05-11" }],
    교육: [{ name: "인권교육", on: "2026-03-20", hours: "4" }],
    뜻: "평범한 제공인력 — 가장 많이 다닙니다",
  },
  {
    이름: "김손길", 아이디: "care02", 읍면동: "현산면",
    주소: "전남 해남군 현산면 월송리 40", 역할: ["worker"], 사번: "W-002",
    입사: "2025-11-04",
    자격: [
      { name: "요양보호사 1급", no: "제33210호", on: "2018-09-03" },
      { name: "사회복지사 2급", no: "제88123호", on: "2015-02-20" },
    ],
    교육: [
      { name: "인권교육", on: "2026-03-20", hours: "4" },
      { name: "안전교육", on: "2026-04-08", hours: "2" },
    ],
    뜻: "자격이 여럿인 제공인력",
  },
  {
    이름: "정보람", 아이디: "care03", 읍면동: "송지면",
    주소: "전남 해남군 송지면 산정리 7", 역할: ["worker", "staff"], 사번: "W-003",
    입사: "2024-01-15",
    자격: [{ name: "사회복지사 1급", no: "제55019호", on: "2012-08-14" }],
    교육: [{ name: "인권교육", on: "2026-03-20", hours: "4" }],
    임금제외: "복지관 정규직 — 타 사업 인건비로 지급",
    뜻: "사무직원을 겸하고, 임금은 별도관리",
  },
  {
    // ★ 휴직 — 배정 화면이 「휴직 중입니다」로 막는지 보려고 둡니다.
    이름: "한나눔", 아이디: "care04", 읍면동: "황산면",
    주소: "전남 해남군 황산면 우항리 22", 역할: ["worker"], 사번: "W-004",
    입사: "2025-06-10",
    자격: [{ name: "요양보호사 2급", no: "제77412호", on: "2019-11-30" }],
    교육: [{ name: "인권교육", on: "2026-03-20", hours: "4" }],
    휴직: { 부터: 며칠전(20), 까지: 날(이번달, Math.min(28, 말일(이번달))), 까닭: "가족 돌봄" },
    뜻: "★ 휴직 중 — 새 배정이 막히는지 보는 사람",
  },
  {
    // ★ 퇴사 — 목록에서 빠지고, 맡던 배정이 미배정으로 뜨는지 봅니다.
    이름: "배은혜", 아이디: "care05", 읍면동: "문내면",
    주소: "전남 해남군 문내면 우수영 5", 역할: ["worker"], 사번: "W-005",
    입사: "2025-02-01",
    자격: [{ name: "요양보호사 1급", no: "제21008호", on: "2017-04-19" }],
    교육: [],
    퇴사: 며칠전(9),
    뜻: "★ 퇴사 — 맡던 곳이 미배정으로 뜨는지 보는 사람",
  },
  {
    // ★ 외부업체 — 안전생활환경개선(공사형)을 맡습니다.
    이름: "해남안전건설 이기사", 아이디: "vendor01", 읍면동: "해남읍",
    주소: "전남 해남군 해남읍 고도리 101", 역할: ["vendor"], 사번: "V-001",
    입사: "2026-05-02", 자격: [], 교육: [],
    뜻: "★ 외부업체 — 공사형 서비스를 맡습니다",
  },
];

const 인력번호 = new Map<string, number>();   // 이름 → worker.id
const 계정번호 = new Map<string, number>();   // 이름 → app_user.id

for (const p of 인력들) {
  const 있던 = db.query<{ id: number }, [string]>(
    "SELECT id FROM app_user WHERE login_id = ?").get(p.아이디);
  let uid: number;
  if (있던) {
    uid = 있던.id;
    console.log(`  그대로  ${p.이름} (${p.아이디}) — 이미 있습니다`);
  } else {
    uid = await createStaff({
      name: p.이름, loginId: p.아이디, password: "care1234",
      phone: `010-${String(1000 + 인력들.indexOf(p) * 111).slice(0, 4)}-${String(2000 + 인력들.indexOf(p) * 137).slice(0, 4)}`,
      birth: ["1975-06-11", "1968-02-27", "1982-10-05", "1971-09-18", "1966-12-02", "1979-03-25"][인력들.indexOf(p)],
      address: p.주소,
      roles: p.역할, empNo: p.사번, hiredOn: p.입사, contractOn: p.입사,
      qualifications: p.자격, trainings: p.교육,
      ...(p.임금제외 ? { payrollExcluded: true, excludeReason: p.임금제외 } : {}),
    } as any);
    /*
     * ★ 표를 답니다. payload 안에 넣습니다 — 칸을 새로 만들면
     *   자료함 버전이 올라가 버리고, 그러면 시범자료 하나 때문에
     *   실제 기관 자료함이 바뀝니다.
     */
    const 속 = JSON.parse(
      db.query<{ payload: string }, [number]>(
        "SELECT payload FROM app_user WHERE id = ?").get(uid)!.payload || "{}");
    속.시범 = true;
    db.run("UPDATE app_user SET payload = ? WHERE id = ?", [JSON.stringify(속), uid]);
    console.log(`  넣음    ${p.이름} (${p.아이디})  ${p.뜻}`);
  }
  계정번호.set(p.이름, uid);

  /*
   * ★ 휴직은 **`status` 도 함께** 바뀌어야 합니다.
   *   처음에 leave_from·leave_to 만 넣었더니 종사자 목록에 「휴직 중」
   *   표가 안 떴습니다 — 화면은 `status === "leave"` 를 봅니다.
   *   근무 상태를 나타내는 칸이라, 날짜만 적어 두면 아무 데도 안 걸립니다.
   */
  if (p.휴직)
    db.run(
      `UPDATE app_user SET status = 'leave',
              leave_from = ?, leave_to = ?, leave_reason = ? WHERE id = ?`,
      [p.휴직.부터, p.휴직.까지, p.휴직.까닭, uid]);
  if (p.퇴사)
    db.run("UPDATE app_user SET status = 'resigned', resigned_at = ? WHERE id = ?",
      [p.퇴사, uid]);

  const w = db.query<{ id: number }, [number]>(
    "SELECT id FROM worker WHERE user_id = ?").get(uid);
  if (w) {
    인력번호.set(p.이름, w.id);
    if (p.퇴사) db.run("UPDATE worker SET status = 'resigned' WHERE id = ?", [w.id]);
    if (p.휴직) db.run("UPDATE worker SET status = 'leave' WHERE id = ?", [w.id]);
  }
}

// 외부업체는 worker 줄이 없을 수 있습니다. 공사형을 맡기려면 있어야 합니다.
if (!인력번호.has("해남안전건설 이기사")) {
  const uid = 계정번호.get("해남안전건설 이기사")!;
  const i = db.run(
    `INSERT INTO worker (user_id, payload, emp_no, hired_on, geo_consent, status, created_at)
     VALUES (?, '{}', 'V-001', '2026-05-02', 0, 'active', ?)`, [uid, 이제()]);
  인력번호.set("해남안전건설 이기사", Number(i.lastInsertRowid));
}

// ══════════════════════════════════════════════════════════════
//  ② 대상자
// ══════════════════════════════════════════════════════════════

type 사람정의 = {
  이름: string; 생년: string; 성별: string; 읍면동: string; 도로명: string;
  상세: string; 연락처: string; 집전화: string;
  보호자: { name: string; rel: string; phone: string }[];
  부담률: number;
  주의?: string; 반려?: string; cctv?: string;
  상태?: "이용" | "중단" | "종결";
  상태사유?: string; 상태부터?: string;
  뜻: string;
};

const 사람들: 사람정의[] = [
  { 이름: "김순임", 생년: "1938-05-11", 성별: "여", 읍면동: "해남읍",
    도로명: "전남 해남군 해남읍 중앙1로 12", 상세: "301호",
    연락처: "010-2211-3344", 집전화: "061-534-1120",
    보호자: [{ name: "김영수", rel: "아들", phone: "010-9911-2020" }],
    부담률: 0, 주의: "귀가 어두우십니다. 문 앞에서 크게 부르셔야 합니다.",
    뜻: "정상 — 가사지원 주 2회, 서명까지 다 받은 건" },

  { 이름: "박옥례", 생년: "1935-11-02", 성별: "여", 읍면동: "삼산면",
    도로명: "전남 해남군 삼산면 봉학길 8", 상세: "",
    연락처: "010-3322-1177", 집전화: "",
    보호자: [{ name: "박정심", rel: "딸", phone: "010-7788-4433" }],
    부담률: 0.2, 반려: "누렁이(중형견) — 마당에 묶여 있습니다",
    뜻: "★ 식사지원 — 비대면 배달이 2회 연속(3회면 중지)" },

  { 이름: "최말순", 생년: "1941-03-29", 성별: "여", 읍면동: "송지면",
    도로명: "전남 해남군 송지면 땅끝마을길 40", 상세: "",
    연락처: "010-5566-7788", 집전화: "061-535-2210",
    보호자: [], 부담률: 0.2,
    뜻: "★ 동행지원 — 월 한도(2회)를 넘긴 달" },

  { 이름: "정갑동", 생년: "1933-08-15", 성별: "남", 읍면동: "현산면",
    도로명: "전남 해남군 현산면 월송길 22", 상세: "",
    연락처: "010-4411-9900", 집전화: "",
    보호자: [{ name: "정미란", rel: "며느리", phone: "010-2200-3311" }],
    부담률: 0, cctv: "거실에 한 대 있습니다 (보호자 확인함)",
    뜻: "두 서비스 — 가사지원 + 이미용(월 1회 한도를 꽉 채움)" },

  { 이름: "이복순", 생년: "1944-01-07", 성별: "여", 읍면동: "황산면",
    도로명: "전남 해남군 황산면 우항길 15", 상세: "",
    연락처: "010-8899-1212", 집전화: "",
    보호자: [{ name: "이강호", rel: "아들", phone: "010-3131-4141" }],
    부담률: 1.0,
    뜻: "★ 노쇼가 이어진 분 — 경고가 뜨는지 보는 자리" },

  { 이름: "윤기수", 생년: "1936-06-23", 성별: "남", 읍면동: "북평면",
    도로명: "전남 해남군 북평면 남창길 3", 상세: "",
    연락처: "010-1122-3355", 집전화: "061-533-9080",
    보호자: [], 부담률: 0,
    뜻: "★ 안전생활환경개선 — 외부업체가 다녀간 공사형" },

  { 이름: "강필남", 생년: "1939-09-30", 성별: "여", 읍면동: "문내면",
    도로명: "전남 해남군 문내면 우수영길 77", 상세: "",
    연락처: "010-6677-8899", 집전화: "",
    보호자: [{ name: "강수진", rel: "딸", phone: "010-5050-6060" }],
    부담률: 0.2, 상태: "중단", 상태사유: "입원 (해남종합병원)", 상태부터: 며칠전(12),
    뜻: "★ 중단 — 90일 시한이 도는지 보는 자리" },

  { 이름: "오점례", 생년: "1946-04-18", 성별: "여", 읍면동: "마산면",
    도로명: "전남 해남군 마산면 화내길 9", 상세: "",
    연락처: "010-2323-4545", 집전화: "",
    보호자: [], 부담률: 0.2,
    뜻: "★ 이번 달 새로 온 분 — 배정만 있고 실적은 아직 없음" },

  { 이름: "서정도", 생년: "1934-12-05", 성별: "남", 읍면동: "옥천면",
    도로명: "전남 해남군 옥천면 영신길 31", 상세: "",
    연락처: "010-7070-8080", 집전화: "",
    보호자: [{ name: "서은지", rel: "손녀", phone: "010-9090-1010" }],
    부담률: 0,
    뜻: "★ 연간 한도가 거의 찬 분 — 한도 경고가 뜨는지 보는 자리" },

  { 이름: "한금자", 생년: "1940-07-14", 성별: "여", 읍면동: "화산면",
    도로명: "전남 해남군 화산면 명금길 6", 상세: "",
    연락처: "010-1313-2424", 집전화: "",
    보호자: [], 부담률: 1.0, 상태: "종결", 상태사유: "타 지역 전출", 상태부터: 며칠전(35),
    뜻: "★ 종결 — 목록에서 걸러지는지 보는 자리" },
];

const 사람번호 = new Map<string, string>();

for (const p of 사람들) {
  const id = crypto.randomUUID();
  const 속 = {
    시범: true,                       // ★ 지울 때 찾는 표
    name: p.이름, birth: p.생년, gender: p.성별,
    phone: p.연락처, phoneHome: p.집전화,
    address: p.도로명, addressDetail: p.상세,
    lat: null, lng: null,
    guardians: p.보호자,
    cctv: p.cctv ?? "", pet: p.반려 ?? "", caution: p.주의 ?? "",
    selfSign: true,
  };
  const 검색 = [p.이름, p.연락처, p.집전화, p.읍면동, p.도로명, p.상세, p.생년,
                ...p.보호자.flatMap((g) => [g.name, g.phone])]
    .filter(Boolean).join(" ").toLowerCase();

  const 시작 = 날(지난달, 1);
  db.run(
    `INSERT INTO recipient
       (id, payload, search_text, dong, status, status_since, status_reason,
        suspend_deadline, copay_tier_id, memo, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, JSON.stringify(속), 검색, p.읍면동,
     p.상태 ?? "이용", p.상태부터 ?? 시작, p.상태사유 ?? null,
     p.상태 === "중단"
       ? new Date(new Date(`${p.상태부터}T00:00:00`).getTime() + 90 * 86400_000)
           .toISOString().slice(0, 10)
       : null,
     부담칸(p.부담률), "", 이제(), 이제()]);

  db.run(`INSERT INTO status_change (recipient_id, from_status, to_status, changed_on, reason, created_at)
          VALUES (?, NULL, '이용', ?, '등록', ?)`, [id, 시작, 이제()]);
  if (p.상태 && p.상태 !== "이용")
    db.run(`INSERT INTO status_change (recipient_id, from_status, to_status, changed_on, reason, created_at)
            VALUES (?, '이용', ?, ?, ?, ?)`,
      [id, p.상태, p.상태부터, p.상태사유 ?? "", 이제()]);

  db.run(`INSERT INTO consent (recipient_id, agreed_on, retention_until, note)
          VALUES (?, ?, ?, '시범자료')`,
    [id, 시작, `${Number(시작.slice(0, 4)) + 5}${시작.slice(4)}`]);

  집표(id);   // 문에 붙일 방문표
  사람번호.set(p.이름, id);
  console.log(`  넣음    ${p.이름}  (${p.읍면동})  ${p.뜻}`);
}

// ══════════════════════════════════════════════════════════════
//  ③ 배정
// ══════════════════════════════════════════════════════════════

/*
 * ★ **의뢰가 먼저입니다.**
 *
 * 통돌 Note 는 「지자체가 의뢰한 것(referral) → 기관이 사람을 붙인 것(배정)」
 * 순서로 돕니다. 배정만 만들어 두면 배정 화면도 실적 달력도 **텅 빕니다** —
 * 계획을 어디서 가져올지가 의뢰(주 몇 회·월 몇 회)에 적혀 있기 때문입니다.
 *
 * 그래서 시범자료도 **같은 순서**로 넣습니다. 그래야 화면에서 보시는 것이
 * 실제로 돌아가는 모습과 같습니다.
 *
 *   week      주 n회 — 요일을 고릅니다. 달력에 ○ 계획이 깔립니다.
 *   month     월 n회 — 요일이 없습니다. 달력이 아무 날이나 열립니다.
 *   lifetime  생애 n회 — 한 번뿐. 역시 날짜를 그때 고릅니다.
 */
type 배정정의 = {
  사람: string; 서비스: string; 담당: string;
  주기: "week" | "month" | "lifetime"; 횟수: number;
  요일: { dow: number; minutes?: number }[];
  부터: string; 까지?: string | null;
  묶음?: string;
};

const 가사 = 서비스("가사");
const 식사 = 서비스("식사");
const 동행 = 서비스("동행");
const 이미용 = 서비스("이미용");
const 안전 = 서비스("안전");

const 묶음이름 = `${지난달} 정기의뢰`;

const 배정들: 배정정의[] = [
  { 사람: "김순임", 서비스: 가사.name, 담당: "최돌봄", 주기: "week", 횟수: 2,
    요일: [{ dow: 1, minutes: 120 }, { dow: 4, minutes: 120 }], 부터: 날(지난달, 1) },
  { 사람: "박옥례", 서비스: 식사.name, 담당: "김손길", 주기: "week", 횟수: 5,
    요일: [{ dow: 1 }, { dow: 2 }, { dow: 3 }, { dow: 4 }, { dow: 5 }], 부터: 날(지난달, 1) },
  // ★ 월 단위 — 요일이 없습니다. 달력이 아무 날이나 열리는 모습입니다.
  { 사람: "최말순", 서비스: 동행.name, 담당: "최돌봄", 주기: "month", 횟수: 2,
    요일: [], 부터: 날(지난달, 1) },
  { 사람: "정갑동", 서비스: 가사.name, 담당: "김손길", 주기: "week", 횟수: 1,
    요일: [{ dow: 3, minutes: 120 }], 부터: 날(지난달, 1) },
  { 사람: "정갑동", 서비스: 이미용.name, 담당: "정보람", 주기: "month", 횟수: 1,
    요일: [], 부터: 날(지난달, 1) },
  { 사람: "이복순", 서비스: 가사.name, 담당: "최돌봄", 주기: "week", 횟수: 2,
    요일: [{ dow: 2, minutes: 120 }, { dow: 5, minutes: 120 }], 부터: 날(지난달, 1) },
  // ★ 생애 1회 — 외부업체가 들어가는 공사형
  { 사람: "윤기수", 서비스: 안전.name, 담당: "해남안전건설 이기사",
    주기: "lifetime", 횟수: 1, 요일: [], 부터: 날(지난달, 1) },
  // ★ 퇴사한 분이 맡던 곳 — 담당을 다시 정해야 합니다
  { 사람: "강필남", 서비스: 가사.name, 담당: "배은혜", 주기: "week", 횟수: 1,
    요일: [{ dow: 3, minutes: 120 }], 부터: 날(지난달, 1) },
  // ★ 이번 달 새로 온 분 — 손으로 넣은 의뢰. 배정만 있고 실적은 아직 없습니다
  { 사람: "오점례", 서비스: 가사.name, 담당: "정보람", 주기: "week", 횟수: 1,
    요일: [{ dow: 4, minutes: 120 }], 부터: 며칠전(3), 묶음: "손입력" },
  { 사람: "서정도", 서비스: 가사.name, 담당: "김손길", 주기: "week", 횟수: 3,
    요일: [{ dow: 1, minutes: 180 }, { dow: 3, minutes: 180 }, { dow: 5, minutes: 180 }],
    부터: 날(지난달, 1) },
  // ★ 종결한 분 — 기간이 닫혀 있습니다
  { 사람: "한금자", 서비스: 가사.name, 담당: "최돌봄", 주기: "week", 횟수: 1,
    요일: [{ dow: 2, minutes: 120 }], 부터: 날(지난달, 1), 까지: 며칠전(35) },
];

const 배정번호 = new Map<string, number>();   // "이름|서비스" → assignment.id
const 주기글 = (u: string, n: number) =>
  u === "week" ? `주 ${n}회` : u === "month" ? `월 ${n}회` : `생애 ${n}회`;

for (const a of 배정들) {
  const rid = 사람번호.get(a.사람)!;
  const sv = 서비스들.find((s) => s.name === a.서비스)!;
  const wid = 인력번호.get(a.담당) ?? null;

  // ① 의뢰 — 지자체가 「이 사람에게 이 서비스를 주 몇 회」라고 보낸 것
  const 달수 = a.까지
    ? (Number(a.까지.slice(0, 4)) - Number(a.부터.slice(0, 4))) * 12 +
      (Number(a.까지.slice(5, 7)) - Number(a.부터.slice(5, 7))) + 1
    : null;
  db.run(
    `INSERT INTO referral
       (batch_label, recipient_id, service_id, period_from, period_to, period_months,
        cycle_unit, cycle_count, cycle_text, copay_type, note, diff_state, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,NULL,NULL,'신규',?)`,
    [a.묶음 ?? 묶음이름, rid, sv.id, a.부터, a.까지 ?? null, 달수,
     a.주기, a.횟수, 주기글(a.주기, a.횟수), 이제()]);

  // ② 배정 — 기관이 누구를 보낼지 정한 것
  const i = db.run(
    `INSERT INTO assignment
       (recipient_id, worker_id, service_id, period_from, period_to,
        weekly_plan, planned_count, planned_minutes, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [rid, wid, sv.id, a.부터, a.까지 ?? null,
     JSON.stringify(a.요일), a.요일.length, null, 이제()]);
  배정번호.set(`${a.사람}|${a.서비스}`, Number(i.lastInsertRowid));
}
console.log(`\n  의뢰 ${배정들.length}건 · 배정 ${배정들.length}건`);

// ══════════════════════════════════════════════════════════════
//  ④ 제공실적
// ══════════════════════════════════════════════════════════════

/** 시범용 서명 그림 — 아주 작은 투명 PNG 한 장. */
const 시범서명 =
  "data:image/png;base64," +
  "iVBORw0KGgoAAAANSUhEUgAAALQAAAA8CAIAAABATAfQAAAB30lEQVR42u2bUY7DIAwF3yFy/6tu" +
  "/ypV2jYEbGPsmc9KSeExppAS/QF8QUQAyAHIAcgByAHIAcgByAHIAcgByFGE6xMGGDn+0aKhH+Zd" +
  "Vm0zmvjh1GvVLpoOfvhVhcqkEzbZpjXj94cd5RiJoLwcTlXRQo6qftx2atEPdTCjpB8BVaEmZrSV" +
  "Y6XjjeSo5EdMYaiPGe8Lu5nRUY5gq04vjImr1GraKODHSuOfXqtuZhSQY7Hj43foKMe5fgQXhhqa" +
  "ce7K1KTN4xkqYCwNh8H2Vmf5YVsYI7eStxaG/xOaD6e5aq5/8nm0NlqO6448hW64fPE+ROJRGNFy" +
  "fAtoPTinijTZFQecM3Lqe5wcI6HMBec6V6/IenvIKHgJaYvig34anHc000+jPcog1cZKWyIeDy7m" +
  "HJdT403av3FXpV3FN5Jy2Am/p9NY5G/ixv22rJK1/eWOPzvuOo1lW4YHyWE1bWZ4q+DHl27Zim9/" +
  "TKeAgptWJDiLa4DIKjpbDqcnMxsTcZ3GUu3RfOVo8jKI+bOsg96l0KElXsC8/NkKM1L5kSpbYUa9" +
  "xU2QHHufPfT0I08LNdEBxjX/ynePHIxoHzRuN2EhBwByAHIAcgByAHIAcgByAHIAcgByAHIQASAH" +
  "POYFKMbumTZSONAAAAAASUVORK5CYII=";

/** 현장에서 올라온 것처럼 payload 를 짭니다 (보고받기.ts 와 같은 모양). */
function 현장짐(o: {
  갈래: string; 적은것: any; 서명?: boolean; 표없이?: boolean;
  고침?: string[]; 사진?: number;
}) {
  return JSON.stringify({
    현장: {
      적은것: o.적은것,
      /*
       * ★ **진짜 그림**을 넣습니다. 현장앱은 손글씨 서명을 data: 그림으로
       *   보냅니다. 여기에 「(서명 받음)」 같은 글자를 넣으면 실적창이
       *   <img src="(서명 받음)"> 로 그려서 **깨진 그림 아이콘**이 뜹니다.
       */
      서명: o.서명 === false ? null : 시범서명,
      서명받은때: o.서명 === false ? null : 이제(),
      갈래: o.갈래,
      표없이: !!o.표없이,
      보고번호: crypto.randomUUID(),
      고침: o.고침 ?? [],
      되돌림: [],
      사진: Array.from({ length: o.사진 ?? 0 }, (_, i) => ({
        파일: `시범/${i + 1}.jpg`, 자리: `시범자료(그림 없음)`,
      })),
    },
  });
}

type 실적입력 = {
  배정: number; 사람: string; 서비스번호: number; 날짜: string;
  결과: "제공" | "미제공";
  시작?: string; 끝?: string; 분?: number;
  갈래?: string | null; 알린날?: string | null;
  대면?: boolean | null;
  짐?: string; 판정?: string; 담당?: number | null;
};

let 실적수 = 0;
function 실적(x: 실적입력) {
  db.run(
    `INSERT INTO delivery
       (assignment_id, recipient_id, service_id, served_on,
        actor_type, actor_id, start_at, end_at, qty, is_holiday,
        outcome, reason, miss_kind, notified_on, face_to_face,
        planned, minutes, payload, verdict, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,1,?,?,?,?)`,
    [x.배정, 사람번호.get(x.사람)!, x.서비스번호, x.날짜,
     x.담당 === null ? "외부업체" : "제공인력", x.담당 ?? null,
     x.시작 ? `${x.날짜}T${x.시작}:00` : null,
     x.끝 ? `${x.날짜}T${x.끝}:00` : null,
     x.결과 === "제공" ? 1 : 0,
     x.결과, null, x.갈래 ?? null, x.알린날 ?? null,
     x.대면 === undefined || x.대면 === null ? null : (x.대면 ? 1 : 0),
     x.분 ?? null, x.짐 ?? "{}", x.판정 ?? "일치", 이제()]);
  실적수++;
}

const 최돌봄 = 인력번호.get("최돌봄")!;
const 김손길 = 인력번호.get("김손길")!;
const 정보람 = 인력번호.get("정보람")!;
const 배은혜 = 인력번호.get("배은혜")!;
const 업체 = 인력번호.get("해남안전건설 이기사")!;

// ── 김순임 · 가사지원 (월·목) — 두 달 내내 정상 ──────────────
{
  const aid = 배정번호.get(`김순임|${가사.name}`)!;
  const 한것후보 = [
    ["청소", "세탁"], ["취사", "청소"], ["말벗", "청소", "세탁"],
    ["취사", "말벗"], ["청소", "취사", "세탁"],
  ];
  let n = 0;
  for (const 달 of [지난달, 이번달])
    for (const d of 그달의요일(달, [1, 4])) {
      const 한것 = 한것후보[n % 한것후보.length];
      실적({
        배정: aid, 사람: "김순임", 서비스번호: 가사.id, 날짜: d, 결과: "제공",
        시작: "09:00", 끝: "11:00", 분: 120, 담당: 최돌봄,
        짐: 현장짐({
          갈래: "가사",
          적은것: {
            한것, 기타: n % 4 === 0 ? "약 봉투 정리" : "",
            특이사항: n % 3 === 0 ? "무릎이 아프시다고 하셔서 오래 서 계시지 않게 했습니다." : "",
          },
          // 한 건은 사진과 「나중에 고침」이 있는 것으로 둡니다
          사진: n === 2 ? 2 : 0,
          고침: n === 2 ? [new Date(`${d}T19:40:00`).toISOString()] : [],
          표없이: n === 5,
        }),
        판정: n === 5 ? "확인필요" : "일치",
      });
      n++;
    }
}

// ── 박옥례 · 식사지원 (평일) — ★ 비대면 2회 연속 ────────────
{
  const aid = 배정번호.get(`박옥례|${식사.name}`)!;
  const 주식 = ["흰죽", "잡곡밥", "찹쌀죽", "쌀밥", "야채죽"];
  const 반찬 = [
    "콩나물 무침, 미역줄기, 계란찜, 배추김치",
    "시금치 나물, 고등어조림, 두부부침, 깍두기",
    "무나물, 애호박볶음, 닭가슴살 무침, 배추김치",
  ];
  const 날들: string[] = [];
  for (const 달 of [지난달, 이번달]) 날들.push(...그달의요일(달, [1, 2, 3, 4, 5]));
  /*
   * ★ **마지막 두 번만** 비대면입니다. 하나 더 쌓이면 3회 연속 —
   *   계약서 5-2조로 통합돌봄 전체가 중지되는 자리입니다.
   *   화면이 그 직전을 어떻게 알려 주는지 보려고 이렇게 둡니다.
   */
  날들.forEach((d, i) => {
    const 비대면 = i >= 날들.length - 2;
    실적({
      배정: aid, 사람: "박옥례", 서비스번호: 식사.id, 날짜: d, 결과: "제공",
      시작: "11:20", 끝: "11:35", 담당: 김손길, 대면: !비대면,
      짐: 현장짐({
        갈래: "식사",
        적은것: {
          제공형태: 비대면 ? "비대면배달" : "대면배달",
          장소: 비대면 ? "현관 앞 보온함" : "자택 거실",
          주식: 주식[i % 주식.length], 반찬: 반찬[i % 반찬.length],
          특이사항: 비대면 ? "문을 두드려도 인기척이 없어 보온함에 넣고 왔습니다." : "",
        },
        서명: !비대면,
      }),
    });
  });
}

// ── 최말순 · 동행지원 (화) — ★ 월 한도(2회) 넘김 ─────────────
{
  const aid = 배정번호.get(`최말순|${동행.name}`)!;
  const 곳 = ["해남종합병원 정형외과", "해남읍 보건소", "해남군청 민원실"];
  let n = 0;
  for (const 달 of [지난달, 이번달])
    for (const d of 그달의요일(달, [2])) {
      실적({
        배정: aid, 사람: "최말순", 서비스번호: 동행.id, 날짜: d, 결과: "제공",
        시작: "10:00", 끝: "13:00", 분: 180, 담당: 최돌봄,
        짐: 현장짐({
          갈래: "동행",
          적은것: {
            장소: 곳[n % 곳.length],
            내용: "접수 대기 동행\n진료실 안내\n약국에서 약 수령\n귀가 동행",
            특이사항: n === 1 ? "다음 진료는 4주 뒤라고 하셨습니다." : "",
          },
        }),
      });
      n++;
    }
}

// ── 정갑동 · 가사(수) + 이미용(금) ──────────────────────────
{
  const 가사배정 = 배정번호.get(`정갑동|${가사.name}`)!;
  let n = 0;
  for (const 달 of [지난달, 이번달])
    for (const d of 그달의요일(달, [3])) {
      // ★ 지난달 한 번은 「사전취소」 — 못 간 갈래가 화면에 뜨는지 봅니다
      const 취소 = 달 === 지난달 && n === 1;
      if (취소)
        실적({
          배정: 가사배정, 사람: "정갑동", 서비스번호: 가사.id, 날짜: d,
          결과: "미제공", 갈래: "사전취소", 알린날: 며칠전(0) > d
            ? new Date(new Date(`${d}T00:00:00`).getTime() - 2 * 86400_000)
                .toISOString().slice(0, 10) : d,
          담당: 김손길, 짐: "{}", 판정: "",
        });
      else
        실적({
          배정: 가사배정, 사람: "정갑동", 서비스번호: 가사.id, 날짜: d, 결과: "제공",
          시작: "14:00", 끝: "16:00", 분: 120, 담당: 김손길,
          짐: 현장짐({
            갈래: "가사",
            적은것: { 한것: ["청소", "세탁", "말벗"], 기타: "", 특이사항: "" },
          }),
        });
      n++;
    }

  // ★ 이미용은 **달마다 한 번만** — 월 한도(1회)를 꽉 채운 모습
  const 미용배정 = 배정번호.get(`정갑동|${이미용.name}`)!;
  for (const 달 of [지난달, 이번달]) {
    const 것들 = 그달의요일(달, [5]);
    if (!것들.length) continue;
    const d = 것들[0];
    실적({
      배정: 미용배정, 사람: "정갑동", 서비스번호: 이미용.id, 날짜: d, 결과: "제공",
      시작: "10:30", 끝: "11:30", 분: 60, 담당: 정보람,
      짐: 현장짐({
        갈래: "이미용",
        적은것: { 장소: "자택 거실", 내용: "머리 감기\n이발\n면도\n주변 정리", 특이사항: "" },
      }),
    });
  }
}

// ── 이복순 · 가사(화·금) — ★ 노쇼가 이어집니다 ───────────────
{
  const aid = 배정번호.get(`이복순|${가사.name}`)!;
  const 날들: string[] = [];
  for (const 달 of [지난달, 이번달]) 날들.push(...그달의요일(달, [2, 5]));
  /*
   * ★ **마지막 세 번이 노쇼**입니다. 통합돌봄은 노쇼가 이어지면
   *   기관이 지자체에 알리게 되어 있습니다. 그 경고가 화면에
   *   제대로 뜨는지 보려고 연속으로 둡니다.
   */
  날들.forEach((d, i) => {
    const 노쇼 = i >= 날들.length - 3;
    if (노쇼)
      실적({ 배정: aid, 사람: "이복순", 서비스번호: 가사.id, 날짜: d,
             결과: "미제공", 갈래: "노쇼", 담당: 최돌봄, 짐: "{}", 판정: "" });
    else
      실적({
        배정: aid, 사람: "이복순", 서비스번호: 가사.id, 날짜: d, 결과: "제공",
        시작: "13:00", 끝: "15:00", 분: 120, 담당: 최돌봄,
        짐: 현장짐({ 갈래: "가사",
          적은것: { 한것: ["청소", "취사"], 기타: "", 특이사항: "" } }),
      });
  });
  /*
   * ★ `no_show_streak` **은 손으로 안 씁니다.**
   *   이름은 「노쇼」인데 실제로 담긴 값은 **식사 비대면 연속**입니다
   *   (`대면배달.ts` 가 실적에서 다시 셉니다). 여기서 노쇼 횟수를 적으면
   *   홈 화면에 「식사지원 연속 미수령」으로 엉뚱한 분이 뜹니다.
   *   누적 노쇼 횟수만 적어 둡니다.
   */
  db.run("UPDATE recipient SET no_show_count = 3 WHERE id = ?",
    [사람번호.get("이복순")!]);
}

// ── 윤기수 · 안전생활환경개선 — ★ 외부업체 공사형 ────────────
{
  const aid = 배정번호.get(`윤기수|${안전.name}`)!;
  const d = 그달의요일(지난달, [1, 2, 3, 4, 5])[6] ?? 날(지난달, 10);
  실적({
    배정: aid, 사람: "윤기수", 서비스번호: 안전.id, 날짜: d, 결과: "제공",
    시작: "09:00", 끝: "17:00", 담당: 업체,
    짐: 현장짐({
      갈래: "기타",
      적은것: {
        내용: "욕실 미끄럼 방지 타일 시공\n안전 손잡이 2개 설치\n문턱 낮춤 공사",
        특이사항: "공사 중 이틀간 이웃 댁에 계셨습니다.",
      },
      서명: true,
    }),
  });
}

// ── 강필남 · 가사(수) — 중단 전까지만 ────────────────────────
{
  const aid = 배정번호.get(`강필남|${가사.name}`)!;
  const 중단일 = 며칠전(12);
  for (const 달 of [지난달, 이번달])
    for (const d of 그달의요일(달, [3])) {
      if (d >= 중단일) continue;
      실적({
        배정: aid, 사람: "강필남", 서비스번호: 가사.id, 날짜: d, 결과: "제공",
        시작: "09:30", 끝: "11:30", 분: 120, 담당: 배은혜,
        짐: 현장짐({ 갈래: "가사",
          적은것: { 한것: ["청소", "세탁"], 기타: "", 특이사항: "" } }),
      });
    }
}

// ── 서정도 · 가사(월·수·금 3시간) — ★ 연간 한도가 거의 참 ────
{
  const aid = 배정번호.get(`서정도|${가사.name}`)!;
  for (const 달 of [지난달, 이번달])
    for (const d of 그달의요일(달, [1, 3, 5]))
      실적({
        배정: aid, 사람: "서정도", 서비스번호: 가사.id, 날짜: d, 결과: "제공",
        시작: "09:00", 끝: "12:00", 분: 180, 담당: 김손길,
        짐: 현장짐({ 갈래: "가사",
          적은것: { 한것: ["청소", "취사", "세탁", "말벗"], 기타: "", 특이사항: "" } }),
      });

  /*
   * ★ 올해 앞선 달들 몫을 **한 줄씩** 더 넣어 연간 한도를 채웁니다.
   *   한도 경고는 「올해 얼마 썼나」로 도는데, 두 달치만으로는
   *   150만 원 근처에 못 갑니다. 배정 기간 밖이라 계획에는 안 잡히고
   *   **쓴 돈에만** 잡히는 것이 실제 이관 자료의 모습이기도 합니다.
   */
  const 올해 = 오늘.slice(0, 4);
  for (let m = 1; m <= Number(지난달.slice(5, 7)) - 1; m++) {
    const 달 = `${올해}-${String(m).padStart(2, "0")}`;
    for (const d of 그달의요일(달, [1, 3], false).slice(0, 4))
      실적({
        배정: aid, 사람: "서정도", 서비스번호: 가사.id, 날짜: d, 결과: "제공",
        시작: "09:00", 끝: "12:00", 분: 180, 담당: 김손길, 짐: "{}",
      });
  }
}

// ── 한금자 · 가사(화) — 종결 전까지만 ────────────────────────
{
  const aid = 배정번호.get(`한금자|${가사.name}`)!;
  const 종결일 = 며칠전(35);
  for (const d of 그달의요일(지난달, [2])) {
    if (d >= 종결일) continue;
    실적({
      배정: aid, 사람: "한금자", 서비스번호: 가사.id, 날짜: d, 결과: "제공",
      시작: "10:00", 끝: "12:00", 분: 120, 담당: 최돌봄,
      짐: 현장짐({ 갈래: "가사",
        적은것: { 한것: ["청소", "말벗"], 기타: "", 특이사항: "" } }),
    });
  }
}

/*
 * ★ **식사 비대면 연속을 다시 셉니다.**
 *
 * 화면(홈·대상자 목록)은 대상자 줄에 적혀 있는 값을 봅니다. 그 값은
 * 실적을 저장할 때 따라 도는 것이라, 이렇게 실적을 통째로 넣었을 때는
 * 한 번 돌려 줘야 화면과 자료가 맞습니다.
 */
for (const id of 사람번호.values()) 비대면다시셈(id);

console.log(`  제공실적 ${실적수}건 (${지난달} · ${이번달})`);

// ══════════════════════════════════════════════════════════════
//  ⑤ 메모지 · 월 일지
// ══════════════════════════════════════════════════════════════

let 메모수 = 0;
const 메모번호: number[] = [];     // 지울 때 쓸 번호 (대상자에 안 붙은 것 때문에)
function 메모(글: string, 색: string, 사람: string | null, 누가: string, 붙임 = 0) {
  const i = db.run(
    `INSERT INTO sticky (text, color, author_id, author, recipient_id, pinned,
                         due_on, created_at, updated_at, x, y, w, h)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    /*
     * ★ 파랑(현장에서 저절로 올라온 것)은 **글에 맞게** 키웁니다
     *   (2026-09-07 무무 — 스크롤바가 보이지 않도록).
     *   시범자료도 진짜와 같은 크기로 나와야 눈으로 볼 뜻이 있습니다.
     */
    [글, 색, null, 누가, 사람 ? 사람번호.get(사람)! : null, 붙임,
     null, 이제(), 이제(), 20 + 메모수 * 18, 20 + 메모수 * 14,
     ...(색 === "blue"
       ? [글에맞는크기(글).w, 글에맞는크기(글).h]
       : [240, 150])]);
  메모번호.push(Number(i.lastInsertRowid));
  메모수++;
}

메모("이복순 어르신 — 세 번째 안 계셨습니다. 아드님께 연락 필요합니다.", "red", "이복순", "최돌봄", 1);
메모("박옥례 어르신 도시락, 어제도 문 앞에 두고 왔습니다. 한 번 더면 중지입니다.", "red", "박옥례", "김손길", 1);
메모("서정도 어르신 올해 한도가 거의 찼습니다. 군에 연장 문의해 두었습니다.", "yellow", "서정도", "박병섭");
메모("김순임 어르신 무릎 통증. 오래 서 계시지 않게 해 주세요.", "blue", "김순임", "최돌봄");
메모("이번 달 실적 마감은 다음 달 5일까지입니다.", "yellow", null, "박병섭", 1);
메모("배은혜 선생님 퇴사 — 맡던 강필남 어르신 담당을 다시 정해야 합니다.", "red", null, "박병섭", 1);

db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('demo_sticky', ?)",
  [JSON.stringify(메모번호)]);

let 일지수 = 0;
for (const [사람, 상태, 자세히, 비고] of [
  ["김순임", "변화없음", "식사·거동 모두 지난달과 같습니다.", ""],
  ["박옥례", "증상악화", "기력이 떨어져 문까지 나오시지 못하는 날이 늘었습니다.", "대면 배달 어려움"],
  ["최말순", "개선", "병원 다녀오신 뒤 걸음이 나아지셨습니다.", ""],
  ["이복순", "변화없음", "부재가 잦아 상태 확인이 어렵습니다.", "노쇼 3회"],
] as const) {
  db.run(
    `INSERT INTO record_note (recipient_id, month, status_change, detail, remark, staff_name, updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    [사람번호.get(사람)!, 지난달, 상태, 자세히, 비고, "박병섭", 이제()]);
  일지수++;
}

console.log(`  메모지 ${메모수}장 · 월 일지 ${일지수}건`);

// ══════════════════════════════════════════════════════════════

console.log(`
────────────────────────────────────────────────
시범자료를 넣었습니다.

  대상자 ${사람들.length}명 · 종사자 ${인력들.length}명
  배정 ${배정들.length}건 · 제공실적 ${실적수}건
  ${지난달} 과 ${이번달} 두 달치입니다.

  종사자 비밀번호는 모두  care1234  입니다.

지울 때는 「시범자료 지우기」를 누르시면 됩니다.
손으로 넣으신 자료는 건드리지 않습니다.
────────────────────────────────────────────────
`);
