/**
 * **제공인력 휴대폰이 올린 보고 한 건**을 이 자료함에 넣습니다.
 *
 *   bun 도구/폰보고넣기.ts <배정번호> <날짜>
 *
 * ── 왜 있나 ────────────────────────────────────────────────
 *
 * `보고왕복시험.ts` 는 폰이 올린 것이 **자료함**까지 오는지를 봅니다.
 * 그런데 파일럿에서 관리자가 실제로 겪는 것은 자료함이 아니라
 * **사무실 화면에 그것이 어떻게 뜨는가**입니다 — 「현장에서 올라온 것」
 * 표시, 진행시간, 서명, 특이사항이 메모지로 넘어갔는지.
 *
 * 그걸 보려면 **빈 자료함으로 띄운 프로그램**에 보고가 하나 들어와
 * 있어야 하는데, 그 프로그램은 딴 폴더에서 도는 딴 살림입니다.
 * 그래서 **그 폴더에서 이 파일을 돌립니다** — 그러면 `server/db` 가
 * 그 자료함을 엽니다(자료함 자리는 `process.cwd()/data`).
 *
 * ── 진짜 우편함에 안 붙습니다 ──────────────────────────────
 *
 * 인터넷도 무무 님 열쇠도 없이 돌아야 합니다. 우편함만 흉내 내고
 * **받아 넣는 길은 진짜 `보고받기()`** 를 그대로 씁니다 — 화면에
 * 뜨는 모양이 진짜와 달라지면 안 되기 때문입니다.
 */
import { db, initDb } from "../server/db";
import { 그날갈곳 } from "../server/할일보내기";

initDb();

const 배정번호 = Number(process.argv[2]);
const 날 = String(process.argv[3] ?? new Date().toISOString().slice(0, 10));
if (!Number.isFinite(배정번호) || 배정번호 <= 0) {
  console.error("쓰는 법:  bun 도구/폰보고넣기.ts <배정번호> <날짜>");
  process.exit(2);
}

/*
 * ── 휴대폰이 안 이어져 있으면 **이은 셈 칩니다** ─────────────
 *
 * 진짜 기기 등록은 우편함(Supabase)을 거칩니다 — 인터넷이 없는 곳에서는
 * 못 합니다. 그런데 `할일보내기.ts` 는 **폰이 안 이어진 사람을 건너뛰므로**
 * (`if (!r.폰번호) continue;`) 이어 두지 않으면 보고를 넣을 수가 없습니다.
 *
 * ★ 이건 **시험을 위한 지름길**입니다. 사무실 화면이 폰이 안 이어진 것을
 *   알려 주는지는 `home.ts` 의 설정 점검이 따로 봅니다 — 여기서 이어
 *   버린다고 그 점검이 무뎌지지 않습니다.
 */
{
  const w = db.query<{ uid: number; 폰: string | null }, [number]>(
    `SELECT u.id AS uid, u.mailbox_worker_id AS 폰
       FROM assignment a JOIN worker w ON w.id = a.worker_id
       JOIN app_user u ON u.id = w.user_id
      WHERE a.id = ?`).get(배정번호);
  if (w && !w.폰) {
    db.run("UPDATE app_user SET mailbox_worker_id = ? WHERE id = ?",
      [crypto.randomUUID(), w.uid]);
    console.error(`(폰이 안 이어져 있어 이은 셈 쳤습니다 — 사용자 ${w.uid})`);
  }
}

const 할일 = 그날갈곳(날).find((j) => j.배정번호 === 배정번호);
if (!할일) {
  console.error(`그날(${날}) 갈 곳에 배정 ${배정번호} 이 없습니다.`);
  console.error("가는 요일이 아니거나 배정 기간 밖입니다.");
  process.exit(3);
}

const 보고번호 = crypto.randomUUID();
const 사진번호 = crypto.randomUUID();
const 사진 = new Uint8Array(new ArrayBuffer(1200));
사진[0] = 0xff; 사진[1] = 0xd8;                 // JPEG 머리
crypto.getRandomValues(사진.subarray(2));

const 흉내우편함 = {
  async 보고받아오기() {
    return [{
      id: 보고번호, job_id: 할일.id, worker_id: 할일.worker_id,
      started_at: `${날}T09:05:00.000Z`, ended_at: `${날}T10:35:00.000Z`,
      qr_ok: true,
      짐: {
        served_on: 날, 이름: 할일.짐?.이름 ?? "", 서비스: 할일.짐?.서비스 ?? "", 갈래: "가사",
        적은것: {
          한것: ["청소", "세탁"],
          기타: "약 봉투 정리",
          특이사항: "무릎이 아프시다고 하셔서 외출은 다음으로 미뤘습니다.",
        },
        서명: "data:image/png;base64,iVBORw0KGgo=",
        서명받은때: `${날}T10:36:00.000Z`,
        표없이: false,
      },
    }];
  },
  async 사진목록() {
    return [{ id: 사진번호, report_id: 보고번호, path: `기관/${보고번호}/${사진번호}` }];
  },
  async 사진받기(_길: string) { return 사진; },
  async 사진지우기(_길들: string[]) { },
  async 받은것지우기(_ids: string[]) { },
};

const { 보고받기 } = await import("../server/보고받기");
const r = await 보고받기(흉내우편함 as any);
console.log(JSON.stringify({ 받은수: r.받은수, 넣은수: r.넣은수, 못찾은수: r.못찾은수 }));
process.exit(r.넣은수 === 1 ? 0 : 4);
