import { db } from "./db";
import { today, parseSlots } from "./util";
import { applyRounding, 인정분, 셈규칙읽기, type Rounding } from "./money";
import { daysOf } from "./record";
import { 구간나누기, 시점읽기, type 청구시점, type 구간 } from "./period";
import { 돈드는실적SQL } from "./미제공";
import { 하루최대분 } from "./계획시간";

/**
 * 정산 — 실적에 단가를 곱해 돈으로 바꿉니다.
 *
 * ── 무엇을 셈하는가 ────────────────────────────────────────
 *   서비스 비용   제공 횟수 × 단가            (휴일은 휴일 단가)
 *   본인부담금    서비스 비용 × 부담률        → 이용자가 냅니다
 *   청구액        서비스 비용 − 본인부담금    → 지자체에 청구합니다
 *
 * 「미제공」은 세지 않습니다 — **노쇼만 뺍니다.**
 * 계약서(서식2) 4조가 「사전 취소 없이 이용하지 않으셨더라도 비용이
 * 지출된다」고 어르신께 약속해 두었습니다. 그러니 노쇼는 돈이 나갑니다.
 * 갈래의 뜻은 `미제공.ts` 한 곳이 정합니다 (A-3 · 7-아).
 *
 * ── calc_snapshot 이 왜 있는가 ─────────────────────────────
 * 단가는 해가 바뀌면 오릅니다. 부담률 구간도 바뀝니다.
 * 그런데 **작년 8월 청구서를 다시 뽑았을 때 금액이 달라지면 안 됩니다.**
 * 지자체가 「그때 얼마였습니까」라고 물으면 그때 값으로 답해야 합니다.
 *
 * 그래서 청구를 확정할 때 **계산에 쓴 값을 통째로 얼려서** 함께 저장합니다.
 * 단가·부담률·절삭 규칙·횟수까지 전부. 다시 뽑을 때는 이 얼린 값으로 찍습니다.
 * 지금 표에서 다시 계산하지 않습니다.
 */

export type Line = {
  serviceId: number;
  service: string;
  unit: string;
  weekday: number;      // 평일 제공 횟수
  holiday: number;      // 휴일 제공 횟수
  count: number;
  unitPrice: number;
  holidayPrice: number | null;
  amount: number;
  /**
   * 그중 **노쇼가 몇 건인가** (A-3).
   *
   * 청구서에 「3회」라고만 적혀 있는데 한 번은 헛걸음이었다면,
   * 나중에 어르신이 물으셨을 때 답할 데가 없습니다. 갈라 적습니다.
   */
  노쇼건수: number;
  lifetimeCap: number | null;
  lifetimeUsed: number | null;   // 이 달 것까지 더한 누적
  lifetimeLeft: number | null;
  over: boolean;                 // 생애한도를 넘었는가
};

function profileOf() {
  const org = db.query<any, []>("SELECT * FROM organization WHERE id = 1").get();
  const p = db.query<any, [number]>("SELECT * FROM region_profile WHERE id = ?")
    .get(org?.profile_id);
  return { org, profile: p };
}

function roundingOf(p: any): Rounding {
  return {
    unit: p?.rounding_unit ?? 10,
    mode: (p?.rounding_mode ?? "round") as Rounding["mode"],
  };
}

/**
 * ── 언제부터 언제까지를 한 장으로 묶는가 ───────────────────
 *
 * 「달마다」면 달력 달이 그대로 한 장입니다 — 지금까지 하던 방식입니다.
 * 「시작일부터 한 달씩」이면 의뢰가 시작한 날부터 세고,
 * 「일괄」이면 의뢰 기간이 끝날 때 통째로 한 장입니다.
 *
 * **구간은 대상자 단위로 나눕니다.** 서비스마다 따로 나누지 않습니다 —
 * 청구서는 사람에게 가는 것이라, 한 어르신께 종이가 세 장 가면 안 됩니다.
 * 기준은 **그분의 가장 이른 의뢰 시작일**입니다.
 *
 * 아직 안 끝난 구간은 **확정하지 않습니다.** 「쌓이는 중」으로 보여만 줍니다.
 */
function 시점들() {
  const { profile } = profileOf();
  return {
    claim: 시점읽기(profile?.claim_timing),
    copay: 시점읽기(profile?.copay_timing),
  };
}

/**
 * ── 한 장인가, 두 장인가 ───────────────────────────────────
 *
 * 돈은 **두 군데서 옵니다** — 지자체가 낼 몫과 이용자가 낼 몫.
 * 두 몫의 청구 시점이 같으면 **종이 한 장**에 담습니다 (`both`).
 *
 * 그런데 기관이 「지자체는 달마다, 본인부담금은 끝날 때 한 번」으로 정할 수 있습니다.
 * 그러면 **묶는 기간 자체가 서로 다릅니다.** 8월분 지자체 청구는 8.1~8.31 인데
 * 본인부담금은 5.11~11.10 을 통째로 받는 식입니다.
 * 기간이 다른 두 금액을 한 장에 적으면 **그 종이는 거짓말이 됩니다.**
 * 그래서 그때는 청구를 **둘로 갈라** 각각 제 기간·제 상태를 갖게 합니다.
 *
 *   both    한 장에 둘 다 (시점이 같을 때)
 *   claim   지자체 몫만
 *   copay   이용자 몫만
 */
export type 몫종류 = "both" | "claim" | "copay";

export const 몫이름: Record<몫종류, string> = {
  both: "청구서",
  claim: "지자체 청구",
  copay: "본인부담금",
};

function 몫종류들(시점: { claim: 청구시점; copay: 청구시점 }): 몫종류[] {
  return 시점.claim === 시점.copay ? ["both"] : ["claim", "copay"];
}

function 몫시점(시점: { claim: 청구시점; copay: 청구시점 }, kind: 몫종류): 청구시점 {
  return kind === "copay" ? 시점.copay : 시점.claim;
}

