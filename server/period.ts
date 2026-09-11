/**
 * 청구 구간 — **언제부터 언제까지를 한 장으로 묶는가.**
 *
 * ── 왜 따로 떼어 놓는가 ────────────────────────────────────
 * 정산에서 틀리면 안 되는 것이 둘입니다. **얼마인가**와 **언제 것인가**.
 * 앞엣것은 `billing.ts` 가, 뒤엣것은 여기가 봅니다.
 * 한 파일에 섞어 두면 「금액은 맞는데 기간이 하루 밀린」 일이 생기고,
 * 그런 청구서는 지자체가 되돌려 보냅니다.
 *
 * ── 세 가지 방식 ───────────────────────────────────────────
 * 기관마다 다릅니다. 셋 중 하나를 설정에서 고릅니다.
 *
 *   달마다(monthly)         달력 달로 자릅니다. 8월분은 8.1~8.31.
 *                           지자체 명단·기록지가 달력 달이라 줄이 맞습니다
 *   시작일부터(anniversary) 의뢰가 5.11 에 시작했으면
 *                           5.11~6.10 · 6.11~7.10 … 로 자릅니다.
 *                           「서비스 한 달」을 온전히 세는 방식입니다
 *   일괄(on_end)            의뢰 기간이 끝나면 **그동안 것을 한 장으로**
 *
 * **지자체 몫과 이용자 몫이 서로 달라도 됩니다.**
 * 지자체에는 매달 올리면서 어르신께는 끝나고 한 번에 받는 곳이 있습니다.
 *
 * ── 끝나지 않은 구간 ───────────────────────────────────────
 * 아직 안 끝난 구간은 **청구하지 않고 「쌓이는 중」으로 보여 줍니다.**
 * 얼마가 쌓였는지 모르면 사람이 불안해합니다. 보여는 주되 확정은 안 합니다.
 */

export type 청구시점 = "monthly" | "anniversary" | "on_end";

export const 시점이름: Record<청구시점, string> = {
  monthly: "달마다",
  anniversary: "시작일부터 한 달씩",
  on_end: "기간이 끝날 때 한 번에",
};

export const 시점설명: Record<청구시점, string> = {
  monthly: "달력 달로 자릅니다. 8월분은 8월 1일~31일. 지자체 명단·기록지와 줄이 맞습니다.",
  anniversary: "의뢰가 시작한 날부터 한 달씩 셉니다. 5월 11일에 시작했으면 5.11~6.10 이 1회차입니다.",
  on_end: "의뢰 기간이 끝나면 그동안 것을 한 장으로 묶어 청구합니다.",
};

export type 구간 = {
  from: string;      // YYYY-MM-DD
  to: string;        // YYYY-MM-DD
  회차: number;      // 1부터
  끝났나: boolean;   // 오늘 기준으로 이 구간이 지났는가
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const 날 = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** 그 달의 마지막 날 */
const 그믐 = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();

/**
 * 시작일에서 n달 뒤 같은 날.
 *
 * **1월 31일의 한 달 뒤는 2월 31일이 아닙니다.** 그런 날은 없으니 그믐으로 자릅니다.
 * 자르지 않으면 자바스크립트가 3월 3일로 넘겨 버리고, 회차가 통째로 어긋납니다.
 */
function 달더하기(base: string, n: number): Date {
  const b = 날(base);
  const y = b.getFullYear(), m = b.getMonth() + n, d = b.getDate();
  const ny = y + Math.floor(m / 12);
  const nm = ((m % 12) + 12) % 12;
  return new Date(ny, nm, Math.min(d, 그믐(ny, nm)));
}

const 하루전 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);

/** 두 날짜 중 이른 것 / 늦은 것 */
const 이른 = (a: string, b: string) => (a <= b ? a : b);

/**
 * 한 의뢰의 청구 구간들을 자릅니다.
 *
 * @param from   의뢰 시작일
 * @param to     의뢰 종료일. 비어 있으면 「아직 안 끝남」
 * @param timing 셋 중 하나
 * @param 오늘   끝났는지 판단하는 기준일 (시험에서 바꿔 넣습니다)
 */
export function 구간나누기(
  from: string, to: string | null, timing: 청구시점, 오늘: string
): 구간[] {
  if (!from) return [];
  const 끝 = to || null;

  // ── 일괄 — 통째로 한 장 ──────────────────────────────────
  if (timing === "on_end") {
    // 끝을 모르면 오늘까지를 「쌓이는 중」으로 봅니다.
    const 마지막 = 끝 ?? 오늘;
    return [{ from, to: 마지막, 회차: 1, 끝났나: !!끝 && 끝 <= 오늘 }];
  }

  const out: 구간[] = [];
  const 한계 = 600;   // 50년. 자료가 이상해도 무한히 돌지 않게

  // ── 시작일부터 한 달씩 ───────────────────────────────────
  if (timing === "anniversary") {
    for (let n = 0; n < 한계; n++) {
      const 시작 = n === 0 ? from : ymd(달더하기(from, n));
      if (끝 && 시작 > 끝) break;
      const 다음 = ymd(하루전(달더하기(from, n + 1)));
      const 마감 = 끝 ? 이른(다음, 끝) : 다음;
      out.push({ from: 시작, to: 마감, 회차: n + 1, 끝났나: 마감 <= 오늘 });
      // 끝이 없으면 오늘이 든 구간까지만 만듭니다 — 앞날을 미리 만들지 않습니다.
      if (!끝 && 마감 > 오늘) break;
      if (끝 && 마감 >= 끝) break;
    }
    return out;
  }

  // ── 달마다 — 달력 달 ─────────────────────────────────────
  const b = 날(from);
  let y = b.getFullYear(), m0 = b.getMonth();
  for (let n = 0; n < 한계; n++) {
    const 첫날 = n === 0 ? from : `${y}-${String(m0 + 1).padStart(2, "0")}-01`;
    if (끝 && 첫날 > 끝) break;
    const 말일 = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(그믐(y, m0)).padStart(2, "0")}`;
    const 마감 = 끝 ? 이른(말일, 끝) : 말일;
    out.push({ from: 첫날, to: 마감, 회차: n + 1, 끝났나: 마감 <= 오늘 });
    if (!끝 && 마감 > 오늘) break;
    if (끝 && 마감 >= 끝) break;
    m0++;
    if (m0 > 11) { m0 = 0; y++; }
  }
  return out;
}

/**
 * 그 날짜가 든 구간을 찾습니다.
 * 화면에서 「지금 8월인데 이 어르신은 어느 회차인가」를 물을 때 씁니다.
 */
export function 그날의구간(
  from: string, to: string | null, timing: 청구시점, 날짜: string, 오늘: string
): 구간 | null {
  return 구간나누기(from, to, timing, 오늘)
    .find((x) => x.from <= 날짜 && 날짜 <= x.to) ?? null;
}

/** 설정 값이 셋 중 하나인지 봅니다. 아니면 「달마다」로 — 지금까지 하던 대로. */
export function 시점읽기(v: unknown): 청구시점 {
  const s = String(v ?? "");
  return s === "anniversary" || s === "on_end" ? s : "monthly";
}
