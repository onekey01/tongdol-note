/**
 * 현장앱이 올린 보고를 받아 자료함에 넣습니다.
 *
 * ── 이것이 없으면 ──────────────────────────────────────────
 *
 * 제공인력이 어르신 댁에서 찍고 적은 것이 **우편함에 쌓이기만** 합니다.
 * 14일 뒤 스스로 지워지고, 실적은 여전히 손으로 적어야 합니다.
 * 「오늘 갈 곳 올리기」와 똑같은 상황이었습니다 — 코드는 있는데
 * 부르는 자리가 없었습니다.
 *
 * ── 받아서 무엇을 하나 ─────────────────────────────────────
 *
 *   ① 제공실적(delivery) 한 줄을 만듭니다 — 이미 있으면 고쳐 씁니다
 *   ② 시작·종료 시각을 넣습니다 → 편람 서식의 「진행시간」
 *   ③ 확인사항과 서명을 payload 에 넣습니다 → 서식3·4·5 를 채울 거리
 *   ④ 특이사항을 **대상자 메모에 붙입니다** (날짜 · 종사자 이름과 함께)
 *   ⑤ 다 넣었으면 우편함에서 지웁니다
 *
 * ── ⑤ 를 반드시 해야 하는 까닭 ────────────────────────────
 *
 * 무료 등급의 저장 공간은 넉넉하지 않고, 무엇보다 **사람에 관한 것을
 * 남의 서버에 오래 두지 않는다**는 것이 이 물건의 약속입니다.
 * 자료함에 안전히 들어간 것만 지웁니다 — 넣기 전에 지우면 잃습니다.
 *
 * ── 어느 배정의 실적인가 ───────────────────────────────────
 *
 * 보고에는 할일번호만 들어 있습니다. 할일번호는 배정번호와 날짜를
 * 해시한 것이라 **되돌릴 수 없습니다.** 그래서 그날의 갈 곳을 다시
 * 만들어 놓고 번호로 맞춰 봅니다. 못 찾으면 **지우지 않고 남깁니다** —
 * 잃는 것보다 쌓이는 편이 낫습니다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db, metaGet, metaSet } from "./db";
import { today, 분재기 } from "./util";
import { 우편함, type 받은보고 } from "./우편함";
import { 그날갈곳 } from "./할일보내기";
import { addSticky } from "./sticky";
import { 대면원칙인가, 비대면다시셈 } from "./대면배달";

export type 받은결과 = {
  받은수: number;
  넣은수: number;
  못찾은수: number;
  메모붙인수: number;
  사진수: number;
  까닭?: string;
};

/*
 * 사진을 두는 자리.
 *
 *   data/사진/2026-09/<보고번호>/<사진번호>.jpg
 *
 * 달로 나누는 까닭 — 한 폴더에 몇 만 장이 쌓이면 탐색기가 느려지고,
 * 「작년 9월 것만 지워 주세요」 같은 일이 폴더 하나 지우기가 됩니다.
 *
 * ★ data/ 는 .gitignore 로 막혀 있습니다. 자료함과 같이 백업됩니다.
 */
const 뿌리 = dirname(dirname(fileURLToPath(import.meta.url)));
export const 사진뿌리 = join(뿌리, "data", "사진");

/** 그날의 할일번호 → 배정번호. 보고가 어느 배정 것인지 찾는 데 씁니다. */
function 그날짝표(날: string): Map<string, { 배정번호: number; 사람: string }> {
  const m = new Map<string, { 배정번호: number; 사람: string }>();
  for (const j of 그날갈곳(날)) m.set(j.id, { 배정번호: j.배정번호, 사람: j.사람 });
  return m;
}

