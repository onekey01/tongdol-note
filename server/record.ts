import { db } from "./db";
import { today, parseSlots, DOW_KO, 분재기 } from "./util";
import { 인정분, 셈규칙읽기 } from "./money";
import { 지금목록, 버전목록 } from "./확인사항";
import { 월사용 } from "./한도";
import { 갈래읽기, 기본갈래, 늦게알렸나 } from "./미제공";
import { 그날가나, 달몇번 } from "./가는날";
import { 대면원칙인가, 대면이었나, 비대면다시셈 } from "./대면배달";
import { 서식갈래, 서식이름 } from "./서식갈래";
import { addSticky } from "./sticky";

/**
 * 제공실적 — 그날 갔는가, 못 갔는가.
 *
 * ── 왜 계획을 먼저 깔아 두는가 ─────────────────────────────
 * 빈 종이에 「누가 · 언제 · 무엇을」을 매번 적게 하면 아무도 안 씁니다.
 * 배정에 이미 「화·목」이 들어 있으니, 그 달의 화요일과 목요일을
 * **미리 칸으로 깔아 두고 눌러서 확인만** 하게 합니다.
 *
 *   계획      ○   아직 처리 안 함
 *   제공      ●   갔다
 *   미제공    ✕   못 갔다 (사유를 받습니다)
 *
 * ── 요일은 안내, 셈은 횟수 ─────────────────────────────────
 * 지자체가 정한 것은 **횟수**입니다 — 「주 2회」. 화·목은 그것을 어디에
 * 놓을지 정한 **안내**일 뿐입니다. 그래서 수·목에 다녀왔어도 그 주는
 * 채운 것이고, 화면에도 그냥 「제공」으로 나옵니다.
 *
 * ── 못 간 날을 왜 남기는가 ─────────────────────────────────
 * 「갔다」만 쌓으면 계획 대비 실적이 안 나옵니다.
 * 지자체가 「주 2회인데 왜 6회뿐입니까」라고 물었을 때,
 * **못 간 날과 그 사유가 남아 있어야** 답이 됩니다.
 * 없으면 기관이 일을 안 한 것이 됩니다.
 */

