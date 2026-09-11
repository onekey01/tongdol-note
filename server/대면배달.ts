/**
 * ── 식사지원은 **대면 배달이 원칙**입니다 ─────────────────────
 *
 * 편람 —
 *   「단순 식사배달이 아닌 '돌봄서비스'임을 주지하여 **<대면> 배달 원칙** 준수」
 *   「**비대면 배달이 3회 연속**일 경우 서비스가 중단됨을 안내」
 * 계약서(서식2) 5-2조 —
 *   「3회 연속 대면 수령하지 않은 경우 **식사지원을 포함한 통합돌봄 서비스가
 *    중지**됩니다.」
 *
 * ── 우리가 세던 것이 틀렸습니다 (2026-09-01 바로잡음) ─────────
 *
 * 지금까지 `record.ts` 의 `syncMeal()` 이 **미제공 연속**을 세었습니다.
 * 그런데 편람이 말하는 것은 **비대면 배달 연속**입니다.
 *
 *   미제공      아예 안 갔다 → 음식이 안 나갔으니 **돈도 안 나갑니다**
 *   비대면 배달 갔고 놓고 왔다 → 음식이 이미 만들어졌으니 **돈이 나갑니다**
 *
 * 이 둘은 다른 일입니다. 안 간 것을 세면서 「3회 연속이니 서비스 중지」라고
 * 띄우면, **어르신 서비스가 끊기는 경고를 틀린 숫자로** 하는 것입니다.
 *
 * ── 왜 노쇼가 아닌가 ─────────────────────────────────────────
 *
 * 비대면 배달은 **제공**입니다. 미제공이 아닙니다. 그래서 노쇼 갈래(`미제공.ts`)와
 * 아무 상관이 없고, 축이 아예 다릅니다. 실제로 현장은 —
 *
 *   가사·동행·이미용  이용자 사정이면 **일정을 사전 조율**해 다시 잡습니다
 *   식사              음식이 상하므로 **비대면이어도 비용이 나갑니다**
 *
 * ── 안 적은 것은 대면으로 봅니다 ─────────────────────────────
 *
 * 이 칸이 오늘 처음 생겼습니다. 옛 실적에는 값이 없습니다.
 * **원칙이 대면**이므로 안 적은 것은 원칙대로 한 것으로 보고,
 * **비대면은 일부러 적어야** 합니다. 그래야 옛 자료로 없던 경고가 안 뜹니다.
 */
import { db } from "./db";

/**
 * 몇 번 연속이면 통합돌봄 전체가 중지되나 (편람 · 계약서 5-2조 = **3회**).
 *
 * **설정값입니다.** 지침은 개정되는데 그때마다 프로그램을 새로 짜 드릴 수는
 * 없습니다. **설정 · 계산 규칙**에서 고칩니다. **0 은 「안 봅니다」**입니다.
 */
export function 비대면한도(): number {
  const p = db.query<any, []>(
    `SELECT rp.f2f_limit FROM region_profile rp
       JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`
  ).get();
  const n = Number(p?.f2f_limit);
  return Number.isFinite(n) && n >= 0 ? n : 3;
}

/**
 * **연속으로 세나, 누적으로 세나** (v33 · 2026-09-08 무무 지시).
 *
 * 해남 편람과 계약서 5-2조는 **「3회 연속」**이라 기본은 **연속**입니다.
 * 다른 지자체가 누적으로 읽을 수 있어 설정에 뒀습니다.
 *
 * ★ 세는 것은 **둘 다 그대로** 셉니다. 이 값이 정하는 것은
 *   **어느 쪽으로 경고하고 끊나** 하나뿐입니다.
 */
export function 비대면방식(): "연속" | "누적" {
  const p = db.query<any, []>(
    `SELECT rp.f2f_mode FROM region_profile rp
       JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`
  ).get();
  return String(p?.f2f_mode ?? "연속") === "누적" ? "누적" : "연속";
}

/**
 * 이 서비스가 **대면 배달 원칙**을 따르나.
 *
 * 식사지원만입니다. 가사·동행은 애초에 대면이 아니면 일이 안 됩니다.
 */
export function 대면원칙인가(sv: { record_type?: string | null; name?: string | null }): boolean {
  return sv.record_type === "meal" || String(sv.name ?? "").includes("식사");
}

