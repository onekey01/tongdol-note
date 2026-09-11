/**
 * 주간계획 한 칸 — **무슨 요일**.
 *
 * 시각은 넣지 않습니다.
 * 2026 통합돌봄 지침에는 서비스마다 정해진 소요시간이 없습니다.
 * (전화 5분·방문 10분 같은 것은 노인맞춤돌봄서비스 이야기입니다.)
 * 없는 것을 칸으로 만들면 현장이 지어내서 채우게 되고,
 * 그렇게 채운 숫자는 나중에 어디에도 못 씁니다.
 *
 * 옛 자료에 start·minutes 가 들어 있어도 조용히 버리고 요일만 씁니다.
 * 나중에 시각이 정말 필요해지면 그때 칸을 더하면 됩니다.
 *
 * 여기(util)에 둔 이유는 서로 물지 않게 하기 위해서입니다.
 * 배정(assign)도 종사자(staff)도 이걸 씁니다.
 */
/**
 * 주간 계획 한 칸 — **무슨 요일에**, (적었다면) **몇 분**.
 *
 * `minutes` 는 그 요일 **1회 서비스 시간**입니다. 계획에 시간을 적어 두면
 * 그 사람 그 요일에는 그것이 **하루 최대**가 됩니다 (2026-09-03 무무 님 지시:
 * 「서비스 제공계획에 시간이 별도로 명시되어 있다면 일 최대 서비스시간을
 * 이에 맞춤」). 안 적으면 지역 규칙의 「하루 최대 서비스 시간」을 씁니다.
 */
export type Slot = { dow: number; minutes: number | null };

export const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function parseSlots(v: unknown): Slot[] {
  try {
    const list = typeof v === "string" ? JSON.parse(v) : v;
    if (!Array.isArray(list)) return [];
    const seen = new Set<number>();
    const out: Slot[] = [];
    for (const x of list) {
      const dow = Number(typeof x === "number" ? x : x?.dow);
      if (!(dow >= 0 && dow <= 6) || seen.has(dow)) continue;
      seen.add(dow);
      /*
       * 옛 자료는 숫자만(`[1,3]`) 이거나 `minutes` 가 없습니다.
       * **없는 것을 지어내지 않습니다** — null 로 두면 지역 규칙을 씁니다.
       */
      const m = typeof x === "number" ? null : Number(x?.minutes);
      out.push({ dow, minutes: Number.isFinite(m) && (m as number) > 0 ? (m as number) : null });
    }
    return out.sort((a, b) => a.dow - b.dow);
  } catch {
    return [];
  }
}

/** 「화 · 목」. 시간을 적어 둔 요일은 「화(90분) · 목」처럼 보여 줍니다. */
export function slotText(list: Slot[]): string {
  return list
    .map((s) => `${DOW_KO[s.dow] ?? "?"}${s.minutes ? `(${분말(s.minutes)})` : ""}`)
    .join(" · ");
}

/** 「90분」 → 「1시간30분」. 사람이 읽는 자리에만 씁니다. */
export function 분말(분: number): string {
  const m = Math.max(0, Math.round(Number(분) || 0));
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}시간${r}분`;
  if (h) return `${h}시간`;
  return `${r}분`;
}

/** 오늘 날짜를 YYYY-MM-DD 로. */
export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** YYYY-MM-DD 에 일수를 더합니다. */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** 오늘부터 목표일까지 남은 일수. 지났으면 음수. */
export function daysUntil(ymd: string | null): number | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - base) / 86400_000);
}

/**
 * 생년월일에서 나이를 구합니다.
 * 연도를 코드에 박지 않습니다 — 해가 바뀌면 전원 한 살씩 틀리게 됩니다.
 * "1940.03.02" "1940-03-02" "19400302" 모두 받습니다.
 */
export function calcAge(birth: string | null | undefined): number | null {
  if (!birth) return null;
  const digits = String(birth).replace(/\D/g, "");
  if (digits.length < 4) return null;

  const y = Number(digits.slice(0, 4));
  const m = digits.length >= 6 ? Number(digits.slice(4, 6)) : 1;
  const d = digits.length >= 8 ? Number(digits.slice(6, 8)) : 1;
  if (!y || y < 1900 || y > 2200) return null;

  const now = new Date();
  let age = now.getFullYear() - y;
  const hadBirthday =
    now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d);
  if (!hadBirthday) age -= 1;
  return age;
}

/** "2026-08-23" → "2026. 8. 23."  서식에 쓰는 날짜 표기입니다. */
export function korDate(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${y}. ${Number(m)}. ${Number(d)}.`;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function bad(message: string, status = 400) {
  return json({ error: message }, status);
}

/**
 * 「단가은」이 아니라 「단가는」이 되게 조사를 붙입니다.
 *
 * 한글은 앞말에 받침이 있으면 은/이/을, 없으면 는/가/를 를 씁니다.
 * 오류 문구를 짜맞출 때 이걸 안 하면 「단가은 0 이상…」 같은 말이 나갑니다.
 * 쓰는 사람이 보는 글이라 이 정도는 맞춰 둡니다.
 */
function 받침있나(말: string): boolean {
  const c = 말.trim().at(-1);
  if (!c) return false;
  const code = c.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;   // 한글이 아니면 없는 것으로
  return (code - 0xac00) % 28 !== 0;
}
export const 은는 = (말: string) => 말 + (받침있나(말) ? "은" : "는");
export const 이가 = (말: string) => 말 + (받침있나(말) ? "이" : "가");
export const 을를 = (말: string) => 말 + (받침있나(말) ? "을" : "를");

/**
 * 대상자의 **주소 한 줄**을 만듭니다 — 도로명 + 상세(동·호수).
 *
 * ── 왜 함수로 두는가 ──────────────────────────────────────
 * 주소는 자료함에 **두 칸으로** 들어 있습니다(`payload.address` ·
 * `payload.addressDetail`). 칸을 나눈 이유는 주소를 다시 고를 때
 * **적어 둔 동·호수가 지워지지 않게** 하려는 것입니다.
 *
 * 그런데 나가는 자리는 여럿입니다 — 화면, **계약서**, **기록지**.
 * 자리마다 합치는 코드를 따로 쓰면 **언젠가 한 곳을 빠뜨리고**,
 * 그때 어르신 댁 동·호수가 빠진 서류가 나갑니다.
 * 그래서 합치는 곳은 **여기 하나뿐**입니다.
 */
export function 주소한줄(payload: any): string {
  return [payload?.address ?? "", payload?.addressDetail ?? ""]
    .map((x: any) => String(x ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * 시작·종료 두 시각 사이가 **몇 분인가.**
 *
 * 못 재면 `null` — 그러면 지금까지처럼 「한 번 = 한 시간」으로 셉니다.
 * 지어내지 않습니다.
 *
 * 하루가 넘어가는 값(음수·24시간 초과)은 버립니다. 끝을 잘못 찍고
 * 되돌린 흔적이 남을 때 그런 값이 나오는데, 그것을 그대로 청구에
 * 넣으면 **하루 상한에 걸려 다른 방문까지 깎입니다.**
 */
export function 분재기(시작?: string | null, 끝?: string | null): number | null {
  if (!시작 || !끝) return null;
  const a = Date.parse(시작), b = Date.parse(끝);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const 분 = Math.round((b - a) / 60000);
  if (분 <= 0 || 분 > 24 * 60) return null;
  return 분;
}