/**
 * 특이사항을 그 대상자의 **포스트잇 보드**에 한 장 붙입니다.
 *
 * ── 왜 「내부 메모」가 아니라 포스트잇인가 ──────────────────
 *
 * 처음에는 `recipient.memo`(내부 메모) 뒤에 한 줄씩 쌓았습니다.
 * 자료는 잘 들어갔는데 **아무도 못 봤습니다.** 계약 정보 목록 맨 아래에
 * 한 줄로 붙어 있어서, 기록지를 쓰려고 그 사람 화면을 열어도 눈에
 * 안 들어옵니다.
 *
 * 포스트잇은 오른쪽에 **떼기 전까지 붙어 있습니다.** 사무실이 기록지를
 * 쓸 때 보는 자리가 거기입니다. 현장에서 온 말은 거기에 있어야
 * 쓸모가 있습니다. (2026-09-05 무무 —
 * 「포스트잇 형태의 메모에 들어가 있어야 기록지 작성 때 도움이 되지」)
 *
 * ── 날짜와 이름을 같이 적습니다 ────────────────────────────
 *
 * 몇 달 뒤에 보면 「무릎이 아프시다」가 언제 이야기인지, 누가 본
 * 것인지 알 수가 없습니다. 그것 없이는 근거가 못 됩니다.
 *
 * ── 색은 파랑 ──────────────────────────────────────────────
 *
 * 사무실이 손으로 붙인 것(노랑)과 **현장에서 저절로 올라온 것**을
 * 한눈에 가릅니다.
 *
 * 같은 말이 두 번 붙는 것을 막습니다 — 보고를 다시 받는 일이 생길 수
 * 있는데, 그때마다 메모지가 늘어나면 안 됩니다.
 */
function 포스트잇붙이기(
  recipientId: string, 날: string, 서비스: string, 종사자: string, 특이사항: string
): boolean {
  const 말 = String(특이사항 ?? "").trim();
  if (!말) return false;

  const 있나 = db.query<{ id: string }, [string]>(
    "SELECT id FROM recipient WHERE id = ?").get(recipientId);
  if (!있나) return false;

  /*
   * **서비스 이름을 같이 적습니다** (2026-09-05 무무 지시).
   * 한 어르신이 가사지원과 식사지원을 함께 받으시면, 같은 날 메모지가
   * 두 장 붙습니다. 어느 쪽 이야기인지 모르면 기록지를 쓸 때 못 씁니다.
   */
  /*
   * 서비스를 모르는 줄(옛 메모에서 옮겨 온 것)에는 **빈 칸을 지어내지
   * 않습니다.** 「서비스」라고 적어 두면 그게 이름인 줄 압니다.
   */
  const 머리 = [날, 서비스, 종사자 || "제공인력"].filter(Boolean).join(" · ");
  const 글 = `[${머리}] ${말}`;

  /*
   * 이미 붙어 있으면(뗀 것까지 봅니다) 다시 안 붙입니다.
   * 뗀 것을 다시 붙이면 사무실이 「분명 뗐는데」가 됩니다.
   */
  const 겹침 = db.query<{ id: number }, [string, string]>(
    "SELECT id FROM sticky WHERE recipient_id = ? AND text = ? LIMIT 1"
  ).get(recipientId, 글);
  if (겹침) return false;

  try {
    addSticky(
      { text: 글, color: "blue", recipientId, 저절로: true },
      { id: null, name: 종사자 || "제공인력", role: "worker" }
    );
    return true;
  } catch (e) {
    console.error("우편함: 특이사항 메모지 붙이기 실패 —", (e as Error).message);
    return false;
  }
}

/** 보고 하나를 자료함에 넣습니다. 넣었으면 true. */
/**
 * 폰에서 온 보고 한 건을 실적으로 넣습니다.
 *
 * `export` 인 까닭은 **시험이 여기를 직접 두드리기 위해서**입니다.
 * 우편함을 세우지 않고도 「폰이 이렇게 보내면 자료함이 이렇게 된다」를
 * 확인할 수 있어야 합니다 (확인사항시험.ts · 보고왕복시험.ts).
 */