/**
 * 자료함 값을 「대면이었나」로 읽습니다.
 *
 * **비어 있으면 대면**입니다 — 원칙이 대면이고, 비대면은 일부러 적는 것입니다.
 */
export function 대면이었나(v: unknown): boolean {
  if (v === 0 || v === "0" || v === false) return false;
  return true;
}

export type 비대면현황 = {
  연속: number;
  마지막: string | null;
  한계: number;
  경고: boolean;   // 하나만 더 하면 끊깁니다
  닿음: boolean;   // 이미 닿았습니다 — **사람이 판단해 중단합니다**
  /** 한도를 보고 있나. 0 이면 「안 봅니다」. */
  봄: boolean;
  /**
   * 그해에 **몇 번이나** 비대면이었나 (연속이 아니라 다 더한 것).
   *
   * 편람과 계약서는 둘 다 **「3회 연속」**이라고 적혀 있습니다. 그런데 현장에서는
   * **누적**으로 읽기도 합니다 — 이건 **어르신 서비스가 끝나는 기준**이라
   * 둘 중 하나를 골라 숨기면 안 됩니다. **둘 다 보여 주고** 군에 확인합니다.
   */
  누적: number;
  해: number;
  /** 이 지자체가 **어느 쪽으로** 세나 (설정값). */
  방식: "연속" | "누적";
  /** 방식에 따라 실제로 한도와 견주는 값. 경고·중단은 이것으로 판단합니다. */
  볼값: number;
};

/**
 * 그 사람의 **뒤에서부터 연속 비대면 배달** 횟수.
 *
 * ── 미제공은 건너뜁니다 ──────────────────────────────────────
 * 편람이 세는 것은 「비대면 **배달**」이라 **배달이 있어야** 합니다.
 * 안 간 날은 배달이 아니므로 연속에 넣지도, 끊지도 않습니다.
 *
 * **손으로 세는 칸이 아니라 계산된 값입니다.** 실적에서 다시 셉니다 —
 * 따로 눌러 세게 하면 실적과 반드시 어긋납니다.
 */
export function 비대면연속(recipientId: string): 비대면현황 {
  const rows = db.query<{ face_to_face: number | null; outcome: string; served_on: string }, [string]>(
    `SELECT d.face_to_face, d.outcome, d.served_on
       FROM delivery d JOIN service sv ON sv.id = d.service_id
      WHERE d.recipient_id = ?
        AND (sv.record_type = 'meal' OR sv.name LIKE '%식사%')
      ORDER BY d.served_on`
  ).all(recipientId);

  const 해 = new Date().getFullYear();
  let 연속 = 0;
  let 마지막: string | null = null;
  let 누적 = 0;
  for (const r of rows) {
    if (r.outcome !== "제공") continue;            // 배달이 아닌 날은 건너뜁니다
    if (대면이었나(r.face_to_face)) { 연속 = 0; 마지막 = null; }
    else {
      연속++; 마지막 = r.served_on;
      if (r.served_on.slice(0, 4) === String(해)) 누적++;
    }
  }
  const 한계 = 비대면한도();
  const 봄 = 한계 > 0;
  /*
   * ★ 어느 쪽으로 견주나 — **설정이 정합니다** (v33).
   *   연속·누적은 위에서 **둘 다** 셌고, 화면에도 둘 다 나갑니다.
   *   여기서 고르는 것은 「경고하고 끊을 기준」 하나뿐입니다.
   */
  const 방식 = 비대면방식();
  const 볼값 = 방식 === "누적" ? 누적 : 연속;
  return {
    연속, 마지막, 한계, 누적, 해, 봄, 방식, 볼값,
    // 닿기 **한 번 전**부터 알려 줍니다 — 닿고 나서 알면 이미 늦습니다.
    경고: 봄 && 볼값 >= Math.max(1, 한계 - 1),
    닿음: 봄 && 볼값 >= 한계,
  };
}

/** 셈한 값을 대상자 줄에 적어 둡니다. 화면과 홈이 이것을 봅니다. */
export function 비대면다시셈(recipientId: string): 비대면현황 {
  const x = 비대면연속(recipientId);
  db.run(
    "UPDATE recipient SET no_show_streak = ?, last_no_show_on = ? WHERE id = ?",
    [x.연속, x.마지막, recipientId]
  );
  return x;
}
