/**
 * 방문표 — 어르신 댁 문에 붙이는 QR.
 *
 * ── 무엇을 푸는 것인가 ────────────────────────────────────────
 *
 * 편람 서식8 에는 「진행시간」 칸이 있습니다. 몇 시에 들어가서 몇 시에
 * 나왔는가. 지금은 제공인력이 **나중에 기억으로** 적습니다. 기억은
 * 틀리고, 틀린 것을 지자체가 확인할 방법이 없습니다.
 *
 * 그래서 **그 집에서만 찍을 수 있는 것**을 하나 둡니다.
 * 들어가며 한 번, 나오며 한 번. 시각은 폰이 적습니다.
 *
 * ── 왜 좌표를 안 쓰나 ─────────────────────────────────────────
 *
 * 앞서 정한 대로입니다. 시골에서 GPS 는 수십 미터씩 틀리고, 그러면
 * 정말 갔는데 「안 갔다」가 됩니다. 현장에서 이것보다 나쁜 것이 없습니다.
 * 문에 붙은 종이는 틀리지 않습니다.
 *
 * ── 아무 QR 이나 통하면 안 됩니다 ──────────────────────────────
 *
 * 그렇다고 서명을 새로 만들지는 않았습니다. 현장앱은 이미 **오늘 갈 곳**을
 * 잠긴 채로 받아 자기 열쇠로 풀어 두고 있습니다. 그 안에 집표를 같이
 * 실어 보내면, 앱은 **읽은 값이 오늘 목록에 있는가**만 보면 됩니다.
 *
 *   · 남의 집 종이 → 오늘 목록에 없음 → 「오늘 가실 곳이 아닙니다」
 *   · 지어낸 값     → 오늘 목록에 없음 → 같음
 *   · 진짜 그 집     → 맞음
 *
 * 대조가 곧 확인입니다. 위조하려면 그 집의 집표를 알아야 하는데,
 * 그것은 **잠긴 짐 속에만** 있습니다. 우편함도 못 봅니다.
 *
 * ── 종이에 이름을 적어도 되나 ─────────────────────────────────
 *
 * 적습니다. 문 **안쪽**에 붙는 종이입니다 — 붙이는 자리를 종이에
 * 같이 적어 두었습니다. 이름이 없으면 기관에서 인쇄한 종이 스무 장이
 * 전부 똑같아 보여서, 엉뚱한 집에 붙습니다. 그러면 그 집에서는
 * 영영 「오늘 가실 곳이 아닙니다」가 나옵니다.
 * QR 안에는 이름이 안 들어갑니다 — 사진으로 찍혀도 뜻 없는 값입니다.
 */
import QRCode from "qrcode";
import { db } from "./db";

/**
 * QR 안에 들어가는 글의 머리.
 *
 * 왜 붙이나 — 현장앱 카메라에 **아무 QR 이나** 들어올 수 있습니다.
 * 어르신 댁 냉장고에 붙은 우유 바코드, 약봉투의 QR… 머리를 보고
 * 곧바로 물리치면 「오늘 가실 곳이 아닙니다」라는 엉뚱한 말이 안 뜹니다.
 *
 * 영문인 까닭 — QR 은 영숫자만 있을 때 눈에 띄게 작아집니다.
 * 스티커는 작을수록 좋습니다.
 */
export const 머리 = "TDV1:";