export function 실적에넣기(
  보고: 받은보고, 배정번호: number,
  사진들: { 파일: string; 자리: string }[] = [],
): { 넣음: boolean; 메모: boolean } {
  const 짐 = (보고.짐 ?? {}) as any;
  const a = db.query<any, [number]>(
    "SELECT * FROM assignment WHERE id = ?").get(배정번호);
  if (!a) return { 넣음: false, 메모: false };

  const 날 = String(짐.served_on || 보고.started_at?.slice(0, 10) || today());
  const stamp = new Date().toISOString();

  /*
   * 제공인력 이름 — 메모에 적을 것입니다.
   * 못 찾으면 빈 채로 둡니다. 이름 하나 때문에 실적을 못 넣으면 안 됩니다.
   */
  const 인력 = db.query<{ name: string }, [number]>(
    `SELECT u.name FROM worker w JOIN app_user u ON u.id = w.user_id WHERE w.id = ?`
  ).get(a.worker_id);

  /*
   * payload 에 **현장에서 적은 것을 통째로** 넣습니다.
   * 서식3·4·5 를 채울 때 여기서 꺼내 씁니다.
   * 서명 그림도 여기 들어갑니다 — 자료함은 이 PC 안이라 괜찮습니다.
   */
  const 속 = JSON.stringify({
    현장: {
      적은것: 짐.적은것 ?? {},
      서명: 짐.서명 ?? null,
      서명받은때: 짐.서명받은때 ?? null,
      갈래: 짐.갈래 ?? null,
      표없이: !!짐.표없이,
      보고번호: 보고.id,
      /*
       * 현장에서 **나중에 고친 시각들.**
       * 있으면 제공실적 화면에 「고침 2번」으로 뜹니다 —
       * 다 끝난 뒤에 손댄 건이라는 표시라, 사무실이 알아야 합니다.
       */
      고침: Array.isArray(짐.고침) ? 짐.고침 : [],
      /*
       * **끝을 잘못 찍어 되돌린 시각들.**
       * 어르신 댁에 들어서면서 버릇처럼 큰 단추를 눌러 「끝」이 찍히는
       * 일이 있습니다. 폰에서 되돌릴 수 있게 해 두었는데, 조용히
       * 지우면 아무도 모릅니다. 사무실이 보게 남깁니다.
       */
      되돌림: Array.isArray(짐.되돌림) ? 짐.되돌림 : [],
      /*
       * 사진은 **자리만** 적습니다. 그림 자체를 자료함에 넣으면
       * 파일이 몇 백 MB 로 부풀어 백업이 감당이 안 됩니다.
       * 서식 뒷장에 붙일 때 이 자리로 찾아 갑니다.
       */
      사진: 사진들,
    },
  });

  /*
   * 「표 없이」 찍은 것은 **확인필요**로 둡니다.
   * 방문표를 못 찍었다는 뜻이라, 다녀온 것은 맞아도 근거가 한 겹 얇습니다.
   * 사무실이 한 번 보고 넘기라는 표시입니다.
   */
  const 판정 = 짐.표없이 ? "확인필요" : "일치";

  /*
   * ═══════════════════════════════════════════════════════════
   *  ★ 2026-09-05 바로잡음 ① — **진행시간을 안 적고 있었습니다** ★
   * ═══════════════════════════════════════════════════════════
   *
   * 폰이 시작·종료를 찍어 보내는데 `minutes` 칸을 비워 두었습니다.
   * 청구는 분이 비면 **「한 번 = 한 시간」**으로 셉니다(billing.ts).
   * 그래서 **두 시간 다녀온 것이 한 시간으로 청구**되고 있었습니다.
   * 기관이 손해를 보는 쪽이라 아무도 항의하지 않아 더 안 드러납니다.
   *
   * 하루 상한(편람 1일 3시간)은 청구 쪽이 따로 깎습니다. 여기서는
   * **잰 대로** 적습니다 — 자료함에는 있었던 일이 그대로 있어야 합니다.
   */
  const 잰분 = 분재기(보고.started_at, 보고.ended_at);

  /*
   * ═══════════════════════════════════════════════════════════
   *  ★ 2026-09-05 바로잡음 ② — **비대면이 안 남고 있었습니다** ★
   * ═══════════════════════════════════════════════════════════
   *
   * 폰에서 「비대면배달」을 골라도 `face_to_face` 칸을 안 썼습니다.
   * 자료함이 비면 **대면으로 봅니다**(`대면이었나` — 원칙이 대면).
   * 그래서 문 앞에 두고 온 것이 사무실에는 전부 대면으로 보였고,
   * 계약서 5-2조의 「3회 연속이면 통합돌봄 전체 중지」 셈이
   * **한 번도 안 돌았습니다.**
   *
   * 식사지원이 아닌 서비스는 묻지도 않으므로 건드리지 않습니다(null).
   */
  const 형태 = String(짐.적은것?.제공형태 ?? "").trim();
  const 대면칸 = 형태 === "비대면배달" ? 0 : 형태 === "대면배달" ? 1 : null;

  /*
   * ── ★ 어느 확인사항 목록으로 눌렀나 ★ (2026-09-06 무무) ────
   *
   * 폰이 「그때 화면에 있던 목록의 버전」을 같이 보내 옵니다. 그 번호를
   * 실적에 박아 둡니다 — 사무실이 나중에 항목을 고치거나 지워도
   * **이 건은 누를 때 보였던 목록으로 종이에 나옵니다.**
   *
   * 「목록을 고쳤다」는 이유로 이미 한 일이 종이에서 사라지면 안 됩니다.
   * 안 온 건(옛 앱)은 `null` — 읽을 때 편람 열한 가지로 풉니다.
   */
  /*
   * ── 옛 이름(`확인판`)도 받습니다 ────────────────────────
   *
   * 2026-09-08 에 프로그램 안팎의 「판」을 모두 「버전」으로 바꿨습니다.
   * 그런데 **제공인력 휴대폰에는 옛 화면이 캐시로 남아 있을 수 있습니다.**
   * 그 폰은 아직 `확인판` 이라는 이름으로 보냅니다. 이름 하나 때문에
   * 확인사항 목록이 조용히 빠지면, 기록지에 체크가 안 찍힙니다.
   * 한 줄로 막을 수 있는 일이라 막아 둡니다.
   */
  const 온확인 = 짐.확인버전 ?? (짐 as any).확인판;
  const 확인버전 = Number.isFinite(Number(온확인)) && Number(온확인) > 0
    ? Number(온확인) : null;

  const 있던것 = db.query<{ id: number }, [number, string]>(
    "SELECT id FROM delivery WHERE assignment_id = ? AND served_on = ?").get(배정번호, 날);

  if (있던것) {
    db.run(
      `UPDATE delivery SET start_at = ?, end_at = ?, payload = ?, verdict = ?,
              outcome = '제공', actor_type = '제공인력', actor_id = ?,
              minutes = COALESCE(?, minutes),
              face_to_face = COALESCE(?, face_to_face),
              check_set_id = COALESCE(?, check_set_id)
         WHERE id = ?`,
      [보고.started_at, 보고.ended_at, 속, 판정, a.worker_id,
       잰분, 대면칸, 확인버전, 있던것.id]);
  } else {
    db.run(
      `INSERT INTO delivery
         (assignment_id, recipient_id, service_id, served_on,
          actor_type, actor_id, start_at, end_at, qty, outcome,
          payload, verdict, planned, minutes, face_to_face, check_set_id, created_at)
       VALUES (?, ?, ?, ?, '제공인력', ?, ?, ?, 1, '제공', ?, ?, 1, ?, ?, ?, ?)`,
      [배정번호, a.recipient_id, a.service_id, 날,
       a.worker_id, 보고.started_at, 보고.ended_at, 속, 판정,
       잰분, 대면칸, 확인버전, stamp]);
  }

  /*
   * ★ 비대면 연속을 **다시 셉니다.**
   *
   * 홈 화면과 대상자 화면은 대상자 줄에 적힌 값을 봅니다. 그 값은
   * 실적이 바뀔 때마다 따라 돌아야 하는데, 사무실에서 손으로 찍는
   * 길(`record.setCell`)에만 붙어 있고 **현장에서 올라오는 길에는
   * 없었습니다.** 정작 비대면을 고르는 사람은 현장입니다.
   */
  try {
    const sv = db.query<{ record_type: string; name: string }, [number]>(
      "SELECT record_type, name FROM service WHERE id = ?").get(a.service_id);
    if (sv && 대면원칙인가(sv)) 비대면다시셈(a.recipient_id);
  } catch (e) {
    console.error("우편함: 비대면 연속 다시 세기 실패 —", (e as Error).message);
  }

  const 메모 = 포스트잇붙이기(
    a.recipient_id, 날, 서비스이름(a.service_id), 인력?.name ?? "",
    짐.적은것?.특이사항 ?? "");

  return { 넣음: true, 메모 };
}


