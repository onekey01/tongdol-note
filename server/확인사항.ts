/**
 * 확인사항 항목 — 기관이 고치고, 고칠 때마다 얼려 둡니다.
 *
 * ═══════════════════════════════════════════════════════════
 *  ── 무엇을 하는 것인가 ────────────────────────────────────
 *
 *  현장앱의 가사지원 화면에서 「오늘 해 드린 것」으로 누르는 항목들입니다.
 *  편람 서식3 은 열한 가지를 정해 두었습니다 —
 *    ① 목욕보조 ② 배변보조 ③ 옷입기보조 ④ 식사도움 ⑤ 체위변경
 *    ⑥ 재활운동보조 ⑦ 청소 ⑧ 세탁 ⑨ 취사 ⑩ 외출동행 ⑪ 말벗
 *
 *  (2026-09-06 무무 — 「가사지원 확인사항은 **기관의 입맛에 변경하여
 *   사용할 수 있도록** 설정에서 항목을 추가/삭제 할 수 있는 기능을 넣자」)
 *
 *  ── ★ 서식은 안 건드립니다 ★ ────────────────────────────
 *
 *  (무무 — 「세상에 지자체에 제출하는 서류의 서식을 마음대로 수정하는
 *   경우는 없어」) 서식3 의 열한 줄은 그대로 두고, 기관이 더한 항목은
 *   서식의 **「기타」 칸에 모아서** 찍습니다. `서식몫나누기()` 가 그 일을
 *   합니다.
 *
 *  ── ★ 왜 「얼리나」 ★ ────────────────────────────────────
 *
 *  (무무 — 「확인사항 항목이 바뀔 경우 **실행 시의 목록**으로 서식을
 *   뽑아. 변경된 항목으로 뽑을 경우 **일을 한 기록이 표시되지 않는
 *   문제**가 발생 되.」)
 *
 *  3월에 「말벗」을 눌러 둔 기록이, 6월에 「말벗」을 목록에서 지우는
 *  순간 아무 데도 안 남으면 안 됩니다. 다녀온 사실이 **목록을 고쳤다는
 *  이유로** 사라지는 것이기 때문입니다.
 *
 *  그래서 목록을 고칠 때마다 `check_set` 에 **새 줄**을 만듭니다.
 *  옛 줄은 그대로 있고, 그때 적은 실적은 계속 그 줄을 가리킵니다.
 * ═══════════════════════════════════════════════════════════
 */
import { db } from "./db";

/**
 * 편람 서식3 의 열한 가지. **번호와 말을 그대로** 씁니다.
 *
 * 목록을 한 번도 안 고친 기관과, 이 버전 이전에 적힌 옛 실적이
 * 여기로 떨어집니다.
 */
export const 편람항목 = [
  "목욕보조", "배변보조", "옷입기보조", "식사도움", "체위변경",
  "재활운동보조", "청소", "세탁", "취사", "외출동행", "말벗",
] as const;

export type 확인목록 = { 버전: number | null; 항목: string[] };

function 프로필번호(): number | null {
  const org = db.query<any, []>("SELECT profile_id FROM organization WHERE id = 1").get();
  return org?.profile_id ?? null;
}

function 읽기(줄: any): string[] {
  try {
    const a = JSON.parse(String(줄?.items ?? "[]"));
    return Array.isArray(a) ? a.map((x) => String(x)).filter(Boolean) : [];
  } catch { return []; }
}

/**
 * 지금 쓰는 목록. 한 번도 안 고쳤으면 편람 열한 가지입니다.
 *
 * `버전` 이 `null` 이면 「기관이 손 안 댄 상태」입니다 — 실적에도 `null`
 * 로 남고, 나중에 읽을 때 편람으로 풀립니다. 켤 때마다 줄을 만들어
 * 두면 안 고친 기관의 자료함에도 뜻 없는 줄이 쌓입니다.
 */
export function 지금목록(): 확인목록 {
  const p = 프로필번호();
  const 줄 = db.query<any, [number | null]>(
    `SELECT * FROM check_set WHERE profile_id IS ? ORDER BY id DESC LIMIT 1`
  ).get(p);
  if (!줄) return { 버전: null, 항목: [...편람항목] };
  const 것 = 읽기(줄);
  return 것.length ? { 버전: Number(줄.id), 항목: 것 } : { 버전: null, 항목: [...편람항목] };
}

/**
 * 어느 버전의 목록인가. 없는 버전·비어 있는 버전은 편람으로 풉니다.
 *
 * **옛 실적을 읽는 자리입니다.** 버전이 사라졌다고 그날 한 일이 화면에서
 * 없어지면 안 되므로, 못 찾아도 던지지 않고 편람으로 돌아갑니다.
 */
export function 버전목록(버전: number | null | undefined): string[] {
  if (버전 == null) return [...편람항목];
  const 줄 = db.query<any, [number]>("SELECT * FROM check_set WHERE id = ?").get(Number(버전));
  const 것 = 줄 ? 읽기(줄) : [];
  return 것.length ? 것 : [...편람항목];
}

