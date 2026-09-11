import { db } from "./db";
import { today, addDays, parseSlots, slotText, DOW_KO, type Slot } from "./util";
import { parseRoles, isOnLeave } from "./staff";
import { 계획재기, 시간말 } from "./계획재기";
import { 달몇번, 주기말 } from "./가는날";

/**
 * 배정 — 누가 누구에게 갈 것인가.
 *
 * ── 무엇을 정하는 화면인가 ─────────────────────────────────
 * 지자체 의뢰는 「김순자 · 가사지원 · 4.21~6.30 · 주 2회」까지만 옵니다.
 * 이걸로는 아무도 못 움직입니다. **누가** 가는지, **무슨 요일에** 가는지가
 * 없기 때문입니다. 그 둘을 채우는 것이 배정입니다.
 *
 *   의뢰   김순자 · 가사지원 · 주 2회
 *   배정   김순자 · 가사지원 · 최돌봄 · 화 · 목
 *
 * ── 단위는 「대상자 × 서비스」입니다 ───────────────────────
 * 한 사람이 여러 서비스를 받고, 서비스마다 담당이 다릅니다.
 * (해남: 식사지원은 관리자가, 이미용은 제공인력이 하는 식)
 * 그래서 사람 단위가 아니라 **서비스 단위로** 담당을 붙입니다.
 *
 * ── 담당이 바뀌면 줄을 새로 만듭니다 ───────────────────────
 * 덮어쓰지 않습니다. 옛 배정은 어제 날짜로 닫고 새 줄을 넣습니다.
 * 그래야 "3월에는 누가 갔었나"에 답할 수 있습니다. 지자체가 묻습니다.
 */

/** 기간이 하루라도 겹치는가. 열린 끝(null)은 "아직 안 끝남"입니다. */
function periodsOverlap(
  aFrom: string | null, aTo: string | null,
  bFrom: string | null, bTo: string | null
) {
  if (aTo && bFrom && aTo < bFrom) return false;
  if (bTo && aFrom && bTo < aFrom) return false;
  return true;
}

/** 여기 들어간 상태면 그 사람은 끝난 것입니다. 배정이 자동으로 닫힙니다. */
export const DONE_STATUS = ["종결", "취소", "직권중단"];

/** 상태를 안 고르면 목록에서 빠지는 것들. 지금 할 일이 아닙니다. */
const HIDDEN = ["지난의뢰", "종결자", "중단중"];

/**
 * 받는 서비스가 하나도 없는 대상자 수.
 *
 * 배정 목록은 **의뢰(referral)** 로만 만들어집니다. 지자체 엑셀로 들어온
 * 대상자는 의뢰 줄이 같이 들어오지만, 관리자가 손으로 넣은 대상자는
 * 이름만 있고 받는 서비스가 없습니다. 그래서 배정 화면에 안 뜹니다.
 *
 * 이건 고장이 아니라 순서입니다 — 대상자 상세에서 「서비스 추가」를 하면
 * 엑셀로 들어온 것과 똑같이 배정·실적·정산·기록지가 그대로 돕니다.
 * 다만 **아무 말도 안 하면 관리자는 첫날 여기서 막힙니다.**
 * 그래서 이 수를 세어 빈 화면에서 길을 알려 줍니다.
 */
export function 서비스없는대상자수(): number {
  const r = db.query<{ n: number }, [string, string, string]>(
    `SELECT COUNT(*) AS n FROM recipient r
      WHERE r.status NOT IN (?, ?, ?)
        AND NOT EXISTS (SELECT 1 FROM referral rf WHERE rf.recipient_id = r.id)`
  ).get(DONE_STATUS[0], DONE_STATUS[1], DONE_STATUS[2]);
  return Number(r?.n ?? 0);
}

// ── 배정할 거리 모으기 ─────────────────────────────────────
/**
 * 대상자 × 서비스마다 한 줄.
 *
 * 의뢰가 여러 차수로 와도 **가장 나중 것 하나**만 봅니다.
 * 지금 무엇을 해야 하는지가 궁금한 화면이지, 이력을 보는 화면이 아닙니다.
 */
