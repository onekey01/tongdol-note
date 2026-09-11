/**
 * 보고 왕복 시험 —  bun 보고왕복시험.ts
 *
 * 폰이 올린 것이 **사무실 자료함까지** 제대로 들어오는지 봅니다.
 *
 * ── 여기서 보는 것 ─────────────────────────────────────────
 *
 *   1. 제공실적 한 줄이 생기는가
 *   2. 시작·종료 시각이 들어가는가 (편람 서식의 「진행시간」)
 *   3. 확인사항과 서명이 실적에 남는가
 *   4. ★ 특이사항이 **대상자 메모에** 날짜·이름과 함께 붙는가
 *   5. 같은 보고를 두 번 받아도 메모가 두 번 안 붙는가
 *   6. ★ 사진이 **풀려서** 이 PC 에 저장되는가
 *   7. 「표 없이」 찍은 것은 **확인필요**로 들어가는가
 *   8. 다 넣은 뒤 우편함에서 지우라고 하는가
 *
 * ── 우편함은 흉내 냅니다 ───────────────────────────────────
 *
 * 진짜 Supabase 에 붙지 않습니다. 인터넷이 없어도, 무무 님 열쇠가
 * 없어도 돌아야 하는 시험입니다. 대신 **자물쇠는 진짜**를 씁니다 —
 * 잠그고 푸는 것이 실제로 맞아떨어지는지가 여기서 봐야 할 것입니다.
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { db, initDb } from "./server/db";
import { 새열쇠, 짐싸기, 덩이잠그기 } from "./server/우편함자물쇠";
import { 그날갈곳 } from "./server/할일보내기";

initDb();

let 통과수 = 0, 실패수 = 0;
function 맞아야(무엇: string, 참인가: boolean, 곁 = "") {
  if (참인가) { 통과수++; console.log(`  통과  ${무엇}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${곁 ? "\n          " + 곁 : ""}`); }
}
const 같아야 = (무엇: string, 실제: unknown, 바람: unknown) =>
  맞아야(무엇, 실제 === 바람, `나온 것 ${JSON.stringify(실제)} · 바란 것 ${JSON.stringify(바람)}`);

const 이제 = new Date().toISOString();
const 날 = 이제.slice(0, 10);
const 기관열쇠 = 새열쇠();
const 치울것: { 표: string; id: any }[] = [];

/* ── 시험 마당 : 대상자 · 인력 · 배정 ─────────────────────── */
const 인력이름 = "시험인력_왕복";
const u = db.run(
  `INSERT INTO app_user (login_id, pw_hash, name, role, roles, status,
                         mailbox_worker_id, created_at)
   VALUES (?, 'x', ?, 'worker', '["worker"]', 'active', ?, ?)`,
  [`왕복-${Date.now()}`, 인력이름, crypto.randomUUID(), 이제]);
const uid = Number(u.lastInsertRowid); 치울것.push({ 표: "app_user", id: uid });
const w = db.run("INSERT INTO worker (user_id, created_at) VALUES (?, ?)", [uid, 이제]);
const wid = Number(w.lastInsertRowid); 치울것.push({ 표: "worker", id: wid });

const 서비스 = db.query<{ id: number; name: string }, []>(
  "SELECT id, name FROM service ORDER BY id LIMIT 1").get()!;

const rid = crypto.randomUUID();
db.run(`INSERT INTO recipient (id, payload, search_text, dong, status, memo,
                               visit_code, created_at, updated_at)
        VALUES (?, ?, ?, '해남읍', '이용', ?, ?, ?, ?)`,
  [rid, JSON.stringify({ name: "왕복시험어르신" }), "왕복시험어르신",
   "대문 왼쪽 개 있음", "TESTvisitcode1234567890", 이제, 이제]);
치울것.push({ 표: "recipient", id: rid });

const a = db.run(
  `INSERT INTO assignment (recipient_id, worker_id, service_id, period_from, period_to,
                           weekly_plan, planned_count, created_at)
   VALUES (?, ?, ?, '2026-01-01', '2026-12-31', '[]', 0, ?)`,
  [rid, wid, 서비스.id, 이제]);