/**
 * 그 보고의 사진을 받아 **풀어서 이 PC 에 둡니다.**
 *
 * 돌려주는 값 = 자료함에 적을 사진 목록 (자리와 찍은 때).
 * 한 장이 실패해도 나머지는 받습니다 — 사진 하나 때문에 실적이
 * 통째로 안 들어가면 안 됩니다.
 */
async function 사진받아두기(
  함: 우편함, 보고번호: string, 날: string,
  것들: { id: string; path: string }[],
): Promise<{ 파일: string; 자리: string }[]> {
  if (!것들.length) return [];
  const 달 = 날.slice(0, 7);
  /*
   * 폴더 이름을 **보고번호**로 씁니다.
   * 제공실적 번호로 하고 싶었지만, 그 번호는 실적을 넣어야 생깁니다.
   * 사진은 실적보다 **먼저** 받아야 하므로(받은 것만 적어야 하니까)
   * 그때 이미 있는 번호여야 합니다. 보고번호는 폰이 정해서 옵니다.
   */
  const 둘곳 = join(사진뿌리, 달, 보고번호);
  mkdirSync(둘곳, { recursive: true });

  const 나온것: { 파일: string; 자리: string }[] = [];
  for (const 한장 of 것들) {
    try {
      const 그림 = await 함.사진받기(한장.path);
      const 이름 = `${한장.id}.jpg`;
      writeFileSync(join(둘곳, 이름), 그림);
      // 자료함에는 **자료함 뿌리에서부터의 자리**만 적습니다.
      // 절대 경로를 적으면 PC 를 옮겼을 때 전부 못 찾습니다.
      나온것.push({ 파일: 이름, 자리: `${달}/${보고번호}/${이름}` });
    } catch (e) {
      console.error(`우편함: 사진 ${한장.id} 받기 실패 —`, (e as Error).message);
    }
  }
  return 나온것;
}

