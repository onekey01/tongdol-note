import type { Database } from "bun:sqlite";

/**
 * 「복지부 지침 표준」 프로필을 심습니다.
 *
 * 근거 : 2026년 의료·요양 통합돌봄 사업 안내
 *        - 서비스 비용(예시) 및 본인부담률 표
 *        - "평일 오전 9:00~18:00 외에 토·일·공휴일에 서비스가 진행된 경우 50% 할증"
 *
 * 할증은 지침에 있으나 예산 문제로 실제 발생이 극히 어렵다는 현장 판단에 따라
 * holiday_enabled = 0 (꺼둠) 으로 시작합니다. 설정에서 켤 수 있습니다.
 */

type Svc = {
  code: string;
  cat_l: string;
  cat_m: string;
  cat_s: string;
  name: string;
  unit: "hour" | "meal" | "time";
  unit_price: number;
  holiday_price: number | null;
  record_type: "time" | "work" | "meal";
  lifetime_cap: number | null;
  /**
   * 월 한도 — **편람 값입니다. 지침에는 없습니다.**
   * 그래서 「복지부 지침 표준」에는 안 심고 **우리 지자체 규칙에만** 넣습니다.
   * 0 은 「한도를 안 봅니다」. 동행지원은 **둘 다** 걸립니다.
   */
  월한도분?: number;
  월한도횟수?: number;
};

/*
 * ── 여기 적힌 단가는 **시작값입니다** (2026-08-31 편람 반영) ────────
 *
 * 근거는 「2026년 해남군 통합돌봄 서비스 제공기관 업무편람」의
 * **서비스별 내용에 명시된 단가**입니다.
 * 편람의 **서식 안에 적힌 단가는 예시**라 보고 따르지 않습니다.
 *
 * 지역마다 다를 수 있으므로 코드에 못박지 않고, 기관이
 * **설정 → 서비스에서 고쳐 씁니다.** 처음 심을 때만 쓰는 값입니다.
 *
 * 휴일 단가는 편람·지침 어디에도 근거가 없어 **전부 비워 둡니다**
 * (이미용·안전생활환경개선은 「할증비용 없음」이라고 못박혀 있습니다).
 * 방문목욕은 해남군 통합돌봄에 **해당 없음** — 뺐습니다.
 */
const SERVICES: Svc[] = [
  {
    code: "DL-HOUSE", cat_l: "일상생활돌봄", cat_m: "가사지원", cat_s: "청소·빨래·식사준비",
    name: "가사지원", unit: "hour", unit_price: 24000, holiday_price: null,
    record_type: "time", lifetime_cap: null,
    월한도분: 720,        // 월 12시간
  },
  {
    code: "DL-MEAL", cat_l: "일상생활돌봄", cat_m: "식사지원", cat_s: "도시락배달지원",
    name: "식사지원", unit: "meal", unit_price: 11000, holiday_price: null,
    record_type: "meal", lifetime_cap: null,
    월한도횟수: 8,        // 월 8회
  },
  {
    code: "DL-MOVE", cat_l: "일상생활돌봄", cat_m: "이동지원", cat_s: "외출동행",
    name: "동행지원", unit: "hour", unit_price: 27000, holiday_price: null,
    record_type: "time", lifetime_cap: null,
    월한도분: 360, 월한도횟수: 2,   // 월 6시간 **그리고** 월 2회 — 둘 다 걸립니다
  },
  {
    code: "DL-HAIR", cat_l: "일상생활돌봄", cat_m: "방문이미용", cat_s: "이미용서비스 제공",
    name: "이미용서비스", unit: "time", unit_price: 24000, holiday_price: null,
    record_type: "time", lifetime_cap: null,
    월한도횟수: 1,        // 월 1회
  },
  {
    code: "HO-SAFE", cat_l: "주거복지", cat_m: "주거공간개선", cat_s: "주거안전지원",
    name: "안전생활환경개선", unit: "time", unit_price: 0, holiday_price: null,
    record_type: "work", lifetime_cap: 1000000, // 1인 생애 100만원 한도 (편람)
  },
];

const TIERS = [
  { label: "면제 (기초생활수급자·차상위계층)", rate: 0.0 },
  { label: "본인부담금 20%", rate: 0.2 },
  { label: "본인부담금 100% (일반)", rate: 1.0 },
];

type Rule = {
  name: string;
  billing_mode: "prepaid" | "postpaid";
  rounding_unit: number;
  rounding_mode: "round" | "ceil" | "floor";
  is_builtin: 0 | 1;
  note: string;
};

