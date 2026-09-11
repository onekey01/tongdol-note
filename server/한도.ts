/**
 * ── 한 사람이 올해 얼마를 썼나 ─────────────────────────────────
 *
 * 편람: **1인당 연간 150만원.**
 * **안전생활환경개선은 이 한도 바깥**이고, 따로 **생애 100만원**입니다.
 *
 * ── 왜 이것부터 만드나 ────────────────────────────────────────
 * 계약서(서식2) 4조가 어르신께 이렇게 약속합니다 —
 *
 *   「이용자가 사전 취소 없이 … 서비스를 이용하지 않으셨더라도 비용이
 *    지출되며, **1인당 연간 지원한도액에서 차감됩니다.**」
 *
 * 그 종이를 내보내면서 우리 안에 한도가 없으면, 어르신이 「얼마나
 * 남았어요」라고 물었을 때 **답할 데가 없습니다.**
 *
 * ── 막지 않습니다. 알려만 줍니다 ──────────────────────────────
 * 넘겼다고 저장을 막지 않습니다. 군과 협의해 넘길 여지가 있고,
 * 우리가 군보다 앞서 판단하면 **현장이 프로그램과 싸우게 됩니다.**
 * 우리 일은 「지금 이 상태」를 정확히 보여 주는 데까지입니다.
 *
 * ── 얼린 단가를 씁니다 ────────────────────────────────────────
 * 확정된 청구가 있는 구간은 그때 **얼린 단가**(`calc_snapshot`)로 셉니다.
 * 그래야 설정에서 단가를 고쳐도 **지난 몫이 흔들리지 않습니다.**
 * 확정 안 된 구간만 지금 단가로 셉니다 — 그건 아직 바뀔 수 있는 숫자입니다.
 *
 * ── 노쇼도 깎입니다 (7-아 · A-3 에서 꽂았습니다) ──────────────
 * 계약서 4조대로 **노쇼는 한도에서 깎입니다.**
 * 열어 두었던 `한도에드나()` 한 곳을 고치니 청구서·연간한도·월한도가
 * 한꺼번에 따라왔습니다. 갈래의 뜻은 `미제공.ts` 한 곳이 정합니다.
 */
import { db } from "./db";
import { 인정분, 셈규칙읽기 } from "./money";
import { 갈래읽기, 돈이드나, 돈드는실적SQL } from "./미제공";
/*
 * ★ 30분 환산과 하루 상한은 **billing.실적줄들() 한 곳**이 합니다.
 *   청구서·비용총괄·한도가 다 같은 줄을 봐야 세 화면이 같은 금액을
 *   말합니다. (`billing → record → 한도` 로 서로 부르지만, 셋 다
 *   `function` 선언이라 부를 때 이미 이어져 있습니다.)
 */
import { 실적줄들 } from "./billing";

export type 한도줄 = {
  serviceId: number;
  name: string;
  건수: number;
  금액: number;
  바깥: boolean;      // 연간 한도 바깥(안전생활환경개선)인가
  얼렸나: boolean;    // 확정된 청구의 얼린 단가로 셌는가
};

export type 한도칸 = {
  쓴돈: number; 한도: number; 남은돈: number; 비율: number;
  넘었나: boolean;
  /** 한도가 정해져 있나. 0 이면 「한도를 안 봅니다」라는 뜻입니다. */
  봄: boolean;
};

export type 한도현황 = {
  해: number;
  일상: 한도칸;
  주거: 한도칸;
  줄: 한도줄[];
  얼린구간: number;   // 얼린 단가로 센 구간이 몇 개인가 (설명용)
};

/**
 * 설정에 적힌 한도. 지역마다 다를 수 있어 코드에 안 박습니다.
 *
 * **0 이면 「한도를 안 봅니다」**입니다.
 * 「복지부 지침 표준」 규칙이 그렇습니다 — 150만원은 **해남군 편람**의 값이지
 * 지침에 있는 것이 아니라, 기준선에 그 숫자를 박아 두지 않았습니다.
 * 편람 값은 **「우리 지자체 규칙」**에 들어 있습니다.
 */
export function 한도설정(): { 연간: number; 주거: number } {
  const p = db.query<any, []>(
    `SELECT rp.annual_cap, rp.housing_cap
       FROM region_profile rp
       JOIN organization o ON o.profile_id = rp.id
      WHERE o.id = 1`
  ).get();
  return {
    연간: Number(p?.annual_cap ?? 1_500_000),
    주거: Number(p?.housing_cap ?? 1_000_000),
  };
}