/**
 * 그 몫이 **실제로 청구하는 돈만** 남깁니다.
 *
 * 지자체 몫 종이에 본인부담금까지 적어 두면 두 종이를 더했을 때 두 번 셉니다.
 * 서비스 비용은 그 구간의 것을 그대로 둡니다(그 종이의 근거니까요).
 * 다만 **받을 돈은 제 것만** 적습니다.
 */
function 몫돈<T extends { total: number; copay: number; claim: number; count: number }>(
  kind: 몫종류, fold: T
): T {
  if (kind === "claim") return { ...fold, copay: 0 };
  if (kind === "copay") return { ...fold, claim: 0 };
  return fold;
}

/** 확정해 둔 청구 줄 찾기. **몫까지 맞춰야** 합니다 — 기간이 우연히 같을 수 있습니다. */
function 청구찾기(recipientId: string, from: string, to: string, kind: 몫종류) {
  return db.query<any, [string, string, string, string]>(
    `SELECT * FROM billing
      WHERE recipient_id = ? AND period_from = ? AND period_to = ? AND kind = ?`
  ).get(recipientId, from, to, kind) ?? null;
}

/** 어느 상태를 먼저 손봐야 하는가. 한 사람에게 몫이 둘일 때 대표를 고릅니다. */
const 급한순: string[] = ["미확정", "쌓이는중", "확정", "수납"];

/** 그 대상자의 의뢰가 언제 시작해서 언제 끝나는가. 없으면 null. */
function 의뢰기간(recipientId: string): { from: string; to: string | null } | null {
  const r = db.query<{ from: string; to: string | null; opened: number }, [string]>(
    `SELECT MIN(period_from) AS "from",
            MAX(COALESCE(period_to, '9999-12-31')) AS "to",
            SUM(CASE WHEN period_to IS NULL THEN 1 ELSE 0 END) AS opened
       FROM referral WHERE recipient_id = ? AND period_from IS NOT NULL`
  ).get(recipientId);
  if (!r?.from) return null;
  // 끝을 안 적은 의뢰가 하나라도 있으면 「아직 안 끝남」입니다.
  return { from: r.from, to: r.opened > 0 || r.to === "9999-12-31" ? null : r.to };
}

/**
 * 그 사람의 **그 달에 해당하는 청구 구간.**
 *
 * 「달마다」면 그 달 그대로. 그 밖에는 그 달에 **걸치는** 구간을 찾습니다.
 * 의뢰가 없으면(옛 자료 등) 그 달로 물러섭니다 — 셈을 멈추는 것보다 낫습니다.
 */
function 그달의구간(recipientId: string, m: string, timing: 청구시점): 구간 {
  const days = daysOf(m);
  const 달첫날 = days[0], 달말일 = days[days.length - 1];
  const 그냥달: 구간 = { from: 달첫날, to: 달말일, 회차: 1, 끝났나: 달말일 <= today() };
  if (timing === "monthly") return 그냥달;

  const 기간 = 의뢰기간(recipientId);
  if (!기간) return 그냥달;

  const 조각들 = 구간나누기(기간.from, 기간.to, timing, today());
  // 그 달에 **끝나는** 조각이 있으면 그것이 이 달에 청구할 것입니다.
  const 이달에끝남 = 조각들.find((x) => x.to >= 달첫날 && x.to <= 달말일);
  if (이달에끝남) return 이달에끝남;
  // 끝나는 것이 없으면, 그 달에 걸쳐 있는 조각을 「쌓이는 중」으로 보여 줍니다.
  const 걸침 = 조각들.find((x) => x.from <= 달말일 && 달첫날 <= x.to);
  return 걸침 ?? 그냥달;
}

/**
 * 생애한도까지 얼마를 썼는가.
 *
 * 안전생활환경개선처럼 「생애 1회 · 200만원」 같은 한도가 붙는 서비스가 있습니다.
 * 이 달 것만 보면 한도를 넘겼는지 알 수 없어서 **처음부터 전부** 셉니다.
 */
function lifetimeUsed(recipientId: string, before: string) {
  const rows = db.query<{ service_id: number; used: number }, [string, string]>(
    `SELECT d.service_id, SUM(sv.unit_price) AS used
       FROM delivery d JOIN service sv ON sv.id = d.service_id
      WHERE d.recipient_id = ? AND ${돈드는실적SQL} AND d.served_on < ?
      GROUP BY d.service_id`
  ).all(recipientId, before);
  return new Map(rows.map((r) => [r.service_id, r.used ?? 0]));
}

/**
 * ── **하루 최대 서비스 시간** — 편람 「1일 최대 3시간」 ───────
 *
 * 편람이 서비스마다 적어 둔 그대로입니다 —
 *
 *   가사지원  「○ (제 공 기 준) 1일 최대 3시간(평일 오전 9시 ~오후 6시)」
 *   동행지원  「○ (제공기준) 1일 최대 3시간(평일 오전9시 ~ 오후 6시)」
 *
 * 여기에 「비용산정: 30분단위로 환산」이 겹치므로, 하루에 나올 수 있는
 * 값은 **여섯 가지뿐**입니다 — 30분 · 1시간 · 1시간30분 · 2시간 ·
 * 2시간30분 · 3시간 (그리고 15분을 못 넘긴 미산정 0).
 *
 * 지금까지 우리 셈은 **잰 시간만큼 다 쳤습니다.** 실수로 다섯 시간이
 * 찍히면 다섯 시간을 청구합니다. 그 선을 **셈하는 자리**에 둡니다 —
 * 화면에서만 막으면 엑셀로 들어온 자료·옛 자료를 못 막습니다.
 *
 * 상한은 이 차례로 정해집니다 —
 *   ① 그 사람 그 서비스의 **주간 계획에 적힌 그 요일 시간**
 *      (「서비스 제공계획에 시간이 별도로 명시되어 있다면 일 최대
 *        서비스시간을 이에 맞춤」 — 2026-09-03 무무 님 지시)
 *   ② 없으면 지역 규칙의 **하루 최대 서비스 시간**(편람 3시간)
 *   ③ 그것도 0 이면 **안 봅니다**
 */