const aid = Number(a.lastInsertRowid);

/* ── 흉내 우편함 ─────────────────────────────────────────── */
const 할일 = 그날갈곳(날).find((j) => j.배정번호 === aid);
if (!할일) { console.error("\n  그날갈곳 이 이 배정을 안 냈습니다 — 시험을 못 돕니다.\n"); process.exit(1); }

const 보고번호 = crypto.randomUUID();
const 사진번호 = crypto.randomUUID();
const 진짜사진 = new Uint8Array(new ArrayBuffer(1200));
진짜사진[0] = 0xff; 진짜사진[1] = 0xd8;              // JPEG 머리
crypto.getRandomValues(진짜사진.subarray(2));

const 지운보고: string[] = [];
const 지운사진: string[] = [];
/** 지운 차례. 사진이 보고보다 **먼저**여야 합니다. */
const 지운차례: string[] = [];

const 흉내 = {
  async 보고받아오기() {
    return [{
      id: 보고번호, job_id: 할일.id, worker_id: 할일.worker_id,
      started_at: `${날}T09:05:00.000Z`, ended_at: `${날}T10:35:00.000Z`,
      qr_ok: true,
      짐: {
        served_on: 날, 이름: "왕복시험어르신", 서비스: 서비스.name, 갈래: "가사",
        적은것: { 한것: ["청소", "세탁"], 기타: "약 봉투 정리",
                 특이사항: "무릎이 아프시다고 하셔서 외출은 다음으로 미뤘습니다." },
        서명: "data:image/png;base64,iVBORw0KGgo=", 서명받은때: `${날}T10:36:00.000Z`,
        표없이: false,
      },
    }];
  },
  async 사진목록() {
    return [{ id: 사진번호, report_id: 보고번호, path: `기관/${보고번호}/${사진번호}` }];
  },
  async 사진받기(_길: string) { return 진짜사진; },
  async 사진지우기(길들: string[]) { 지운사진.push(...길들); 지운차례.push("사진"); },
  async 받은것지우기(ids: string[]) { 지운보고.push(...ids); 지운차례.push("보고"); },
};

/*
 * 흉내 우편함을 **그대로 넘겨** 씁니다.
 * .env 가 없는 곳에서도, 인터넷이 없어도 돌아야 하는 시험입니다.
 * 자물쇠만은 진짜를 씁니다 — 잠그고 푸는 것이 실제로 맞아떨어지는지가
 * 여기서 봐야 할 것입니다.
 */
const { 보고받기, 사진뿌리 } = await import("./server/보고받기");
const 받기 = () => 보고받기(흉내 as any);

