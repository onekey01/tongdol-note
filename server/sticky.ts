import { db, metaGet, metaSet } from "./db";
import { today } from "./util";
import { parseRoles } from "./staff";

/**
 * 포스트잇 — 어느 표에도 안 들어가는 말들.
 *
 * ── 왜 필요한가 ────────────────────────────────────────────
 * 사무실 벽에 붙은 종이가 하는 일이 있습니다.
 *
 *   「김순자 어르신 목요일 병원 — 그날 방문 빼기」
 *   「최돌봄 선생님 화요일 오후 교육, 대타 필요」
 *   「군청 박주무관 통화 — 8월 명단 다음 주에 온다고」
 *
 * 전부 지금 프로그램의 어느 칸에도 안 들어갑니다. 그런데 사라지면 사고가 납니다.
 * 지금은 이것이 **사람 머릿속과 종이에만** 있습니다. 붙인 사람이 쉬면 같이 쉽니다.
 *
 * 그래서 자리를 만듭니다. 규칙은 종이와 같습니다 —
 * **떼기 전까지 붙어 있습니다.**
 *
 * ── 뗀 것은 바로 버리지 않습니다 — 휴지통 ──────────────────
 * 종이는 떼면 버리지만 여기서는 **30일 동안 접어 둡니다.**
 * 손이 미끄러져 뗀 것을 되살릴 시간이 있어야 하고,
 * "그날 왜 안 갔지"를 몇 주 뒤에 되짚는 일이 실제로 생깁니다.
 *
 * 30일이 지나면 **스스로 사라집니다.** 사람이 비우게 두면 아무도 안 비웁니다.
 * 쌓이기만 하는 목록은 결국 아무도 안 보고, 안 보는 목록은 없느니만 못합니다.
 *
 * ── 누가 뗄 수 있는가 ──────────────────────────────────────
 * 붙인 사람과 관리자입니다. 남이 붙인 것을 아무나 떼면 종이보다 못합니다.
 * 다만 **떼는 것과 지우는 것은 다릅니다** — 지우기는 붙인 사람과 관리자만입니다.
 */

export const COLORS = ["yellow", "pink", "blue", "green"] as const;
export type Color = (typeof COLORS)[number];

const 색이름: Record<Color, string> = {
  yellow: "노랑", pink: "분홍", blue: "파랑", green: "초록",
};

/**
 * ── 화이트보드의 기하 규칙 ─────────────────────────────────
 *
 * 종이를 벽에 붙일 때 사람은 아무 데나 붙이지 않습니다.
 * 급한 것은 눈높이에, 관련된 것끼리 옆에, 오래된 것은 구석에.
 * **그 자리 자체가 정보입니다.** 그래서 자리를 그대로 기억합니다.
 *
 * 다만 한 가지는 프로그램이 지킵니다 — **메모지끼리 겹치지 않습니다.**
 * 겹치면 아래 것이 안 보이고, 안 보이는 메모는 없는 메모입니다.
 */
export const 자리규칙 = {
  기본너비: 220, 기본높이: 150,
  최소너비: 160, 최소높이: 110,
  최대너비: 480, 최대높이: 420,
  틈: 10,          // 메모지 사이에 최소한 이만큼은 둡니다
  격자: 10,        // 이 눈금에 딱딱 맞춰 붙습니다. 손이 떨려도 줄이 맞습니다
  보드너비: 960,   // 새 메모를 처음 놓을 때 쓰는 너비. 화면이 좁으면 보드가 옆으로 넘어갑니다
} as const;

type 네모 = { x: number; y: number; w: number; h: number };

/**
 * ── 보드는 여러 장입니다 ───────────────────────────────────
 *
 * 사무실에 화이트보드가 하나만 있는 것이 아닙니다.
 * 벽에 걸린 공용 보드가 하나 있고, 대상자 서류철마다 그 사람 쪽지가 따로 끼워집니다.
 *
 *   기관 보드     「군청 박주무관 통화, 8월 명단 다음 주」
 *                 「이번 주 금요일 사례회의」
 *   김순자 보드   「목요일 병원 — 그날 방문 빼기」
 *                 「대문 열쇠는 화분 밑」
 *
 * 섞으면 둘 다 못 씁니다. 기관 일이 대상자 쪽지에 묻히고,
 * 김순자 어르신 화면을 열었을 때 남의 쪽지까지 스무 장이 나옵니다.
 *
 * 그래서 **보드를 나눕니다.**
 *   board = ""       기관 보드 (recipient_id 가 비어 있는 것)
 *   board = <uuid>   그 대상자의 보드
 *   board = "__all"  전부 (숫자를 셀 때만 씁니다)
 *
 * 자리(x·y)도 **보드마다 따로**입니다. 김순자 보드의 (0,0)과
 * 기관 보드의 (0,0)은 다른 보드의 왼쪽 위 모서리일 뿐입니다.
 * 그래서 겹침 검사도 **같은 보드 안에서만** 합니다.
 */