export type 실적한줄 = {
  id: number;
  served_on: string;
  service_id: number;
  name: string;
  unit: string;
  unit_price: number;
  holiday_price: number | null;
  lifetime_cap: number | null;
  sort_order: number;
  is_holiday: number;
  outcome: string;
  start_at: string | null;
  end_at: string | null;
  /** 실제로 잰 분. 시간제가 아니거나 노쇼면 `null`. */
  잰분: number | null;
  /** 30분 환산 뒤, **하루 상한까지 적용된** 분. 시간제가 아니면 `null`. */
  인정분: number;
  /** 하루 상한에 걸려 깎였나. 화면에서 알려 줄 때 씁니다. */
  깎였나: boolean;
};

/**
 * 한 사람의 한 구간치 **실적을 한 줄씩** — 하루 상한까지 적용해서.
 *
 * 청구서(`linesOf`)와 서식8(`비용총괄.ts`)이 **둘 다 이것을 봅니다.**
 * 갈라 놓으면 언젠가 두 종이가 다른 금액을 말합니다.
 */
export function 실적줄들(
  recipientId: string, first: string, last: string,
  옵션: { 연간바깥만?: boolean } = {}
): 실적한줄[] {
  /*
   * ── `연간바깥만` 은 왜 있나 (2026-09-08 운용 시험) ──────────
   *
   * 주거(안전생활환경)는 **생애** 한도라, 그 한 가지를 세려고
   * `실적줄들(id, "1900-01-01", "9999-12-31")` 을 부르는 곳이 있습니다.
   * 그러면 **그 사람의 평생 실적을 통째로** 읽습니다. 홈 화면은
   * 그것을 대상자 **한 명씩 전부** 합니다.
   *
   * 대상자 300명 · 2년치(14만 줄)로 재어 보니 홈이 **1.2초**였고,
   * 그중 대부분이 이 줄이었습니다. 주거를 한 번도 안 받은 분도
   * 평생 실적을 다 읽고 나서 버리고 있었던 것입니다.
   *
   * 그래서 **읽을 때 걸러 옵니다.** 셈하는 방법은 하나도 안 바뀝니다 —
   * 어차피 버릴 줄을 안 읽어 올 뿐입니다.
   */
  const 거르개 = 옵션.연간바깥만 ? "AND sv.outside_annual_cap = 1" : "";
  const rows = db.query<any, [string, string, string]>(
    `SELECT d.id, d.service_id, d.is_holiday, d.minutes, d.outcome, d.miss_kind,
            d.served_on, d.start_at, d.end_at,
            sv.name, sv.unit, sv.unit_price, sv.holiday_price, sv.lifetime_cap,
            sv.sort_order, sv.round_unit, sv.round_half
       FROM delivery d JOIN service sv ON sv.id = d.service_id
      WHERE d.recipient_id = ? AND ${돈드는실적SQL} ${거르개}
        AND d.served_on >= ? AND d.served_on <= ?
      ORDER BY sv.sort_order, sv.name, d.served_on, d.id`
  ).all(recipientId, first, last);

  /*
   * ★ 하루 최대 서비스 시간은 **server/계획시간.ts 한 곳에서** 옵니다.
   *   같은 규칙을 여기와 할일보내기에 따로 적어 두었다가 한쪽만
   *   고쳐지는 일이 실제로 났습니다 (2026-09-05). 이제 한 곳입니다.
   */
  const 규칙분 = 하루최대분() ?? 0;

  /** 그 사람의 배정 — 계획에 적힌 요일별 시간을 꺼내려고. */
  const 배정 = db.query<any, [string]>(
    `SELECT service_id, period_from, period_to, weekly_plan
       FROM assignment WHERE recipient_id = ? ORDER BY id`
  ).all(recipientId);

  /** 그 날 그 서비스의 계획 시간(분). 없으면 `null`. */
  const 계획분 = (날: string, serviceId: number): number | null => {
    const dow = new Date(`${날}T00:00:00Z`).getUTCDay();
    for (const a of 배정) {
      if (Number(a.service_id) !== Number(serviceId)) continue;
      if (a.period_from && 날 < a.period_from) continue;
      if (a.period_to && 날 > a.period_to) continue;
      const s = parseSlots(a.weekly_plan).find((x) => x.dow === dow);
      if (s?.minutes) return s.minutes;
    }
    return null;
  };

  /*
   * 상한은 **그 날치를 모아** 깎습니다. 돌려주는 차례는 원래대로(서비스 순)
   * 두어야 청구서 표시가 안 흔들리므로 **셈만 따로** 합니다.
   */
  const 날짜순 = [...rows].sort((a, b) =>
    a.served_on < b.served_on ? -1 : a.served_on > b.served_on ? 1 : a.id - b.id);

  const 인정맵 = new Map<number, { 인정분: number; 깎였나: boolean }>();
  const 남은분 = new Map<string, number>();

  for (const r of 날짜순) {
    const 노쇼 = r.outcome === "미제공";
    const 시간제 = r.unit === "hour";
    const 잰 = 노쇼 || r.minutes == null ? null : Number(r.minutes);

    if (!시간제 || 잰 == null) {          // 끼·회, 그리고 분을 안 적은 옛 실적
      인정맵.set(r.id, { 인정분: 60, 깎였나: false });   // 「한 번 = 한 시간」
      continue;
    }

    let 인정 = 인정분(잰, 셈규칙읽기(r));
    const 상한 = 계획분(r.served_on, r.service_id) ?? 규칙분;
    let 깎였나 = false;
    if (상한 > 0) {
      if (!남은분.has(r.served_on)) 남은분.set(r.served_on, 상한);
      const 남 = 남은분.get(r.served_on)!;
      if (인정 > 남) { 인정 = Math.max(0, 남); 깎였나 = true; }
      남은분.set(r.served_on, 남 - 인정);
    }
    인정맵.set(r.id, { 인정분: 인정, 깎였나 });
  }

  return rows.map((r): 실적한줄 => {
    const 노쇼 = r.outcome === "미제공";
    const 시간제 = r.unit === "hour";
    const 잰 = 노쇼 || r.minutes == null ? null : Number(r.minutes);
    const v = 인정맵.get(r.id) ?? { 인정분: 60, 깎였나: false };
    return {
      id: r.id, served_on: r.served_on, service_id: r.service_id,
      name: r.name, unit: r.unit, unit_price: r.unit_price,
      holiday_price: r.holiday_price, lifetime_cap: r.lifetime_cap,
      sort_order: r.sort_order, is_holiday: r.is_holiday, outcome: r.outcome,
      start_at: r.start_at, end_at: r.end_at,
      잰분: 시간제 ? 잰 : null,
      인정분: v.인정분,
      깎였나: v.깎였나,
    };
  });
}

