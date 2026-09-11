import { db } from "./db";
import { 알림거리 as USB알림거리 } from "./USB동기화";
import { today, daysUntil, addDays, calcAge } from "./util";
import { 생애한도현황 } from "./stats";
import { 한도임박 as 연간한도임박셈 } from "./한도";

/**
 * 홈 — 오늘 손을 대야 하는 것만.
 *
 * ── 왜 필요한가 ────────────────────────────────────────────
 * 지자체는 「이 사람 끝났습니다」라고 따로 알려주지 않습니다.
 * 명단에 적힌 기간이 지나면 그걸로 끝인데, 기관이 그걸 챙기지 못하면
 * **끝난 사람이 이용 중으로 남아** 다음 정산과 보고가 통째로 어긋납니다.
 *
 * 그래서 프로그램이 대신 셉니다. 판단은 사람이 합니다 —
 * 지자체가 말로 연장을 알려 준 경우가 실제로 있어서, 기계가 자동으로
 * 종결시켜 버리면 안 됩니다. **알려주고, 사람이 누르게 합니다.**
 *
 * 여기 뜨는 것
 *   ① 받는 서비스가 **전부** 기간이 끝난 사람 → 종결 · 중단 · 연장
 *   ② 중단한 지 90일이 지난 사람            → 지침상 종결 검토 대상
 *   ③ 곧 끝나는 사람 (14일 안)              → 연장 여부를 미리 물어볼 것
 *   ④ 식사지원을 연속으로 못 받은 사람      → 계약서 5-2조
 */

export type HomeItem = ReturnType<typeof shape>;

function shape(r: any, extra: Record<string, unknown> = {}) {
  const p = JSON.parse(r.payload || "{}");
  return {
    id: r.id,
    name: p.name ?? "",
    birth: p.birth ?? "",
    age: calcAge(p.birth),
    phone: p.phone ?? "",
    dong: r.dong ?? "",
    status: r.status,
    ...extra,
  };
}

/** 그 사람이 받는 서비스마다 '가장 나중 의뢰' 하나씩. */
function servicesOf(recipientId?: string) {
  const rows = db.query(
    `SELECT recipient_id, service_id, name, period_from, period_to, cycle_text FROM (
       SELECT rf.recipient_id, rf.service_id, sv.name, rf.period_from, rf.period_to, rf.cycle_text,
              ROW_NUMBER() OVER (
                PARTITION BY rf.recipient_id, rf.service_id
                ORDER BY COALESCE(rf.period_from,'') DESC, rf.id DESC) AS rn
         FROM referral rf JOIN service sv ON sv.id = rf.service_id
        ${recipientId ? "WHERE rf.recipient_id = ?" : ""}
     ) WHERE rn = 1`
  ).all(...(recipientId ? [recipientId] : [])) as any[];

  const by = new Map<string, any[]>();
  for (const v of rows) {
    const list = by.get(v.recipient_id) ?? [];
    list.push(v);
    by.set(v.recipient_id, list);
  }
  return by;
}

const SUSPEND_DAYS = 90;
const SOON_DAYS = 14;
const NO_SHOW_WARN = 2;