/** 새 집표 하나. 22자, 추측할 수 없습니다. */
function 새집표(): string {
  const 씨 = new Uint8Array(new ArrayBuffer(16));
  crypto.getRandomValues(씨);
  return btoa(String.fromCharCode(...씨))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * 그 사람의 집표. 없으면 **그 자리에서 만들어 두고** 돌려줍니다.
 *
 * 한 번 만들면 안 바뀝니다. 바뀌면 붙여 둔 종이가 헛것이 되고,
 * 집집마다 다시 찾아가야 합니다.
 */
export function 집표(recipientId: string): string {
  const 줄 = db
    .query<{ visit_code: string | null }, [string]>(
      "SELECT visit_code FROM recipient WHERE id = ?")
    .get(recipientId);
  if (!줄) throw new Error("그런 대상자가 없습니다");
  if (줄.visit_code) return 줄.visit_code;

  const 새것 = 새집표();
  db.run("UPDATE recipient SET visit_code = ? WHERE id = ?", [새것, recipientId]);
  return 새것;
}

/**
 * 이미 만들어 둔 것만. 없으면 null.
 *
 * 할 일을 올릴 때 씁니다 — 올리다가 없는 집표를 새로 만들면,
 * 10분마다 도는 일이 자료함에 글을 쓰게 됩니다. 인쇄할 때만 만듭니다.
 */
export function 집표있는것(recipientId: string): string | null {
  const 줄 = db
    .query<{ visit_code: string | null }, [string]>(
      "SELECT visit_code FROM recipient WHERE id = ?")
    .get(recipientId);
  return 줄?.visit_code ?? null;
}

export type 방문표 = { id: string; 이름: string; 주소: string; 집표: string; qr: string };

/** 인쇄할 것 한 사람 몫. QR 은 SVG 라 확대해도 안 깨집니다. */
export async function 방문표하나(recipientId: string): Promise<방문표> {
  const 줄 = db
    .query<{ id: string; payload: string }, [string]>(
      "SELECT id, payload FROM recipient WHERE id = ?")
    .get(recipientId);
  if (!줄) throw new Error("그런 대상자가 없습니다");

  const p = JSON.parse(줄.payload || "{}");
  const 값 = 집표(recipientId);

  return {
    id: 줄.id,
    이름: p.name ?? "",
    주소: [p.address, p.addressDetail].filter(Boolean).join(" "),
    집표: 값,
    /*
     * 잘못 고침 정도 H(30%) — 스티커는 문에 붙어서 **때가 타고 찢깁니다.**
     * 기기 등록 QR 은 화면에 잠깐 떴다 사라지니 M 이면 됐지만,
     * 이것은 몇 년을 견뎌야 합니다.
     */
    qr: await QRCode.toString(머리 + 값, {
      type: "svg", errorCorrectionLevel: "H", margin: 0, width: 200,
    }),
  };
}

/** 여러 사람 몫. 한 장에 여러 명을 찍어야 종이가 안 아깝습니다. */
export async function 방문표여럿(ids: string[]): Promise<방문표[]> {
  const 것들: 방문표[] = [];
  for (const id of ids) {
    try { 것들.push(await 방문표하나(id)); }
    catch { /* 그 사이 지워진 사람은 건너뜁니다 */ }
  }
  return 것들;
}

/**
 * 집표가 없는 분에게 한꺼번에 만들어 붙입니다.
 *
 * 언제 도나 — 프로그램을 켤 때 한 번.
 *
 * 왜 필요한가 — 이 기능이 생기기 **전에 등록된 분들**은 집표가 없습니다.
 * 그분들 것을 인쇄할 때 그 자리에서 만들 수도 있지만, 그러면
 * 「대상자 등록하면 바로 생긴다」는 약속이 옛 분들에게만 안 지켜집니다.
 * 켤 때 한 번 쓸어 두면 그 뒤로는 생각할 것이 없습니다.
 *
 * 「이용」 중인 분만이 아니라 **전부** 채웁니다 —
 * 중단하셨다가 다시 이용하시는 일이 흔한데, 그때 집표가 바뀌면
 * 문에 붙은 종이가 헛것이 됩니다.
 */
export function 집표채우기(): number {
  const 없는분들 = db
    .query<{ id: string }, []>("SELECT id FROM recipient WHERE visit_code IS NULL")
    .all();
  for (const r of 없는분들)
    db.run("UPDATE recipient SET visit_code = ? WHERE id = ?", [새집표(), r.id]);
  return 없는분들.length;
}

/** 「이용」 중인 분 전부. 처음 한 번에 전부 뽑을 때 씁니다. */
export function 이용중인분들(): string[] {
  return db
    .query<{ id: string }, []>(
      "SELECT id FROM recipient WHERE status = '이용' ORDER BY rowid")
    .all()
    .map((r) => r.id);
}
