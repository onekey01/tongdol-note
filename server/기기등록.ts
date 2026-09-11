/**
 * 기기 등록 — 제공인력의 휴대폰을 우편함에 잇습니다.
 *
 * 왜 이런 순서인가 —
 *
 *   열쇠는 32글자 난수라 **손으로 못 칩니다.** 그리고 우편함을 지나가면
 *   안 됩니다 — 지나가는 순간 우편함이 모든 덩어리를 읽을 수 있게 됩니다.
 *   화면 → 카메라가 유일한 길이고, 그래서 QR 입니다.
 *
 * 그래서 사람이 하는 일은 —
 *   ① 사무실에 온다  ② 뜬 QR 을 찍는다  ③ 폰에서 6자리를 정한다
 *
 * ★ 아이디·비밀번호는 묻지 않습니다 (2026-09-04) ★
 *   처음에는 본인 확인을 위해 그 자리에서 치게 했습니다. 그런데 이것이
 *   막으려던 것은 「관리자가 엉뚱한 사람을 그 인력으로 등록하는 일」인데,
 *   **관리자는 어차피 그 사람 비밀번호를 바꿀 수 있습니다.**
 *   막지 못하는 것을 막는 척하면서, 제공인력에게는 기억나지 않는
 *   비밀번호를 대라고 하고 있었습니다. 그래서 뺐습니다.
 *
 *   남는 자물쇠 — 관리자만 QR 을 만들 수 있고(staff.account),
 *   표는 15분이면 죽고, 한 번 쓰면 끝이고, 그 인력이 맡은 어르신만 보입니다.
 *
 * ★ QR 에는 열쇠가 없습니다 (v1.6.25) ★
 *   QR 은 아무 앱이나 갖다 대면 안이 읽힙니다. 그래서 QR 에는
 *   **15분짜리 일회용 표 하나**만 담고, 기관 열쇠는 휴대폰이 등록하면서
 *   올린 공개쪽으로 **싸서** 건넵니다. 그 폰만 풉니다.
 *   화면은 그동안 「휴대폰을 기다리는 중」을 보여 주고, 다 되면 알려 줍니다.
 */
import { db } from "./db";
import { 우편함 } from "./우편함";
import QRCode from "qrcode";

export type 등록결과 = {
  qr: string;            // SVG 통째로
  만료: string;          // ISO
  몇분: number;
  인력번호: string;
};

export type 등록상태 = {
  상태: "없음" | "기다리는중" | "됨";
  건넨수?: number;
};

/** 그 종사자의 우편함 번호. 없으면 하나 만들어 붙입니다. */
export function 우편함번호(userId: number): string {
  const row = db
    .query<{ mailbox_worker_id: string | null }, [number]>(
      "SELECT mailbox_worker_id FROM app_user WHERE id = ?")
    .get(userId);
  if (!row) throw new Error("그런 종사자가 없습니다");
  if (row.mailbox_worker_id) return row.mailbox_worker_id;
  const 새번호 = crypto.randomUUID();
  db.run("UPDATE app_user SET mailbox_worker_id = ? WHERE id = ?", [새번호, userId]);
  return 새번호;
}

/** 등록 QR 을 만듭니다. */
export async function 기기등록시작(userId: number, 몇분 = 15): Promise<등록결과> {
  const 설정 = 우편함.설정읽기();
  if (!설정)
    throw new Error("우편함이 아직 설정되지 않았습니다 (.env 를 보세요)");

  const 사람 = db
    .query<{ id: number; status: string; role: string; roles: string | null }, [number]>(
      "SELECT id, status, role, roles FROM app_user WHERE id = ?")
    .get(userId);
  if (!사람) throw new Error("그런 종사자가 없습니다");
  if (사람.status !== "active") throw new Error("이미 계약이 끝난 분입니다");

  const 역할들 = 사람.roles ? (JSON.parse(사람.roles) as string[]) : [사람.role];
  if (!역할들.includes("worker"))
    throw new Error("제공인력이 아닙니다 — 현장앱은 제공인력만 씁니다");

  const 인력번호 = 우편함번호(userId);
  const 함 = new 우편함(설정);
  await 함.인력올리기(인력번호, true);
  const 담을것 = await 함.등록표만들기(인력번호, 몇분);

  const qr = await QRCode.toString(담을것, {
    type: "svg", errorCorrectionLevel: "M", margin: 1, width: 260,
  });

  return {
    qr,
    만료: new Date(Date.now() + 몇분 * 60_000).toISOString(),
    몇분,
    인력번호,
  };
}

/**
 * 등록이 어디까지 갔나 — 관리자 화면이 몇 초마다 물어봅니다.
 *
 * 물어보는 김에 **열쇠도 건넵니다.** 휴대폰이 공개쪽을 올려 둔 것이
 * 보이면 그 자리에서 싸서 넣습니다. 따로 도는 일꾼을 두지 않으려는 것입니다 —
 * 등록은 사람이 지켜보는 몇 분 동안만 일어나는 일이니까요.
 */
export async function 등록어디까지(userId: number): Promise<등록상태> {
  const 설정 = 우편함.설정읽기();
  if (!설정) throw new Error("우편함이 아직 설정되지 않았습니다");
  const row = db
    .query<{ mailbox_worker_id: string | null }, [number]>(
      "SELECT mailbox_worker_id FROM app_user WHERE id = ?")
    .get(userId);
  if (!row?.mailbox_worker_id) return { 상태: "없음" };

  const 함 = new 우편함(설정);
  const 건넨수 = await 함.열쇠건네기();          // 기다리는 기기가 있으면 여기서 건넵니다
  return { 상태: await 함.기기상태(row.mailbox_worker_id), 건넨수 };
}

/** 계약이 끝나면 그 폰을 바로 막습니다. */
export async function 기기끄기(userId: number): Promise<void> {
  const 설정 = 우편함.설정읽기();
  if (!설정) return;                     // 우편함을 안 쓰는 기관이면 할 일 없음
  const row = db
    .query<{ mailbox_worker_id: string | null }, [number]>(
      "SELECT mailbox_worker_id FROM app_user WHERE id = ?")
    .get(userId);
  if (!row?.mailbox_worker_id) return;
  await new 우편함(설정).인력끄기(row.mailbox_worker_id);
}