/**
 * 이 실적이 한도에 드나. **온 프로그램이 이것 하나를 봅니다.**
 *
 *   제공             → 듭니다
 *   미제공 · 노쇼    → **듭니다** (계약서 4조 — 사전 취소 없이 이용 안 하심)
 *   미제공 · 그 밖   → 안 듭니다 (사전취소 · 기관사정 · 기타)
 *
 * 갈래가 비어 있는 **옛 미제공은 「기타」**라 안 듭니다 —
 * 지금까지와 똑같이 셈해야 지난 청구서가 안 흔들립니다.
 */
export function 한도에드나(outcome: string, missKind?: string | null): boolean {
  if (outcome === "제공") return true;
  if (outcome === "미제공") return 돈이드나(갈래읽기(missKind));
  return false;
}

/** 확정된 청구에서 얼린 단가를 꺼내 옵니다. 구간별로 서비스마다. */
type 얼린구간 = {
  from: string; to: string;
  단가: Map<number, { 평일: number; 휴일: number | null }>;
};
function 얼린단가들(recipientId: string): 얼린구간[] {
  const rows = db.query<any, [string]>(
    `SELECT period_from, period_to, calc_snapshot
       FROM billing
      WHERE recipient_id = ? AND calc_snapshot IS NOT NULL
      ORDER BY period_from`
  ).all(recipientId);

  const 낸것: 얼린구간[] = [];
  const 본구간 = new Set<string>();
  for (const b of rows) {
    /*
     * 청구 시점이 갈린 기관은 한 구간에 종이가 둘입니다(지자체 몫·이용자 몫).
     * **단가는 둘이 같으므로** 먼저 나온 것 하나만 씁니다.
     */
    const key = `${b.period_from}~${b.period_to}`;
    if (본구간.has(key)) continue;
    본구간.add(key);

    let snap: any = null;
    try { snap = JSON.parse(b.calc_snapshot); } catch { continue; }
    if (!Array.isArray(snap?.lines)) continue;

    const 단가 = new Map<number, { 평일: number; 휴일: number | null }>();
    for (const l of snap.lines) {
      if (typeof l?.serviceId !== "number") continue;
      단가.set(l.serviceId, {
        평일: Number(l.unitPrice ?? 0),
        휴일: l.holidayPrice == null ? null : Number(l.holidayPrice),
      });
    }
    if (단가.size) 낸것.push({ from: b.period_from, to: b.period_to, 단가 });
  }
  return 낸것;
}

/**
 * 한 사람이 그 해에 쓴 돈.
 *
 * 실적을 **한 줄씩** 보고 단가를 붙입니다. 구간 총액을 나눠 쓰지 않는 이유는,
 * 확정 구간이 **해를 넘길 수 있기** 때문입니다(일괄 청구·시작일 기준 청구).
 * 한 줄씩 보면 12월 31일과 1월 1일이 저절로 갈라집니다.
 */