/**
 * 한 사람의 한 구간치 줄을 뽑습니다. 아직 확정하지 않은 「지금 계산」입니다.
 *
 * `범위` 를 주면 그 기간으로, 안 주면 그 달로 셉니다.
 * 「달마다」가 아닌 기관에서는 청구 구간이 달력 달과 다릅니다.
 */
export function linesOf(
  recipientId: string, month: string, 범위?: { from: string; to: string }
) {
  const days = daysOf(month);
  const first = 범위?.from ?? days[0];
  const last = 범위?.to ?? days[days.length - 1];
  const { profile } = profileOf();
  const holidayOn = !!profile?.holiday_enabled;

  /*
   * ── 한 줄씩 봅니다 (2026-08-31, A-1) ────────────────────────
   *
   * 전에는 `GROUP BY service_id` 로 **건수만** 세어 단가를 곱했습니다.
   * 그러면 **40분 다녀온 것도 한 건 = 한 시간**이 됩니다.
   * 편람은 15분 미만 미산정 · 15~45분 30분 · 45분 이상 1시간이라
   * 건수만으로는 셀 수가 없습니다. 그래서 **실적 한 줄씩** 봅니다.
   *
   * 30분 환산과 **하루 상한**은 `실적줄들` 이 합니다 — 서식8 도 같은 것을
   * 보아야 두 종이가 안 어긋납니다.
   */
  const rows = 실적줄들(recipientId, first, last);

  const before = lifetimeUsed(recipientId, first);

  const 모음 = new Map<number, any>();
  for (const r of rows) {
    // 휴일 할증을 쓰지 않는 기관이면 휴일도 평일 단가로 셈합니다.
    const hPrice = holidayOn ? (r.holiday_price ?? r.unit_price) : r.unit_price;
    const 단가 = r.is_holiday ? hPrice : r.unit_price;

    /*
     * ── 시간제만 분을 봅니다 ─────────────────────────────────
     * 가사·동행은 시간이라 30분 단위로 환산합니다.
     * **식사는 끼, 이미용은 회**라 분을 재지 않습니다 — 한 번이 한 번입니다.
     *
     * 분이 **비어 있으면 예전처럼 한 번 = 한 시간**입니다.
     * 옛 실적에는 분이 없는데 그것을 지어내면 **지난 청구서가 흔들립니다.**
     *
     * **노쇼는 안 간 것이라 분이 없습니다** (A-3). 제공인력이 헛걸음을 한
     * 것이지 30분을 있다 온 것이 아니므로 **한 번 = 한 회분**으로 셉니다.
     */
    const 노쇼 = r.outcome === "미제공";
    const 시간제 = r.unit === "hour";
    const 잰분 = r.잰분;
    const 인정 = r.인정분 / 60;
    const 금액 = Math.round(단가 * 인정);

    let x = 모음.get(r.service_id);
    if (!x) {
      x = {
        serviceId: r.service_id, service: r.name, unit: r.unit,
        weekday: 0, holiday: 0, count: 0,
        unitPrice: r.unit_price,
        holidayPrice: holidayOn ? r.holiday_price : null,
        amount: 0,
        노쇼건수: 0,
        // 서식8 의 「진행시간」과 「제공시간」이 이 둘입니다.
        진행분: 0, 인정분합: 0, 분적은건수: 0, 미산정건수: 0,
        // 하루 상한에 걸려 깎인 방문이 몇인가. 화면에서 알려 줍니다.
        깎인건수: 0,
        lifetime_cap: r.lifetime_cap,
      };
      모음.set(r.service_id, x);
    }
    if (r.is_holiday) x.holiday += 1; else x.weekday += 1;
    x.count += 1;
    x.amount += 금액;
    if (노쇼) x.노쇼건수 += 1;
    if (r.깎였나) x.깎인건수 += 1;
    if (시간제 && 잰분 != null) {
      x.진행분 += 잰분;
      x.인정분합 += r.인정분;
      x.분적은건수 += 1;
      if (r.인정분 === 0) x.미산정건수 += 1;   // 15분을 못 넘겨 0원이 된 방문
    }
  }

  return [...모음.values()].map((x): Line => {
    const used = (before.get(x.serviceId) ?? 0) + x.amount;
    const { lifetime_cap, ...나머지 } = x;
    return {
      ...나머지,
      lifetimeCap: lifetime_cap,
      lifetimeUsed: lifetime_cap ? used : null,
      lifetimeLeft: lifetime_cap ? lifetime_cap - used : null,
      over: !!lifetime_cap && used > lifetime_cap,
    };
  });
}

/** 줄을 돈으로 접습니다. 절삭은 **총액에 한 번만** 합니다. */
export function foldLines(lines: Line[], rate: number, r: Rounding) {
  const total = lines.reduce((s, x) => s + x.amount, 0);
  // 줄마다 자르고 더하면 합계가 어긋납니다. 총액에 한 번.
  const copay = applyRounding(total * rate, r);
  return { total, copay, claim: total - copay, count: lines.reduce((s, x) => s + x.count, 0) };
}