export function listAssign(opts: {
  q?: string; state?: string; dong?: string; service?: string; workerId?: string;
} = {}) {
  const now = today();

  const rows = db.query(
    `SELECT r.id AS recipient_id, r.payload AS rpayload, r.dong, r.status AS rstatus,
            r.memo AS rmemo,
            sv.id AS service_id, sv.name AS service, sv.unit, sv.record_type,
            rf.period_from, rf.period_to, rf.cycle_text, rf.cycle_unit, rf.cycle_count
       FROM (
         SELECT rf.*, ROW_NUMBER() OVER (
                  PARTITION BY rf.recipient_id, rf.service_id
                  ORDER BY COALESCE(rf.period_from,'') DESC, rf.id DESC) AS rn
           FROM referral rf
       ) rf
       JOIN recipient r ON r.id = rf.recipient_id
       JOIN service  sv ON sv.id = rf.service_id
      WHERE rf.rn = 1`
  ).all() as any[];

  // 대상자×서비스마다 **가장 나중 배정 하나**.
  // 끝난 것도 가져옵니다 — 지난 의뢰 줄에 "그때 누가 갔었나"가 보여야 하기 때문입니다.
  const live = new Map<string, any>();
  for (const a of db.query(
    `SELECT a.*, u.id AS user_id, u.name AS worker_name, u.dong AS worker_dong,
            u.status AS worker_status
       FROM assignment a
       LEFT JOIN worker w   ON w.id = a.worker_id
       LEFT JOIN app_user u ON u.id = w.user_id
      ORDER BY a.id`
  ).all() as any[]) {
    live.set(`${a.recipient_id}|${a.service_id}`, a);
  }

  const items = rows.map((r) => {
    const p = JSON.parse(r.rpayload || "{}");
    const a = live.get(`${r.recipient_id}|${r.service_id}`) ?? null;
    const slots = a ? parseSlots(a.weekly_plan) : [];
    const ended = !!r.period_to && r.period_to < now;

    // 의뢰가 「주 2회」인데 계획이 3줄이면 어딘가 틀린 것입니다.
    // 막지는 않습니다 — 지자체와 이야기해 조정하는 경우가 있습니다.
    // 「주 2회」는 요일로 펼 수 있습니다. 「월 2회」·「생애 1회」는 못 폅니다 —
    // 그 달 어느 날에 갈지는 그때 정하는 일이고, 요일로 못박으면 거짓말이 됩니다.
    //
    //   week      요일을 고릅니다.        계획 = 고른 요일
    //   month     요일을 안 고릅니다.     계획 = 그 달 n회 (실적에서 날짜를 고름)
    //   lifetime  한 번뿐입니다.          계획 = 1회
    const byDow = r.cycle_unit === "week";
    const want = byDow ? r.cycle_count : null;
    const countOff = want != null && slots.length > 0 && slots.length !== want;

    return {
      key: `${r.recipient_id}|${r.service_id}`,
      recipientId: r.recipient_id,
      recipient: p.name ?? "",
      dong: r.dong ?? "",
      /*
       * 대상자 메모 — **출력물에는 한 글자도 안 나갑니다.**
       * 「대문 왼쪽 개 있음」 「귀가 어두우셔서 크게」 같은, 가는 사람이
       * 알아야 하는 말입니다. 배정 화면은 사람을 정하는 곳이니
       * 여기 안 보이면 아무도 안 봅니다.
       */
      memo: r.rmemo ?? "",
      recipientStatus: r.rstatus,
      serviceId: r.service_id,
      service: r.service,
      unit: r.unit,
      from: r.period_from,
      to: r.period_to,
      cycle: r.cycle_text ?? "",
      cycleUnit: r.cycle_unit,
      cycleCount: r.cycle_count,
      byDow,
      ended,

      assignId: a?.id ?? null,
      workerId: a?.worker_id ?? null,
      workerUserId: a?.user_id ?? null,
      worker: a?.worker_name ?? "",
      workerDong: a?.worker_dong ?? "",
      // 맡고 있던 사람이 쉬러 갔는지. 배정은 그대로 두고 **알려만 줍니다** —
      // 대타를 누구로 할지는 기관이 정할 일입니다.
      workerOnLeave: a?.worker_status === "leave",
      sameDong: !!a && !!r.dong && a.worker_dong === r.dong,
      slots,
      slotText: slotText(slots) + (Number(a?.monthly_times ?? 0) > 0
        ? ` (${주기말(Number(a.monthly_times))})` : ""),
      // 한 달에 몇 번까지. 0 이면 매주 (v34).
      monthlyTimes: Number(a?.monthly_times ?? 0),
      assignFrom: a?.period_from ?? null,
      assignTo: a?.period_to ?? null,

      assignEnded: !!a?.period_to && a.period_to < now,

      // 상태 — 화면에서 거르는 데 씁니다.
      //
      // 「종결자」와 「지난의뢰」가 앞에 오는 이유가 있습니다.
      // 끝난 사람과 끝난 기간은 **배정할 거리가 아닙니다.**
      // 이걸 미배정으로 세면 "58건이 밀려 있습니다"가 되어 화면이 늑대소년이
      // 됩니다 — 두 번만 그러면 아무도 안 봅니다.
      state: DONE_STATUS.includes(r.rstatus) ? "종결자"
        : r.rstatus === "중단" ? "중단중"
        : ended ? "지난의뢰"
        : !a || a.period_to && a.period_to < now ? "미배정"
        // 요일로 펴는 서비스만 「계획없음」을 따집니다.
        // 월·생애 단위는 요일이 없는 게 정상입니다.
        : byDow && slots.length === 0 ? "계획없음"
        : countOff ? "확인필요" : "배정됨",
      countOff,
      want,
    };
  });

  const q = (opts.q ?? "").trim().toLowerCase();
  return items.filter(
    (x) =>
      (!q || [x.recipient, x.service, x.worker].some((v) => v.toLowerCase().includes(q))) &&
      // 상태를 안 고르면 **지금 할 일이 아닌 것**은 뺍니다.
      // 「__all」이라고 보내면 그것까지 전부 봅니다.
      (opts.state === "__all" ? true
        : opts.state ? x.state === opts.state
        : !HIDDEN.includes(x.state)) &&
      (!opts.dong || x.dong === opts.dong) &&
      (!opts.service || String(x.serviceId) === opts.service) &&
      (!opts.workerId || String(x.workerUserId) === opts.workerId)
  );
}