/**
 * 우편함에 온 보고를 다 받아 넣습니다.
 *
 * `쓸함` 은 **시험에서만** 넣습니다 — 흉내 우편함을 끼워서
 * 인터넷 없이도 「사무실 자료함까지 제대로 들어오나」를 봅니다.
 * 안 넣으면 늘 하던 대로 .env 를 읽어 진짜 우편함에 붙습니다.
 */
export async function 보고받기(쓸함?: 우편함): Promise<받은결과> {
  const 설정 = 쓸함 ? null : 우편함.설정읽기();
  if (!쓸함 && !설정)
    return { 받은수: 0, 넣은수: 0, 못찾은수: 0, 메모붙인수: 0, 사진수: 0,
             까닭: "우편함이 설정되지 않았습니다" };

  const 함 = 쓸함 ?? new 우편함(설정!);
  const 보고들 = await 함.보고받아오기();
  if (!보고들.length) return { 받은수: 0, 넣은수: 0, 못찾은수: 0, 메모붙인수: 0, 사진수: 0 };

  /*
   * 날짜마다 짝표를 한 번씩만 만듭니다.
   * 보고 한 건마다 그날갈곳() 을 다시 도는 것은 낭비입니다.
   */
  const 짝표들 = new Map<string, ReturnType<typeof 그날짝표>>();
  const 짝표 = (날: string) => {
    let m = 짝표들.get(날);
    if (!m) { m = 그날짝표(날); 짝표들.set(날, m); }
    return m;
  };

  /*
   * 사진이 어디 있는지 **한 번에** 물어봅니다.
   * 보고 한 건마다 따로 물으면 왕복이 그만큼 늘어납니다.
   */
  const 사진자리 = new Map<string, { id: string; path: string }[]>();
  try {
    for (const x of await 함.사진목록(보고들.map((b) => b.id))) {
      const 통 = 사진자리.get(x.report_id) ?? [];
      통.push({ id: x.id, path: x.path });
      사진자리.set(x.report_id, 통);
    }
  } catch (e) {
    // 사진을 못 물어봐도 글은 받아야 합니다.
    console.error("우편함: 사진 목록 실패 —", (e as Error).message);
  }

  let 넣은수 = 0, 못찾은수 = 0, 메모붙인수 = 0, 사진수 = 0;
  const 지울것: string[] = [];
  const 지울사진: string[] = [];

  for (const 보고 of 보고들) {
    const 짐 = (보고.짐 ?? {}) as any;
    const 날 = String(짐.served_on || 보고.started_at?.slice(0, 10) || today());
    const 짝 = 짝표(날).get(보고.job_id);

    if (!짝) {
      /*
       * 그날 갈 곳에 없는 보고입니다.
       * 배정을 그 뒤에 지웠거나 요일을 고친 경우입니다.
       * **지우지 않습니다** — 잃는 것보다 남는 편이 낫습니다.
       * 14일이 지나면 우편함이 스스로 치웁니다.
       */
      못찾은수++;
      console.error(
        `우편함: 보고 ${보고.id} 를 붙일 배정을 못 찾았습니다 ` +
        `(${날} · 할일번호 ${보고.job_id}). 우편함에 그대로 둡니다.`);
      continue;
    }

    try {
      /*
       * 사진을 **먼저** 받습니다.
       * 실적을 넣은 뒤에 사진을 받다 실패하면, 실적에는 「사진 있음」이
       * 적혀 있는데 파일이 없는 상태가 됩니다. 받아 온 것만 적습니다.
       */
      const 이사진들 = 사진자리.get(보고.id) ?? [];
      const 받은사진 = await 사진받아두기(함, 보고.id, 날, 이사진들);

      const r = 실적에넣기(보고, 짝.배정번호, 받은사진);
      if (r.넣음) {
        넣은수++; 지울것.push(보고.id);
        사진수 += 받은사진.length;
        for (const x of 이사진들) 지울사진.push(x.path);
      } else { 못찾은수++; }
      if (r.메모) 메모붙인수++;
    } catch (e) {
      // 한 건이 잘못돼도 나머지는 넣습니다.
      못찾은수++;
      console.error(`우편함: 보고 ${보고.id} 넣기 실패 —`, (e as Error).message);
    }
  }

  /*
   * ★ 자료함에 들어간 것만 지웁니다.
   *
   * 사진 **파일을 먼저** 지웁니다. 보고를 먼저 지우면 photo 줄이 따라
   * 사라져서 **파일이 어디 있었는지 알 수 없게** 됩니다. 그러면 그 파일은
   * 14일 뒤 쓸어내기까지 남의 서버에 그대로 있습니다.
   */
  if (지울사진.length) await 함.사진지우기(지울사진);
  if (지울것.length) await 함.받은것지우기(지울것);

  return { 받은수: 보고들.length, 넣은수, 못찾은수, 메모붙인수, 사진수 };
}