/**
 * 목록을 새로 정합니다 — **고치는 것이 아니라 새 줄을 만듭니다.**
 *
 * 같은 목록을 다시 저장하면 줄을 안 만듭니다. 설정 화면에서 저장을
 * 두 번 누른다고 버전이 둘로 갈리면, 실적이 가리키는 버전만 늘어나고
 * 나오는 종이는 똑같습니다 — 아무 뜻 없는 줄입니다.
 */
export function 목록정하기(항목: unknown, 누가: string, 까닭 = ""): 확인목록 {
  if (!Array.isArray(항목))
    throw new Error("확인사항 항목을 목록으로 주세요.");

  const 다듬은: string[] = [];
  for (const x of 항목) {
    const 글 = String(x ?? "").trim().replace(/\s+/g, " ");
    if (!글) continue;
    if (글.length > 20)
      throw new Error(`「${글.slice(0, 12)}…」 — 항목은 20자 안으로 적어 주세요. 폰 화면에 한 줄로 들어가야 합니다.`);
    if (다듬은.includes(글))
      throw new Error(`「${글}」 이 두 번 들어 있습니다.`);
    다듬은.push(글);
  }
  if (!다듬은.length)
    throw new Error("항목이 하나도 없습니다. 적어도 하나는 남겨 주세요.");
  if (다듬은.length > 20)
    throw new Error("항목은 20가지까지만 됩니다. 폰에서 스무 칸을 넘으면 아무도 안 누릅니다.");

  const 이제 = 지금목록();
  if (이제.항목.length === 다듬은.length &&
      이제.항목.every((x, i) => x === 다듬은[i])) return 이제;

  const info = db.run(
    `INSERT INTO check_set (profile_id, made_at, who, items, note)
     VALUES (?, ?, ?, ?, ?)`,
    [프로필번호(), new Date().toISOString(), 누가, JSON.stringify(다듬은), 까닭 || null]
  );

  /*
   * 규칙 바뀐 이력에도 남깁니다 — 「왜 6월부터 종이 모양이 다르지」를
   * 나중에 설명할 수 있어야 합니다.
   */
  try {
    db.run(
      `INSERT INTO rule_change_log (changed_at, who, field, before_val, after_val, reason)
       VALUES (?, ?, '확인사항 항목', ?, ?, ?)`,
      [new Date().toISOString(), 누가, 이제.항목.join(" · "), 다듬은.join(" · "), 까닭 || ""]
    );
  } catch { /* 이력이 안 남는다고 저장을 막지는 않습니다 */ }

  return { 버전: Number(info.lastInsertRowid), 항목: 다듬은 };
}

/** 지금까지의 목록 이력. 설정 화면이 「언제 무엇으로 바꿨나」를 보여 줍니다. */
export function 목록이력(): { 버전: number; 때: string; 누가: string; 항목: string[] }[] {
  const p = 프로필번호();
  return db.query<any, [number | null]>(
    `SELECT * FROM check_set WHERE profile_id IS ? ORDER BY id DESC LIMIT 30`
  ).all(p).map((r) => ({
    버전: Number(r.id), 때: String(r.made_at ?? ""), 누가: String(r.who ?? ""),
    항목: 읽기(r),
  }));
}

/**
 * ★ 서식3 에 찍을 몫과 「기타」로 넘길 몫을 가릅니다. ★
 *
 * 서식3 은 **열한 줄이 고정**입니다. 기관이 더한 항목은 그 줄에 넣을
 * 자리가 없습니다. 억지로 밀어 넣으면 서식을 고치는 일이 되고,
 * 그냥 버리면 **일을 하고도 종이에 안 남습니다.**
 * 그래서 **「기타」 칸에 모아서** 적습니다.
 *
 *   서식줄  서식3 이 이미 가진 이름과 맞는 것 (○ 를 찍을 것)
 *   기타글  서식에 없는 것 — 「약 챙김 · 화분 물주기」 처럼 이어 붙입니다
 *
 * @param 한것    그날 고른 항목들
 * @param 서식이름 서식 파일에서 읽어 온 열한 가지 (제공기록지.ts 가 줍니다)
 */
export function 서식몫나누기(한것: string[], 서식이름: string[]) {
  const 있는것 = new Set(서식이름.map((x) => x.trim()));
  const 서식줄: string[] = [];
  const 기타몫: string[] = [];
  for (const x of 한것 ?? []) {
    const 글 = String(x ?? "").trim();
    if (!글) continue;
    (있는것.has(글) ? 서식줄 : 기타몫).push(글);
  }
  return { 서식줄: new Set(서식줄), 기타몫 };
}

/**
 * 「기타」 칸에 들어갈 한 줄. 손으로 적은 기타가 있으면 **뒤에** 붙습니다.
 *
 * 순서를 이렇게 두는 까닭 — 목록에서 고른 것은 눌러서 남은 사실이고,
 * 손으로 적은 것은 덧붙인 말입니다. 사실이 앞에 오는 편이 읽힙니다.
 */
export function 기타한줄(기타몫: string[], 손으로적은것: string): string {
  const 것 = [...기타몫];
  const 손 = String(손으로적은것 ?? "").trim();
  if (손) 것.push(손);
  return 것.join(" · ");
}
