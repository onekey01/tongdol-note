/**
 * ── 서식에 **직인을 찍습니다** ────────────────────────────────
 *
 * 설정에 올려 둔 직인 그림을 hwpx 안에 넣고, 「(인)」 자리 위에 겹쳐 띄웁니다.
 *
 * ── 왜 「(인)」을 안 지우나 ──────────────────────────────────
 *
 * 「(인)」은 **서식이 적어 둔 글자**입니다. 지우면 서식을 고친 것이 됩니다.
 * 실제 종이에서도 도장은 「(인)」 위에 겹쳐 찍습니다. 그대로 흉내 냅니다.
 * 직인이 없으면 아무것도 안 넣습니다 — 「(인)」만 남아 손도장을 찍으시면 됩니다.
 *
 * ── hwpx 가 그림을 담는 방법 ────────────────────────────────
 *
 * 세 곳을 손대야 그림 하나가 들어갑니다 (편람에서 배웠습니다) —
 *
 *   1. 꾸러미에 `BinData/imageN.png` 를 넣는다
 *   2. `Contents/content.hpf` 에 그 파일을 적는다
 *        <opf:item id="imageN" href="BinData/imageN.png"
 *                  media-type="image/png" isEmbeded="1"/>
 *   3. 문단 안에 `<hp:run><hp:pic …><hc:img binaryItemIDRef="imageN"/>…</hp:pic></hp:run>`
 *
 * 하나라도 빠지면 한글이 파일을 못 엽니다.
 *
 * ── 자리 ────────────────────────────────────────────────────
 *
 * `treatAsChar="0"` 로 **글자가 아닌 떠 있는 그림**으로 만듭니다. 글자로 넣으면
 * 「(인)」을 옆으로 밀어 서식이 틀어집니다. 문단 오른쪽 끝을 기준으로 삼고
 * 왼쪽·위로 조금 물려 「(인)」 위에 오게 합니다. `textWrap="IN_FRONT_OF_TEXT"`
 * 라 글자를 덮습니다 — 종이에 도장을 찍은 모습 그대로입니다.
 */
import { Hwpx } from "./hwpx";
import { db } from "./db";

/** 1mm 가 몇 HWPUNIT 인가 (1 HWPUNIT = 1/7200 인치). */
export const mm = (n: number) => Math.round((n * 7200) / 25.4);

export type 직인그림 = { 바이트: Buffer; 종류: "png" | "jpeg" };

/**
 * 설정에 저장된 직인을 꺼냅니다. 없으면 `null`.
 *
 * 자료함에 `data:image/png;base64,…` 모양으로 들어 있습니다
 * (폴더에 직인 파일이 굴러다니지 않게 자료함 안에 둡니다).
 */
export function 설정직인(): 직인그림 | null {
  const org = db.query<any, []>("SELECT stamp_png FROM organization WHERE id = 1").get();
  const url = String(org?.stamp_png ?? "");
  const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(url);
  if (!m) return null;
  try {
    return { 종류: m[1] as "png" | "jpeg", 바이트: Buffer.from(m[2], "base64") };
  } catch { return null; }
}

/**
 * 직인을 찍습니다. 찍었으면 `true`, 직인이 없어 안 찍었으면 `false`.
 *
 * `이름표` 가 든 문단을 찾아 그 문단에 겹쳐 놓습니다.
 * `지름` 은 mm. 종이에 찍히는 크기입니다 (PDF 쪽과 같은 16mm 를 씁니다).
 */
export function 찍기(
  d: Hwpx, tc: any, 이름표: string,
  옵션: { 지름?: number; 오른쪽에서?: number; 위에서?: number } = {}
): boolean {
  const 그림 = 설정직인();
  if (!그림) return false;
  return d.그림겹치기(tc, 이름표, 그림, {
    지름: mm(옵션.지름 ?? 16),
    오른쪽에서: mm(옵션.오른쪽에서 ?? 4),
    위에서: mm(옵션.위에서 ?? 1),
  });
}