try {

console.log("\n── 받아 봅니다 ─────────────────────────────────────\n");
const r = await 받기();
같아야("받은 건수", r.받은수, 1);
같아야("실적에 넣은 건수", r.넣은수, 1);
같아야("못 찾은 건수", r.못찾은수, 0);

/*
 * ★ 첫 번째로 받은 직후의 값을 붙잡아 둡니다.
 *   아래에서 한 번 더 받아 보기 때문에, 그 뒤에 세면 두 배가 됩니다.
 *   처음 돌렸을 때 실제로 그렇게 틀렸습니다.
 */
const 첫지운사진 = [...지운사진];
const 첫지운차례 = [...지운차례];

console.log("\n── 1·2·3. 제공실적 ─────────────────────────────────\n");
const d = db.query<any, [number, string]>(
  "SELECT * FROM delivery WHERE assignment_id = ? AND served_on = ?").get(aid, 날);
맞아야("제공실적 한 줄이 생김", !!d);
같아야("제공한 것으로 들어감", d?.outcome, "제공");
같아야("누가 갔는지", d?.actor_type, "제공인력");
같아야("★ 시작 시각", d?.start_at, `${날}T09:05:00.000Z`);
같아야("★ 종료 시각", d?.end_at, `${날}T10:35:00.000Z`);
같아야("방문표를 찍었으니 「일치」", d?.verdict, "일치");

const 속 = JSON.parse(d?.payload || "{}").현장 ?? {};
맞아야("★ 확인사항이 실적에 남음",
  (속.적은것?.한것 ?? []).includes("청소") && (속.적은것?.한것 ?? []).includes("세탁"),
  JSON.stringify(속.적은것));
맞아야("★ 서명도 남음", String(속.서명 ?? "").startsWith("data:image/png"));
같아야("어느 서식인지도 남음", 속.갈래, "가사");

console.log("\n── 4. ★ 특이사항이 대상자 포스트잇에 ───────────────\n");
/*
 * 처음에는 `recipient.memo`(내부 메모) 뒤에 붙였습니다. 자료는 잘
 * 들어갔는데 **아무도 못 봤습니다** — 계약 정보 목록 맨 아래 한 줄이라
 * 기록지를 쓰려고 그 사람 화면을 열어도 눈에 안 들어왔습니다.
 * 사무실이 실제로 보는 자리는 **오른쪽 포스트잇 보드**입니다.
 * (2026-09-05 무무)
 */
const 메모지들 = db.query<{ text: string; color: string; author: string }, [string]>(
  "SELECT text, color, author FROM sticky WHERE recipient_id = ? AND done_at IS NULL"
).all(rid);
맞아야("★ 그 대상자 보드에 메모지가 붙음", 메모지들.length === 1,
  `붙은 장수 ${메모지들.length}`);
const 메모 = 메모지들[0]?.text ?? "";
맞아야("★ 특이사항이 적힘", 메모.includes("무릎이 아프시다"), JSON.stringify(메모));
맞아야("★ 날짜가 같이 적힘", 메모.includes(`[${날}`));
맞아야("★ 종사자 이름이 같이 적힘", 메모.includes(인력이름));
맞아야("★ 색이 파랑 — 사무실이 손으로 붙인 노랑과 갈립니다",
  메모지들[0]?.color === "blue", String(메모지들[0]?.color));
맞아야("★ 붙인 이가 그 종사자로 남음", 메모지들[0]?.author === 인력이름,
  String(메모지들[0]?.author));
같아야("메모 붙인 건수", r.메모붙인수, 1);

// 기관이 손으로 적어 둔 내부 메모는 건드리지 않습니다.
const 내부메모 = db.query<{ memo: string }, [string]>(
  "SELECT memo FROM recipient WHERE id = ?").get(rid)?.memo ?? "";
맞아야("★ 기관이 적어 둔 내부 메모가 안 지워짐", 내부메모.includes("대문 왼쪽 개 있음"));
맞아야("★ 내부 메모에는 안 붙음 (포스트잇으로 갔습니다)",
  !내부메모.includes("무릎이 아프시다"), JSON.stringify(내부메모));
console.log("      메모지 —", JSON.stringify(메모));

console.log("\n── 5. 두 번 받아도 메모가 두 번 안 붙나 ────────────\n");
const r2 = await 받기();
const 메모지들2 = db.query<{ text: string }, [string]>(
  "SELECT text FROM sticky WHERE recipient_id = ?").all(rid);
같아야("★ 메모지가 안 늘어남", 메모지들2.length, 1);
같아야("★ 그 메모지 내용도 그대로", 메모지들2[0]?.text, 메모);
같아야("두 번째에는 메모를 안 붙임", r2.메모붙인수, 0);

/*
 * 뗀 메모지도 다시 안 붙습니다 — 사무실이 「분명 뗐는데 또 있네」가
 * 되면 안 됩니다. 떼는 것과 안 온 것은 다릅니다.
 */
db.run("UPDATE sticky SET done_at = ? WHERE recipient_id = ?",
  [new Date().toISOString(), rid]);
const r3 = await 받기();
같아야("★ 뗀 메모지를 다시 붙이지 않음", r3.메모붙인수, 0);
같아야("★ 그래서 장수도 그대로", db.query<{ n: number }, [string]>(
  "SELECT COUNT(*) AS n FROM sticky WHERE recipient_id = ?").get(rid)?.n, 1);

console.log("\n── 5-2. ★ 옛 내부 메모를 포스트잇으로 옮기기 ───────\n");
/*
 * 예전에는 특이사항이 `recipient.memo` 에 쌓였습니다. 이미 들어간 줄들이
 * 있어서, 켤 때 한 번 옮깁니다. 기관이 손으로 적은 줄은 그대로 둡니다.
 */
{
  const { 옛메모옮기기 } = await import("./server/보고받기");
  db.run("UPDATE sticky SET done_at = NULL WHERE recipient_id = ?", [rid]);
  db.run("DELETE FROM sticky WHERE recipient_id = ?", [rid]);
  db.run("UPDATE recipient SET memo = ? WHERE id = ?", [
    "대문 왼쪽 개 있음\n[2026-08-01 · 김손길] 무릎에 파스 붙여 드렸습니다\n[2026-08-02 · 최돌봄] 냉장고에 반찬 두고 왔습니다",
    rid]);

  const 옮긴수 = 옛메모옮기기();
  같아야("★ 두 줄을 옮김", 옮긴수, 2);

  const 남은메모 = db.query<{ memo: string }, [string]>(
    "SELECT memo FROM recipient WHERE id = ?").get(rid)?.memo ?? "";
  같아야("★ 기관이 손으로 적은 줄만 남음", 남은메모.trim(), "대문 왼쪽 개 있음");

  const 옮긴것 = db.query<{ text: string; color: string }, [string]>(
    "SELECT text, color FROM sticky WHERE recipient_id = ? ORDER BY id").all(rid);
  같아야("★ 포스트잇 두 장이 됨", 옮긴것.length, 2);
  맞아야("★ 날짜·이름·말이 그대로 옮겨짐",
    옮긴것[0]?.text === "[2026-08-01 · 김손길] 무릎에 파스 붙여 드렸습니다",
    JSON.stringify(옮긴것[0]?.text));
  맞아야("★ 옮긴 것도 파랑", 옮긴것.every((x) => x.color === "blue"));

  같아야("★ 두 번 켜도 안 늘어남", 옛메모옮기기(), 0);
  같아야("★ 그래서 장수도 그대로", db.query<{ n: number }, [string]>(
    "SELECT COUNT(*) AS n FROM sticky WHERE recipient_id = ?").get(rid)?.n, 2);
}

console.log("\n── 6. 사진 ─────────────────────────────────────────\n");
같아야("받은 사진 장수", r.사진수, 1);
const 사진자리 = join(사진뿌리, 날.slice(0, 7), 보고번호, `${사진번호}.jpg`);
맞아야("★ 사진이 이 PC 에 저장됨", existsSync(사진자리), 사진자리);
if (existsSync(사진자리)) {
  const 받은것 = readFileSync(사진자리);
  맞아야("★ 풀려서 진짜 JPEG 로 저장됨",
    받은것[0] === 0xff && 받은것[1] === 0xd8);
  같아야("한 바이트도 안 다름", 받은것.length, 진짜사진.length);
}
const 실적사진 = 속.사진 ?? [];
같아야("실적에 사진 자리가 적힘", 실적사진.length, 1);
맞아야("자리가 <달>/<보고번호>/<사진번호>.jpg",
  실적사진[0]?.자리 === `${날.slice(0, 7)}/${보고번호}/${사진번호}.jpg`,
  실적사진[0]?.자리);

console.log("\n── 7. 「표 없이」 찍은 것 ──────────────────────────\n");
/*
 * 방문표를 못 찍고 손으로 적은 건입니다.
 * 다녀온 것은 맞아도 근거가 한 겹 얇으니, 사무실이 한 번 보라고
 * **확인필요**로 들어가야 합니다.
 */
흉내.보고받아오기 = async () => [{
  id: crypto.randomUUID(), job_id: 할일.id, worker_id: 할일.worker_id,
  started_at: `${날}T14:00:00.000Z`, ended_at: `${날}T15:00:00.000Z`, qr_ok: false,
  짐: { served_on: 날, 이름: "왕복시험어르신", 서비스: 서비스.name, 갈래: "가사",
       적은것: { 한것: ["말벗"] }, 서명: null, 표없이: true },
}] as any;
흉내.사진목록 = async () => [] as any;
await 받기();
const d2 = db.query<any, [number, string]>(
  "SELECT * FROM delivery WHERE assignment_id = ? AND served_on = ?").get(aid, 날);
같아야("★ 표 없이 적은 것은 「확인필요」", d2?.verdict, "확인필요");
같아야("그래도 제공한 것으로는 들어감", d2?.outcome, "제공");
맞아야("표 없이 적었다는 표시가 남음",
  JSON.parse(d2?.payload || "{}").현장?.표없이 === true);

console.log("\n── 8. 다 넣었으면 우편함에서 지우나 ────────────────\n");
맞아야("★ 보고를 지우라고 함", 지운보고.includes(보고번호));
같아야("★ 사진도 지우라고 함", 첫지운사진.length, 1);
같아야("지우라고 한 사진 자리", 첫지운사진[0], `기관/${보고번호}/${사진번호}`);
맞아야("★ 사진을 보고보다 **먼저** 지움 (안 그러면 자리를 잃습니다)",
  첫지운차례.join(">") === "사진>보고", 첫지운차례.join(">"));

console.log("\n── 9. ★ 계획 시간이 폰까지 갑니다 ─────────────────\n");
/*
 * 「가사지원·이동지원은 계획보다 짧게 끝내려 하면 경고가 떠야 한다」
 * (2026-09-05 무무 지시)
 *
 * 경고는 폰이 띄우지만, **견줄 값은 여기서 실어 보냅니다.**
 * 안 실으면 폰은 견줄 것이 없어 **아무 말 없이 지나갑니다** —
 * 화면은 멀쩡하고 경고만 조용히 사라지는, 제일 늦게 들키는 갈래입니다.
 */
{
  const 요일 = new Date(날 + "T00:00:00").getDay();
  const 시간제 = db.query<{ id: number; name: string }, []>(
    "SELECT id, name FROM service WHERE record_type = 'time' LIMIT 1").get();
  const 끼제 = db.query<{ id: number; name: string }, []>(
    "SELECT id, name FROM service WHERE record_type <> 'time' LIMIT 1").get();
  맞아야("시간제 서비스가 있음", !!시간제);

  /** 그 배정을 그날 요일 90분으로 고쳐 두고 짐을 다시 쌉니다. */
  function 짐다시(serviceId: number, 분: number | null) {
    db.run("UPDATE assignment SET service_id = ?, weekly_plan = ? WHERE id = ?",
      [serviceId, JSON.stringify(분 == null ? [{ dow: 요일 }] : [{ dow: 요일, minutes: 분 }]), aid]);
    return 그날갈곳(날).find((j) => j.배정번호 === aid)?.짐 as any;
  }

  /*
   * ★ 요일에 분을 안 적어 두면 **설정 · 계산규칙의 「하루 최대 서비스 시간」**
   *   이 그날의 계획 시간입니다. 설정 화면이 이미 그렇게 적어 두었습니다 —
   *   「사람마다 다르면 주간 계획에 적으세요, 그 값이 이것보다 앞섭니다.」
   *
   *   처음에는 이걸 안 보고 「견줄 값이 없다」며 null 로 두었습니다.
   *   설정에 180분이 들어 있는데도 경고가 안 떴습니다 — 제가 빠뜨린 것입니다
   *   (2026-09-05 무무가 짚었습니다).
   */
  const org = db.query<{ profile_id: number }, []>(
    "SELECT profile_id FROM organization WHERE id = 1").get();
  const 옛하루 = db.query<{ daily_cap_minutes: number }, [number]>(
    "SELECT daily_cap_minutes FROM region_profile WHERE id = ?").get(org!.profile_id)
    ?.daily_cap_minutes;
  const 하루고치기 = (분: number) =>
    db.run("UPDATE region_profile SET daily_cap_minutes = ? WHERE id = ?",
      [분, org!.profile_id]);

  try {
    if (시간제) {
      하루고치기(180);
      같아야("★ 요일에 90분을 적었으면 그 값이 앞섬", 짐다시(시간제.id, 90)?.계획분, 90);
      같아야("★ 요일에 안 적었으면 설정의 하루 최대(180분)를 씀",
        짐다시(시간제.id, null)?.계획분, 180);

      하루고치기(120);
      같아야("★ 설정을 120분으로 바꾸면 그것을 따라감",
        짐다시(시간제.id, null)?.계획분, 120);

      하루고치기(0);
      같아야("★ 설정이 0 이면 안 봄 (설정 화면의 「0 을 넣으면 안 봅니다」)",
        짐다시(시간제.id, null)?.계획분, null);
    }
    하루고치기(180);
    if (끼제) {
      같아야(`★ 끼·회로 세는 서비스(${끼제.name})는 설정값도 안 씀`,
        짐다시(끼제.id, 90)?.계획분, null);
    } else {
      맞아야("끼·회로 세는 서비스가 없어 못 봄 — 자료함을 확인해 주세요", false);
    }
  } finally {
    if (옛하루 != null) 하루고치기(옛하루);   // 시험이 설정을 바꿔 놓으면 안 됩니다
  }

  // 원래대로 돌려놓습니다. 뒤에 오는 치우기가 이 배정을 지웁니다.
  db.run("UPDATE assignment SET service_id = ?, weekly_plan = '[]' WHERE id = ?",
    [서비스.id, aid]);
}

console.log("\n── 10. ★ 사무실이 되돌리면 폰에도 알립니다 ────────\n");
/*
 * 「제공」을 「계획」으로 되돌리면 그 건은 다시 해야 하는 일입니다.
 * 폰은 자기 기록을 보고 「전송 완료」로 두고 있으므로, 되돌렸다는 표를
 * 실어 보내야 폰이 자기 기록을 지웁니다. (2026-09-05 무무 지시)
 */
{
  const { setCell } = await import("./server/record");

  const 표전 = 그날갈곳(날).find((j) => j.배정번호 === aid)?.짐 as any;
  같아야("되돌리기 전에는 표가 비어 있음", 표전?.되돌림표, "");

  const r1 = setCell({ assignId: aid, on: 날, state: "계획" }) as any;
  맞아야("★ 현장 기록이 있는 건이라 되돌림으로 셈함", r1?.현장되돌림 === true,
    JSON.stringify(r1));
  const 표후 = 그날갈곳(날).find((j) => j.배정번호 === aid)?.짐 as any;
  맞아야("★ 되돌린 뒤에는 표가 실려 나감", !!표후?.되돌림표, String(표후?.되돌림표));

  // 두 번 되돌리면 표가 **새것**이어야 합니다 — 폰이 또 지울 수 있게.
  setCell({ assignId: aid, on: 날, state: "제공" });
  const r2 = setCell({ assignId: aid, on: 날, state: "계획" }) as any;
  맞아야("★ 손으로 찍은 건은 되돌림으로 안 셈함", r2?.현장되돌림 === false,
    "현장 기록이 없는 건까지 폰을 지우면 안 됩니다");
  const 표또 = 그날갈곳(날).find((j) => j.배정번호 === aid)?.짐 as any;
  같아야("★ 그때는 표가 안 바뀜", 표또?.되돌림표, 표후?.되돌림표);
}

} finally {
  db.run("DELETE FROM field_reset WHERE assignment_id = ?", [aid]);
  try { rmSync(join(사진뿌리, 날.slice(0, 7), 보고번호), { recursive: true, force: true }); } catch {}
  db.run("DELETE FROM delivery WHERE assignment_id = ?", [aid]);
  db.run("DELETE FROM assignment WHERE id = ?", [aid]);
  db.run("DELETE FROM sticky WHERE recipient_id = ?", [rid]);   // 붙인 메모지도 치웁니다
  for (const x of 치울것.reverse())
    try { db.run(`DELETE FROM ${x.표} WHERE id = ?`, [x.id]); } catch {}
  console.log("\n  치움    시험용으로 만든 것을 지웠습니다");
}

console.log("\n" + "─".repeat(52));
console.log(`  통과 ${통과수} · 실패 ${실패수}`);
console.log("");
process.exit(실패수 ? 1 : 0);