/**
 * 켤 때 한 번, 그 뒤 5분마다.
 *
 * 왜 올리는 것(10분)보다 자주 도나 —
 * 올리는 것이 늦으면 제공인력이 조금 기다립니다. 받는 것이 늦으면
 * **사무실이 실적을 못 봅니다.** 그리고 받아 가야 우편함이 비워집니다.
 */
/**
 * 얼마마다 우편함을 들여다보나.
 *
 * ── 왜 5분에서 20초로 줄였나 ────────────────────────────────
 *
 * 처음에는 5분이었습니다. 「자주 두드릴 것 없다」고 봤습니다.
 * 그런데 현장은 이렇게 씁니다 — 제공인력이 어르신 댁을 나서면서
 * 보내고, **곧바로 사무실에 전화해서** 「보냈어요」라고 합니다.
 * 사무실은 화면을 봅니다. 없습니다. 5분 동안 둘이 「이게 뭐지」 합니다.
 * (2026-09-05 무무 — 「5분동안 이게 뭐지 하고 헤맬 상황이야.」)
 *
 * 그 5분에 사무실이 하는 일은 대개 **틀린 일**입니다 — 다시 보내라고
 * 하거나, 손으로 실적을 찍거나. 그러고 나서 진짜가 들어오면 두 번
 * 들어간 것처럼 보입니다.
 *
 * 20초로 두면 전화를 끊기 전에 뜹니다. 값은 거의 안 듭니다 —
 * 하루 4천 번 남짓 두드리는 것이고, 대개는 **빈손으로 돌아옵니다**
 * (`보고받아오기` 가 빈 목록이면 그걸로 끝입니다).
 */