// ── 담당으로 고를 사람 ─────────────────────────────────────
/**
 * 제공인력 역할을 가진 사람이 먼저, 그 밖의 종사자가 뒤에 옵니다.
 *
 * 뒤쪽 사람도 고를 수 있게 둔 이유가 있습니다.
 * 해남에서는 **관리자가 직접 식사지원을 나갑니다.** 그럴 때
 * "먼저 역할부터 바꾸고 오세요"라고 돌려보내면 일이 끊깁니다.
 * 고르는 순간 제공인력 역할을 함께 켜 줍니다(화면에서 한 번 묻습니다).
 */
export function workerOptions(dong?: string) {
  const now = today();
  const rows = db.query(
    `SELECT u.id, u.name, u.dong, u.roles, u.role, u.status,
            w.id AS worker_id, w.payroll_excluded,
            (SELECT COUNT(*) FROM assignment a
              WHERE a.worker_id = w.id
                AND (a.period_to IS NULL OR a.period_to >= ?)) AS load
       FROM app_user u
       LEFT JOIN worker w ON w.user_id = u.id
      WHERE u.status IN ('active', 'leave')
      ORDER BY u.name`
  ).all(now) as any[];

  return rows
    .map((r) => {
      const roles = parseRoles(r.roles ?? r.role);
      return {
        userId: r.id,
        name: r.name,
        dong: r.dong ?? "",
        isWorker: roles.includes("worker"),
        rolesKo: roles.join(","),
        load: r.load ?? 0,
        payrollExcluded: !!r.payroll_excluded,
        /*
         * 쉬고 있는 사람.
         *
         * **목록에서 감추지 않습니다.** 감추면 「최돌봄 선생님이 왜 없지」가 되고,
         * 찾다가 새 계정을 하나 더 만드는 일이 벌어집니다.
         * 보이되 맨 아래에 두고, 고르면 그때 막습니다.
         */
        onLeave: r.status === "leave",
        // 가까운 사람을 먼저 보여줍니다. 이동 시간이 곧 비용입니다.
        near: !!dong && !!r.dong && r.dong === dong,
      };
    })
    .sort(
      (a, b) =>
        Number(a.onLeave) - Number(b.onLeave) ||
        Number(b.isWorker) - Number(a.isWorker) ||
        Number(b.near) - Number(a.near) ||
        a.load - b.load ||
        a.name.localeCompare(b.name, "ko")
    );
}