export type 보드 = string;

/** 그 보드에 붙어 있는(안 뗀) 메모지들의 자리. 겹침을 볼 때 씁니다. */
function 그보드의자리들(board: 보드, 뺄것?: number): 네모[] {
  const 기관 = board === "" || board == null;
  const rows = db.query<any, any[]>(
    `SELECT x, y, w, h FROM sticky
      WHERE done_at IS NULL AND x IS NOT NULL
        AND ${기관 ? "recipient_id IS NULL" : "recipient_id = ?"}
        AND id <> ?`
  ).all(...(기관 ? [뺄것 ?? -1] : [board, 뺄것 ?? -1]));
  return rows.map((o) => ({
    x: o.x, y: o.y,
    w: o.w ?? 자리규칙.기본너비, h: o.h ?? 자리규칙.기본높이,
  }));
}

/** 두 메모지가 (틈까지 셈해서) 겹치는가. */
function 겹치나(a: 네모, b: 네모): boolean {
  const g = 자리규칙.틈;
  return !(a.x + a.w + g <= b.x || b.x + b.w + g <= a.x ||
           a.y + a.h + g <= b.y || b.y + b.h + g <= a.y);
}

const 눈금 = (v: number) => Math.max(0, Math.round(v / 자리규칙.격자) * 자리규칙.격자);

/**
 * 바라는 자리에서 가장 가까운 **빈자리**.
 *
 * 겹치는 곳에 놓으면 밀어내는 것이 아니라 **놓으려는 쪽이 비켜섭니다.**
 * 이미 붙어 있는 것을 프로그램이 움직이면, 사람이 일부러 맞춰 둔 자리가
 * 무너집니다. 새로 놓는 쪽이 자리를 찾는 것이 맞습니다.
 */
function 빈자리(남들: 네모[], 바람: 네모): 네모 {
  const g = 자리규칙.격자;
  const 놓을수있나 = (x: number, y: number) =>
    !남들.some((o) => 겹치나({ x, y, w: 바람.w, h: 바람.h }, o));

  const bx = 눈금(바람.x), by = 눈금(바람.y);
  if (놓을수있나(bx, by)) return { ...바람, x: bx, y: by };

  // 바라는 자리를 가운데 두고 한 겹씩 넓혀 가며 찾습니다.
  for (let r = 1; r <= 140; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;  // 이 겹의 테두리만
        const x = bx + dx * g, y = by + dy * g;
        if (x < 0 || y < 0) continue;
        if (놓을수있나(x, y)) return { ...바람, x, y };
      }
    }
  }
  // 여기까지 왔다면 보드가 꽉 찬 것입니다. 맨 아래에 붙입니다.
  const 바닥 = 남들.reduce((m, o) => Math.max(m, o.y + o.h), 0);
  return { ...바람, x: 0, y: 눈금(바닥 + 자리규칙.틈) };
}

/**
 * 크기를 키울 때 — **옆 사람을 밀지 않고 내가 멈춥니다.**
 * 부딪히면 부딪히기 직전까지만 커집니다. 실제 종이와 같습니다.
 */
function 부딪히기전까지(남들: 네모[], 지금: 네모): 네모 {
  let { x, y, w, h } = 지금;
  const g = 자리규칙.격자;
  let 안전 = 0;
  while (남들.some((o) => 겹치나({ x, y, w, h }, o)) && 안전++ < 200) {
    // 더 많이 삐져나온 쪽을 줄입니다.
    const 줄일수있는너비 = w - 자리규칙.최소너비;
    const 줄일수있는높이 = h - 자리규칙.최소높이;
    if (줄일수있는너비 <= 0 && 줄일수있는높이 <= 0) return 지금; // 못 줄이면 그냥 두기
    if (줄일수있는너비 >= 줄일수있는높이) w -= g; else h -= g;
  }
  return { x, y, w, h };
}

