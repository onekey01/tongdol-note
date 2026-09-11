/**
 * ── 본인부담금 영수증 = **편람 서식7** ────────────────────────
 *
 * 지금까지 `receipt.ts` 가 HTML 로 **직접 그렸습니다.** 조항 글자는 맞아도
 * 글꼴·선 굵기·여백이 우리가 정한 값이라 **같은 서식이 아닙니다.**
 * 지자체에 내는 서류는 **서식이 완전히 같아야 하고 확장자만 달라야** 합니다.
 * 그래서 편람 원본(`서식/본인부담금 영수증(서식7).hwpx`)을 채웁니다.
 *
 * ── 왜 「이름표 뒤에 값만 붙이기」인가 ───────────────────────
 *
 * 서식7 은 한 칸 안에 문단이 열두 개 들어 있고 **이름표와 값이 같은 줄**에
 * 있습니다. 기록지처럼 칸을 통째로 갈아 끼우면 **「거래번호 :」라는 서식의
 * 글자까지 지웁니다.** 그래서 `서식채우기.ts` 를 새로 만들었습니다 —
 * **빈칸에 값을 얹고 글자 수는 그대로** 둡니다.
 *
 * ── 한 장에 두 벌 ────────────────────────────────────────────
 * 서식이 그렇게 생겼습니다 — 위는 **제공기관 보관**, 아래는 **이용자 보관**.
 * 같은 값을 두 번 채웁니다.
 *
 * ── 비우는 것 ────────────────────────────────────────────────
 * **(서명)과 (인) 은 비웁니다.** 어르신과 대표가 손으로 하는 자리입니다.
 * 우리가 찍으면 그건 서명을 대신한 것이 됩니다.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Hwpx } from "./hwpx";
import { 금액말 } from "./서식채우기";
import { db } from "./db";
import { today } from "./util";
import { 서식폴더 } from "./서식자리";
import { 찍기 } from "./직인";

const 서식이름 = "본인부담금 영수증(서식7).hwpx";

/** 두 벌이 들어 있는 표의 몇 번째 행인가 (제공기관 보관 · 이용자 보관). */
const 두벌 = [1, 5];

export type 영수증값 = {
  거래번호: string;
  서비스명: string;
  이용자명: string;
  서비스가격: number;
  정부지원금: number;
  본인부담금: number;
  수령일: string;    // YYYY-MM-DD — 「위 본인부담금(…)을 20  년 … 수령하였습니다」
  발행일: string;    // YYYY-MM-DD — 아래쪽 날짜
  기관명: string;
};

export function templatePath(): string {
  const p = join(서식폴더(), 서식이름);
  if (!existsSync(p)) throw new Error(`서식을 찾을 수 없습니다 — ${서식이름}`);
  return p;
}

const ymd = (s: string) => {
  const [y, m, d] = String(s ?? "").split("-").map(Number);
  return { 해: y || 0, 달: m || 0, 날: d || 0 };
};

/**
 * 서식7 을 채운 hwpx 를 만듭니다.
 *
 * **이름표를 하나라도 못 찾으면 터뜨립니다.** 서식이 개정되어 글자가 바뀌면
 * 조용히 빈 영수증이 나가는 것이 가장 나쁩니다 — 그 자리에서 알아야 합니다.
 */