// ── 그 요일에 얼마나 물려 있나 ─────────────────────────────
/**
 * 이 담당이 요일마다 이미 몇 곳을 맡고 있는지.
 *
 * 시각이 없으니 "10시에 두 곳" 같은 겹침은 따질 수 없습니다.
 * 대신 **하루에 몇 곳인지**는 셀 수 있고, 그게 실제로 쓸모 있는 숫자입니다 —
 * 월요일에만 여덟 곳이 몰린 계획은 지킬 수 없는 계획입니다.
 *
 * 막지 않고 보여만 줍니다. 몇 곳까지가 무리인지는 기관이 압니다.
 */
export function workerDayLoad(
  userId: number, from: string | null, to: string | null, exceptId?: number | null
) {
  const w = db.query<{ id: number }, [number]>(
    "SELECT id FROM worker WHERE user_id = ?"
  ).get(userId);
  const dayLoad = [0, 0, 0, 0, 0, 0, 0];
  if (!w) return { dayLoad, detail: [] as any[] };

  const others = db.query(
    `SELECT a.id, a.weekly_plan, a.period_from, a.period_to,
            sv.name AS service, r.payload AS rpayload
       FROM assignment a
       LEFT JOIN service sv  ON sv.id = a.service_id
       LEFT JOIN recipient r ON r.id = a.recipient_id
      WHERE a.worker_id = ? AND a.id <> ?`
  ).all(w.id, exceptId ?? -1) as any[];

  const detail: any[] = [];
  for (const o of others) {
    if (!periodsOverlap(from, to, o.period_from, o.period_to)) continue;
    for (const t of parseSlots(o.weekly_plan)) {
      dayLoad[t.dow]++;
      detail.push({
        dow: t.dow,
        who: `${JSON.parse(o.rpayload || "{}").name ?? ""} · ${o.service ?? ""}`,
      });
    }
  }
  return { dayLoad, detail };
}

// ── 저장 ───────────────────────────────────────────────────
type SaveInput = {
  recipientId: string;
  serviceId: number;
  userId: number;          // 담당으로 고른 사람 (app_user.id)
  from?: string | null;
  to?: string | null;
  slots?: Slot[];
  /** 한 달에 몇 번까지. **0 이면 매주** (v34). */
  monthlyTimes?: number | null;
  allowRoleAdd?: boolean;  // 제공인력 역할이 없으면 함께 켤지
};