export const REASONS = ["부재", "거부", "입원", "본인요청", "기관사정", "기상·재해", "기타"];

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-08" → 그 달의 모든 날짜. */
export function daysOf(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`);
}

export function dowOf(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * 그날이 휴일인가 — **토·일, 그리고 기관이 적어 넣은 공휴일.**
 *
 * 지침에 「평일 09:00~18:00 외에 토·일·공휴일이면 50% 할증」이 있습니다.
 *
 * 토·일은 셈으로 나옵니다. 나머지는 **프로그램이 알고 있지 않습니다.**
 * 설날·추석은 음력이라 양력 날짜가 해마다 옮겨 다니고, 대체공휴일은
 * 그해 규정에 따라 붙었다 말았다 합니다. 박아 두면 반드시 틀리고,
 * 틀린 채로 두면 할증이 어긋납니다 — 그건 돈이 어긋나는 일입니다.
 * (실제로 2026년 설·추석 연휴 날짜를 찾아보니 자료마다 달랐습니다.)
 *
 * 그래서 **설정에서 쌓아 갑니다**(holiday 표). 해마다 관공서 달력이 나오면
 * 그때 넣으면 되고, 한 번 넣은 것은 그대로 남습니다.
 */
let 공휴일캐시: { 언제: number; 날들: Map<string, string> } | null = null;

/** 적어 넣은 공휴일들 (날짜 → 이름). 자주 물으니 잠깐 담아 둡니다. */
export function 공휴일들(): Map<string, string> {
  const 지금 = Date.now();
  if (공휴일캐시 && 지금 - 공휴일캐시.언제 < 30_000) return 공휴일캐시.날들;
  let 날들 = new Map<string, string>();
  try {
    날들 = new Map(
      db.query<{ on_date: string; name: string }, []>(
        "SELECT on_date, name FROM holiday"
      ).all().map((r) => [r.on_date, r.name])
    );
  } catch { /* 표가 아직 없으면 토·일만으로 갑니다 */ }
  공휴일캐시 = { 언제: 지금, 날들 };
  return 날들;
}

/** 공휴일을 넣거나 뺐으면 담아 둔 것을 버립니다. */
export function 공휴일캐시버리기() { 공휴일캐시 = null; }

export function isHoliday(ymd: string): boolean {
  const d = dowOf(ymd);
  if (d === 0 || d === 6) return true;
  return 공휴일들().has(ymd);
}

/** 그날이 왜 휴일인가 — 화면에 「추석」이라고 적어 주려고. */
export function 휴일이름(ymd: string): string {
  const 적은것 = 공휴일들().get(ymd);
  if (적은것) return 적은것;
  const d = dowOf(ymd);
  return d === 0 ? "일요일" : d === 6 ? "토요일" : "";
}

type Cell = {
  on: string;
  dow: number;
  holiday: boolean;
  /** 계획에 못박힌 날이 아니라 **아무 날이나 고를 수 있는** 칸 (월·생애 단위) */
  free?: boolean;
  /** 계획된 요일인가. 셈할 때 **「몇 번 가야 하나」**의 근거입니다. */
  planned?: boolean;
  state: "계획" | "제공" | "미제공";
  reason?: string;
  note?: string;
  id?: number;
  /**
   * 실제로 몇 분 있었나 (30분 환산 · A-1).
   *
   * **시간제 서비스(가사·동행)에만** 뜹니다. 식사는 끼, 이미용은 회입니다.
   * 비어 있으면 예전처럼 **한 번 = 한 시간**으로 셉니다.
   */
  minutes?: number | null;
  /** 그 분이 편람 규칙으로 몇 분 인정되나. 화면에 「30분 인정」으로 보여 줍니다. */
  인정?: number | null;
  /**
   * 못 간 날의 **갈래** (A-3 · 7-아) — 노쇼 · 사전취소 · 기관사정 · 기타.
   *
   * 노쇼면 **돈이 나가고 한도에서 깎입니다**(계약서 4조).
   * 갈래를 안 적은 옛 미제공은 「기타」로 읽습니다.
   */
  missKind?: string | null;
  /** 이용자가 취소를 알려 온 날 (사전취소일 때). */
  notifiedOn?: string | null;
  /**
   * ★ **그때 화면에 있던 확인사항 목록** (2026-09-06 무무).
   *
   * 지금 목록이 아니라 **적을 때의 목록**입니다. 그래야 사무실이
   * 나중에 항목을 지워도 그날 눌러 둔 표시가 안 사라집니다.
   * 아직 안 적은 칸은 지금 목록입니다.
   */
  확인사항?: string[];
  /** 사전취소라기에는 늦게 알린 것인가. **막지 않고 알려만 줍니다.** */
  늦음?: boolean;
  /**
   * 식사지원 **대면 배달이었나** (A-4). 식사지원 제공 칸에만 뜻이 있습니다.
   * 비대면이어도 **돈은 나갑니다** — 음식이 이미 만들어졌습니다.
   */
  대면?: boolean | null;
  /**
   * ── 현장앱에서 올라온 것 ──────────────────────────────────
   *
   * 사무실이 손으로 찍은 칸에는 없습니다(null).
   * 달력 한 칸에는 다 못 넣으므로 **눌러서 여는 창**에서 보여 줍니다.
   */
  /** 그 댁에서 시작을 찍은 때 (ISO). */
  시작?: string | null;
  /** 끝을 찍은 때 (ISO). */
  종료?: string | null;
  /** 방문표를 찍었나 — 「일치」 또는 「확인필요」. */
  판정?: string | null;
  /** 적은 것 · 사진 · 서명 · 고친 기록이 통째로 들어 있습니다. */
  현장?: any;
};

/**
 * 한 달치 실적표.
 *
 * 줄 = 배정(대상자 × 서비스 × 담당), 칸 = 그 달의 날짜.
 */
/**
 * 제공실적에 붙어 온 **현장 기록**을 꺼냅니다.
 *
 * 사무실이 손으로 찍은 칸에는 없습니다 — 그때는 null 입니다.
 * 못 읽어도 null 로 돌려줍니다. 옛 자료가 섞여 있어도 화면이 죽으면 안 됩니다.
 */
function 현장읽기(payload: string | null | undefined) {
  if (!payload) return null;
  try {
    const 것 = JSON.parse(payload)?.현장;
    return 것 && typeof 것 === "object" ? 것 : null;
  } catch { return null; }
}

export function month(m: string, opts: { q?: string; dong?: string; workerId?: string } = {}) {
  if (!/^\d{4}-\d{2}$/.test(m)) throw new Error("달을 YYYY-MM 으로 주세요.");
  const days = daysOf(m);
  const first = days[0];
  const last = days[days.length - 1];

  // 그 달에 하루라도 걸치는 배정만.
  const rows = db.query(
    `SELECT a.id, a.recipient_id, a.service_id, a.weekly_plan,
            a.period_from, a.period_to, a.monthly_times,
            r.payload AS rpayload, r.dong, r.status AS rstatus,
            sv.name AS service, sv.unit, sv.unit_price, sv.holiday_price, sv.record_type,
            sv.cat_m, sv.cat_s,
            sv.noshow_billable, sv.round_unit, sv.round_half,
            u.id AS worker_user_id, u.name AS worker,
            rf.cycle_text, rf.cycle_unit, rf.cycle_count
       FROM assignment a
       JOIN recipient r  ON r.id  = a.recipient_id
       JOIN service   sv ON sv.id = a.service_id
       LEFT JOIN worker   w ON w.id = a.worker_id
       LEFT JOIN app_user u ON u.id = w.user_id
       LEFT JOIN (
         SELECT * FROM (
           SELECT rf.*, ROW_NUMBER() OVER (
                    PARTITION BY rf.recipient_id, rf.service_id
                    ORDER BY COALESCE(rf.period_from,'') DESC, rf.id DESC) AS rn
             FROM referral rf
         ) WHERE rn = 1
       ) rf ON rf.recipient_id = a.recipient_id AND rf.service_id = a.service_id
      WHERE (a.period_from IS NULL OR a.period_from <= ?)
        AND (a.period_to   IS NULL OR a.period_to   >= ?)
      ORDER BY a.id`
  ).all(last, first) as any[];

  // 이미 적어 둔 실적.
  const done = new Map<string, any>();
  for (const d of db.query(
    `SELECT * FROM delivery WHERE served_on >= ? AND served_on <= ?`
  ).all(first, last) as any[]) {
    done.set(`${d.assignment_id}|${d.served_on}`, d);
  }

  /*
   * ── 확인사항 목록 — **그때 것**으로 (2026-09-06 무무) ────────
   *
   * 사무실이 실적 창에서 「해 드린 것」을 고칠 때 보이는 칸입니다.
   * 이미 적힌 건은 **그때 화면에 있던 목록**을 보여 줘야 합니다.
   * 지금 목록으로 그리면, 그 뒤에 지운 항목에 눌러 둔 표시가
   * **화면에서 사라지고**, 관리자가 저장하는 순간 진짜로 없어집니다.
   *
   * 같은 버전을 여러 번 읽지 않게 한 번 읽고 들고 있습니다.
   */
  const 버전보관 = new Map<number | null, string[]>();
  const 목록꺼내기 = (버전: unknown): string[] => {
    const k = 버전 == null ? null : Number(버전);
    if (!버전보관.has(k)) 버전보관.set(k, 버전목록(k));
    return 버전보관.get(k)!;
  };
  const 이제목록 = 지금목록();

  const q = (opts.q ?? "").trim().toLowerCase();

  /*
   * ── 그 달 월 한도 (A-2) ───────────────────────────────────
   *
   * 사람마다 한 번씩만 셉니다. 줄마다 부르면 대상자가 마흔 명일 때
   * 같은 셈을 마흔 번 합니다.
   */
  const 월사용맵 = new Map<string, any>();
  for (const rid of new Set(rows.map((r) => r.recipient_id))) {
    for (const x of 월사용(String(rid), m)) 월사용맵.set(`${rid}:${x.serviceId}`, x);
  }

  const items = rows
    .map((r) => {
      const p = JSON.parse(r.rpayload || "{}");
      const plan = parseSlots(r.weekly_plan).map((s) => s.dow);

      /*
       * 주기에 따라 칸을 다르게 깝니다.
       *
       *   주 단위    「주 2회 · 화·목」 → 그 달의 화·목에 ○ 를 깝니다.
       *   월 단위    「월 2회」        → 어느 날에 갈지는 그때 정합니다.
       *                                 요일이 없으니 **아무 날이나 누를 수 있게** 열어 둡니다.
       *   생애 1회   안전생활환경개선  → 한 번뿐. 역시 날짜를 그때 고릅니다.
       *
       * 월·생애를 억지로 요일에 못박으면 계획이 거짓말이 되고,
       * 그 거짓 계획으로 「계획 대비 실적」을 뽑으면 숫자가 통째로 틀립니다.
       */
      // 식사지원인가 — 대면/비대면을 묻는 서비스입니다 (A-4).
      const 대면원칙 = 대면원칙인가({ record_type: r.record_type, name: r.service });

      const byDow = r.cycle_unit === "week" && plan.length > 0;
      const target = byDow ? null
        : r.cycle_unit === "lifetime" ? 1
        : (r.cycle_count ?? null);

      const cells: Cell[] = [];
      for (const on of days) {
        // 배정 기간 밖은 아예 칸을 만들지 않습니다.
        if (r.period_from && on < r.period_from) continue;
        if (r.period_to && on > r.period_to) continue;

        const rec = done.get(`${r.id}|${on}`);
        /*
         * ★ 「이 날에 가나」는 **`가는날.ts` 가 답합니다** (v34).
         *   주기(한 달에 몇 번)가 여기 안 들어가면 사무실 달력이
         *   현장앱과 다른 날을 계획으로 보여 줍니다.
         */
        const planned = byDow && 그날가나(r, on);
        // 주 단위는 계획·실적이 있는 날만. 월·생애는 아무 날이나 고를 수 있게 다 엽니다.
        if (!rec && !planned && byDow) continue;

        cells.push({
          on,
          dow: dowOf(on),
          holiday: isHoliday(on),
          free: !byDow,
          planned,
          /*
           * **다녀왔으면 그냥 「제공」입니다.**
           *
           * 예전에는 계획 요일이 아닌 날에 다녀오면 「계획밖(◆)」으로 갈랐습니다.
           * 그런데 요일은 **안내**이고 지자체가 정한 것은 **횟수**입니다 —
           * 「주 2회 화·목」인데 수·목에 다녀왔으면 그 주는 채운 것입니다.
           * 갈라 놓으면 채웠는데도 「계획을 안 지켰다」처럼 읽혔습니다.
           */
          state: !rec ? "계획" : rec.outcome === "미제공" ? "미제공" : "제공",
          reason: rec?.reason ?? undefined,
          note: rec?.note ?? undefined,
          id: rec?.id,
          // 시간제일 때만 분을 다룹니다 (아래 줄 정보에 `unit` 이 있습니다).
          minutes: rec?.minutes ?? null,
          인정: rec?.minutes == null ? null : 인정분(Number(rec.minutes), 셈규칙읽기(r)),
          // 못 간 날의 갈래 (A-3). 미제공일 때만 뜻이 있습니다.
          missKind: rec?.outcome === "미제공" ? 갈래읽기(rec.miss_kind) : null,
          notifiedOn: rec?.notified_on ?? null,
          늦음: rec?.outcome === "미제공" && 갈래읽기(rec.miss_kind) === "사전취소"
            ? 늦게알렸나(on, rec.notified_on)
            : false,
          // 식사지원 제공 칸에만. 안 적었으면 대면입니다 (원칙이 대면).
          대면: 대면원칙 && rec?.outcome === "제공"
            ? 대면이었나(rec.face_to_face)
            : null,
          // 현장앱에서 온 것. 손으로 찍은 칸에는 없습니다.
          /*
           * 이 건을 적을 때 화면에 있던 확인사항 목록. 아직 안 적은
           * 칸은 **지금 목록**입니다 — 이제부터 적을 것이니까요.
           */
          확인사항: rec ? 목록꺼내기(rec.check_set_id) : 이제목록.항목,
          시작: rec?.start_at ?? null,
          종료: rec?.end_at ?? null,
          판정: rec?.verdict ?? null,
          현장: 현장읽기(rec?.payload),
        });
      }

      /*
       * ── 셈하는 법 ────────────────────────────────────────
       *
       *   계획   **몇 번 가야 하나.** 주 단위면 그 달의 계획 요일 칸 수,
       *          월·생애면 정해진 목표 횟수.
       *   제공   **몇 번 갔나.** 계획 요일이든 아니든 다녀왔으면 셉니다.
       *   남음   계획 − 제공 − 못 감.
       *
       * 예전에는 계획을 `cells.length` 로 셌습니다. 그러면 계획 요일이 아닌
       * 날에 다녀올 때마다 그 칸이 함께 들어와 **계획 수가 부풀었습니다** —
       * 「주 2회」인데 수요일에 한 번 더 가면 계획이 3회가 되었습니다.
       * 계획은 **깔린 칸이 아니라 가야 할 횟수**입니다.
       */
      const 제공 = cells.filter((c) => c.state === "제공").length;
      const 미제공 = cells.filter((c) => c.state === "미제공").length;
      /*
       * 노쇼는 **미제공 안에 든 채로** 따로 셉니다 (A-3).
       * 빼서 세면 달성률이 흔들리고, 안 세면 「왜 돈이 나갔나」를 못 봅니다.
       */
      const 노쇼 = cells.filter((c) => c.missKind === "노쇼").length;
      /*
       * 비대면 배달은 **제공 안에 든 채로** 따로 셉니다 (A-4).
       * 미제공이 아니라 제공이라 빼면 안 되고, 안 세면
       * 「3회 연속이면 서비스 중지」가 어디서 오는지 안 보입니다.
       */
      const 비대면 = cells.filter((c) => c.대면 === false).length;
      const 계획 = byDow ? cells.filter((c) => c.planned).length : (target ?? 0);
      const 남음 = Math.max(0, 계획 - 제공 - 미제공);

      return {
        assignId: r.id,
        recipientId: r.recipient_id,
        recipient: p.name ?? "",
        dong: r.dong ?? "",
        /*
         * 대상자 상태 (이용 · 중단 · 직권중단 · 종결 · 취소).
         *
         * 배정은 상태와 **따로 놉니다** — 중단 중에도 배정은 남아 있고,
         * 종결도 기간이 끝나기 전까지는 칸이 깔립니다. 그래서 상태를 실어 보내
         * 화면이 「이용 중인 분만」 볼 수 있게 합니다. 섞여 나오면
         * **지금 몇 분을 보고 있는지 셀 수가 없습니다.**
         */
        status: r.rstatus ?? "이용",
        serviceId: r.service_id,
        service: r.service,
        unit: r.unit,
        recordType: r.record_type,
        // 대면/비대면을 묻는 서비스인가 (식사지원). 화면이 칩을 그릴지 정합니다.
        대면원칙,
        /*
         * ── 어느 서식으로 나가는 서비스인가 ──────────────────
         *
         * 사무실이 실적 창에서 **현장 몫을 직접 적을 때**, 무엇을 물을지가
         * 이 값으로 갈립니다 — 가사면 열한 가지 체크, 식사면 식단,
         * 동행이면 장소와 내용. 현장앱이 쓰는 것과 **같은 함수**입니다.
         * 두 곳에서 따로 가리면 언젠가 어긋납니다.
         */
        갈래: 서식갈래({ record_type: r.record_type, cat_m: r.cat_m, cat_s: r.cat_s,
                        name: r.service }),
        서식: 서식이름(서식갈래({ record_type: r.record_type, cat_m: r.cat_m,
                                 cat_s: r.cat_s, name: r.service })),
        // 노쇼 갈래를 쓰는 서비스인가. **기본 꺼짐** — 꺼져 있으면 안 묻습니다.
        노쇼쓰나: !!Number(r.noshow_billable ?? 0),
        unitPrice: r.unit_price,
        holidayPrice: r.holiday_price,
        workerUserId: r.worker_user_id,
        worker: r.worker ?? "",
        cycle: r.cycle_text ?? "",
        cycleUnit: r.cycle_unit,
        byDow,
        target,
        planDows: plan,
        planText: byDow
          ? plan.map((d) => DOW_KO[d]).join(" · ")
          : `${r.cycle_text || (target ? `${target}회` : "")} (날짜 지정)`,
        cells,
        계획, 제공, 미제공, 노쇼, 비대면, 남음,
        /*
         * ── 이 달 월 한도 (A-2) ──────────────────────────────
         *
         * 편람: 가사 월 12시간 · 식사 월 8회 · 동행 월 6시간과 2회 · 이미용 월 1회.
         * **막지 않고 보여만 줍니다** — 군과 협의해 넘길 여지가 있습니다.
         * 셈은 `한도.ts` 한 곳이 합니다. 여기서 또 세면 두 화면이 다른 말을 합니다.
         */
        월한도: 월사용맵.get(`${r.recipient_id}:${r.service_id}`) ?? null,
      };
    })
    .filter(
      (x) =>
        (!q || [x.recipient, x.service, x.worker].some((v) => v.toLowerCase().includes(q))) &&
        (!opts.dong || x.dong === opts.dong) &&
        (!opts.workerId || String(x.workerUserId) === opts.workerId)
    )
    .sort(
      (a, b) =>
        a.recipient.localeCompare(b.recipient, "ko") ||
        a.service.localeCompare(b.service, "ko")
    );

  return {
    month: m,
    /** 지금 쓰는 확인사항 목록 — 아직 안 적은 칸에 씁니다. */
    확인사항: 이제목록.항목,
    days: days.map((on) => ({
      on, day: Number(on.slice(8)), dow: dowOf(on),
      holiday: isHoliday(on),
      // 왜 휴일인가. 「추석」처럼 이름이 있으면 달력에 적어 줍니다 —
      // 붉은 칸만 있고 이름이 없으면 왜 쉬는 날인지 모릅니다.
      holidayName: 공휴일들().get(on) ?? "",
    })),
    items,
    dongs: [...new Set(rows.map((r) => r.dong).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), "ko")),
    workers: [...new Map(rows.filter((r) => r.worker_user_id)
      .map((r) => [r.worker_user_id, r.worker])).entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "ko")),
    tally: {
      계획: items.reduce((s, x) => s + x.계획, 0),
      제공: items.reduce((s, x) => s + x.제공, 0),
      미제공: items.reduce((s, x) => s + x.미제공, 0),
      노쇼: items.reduce((s, x) => s + x.노쇼, 0),
      비대면: items.reduce((s, x) => s + x.비대면, 0),
      남음: items.reduce((s, x) => s + x.남음, 0),
    },
  };
}

/**
 * 한 칸을 정합니다.
 *
 * state 를 그대로 받습니다. 화면에서 「눌러서 돌리는」 방식이라
 * 서버가 다음 상태를 짐작하면 두 번 눌렀을 때 어긋납니다.
 */
export function setCell(b: {
  assignId: number; on: string; state: string; reason?: string; note?: string;
  /** 실제 제공 분. 시간제 서비스에만 뜻이 있습니다 (30분 환산 · A-1). */
  minutes?: number | null;
  /** 못 간 갈래 — 노쇼 · 사전취소 · 기관사정 · 기타 (A-3 · 7-아). */
  missKind?: string | null;
  /** 이용자가 취소를 알려 온 날 (사전취소일 때). */
  notifiedOn?: string | null;
  /**
   * ★ **그때 화면에 있던 확인사항 목록** (2026-09-06 무무).
   *
   * 지금 목록이 아니라 **적을 때의 목록**입니다. 그래야 사무실이
   * 나중에 항목을 지워도 그날 눌러 둔 표시가 안 사라집니다.
   * 아직 안 적은 칸은 지금 목록입니다.
   */
  확인사항?: string[];
  /**
   * 식사지원 **대면 배달이었나** (A-4).
   *
   * `false` 면 비대면 — 놓고 온 것입니다. **돈은 그대로 나가고**,
   * 3회 연속이면 통합돌봄 전체가 중지됩니다(계약서 5-2조).
   * 안 보내면 있던 값 그대로. 비어 있으면 **대면**으로 봅니다.
   */
  faceToFace?: boolean | null;
}) {
  const a = db.query<any, [number]>("SELECT * FROM assignment WHERE id = ?").get(b.assignId);
  if (!a) throw new Error("그 배정을 찾을 수 없습니다.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.on)) throw new Error("날짜가 잘못되었습니다.");
  if (b.on > today()) throw new Error("아직 오지 않은 날입니다.");

  const cur = db.query<any, [number, string]>(
    "SELECT * FROM delivery WHERE assignment_id = ? AND served_on = ?"
  ).get(b.assignId, b.on);

  // 「계획」으로 되돌리는 것 = 적어 둔 것을 무릅니다.
  if (b.state === "계획") {
    /*
     * ── 현장에서 올라온 건을 되돌릴 때 ────────────────────────
     *
     * 제공인력이 다녀와 적고 서명까지 받아 올린 건입니다. 사무실이
     * 되돌리면 그 건은 **다시 해야 하는 일**이 됩니다. 그런데 폰은
     * 자기 안에 적어 둔 기록을 보고 「전송 완료」로 두고 있어서,
     * 사무실과 현장이 서로 다른 것을 보게 됩니다.
     *
     * 그래서 되돌린 사실을 한 줄 남깁니다. 이 표는 그날 갈 곳을
     * 올릴 때 짐에 실려 나가고, 폰은 자기가 들고 있는 표와 다르면
     * 그 건의 기록을 **처음으로 되돌립니다.**
     * (2026-09-05 무무 — 「경고창을 확인했음에도 불구하고 되돌리면
     *  폰도 처음으로 되돌려야 해.」)
     *
     * 현장 기록이 없는 건(사무실이 손으로 찍은 것)은 남길 것이 없습니다.
     */
    const 현장있나 = !!현장읽기(cur?.payload);
    if (cur) db.run("DELETE FROM delivery WHERE id = ?", [cur.id]);
    if (현장있나) {
      db.run(
        `INSERT INTO field_reset (assignment_id, served_on, token, reset_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(assignment_id, served_on)
         DO UPDATE SET token = excluded.token, reset_at = excluded.reset_at`,
        [b.assignId, b.on, crypto.randomUUID(), new Date().toISOString()]);
    }
    syncMeal(a, b.on);
    return { state: "계획", 현장되돌림: 현장있나 };
  }

  if (b.state !== "제공" && b.state !== "미제공")
    throw new Error("제공 또는 미제공만 됩니다.");
  if (b.state === "미제공" && !String(b.reason ?? "").trim())
    throw new Error("못 간 사유를 골라 주세요.");

  // ★ 여기도 같은 자로 잽니다 (`가는날.ts`). 두 곳이 다르면 계획 대비 실적이 틀립니다.
  const planned = 그날가나(a, b.on);
  const stamp = new Date().toISOString();

  /*
   * ── 몇 분 있었나 (A-1) ───────────────────────────────────────
   *
   * **적어 보내지 않으면 있던 값을 그대로 둡니다.** 지우려면 빈칸을 보내야 합니다.
   * 화면이 늘 한 벌을 통째로 보내지만, 현장앱은 「제공/미제공」만 보낼 수
   * 있습니다. 그때 분이 소리 없이 지워지면 그 사람 청구가 한 시간으로 돌아갑니다.
   *
   * 미제공이면 분은 뜻이 없으므로 비웁니다 — 안 갔는데 40분이 남아 있으면
   * 나중에 그 줄을 보고 아무도 설명할 수 없습니다.
   */
  const 분 = b.state === "미제공" ? null
    : b.minutes === undefined ? (cur?.minutes ?? null)
    : b.minutes === null || b.minutes === ("" as any) ? null
    : Math.max(0, Math.floor(Number(b.minutes))) || null;

  /*
   * ── 못 간 갈래 (A-3 · 7-아) ─────────────────────────────────
   *
   * **제공이면 비웁니다.** 다녀왔는데 「노쇼」가 남아 있으면 그 줄을 보고
   * 아무도 설명할 수 없고, 돈이 두 번 나갑니다.
   *
   * 미제공인데 갈래를 안 보내면 **사유가 골라 준 것**을 씁니다
   * (부재·거부 → 노쇼, 입원·본인요청 → 사전취소 …). 현장앱이 갈래를
   * 안 보낼 수 있어서, 그때 조용히 비면 노쇼가 통째로 사라집니다.
   * 미리 골라 주기만 하고 **사람이 고친 것이 언제나 이깁니다.**
   */
  /*
   * 노쇼를 쓰는 서비스인가. **기본은 꺼짐**입니다 — 해남 현장은 안 씁니다
   * (가사·동행·이미용은 사전 조율, 식사는 대면/비대면). 꺼져 있으면
   * 화면이 갈래를 아예 안 묻고, 여기서도 노쇼로 골라 주지 않습니다.
   */
  const sv = db.query<any, [number]>(
    "SELECT record_type, name, noshow_billable, round_unit, round_half FROM service WHERE id = ?"
  ).get(a.service_id);
  const 노쇼쓰나 = !!Number(sv?.noshow_billable ?? 0);

  const 갈래 = b.state === "미제공"
    ? (b.missKind == null || String(b.missKind).trim() === ""
        ? 기본갈래(b.reason, 노쇼쓰나)
        : 갈래읽기(b.missKind))
    : null;
  const 알린날 = 갈래 === "사전취소"
    ? (String(b.notifiedOn ?? "").trim() || cur?.notified_on || null)
    : null;

  /*
   * ── 대면이었나 (A-4) ────────────────────────────────────────
   *
   * **식사지원에만** 뜻이 있습니다. 안 보내면 있던 값 그대로 —
   * 분과 같은 규칙입니다(현장앱이 「제공」만 보낼 수 있습니다).
   * **미제공이면 비웁니다** — 안 갔으면 대면도 비대면도 아닙니다.
   */
  const 대면 = !대면원칙인가(sv ?? {}) || b.state === "미제공"
    ? null
    : b.faceToFace === undefined ? (cur?.face_to_face ?? null)
    : b.faceToFace === null ? null
    : b.faceToFace ? 1 : 0;

  if (cur) {
    db.run(
      `UPDATE delivery SET outcome = ?, reason = ?, note = ?, is_holiday = ?, planned = ?,
              minutes = ?, miss_kind = ?, notified_on = ?, face_to_face = ?
         WHERE id = ?`,
      [b.state, b.reason ?? "", b.note ?? "", isHoliday(b.on) ? 1 : 0, planned ? 1 : 0,
       분, 갈래, 알린날, 대면, cur.id]
    );
  } else {
    db.run(
      `INSERT INTO delivery
         (assignment_id, recipient_id, service_id, served_on, actor_id,
          qty, is_holiday, outcome, reason, note, planned, minutes,
          miss_kind, notified_on, face_to_face, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.assignId, a.recipient_id, a.service_id, b.on, a.worker_id,
       isHoliday(b.on) ? 1 : 0, b.state, b.reason ?? "", b.note ?? "",
       planned ? 1 : 0, 분, 갈래, 알린날, 대면, stamp]
    );
  }
  /*
   * ── 닿았으면 **알려만 줍니다** (2026-09-01) ─────────────────
   *
   * 연속 비대면이 한도에 닿아도 **대상자 상태를 건드리지 않습니다.**
   * 중지는 지자체와 협의할 일이고, 기계가 앞서 정하면 현장이 프로그램과
   * 싸우게 됩니다. 화면이 이 값을 보고 **경고창**을 띄우고,
   * 중단은 사람이 대상자 화면에서 누릅니다.
   */
  const 비대면 = syncMeal(a, b.on);
  return {
    state: b.state, planned, minutes: 분, 인정: 분 == null ? null : 인정분(분, 셈규칙읽기(sv ?? {})),
    missKind: 갈래, notifiedOn: 알린날,
    비대면,
    // 사전취소라기에는 늦게 알린 것인가. **막지 않고 알려만 줍니다.**
    늦음: 갈래 === "사전취소" ? 늦게알렸나(b.on, 알린날) : false,
    faceToFace: 대면 == null ? null : 대면 === 1,
  };
}

