import { db } from "./db";
import { parseRoles, type Role } from "./staff";

/**
 * 누가 무엇까지 볼 수 있는가.
 *
 * ── 왜 필요한가 ────────────────────────────────────────────
 * 아이디·비밀번호·역할을 화면에서 고칠 수 있게 되면,
 * "누구나 고칠 수 있다"가 되어서는 안 됩니다.
 * 제공인력이 자기 역할을 관리자로 바꿔 버릴 수 있으면 잠금장치가 없는 것과 같습니다.
 *
 * 그래서 **고칠 수 있게 만드는 대신, 손이 닿는 범위를 좁힙니다.**
 *
 *   관리자   admin   전부. 계정·역할·계약종료도 여기서만.
 *   사무직원 staff    대상자·의뢰는 전부, 종사자는 명단만. 계정은 못 건드립니다.
 *   제공인력 worker   자기에게 배정된 대상자만. 본인 정보(연락처·주소)만 고칩니다.
 *   외부업체 vendor   제공인력과 같되 더 좁게. 배정된 건만.
 *
 * 개인정보보호법이 말하는 "접근권한의 차등 부여"가 바로 이것입니다.
 * 지자체 점검에서 묻는 항목이기도 합니다.
 */

export type Action =
  | "staff.list"       // 종사자 명단 전체 보기
  | "staff.create"     // 종사자 등록
  | "staff.editOther"  // 남의 기본 정보 고치기
  | "staff.account"    // 아이디 · 비밀번호 · 역할 · 계약종료
  | "recipient.viewAll"
  | "recipient.edit"
  | "recipient.delete"
  | "referral.manage"  // 의뢰 접수 (엑셀 올리기 · 반영)
  | "settings.view"
  | "settings.edit"
  | "memo.use";        // 메모장 (보기 · 붙이기 · 떼기)

const MATRIX: Record<Action, Role[]> = {
  "staff.list":        ["admin", "staff"],
  "staff.create":      ["admin"],
  "staff.editOther":   ["admin"],
  "staff.account":     ["admin"],
  "recipient.viewAll": ["admin", "staff"],
  "recipient.edit":    ["admin", "staff"],
  "recipient.delete":  ["admin"],
  "referral.manage":   ["admin", "staff"],
  "settings.view":     ["admin", "staff"],
  "settings.edit":     ["admin"],
  /*
   * 메모장은 **지금은 관리자만**입니다.
   *
   * 사무직원에게도 열지 않은 이유: 메모에는 표에 안 들어가는 말이 오갑니다.
   * 누가 볼 수 있는지 정해 두지 않은 채 열어 두면, 적어서는 안 될 것이 적힙니다.
   * 좁게 열어 두었다가 넓히는 것은 쉽고, 넓게 열었다가 좁히는 것은 어렵습니다.
   *
   * 넓힐 때는 **이 한 줄만** 고치면 됩니다 — ["admin", "staff"].
   * 현장앱을 만들 때 권한을 다시 손보기로 했습니다.
   */
  "memo.use":          ["admin"],
};

export function can(me: any, action: Action): boolean {
  const roles = parseRoles(me?.roles ?? me?.role);
  return MATRIX[action].some((r) => roles.includes(r));
}

/** 화면이 미리 알아야 할 것들. 서버가 막는 것과 같은 표에서 나옵니다. */
export function permsOf(me: any): Record<Action, boolean> {
  const out = {} as Record<Action, boolean>;
  for (const a of Object.keys(MATRIX) as Action[]) out[a] = can(me, a);
  return out;
}

/**
 * 이 사람이 볼 수 있는 대상자 id.
 *
 * 관리자·사무직원은 전부(null 을 돌려주면 "제한 없음"이라는 뜻입니다).
 * 제공인력·외부업체는 **자기에게 배정된 사람만** 봅니다.
 * 배정 화면이 붙기 전에는 빈 목록이 됩니다. 그게 맞습니다 —
 * 배정도 안 된 사람의 주소와 연락처를 볼 이유가 없습니다.
 */
export function visibleRecipientIds(me: any): Set<string> | null {
  if (can(me, "recipient.viewAll")) return null;
  const rows = db.query<{ recipient_id: string }, [number]>(
    `SELECT DISTINCT a.recipient_id
       FROM assignment a JOIN worker w ON w.id = a.worker_id
      WHERE w.user_id = ?`
  ).all(me.id);
  return new Set(rows.map((r) => r.recipient_id));
}