/** 제공인력 역할이 없으면 켜고 worker 줄을 만듭니다. */
function ensureWorker(userId: number, allow: boolean): number {
  const u = db.query<any, [number]>("SELECT * FROM app_user WHERE id = ?").get(userId);
  if (!u) throw new Error("그 사람을 찾을 수 없습니다.");

  const roles = parseRoles(u.roles ?? u.role);
  const has = db.query<{ id: number }, [number]>(
    "SELECT id FROM worker WHERE user_id = ?"
  ).get(userId);

  if (roles.includes("worker") && has) return has.id;
  /*
   * 역할이 없는 것과 **제공인력 줄이 없는 것**은 다른 일입니다.
   * 역할은 켜져 있는데 줄만 없는 사람에게 「역할이 없습니다」라고 하면
   * 관리자는 종사자 화면에 가서 이미 켜진 것을 보고 되돌아옵니다.
   * (2026-09-08 파일럿 예행에서 걸렸습니다.)
   */
  if (!allow)
    throw new Error(
      roles.includes("worker")
        ? `${u.name} 님은 제공인력으로 등록된 줄이 없습니다. ` +
          `지금 만들고 배정할지 확인해 주세요.`
        : `${u.name} 님은 제공인력 역할이 없습니다. 역할을 함께 켜고 배정할지 확인해 주세요.`
    );

  if (!roles.includes("worker")) {
    const next = [...roles, "worker"];
    db.run("UPDATE app_user SET roles = ? WHERE id = ?", [JSON.stringify(next), userId]);
  }
  if (has) return has.id;

  const info = db.run(
    `INSERT INTO worker (user_id, payload, geo_consent, status, created_at)
     VALUES (?, '{}', 0, 'active', ?)`,
    [userId, new Date().toISOString()]
  );
  return Number(info.lastInsertRowid);
}

/**
 * ── 한도를 넘는 계획은 **저장하지 않습니다** (2026-09-08 무무 지시) ──
 *
 * (무무 — 「연간 150만원/월한도 넘길 때 — **막지만** 한도를 넘게
 *  계획했다고 관리자에게 알려야 함」 / 막는 자리는 「**가. 계획**.
 *  계획이 안되면 실적도 따라서 할 수가 없어.」)
 *
 * 2026-09-07 까지는 **두 번 묻고 지나가게** 했습니다. 이제 막습니다.
 * 편람이 「어떤 경우에도 **계획보다** 비용이나 회차를 초과하여 제공하는
 * 것은 불가」라고 못박고 있어, **계획을 잠그면 실적이 따라 잠깁니다.**
 * 실적에서 막지 않는 까닭은 — 현장에서 **이미 다녀온 것**을 못 적게
 * 하면 기록이 사라지고, 사라진 기록은 되살릴 수 없습니다.
 *
 * ── ★ 「줄이는 저장」은 언제나 됩니다 ★ (제 판단입니다) ─────
 *
 * 곧이곧대로 막으면 덫이 하나 생깁니다. **이미 넘겨 저장돼 있는 배정**
 * (옛 자료함, 또는 군과 협의해 넘긴 것)이 있으면 그 배정의 **담당자만
 * 바꾸려 해도** 저장이 막혀 고칠 길이 없어집니다.
 *
 * 그래서 **지금 저장돼 있는 것보다 커지는 것만** 막습니다. 같거나
 * 줄이는 저장은 늘 통과합니다. 새로 넘기는 것만 막힙니다.
 *
 * ── 못 재면 막지 않습니다 ──────────────────────────────────
 * 재는 데 탈이 나면 **저장을 통과시킵니다.** 재기가 고장 났다고
 * 기관의 일을 멈춰 세울 수는 없습니다 — 막는 것이 목적이 아니라
 * 넘기지 않게 돕는 것이 목적입니다.
 */