/* ══════════════════════════════════════════════════════════════
 *  사무실이 **현장 몫을 직접 적습니다** (v1.8.27)
 *
 *  ── 왜 필요한가 ────────────────────────────────────────────
 *
 *  현장앱이 다 좋아도 이런 날이 있습니다 —
 *
 *    · 폰이 고장 났거나 배터리가 나갔다
 *    · 아직 폰을 안 쓰는 인력이 있다
 *    · 종이로 적어 온 것을 옮겨 적어야 한다
 *    · 찍긴 찍었는데 한 칸을 잘못 눌렀다
 *
 *  그때 사무실이 **손을 댈 수 있어야** 합니다. 못 대면 그 달 서식은
 *  통째로 손으로 쓰게 됩니다 — 프로그램을 쓰는 뜻이 없어집니다.
 *  (2026-09-05 무무 — 「새로 뜬 창은 현장에서 실행한 것 처럼
 *   관리자가 데이터를 입력할 수 도 있어야 해」)
 *
 *  ── ★ 누가 적었는지는 남깁니다 ★ ──────────────────────────
 *
 *  서식으로 나갈 때는 폰으로 찍은 것과 **똑같이** 나갑니다. 다만
 *  화면에서는 손댄 칸에 작은 글씨로 「관리자 수정함」이 붙습니다.
 *  군에서 「이건 누가 적은 겁니까」를 물으면 답할 수 있어야 하고,
 *  무엇보다 **사무실 자신이** 나중에 헷갈리지 않아야 합니다.
 *  (무무 — 「구분해서 남기되 관리자가 수정한 부분에 한해서
 *   작은 글씨로 관리자 수정함이라고 표시만」)
 * ══════════════════════════════════════════════════════════════ */