export function home() {
  const now = today();
  const svc = servicesOf();
  const people = db.query("SELECT * FROM recipient").all() as any[];

  const expired: any[] = [];   // ① 전부 끝남
  const soon: any[] = [];      // ③ 곧 끝남

  /*
   * 「대기중」 — 이용 중인데 **갈 사람이 안 붙은 서비스가 있는** 분.
   *
   * ★ 사람 단위가 아니라 **사람 + 서비스 단위**로 셉니다.
   *
   *   처음에는 `SELECT DISTINCT recipient_id FROM assignment` 로
   *   「이 사람에게 배정이 하나라도 있나」만 봤습니다. 그랬더니
   *   가사지원·식사지원을 함께 받는 분에게 **가사지원만 붙여도**
   *   그분이 목록에서 통째로 사라졌습니다. 식사지원은 여전히 갈 사람이
   *   없는데도 화면은 「다 붙었습니다」라고 말합니다.
   *   (2026-09-05 무무가 현장에서 발견.)
   *
   *   놓치는 쪽으로 틀리는 셈이라 더 나쁩니다 — 없는 일을 있다고
   *   하는 것보다, 있는 일을 없다고 하는 쪽이 사고로 이어집니다.
   */
  /*
   * ── ★ 2026-09-05 또 하나 ──────────────────────────────────
   *
   *   **줄만 있으면 「붙었다」로 보고 있었습니다.**
   *
   *   배정 줄은 남아 있는데 갈 사람이 없는 경우가 둘 있습니다 —
   *     ① 관리자가 담당을 지웠다 (`worker_id` 가 비었습니다)
   *     ② 그 사람이 **퇴사했다** — 배정 줄은 그대로 남습니다
   *
   *   둘 다 「그날 갈 사람이 없다」는 뜻인데 홈은 「대기중 0」이라고
   *   말했습니다. 시범자료로 확인했습니다 — 제공인력을 계약종료로
   *   바꿔도 그분이 맡던 어르신이 대기 목록에 안 떴습니다.
   *
   *   위에 적어 둔 것과 **같은 갈래의 잘못**입니다. 있는 일을 없다고
   *   하는 쪽이라, 그날 아무도 안 가고 기록지에 구멍이 납니다.
   *
   *   휴직은 뺍니다 — 돌아오실 분이고, 배정을 그대로 두는 것이 맞습니다
   *   (배정 화면도 **새로 붙이는 것만** 막고 있던 것은 안 건드립니다).
   */
  const 붙은것 = new Set(
    (db.query<{ recipient_id: string; service_id: number }, [string]>(
      `SELECT DISTINCT a.recipient_id, a.service_id
         FROM assignment a
         JOIN worker   w ON w.id = a.worker_id
         JOIN app_user u ON u.id = w.user_id
        WHERE (a.period_to IS NULL OR a.period_to >= ?)
          AND w.status <> 'resigned'
          AND u.status <> 'resigned'`
    ).all(now)).map((r) => `${r.recipient_id}|${r.service_id}`)
  );

  /** 그 분의 서비스 중 **아직 갈 사람이 없는** 것만. */
  const 안붙은서비스 = (r: any) =>
    (svc.get(r.id) ?? [])
      .filter((v: any) => !v.period_to || v.period_to >= now)          // 살아 있는 것만
      .filter((v: any) => !붙은것.has(`${r.id}|${v.service_id}`));

  for (const r of people) {
    if (r.status !== "이용") continue;
    const list = svc.get(r.id) ?? [];
    if (list.length === 0) continue;

    // 기간이 없는(열린) 서비스가 하나라도 있으면 끝난 게 아닙니다.
    const allEnded = list.every((v) => !!v.period_to && v.period_to < now);
    if (allEnded) {
      const last = list
        .map((v) => v.period_to)
        .sort()
        .at(-1) as string;
      expired.push(
        shape(r, {
          endedOn: last,
          daysSince: -(daysUntil(last) ?? 0),
          services: list.map((v) => ({
            name: v.name, from: v.period_from, to: v.period_to, cycle: v.cycle_text,
          })),
        })
      );
      continue;
    }

    // 아직 살아 있는 것 중 가장 먼저 끝나는 것.
    const live = list.filter((v) => !v.period_to || v.period_to >= now);
    const next = live
      .map((v) => v.period_to)
      .filter(Boolean)
      .sort()[0] as string | undefined;
    const left = next ? daysUntil(next) : null;
    if (left !== null && left <= SOON_DAYS) {
      soon.push(
        shape(r, {
          endsOn: next,
          daysLeft: left,
          // 끝나는 것만 추려 보여줍니다. 아직 한참 남은 서비스는 알 바 아닙니다.
          services: live
            .filter((v) => v.period_to === next)
            .map((v) => ({ name: v.name, to: v.period_to, cycle: v.cycle_text })),
        })
      );
    }
  }

  // ② 중단 90일 경과 — 지침상 종결 검토 대상입니다.
  const suspended = (db.query(
    "SELECT * FROM recipient WHERE status = '중단'"
  ).all() as any[])
    .map((r) => {
      const deadline = r.suspend_deadline ?? (r.status_since ? addDays(r.status_since, SUSPEND_DAYS) : null);
      return shape(r, {
        since: r.status_since,
        reason: r.status_reason,
        deadline,
        daysLeft: deadline ? daysUntil(deadline) : null,
      });
    })
    .filter((x: any) => x.daysLeft !== null && x.daysLeft <= 0);

  // ④ 식사지원 연속 미수령 — 계약서 5-2조. 3회면 전체 중지입니다.
  const noShow = (db.query(
    "SELECT * FROM recipient WHERE no_show_streak >= ? AND status = '이용'"
  ).all(NO_SHOW_WARN) as any[]).map((r) =>
    shape(r, { streak: r.no_show_streak, lastOn: r.last_no_show_on })
  );

  /*
   * ⑤ 제공인력이 안 붙은 대상자 — **오늘 손댈 것 중 가장 급합니다.**
   *
   * 서비스는 정해졌는데 갈 사람이 없다는 뜻입니다.
   * 이대로 하루가 가면 **그날 서비스는 그냥 안 나간 것**이 되고,
   * 나중에 기록지에 구멍이 납니다.
   *
   * 숫자만 보여 주다가 **누구인지 안 나온다**는 지적을 받았습니다.
   * 「세 분에게 안 붙었습니다」만 보면 배정 화면에 가서 다시 찾아야 합니다.
   * 셈은 프로그램이 하고, 사람은 **이름을 보고 바로** 붙일 수 있어야 합니다.
   */
  const unassigned = people
    .filter((r) => r.status === "이용" && 안붙은서비스(r).length > 0)
    .map((r) => {
      /*
       * 여기 적히는 서비스는 **아직 안 붙은 것만**입니다.
       * 이미 붙은 것까지 같이 적으면, 화면을 보고 붙이러 간 사람이
       * 「이건 이미 붙었는데?」 하고 헷갈립니다.
       */
      const 남은것 = 안붙은서비스(r);
      const 시작 = 남은것.map((v: any) => v.period_from).filter(Boolean).sort()[0] as string | undefined;
      return shape(r, {
        services: 남은것.map((v: any) => ({
          name: v.name, from: v.period_from, to: v.period_to, cycle: v.cycle_text,
        })),
        // 언제부터 갈 사람이 없었는가. 오래 기다린 분이 더 급합니다.
        since: 시작 ?? null,
        daysWaiting: 시작 ? -(daysUntil(시작) ?? 0) : null,
      });
    });

  const byName = (a: any, b: any) => String(a.name).localeCompare(String(b.name), "ko");
  expired.sort((a, b) => String(a.endedOn).localeCompare(String(b.endedOn)) || byName(a, b));
  soon.sort((a, b) => a.daysLeft - b.daysLeft || byName(a, b));
  // 오래 기다린 분이 맨 위로. 어제 들어온 분보다 한 달 기다린 분이 급합니다.
  unassigned.sort((a: any, b: any) => (b.daysWaiting ?? 0) - (a.daysWaiting ?? 0) || byName(a, b));

  /*
   * 생애한도가 다 되어 가는 분.
   *
   * **넘기면 그 돈은 기관이 떠안습니다.** 그래서 다 쓴 뒤가 아니라
   * 80%부터 홈에 올립니다 — 공사를 잡기 전에 알아야 취소할 수 있습니다.
   * 셈은 통계 쪽 하나가 합니다. 여기서 또 셈하면 두 화면이 다른 말을 합니다.
   */
  const 한도 = 생애한도현황();
  const 한도임박 = (한도.줄들 ?? [])
    .filter((x: any) => x.넘음 || x.임박)
    .map((x: any) => ({
      id: x.recipientId, name: x.이름, dong: x.dong, status: x.status,
      service: x.service, 한도: x.한도, 쓴돈: x.쓴돈, 남은돈: x.남은돈,
      비율: Math.round(x.비율 * 100), 넘음: x.넘음, 마지막: x.마지막,
    }));

  /*
   * ── 연간 지원한도가 다 되어 가는 분 (7-마) ──────────────────
   *
   * 위의 「한도임박」과 **다른 것**입니다. 그건 안전생활환경개선의
   * **생애** 한도(공사 한 건)이고, 이건 한 사람이 그 해에 받은
   * **일상생활돌봄 전체**의 연간 150만원입니다.
   *
   * 계약서 4조가 어르신께 「연간 지원한도액에서 차감됩니다」라고
   * 약속한 그 숫자입니다. **넘긴 뒤에 알면 이미 나간 돈**이라
   * 90% 부터 올립니다.
   */
  const 올해 = Number(now.slice(0, 4));
  const 연간임박 = 연간한도임박셈(올해, 0.9).map((x: any) => ({
    id: x.id, name: x.name, dong: x.dong, status: x.status,
    쓴돈: x.일상.쓴돈, 한도: x.일상.한도, 남은돈: x.일상.남은돈,
    비율: Math.round(x.일상.비율 * 100), 넘음: x.일상.넘었나,
  }));

  /*
   * ── USB 로 오간 자료 (2026-09-06 무무) ──────────────────────
   *
   * 「집에서 작업 시 다음날 출근하여 백업USB를 기관PC에 꽂아 프로그램을
   *  열면 최신 데이터로 동기화 해줘야 해」
   *
   * ★ **홈에 띄우는 것이 핵심입니다.** 설정 깊은 데 두면, 어제 집에서
   *   한 일이 있다는 것을 아무도 모른 채 사무실 자료함에 계속 적습니다.
   *   그러면 두 갈래가 점점 벌어져서, 나중에는 어느 쪽도 못 버립니다.
   *
   * ★ **여기서 아무것도 안 바꿉니다.** 보여 주기만 합니다 —
   *   자료함을 통째로 바꾸는 일은 사람이 눌러야 합니다.
   *
   * USB 를 못 읽어도 홈 화면은 떠야 하므로 안에서 삼킵니다.
   */
  let USB: ReturnType<typeof USB알림거리> | null = null;
  try { USB = USB알림거리(); } catch { USB = null; }

  /*
   * ── ★ 설정 점검 — 프로그램이 **스스로 말합니다** ★ ──────────
   *
   * (`할일.md` 8번 — 「홈에 **설정 점검** 한 줄. 문서는 안 읽혀도
   *  홈은 매일 봅니다」 / 7-하 ⑦ — 「공휴일은 마법사에서 안 묻는 대신
   *  **홈에 「올해 공휴일이 하나도 없습니다」**를 띄웁니다」)
   *
   * 최초 설정 마법사가 단가·한도는 눈앞에 보여 주고 확인받습니다.
   * 그런데 **공휴일은 달력을 손에 들고 있어야** 넣을 수 있어 그 자리에서
   * 못 묻습니다. 그래서 넣으실 때까지 여기서 말합니다.
   *
   * ★ 단가가 0 인 서비스도 함께 봅니다 — 0 이면 그 서비스는
   *   **청구서에 0원으로 나갑니다.** 아무도 안 알려 주면 한 달 뒤에
   *   압니다.
   */
  const 점검: { 무엇: string; 말: string; 어디: string }[] = [];
  try {
    const 해 = Number(now.slice(0, 4));
    const 공휴 = db.query<{ c: number }, [string]>(
      "SELECT COUNT(*) AS c FROM holiday WHERE substr(on_date,1,4) = ?").get(String(해));
    if (!Number(공휴?.c ?? 0))
      점검.push({
        무엇: "공휴일",
        말: `${해}년 공휴일이 하나도 없습니다. 휴일에 다녀온 실적이 평일로 셈됩니다.`,
        어디: "/settings",
      });

    const 공짜 = db.query<any, []>(
      `SELECT sv.name FROM service sv
         JOIN organization o ON o.profile_id = sv.profile_id
        WHERE o.id = 1 AND sv.active = 1 AND COALESCE(sv.unit_price, 0) = 0
          AND COALESCE(sv.lifetime_cap, 0) = 0`).all();
    if (공짜.length)
      점검.push({
        무엇: "단가",
        말: `단가가 0원인 서비스가 있습니다 — ${공짜.map((x: any) => x.name).join(" · ")}. ` +
            `그대로 두면 청구서에 0원으로 나갑니다.`,
        어디: "/settings",
      });

    /*
     * ── ★ 배정은 됐는데 **폰이 안 이어진** 제공인력 ★ ──────────
     *
     * `할일보내기.ts` 는 **휴대폰이 안 이어진 사람은 건너뜁니다**
     * (`if (!r.폰번호) continue;`). 보낼 곳이 없으니 맞는 동작인데,
     * 사무실에는 아무 말도 안 나옵니다. 그러면 —
     *
     *   관리자는 배정을 다 해 두고 → 제공인력은 폰을 열어도 빈 화면 →
     *   화면 어디에도 까닭이 없어 → 「이 프로그램 안 되네요」 전화.
     *
     * (2026-09-10 파일럿 예행에서 걸렸습니다.)
     *
     * **배정이 있는 사람만** 셉니다. 아직 아무 데도 안 가는 사무직원까지
     * 세면 늘 떠 있는 줄이 되고, 늘 떠 있는 줄은 아무도 안 봅니다.
     */
    const 폰없음 = db.query<any, [string]>(
      `SELECT u.name FROM app_user u
         JOIN worker w ON w.user_id = u.id
        WHERE u.status = 'active'
          AND (u.mailbox_worker_id IS NULL OR u.mailbox_worker_id = '')
          AND EXISTS (SELECT 1 FROM assignment a
                       WHERE a.worker_id = w.id
                         AND (a.period_to IS NULL OR a.period_to >= ?))`).all(now);
    if (폰없음.length)
      점검.push({
        무엇: "휴대폰",
        말: `${폰없음.map((x: any) => x.name).join(" · ")} 님은 아직 휴대폰이 안 이어져 ` +
            `있습니다. 배정을 해 두어도 **그 폰에는 오늘 갈 곳이 안 갑니다.**`,
        어디: "/staff",
      });

    const 잠김 = db.query<any, []>(
      `SELECT rp.name FROM region_profile rp
         JOIN organization o ON o.profile_id = rp.id
        WHERE o.id = 1 AND rp.is_builtin = 1`).get();
    if (잠김)
      점검.push({
        무엇: "규칙",
        말: `지금 「${잠김.name}」을 쓰고 있습니다. 이 규칙은 **기준선**이라 한도가 다 꺼져 있습니다.`,
        어디: "/settings",
      });
  } catch { /* 옛 자료함이면 점검을 건너뜁니다 — 홈은 떠야 합니다 */ }

  return {
    today: now,
    expired, soon, suspended, noShow, unassigned, 한도임박, 연간임박,
    설정점검: 점검,
    USB: USB?.띄울까 ? USB : null,
    counts: {
      expired: expired.length, soon: soon.length,
      suspended: suspended.length, noShow: noShow.length,
      한도임박: 한도임박.length,
      한도넘음: 한도임박.filter((x: any) => x.넘음).length,
      연간임박: 연간임박.length,
      연간넘음: 연간임박.filter((x: any) => x.넘음).length,
      이용: people.filter((r) => r.status === "이용").length,
      중단: people.filter((r) => r.status === "중단").length,
      // 이용 중이고 받는 서비스도 있는데 담당이 없는 사람.
      대기중: unassigned.length,
    },
  };
}