function 한도넘나(
  recipientId: string, serviceId: number,
  slots: Slot[], from: string | null, to: string | null,
  달번: number, cur: any | null
): string | null {
  let 새것: any;
  try {
    새것 = 계획재기(recipientId, serviceId, slots as any,
                    { 배정번호: cur?.id ?? null, from, to, 달몇번: 달번 });
  } catch { return null; }

  const 넘은칸 = (새것?.칸들 ?? []).filter((k: any) => k.넘나);
  if (!넘은칸.length) return null;

  /* 지금 저장돼 있는 계획도 같은 자로 재 봅니다. */
  const 옛합 = new Map<string, number>();
  if (cur) {
    try {
      const 옛슬롯 = parseSlots(JSON.parse(String(cur.weekly_plan ?? "[]")));
      const 옛것 = 계획재기(recipientId, serviceId, 옛슬롯 as any,
                            { 배정번호: cur.id, from: cur.period_from, to: cur.period_to,
                              달몇번: Number(cur.monthly_times ?? 0) });
      for (const k of 옛것?.칸들 ?? []) 옛합.set(k.이름, Number(k.합));
    } catch { /* 옛것을 못 재면 견주지 않고 막습니다 */ }
  }

  /* 늘어난 칸만 막습니다. 같거나 줄었으면 통과. */
  const 늘어난 = 넘은칸.filter((k: any) =>
    !(옛합.has(k.이름) && Number(k.합) <= (옛합.get(k.이름) as number)));
  if (!늘어난.length) return null;

  const 값말 = (k: any, n: number) =>
    k.단위 === "분" ? 시간말(n)
    : k.단위 === "회" ? `${Math.round(n)}번`
    : `${Math.round(n).toLocaleString("ko-KR")}원`;

  const 줄들 = 늘어난.map((k: any) =>
    `· ${k.이름}\n` +
    `  ${값말(k, k.합)} / ${값말(k, k.한도)} — ${값말(k, Math.max(0, k.합 - k.한도))} 넘습니다\n` +
    (k.설명 ? `  ${k.설명}\n` : "")
  ).join("");

  /*
   * ★ 「한 달에 몇 번」으로 들 수 있으면 **그 수를 알려 줍니다.**
   *   월 2회짜리를 매주로 잡으면 요일을 아무리 줄여도 못 듭니다 —
   *   한 주에 한 번이 제일 적은데 그것만도 한 달 4~5번이기 때문입니다.
   *   「요일을 줄이세요」만 하면 관리자는 될 때까지 요일만 지웁니다.
   */
  const 횟수칸 = 늘어난.find((k: any) => k.단위 === "회" && k.한도 >= 1 && k.한도 <= 4);
  const 길잡이 = 횟수칸 && 달번 === 0
    ? `\n★ 이 서비스는 **${주기말(횟수칸.한도)}**까지입니다. 배정의 「가는 주기」를 ` +
      `**${주기말(횟수칸.한도)}**으로 바꾸면 한도 안에 듭니다 — ` +
      `요일만 줄여서는 들 수 없습니다(한 주에 한 번이라도 한 달 4~5번입니다).`
    : "";

  return `이 계획은 한도를 넘습니다. 이대로는 저장할 수 없습니다.\n\n` + 줄들 + 길잡이 +
    `\n\n요일이나 시간을 줄여 한도 안에 들게 고쳐 주세요. ` +
    `군과 협의해 넘겨야 하는 것이면 설정에서 그 한도를 먼저 고쳐야 합니다.`;
}

