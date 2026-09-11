/**
 * 한도를 넘는 계획은 **저장되지 않습니다** — 2026-09-08 무무 지시.
 *
 *   bun 계획막기시험.ts
 *
 * (무무 — 「연간 150만원/월한도 넘길 때 — **막지만** 한도를 넘게 계획했다고
 *  관리자에게 알려야 함」 / 막는 자리는 「**가. 계획.** 계획이 안되면 실적도
 *  따라서 할 수가 없어.」)
 *
 * ── 어디에 시험을 두나 ──────────────────────────────────────
 *
 * **`saveAssign()` 에 둡니다.** 규칙이 사는 곳이 거기이기 때문입니다.
 * 화면에도 같은 경고가 있지만 화면은 우회할 수 있고, 주소를 바로 두드리면
 * 화면을 안 지납니다. **막는 자리는 저장하는 곳 하나**여야 하고,
 * 시험도 그 자리를 눌러야 합니다.
 *
 * 여기서 보는 것:
 *   1) 한도 안이면 그냥 저장된다
 *   2) 월 한도(시간)를 넘기면 **막힌다**
 *   3) 월 한도(횟수)를 넘기면 **막힌다**
 *   4) 막을 때 **무엇이 얼마나 넘는지**를 말해 준다 (막기만 하면 안 됩니다)
 *   5) 넘겨 저장돼 있던 것을 **줄이는 저장은 통과**한다 ← 덫 막기
 *   6) 넘겨 저장돼 있던 것을 **그대로 두는 저장도 통과**한다 (담당자만 바꾸기)
 *   7) 넘겨 저장돼 있던 것을 **더 늘리면 막힌다**
 *   8) 한도가 0 이면 (「안 봅니다」) 막지 않는다
 *   9) 연간 한도를 넘기면 막힌다
 */
import { randomUUID } from "node:crypto";
import { db, initDb } from "./server/db";
initDb();
import { saveAssign } from "./server/assign";
import { 그날갈곳 } from "./server/할일보내기";
import { 그달가는날 } from "./server/가는날";

let 통과수 = 0, 실패수 = 0;
function 통과해야(무엇: string, 참: unknown, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}

const 프로필: any = db.query(
  `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`
).get();

const 사람 = randomUUID();
const 만든서비스: number[] = [];
let 담당: number = 0;
const 옛연간 = Number(프로필?.annual_cap ?? 0);

/** 오늘부터 넉넉히 잡습니다 — 계획재기는 **오늘 이후**만 셉니다. */
const 오늘 = new Date().toISOString().slice(0, 10);
const 두달뒤 = (() => {
  const d = new Date(오늘 + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 2);
  return d.toISOString().slice(0, 10);
})();