export function 연간쓴돈(recipientId: string, 해: number): 한도현황 {
  const 설정 = 한도설정();
  const 처음 = `${해}-01-01`, 마지막 = `${해}-12-31`;

  /*
   * ═══════════════════════════════════════════════════════════
   *  ★ 2026-09-05 바로잡음 — **시간을 안 세고 있었습니다** ★
   * ═══════════════════════════════════════════════════════════
   *
   * 여기서 실적을 한 줄씩 세면서 **한 건에 단가를 한 번씩** 더했습니다.
   * 그래서 세 시간 다녀온 것도 **한 시간 값**으로 셌습니다.
   *
   * 시범자료로 재어 보니 —
   *   정산 화면    3,096,000원
   *   한도 화면    1,032,000원    ← 같은 사람, 같은 실적
   *
   * 연간 150만원을 이미 두 배 넘겼는데 화면은 「69% 썼습니다」라고
   * 말하고 있었습니다. **넘긴 줄 모르고 계속 내보내면 그 돈은 기관이
   * 떠안습니다.** 한도를 알려 주는 화면이 한도를 낮춰 부르면
   * 없느니만 못합니다.
   *
   * ── 왜 여기서 다시 안 세나 ────────────────────────────────
   *
   * 30분 환산과 하루 상한은 `billing.실적줄들()` 이 이미 합니다.
   * 청구서와 비용총괄(서식8)이 **둘 다 그것을 봅니다.** 여기에 같은
   * 셈을 또 적으면 언젠가 한쪽만 고쳐집니다 — 지금 난 일이 그것입니다.
   * 그래서 **빌려 씁니다.** 단가만 여기서 갈아 끼웁니다 — 확정된
   * 구간은 얼린 단가를 써야 지난 청구서가 안 흔들리기 때문입니다.
   */
  const 곁 = new Map<number, any>(
    (db.query<any, []>(
      "SELECT id, outside_annual_cap FROM service").all() as any[])
      .map((s) => [s.id, s]));

  const rows = 실적줄들(recipientId, 처음, 마지막).map((r) => ({
    service_id: r.service_id,
    served_on: r.served_on,
    is_holiday: r.is_holiday,
    outcome: r.outcome,
    /* 실적줄들 이 이미 「돈 드는 것」만 걸러 왔습니다. */
    miss_kind: null as string | null,
    name: r.name,
    unit_price: r.unit_price,
    holiday_price: r.holiday_price,
    outside_annual_cap: 곁.get(r.service_id)?.outside_annual_cap ?? 0,
    sort_order: r.sort_order,
    /** 30분 환산·하루 상한까지 끝난 분. 시간제가 아니면 60 (한 번 = 한 시간). */
    인정분: r.인정분,
  }));

  const 얼린 = 얼린단가들(recipientId);
  const 휴일씀 = !!db.query<any, []>(
    `SELECT rp.holiday_enabled FROM region_profile rp
       JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`
  ).get()?.holiday_enabled;

  const 모음 = new Map<number, 한도줄>();
  const 쓴구간 = new Set<string>();

  for (const r of rows) {
    const 구간 = 얼린.find((c) => r.served_on >= c.from && r.served_on <= c.to);
    const 얼린값 = 구간?.단가.get(r.service_id);
    if (구간 && 얼린값) 쓴구간.add(`${구간.from}~${구간.to}`);

    const 평일가 = 얼린값 ? 얼린값.평일 : Number(r.unit_price ?? 0);
    const 휴일가 = 얼린값
      ? (얼린값.휴일 ?? 평일가)
      : Number(r.holiday_price ?? r.unit_price ?? 0);
    // 휴일 할증을 안 쓰는 기관이면 휴일도 평일 단가입니다 (billing.ts 와 같은 규칙).
    const 단가 = r.is_holiday && 휴일씀 ? 휴일가 : 평일가;
    /*
     * ★ **시간을 곱합니다.** billing.ts 의 `단가 × 인정분/60` 과 같은 줄입니다.
     *   두 시간 다녀왔으면 두 시간 값이 한도에서 깎여야 합니다.
     */
    const 값 = Math.round(단가 * (r.인정분 / 60));

    let 줄 = 모음.get(r.service_id);
    if (!줄) {
      줄 = {
        serviceId: r.service_id, name: r.name, 건수: 0, 금액: 0,
        바깥: !!r.outside_annual_cap, 얼렸나: false,
      };
      모음.set(r.service_id, 줄);
    }
    줄.건수 += 1;
    줄.금액 += 값;
    if (얼린값) 줄.얼렸나 = true;
  }

  const 줄 = [...모음.values()];
  const 일상쓴돈 = 줄.filter((x) => !x.바깥).reduce((s, x) => s + x.금액, 0);

  /*
   * 주거는 **연간이 아니라 생애**입니다. 그래서 그 해만 보지 않고
   * 처음부터 전부 셉니다. 여기서만 셈의 범위가 다릅니다.
   */
  const 주거쓴돈 = 실적줄들(recipientId, "1900-01-01", "9999-12-31", { 연간바깥만: true })
    .reduce((s, r) => s + Math.round(Number(r.unit_price ?? 0) * (r.인정분 / 60)), 0);

  /*
   * 한도가 0 이면 **아무 말도 하지 않습니다.**
   * 「0원 한도를 넘겼습니다」는 겁만 주고 아무 뜻도 없는 말입니다.
   */
  /*
   * ── ★ 한도를 **무엇으로** 재나 (2026-09-07 무무) ★ ──────────
   *
   * 「총 서비스 비용으로 재고 설정에서 바꿀 수 있도록 하자.」
   *
   * 편람은 「1인 연간 지원한도 150만원」이라고만 적어 두었지, 그 150만원이
   * **총 서비스 비용**인지 본인부담금을 뺀 **군 부담액**인지는 안 적어
   * 두었습니다. 이 답에 따라 「넘었다」가 갈립니다 — 본인부담 20%
   * 구간이면 두 셈이 25% 차이가 납니다.
   *
   * ★ **여기 한 곳에서 갈라야 합니다.** 홈의 한도 경고 · 대상자 화면의
   *   남은 한도 · 계획을 미리 재는 줄이 전부 이 함수를 봅니다.
   *   한 군데만 다르게 세면 화면마다 다른 숫자가 나옵니다.
   *
   * 기본은 `total` — 지금까지와 똑같습니다. 설정을 안 건드린 기관의
   * 숫자가 이 버전에서 흔들리면 안 됩니다.
   */
  const 기준 = String(
    (db.query<any, []>(
      `SELECT rp.cap_basis FROM region_profile rp
         JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`
    ).get()?.cap_basis) ?? "total");

  let 부담률 = 0;
  if (기준 === "claim") {
    const rec = db.query<any, [string]>(
      "SELECT copay_tier_id FROM recipient WHERE id = ?").get(recipientId);
    const tier = rec?.copay_tier_id
      ? db.query<any, [number]>("SELECT rate FROM copay_tier WHERE id = ?").get(rec.copay_tier_id)
      : null;
    부담률 = Number(tier?.rate ?? 0);
  }
  /** 한도에 견줄 금액 — 기준이 「군 부담액」이면 본인부담을 뺍니다. */
  const 견줄돈 = (총액: number) =>
    기준 === "claim" ? Math.round(총액 * (1 - 부담률)) : Math.round(총액);

  const 칸 = (총액: number, 한도: number): 한도칸 => {
    const 봄 = 한도 > 0;
    const 쓴돈 = 견줄돈(총액);
    return {
      쓴돈, 한도,
      남은돈: 봄 ? 한도 - 쓴돈 : 0,
      비율: 봄 ? 쓴돈 / 한도 : 0,
      넘었나: 봄 && 쓴돈 > 한도,
      봄,
    };
  };

  return {
    해,
    일상: 칸(일상쓴돈, 설정.연간),
    주거: 칸(주거쓴돈, 설정.주거),
    줄,
    얼린구간: 쓴구간.size,
  };
}