export function build(v: 영수증값): Buffer {
  const d = new Hwpx(readFileSync(templatePath()));
  const tbl = d.tables()[0];
  if (!tbl) throw new Error("서식7 에서 표를 찾지 못했습니다.");

  const 받: string[] = [];
  const 넣 = (tc: any, 이름표: string, 값: string,
              정렬: "왼쪽" | "오른쪽" = "왼쪽") => {
    if (!d.얹기(tc, 이름표, 값, 정렬)) 받.push(이름표);
  };

  const 수 = ymd(v.수령일);
  const 발 = ymd(v.발행일);

  for (const ri of 두벌) {
    const tc = d.cell(tbl, ri, 0);

    넣(tc, "거래번호 :", v.거래번호);
    넣(tc, "서비스명 :", v.서비스명);
    넣(tc, "이용자명 :", v.이용자명);

    // 금액 셋은 「원」 바로 앞에 붙습니다.
    넣(tc, "서비스 가격", 금액말(v.서비스가격), "오른쪽");
    넣(tc, "정부 지원금", 금액말(v.정부지원금), "오른쪽");
    넣(tc, "본인 부담금", 금액말(v.본인부담금), "오른쪽");

    // 「위 본인부담금(    원)을 20  년  월  일 수령하였습니다」
    넣(tc, "본인부담금(", 금액말(v.본인부담금), "오른쪽");
    if (!d.날짜얹기칸(tc, 수.해, 수.달, 수.날, 0)) 받.push("수령일");

    /*
     * 아래쪽 발행일. 같은 칸에 날짜 틀이 **둘** 있어서 두 번째를 집습니다
     * (첫 번째는 바로 위의 수령일입니다).
     */
    if (!d.날짜얹기칸(tc, 발.해, 발.달, 발.날, 1)) 받.push("발행일");

    /*
     * 「◯◯◯◯제공기관 대표 (인)」 → 「해남돌봄센터 대표 (인)」
     *
     * **「◯◯◯◯제공기관」까지가 통째로 기관 이름 자리**입니다.
     * ◯◯◯◯ 만 바꾸면 「공룡복지관제공기관 대표」가 되어 말이 안 됩니다.
     * 편람이 「◯◯◯◯제공기관」이라 적어 둔 것은 「◯◯◯◯ 라는 이름의
     * 제공기관」이라는 뜻이니, 기관 이름 하나가 그 자리를 대신합니다.
     *
     * **(인) 은 그대로 둡니다** — 서식이 적어 둔 글자입니다.
     * 직인은 바로 아래에서 그 위에 겹쳐 찍습니다.
     */
    if (!d.자리바꾸기칸(tc, "◯◯◯◯제공기관", v.기관명)) 받.push("기관명(◯◯◯◯제공기관)");

    /*
     * 직인 — 설정에 올려 둔 그림을 「(인)」 위에 겹쳐 놓습니다.
     * 없으면 아무것도 안 합니다. 「(인)」만 남으니 손도장을 찍으시면 됩니다.
     */
    찍기(d, tc, "대표 (인)");
  }

  if (받.length)
    throw new Error(
      `서식7 에서 이름표를 못 찾았습니다 — ${[...new Set(받)].join(" · ")}\n` +
      `서식이 바뀌었을 수 있습니다. 「서식/${서식이름}」을 확인해 주세요.`
    );

  const 흠 = d.audit();
  if (흠.length) throw new Error(`서식7 자체 점검에 걸렸습니다 — ${흠.join(" · ")}`);
  return d.save();
}

/**
 * 확정된 청구 한 건으로 영수증 값을 모읍니다.
 *
 * **얼린 값(`calc_snapshot`)을 씁니다.** 나중에 단가를 고쳐도
 * 이미 드린 영수증과 다시 뽑은 영수증이 달라지면 안 됩니다.
 */
export function gather(billId: number): 영수증값 {
  const b = db.query<any, [number]>("SELECT * FROM billing WHERE id = ?").get(billId);
  if (!b) throw new Error("그 청구를 찾을 수 없습니다.");
  if (Number(b.copay_amount ?? 0) <= 0)
    throw new Error("본인부담금이 없는 청구입니다. 영수증을 낼 것이 없습니다.");

  const r = db.query<any, [string]>(
    "SELECT payload FROM recipient WHERE id = ?").get(b.recipient_id);
  const p = JSON.parse(r?.payload || "{}");
  const org = db.query<any, []>("SELECT * FROM organization WHERE id = 1").get();

  let snap: any = null;
  try { snap = b.calc_snapshot ? JSON.parse(b.calc_snapshot) : null; } catch { /* 옛 자료 */ }

  /*
   * 서식7 의 「서비스명」은 **한 칸**입니다. 한 구간에 서비스가 여럿이면
   * 이름을 이어 붙입니다 — 서식에 없는 줄을 우리가 만들어 넣지 않습니다.
   */
  const 이름들: string[] = Array.isArray(snap?.lines)
    ? [...new Set<string>(
        snap.lines.map((l: any) => String(l.service ?? "")).filter(Boolean))]
    : [];

  const 총액 = Number(b.service_amount ?? 0);
  const 본인 = Number(b.copay_amount ?? 0);

  return {
    거래번호: b.receipt_no || `${String(b.period_from ?? today()).slice(0, 4)}-${
      String(b.id).padStart(4, "0")}`,
    서비스명: 이름들.join(" · ") || "통합돌봄 서비스",
    이용자명: p.name ?? "",
    서비스가격: 총액,
    // 지자체가 낸 몫입니다. 총액에서 본인부담금을 뺀 것.
    정부지원금: Math.max(0, 총액 - 본인),
    본인부담금: 본인,
    수령일: b.paid_on || b.issued_on || today(),
    발행일: b.issued_on || today(),
    기관명: org?.name ?? "",
  };
}

/** 파일 이름 — 사람이 폴더에서 알아볼 수 있게. */
export function 파일이름(v: 영수증값): string {
  const 성함 = (v.이용자명 || "이용자").replace(/[\\/:*?"<>|]/g, "");
  return `본인부담금 영수증_${성함}_${v.발행일}.hwpx`;
}