/** 사무실이 적을 수 있는 칸들. 안 보낸 것은 **건드리지 않습니다.** */
export type 사무실현장 = {
  시작?: string | null;          // "09:00" — 시각만
  종료?: string | null;
  적은것?: Record<string, unknown>;
  서명?: string | null;          // data:image/png;base64,…
  사진자리?: string[];           // data\사진\ 아래 상대 경로
};

const 손댄칸 = "관리자고침";

export function 현장적기(b: {
  assignId: number; on: string; 값: 사무실현장; 누가?: string;
}) {
  const a = db.query<any, [number]>("SELECT * FROM assignment WHERE id = ?").get(b.assignId);
  if (!a) throw new Error("그 배정을 찾을 수 없습니다.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.on)) throw new Error("날짜가 잘못되었습니다.");
  if (b.on > today()) throw new Error("아직 오지 않은 날입니다.");

  /*
   * 아직 「계획」이면 **제공으로 올립니다.** 사무실이 진행시간과 한 것을
   * 적는다는 것은 다녀왔다는 뜻이니까요. 안 그러면 적어 놓고도
   * 청구에 안 잡혀서 나중에 왜 비었는지 아무도 모릅니다.
   */
  const 이전 = db.query<any, [number, string]>(
    "SELECT * FROM delivery WHERE assignment_id = ? AND served_on = ?"
  ).get(b.assignId, b.on);

  if (!이전 || 이전.outcome === "계획") {
    setCell({ assignId: b.assignId, on: b.on, state: "제공" });
  }

  const cur = db.query<any, [number, string]>(
    "SELECT * FROM delivery WHERE assignment_id = ? AND served_on = ?"
  ).get(b.assignId, b.on);
  if (!cur) throw new Error("실적 줄을 만들지 못했습니다.");

  let 속: any = {};
  try { 속 = cur.payload ? JSON.parse(cur.payload) : {}; } catch { 속 = {}; }
  const 현장 = (속.현장 && typeof 속.현장 === "object") ? 속.현장 : {};
  const 고침: Record<string, { 누가: string; 언제: string }> =
    (현장[손댄칸] && typeof 현장[손댄칸] === "object") ? 현장[손댄칸] : {};

  const 이제 = new Date().toISOString();
  const 누가 = (b.누가 ?? "").trim() || "관리자";
  const 표시 = (칸: string) => { 고침[칸] = { 누가, 언제: 이제 }; };

  // ── 진행시간 ──
  let 시작 = cur.start_at ?? null;
  let 종료 = cur.end_at ?? null;
  if (b.값.시작 !== undefined) { 시작 = 때만들기(b.on, b.값.시작); 표시("시작"); }
  if (b.값.종료 !== undefined) { 종료 = 때만들기(b.on, b.값.종료); 표시("종료"); }

  /*
   * ★ 거꾸로 된 시각은 막습니다. 09:00~08:00 이 들어가면 서식의
   *   「진행시간」이 말이 안 되고, 분을 세는 곳마다 음수가 됩니다.
   */
  if (시작 && 종료 && 종료 < 시작)
    throw new Error("종료가 시작보다 빠릅니다. 시각을 다시 봐 주세요.");

  // ── 적은 것 (갈래별) ──
  const 적은것 = { ...(현장.적은것 ?? {}) };
  if (b.값.적은것) {
    for (const [칸, 값] of Object.entries(b.값.적은것)) {
      적은것[칸] = 값;
      표시(`적은것.${칸}`);
    }
  }

  // ── 서명·사진 ──
  let 서명 = 현장.서명 ?? null;
  let 서명받은때 = 현장.서명받은때 ?? null;
  if (b.값.서명 !== undefined) {
    서명 = b.값.서명 || null;
    서명받은때 = 서명 ? 이제 : null;
    표시("서명");
  }

  let 사진 = Array.isArray(현장.사진) ? 현장.사진 : [];
  if (b.값.사진자리 !== undefined) {
    /*
     * 현장에서 온 사진과 **한 줄에 섞습니다.** 서식 뒷장에 붙일 때
     * 어느 것이 어디서 왔는지는 상관없고, 순서만 지키면 됩니다.
     * 다만 사무실이 넣은 것은 `사무실: true` 로 표를 남깁니다.
     */
    사진 = [
      ...사진.filter((x: any) => !x?.사무실),
      ...b.값.사진자리.map((자리, i) => ({ 자리, 번호: i, 사무실: true })),
    ];
    표시("사진");
  }

  속.현장 = { ...현장, 적은것, 서명, 서명받은때, 사진, [손댄칸]: 고침 };

  /*
   * ★ 2026-09-05 — **진행시간을 적었으면 분도 같이 적습니다.**
   *
   * 청구는 `minutes` 를 보고 30분 단위로 셉니다. 여기서 09:00~11:00 을
   * 적어 두고 분을 안 채우면, 청구는 분이 비었다고 보고 **한 시간**으로
   * 셉니다 — 화면에는 두 시간이라고 적혀 있는데 청구서는 한 시간입니다.
   * 두 종이가 다른 말을 하는 것이라, 시각을 고칠 때 분도 함께 갑니다.
   */
  const 잰분 = 분재기(시작, 종료);

  /*
   * ★ 식사지원이면 **대면/비대면도 자료함 칸에** 넣습니다.
   *   payload 안에만 두면 계약서 5-2조 연속 셈이 못 봅니다.
   */
  let 대면칸: number | null = null;
  const 형태 = String((적은것 as any)?.제공형태 ?? "").trim();
  if (형태 === "비대면배달") 대면칸 = 0;
  else if (형태 === "대면배달") 대면칸 = 1;

  /*
   * ★ 확인사항을 사무실이 직접 고른 건은 **지금 목록**으로 얼립니다.
   *
   * 현장앱에서 올라온 건은 폰이 그때 목록의 버전을 실어 보냅니다. 손으로
   * 적는 이 길에는 그것이 없으니 여기서 박아 둡니다. 안 박아 두면
   * 나중에 목록을 고쳤을 때 이 건만 새 목록으로 읽혀 **누른 적 없는
   * 칸에 ○ 가 찍히거나, 누른 것이 사라집니다.**
   *
   * 이미 버전이 박힌 건은 안 건드립니다 — 현장에서 온 버전이 옳습니다.
   * 확인사항을 손대지 않은 저장(시각만 고친 것 등)에도 안 박습니다.
   */
  const 확인손댐 = b.값.적은것 ? ("한것" in b.값.적은것 || "기타" in b.값.적은것) : false;
  const 새버전 = (확인손댐 && cur.check_set_id == null) ? 지금목록().버전 : null;

  db.run(
    `UPDATE delivery SET start_at = ?, end_at = ?, payload = ?,
            minutes = COALESCE(?, minutes),
            face_to_face = COALESCE(?, face_to_face),
            check_set_id = COALESCE(?, check_set_id)
       WHERE id = ?`,
    [시작, 종료, JSON.stringify(속), 잰분, 대면칸, 새버전, cur.id]);

  // 비대면을 손댔으면 연속 셈도 따라 돌아야 합니다.
  if (대면칸 !== null) { try { syncMeal(a, b.on); } catch { } }

  /*
   * 특이사항은 **대상자 포스트잇으로도** 넘깁니다 — 현장에서 올라온 것과
   * 똑같이. 기록지를 쓸 때 보는 자리가 거기입니다.
   */
  const 말 = String((b.값.적은것 as any)?.특이사항 ?? "").trim();
  if (말) 포스트잇으로(a, b.on, 말, 누가);

  return { ok: true, 고친칸: Object.keys(고침) };
}

/** "09:00" → "2026-09-05T09:00:00" (그 지역 시각 그대로). 빈 값이면 null. */
function 때만들기(날: string, 시각?: string | null): string | null {
  const t = String(시각 ?? "").trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`시각은 09:30 처럼 적어 주세요 (받은 것: ${t})`);
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) throw new Error(`그런 시각은 없습니다 (${t})`);
  return `${날}T${String(h).padStart(2, "0")}:${m[2]}:00`;
}