/**
 * 한 달치 정산표.
 *
 * 확정한 것(billing 줄)이 있으면 **얼린 값**을 씁니다.
 * 없으면 지금 표로 계산해 보여 줍니다 — 아직 바뀔 수 있는 숫자라는 뜻입니다.
 */
export function month(m: string, opts: { q?: string; dong?: string; state?: string } = {}) {
  if (!/^\d{4}-\d{2}$/.test(m)) throw new Error("달을 YYYY-MM 으로 주세요.");
  const days = daysOf(m);
  const first = days[0], last = days[days.length - 1];
  const { org, profile } = profileOf();
  const r = roundingOf(profile);

  const tiers = new Map<number, any>(
    (db.query<any, []>("SELECT * FROM copay_tier").all()).map((t) => [t.id, t])
  );

  // 언제부터 언제까지를 한 장으로 묶는지는 **기관 설정**이 정합니다.
  const 시점 = 시점들();
  const 종류들 = 몫종류들(시점);
  const 한장인가 = 종류들.length === 1;   // 두 몫이 같은 시점이면 종이 한 장

  /*
   * 이 달 정산표에 누가 오르는가.
   *
   * 「달마다」면 간단합니다 — **그 달에 실적이 있는 사람.**
   *
   * 그런데 다른 두 방식에서는 이것으로 부족합니다.
   * 5.11 에 시작해 8.10 에 끝나는 의뢰라면 **8월 청구 구간은 7.11~8.10** 인데,
   * 8월에 한 번도 안 갔으면 「8월에 실적이 있는 사람」에 안 잡힙니다.
   * 그러면 청구할 것이 있는데 목록에 안 떠서 **그대로 넘어갑니다.**
   * 실제로 그렇게 만들었다가 시험이 잡아냈습니다.
   *
   * 그래서 실적이 있는 사람을 넓게 부르고, **각자 구간을 셈해서**
   * 이 달에 걸치는 사람만 남깁니다. 대상자는 많아야 수백이라 이 편이 안전합니다.
   */
  const 겹치나 = (g: 구간) => g.from <= last && first <= g.to;
  const people = 종류들.every((k) => 몫시점(시점, k) === "monthly")
    ? db.query<any, [string, string]>(
        `SELECT DISTINCT r.id, r.payload, r.dong, r.status, r.copay_tier_id
           FROM recipient r JOIN delivery d ON d.recipient_id = r.id
          WHERE d.served_on >= ? AND d.served_on <= ? AND ${돈드는실적SQL}`
      ).all(first, last)
    : db.query<any, []>(
        `SELECT DISTINCT r.id, r.payload, r.dong, r.status, r.copay_tier_id
           FROM recipient r JOIN delivery d ON d.recipient_id = r.id
          WHERE ${돈드는실적SQL}`
      ).all().filter((p: any) =>
        // 이 달에 걸치는 구간만. 끝나는 달이면 청구할 것이고,
        // 걸치기만 하면 「쌓이는 중」으로 보여 줍니다.
        // **몫이 둘이면 어느 한쪽만 걸쳐도 이 달 명단에 올립니다.**
        종류들.some((k) => 겹치나(그달의구간(p.id, m, 몫시점(시점, k))))
      );

  const items = people.map((p) => {
    const info = JSON.parse(p.payload || "{}");
    const tier = p.copay_tier_id ? tiers.get(p.copay_tier_id) : null;
    const rate = tier?.rate ?? 0;

    /*
     * 이 사람의 **몫들.** 시점이 같으면 하나(both), 다르면 둘(claim·copay).
     * 몫마다 제 구간·제 상태·제 금액을 갖습니다 — 기간이 다르니 당연합니다.
     * 이 달에 안 걸치는 몫은 뺍니다. 「8월 정산표」에 11월 것이 있으면 안 됩니다.
     */
    const 몫들 = 종류들.map((kind) => {
      const 구간 = 그달의구간(p.id, m, 몫시점(시점, kind));
      if (!겹치나(구간)) return null;

      const bill = 청구찾기(p.id, 구간.from, 구간.to, kind);
      // 확정한 것이 있으면 얼린 값 그대로. 없으면 지금 계산.
      const snap = bill?.calc_snapshot ? JSON.parse(bill.calc_snapshot) : null;
      const lines: Line[] = snap?.lines ?? linesOf(p.id, m, 구간);

      /*
       * **빈 종이는 만들지 않습니다.**
       * 몫이 갈리면 두 구간의 길이가 다릅니다. 8월에만 다녀온 분은
       * 「7월 지자체 청구」 구간에 실적이 없는데, 그 줄을 그대로 내놓으면
       * 0회 · 0원짜리 줄이 **붉은 「미확정」을 달고** 표에 앉습니다.
       * 확정을 누르면 「실적이 없습니다」로 막히는, 누를 수 없는 단추입니다.
       * 그래서 실적도 없고 확정한 적도 없는 몫은 아예 뺍니다.
       */
      if (lines.length === 0 && !bill) return null;
      const 돈 = bill
        ? { total: bill.service_amount, copay: bill.copay_amount, claim: bill.claim_amount,
            count: lines.reduce((s, x) => s + x.count, 0) }
        : 몫돈(kind, foldLines(lines, rate, r));

      /*
       * 확정한 뒤에 무엇이 달라졌는가. 둘을 갈라 봅니다.
       *
       *   실적 바뀜   갔다/못 갔다가 달라졌습니다. **다시 확정해야 합니다.**
       *   단가 바뀜   실적은 그대로인데 단가나 부담률이 달라졌습니다.
       *               이건 대개 **그냥 두는 것이 맞습니다** — 그때 금액으로
       *               청구했으니까요. 다시 확정하면 금액이 바뀝니다.
       *
       * 둘을 한 덩어리로 「바뀜」이라고 하면, 단가가 오른 것뿐인데
       * 지난달 청구서를 다시 확정해 버리는 사고가 납니다.
       */
      const 달라짐 = (() => {
        if (!bill) return { stale: false, priceDrift: false };
        const now = linesOf(p.id, m, 구간);
        const key = (ls: Line[]) =>
          ls.map((x) => `${x.serviceId}:${x.weekday}/${x.holiday}`).sort().join("|");
        return {
          stale: key(now) !== key(lines),
          priceDrift:
            key(now) === key(lines) &&
            (JSON.stringify(now.map((x) => [x.serviceId, x.unitPrice, x.amount])) !==
             JSON.stringify(lines.map((x) => [x.serviceId, x.unitPrice, x.amount])) ||
             (snap?.copay?.rate ?? 0) !== rate),
        };
      })();

      return {
        kind,
        몫이름: 몫이름[kind],
        // 어느 기간을 묶은 것인가. 「달마다」가 아니면 화면에 보여 줘야
        // 「왜 8월인데 7월 11일부터인가」를 묻지 않습니다.
        periodFrom: 구간.from,
        periodTo: 구간.to,
        회차: 구간.회차,
        /*
         * 아직 안 끝난 구간은 **확정하지 않습니다.**
         * 얼마가 쌓였는지는 보여 줍니다 — 모르면 사람이 불안해합니다.
         */
        쌓이는중: !구간.끝났나 && !bill,
        lines,
        ...돈,
        billId: bill?.id ?? null,
        issuedOn: bill?.issued_on ?? null,
        paidOn: bill?.paid_on ?? null,
        receiptNo: bill?.receipt_no ?? null,
        state: !bill ? (구간.끝났나 ? "미확정" : "쌓이는중") : bill.paid_on ? "수납" : "확정",
        over: lines.some((x) => x.over),
        copayRate: bill ? (bill.copay_rate ?? 0) : rate,
        copayLabel: bill ? (snap?.copay?.label ?? "") : (tier?.label ?? "면제"),
        ...달라짐,
      };
    }).filter((x): x is NonNullable<typeof x> => !!x);

    /*
     * 사람 단위 요약.
     *
     * **총액은 「받을 돈」의 합입니다** — 지자체 몫 + 이용자 몫.
     * 몫이 갈리면 두 구간의 서비스 비용을 그냥 더할 수 없습니다(기간이 겹칩니다).
     * 반면 받을 돈은 서로 다른 주머니에서 오므로 더해도 두 번 세지 않습니다.
     * 시점이 같을 때는 이 합이 원래의 서비스 비용과 정확히 같습니다.
     */
    const 대표 = [...몫들].sort(
      (a, b) => 급한순.indexOf(a.state) - 급한순.indexOf(b.state))[0];
    const 돈있는몫 = 몫들.find((x) => x.kind !== "claim") ?? 대표;

    return {
      id: p.id,
      name: info.name ?? "",
      dong: p.dong ?? "",
      status: p.status,
      한장인가,
      몫들,
      // 아래는 **사람 단위 요약**입니다. 한 장일 때는 지금까지와 똑같은 값입니다.
      periodFrom: 대표?.periodFrom ?? "",
      periodTo: 대표?.periodTo ?? "",
      회차: 대표?.회차 ?? 1,
      쌓이는중: 몫들.some((x) => x.쌓이는중),
      copayLabel: 돈있는몫?.copayLabel ?? (tier?.label ?? "면제"),
      copayRate: 돈있는몫?.copayRate ?? rate,
      copayShort: (() => {
        const v = 돈있는몫?.copayRate ?? rate;
        return v === 0 ? "면제" : `${Math.round(v * 100)}%`;
      })(),
      lines: 대표?.lines ?? [],
      count: 대표?.count ?? 0,
      total: 몫들.reduce((s, x) => s + x.claim + x.copay, 0),
      copay: 몫들.reduce((s, x) => s + x.copay, 0),
      claim: 몫들.reduce((s, x) => s + x.claim, 0),
      billId: 대표?.billId ?? null,
      issuedOn: 대표?.issuedOn ?? null,
      paidOn: 대표?.paidOn ?? null,
      receiptNo: 대표?.receiptNo ?? null,
      state: 대표?.state ?? "미확정",
      // 생애한도를 넘긴 줄이 하나라도 있으면 사람 단위로 올려 보여 줍니다.
      over: 몫들.some((x) => x.over),
      stale: 몫들.some((x) => x.stale),
      priceDrift: 몫들.some((x) => x.priceDrift),
    };
  }).filter((x) => x.몫들.length > 0);

  const q = (opts.q ?? "").trim().toLowerCase();
  const shown = items
    .filter(
      (x) =>
        (!q || x.name.toLowerCase().includes(q)) &&
        (!opts.dong || x.dong === opts.dong) &&
        // 몫이 둘이면 **어느 한쪽이라도** 그 상태면 걸립니다.
        (!opts.state || x.몫들.some((k) => k.state === opts.state))
    )
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return {
    month: m,
    org, profile,
    rounding: r,
    items: shown,
    dongs: [...new Set(items.map((x) => x.dong).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "ko")),
    /*
     * 세는 단위가 둘입니다.
     *   사람   대상자 수
     *   몫     **손봐야 할 종이 수.** 시점이 갈린 기관에서는 한 사람에게
     *          종이가 둘이라, 「미확정 3」이 사람 셋이 아니라 종이 셋입니다.
     *          단추가 「한꺼번에 확정 (3)」이라고 할 때 셋을 확정하니 이쪽이 맞습니다.
     */
    한장인가,
    tally: (() => {
      const 몫전부 = items.flatMap((x) => x.몫들);
      const 셈 = (st: string) => 몫전부.filter((k) => k.state === st).length;
      const claim = 몫전부.reduce((s, k) => s + k.claim, 0);
      const copay = 몫전부.reduce((s, k) => s + k.copay, 0);
      /*
       * 상태 고르개는 **사람 수**를 보여 줘야 합니다 — 고르면 사람이 걸러지니까요.
       * 「한꺼번에 확정 (n)」은 **종이 수**입니다 — 그만큼을 확정하니까요.
       * 한 장인 기관에서는 둘이 같은 값이라 차이가 안 보입니다.
       */
      const 사람셈 = (st: string) =>
        items.filter((x) => x.몫들.some((k) => k.state === st)).length;
      return {
        people: items.length,
        papers: 몫전부.length,
        상태사람: {
          미확정: 사람셈("미확정"), 쌓이는중: 사람셈("쌓이는중"),
          확정: 사람셈("확정"), 수납: 사람셈("수납"),
        },
        // 받을 돈의 합. 한 장일 때는 서비스 비용과 같습니다.
        total: claim + copay,
        copay, claim,
        미확정: 셈("미확정"),
        쌓이는중: 셈("쌓이는중"),
        확정: 셈("확정"),
        수납: 셈("수납"),
        over: items.filter((x) => x.over).length,
        stale: 몫전부.filter((k) => k.stale).length,
        priceDrift: 몫전부.filter((k) => k.priceDrift).length,
      };
    })(),
  };
}