export const 받는주기 = 20 * 1000;

/**
 * ── 한 번만 도는 이사 ──────────────────────────────────────
 *
 * 예전에는 현장 특이사항을 `recipient.memo`(내부 메모) 뒤에 한 줄씩
 * 붙였습니다. 그 자리는 아무도 안 봅니다 — 계약 정보 목록 맨 아래
 * 한 줄이라 기록지를 쓰려고 그 사람 화면을 열어도 눈에 안 들어옵니다.
 * 이제는 **포스트잇 보드**에 붙습니다.
 *
 * 그런데 **이미 들어가 버린 줄들**이 있습니다. 그냥 두면 옛것은 저기,
 * 새것은 여기에 있어 사무실이 두 군데를 봐야 합니다. 그래서 켤 때
 * 한 번 옮깁니다.
 *
 * 옮기는 것은 **「[날짜 · 이름] 말」 꼴의 줄만**입니다. 기관이 손으로
 * 적어 둔 「대문 왼쪽 개 있음」 같은 줄은 그 자리가 맞으니 그대로 둡니다.
 *
 * 여러 번 켜도 괜찮습니다 — 옮긴 줄은 메모에서 빠지고, 포스트잇 쪽은
 * 같은 글을 두 번 안 붙입니다(뗀 것까지 봅니다).
 */
const 현장줄 = /^\[(\d{4}-\d{2}-\d{2})\s*·\s*([^\]]*)\]\s*(.+)$/;

/** 그 서비스의 이름. 없으면 빈 글자. */
function 서비스이름(serviceId: number): string {
  const r = db.query<{ name: string }, [number]>(
    "SELECT name FROM service WHERE id = ?").get(serviceId);
  return r?.name ?? "";
}