/**
 * 특이사항을 대상자 포스트잇에 붙입니다.
 *
 * 현장에서 올라온 것과 **똑같은 모양**입니다 — 「[날짜 · 서비스 · 이름] 말」.
 * 기록지를 쓸 때 보는 자리가 거기라, 사무실이 적은 것만 딴 데 있으면
 * 안 됩니다. 이미 붙어 있으면(뗀 것까지 봅니다) 다시 안 붙입니다.
 */
function 포스트잇으로(a: any, 날: string, 말: string, 누가: string) {
  try {
    const sv = db.query<{ name: string }, [number]>(
      "SELECT name FROM service WHERE id = ?").get(a.service_id);
    const 머리 = [날, sv?.name ?? "", 누가].filter(Boolean).join(" · ");
    const 글 = `[${머리}] ${말}`;

    const 겹침 = db.query<{ id: number }, [string, string]>(
      "SELECT id FROM sticky WHERE recipient_id = ? AND text = ? LIMIT 1"
    ).get(a.recipient_id, 글);
    if (겹침) return;

    addSticky(
      { text: 글, color: "blue", recipientId: a.recipient_id, 저절로: true },
      { id: null, name: 누가, role: "admin" }
    );
  } catch (e) {
    console.error("특이사항을 메모에 못 붙였습니다 —", (e as Error).message);
  }
}