export function saveAssign(b: SaveInput) {
  if (!b.recipientId) throw new Error("대상자가 없습니다.");
  if (!b.serviceId) throw new Error("서비스가 없습니다.");
  if (!b.userId) throw new Error("담당을 골라 주세요.");

  /*
   * 쉬는 사람에게는 새로 붙이지 않습니다.
   *
   * 이미 맡고 있던 배정은 그대로 둡니다 — 그건 지난 일이고, 프로그램이
   * 말없이 닫아 버리면 그 대상자가 「미배정」으로 조용히 사라집니다.
   * 막는 것은 **지금 새로 붙이는 것** 하나입니다.
   */
  if (isOnLeave(b.userId)) {
    const who = db.query<{ name: string; leave_to: string | null }, [number]>(
      "SELECT name, leave_to FROM app_user WHERE id = ?"
    ).get(b.userId);
    const 언제 = who?.leave_to ? ` (${who.leave_to} 복직 예정)` : "";
    throw new Error(
      `${who?.name ?? "그분"}은(는) 휴직 중입니다${언제}. 다른 분을 골라 주세요.`
    );
  }

  const slots = parseSlots(b.slots ?? []);
  const from = b.from || null;
  const to = b.to || null;
  if (from && to && to < from) throw new Error("배정 기간의 끝이 시작보다 빠릅니다.");

  const workerId = ensureWorker(b.userId, !!b.allowRoleAdd);
  const now = today();
  const stamp = new Date().toISOString();

  const cur = db.query<any, [string, number, string]>(
    `SELECT * FROM assignment
      WHERE recipient_id = ? AND service_id = ?
        AND (period_to IS NULL OR period_to >= ?)
      ORDER BY id DESC LIMIT 1`
  ).get(b.recipientId, b.serviceId, now);

  /*
   * ★ 여기서 막습니다 — **자료함에 손대기 전에.**
   *   화면에도 같은 경고가 있지만, 화면은 우회할 수 있습니다.
   *   막는 자리는 **저장하는 곳 하나**여야 합니다.
   */
  const 달번 = 달몇번({ monthly_times: b.monthlyTimes ?? 0 });
  const 막을말 = 한도넘나(b.recipientId, b.serviceId, slots, from, to, 달번, cur ?? null);
  if (막을말) throw new Error(막을말);

  // 같은 사람이면 고쳐 씁니다. 담당이 바뀌면 옛 줄을 닫고 새로 넣습니다 —
  // 덮어쓰면 "3월에는 누가 갔었나"에 답할 수 없게 됩니다.
  if (cur && cur.worker_id === workerId) {
    db.run(
      `UPDATE assignment SET period_from = ?, period_to = ?, weekly_plan = ?,
              planned_count = ?, monthly_times = ?
         WHERE id = ?`,
      [from, to, JSON.stringify(slots), slots.length, 달번, cur.id]
    );
    /*
     * ★ 여기에도 있어야 합니다.
     *
     * 처음에는 **새로 넣는 쪽에만** 붙여 두었습니다. 그래서 요일이나
     * 기간을 **고치기만 하면** 현장앱이 최대 10분 동안 옛것을 들고
     * 있었습니다. 관리자는 저장을 눌렀으니 됐다고 생각합니다.
     * (2026-09-05 무무 지적 — 「배정하고 저장하는 순간 바로 올리도록
     *  구성했던 것 같은데」. 맞습니다. 한쪽만 붙어 있었습니다.)
     */
    바로보내기();
    return { id: cur.id as number, replaced: false };
  }

  if (cur) {
    // 새 배정이 시작되기 하루 전까지만 옛 담당입니다.
    const end = from ? addDays(from, -1) : now;
    db.run("UPDATE assignment SET period_to = ? WHERE id = ?", [end, cur.id]);
  }

  const info = db.run(
    `INSERT INTO assignment
       (recipient_id, worker_id, service_id, period_from, period_to,
        weekly_plan, planned_count, monthly_times, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.recipientId, workerId, b.serviceId, from, to, JSON.stringify(slots),
     slots.length, 달번, stamp]
  );
  /*
   * 배정이 바뀌면 **바로** 우편함에 올립니다.
   * 10분마다 올리는 것만으로는, 방금 배정한 대상자가 현장앱에
   * 최대 10분 동안 안 보입니다. 관리자가 「왜 안 뜨지」 하게 됩니다.
   *
   * 기다리지 않습니다(await 없음) — 인터넷이 느려도 저장 화면은
   * 바로 넘어가야 합니다. 실패해도 10분 뒤 차례에 다시 올라갑니다.
   */
  바로보내기();

  return { id: Number(info.lastInsertRowid), replaced: !!cur };
}

/**
 * 대상자가 끝나면 그 사람의 살아 있는 배정을 **모두 닫습니다.**
 *
 * 종결·취소된 사람이 배정 목록에 남아 있으면 제공인력이 계속 그 집에
 * 가야 하는 것처럼 보이고, 「미배정 n건」에도 섞여 셈이 틀립니다.
 *
 * **지우지 않고 닫습니다.** 그 사람에게 누가 언제까지 다녔는지는
 * 대상자·종사자 화면의 이력으로 남아야 합니다. 지자체가 묻습니다.
 */
export function closeAssignments(recipientId: string, on?: string) {
  // 닫힌 배정도 바로 반영되어야 합니다 — 안 그러면 현장앱에 계속 뜹니다.
  queueMicrotask(바로보내기);
  const day = (on ?? today()).slice(0, 10);
  const info = db.run(
    `UPDATE assignment SET period_to = ?
      WHERE recipient_id = ?
        AND (period_to IS NULL OR period_to > ?)`,
    [day, recipientId, day]
  );
  return { closed: Number(info.changes ?? 0) };
}

/**
 * 배정 지우기.
 *
 * 아직 시작 전이면 줄을 없앱니다(잘못 넣은 것이니까).
 * 이미 시작했으면 지우지 않고 어제 날짜로 닫습니다 —
 * 그 사람이 다녀온 날들이 있는데 배정이 사라지면 실적이 붕 뜹니다.
 */
export function removeAssign(id: number) {
  queueMicrotask(바로보내기);
  const a = db.query<any, [number]>("SELECT * FROM assignment WHERE id = ?").get(id);
  if (!a) throw new Error("그 배정을 찾을 수 없습니다.");
  const now = today();
  const started = !a.period_from || a.period_from <= now;
  if (started) {
    db.run("UPDATE assignment SET period_to = ? WHERE id = ?", [addDays(now, -1), id]);
    return { closed: true };
  }
  db.run("DELETE FROM assignment WHERE id = ?", [id]);
  return { closed: false };
}

/** 한 줄을 고칠 때 화면이 필요로 하는 것 전부. */
export function assignDetail(recipientId: string, serviceId: number) {
  const row = listAssign({ state: "__all" }).find(
    (x) => x.recipientId === recipientId && x.serviceId === serviceId
  );
  if (!row) throw new Error("배정할 대상을 찾을 수 없습니다.");

  // 그 사람의 한 주 전체.
  //
  // 지금 고치는 서비스만 보면 "화요일 10시" 가 비어 보이지만,
  // 같은 사람에게 다른 서비스가 이미 그 시간에 잡혀 있을 수 있습니다.
  // 맞춤돌봄케어가 대상자 화면에 일~토 한 버전을 통째로 깔아 두던 이유입니다.
  const week: any[] = [];
  for (const a of db.query(
    `SELECT a.service_id, a.weekly_plan, sv.name AS service, u.name AS worker
       FROM assignment a
       LEFT JOIN service sv  ON sv.id = a.service_id
       LEFT JOIN worker w    ON w.id  = a.worker_id
       LEFT JOIN app_user u  ON u.id  = w.user_id
      WHERE a.recipient_id = ?
        AND (a.period_to IS NULL OR a.period_to >= date('now','localtime'))`
  ).all(recipientId) as any[]) {
    for (const s of parseSlots(a.weekly_plan)) {
      week.push({
        ...s, service: a.service ?? "", worker: a.worker ?? "",
        mine: a.service_id === serviceId,
      });
    }
  }
  week.sort((a, b) => a.dow - b.dow);

  return {
    row,
    week,
    workers: workerOptions(row.dong),
    history: db.query(
      `SELECT a.id, a.period_from, a.period_to, a.weekly_plan, u.name AS worker
         FROM assignment a
         LEFT JOIN worker w   ON w.id = a.worker_id
         LEFT JOIN app_user u ON u.id = w.user_id
        WHERE a.recipient_id = ? AND a.service_id = ?
        ORDER BY a.id DESC`
    ).all(recipientId, serviceId).map((h: any) => ({
      id: h.id, worker: h.worker ?? "", from: h.period_from, to: h.period_to,
      slotText: slotText(parseSlots(h.weekly_plan)),
    })),
  };
}

/**
 * 오늘 갈 곳을 우편함에 바로 올립니다.
 *
 * `할일보내기` 를 위에서 import 하면 서로 부르는 모양이 되어
 * (할일보내기 → 우편함 → …) 꼬일 수 있어, **쓸 때 불러옵니다.**
 * 우편함을 안 쓰는 기관이면 그쪽에서 조용히 넘어갑니다.
 */
function 바로보내기(): void {
  import("./할일보내기")
    .then((m) => m.오늘갈곳보내기())
    .then((r) => {
      if (r.올린수) console.log(`우편함: 배정이 바뀌어 ${r.올린수}곳을 올렸습니다`);
      if (r.치운수) console.log(`우편함: 더는 안 가는 ${r.치운수}곳을 치웠습니다`);
    })
    .catch((e) => console.error("우편함: 바로 올리기 실패 —", (e as Error).message));
}