/**
 * 한도가 다 되어 가는 사람들 — 홈에 띄웁니다.
 *
 * **넘긴 뒤에 알면 이미 나간 돈입니다.** 그래서 넘기기 전에 보여 줍니다.
 * 기본은 90% 이며, 넘긴 사람은 언제나 함께 나옵니다.
 */
export function 한도임박(해: number, 기준 = 0.9) {
  const ids = db.query<{ id: string }, [string, string]>(
    `SELECT DISTINCT r.id
       FROM recipient r JOIN delivery d ON d.recipient_id = r.id
      WHERE d.served_on >= ? AND d.served_on <= ? AND ${돈드는실적SQL}`
  ).all(`${해}-01-01`, `${해}-12-31`).map((x) => x.id);

  const 나온것: any[] = [];
  for (const id of ids) {
    const h = 연간쓴돈(id, 해);
    const 볼것 =
      h.일상.비율 >= 기준 || h.일상.넘었나 ||
      h.주거.비율 >= 기준 || h.주거.넘었나;
    if (!볼것) continue;
    const rec = db.query<any, [string]>(
      "SELECT payload, dong, status FROM recipient WHERE id = ?").get(id);
    const p = JSON.parse(rec?.payload || "{}");
    나온것.push({
      id, name: p.name ?? "", dong: rec?.dong ?? "", status: rec?.status ?? "",
      일상: h.일상, 주거: h.주거,
    });
  }
  // 많이 쓴 사람부터. 넘긴 사람이 맨 위로 옵니다.
  return 나온것.sort((a, b) => b.일상.비율 - a.일상.비율);
}