/**
 * 확정 — 지금 계산한 값을 **얼려서** 저장합니다.
 *
 * 이 순간 이후로 단가가 바뀌어도 이 청구서의 금액은 안 흔들립니다.
 * 실적을 고쳤으면 다시 확정해야 하고, 화면이 「실적이 바뀌었습니다」로 알려줍니다.
 */
export function issue(recipientId: string, m: string, who: string, kind?: 몫종류) {
  const { org, profile } = profileOf();
  const r = roundingOf(profile);
  const 시점 = 시점들();
  const 종류들 = 몫종류들(시점);

  /*
   * 어느 몫을 확정하는가.
   * 시점이 같으면 종이가 한 장뿐이라 고를 것이 없습니다.
   * 갈렸는데 안 고르고 오면 **아무거나 확정하지 않습니다** —
   * 지자체 몫을 확정한 줄 알았는데 본인부담금이 확정되면 되돌리기 어렵습니다.
   */
  const 몫: 몫종류 = kind ?? (종류들.length === 1 ? 종류들[0] : (() => {
    throw new Error(
      "지자체 청구와 본인부담금의 청구 시점이 달라 청구서가 둘로 나뉩니다. " +
      "어느 쪽을 확정할지 골라 주세요."
    );
  })());
  if (!종류들.includes(몫))
    throw new Error(`지금 설정에서는 「${몫이름[몫]}」을 따로 확정할 수 없습니다.`);

  const 구간 = 그달의구간(recipientId, m, 몫시점(시점, 몫));
  const first = 구간.from, last = 구간.to;

  /*
   * **안 끝난 구간은 확정하지 않습니다.**
   * 「일괄」인데 기간 중간에 확정해 버리면 남은 날 실적이 갈 곳을 잃습니다.
   * 「쌓이는 중」으로 두고, 끝나는 달에 통째로 확정합니다.
   */
  if (!구간.끝났나) {
    throw new Error(
      `아직 청구 기간이 끝나지 않았습니다 (${구간.from}~${구간.to}). ` +
      `끝나는 달에 확정하시면 그동안 것이 한 장으로 나옵니다.`
    );
  }

  const rec = db.query<any, [string]>("SELECT * FROM recipient WHERE id = ?").get(recipientId);
  if (!rec) throw new Error("대상자를 찾을 수 없습니다.");

  const tier = rec.copay_tier_id
    ? db.query<any, [number]>("SELECT * FROM copay_tier WHERE id = ?").get(rec.copay_tier_id)
    : null;
  const rate = tier?.rate ?? 0;

  const lines = linesOf(recipientId, m, 구간);
  if (lines.length === 0)
    throw new Error(`그 기간(${구간.from}~${구간.to})에 제공한 실적이 없습니다.`);
  // 이 종이가 **실제로 받을 돈만** 적습니다. 두 장을 더해도 두 번 세지 않게.
  const fold = 몫돈(몫, foldLines(lines, rate, r));

  // 계산에 쓴 것을 통째로. 나중에 이 값만으로 같은 종이를 다시 찍을 수 있어야 합니다.
  const snapshot = {
    확정일시: new Date().toISOString(),
    확정한사람: who,
    기관: { name: org?.name, unique_no: org?.unique_no, biz_no: org?.biz_no },
    // 이 종이가 무엇에 대한 것인가. 나중에 다시 찍을 때 제목이 됩니다.
    몫: { kind: 몫, 이름: 몫이름[몫] },
    규칙: {
      name: profile?.name,
      billing_mode: profile?.billing_mode,
      // 언제 묶어 청구하기로 한 규칙이었는지도 얼려 둡니다.
      // 나중에 설정을 바꿔도 이 종이는 그때 규칙으로 설명됩니다.
      claim_timing: 시점.claim,
      copay_timing: 시점.copay,
      구간: { from: 구간.from, to: 구간.to, 회차: 구간.회차 },
      holiday_enabled: !!profile?.holiday_enabled,
      holiday_surcharge: profile?.holiday_surcharge,
      rounding: r,
    },
    copay: { tierId: tier?.id ?? null, label: tier?.label ?? "면제", rate },
    lines,
    합계: fold,
  };

  const cur = 청구찾기(recipientId, first, last, 몫);

  const now = today();
  if (cur) {
    // 이미 수납한 것을 말없이 갈아엎지 않습니다.
    if (cur.paid_on) throw new Error("이미 수납한 청구입니다. 수납을 먼저 취소해 주세요.");
    db.run(
      `UPDATE billing SET service_amount = ?, copay_rate = ?, copay_amount = ?,
              claim_amount = ?, calc_snapshot = ?, issued_on = ?
         WHERE id = ?`,
      [fold.total, rate, fold.copay, fold.claim, JSON.stringify(snapshot), now, cur.id]
    );
    return { id: cur.id as number, again: true, kind: 몫, ...fold };
  }

  const info = db.run(
    `INSERT INTO billing
       (recipient_id, period_from, period_to, kind, service_amount, copay_rate, copay_amount,
        claim_amount, calc_snapshot, issued_on, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [recipientId, first, last, 몫, fold.total, rate, fold.copay, fold.claim,
     JSON.stringify(snapshot), now, new Date().toISOString()]
  );
  return { id: Number(info.lastInsertRowid), again: false, kind: 몫, ...fold };
}

/**
 * 그 달 전체를 한 번에 확정. 이미 수납한 것은 건너뜁니다.
 *
 * **몫 단위로 돕니다.** 시점이 갈린 기관에서는 한 사람에게 종이가 둘인데,
 * 지자체 몫은 이 달에 끝났고 본인부담금은 아직 쌓이는 중일 수 있습니다.
 * 사람 단위로 건너뛰면 확정할 수 있는 지자체 몫까지 함께 넘어갑니다.
 */
export function issueAll(m: string, who: string) {
  const d = month(m);
  let done = 0, skipped = 0;
  for (const x of d.items) {
    for (const k of x.몫들) {
      if (k.state === "수납") { skipped++; continue; }
      // 아직 안 끝난 구간은 건너뜁니다 — 끝나는 달에 통째로 확정합니다.
      if (k.state === "쌓이는중") { skipped++; continue; }
      // 단가만 바뀐 것은 건너뜁니다. 한꺼번에 다시 확정하면
      // 지난 청구 금액이 통째로 바뀝니다. 그건 한 건씩 판단할 일입니다.
      if (k.state === "확정" && !k.stale) { skipped++; continue; }
      try { issue(x.id, m, who, k.kind); done++; } catch { skipped++; }
    }
  }
  return { done, skipped };
}

/** 수납 처리 · 취소. 영수증 번호는 「연-월-순번」으로 자동으로 붙입니다. */
export function pay(billId: number, on?: string) {
  const b = db.query<any, [number]>("SELECT * FROM billing WHERE id = ?").get(billId);
  if (!b) throw new Error("그 청구를 찾을 수 없습니다.");
  if (b.paid_on) return { paidOn: b.paid_on, receiptNo: b.receipt_no };

  const day = (on ?? today()).slice(0, 10);
  const ym = day.slice(0, 7).replace("-", "");
  const seq = db.query<{ c: number }, [string]>(
    "SELECT COUNT(*) AS c FROM billing WHERE receipt_no LIKE ?"
  ).get(`${ym}-%`);
  const no = `${ym}-${String((seq?.c ?? 0) + 1).padStart(4, "0")}`;

  db.run("UPDATE billing SET paid_on = ?, receipt_no = ? WHERE id = ?", [day, no, billId]);
  return { paidOn: day, receiptNo: no };
}

export function unpay(billId: number) {
  db.run("UPDATE billing SET paid_on = NULL WHERE id = ?", [billId]);
  return { ok: true };
}

/** 확정 취소 — 수납 전에만. */
export function cancel(billId: number) {
  const b = db.query<any, [number]>("SELECT * FROM billing WHERE id = ?").get(billId);
  if (!b) throw new Error("그 청구를 찾을 수 없습니다.");
  if (b.paid_on) throw new Error("이미 수납한 청구입니다. 수납을 먼저 취소해 주세요.");
  db.run("DELETE FROM billing WHERE id = ?", [billId]);
  return { ok: true };
}

/** 청구서·영수증에 쓸 한 건. 확정한 것이면 **얼린 값**으로 돌려줍니다. */
export function one(recipientId: string, m: string) {
  const 시점 = 시점들();
  /*
   * 이것은 **어르신께 드리는 본인부담금 청구서**입니다.
   * 그러니 기간은 **본인부담금의 시점**으로 잡아야 합니다.
   * 지자체 청구 시점으로 잡으면, 두 시점이 다른 기관에서
   * **엉뚱한 기간이 찍힌 종이가 어르신께 갑니다.**
   */
  const 몫: 몫종류 = 몫종류들(시점).includes("both") ? "both" : "copay";
  const 구간 = 그달의구간(recipientId, m, 시점.copay);
  const first = 구간.from, last = 구간.to;
  const bill = 청구찾기(recipientId, first, last, 몫);
  const snap = bill?.calc_snapshot ? JSON.parse(bill.calc_snapshot) : null;

  const rec = db.query<any, [string]>("SELECT * FROM recipient WHERE id = ?").get(recipientId);
  const info = JSON.parse(rec?.payload || "{}");
  const { org, profile } = profileOf();
  const tier = rec?.copay_tier_id
    ? db.query<any, [number]>("SELECT * FROM copay_tier WHERE id = ?").get(rec.copay_tier_id)
    : null;
  const rate = snap?.copay?.rate ?? tier?.rate ?? 0;
  const lines: Line[] = snap?.lines ?? linesOf(recipientId, m, 구간);
  const fold = snap?.합계 ?? 몫돈(몫, foldLines(lines, rate, roundingOf(profile)));

  /*
   * 주의 — `fold` 안에 `copay`(본인부담 **금액**)가 들어 있습니다.
   * 예전에는 여기서 `copay: { label, rate }` 를 먼저 쓰고 뒤에 `...fold` 를 폈는데,
   * 뒤에 편 것이 앞의 것을 **소리 없이 덮어써서** 부담률·구간이름이 사라졌습니다.
   * 청구서에 「undefined (NaN%)」 가 찍히고 나서야 알았습니다.
   * 그래서 이름을 갈라 둡니다 — `copay` 는 금액, `copayTier` 는 구간(이름·비율).
   */
  return {
    month: m, from: first, to: last,
    recipient: { id: recipientId, ...info, dong: rec?.dong ?? "" },
    org, profile,
    lines, ...fold,
    copayTier: { label: snap?.copay?.label ?? tier?.label ?? "면제", rate },
    frozen: !!snap,
    bill: bill ? {
      id: bill.id, issuedOn: bill.issued_on, paidOn: bill.paid_on, receiptNo: bill.receipt_no,
    } : null,
  };
}
