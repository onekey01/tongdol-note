/*
 * ── 자료함을 **실제 규모로** 불려 놓습니다 ─────────────────
 *
 * 파일럿에서 느려지면 그때는 **자료가 이미 들어 있어** 고치기가
 * 어렵습니다. 지금 미리 불려 놓고 어디가 느린지 봅니다.
 *
 * ── 얼마나 넣나 ────────────────────────────────────────────
 *
 * 기관 한 곳이 **2년**을 쓴 모습입니다.
 *
 *   대상자 300명 · 한 사람이 서비스 1~3개 · 주 2~3회 방문
 *   → 실적 8만 줄쯤 · 청구서 1만 4천 줄쯤
 *
 * 해남군 통합돌봄 수행기관 하나가 맡는 규모를 넉넉히 잡은 것입니다.
 * 넉넉히 잡는 까닭 — **여기서 견디면 실제로는 여유가 있습니다.**
 *
 * ── 어떻게 넣나 ────────────────────────────────────────────
 *
 * 화면을 거치지 않고 **자료함에 바로** 넣습니다. API 로 8만 번을
 * 부르면 몇 시간이 걸리고, 우리가 보려는 것은 「넣는 속도」가 아니라
 * **「쌓인 뒤에 읽는 속도」**입니다.
 */
import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";

export type 규모 = {
  대상자: number;
  달수: number;          // 몇 달치를 쌓을까
  주당방문: number;      // 한 배정이 한 주에 몇 번
};

export const 이년치: 규모 = { 대상자: 300, 달수: 24, 주당방문: 2.5 };

const 성 = "김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구원";
const 이름 = ["복순","영자","순자","말순","금례","점례","옥순","춘자","분남","귀례",
  "덕수","병섭","상철","태호","길동","만수","종범","기석","용식","달구"];
const 읍면동 = ["해남읍","삼산면","화산면","현산면","송지면","북평면","북일면","옥천면",
  "계곡면","마산면","황산면","산이면","문내면","화원면"];

function 날더하기(ymd: string, 날: number) {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 날);
  return d.toISOString().slice(0, 10);
}

export function 무겁게하기(자료함길: string, 규모: 규모 = 이년치) {
  const db = new Database(자료함길);
  const 잰것: Record<string, number> = {};
  const 재기 = <T>(무엇: string, 한다: () => T): T => {
    const t = performance.now(); const r = 한다();
    잰것[무엇] = Math.round(performance.now() - t); return r;
  };

  /*
   * 한 덩어리로 씁니다. 줄마다 저장하면 8만 번 디스크를 두드려
   * **몇십 배** 느려집니다. 실제 프로그램은 한 줄씩 쓰지만, 여기서
   * 우리가 재려는 것은 넣는 속도가 아닙니다.
   */
  db.exec("PRAGMA journal_mode = WAL");

  const 서비스들 = db.query<any, []>(
    "SELECT id, unit_price, record_type FROM service WHERE active = 1").all();
  if (서비스들.length === 0) { db.close(); throw new Error("서비스가 없습니다. 기관을 먼저 개설하세요."); }
  const 인력들 = db.query<any, []>(
    "SELECT id FROM app_user WHERE status = 'active'").all();

  const 오늘 = new Date().toISOString().slice(0, 10);
  const 시작 = (() => {
    const d = new Date(오늘 + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() - 규모.달수);
    return d.toISOString().slice(0, 10);
  })();

  let 대상자수 = 0, 배정수 = 0, 실적수 = 0, 청구수 = 0;

  재기("넣기", () => db.transaction(() => {
    for (let i = 0; i < 규모.대상자; i++) {
      const rid = randomUUID();
      const 이름값 = 성[i % 성.length] + 이름[i % 이름.length] + (i > 400 ? String(i) : "");
      const 동 = 읍면동[i % 읍면동.length];
      const 태어난해 = 1930 + (i % 25);
      const payload = JSON.stringify({
        name: 이름값, birth: `${태어난해}-0${(i % 9) + 1}-1${i % 9}`,
        phone: `010-${String(1000 + (i % 9000))}-${String(1000 + ((i * 7) % 9000))}`,
        address: `전라남도 해남군 ${동} 어딘가로 ${i % 300}`,
        guardians: [{ relation: "자녀", name: "보호자" + i, phone: "010-0000-0000" }],
      });
      db.run(
        `INSERT INTO recipient (id, payload, search_text, dong, status, status_since,
           no_show_count, no_show_streak, created_at, updated_at, visit_code)
         VALUES (?,?,?,?,'이용',?,0,0,?,?,?)`,
        [rid, payload, `${이름값} ${동}`, 동, 시작, 시작, 시작, randomUUID().slice(0, 8)]);
      대상자수++;

      const 몇개 = 1 + (i % 3);
      for (let s = 0; s < 몇개; s++) {
        const sv = 서비스들[(i + s) % 서비스들.length];
        const aid = db.run(
          `INSERT INTO assignment (recipient_id, worker_id, service_id, period_from,
             period_to, weekly_plan, planned_count, created_at)
           VALUES (?,?,?,?,?,?,?,?)`,
          [rid, 인력들.length ? 인력들[(i + s) % 인력들.length].id : null, sv.id,
           시작, 날더하기(오늘, 90), JSON.stringify([1, 3]), 2, 시작]).lastInsertRowid;
        배정수++;

        /*
         * 실적 — 주당 방문 수만큼 처음부터 오늘까지 깝니다.
         * 이것이 제일 많이 쌓이는 표이고, 화면이 느려진다면 여기입니다.
         */
        const 날수 = Math.round((Date.parse(오늘) - Date.parse(시작)) / 86400000);
        const 간격 = Math.max(1, Math.round(7 / 규모.주당방문));
        for (let d = 0; d < 날수; d += 간격) {
          const 온날 = 날더하기(시작, d);
          db.run(
            `INSERT INTO delivery (assignment_id, recipient_id, service_id, served_on,
               start_at, end_at, minutes, qty, is_holiday, outcome, planned, created_at, note)
             VALUES (?,?,?,?,?,?,?,?,0,'제공',1,?,?)`,
            [aid, rid, sv.id, 온날, `${온날}T09:00:00`, `${온날}T11:00:00`,
             120, 1, 온날, d % 11 === 0 ? "현장 특이사항 몇 줄" : null]);
          실적수++;
        }
      }

      // 청구서 — 달마다 지자체 몫 + 본인부담 두 줄
      for (let m = 0; m < 규모.달수; m++) {
        const d = new Date(시작 + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + m);
        const 첫날 = d.toISOString().slice(0, 10);
        d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0);
        const 끝날 = d.toISOString().slice(0, 10);
        for (const kind of ["claim", "copay"]) {
          db.run(
            `INSERT INTO billing (recipient_id, period_from, period_to, service_amount,
               copay_rate, copay_amount, claim_amount, kind, issued_on, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [rid, 첫날, 끝날, 480000, 0.2, 96000, 384000, kind, 끝날, 끝날]);
          청구수++;
        }
      }
    }
  })());

  재기("정리(ANALYZE)", () => db.exec("ANALYZE"));
  const 크기 = Number(db.query<any, []>("SELECT page_count * page_size AS b FROM pragma_page_count(), pragma_page_size()").get()?.b ?? 0);
  db.close();
  return { 대상자수, 배정수, 실적수, 청구수, 크기, 잰것 };
}