/* ═════════════════════════════════════════════════════════════
 * 서비스별 **월 한도** — A-2 (7-사)
 *
 * 편람: 가사 월 12시간 · 식사 월 8회 · 동행 월 6시간**과** 2회 · 이미용 월 1회.
 *
 * ── 연간 한도와 다른 점 ──────────────────────────────────────
 * 연간 한도는 **돈**이고, 월 한도는 **시간과 횟수**입니다.
 * 그래서 단가를 안 봅니다 — 단가를 고쳐도 이 숫자는 안 흔들립니다.
 *
 * ── 왜 칸이 둘인가 ──────────────────────────────────────────
 * 동행지원은 **월 6시간 그리고 월 2회**입니다. 6시간을 안 넘겨도
 * 세 번째 방문은 안 됩니다. 한 칸으로 겸할 수 없습니다.
 *
 * ── 여기서도 막지 않습니다 ──────────────────────────────────
 * 넘겨도 저장은 됩니다. 알려만 줍니다 — 연간 한도와 같은 이유입니다.
 * ═════════════════════════════════════════════════════════════ */

export type 월한도줄 = {
  serviceId: number;
  name: string;
  unit: string;
  /** 그 달에 실제로 있었던 분 (시간제만) */
  쓴분: number;
  /** 편람 규칙으로 **인정된** 분. 한도는 이것으로 잽니다 */
  인정분합: number;
  쓴횟수: number;
  한도분: number;      // 0 이면 안 봄
  한도횟수: number;    // 0 이면 안 봄
  분넘었나: boolean;
  횟수넘었나: boolean;
  넘었나: boolean;     // 둘 중 하나라도
  봄: boolean;         // 한도가 하나라도 정해져 있나
};

/**
 * 한 사람의 **그 달** 서비스별 사용량.
 *
 * 시간제에서 분을 안 적은 실적은 **한 번 = 한 시간**으로 봅니다 —
 * 정산이 그렇게 세므로 여기서 다르게 세면 두 화면이 다른 말을 합니다.
 */
export function 월사용(recipientId: string, month: string): 월한도줄[] {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("달을 YYYY-MM 으로 주세요.");
  const 처음 = `${month}-01`, 마지막 = `${month}-31`;

  const rows = db.query<any, [string, string, string]>(
    `SELECT d.service_id, d.minutes, d.outcome, d.miss_kind,
            sv.name, sv.unit, sv.monthly_cap_minutes, sv.monthly_cap_count, sv.sort_order,
            sv.round_unit, sv.round_half
       FROM delivery d JOIN service sv ON sv.id = d.service_id
      WHERE d.recipient_id = ? AND d.served_on >= ? AND d.served_on <= ?
      ORDER BY sv.sort_order, sv.name`
  ).all(recipientId, 처음, 마지막);

  const 모음 = new Map<number, 월한도줄>();
  for (const r of rows) {
    /*
     * **노쇼도 셉니다** (A-3). 돈이 나갔으면 그 달 몫을 쓴 것입니다.
     * 청구서는 나갔는데 월 한도만 안 줄어들면 두 화면이 다른 말을 합니다.
     * 노쇼는 안 간 것이라 분이 없으니 **한 번 = 한 시간**입니다.
     */
    if (!한도에드나(r.outcome, r.miss_kind)) continue;

    let x = 모음.get(r.service_id);
    if (!x) {
      x = {
        serviceId: r.service_id, name: r.name, unit: r.unit,
        쓴분: 0, 인정분합: 0, 쓴횟수: 0,
        한도분: Number(r.monthly_cap_minutes ?? 0),
        한도횟수: Number(r.monthly_cap_count ?? 0),
        분넘었나: false, 횟수넘었나: false, 넘었나: false, 봄: false,
      };
      모음.set(r.service_id, x);
    }
    x.쓴횟수 += 1;
    if (r.unit === "hour") {
      const 잰것 = r.minutes == null ? 60 : Math.max(0, Math.floor(Number(r.minutes)));
      x.쓴분 += 잰것;
      x.인정분합 += r.minutes == null ? 60 : 인정분(잰것, 셈규칙읽기(r));
    }
  }

  for (const x of 모음.values()) {
    x.분넘었나 = x.한도분 > 0 && x.인정분합 > x.한도분;
    x.횟수넘었나 = x.한도횟수 > 0 && x.쓴횟수 > x.한도횟수;
    x.넘었나 = x.분넘었나 || x.횟수넘었나;
    x.봄 = x.한도분 > 0 || x.한도횟수 > 0;
  }
  return [...모음.values()];
}

/** 「12시간」·「30분」처럼 사람이 읽는 말로. */
export function 시간말(분: number): string {
  const m = Math.max(0, Math.round(분));
  const h = Math.floor(m / 60), 나머지 = m % 60;
  if (h && 나머지) return `${h}시간 ${나머지}분`;
  if (h) return `${h}시간`;
  return `${나머지}분`;
}