export function 옛메모옮기기(): number {
  let 옮긴수 = 0;
  const 줄들 = db.query<{ id: string; memo: string | null }, []>(
    "SELECT id, memo FROM recipient WHERE memo IS NOT NULL AND memo <> ''").all();

  for (const r of 줄들) {
    const 남길: string[] = [];
    let 바뀜 = false;
    for (const 줄 of String(r.memo).split("\n")) {
      const m = 현장줄.exec(줄.trim());
      if (!m) { 남길.push(줄); continue; }
      /*
       * 옛 줄은 「[날짜 · 이름] 말」입니다 — 서비스가 안 적혀 있습니다.
       * 뒤늦게 지어낼 수 없으니 **빈 채로** 옮깁니다.
       * 새로 올라오는 것부터 서비스가 붙습니다.
       */
      const [, 날, 이름, 말] = m;
      if (포스트잇붙이기(r.id, 날, "", 이름.trim(), 말)) 옮긴수++;
      바뀜 = true;                       // 붙었든 이미 있었든 메모에서는 뺍니다
    }
    if (!바뀜) continue;
    const 새메모 = 남길.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    db.run("UPDATE recipient SET memo = ?, updated_at = ? WHERE id = ?",
      [새메모, new Date().toISOString(), r.id]);
  }
  return 옮긴수;
}

/**
 * ── 하루 한 번 우편함을 쓸어냅니다 ──────────────────────────
 *
 * ★ 2026-09-05 에 찾은 구멍 ★
 *
 *   `sweep_expired()` 를 **아무도 안 불렀습니다.** 시험 파일 하나가
 *   부르는 것이 전부였습니다. 그래서 「15분이면 스스로 지워집니다」,
 *   「14일이면 사라집니다」라고 적어 둔 것이 전부 사실이 아니었습니다.
 *   Postgres 는 `expires_at` 만으로 스스로 아무것도 안 지웁니다.
 *
 *   그동안 쌓인 것 — 로그인 요청(**비밀번호가 든 덩어리**), 다 받아간
 *   보고, 다 내려받은 사진. 남의 서버에 어르신 자료를 오래 두는 일이고,
 *   무료 등급 저장공간도 몇 주면 찹니다.
 *
 * 겸사겸사 **잠들기도 막습니다.** 무료 등급은 7일 조용하면 잡니다.
 */
const 쓴날칸 = "mailbox_swept_on";

async function 하루한번쓸기(함: 우편함): Promise<void> {
  const 오늘 = new Date().toISOString().slice(0, 10);
  if (metaGet(쓴날칸) === 오늘) return;
  /*
   * 먼저 적고 부릅니다. 실패해도 그날은 다시 안 시도합니다 —
   * 20초마다 실패하는 일을 되풀이하면 화면이 오류로 뒤덮입니다.
   * 내일 다시 합니다.
   */
  metaSet(쓴날칸, 오늘);
  const 결과 = await 함.쓸어내기();
  console.log("우편함: 기한 지난 것을 쓸어냈습니다" +
    (결과 ? ` — ${결과}` : ""));
}

export function 받기시작(): void {
  if (!우편함.설정읽기()) return;

  const 한번 = async () => {
    try {
      const r = await 보고받기();
      if (r.넣은수) console.log(`우편함: 현장 보고 ${r.넣은수}건을 실적에 넣었습니다`);
      if (r.메모붙인수) console.log(`우편함: 특이사항 ${r.메모붙인수}건을 대상자 메모에 붙였습니다`);
      if (r.사진수) console.log(`우편함: 사진 ${r.사진수}장을 받아 두었습니다 (data\\사진\\)`);
      const 설정 = 우편함.설정읽기();
      if (설정) await 하루한번쓸기(new 우편함(설정));
    } catch (e) {
      console.error("우편함: 보고 받기 실패 —", (e as Error).message);
    }
  };

  setTimeout(한번, 6000);                       // 올리는 것(3초) 다음에
  setInterval(한번, 받는주기);
}