function shape(r: any) {
  return {
    id: r.id,
    text: r.text,
    color: (COLORS as readonly string[]).includes(r.color) ? r.color : "yellow",
    colorKo: 색이름[(r.color as Color)] ?? "노랑",
    authorId: r.author_id ?? null,
    author: r.author ?? "",
    recipientId: r.recipient_id ?? null,
    recipient: r.recipient_name ?? "",
    pinned: !!r.pinned,
    dueOn: r.due_on ?? "",
    doneAt: r.done_at ?? null,
    done: !!r.done_at,
    // 보드 위의 자리. 아직 없으면 목록을 만들 때 채워 넣습니다.
    x: r.x ?? null,
    y: r.y ?? null,
    w: r.w ?? 자리규칙.기본너비,
    h: r.h ?? 자리규칙.기본높이,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * 붙어 있는 것들.
 *
 * 순서에 뜻이 있습니다.
 *   ① 꽂아 둔 것(pinned)          — 기관이 "이건 늘 보이게" 라고 정한 것
 *   ② 기한이 있는 것, 가까운 순    — 오늘 지난 것이 맨 위
 *   ③ 나머지는 새로 붙인 것부터
 */
/**
 * ── 휴지통 ─────────────────────────────────────────────────
 *
 * 뗀 메모는 **30일 뒤에 스스로 사라집니다.**
 *
 * 왜 사람이 비우게 두지 않는가 — 아무도 안 비우기 때문입니다.
 * 「나중에 정리해야지」 하는 목록은 두 해가 지나도 그대로 있고,
 * 그러면 정작 되짚어 보려 할 때 찾을 수가 없습니다.
 *
 * 왜 하필 30일인가 — 이 일의 주기가 한 달입니다.
 * 기록지도 청구도 한 달에 한 번 돌아옵니다. **지난달 것을 되짚는 동안은
 * 남아 있고, 그 달이 끝나면 없어진다** — 이 정도가 사람이 지키는 감각입니다.
 */
export const 보관일수 = 30;

/** 뗀 지 30일이 지난 것을 버립니다. 몇 장을 버렸는지 돌려줍니다. */
export function 휴지통비우기(): number {
  const 기준 = new Date(Date.now() - 보관일수 * 24 * 60 * 60 * 1000).toISOString();
  const r = db.run(
    "DELETE FROM sticky WHERE done_at IS NOT NULL AND done_at < ?", [기준]
  );
  return Number(r?.changes ?? 0);
}

/*
 * 볼 때마다 지우기를 돌리면 자료함에 쓸데없는 쓰기가 계속 쌓입니다.
 * 하루에 네 번이면 충분합니다 — 30일짜리 기한에 여섯 시간은 오차도 아닙니다.
 */
let 마지막청소 = 0;
function 가끔청소() {
  const 지금 = Date.now();
  if (지금 - 마지막청소 < 6 * 60 * 60 * 1000) return;
  마지막청소 = 지금;
  try { 휴지통비우기(); } catch { /* 못 비워도 하던 일은 그대로 됩니다 */ }
}

export function listStickies(opts: { done?: boolean; board?: 보드 } = {}) {
  가끔청소();
  const board = opts.board ?? "";
  const 전부 = board === "__all";
  const 기관 = !전부 && (board === "" || board == null);

  const rows = db.query<any, any[]>(
    `SELECT s.*, r.payload AS rpayload
       FROM sticky s
       LEFT JOIN recipient r ON r.id = s.recipient_id
      WHERE (? = 1 OR s.done_at IS NULL)
        ${전부 ? "" : 기관 ? "AND s.recipient_id IS NULL" : "AND s.recipient_id = ?"}`
  ).all(...(전부 || 기관 ? [opts.done ? 1 : 0] : [opts.done ? 1 : 0, board]));

  const items = rows.map((r) => shape({
    ...r,
    recipient_name: r.rpayload ? (JSON.parse(r.rpayload || "{}").name ?? "") : "",
  }));

  /*
   * 자리가 아직 없는 메모(보드가 생기기 전에 붙인 것)에 자리를 줍니다.
   * 한 번만 정하고 **자료함에 적어 둡니다** — 볼 때마다 자리가 바뀌면
   * 「내가 저기 붙였는데」가 안 통합니다.
   */
  // **보드마다 따로** 셉니다. 자리는 보드 안에서만 뜻이 있습니다.
  const 보드별: Map<string, 네모[]> = new Map();
  const 어느보드 = (x: any) => x.recipientId ?? "";
  for (const x of items) {
    if (x.x === null || x.y === null) continue;
    const k = 어느보드(x);
    보드별.set(k, [...(보드별.get(k) ?? []), { x: x.x, y: x.y, w: x.w, h: x.h }]);
  }
  for (const x of items) {
    if (x.x !== null && x.y !== null) continue;
    const k = 어느보드(x);
    const 남들 = 보드별.get(k) ?? [];
    const 자리 = 빈자리(남들, { x: 0, y: 0, w: x.w, h: x.h });
    x.x = 자리.x; x.y = 자리.y;
    보드별.set(k, [...남들, 자리]);
    db.run("UPDATE sticky SET x = ?, y = ?, w = ?, h = ? WHERE id = ?",
           [자리.x, 자리.y, x.w, x.h, x.id]);
  }

  const now = today();
  return items.sort((a, b) => {
    // 뗀 것은 언제나 아래로.
    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
    // 기한이 있는 것이 먼저, 그중 이른 것이 먼저.
    const ad = a.dueOn || "9999-99-99";
    const bd = b.dueOn || "9999-99-99";
    if (ad !== bd) return ad.localeCompare(bd);
    return b.id - a.id;
  }).map((x) => ({
    ...x,
    // 기한이 지났는지는 화면이 아니라 여기서 정합니다. 두 곳에서 세면 어긋납니다.
    overdue: !x.done && !!x.dueOn && x.dueOn < now,
    dueToday: !x.done && x.dueOn === now,
    /*
     * 뗀 것이 며칠 뒤에 스스로 사라지는가.
     * 이것도 **여기서** 셉니다 — 화면에서 따로 세면 자정을 넘길 때 어긋나고,
     * 「하루 남았다」와 「오늘 사라진다」가 두 곳에서 다르게 보입니다.
     */
    남은날: x.done && x.doneAt
      ? Math.max(0, 보관일수 -
          Math.floor((Date.now() - new Date(x.doneAt).getTime()) / 86400000))
      : null,
  }));
}

const MAX = 500;   // 한 장에 담을 글자 수. 포스트잇이지 보고서가 아닙니다.

function 다듬기(text: unknown): string {
  const s = String(text ?? "").replace(/\r\n/g, "\n").trim();
  if (!s) throw new Error("메모 내용을 적어 주세요.");
  if (s.length > MAX) throw new Error(`메모는 ${MAX}자까지입니다. 길면 대상자 메모나 일지에 적어 주세요.`);
  return s;
}

function 날짜검사(v: unknown, 이름: string): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${이름}을(를) 날짜로 골라 주세요.`);
  return s;
}

/* ══════════════════════════════════════════════════════════════
 *  ★ 저절로 붙는 메모지는 **글에 맞게 크게** 만듭니다
 * ══════════════════════════════════════════════════════════════
 *
 * (2026-09-07 무무 — 「시스템이 자동으로 메모를 추가한 경우 **스크롤바가
 *  생기지 않도록** 메모지의 크기를 키워서 생성되도록 해줘」)
 *
 * ── 왜 문제가 됐나 ──────────────────────────────────────────
 *
 * 현장 특이사항은 저절로 대상자 메모지로 넘어옵니다. 그런데 그 글은
 * 머리말만 「[2026-09-05 · 가사지원 · 김영희] 」로 두 줄을 먹고, 뒤에
 * 어르신 이야기가 붙습니다. 기본 크기(220×150)에는 넉 줄밖에 안 들어가서
 * **거의 모든 자동 메모에 스크롤바가 생겼습니다.**
 *
 * 손으로 적는 메모는 그래도 됩니다 — 적은 사람이 바로 보고 늘리면
 * 되니까요. 그런데 저절로 붙는 것은 **아무도 그 자리에 없습니다.**
 * 사무실이 기록지를 쓰려고 열었을 때, 스무 장이 다 잘려 있고 한 장씩
 * 굴려 봐야 합니다. 그러면 안 봅니다.
 *
 * ── 어떻게 재나 ────────────────────────────────────────────
 *
 * 화면(style.css 의 `.memo-note`)과 **같은 숫자**로 셈합니다 —
 * 여기가 어긋나면 「키웠는데도 잘린다」가 됩니다.
 *
 *   글 =  .9rem(14.4px) · 줄 높이 1.5 → 한 줄 21.6px
 *   여백 = 좌우 12+12 · 위 12 · 아래 8
 *   맨 아래 「누가 · 언제」 줄 = 여백 8 + 글 16 ≈ 24
 *
 * 너비는 **네 단계만** 씁니다. 자유롭게 늘리면 보드가 들쭉날쭉해져서
 * 벽에 붙인 종이처럼 안 보입니다. 좁은 것부터 넣어 보고, 높이가
 * 넘치면 한 단계 넓힙니다.
 */
const 재기 = {
  글자폭: 14.4,      // 한글 한 자 (.9rem)
  줄높이: 21.6,      // 1.5 배
  좌우: 24,
  위아래: 12 + 8,
  아랫줄: 24,        // 「누가 · 언제」
  너비단: [220, 260, 300, 340] as const,
  /*
   * ★ **낱말이 잘리지 않으려고 줄이 일찍 끝납니다.**
   *
   *   `word-break: break-word` 는 낱말 가운데를 함부로 안 자릅니다.
   *   그래서 한 줄에 실제로 들어가는 글자는 **자리가 허락하는 것보다
   *   적습니다** — 줄 끝에 반 낱말만큼 빈 자리가 남습니다.
   *
   *   이 값을 안 두었더니 진짜 화면에서 27~32px 씩 넘쳤습니다
   *   (2026-09-07, 브라우저로 재어 확인). 셈은 맞았는데 화면은 잘린 것입니다.
   */
  띄어쓰기여유: 0.82,
  /** 그래도 한 줄은 더 봅니다. 글꼴이 바뀌면 셈이 조금씩 어긋납니다. */
  덤: 1,
  /*
   * ★ **저절로 붙는 것은 더 높이 갑니다.**
   *   손으로 늘릴 수 있는 한도(420)는 사람이 끄는 손잡이의 한도입니다.
   *   저절로 붙는 것은 아무도 안 늘려 주므로, 500자짜리 특이사항이
   *   들어가려면 더 커야 합니다. 세로로 긴 종이는 보드가 아래로
   *   늘어날 뿐이지만, 잘린 종이는 **읽을 수가 없습니다.**
   */
  최대높이: 640,
};

/**
 * 그 글이 몇 줄이 되나 — 그 너비에서.
 *
 * **한글은 한 자, 로마자·숫자는 반 자**로 셉니다. 한 줄에 몇 자가
 * 들어가는지는 글자 폭으로 정해지는데, 한글이 로마자의 두 배쯤
 * 넓습니다. 다 한 자로 세면 영어가 섞인 메모가 지나치게 커집니다.
 */
function 줄수(글: string, 너비: number): number {
  const 한줄폭 = Math.max(1, (너비 - 재기.좌우) / 재기.글자폭);
  let 줄 = 0;
  for (const 문단 of String(글 ?? "").split("\n")) {
    let 폭 = 0;
    for (const c of 문단) 폭 += /[\x00-\x7F]/.test(c) ? 0.55 : 1;
    /*
     * 띄어쓰기가 있는 문단만 줄이 일찍 끝납니다 — 붙여 쓴 글은
     * 자를 데가 없어 끝까지 채웁니다.
     */
    const 쓸폭 = /\s/.test(문단) ? 한줄폭 * 재기.띄어쓰기여유 : 한줄폭;
    줄 += Math.max(1, Math.ceil(폭 / 쓸폭));
  }
  return 줄 + 재기.덤;
}

/**
 * 그 글이 **스크롤 없이** 들어가는 크기.
 *
 * 아주 긴 글은 최대 크기에서 멈춥니다 — 메모지가 보드를 통째로
 * 덮으면 그것도 못 씁니다. 메모는 500자까지라 그런 일은 드뭅니다.
 */
export function 글에맞는크기(글: string): { w: number; h: number } {
  const 마지막 = 재기.너비단[재기.너비단.length - 1];
  for (const w of 재기.너비단) {
    const h = 눈금올림(재기.위아래 + 재기.아랫줄 + 줄수(글, w) * 재기.줄높이);
    /*
     * 좁은 것부터 넣어 봅니다. **420(사람이 끄는 한도) 안에 들어가면
     * 그 너비로** 끝냅니다 — 넓적한 종이보다 보통 크기가 보드에 잘 앉습니다.
     * 안 들어가면 한 단계 넓히고, 그래도 안 되면 마지막 너비에서 높이로 갑니다.
     */
    if (h <= 자리규칙.최대높이 || w === 마지막)
      return {
        w,
        h: Math.min(재기.최대높이, Math.max(자리규칙.기본높이, h)),
      };
  }
  return { w: 자리규칙.기본너비, h: 자리규칙.기본높이 };
}

/** 격자에 맞춰 **올림**합니다. 내림하면 마지막 줄이 잘립니다. */
const 눈금올림 = (v: number) =>
  Math.ceil(v / 자리규칙.격자) * 자리규칙.격자;

/**
 * ★★★ **이미 붙어 있는 메모지 키우기** — 한 번만 돕니다.
 *
 * (2026-09-07 무무 — 「지원인력의 일정 실행시 작성한 메모가 대상자의
 *  포스트잇에 넘어올 때 스크롤바가 보이지 않도록 키워서 넣어달라고
 *  했는데 **반영되지 않았어**」)
 *
 * 크기를 재는 것은 고쳤는데, **이미 보드에 붙어 있던 것들은 그대로**
 * 였습니다. 새로 올라오는 것만 커지니, 화면을 여신 분에게는 「안 고쳐진
 * 것」으로 보입니다 — 눈에 보이는 스무 장이 다 잘려 있으니까요.
 *
 * ── 무엇만 건드리나 ────────────────────────────────────────
 *
 *   · **파랑(현장에서 저절로 올라온 것)만.** 노랑은 사람이 적고 사람이
 *     크기를 정한 것이라, 일부러 작게 붙여 둔 쪽지를 프로그램이
 *     키우면 안 됩니다.
 *   · **키우기만 합니다.** 줄이지 않습니다.
 *   · **한 번만.** 표시를 남겨 두 번째부터는 지나갑니다 — 그래야
 *     나중에 손으로 줄여 둔 것이 다음 켤 때 도로 커지지 않습니다.
 *
 * 커진 만큼 옆의 것과 겹칠 수 있어, 자리를 다시 잡아 줍니다.
 */
export function 옛메모지키우기(): number {
  if (metaGet("sticky_grow_v1")) return 0;

  const 줄들 = db.query<any, []>(
    `SELECT id, text, color, recipient_id, x, y, w, h
       FROM sticky WHERE done_at IS NULL AND color = 'blue'`
  ).all() as any[];

  let 키운수 = 0;
  /* 보드마다 따로 — 자리(x·y)는 보드 안에서만 뜻이 있습니다. */
  const 보드들 = new Set(줄들.map((r) => String(r.recipient_id ?? "")));
  for (const 보드 of 보드들) {
    for (const r of 줄들.filter((x) => String(x.recipient_id ?? "") === 보드)) {
      const 맞는것 = 글에맞는크기(String(r.text ?? ""));
      const 새너비 = Math.max(Number(r.w ?? 0), 맞는것.w);
      const 새높이 = Math.max(Number(r.h ?? 0), 맞는것.h);
      if (새너비 === Number(r.w) && 새높이 === Number(r.h)) continue;

      const 자리 = 빈자리(그보드의자리들(보드, Number(r.id)), {
        x: Number(r.x ?? 0), y: Number(r.y ?? 0), w: 새너비, h: 새높이,
      });
      db.run("UPDATE sticky SET w = ?, h = ?, x = ?, y = ? WHERE id = ?",
        [자리.w, 자리.h, 자리.x, 자리.y, r.id]);
      키운수++;
    }
  }

  metaSet("sticky_grow_v1", new Date().toISOString());
  return 키운수;
}

export function addSticky(b: any, me: any) {
  const text = 다듬기(b.text);
  const color = (COLORS as readonly string[]).includes(b.color) ? b.color : "yellow";
  const dueOn = 날짜검사(b.dueOn, "기한");

  // 대상자를 붙였다면 진짜 있는 사람이어야 합니다.
  let rid: string | null = String(b.recipientId ?? "").trim() || null;
  if (rid) {
    const ok = db.query<{ id: string }, [string]>(
      "SELECT id FROM recipient WHERE id = ?"
    ).get(rid);
    if (!ok) throw new Error("그 대상자를 찾을 수 없습니다.");
  }

  /*
   * 새 메모는 **그 보드의 비어 있는 첫 자리**에 붙습니다.
   * 사람이 벽에 붙일 때도 빈 곳을 찾아 붙이지, 남의 종이 위에 겹쳐 붙이지 않습니다.
   * 대상자를 고르고 붙이면 **그 사람 보드**에 붙습니다 — 기관 보드에는 안 보입니다.
   */
  /*
   * ★ **저절로 붙는 메모지는 글에 맞게 큽니다** (2026-09-07 무무).
   *   손으로 적는 것은 기본 크기 그대로입니다 — 적은 사람이 바로 보고
   *   늘리면 되고, 크기를 프로그램이 정해 버리면 일부러 작게 붙여 둔
   *   쪽지도 커집니다.
   */
  const 크기 = b.저절로 ? 글에맞는크기(text)
             : { w: 자리규칙.기본너비, h: 자리규칙.기본높이 };
  const 자리 = 빈자리(그보드의자리들(rid ?? ""), { x: 0, y: 0, ...크기 });

  const now = new Date().toISOString();
  const r = db.run(
    `INSERT INTO sticky (text, color, author_id, author, recipient_id, pinned, due_on,
                         x, y, w, h, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [text, color, me?.id ?? null, me?.name ?? "", rid, b.pinned ? 1 : 0, dueOn,
     자리.x, 자리.y, 자리.w, 자리.h, now, now]
  );
  return { id: Number(r.lastInsertRowid), ...자리 };
}

function 가져오기(id: number) {
  const row = db.query<any, [number]>("SELECT * FROM sticky WHERE id = ?").get(id);
  if (!row) throw new Error("그 메모를 찾을 수 없습니다. 이미 지워졌을 수 있습니다.");
  return row;
}

/** 붙인 사람이거나 관리자여야 합니다. */
function 내것인가(row: any, me: any): boolean {
  if (row.author_id && me?.id && row.author_id === me.id) return true;
  return parseRoles(me?.roles ?? me?.role).includes("admin");
}

export function updateSticky(id: number, b: any, me: any) {
  const row = 가져오기(id);
  if (!내것인가(row, me))
    throw new Error("남이 붙인 메모는 관리자만 고칠 수 있습니다.");

  // 보낸 칸만 고칩니다. 안 보낸 칸은 그대로 둡니다 —
  // 화면 한 곳에서 색만 바꿨는데 글이 지워지면 안 됩니다.
  const text  = b.text  === undefined ? row.text  : 다듬기(b.text);
  const color = b.color === undefined ? row.color
              : ((COLORS as readonly string[]).includes(b.color) ? b.color : row.color);
  const dueOn = b.dueOn === undefined ? row.due_on : 날짜검사(b.dueOn, "기한");
  const pinned = b.pinned === undefined ? row.pinned : (b.pinned ? 1 : 0);

  /*
   * 보드 옮기기 — 기관 보드 ↔ 대상자 보드.
   *
   * 「이거 김순자 어르신 이야기네」 하고 나중에 옮기는 일이 생깁니다.
   * 보드가 바뀌면 **새 보드에서 자리를 다시 찾습니다.** 옛 보드에서 쓰던
   * 좌표를 그대로 들고 가면 새 보드의 남의 종이 위에 겹쳐 앉습니다.
   */
  let rid = row.recipient_id ?? null;
  let 자리: 네모 | null = null;
  if (b.recipientId !== undefined) {
    const 새것 = String(b.recipientId ?? "").trim() || null;
    if (새것 && 새것 !== rid) {
      const 있나 = db.query<{ id: string }, [string]>(
        "SELECT id FROM recipient WHERE id = ?"
      ).get(새것);
      if (!있나) throw new Error("그 대상자를 찾을 수 없습니다.");
    }
    if (새것 !== rid) {
      rid = 새것;
      자리 = 빈자리(그보드의자리들(rid ?? "", id), {
        x: 0, y: 0,
        w: row.w ?? 자리규칙.기본너비, h: row.h ?? 자리규칙.기본높이,
      });
    }
  }

  db.run(
    `UPDATE sticky SET text = ?, color = ?, due_on = ?, pinned = ?, recipient_id = ?,
            x = COALESCE(?, x), y = COALESCE(?, y), updated_at = ?
      WHERE id = ?`,
    [text, color, dueOn, pinned, rid,
     자리?.x ?? null, 자리?.y ?? null, new Date().toISOString(), id]
  );
  return { ok: true, 보드옮김: !!자리 };
}

/**
 * 떼기 / 다시 붙이기.
 *
 * 뗀 것은 지워지지 않고 아래로 내려갑니다.
 * 잘못 뗐으면 다시 붙일 수 있어야 합니다 — 손이 미끄러지는 일은 늘 있습니다.
 */
export function setDone(id: number, done: boolean, me: any) {
  const row = 가져오기(id);
  if (!내것인가(row, me))
    throw new Error("남이 붙인 메모는 관리자만 뗄 수 있습니다.");
  const now = new Date().toISOString();

  /*
   * 다시 붙일 때는 **보드 맨 아래**에 붙입니다.
   *
   * 뗀 자리를 그대로 들고 돌아오면 안 됩니다. 떼어 둔 동안 그 자리는
   * 비어 있는 것으로 세니 다른 종이가 그 위에 앉고, 돌아오면 겹칩니다.
   * 실제로 그렇게 겹쳤습니다.
   *
   * 왜 하필 맨 아래인가 — 남이 맞춰 둔 자리 사이에 끼워 넣으면 그 사람 배치가
   * 흔들립니다. 맨 아래는 **아무의 자리도 건드리지 않는 유일한 자리**이고,
   * 「방금 되살린 것」이 한눈에 보이는 자리이기도 합니다.
   */
  let 자리: 네모 | null = null;
  if (!done) {
    const 남들 = 그보드의자리들(row.recipient_id ?? "", id);
    const w = row.w ?? 자리규칙.기본너비;
    const h = row.h ?? 자리규칙.기본높이;
    const 바닥 = 남들.reduce((m, o) => Math.max(m, o.y + o.h), 0);
    // 빈자리()를 한 번 더 태웁니다. 바닥 계산이 맞아도 규칙은 한 곳에서 지킵니다.
    자리 = 빈자리(남들, { x: 0, y: 눈금(바닥 ? 바닥 + 자리규칙.틈 : 0), w, h });
  }

  db.run(
    `UPDATE sticky SET done_at = ?, updated_at = ?,
            x = COALESCE(?, x), y = COALESCE(?, y)
      WHERE id = ?`,
    [done ? now : null, now, 자리?.x ?? null, 자리?.y ?? null, id]
  );
  return { done, ...(자리 ?? {}) };
}

/**
 * 옮기기 · 크기 바꾸기.
 *
 * 화면이 이미 겹치지 않게 막고 있지만 **여기서 한 번 더 봅니다.**
 * 화면은 감출 뿐이고, 자료함을 지키는 것은 서버입니다.
 *
 * 겹치는 자리에 놓으면 **놓으려는 쪽이 가장 가까운 빈자리로 비켜섭니다.**
 * 이미 붙어 있는 것을 프로그램이 움직이면 사람이 맞춰 둔 자리가 무너집니다.
 * 크기를 키우다 부딪히면 **부딪히기 직전까지만** 커집니다.
 *
 * 자리 옮기기는 **누구나** 할 수 있습니다. 글을 고치는 것과 다릅니다 —
 * 벽에 붙은 종이를 옆으로 조금 옮기는 데 주인 허락을 받지는 않습니다.
 */
export function placeSticky(id: number, b: any, _me: any) {
  const row = 가져오기(id);
  if (row.done_at) throw new Error("뗀 메모는 옮길 수 없습니다.");

  const 숫자 = (v: unknown, 그냥: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 그냥;
  };
  const 사이 = (v: number, 작은: number, 큰: number) => Math.min(큰, Math.max(작은, v));

  const 바람: 네모 = {
    x: 눈금(사이(숫자(b.x, row.x ?? 0), 0, 20000)),
    y: 눈금(사이(숫자(b.y, row.y ?? 0), 0, 20000)),
    w: 눈금(사이(숫자(b.w, row.w ?? 자리규칙.기본너비), 자리규칙.최소너비, 자리규칙.최대너비)),
    h: 눈금(사이(숫자(b.h, row.h ?? 자리규칙.기본높이), 자리규칙.최소높이, 자리규칙.최대높이)),
  };

  // **같은 보드 안에서만** 겹침을 봅니다.
  // 김순자 보드의 (0,0)과 기관 보드의 (0,0)은 서로 다른 보드의 모서리일 뿐입니다.
  const 남들 = 그보드의자리들(row.recipient_id ?? "", id);

  const 크기바뀜 = 바람.w !== (row.w ?? 자리규칙.기본너비) ||
                   바람.h !== (row.h ?? 자리규칙.기본높이);
  const 자리바뀜 = 바람.x !== (row.x ?? 0) || 바람.y !== (row.y ?? 0);

  // 크기만 바꾼 것이면 자리를 옮기지 않고 부딪히는 데까지만 키웁니다.
  // 자리를 옮긴 것이면 가장 가까운 빈자리를 찾습니다.
  const 정해진것 = 크기바뀜 && !자리바뀜
    ? 부딪히기전까지(남들, 바람)
    : 빈자리(남들, 바람);

  db.run("UPDATE sticky SET x = ?, y = ?, w = ?, h = ?, updated_at = ? WHERE id = ?",
         [정해진것.x, 정해진것.y, 정해진것.w, 정해진것.h, new Date().toISOString(), id]);

  // 실제로 놓인 자리를 돌려줍니다. 바란 자리와 다를 수 있고,
  // 화면은 이 값으로 맞춰야 다음 끌기가 어긋나지 않습니다.
  return { id, ...정해진것, 비켜섬: 정해진것.x !== 바람.x || 정해진것.y !== 바람.y,
           덜커짐: 정해진것.w !== 바람.w || 정해진것.h !== 바람.h };
}

export function removeSticky(id: number, me: any) {
  const row = 가져오기(id);
  if (!내것인가(row, me))
    throw new Error("남이 붙인 메모는 관리자만 지울 수 있습니다.");
  db.run("DELETE FROM sticky WHERE id = ?", [id]);
  return { ok: true };
}

/** 탭에 「메모 3」처럼 보여줄 숫자. 보드마다 따로 셉니다. */
export function stickyCounts(board: 보드 = "") {
  const now = today();
  const 전부 = board === "__all";
  const 기관 = !전부 && (board === "" || board == null);
  const r = db.query<{ open: number; overdue: number }, any[]>(
    `SELECT COUNT(*) AS open,
            SUM(CASE WHEN due_on IS NOT NULL AND due_on < ? THEN 1 ELSE 0 END) AS overdue
       FROM sticky
      WHERE done_at IS NULL
        ${전부 ? "" : 기관 ? "AND recipient_id IS NULL" : "AND recipient_id = ?"}`
  ).get(...(전부 || 기관 ? [now] : [now, board]));
  return { open: r?.open ?? 0, overdue: r?.overdue ?? 0 };
}

/**
 * 대상자 보드에 뭐가 얼마나 붙어 있는지 한 줄 요약.
 *
 * 기관 보드만 보는 사람에게 **대상자 쪽지가 있다는 사실 자체**는 보여야 합니다.
 * 안 그러면 붙여 놓고 잊습니다 — 그러면 종이만도 못합니다.
 */
export function 대상자보드요약() {
  const now = today();
  const rows = db.query<any, [string]>(
    `SELECT s.recipient_id AS id, r.payload AS payload,
            COUNT(*) AS n,
            SUM(CASE WHEN s.due_on IS NOT NULL AND s.due_on < ? THEN 1 ELSE 0 END) AS overdue
       FROM sticky s JOIN recipient r ON r.id = s.recipient_id
      WHERE s.done_at IS NULL
      GROUP BY s.recipient_id`
  ).all(now);
  return rows
    .map((x) => ({
      id: x.id,
      name: JSON.parse(x.payload || "{}").name ?? "",
      n: x.n as number,
      overdue: (x.overdue as number) ?? 0,
    }))
    .sort((a, b) => b.overdue - a.overdue || b.n - a.n ||
                    a.name.localeCompare(b.name, "ko"));
}