function 서비스(name: string, unit: string, 한도분: number, 한도횟수: number, 단가 = 24000) {
  const i = db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, period_cap_months,
                          round_unit, round_half, sort_order, active, custom)
     VALUES (?,?,'시험','시험','시험',?,?,?,NULL,'time',NULL,0,?,?,2,30,1,900,1,1)`,
    [프로필.id, `BLK-${randomUUID().slice(0, 8)}`, name, unit, 단가, 한도분, 한도횟수]);
  const id = Number(i.lastInsertRowid); 만든서비스.push(id); return id;
}

/** 저장을 눌러 봅니다. 막히면 그 말을, 통과하면 null 을 돌려줍니다. */
function 저장(svc: number, 요일들: number[], 분: number,
              달번 = 0, from = 오늘, to = 두달뒤): string | null {
  try {
    saveAssign({
      recipientId: 사람, serviceId: svc, userId: 담당, from, to,
      slots: 요일들.map((d) => ({ dow: d, minutes: 분 })) as any,
      monthlyTimes: 달번,
      allowRoleAdd: true,
    });
    return null;
  } catch (e: any) { return String(e?.message ?? e); }
}

const 배정있나 = (svc: number) => !!db.query<any, [string, number]>(
  "SELECT id FROM assignment WHERE recipient_id = ? AND service_id = ? ORDER BY id DESC LIMIT 1"
).get(사람, svc);
const 배정슬롯 = (svc: number) => String(db.query<any, [string, number]>(
  "SELECT weekly_plan AS w FROM assignment WHERE recipient_id = ? AND service_id = ? ORDER BY id DESC LIMIT 1"
).get(사람, svc)?.w ?? "");

try {
  /* 대상자와 담당 하나씩 만듭니다. */
  db.run(
    `INSERT INTO recipient (id, payload, search_text, dong, status, status_since,
       no_show_count, no_show_streak, created_at, updated_at, visit_code)
     VALUES (?,?,?,?,'이용',?,0,0,?,?,?)`,
    [사람, JSON.stringify({ name: "막기시험" }), "막기시험", "해남읍", 오늘, 오늘, 오늘,
     randomUUID().slice(0, 8)]);
  const u = db.run(
    `INSERT INTO app_user (login_id, name, roles, status, pw_hash, created_at)
     VALUES (?,?,?,'active','x',?)`,
    [`blk-${randomUUID().slice(0, 8)}`, "막기시험담당", JSON.stringify(["worker"]), 오늘]);
  담당 = Number(u.lastInsertRowid);

  /*
   * ★ 1~7 은 **월 한도만** 봅니다. 연간 한도를 켜 두면 월 한도를 보려는
   *   시험이 연간에 걸려 죽어서, 무엇이 막았는지 알 수 없게 됩니다.
   *   연간은 8번에서 따로 켜서 봅니다.
   */
  db.run("UPDATE region_profile SET annual_cap = 0 WHERE id = ?", [프로필.id]);

  // ── 1. 한도 안이면 그냥 저장된다 ──────────────────────────
  console.log("\n── 1. 한도 안 ───────────────────────────────────────────\n");
  /* 월 12시간. 주 1회 × 1시간이면 한 달 4~5시간이라 넉넉히 듭니다. */
  const 가사 = 서비스("막기_가사", "hour", 720, 0);
  통과해야("한도 안이면 막지 않습니다", 저장(가사, [3], 60) === null);
  통과해야("정말로 저장됐습니다", 배정있나(가사));

  // ── 2. 월 한도(시간)를 넘기면 막힌다 ──────────────────────
  console.log("\n── 2. 월 한도(시간) ─────────────────────────────────────\n");
  /* 월 2시간짜리 서비스에 주 5일 × 1시간 = 한 달 20시간쯤. */
  const 빡센가사 = 서비스("막기_빡센가사", "hour", 120, 0);
  const 말2 = 저장(빡센가사, [1, 2, 3, 4, 5], 60);
  통과해야("월 한도(시간)를 넘기면 **막힙니다**", 말2 !== null);
  통과해야("자료함에 아무것도 안 들어갔습니다", !배정있나(빡센가사));

  // ── 3. 무엇이 얼마나 넘는지 말해 준다 ─────────────────────
  console.log("\n── 3. 막으면서 알려 준다 ────────────────────────────────\n");
  통과해야("「저장할 수 없습니다」라고 분명히 말합니다",
    !!말2 && 말2.includes("저장할 수 없습니다"));
  통과해야("**어느 한도**인지 이름이 나옵니다",
    !!말2 && 말2.includes("막기_빡센가사"));
  통과해야("**얼마나** 넘는지 나옵니다", !!말2 && 말2.includes("넘습니다"));
  통과해야("**어떻게 하라**는 말이 있습니다 (막기만 하면 안 됩니다)",
    !!말2 && 말2.includes("줄여"));
  통과해야("넘긴 몫을 **누가 떠안는지** 알려 줍니다",
    !!말2 && 말2.includes("기관이 떠안습니다"));

  // ── 4. 월 한도(횟수) ──────────────────────────────────────
  console.log("\n── 4. 월 한도(횟수) ─────────────────────────────────────\n");
  /* 편람의 식사지원 그대로 — **월 8회**. 주 1회면 4~5번이라 듭니다. */
  const 식사 = 서비스("막기_식사", "meal", 0, 8, 11000);
  통과해야("월 8회짜리에 주 5일(월 20번쯤)을 잡으면 막힙니다",
    저장(식사, [1, 2, 3, 4, 5], 0) !== null);
  통과해야("자료함에 아무것도 안 들어갔습니다", !배정있나(식사));
  통과해야("월 8회짜리에 주 1회(월 4~5번)면 통과합니다", 저장(식사, [3], 0) === null);
  /*
   * ★★ **동행지원(월 2회)** — v34 로 풀린 자리입니다.
   *
   *   주 단위로만 짜면 한 주에 한 번이 최소인데 그것만도 한 달 4~5번이라
   *   **월 2회짜리는 배정 자체가 안 됐습니다.** 「한 달에 몇 번」을
   *   넣고 나서야 짤 수 있게 됐습니다 (2026-09-08 무무 「가!로 하자」).
   */
  const 동행 = 서비스("막기_동행", "hour", 360, 2, 27000);
  const 동행말 = 저장(동행, [3], 60, 0);
  통과해야("월 2회짜리를 **매주**로 잡으면 막힙니다", 동행말 !== null);
  통과해야("★ 「한 달에 2번」으로 바꾸라고 **길을 알려 줍니다**",
    !!동행말 && 동행말.includes("한 달에 2번"),
    (동행말 ?? "").split("\n").find((l) => l.includes("★"))?.slice(0, 60));
  통과해야("요일만 줄여서는 안 된다고 못박습니다",
    !!동행말 && 동행말.includes("요일만 줄여서는"));
  통과해야("★ **「한 달에 2번」으로 잡으면 저장됩니다**", 저장(동행, [3], 60, 2) === null);
  통과해야("정말로 저장됐습니다", 배정있나(동행));
  통과해야("「한 달에 3번」은 다시 막힙니다 (한도는 2회)", 저장(동행, [3], 60, 3) !== null);

  /* 이미용 — 월 1회. 같은 자리입니다. */
  const 이미용 = 서비스("막기_이미용", "time", 0, 1, 24000);
  통과해야("월 1회짜리(이미용)도 매주로는 막힙니다", 저장(이미용, [5], 0, 0) !== null);
  통과해야("「한 달에 1번」이면 저장됩니다", 저장(이미용, [5], 0, 1) === null);

  /*
   * ★ **고쳐 쓸 때도** 주기가 저장되나.
   *   같은 담당이면 새 줄을 안 넣고 **있던 줄을 고칩니다.** 새로 넣는
   *   쪽에만 주기를 실으면, 주기를 바꿔 저장해도 옛 주기가 그대로 남아
   *   화면과 자료함이 다른 말을 합니다.
   */
  const 주기값 = () => Number(db.query<any, [string, number]>(
    "SELECT monthly_times m FROM assignment WHERE recipient_id = ? AND service_id = ? ORDER BY id DESC LIMIT 1"
  ).get(사람, 이미용)?.m ?? -1);
  통과해야("새로 넣을 때 주기가 자료함에 남습니다", 주기값() === 1, String(주기값()));
  통과해야("(준비) 같은 담당으로 다시 저장 — 고쳐 쓰는 길",
    저장(이미용, [5], 0, 1) === null);
  const 옛번호 = db.query<any, [string, number]>(
    "SELECT id FROM assignment WHERE recipient_id = ? AND service_id = ? ORDER BY id DESC LIMIT 1"
  ).get(사람, 이미용)?.id;
  /* 한도를 잠시 풀고 주기만 바꿔 봅니다 — 막기와 저장을 갈라 보기 위해서입니다. */
  db.run("UPDATE service SET monthly_cap_count = 0 WHERE id = ?", [이미용]);
  통과해야("주기를 3으로 바꿔 저장", 저장(이미용, [5], 0, 3) === null);
  통과해야("★ **고쳐 쓸 때도** 주기가 바뀝니다", 주기값() === 3, String(주기값()));
  통과해야("줄을 새로 만들지 않고 있던 줄을 고쳤습니다",
    db.query<any, [string, number]>(
      "SELECT id FROM assignment WHERE recipient_id = ? AND service_id = ? ORDER BY id DESC LIMIT 1"
    ).get(사람, 이미용)?.id === 옛번호);
  db.run("UPDATE service SET monthly_cap_count = 1 WHERE id = ?", [이미용]);

  // ── 5·6·7. 이미 넘겨 저장돼 있는 것 ★ 덫 막기 ─────────────
  console.log("\n── 5. 이미 넘겨 저장돼 있는 배정 ────────────────────────\n");
  const 옛것 = 서비스("막기_옛것", "hour", 120, 0);
  /* 한도를 안 보는 상태로 **먼저 넣어 둡니다** — 옛 자료함을 흉내 냅니다. */
  db.run("UPDATE service SET monthly_cap_minutes = 0 WHERE id = ?", [옛것]);
  통과해야("(준비) 한도 없이 주 5일을 넣어 둡니다", 저장(옛것, [1, 2, 3, 4, 5], 60) === null);
  db.run("UPDATE service SET monthly_cap_minutes = 120 WHERE id = ?", [옛것]);

  통과해야("**그대로 다시 저장**은 통과합니다 (담당자만 바꾸는 경우)",
    저장(옛것, [1, 2, 3, 4, 5], 60) === null);
  통과해야("**줄이는 저장**은 통과합니다", 저장(옛것, [1, 3], 60) === null);
  통과해야("정말로 줄어들었습니다", 배정슬롯(옛것).includes("1") && !배정슬롯(옛것).includes("5"));

  console.log("\n── 6. 줄인 뒤에는 다시 못 늘립니다 ──────────────────────\n");
  const 늘림 = 저장(옛것, [1, 2, 3, 4, 5], 60);
  통과해야("한 번 줄인 뒤 **더 늘리면 막힙니다**", 늘림 !== null);
  통과해야("자료함은 줄인 그대로입니다", !배정슬롯(옛것).includes("5"));

  // ── 7. 한도 0 = 「안 봅니다」 ─────────────────────────────
  console.log("\n── 7. 한도 0 은 안 봅니다 ───────────────────────────────\n");
  const 안봄 = 서비스("막기_안봄", "hour", 0, 0);
  통과해야("월 한도가 0 이면 아무리 잡아도 안 막습니다",
    저장(안봄, [1, 2, 3, 4, 5], 180) === null);

  /* ── 7-나. ★ 1회 시간을 안 적었을 때 ★ ───────────────────
   *
   * 파일럿 첫날의 고비였습니다. 군이 보낸 의뢰를 **그대로** 옮겨
   * 「가사지원 · 주 2회」로 요일 두 개만 골랐는데 저장이 막혔습니다.
   * 1회 시간을 안 적으면 **설정의 하루 최대(3시간)**로 셌기 때문입니다 —
   * 한 달 9번 × 3시간 = 27시간, 한도는 12시간.
   *
   * 2026-09-09 무무 「안 적었을 때 1시간으로 정하자」.
   * 이제 9번 × 1시간 = 9시간 → 12시간 안에 듭니다.
   *
   * ★ 이 시험이 무너지면 **관리자는 첫 배정에서 막힙니다.**
   */
  console.log("\n── 7-나. 1회 시간을 안 적었을 때 ────────────────────────\n");
  {
    // 편람 그대로: 가사지원 월 12시간(720분), 횟수 한도 없음.
    const 가사같은것 = 서비스("막기_가사_편람", "hour", 720, 0);

    // 분을 0 으로 보내면 화면에서 칸을 비워 둔 것과 같습니다.
    통과해야("★★ 의뢰 그대로 「주 2회」는 1회 시간을 안 적어도 저장됩니다",
      저장(가사같은것, [2, 4], 0) === null);
    통과해야("정말로 저장됐습니다", 배정있나(가사같은것));

    /*
     * 그래도 **막을 것은 막아야 합니다.** 1시간짜리라도 주 5회면
     * 한 달 21~23번 = 21시간이 넘어 12시간을 넘습니다.
     */
    const 다섯 = 서비스("막기_가사_다섯", "hour", 720, 0);
    const 말 = 저장(다섯, [1, 2, 3, 4, 5], 0);
    통과해야("1시간이라도 주 5회면 여전히 막습니다", 말 !== null, String(말).split("\n")[0]);
    통과해야("막았으면 안 들어갔습니다", !배정있나(다섯));
  }

  /* ── 7-다. ★ 설정의 「1회 서비스 시간」을 따르나 ★ (v36) ───
   *
   * (무무 2026-09-11 — 「1회 서비스를 60분으로 한도 내에서 사용할 수도
   *  있는데 설정에서 이를 반영하지 못한다」)
   *
   * 코드에 박힌 60분이 아니라 **서비스마다 설정한 값**을 봐야 합니다.
   * 그래야 「우리는 한 번에 90분씩 한다」는 기관이 배정마다 손으로
   * 치지 않아도 됩니다.
   */
  console.log("\n── 7-다. 설정의 1회 서비스 시간 ────────────────────────\n");
  {
    const 아흔분 = 서비스("막기_90분", "hour", 720, 0);
    db.run("UPDATE service SET once_minutes = 90 WHERE id = ?", [아흔분]);

    /* 주 1회면 한 달 4~5번 × 90분 = 6~7시간 30분. 12시간 안입니다. */
    통과해야("★ 설정 90분 · 주 1회는 저장됩니다", 저장(아흔분, [3], 0) === null);
    통과해야("정말로 저장됐습니다", 배정있나(아흔분));

    /* 주 2회면 한 달 9번쯤 × 90분 = 13시간 30분. 12시간을 넘습니다. */
    const 둘 = 서비스("막기_90분_둘", "hour", 720, 0);
    db.run("UPDATE service SET once_minutes = 90 WHERE id = ?", [둘]);
    const 말 = 저장(둘, [2, 4], 0);
    통과해야("★★ 설정 90분 · 주 2회는 한도를 넘어 막힙니다", 말 !== null,
      String(말).split("\n")[0]);

    /*
     * ★ 같은 서비스라도 **60분으로 설정하면 주 2회가 통과**해야 합니다.
     *   이것이 「설정을 정말로 보고 있는가」를 가르는 자리입니다.
     */
    const 셋 = 서비스("막기_60분_둘", "hour", 720, 0);
    db.run("UPDATE service SET once_minutes = 60 WHERE id = ?", [셋]);
    통과해야("★★ 같은 주 2회라도 설정이 60분이면 통과합니다",
      저장(셋, [2, 4], 0) === null);
    통과해야("정말로 저장됐습니다", 배정있나(셋));

    /* 배정에 적은 값이 설정보다 앞섭니다. */
    const 넷 = 서비스("막기_적은값이앞", "hour", 720, 0);
    db.run("UPDATE service SET once_minutes = 90 WHERE id = ?", [넷]);
    통과해야("★ 배정에 60분을 적으면 설정 90분보다 앞섭니다",
      저장(넷, [2, 4], 60) === null);

    /* 안 정했으면(0) 60분으로 봅니다. */
    const 다섯 = 서비스("막기_안정함", "hour", 720, 0);
    db.run("UPDATE service SET once_minutes = 0 WHERE id = ?", [다섯]);
    통과해야("안 정했으면 60분으로 봅니다 (주 2회 통과)",
      저장(다섯, [2, 4], 0) === null);
  }

  // ── 8. 연간 한도 ─────────────────────────────────────────
  console.log("\n── 8. 연간 지원한도 ─────────────────────────────────────\n");
  db.run("UPDATE region_profile SET annual_cap = 100000 WHERE id = ?", [프로필.id]);
  const 연간 = 서비스("막기_연간", "hour", 0, 0, 24000);
  const 말8 = 저장(연간, [1, 2, 3, 4, 5], 180);
  통과해야("연간 10만원 한도에 큰 계획을 넣으면 막힙니다", 말8 !== null);
  통과해야("연간 한도라고 이름이 나옵니다",
    !!말8 && 말8.includes("연간 지원한도"), (말8 ?? "").split("\n")[2]);
  통과해야("자료함에 아무것도 안 들어갔습니다", !배정있나(연간));
  db.run("UPDATE region_profile SET annual_cap = ? WHERE id = ?", [옛연간, 프로필.id]);

  // ── ★ 10. 사무실과 **현장앱이 같은 날**을 봅니다 ★ ────────
  console.log("\n── 10. ★ 사무실과 현장앱이 같은 날을 보나 ★ ────────────\n");
  /*
   * 여기가 이 판(v34)에서 **제일 무서운 자리**입니다.
   * 사무실 달력은 「한 달에 2번」인데 제공인력 폰이 매주 뜨면,
   * 어르신 댁 앞에서 「오늘 아닌데요」가 됩니다. 반대면 어르신이
   * 기다리십니다. 그래서 **날짜를 맞대어 봅니다.**
   */
  db.run("UPDATE app_user SET mailbox_worker_id = ? WHERE id = ?",
         [`blk-phone-${randomUUID().slice(0, 6)}`, 담당]);
  const 폰서비스 = 서비스("막기_폰", "hour", 0, 0);
  const 이번달 = 오늘.slice(0, 7);
  /* 요일 일곱을 다 잡아 놓고, 이 달 안에서만 봅니다. */
  const 달끝 = (() => {
    const [y, m] = 이번달.split("-").map(Number);
    return `${이번달}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  })();
  통과해야("(준비) 「한 달에 2번」으로 잡습니다",
    저장(폰서비스, [0, 1, 2, 3, 4, 5, 6], 60, 2, 오늘, 달끝) === null);

  const 배정줄: any = db.query(
    "SELECT * FROM assignment WHERE recipient_id = ? AND service_id = ? ORDER BY id DESC LIMIT 1"
  ).get(사람, 폰서비스);
  const 사무실날들 = 그달가는날(배정줄, 이번달);
  통과해야("사무실이 보는 날은 **두 날뿐**", 사무실날들.length <= 2, 사무실날들.join(" "));

  let 어긋난날 = 0, 본날 = 0;
  const [yy, mm] = 이번달.split("-").map(Number);
  const 끝일 = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  for (let d = 1; d <= 끝일; d++) {
    const ymd = `${이번달}-${String(d).padStart(2, "0")}`;
    if (ymd < 오늘) continue;                       // 오늘부터만 봅니다
    본날++;
    const 폰에떴나 = 그날갈곳(ymd).some((x) => x.배정번호 === 배정줄.id);
    if (폰에떴나 !== 사무실날들.includes(ymd)) 어긋난날++;
  }
  통과해야("★ 현장앱이 **사무실과 똑같은 날**에만 뜹니다",
    어긋난날 === 0, `${본날}날 확인, 어긋남 ${어긋난날}`);

  // ── 9. 못 재면 막지 않는다 ───────────────────────────────
  console.log("\n── 9. 못 재면 막지 않습니다 ─────────────────────────────\n");
  /* 없는 대상자로 부르면 계획재기가 터집니다. 그래도 저장은 자기 이유로만 막혀야 합니다. */
  let 딴이유 = "";
  try {
    saveAssign({ recipientId: randomUUID(), serviceId: 가사, userId: 담당,
      from: 오늘, to: 두달뒤, slots: [{ dow: 3, minutes: 60 }] as any, allowRoleAdd: true });
  } catch (e: any) { 딴이유 = String(e?.message ?? e); }
  통과해야("재기가 터져도 **한도 때문에** 막지는 않습니다",
    !딴이유.includes("한도를 넘습니다"), 딴이유.slice(0, 40) || "(막지 않음)");
} catch (e: any) {
  실패수++;
  console.log(`\n✗ 시험 도중 터졌습니다 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 5).join("\n"));
} finally {
  db.run("UPDATE region_profile SET annual_cap = ? WHERE id = ?", [옛연간, 프로필.id]);
  db.run("DELETE FROM assignment WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM delivery WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM recipient WHERE id = ?", [사람]);
  if (담당) { db.run("DELETE FROM worker WHERE user_id = ?", [담당]);
              db.run("DELETE FROM app_user WHERE id = ?", [담당]); }
  for (const s of 만든서비스) db.run("DELETE FROM service WHERE id = ?", [s]);
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