/**
 * 기간 연장.
 *
 * 지자체가 연장을 알려 왔는데 새 명단은 아직 안 온 경우입니다.
 * 실제로 흔합니다 — 전화로 먼저 알려 주고 문서는 나중에 옵니다.
 *
 * **이미 끝난 의뢰의 종료일만** 미룹니다. 아직 살아 있는 서비스는
 * 건드리지 않습니다. 그리고 누가 언제 왜 늘렸는지 남깁니다 —
 * 다음 명단이 왔을 때 대조할 근거가 되어야 합니다.
 */
export function extend(recipientId: string, until: string, reason: string, who: string) {
  const now = today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new Error("연장할 날짜를 골라 주세요.");
  if (until < now) throw new Error("연장 날짜가 오늘보다 빠릅니다.");

  const targets = db.query<{ id: number; period_to: string; name: string }, [string, string]>(
    `SELECT rf.id, rf.period_to, sv.name
       FROM referral rf JOIN service sv ON sv.id = rf.service_id
      WHERE rf.recipient_id = ? AND rf.period_to IS NOT NULL AND rf.period_to < ?`
  ).all(recipientId, now);
  if (targets.length === 0) throw new Error("기간이 끝난 의뢰가 없습니다.");

  const stamp = new Date().toISOString();
  for (const t of targets) {
    db.run("UPDATE referral SET period_to = ? WHERE id = ?", [until, t.id]);
    db.run(
      `INSERT INTO recipient_change
         (recipient_id, field, before_val, after_val, changed_on, who, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [recipientId, `${t.name} 기간`, t.period_to, until, now,
       `${who}${reason ? ` — ${reason}` : ""}`, stamp]
    );
  }
  return { count: targets.length, until };
}