const PROFILES: Rule[] = [
  {
    /*
     * ── 지침에 **없는** 것을 지침이라고 하면 안 됩니다 (2026-08-28 바로잡음) ──
     *
     * 「복지부 지침 표준」이라는 이름 아래 청구 방식(후납)과 반올림(10원)을
     * 넣어 두었는데, **지침에는 그런 말이 없습니다.**
     * 2026년 의료·요양 통합돌봄 사업 안내 381쪽을 뒤져 보니 —
     *
     *   「절삭」   0번
     *   「반올림」 0번
     *   「원 단위」0번
     *   「선납」   0번
     *   「후납」   0번
     *
     * 지침이 정하는 것은 **본인부담률**입니다(일반 30% · 중증재택 15% ·
     * 의료급여 5% 등, 서비스마다 다름). 그리고 그 외 소득구간은
     * **「광역지자체별로 본인부담률을 차등 설정하도록 함」**(150쪽),
     * 사업 세부내역은 **「지자체가 자율적으로 설계·집행」**(47쪽)입니다.
     *
     * 그러니 청구 방식과 절삭은 **지침이 정하지 않은 것**이고,
     * 여기 적힌 값은 기준선이 아니라 **그저 시작값**입니다.
     * 화면에서도 그렇게 밝힙니다 — 헷갈리면 기준이 무너집니다.
     */
    name: "복지부 지침 표준",
    billing_mode: "postpaid", rounding_unit: 10, rounding_mode: "round",
    is_builtin: 1,
    note: "2026년 의료·요양 통합돌봄 사업 안내. 지침이 정하는 것은 서비스별 본인부담률이며, " +
          "청구 시점·절삭 방식은 지침에 없습니다(지자체 자율). 기준선이라 수정 잠금.",
  },
  {
    /*
     * 우리 지자체 규칙 — **이름에 특정 지자체를 박지 않습니다.**
     *
     * 처음에 「해남군」이라고 넣어 두었다가 걷어냈습니다.
     * 파일럿을 해남에서 하는 것일 뿐, **프로그램은 어느 지자체에나 들어갑니다.**
     * 강진군 기관이 설치했는데 설정에 「해남군」이라고 적혀 있으면
     * 그건 남의 프로그램을 빌려 쓰는 느낌이고, 실제로 팔리지 않습니다.
     *
     * 기관이 설정에서 **자기 지자체 이름으로 바꿔 씁니다.**
     * 기본값은 지침 표준과 같게 두어, 고치기 전에는 다르게 셈하지 않습니다.
     */
    name: "우리 지자체 규칙",
    billing_mode: "postpaid", rounding_unit: 10, rounding_mode: "round",
    is_builtin: 0,
    note: "우리 지자체가 지침과 다르게 정한 것을 여기에 적습니다. " +
          "예) 예산 집행 시 100원 단위 절삭 · 자부담 후납 · 영수증 미발행. " +
          "이름은 설정에서 자기 지자체 이름으로 바꿔 쓰시면 됩니다.",
  },
];

export function seedBuiltinProfile(db: Database): number {
  // 지침 표준은 언제나 있어야 합니다. 견줄 기준선이니까요.
  const firstId = seedProfile(db, PROFILES[0]);

  /*
   * 우리 지자체 규칙은 **아직 하나도 없을 때만** 만듭니다.
   *
   * 이름으로 찾아 없으면 만드는 식이었더니, 이름을 바꿔 둔 기관에
   * 프로그램을 새로 올릴 때마다 **빈 규칙이 하나씩 더 생겼습니다.**
   * 기관이 이미 자기 규칙을 만들어 두었으면 그것이 그 기관의 것입니다 —
   * 건드리지 않습니다.
   */
  const 이미있나 = db
    .query<{ id: number }, []>("SELECT id FROM region_profile WHERE is_builtin = 0 LIMIT 1")
    .get();
  if (!이미있나) seedProfile(db, PROFILES[1]);

  return firstId;
}

function seedProfile(db: Database, rule: Rule): number {
  const existing = db
    .query<{ id: number }, [string]>("SELECT id FROM region_profile WHERE name = ?")
    .get(rule.name);
  if (existing) return existing.id;

  const now = new Date().toISOString();

  const info = db.run(
    `INSERT INTO region_profile
       (name, billing_mode, holiday_enabled, holiday_surcharge,
        rounding_unit, rounding_mode, report_cycle_days, is_builtin, created_at)
     VALUES (?, ?, 0, 1.5, ?, ?, 30, ?, ?)`,
    [rule.name, rule.billing_mode, rule.rounding_unit, rule.rounding_mode,
     rule.is_builtin, now]
  );
  const profileId = Number(info.lastInsertRowid);

  const insSvc = db.prepare(
    `INSERT INTO service
       (profile_id, code, cat_l, cat_m, cat_s, name, unit,
        unit_price, holiday_price, record_type, lifetime_cap,
        outside_annual_cap, monthly_cap_minutes, monthly_cap_count,
        noshow_billable, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  /*
   * ── 한도는 「우리 지자체 규칙」에만 ──────────────────────────
   *
   * 월 12시간·월 8회 같은 숫자는 **해남군 편람** 값이고
   * 2026년 의료·요양 통합돌봄 사업안내에는 없습니다.
   * 기준선(지침 표준)에 넣으면 **지침에 없는 것을 지침이라고 적는 것**이라,
   * 청구 시점·절삭 방식에서 한 번 그랬다가 바로잡은 그 잘못을 되풀이합니다.
   */
  const 한도넣나 = !rule.is_builtin;
  SERVICES.forEach((s, i) => {
    insSvc.run(
      profileId, s.code, s.cat_l, s.cat_m, s.cat_s, s.name, s.unit,
      s.unit_price, s.holiday_price, s.record_type, s.lifetime_cap,
      // 「연간 한도 바깥인가」는 **분류**라 어느 규칙에서나 같습니다.
      s.lifetime_cap != null ? 1 : 0,
      한도넣나 ? (s.월한도분 ?? 0) : 0,
      한도넣나 ? (s.월한도횟수 ?? 0) : 0,
      /*
       * 노쇼를 비용으로 잡나 — **어디서나 꺼짐**으로 심습니다 (2026-09-01).
       * 해남 현장은 안 씁니다: 가사·동행·이미용은 이용자 사정이면
       * **일정을 사전 조율**해 다시 잡고, 식사는 「대면/비대면」이 그 자리입니다.
       * 켜서 쓰는 지자체가 있으면 설정에서 켭니다.
       */
      0,
      i
    );
  });

  const insTier = db.prepare(
    "INSERT INTO copay_tier (profile_id, label, rate, sort_order) VALUES (?, ?, ?, ?)"
  );
  TIERS.forEach((t, i) => insTier.run(profileId, t.label, t.rate, i));

  return profileId;
}
