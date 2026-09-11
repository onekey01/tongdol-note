/**
 * ═══════════════════════════════════════════════════════════
 *  **「이 배정은 이 날에 가나?」** — 답하는 곳은 여기 하나입니다
 * ═══════════════════════════════════════════════════════════
 *
 * (2026-09-08 무무 — 한도를 넘는 계획은 **막기**로 정했는데, 막고 보니
 *  **동행지원(월 2회)과 이미용(월 1회)은 배정 자체가 안 됐습니다.**
 *  배정을 **주간 계획**으로만 짜기 때문입니다 — 한 주에 한 번이 제일
 *  적은데 그것만도 한 달 4~5번입니다. 「가!로 하자」 — 계획에 **주기**를
 *  넣기로 했습니다.)
 *
 * ── 왜 「격주」가 아니라 「한 달에 몇 번」인가 (제 판단입니다) ──
 *
 * 편람이 정한 것은 **「월 2회」**지 「격주」가 아닙니다. 격주로 잡으면
 * **다섯 주짜리 달에는 3번**이 되어 그 달만 한도를 넘습니다. 막는 것을
 * 만들어 놓고 다시 넘기는 계획을 짜게 됩니다.
 *
 *   「한 달에 2번 · 수요일」 = **그 달 수요일 중 앞의 두 번**
 *
 * 달이 몇 주짜리든 정확히 2번입니다. 한도를 넘을 수가 없습니다.
 *
 * ── ★ 왜 파일 하나로 모으나 ★ ──────────────────────────────
 *
 * 계획을 **날짜로 펴는 자리가 여섯 군데**입니다 —
 *
 *   ① 실적 달력 (`record.ts`)          ④ 현장앱 「오늘 갈 곳」 (`할일보내기.ts`)
 *   ② 계획 미리 재기 (`계획재기.ts`)    ⑤ 담당 일감 (`assign.ts`)
 *   ③ 청구 (`billing.ts`)              ⑥ 「계획된 날인가」 판정 (`record.ts`)
 *
 * 주기를 여섯 군데에 따로 넣으면 언젠가 한 곳만 고쳐지고, 그러면
 * **사무실 화면과 제공인력 폰이 서로 다른 날을 말합니다.** 어르신 댁
 * 앞에서 「오늘 아닌데요」가 되는 고장이고, 그건 프로그램을 버리게
 * 만듭니다. **묻는 곳이 여섯이어도 답하는 곳은 하나**여야 합니다.
 */
import { parseSlots } from "./util";

/** 배정에서 이 셈에 필요한 것만. 표를 통째로 넘겨도 됩니다. */
export type 갈배정 = {
  weekly_plan?: unknown;
  period_from?: string | null;
  period_to?: string | null;
  /** 한 달에 몇 번까지. **0 이면 매주** (그 요일마다 다 갑니다). */
  monthly_times?: number | null;
};

/** 0 = 매주. 1~4 = 그 달에 그만큼만. */
export function 달몇번(a: 갈배정): number {
  const n = Number(a?.monthly_times ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.min(31, Math.floor(n)) : 0;
}

/** 화면에 적을 말. */
export function 주기말(n: number): string {
  return n > 0 ? `한 달에 ${n}번` : "매주";
}

const 요일 = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();

/**
 * 그 달에 **가기로 한 날들**을 순서대로.
 *
 * 매주면 그 달의 해당 요일 전부, 「한 달에 N번」이면 **앞에서 N개**.
 * 배정 기간(period_from~to) 밖은 애초에 안 넣습니다 — 기간 밖을 넣으면
 * 「갈 날인데 못 간 날」로 잘못 세게 됩니다.
 */
export function 그달가는날(a: 갈배정, 달: string): string[] {
  const 요일들 = new Set(parseSlots(a?.weekly_plan).map((s) => s.dow));
  if (!요일들.size) return [];
  const [y, m] = 달.split("-").map(Number);
  if (!y || !m) return [];
  const 끝일 = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const 처음 = a?.period_from ? String(a.period_from).slice(0, 10) : "";
  const 마지막 = a?.period_to ? String(a.period_to).slice(0, 10) : "";

  const 것: string[] = [];
  for (let d = 1; d <= 끝일; d++) {
    const ymd = `${달}-${String(d).padStart(2, "0")}`;
    if (처음 && ymd < 처음) continue;
    if (마지막 && ymd > 마지막) continue;
    if (요일들.has(요일(ymd))) 것.push(ymd);
  }
  const n = 달몇번(a);
  return n > 0 ? 것.slice(0, n) : 것;
}

/** ★ 이 날에 가나. **모든 화면이 이것을 묻습니다.** */
export function 그날가나(a: 갈배정, ymd: string): boolean {
  if (!ymd) return false;
  return 그달가는날(a, ymd.slice(0, 7)).includes(ymd.slice(0, 10));
}

/**
 * 첫날~끝날 사이에 **몇 번 가나.**
 *
 * 계획 재기가 씁니다. 달을 걸쳐도 **달마다 따로** 세야 「한 달에 2번」이
 * 제대로 먹습니다 — 구간으로 뭉뚱그려 세면 달 경계가 사라집니다.
 */
export function 가는날세기(a: 갈배정, 첫날: string, 끝날: string): number {
  if (!첫날 || !끝날 || 끝날 < 첫날) return 0;
  let n = 0;
  const 첫달 = 첫날.slice(0, 7), 끝달 = 끝날.slice(0, 7);
  const d = new Date(`${첫달}-01T00:00:00Z`);
  for (let i = 0; i < 60; i++) {
    const 달 = d.toISOString().slice(0, 7);
    if (달 > 끝달) break;
    for (const ymd of 그달가는날(a, 달))
      if (ymd >= 첫날 && ymd <= 끝날) n++;
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return n;
}

/**
 * 「한 달에 몇 번」으로 **한도 안에 들 수 있나** — 배정 화면이 묻습니다.
 *
 * 월 한도가 2회인데 매주로 잡으면 절대 못 듭니다. 그때 **몇 번으로
 * 잡아야 하는지**를 알려 주려고 있습니다.
 */
export function 한도에드는달몇번(월횟수한도: number): number {
  return 월횟수한도 > 0 && 월횟수한도 <= 4 ? 월횟수한도 : 0;
}