/**
 * 식사지원은 **연속 비대면 배달**과 이어져 있습니다.
 *
 * 계약서 5-2조 — 3회 연속 대면 수령하지 않으면 통합돌봄 서비스 전체가 중지됩니다.
 * 실적을 적을 때 그 숫자를 따로 또 누르게 하면 반드시 어긋나므로,
 * **실적에서 다시 셉니다.** 손으로 관리하는 칸이 아니라 계산된 값입니다.
 *
 * ── 2026-09-01 바로잡음 ──────────────────────────────────────
 * 여기서 **미제공 연속**을 세고 있었습니다. 편람이 세는 것은
 * **비대면 배달 연속**입니다 — 안 간 것과 놓고 온 것은 다른 일입니다.
 * 셈은 `대면배달.ts` 한 곳이 합니다.
 */
function syncMeal(a: any, on: string) {
  const sv = db.query<{ record_type: string; name: string }, [number]>(
    "SELECT record_type, name FROM service WHERE id = ?"
  ).get(a.service_id);
  if (!sv || !대면원칙인가(sv)) return null;
  return 비대면다시셈(a.recipient_id);
}

/**
 * 한 달치를 한 번에 「제공」으로.
 *
 * 오늘까지 지난 계획 칸 중 **아직 손대지 않은 것만** 채웁니다.
 * 미제공으로 적어 둔 것은 건드리지 않습니다 — 사람이 판단한 것을
 * 기계가 덮으면 안 됩니다.
 */
export function fillMonth(m: string, assignIds?: number[]) {
  const data = month(m);
  const now = today();
  let n = 0;
  for (const it of data.items) {
    if (assignIds?.length && !assignIds.includes(it.assignId)) continue;
    // 월·생애 단위는 어느 날에 갔는지 기계가 알 수 없습니다. 건너뜁니다.
    if (!it.byDow) continue;
    for (const c of it.cells) {
      if (c.state !== "계획" || c.on > now) continue;
      setCell({ assignId: it.assignId, on: c.on, state: "제공" });
      n++;
    }
  }
  return { filled: n };
}
