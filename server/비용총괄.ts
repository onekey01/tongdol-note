/**
 * ── 개인별 서비스 비용총괄 = **편람 서식8** ──────────────────
 *
 * 한 사람의 한 달치 서비스를 **한 줄씩** 적어 군에 내는 종이입니다.
 * 영수증(서식7)이 「얼마를 받았다」라면, 이것은 「무엇을 얼마나 했다」입니다.
 *
 * ── 다른 서식과 다른 점: **줄 수가 정해져 있지 않습니다** ────
 *
 * 서식이 준 실적 줄은 다섯 개뿐입니다(예시 한 줄 + 빈 줄 넷).
 * 한 달에 스무 번을 가는 사람도 있습니다. 그래서
 * **모자라면 칸을 늘립니다** — 무무 님 지시(2026-09-02),
 * 「칸을 늘려 자연스럽게 서식이 늘어나도록」.
 *
 * 늘리는 방법과 그때 함께 움직여야 하는 곳은 `hwpx.ts` 의 `행늘리기` 에
 * 적어 두었습니다. **가운데 빈 줄을 본떠 가운데에 넣습니다** — 마지막 줄을
 * 본뜨면 그 굵은 아래 테두리가 표 한가운데 그어집니다.
 *
 * 그리고 표의 **「글자처럼 취급」을 끕니다.** 안 끄면 표가 한 쪽을 넘는
 * 순간 글자가 줄바꿈되듯 **통째로 다음 쪽으로** 넘어갑니다. 끄면 이미
 * 켜져 있는 `pageBreak="CELL"` 이 살아나 쪽을 넘어가며 이어집니다.
 * 편람의 서식9·서식4 가 이미 그렇게 되어 있습니다.
 *
 * ── 세 칸이 각각 무엇인가 (2026-09-03, 무무 님 지시) ────────
 *
 *   **진행시간**  제공인력이 휴대폰으로 찍은 **실제 시각** — 09:00~09:40
 *   **제공시간**  그 **시작과 끝의 차이** — 40분. 환산값이 아닙니다.
 *   **단가**      그 시간에 **적용된 구간과 금액** — 「30분 12,000원」
 *   **이용금액**  단가 칸과 같은 금액
 *   **총금액**    이용금액 × 투입인원
 *   **총액**      총금액의 합
 *
 * 처음에 제가 제공시간에 **환산값**(40분 → 30분)을 넣었습니다. 그러면
 * 종이에서 실제로 몇 분 있었는지가 사라집니다. 실제는 제공시간에 두고,
 * 환산은 단가 칸에 드러나는 것이 맞습니다.
 *
 * ── 환산 규칙은 **편람 그대로** ─────────────────────────────
 *
 *   「∙ 비용산정: **30분단위로 환산** — 15분 미만은 미산정 / 15분이상
 *     45분 미만인 경우는 30분으로 산정 / 45분이상은 1시간으로 산정」
 *   「○ (제 공 기 준) **1일 최대 3시간**(평일 오전 9시 ~오후 6시)」
 *
 * 두 줄을 겹치면 단가 칸에 나올 수 있는 말은 **여섯 가지뿐**입니다 —
 * 30분 · 1시간 · 1시간30분 · 2시간 · 2시간30분 · 3시간
 * (그리고 15분을 못 넘긴 「미산정」).
 *
 * 그러니 `money.ts` 의 셈을 안 건드립니다 —
 * **서식8 의 총액과 청구서의 서비스 총액은 늘 같아야** 합니다.
 *
 * 서식은 단가 칸을 「□ 1시간 17,000원 / □ 30분 22,100원」이라 적어 두고
 * 네모를 치게 되어 있습니다. 우리 단가는 설정에 있고 서비스마다 다르므로
 * **그 칸을 실제로 적용된 값으로 덮어씁니다.**
 *
 * (그 두 숫자는 **서식8 안에만** 있습니다. 편람 본문의 가사지원 단가는
 *  「○ (서비스 비용) **1시간 24,000원 / 30분 12,000원**」입니다.
 *  30분이 1시간보다 비쌀 수는 없으니 서식 쪽이 잘못 적힌 것으로 보입니다 —
 *  군에 알려 드릴 목록에 넣어 두었습니다. 우리는 설정의 실제 단가를 쓰므로
 *  종이에는 영향이 없습니다.)
 *
 * ── 「원」·「명」에 대하여 ───────────────────────────────────
 * 예시 줄(r10)에만 「원」·「명」이 인쇄되어 있고 빈 줄 넷에는 없습니다.
 * 값만 넣으면 첫 줄만 「17,000원」이고 나머지는 「17,000」이 되어
 * 한 표 안에서 모양이 갈립니다. 그래서 **모든 줄에 「원」·「명」을 붙여**
 * 씁니다 — 서식이 말하려던 것을 모든 줄에 똑같이 지키는 쪽입니다.
 *
 * ── 누가 안 내는가 ───────────────────────────────────────────
 * 서식 머리에 「※ <서비스비용 지원대상자>만 작성 및 제출」이라 적혀
 * 있습니다. **전액 자부담(본인부담률 100%)인 분은 이 종이를 안 냅니다.**
 * 그 자리에서 터뜨립니다 — 조용히 빈 종이를 내면 안 됩니다.
 *
 * ── 아직 못 채우는 칸 ────────────────────────────────────────
 * **「진행시간」(○○:○○~○○:○○)** 은 방문 시각입니다. 지금 우리 자료에는
 * `start_at`·`end_at` 이 비어 있습니다 — 단계 C(현장앱)에서 방문을 찍으면
 * 그때부터 채워집니다. 그때까지는 **비워 둡니다.** 지어내지 않습니다.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Hwpx } from "./hwpx";
import { 금액말 } from "./서식채우기";
import { db } from "./db";
import { today } from "./util";
import { 서식폴더 } from "./서식자리";
import { 실적줄들 } from "./billing";

const 서식이름 = "개인별 서비스 비용총괄(서식8).hwpx";

/** 표1 에서 우리가 채우는 자리. */
const 자리 = {
  기관명: [1, 1], 담당자: [1, 3], 연락처: [1, 5],
  성명: [4, 1], 생년월일: [4, 3], 만나이: [4, 5], 성별: [4, 7],
  주소: [5, 1],
  주요내용: [8, 1],
} as const;

/*
 * **총액 줄은 자리를 박아 두지 않습니다.** 줄을 늘리면 뒤로 밀립니다 —
 * 「[15,1]」이라 적어 두었다가 여덟 줄짜리에서 총액이 「원」만 남았습니다.
 * 총액은 늘 **표의 마지막 줄**입니다.
 */

/** 실적 줄이 시작하는 행과, 서식이 준 줄 수. */
const 첫실적행 = 10;
const 서식줄수 = 5;          // r10(예시) ~ r14
/** 본뜰 줄 — **가운데** 빈 줄이어야 합니다 (`hwpx.ts` 의 `행늘리기` 참고). */
const 본뜰행 = 13;

export function templatePath(): string {
  const p = join(서식폴더(), 서식이름);
  if (!existsSync(p)) throw new Error(`서식을 찾을 수 없습니다 — ${서식이름}`);
  return p;
}

export type 실적줄 = {
  일자: string;        // "2026-09-03"
  요일: string;        // "목요일"
  시작: string;        // "09:00" — 없으면 빈 글
  끝: string;
  /** **실제로 있었던 분** = 끝 − 시작. 시간제가 아니면 `null`. */
  제공분: number | null;
  /** 편람 30분 환산으로 **인정된 분**. 단가 칸이 이것을 말합니다. */
  인정분: number | null;
  단가말: string;      // "30분 12,000원" · "1시간 24,000원" · "미산정"
  이용금액: number;
  투입인원: number;
  총금액: number;
};

export type 비용총괄값 = {
  기관: { 이름: string; 담당자: string; 연락처: string };
  이용자: { 이름: string; 생년월일: string; 만나이: string; 성별: string; 주소: string };
  주요내용: string;
  줄들: 실적줄[];
  총액: number;
  /** 어느 기간치인가. 파일 이름에 씁니다 — 보고한 날과 다릅니다. */
  구간: { 부터: string; 까지: string };
  /** 맨 아래 「2026년  월」 — **보고하는 날**입니다. */
  보고: { 해: number; 달: number };
  시설장: string;
};

const 요일말 = ["일", "월", "화", "수", "목", "금", "토"];

/** 「2026-09-03」 → 「2026. 9. 3.」 */
function 날짜말(s: string): string {
  const [y, m, d] = String(s ?? "").split("-").map(Number);
  if (!y) return String(s ?? "");
  return `${y}. ${m}. ${d}.`;
}

function 요일(s: string): string {
  const [y, m, d] = String(s ?? "").split("-").map(Number);
  if (!y) return "";
  return 요일말[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] + "요일";
}

/** 「09:00」만 뽑습니다. 「2026-09-03T09:00:00」 도 받습니다. */
function 시각말(s: string | null): string {
  const t = String(s ?? "").trim();
  if (!t) return "";
  const m = /(\d{1,2}):(\d{2})/.exec(t);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** 「09:00」과 「09:40」의 차이 = 40분. 자정을 넘기면 하루를 더합니다. */
function 분차이(시작: string, 끝: string): number {
  const 분 = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const d = 분(끝) - 분(시작);
  return d >= 0 ? d : d + 24 * 60;
}

/**
 * 「1시간」·「30분」·「1시간⏎30분」. 분이 없으면 빈 글 — 지어내지 않습니다.
 * 칸이 좁아 시·분이 다 있으면 두 줄로 씁니다 (서식 예시가 그렇습니다).
 */
function 시간말(분: number | null, 줄바꿈 = true): string {
  if (분 == null) return "";
  const h = Math.floor(분 / 60), m = 분 % 60;
  if (h && m) return `${h}시간${줄바꿈 ? "\n" : ""}${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

/**
 * 단가 칸에 적을 말.
 *
 *   시간제  「30분 12,000원」·「1시간 24,000원」·「1시간30분 36,000원」
 *           — **적용된 구간과 그 금액**입니다. 이용금액과 같은 숫자입니다.
 *   미산정  「미산정」 — 15분을 못 넘겨 0원이 된 방문. 갔다는 사실은
 *           줄로 남기고, 돈이 안 된 까닭을 종이가 말합니다.
 *   끼·회   「1끼 10,100원」·「1회 24,000원」 — 분을 안 재는 서비스는
 *           그 단위 그대로 (2026-09-03 무무 님 확인).
 */
function 단가말(unit: string, 단가: number, 인정분: number | null): string {
  if (unit !== "hour") {
    const 단위 = unit === "meal" ? "1끼" : "1회";
    return `${단위} ${금액말(단가)}원`;
  }
  if (인정분 == null) return `1시간 ${금액말(단가)}원`;   // 분을 안 적은 옛 실적
  if (인정분 <= 0) return "미산정";
  return `${시간말(인정분, false)} ${금액말(Math.round(단가 * 인정분 / 60))}원`;
}

/** 생년월일로 만 나이. 오늘을 기준으로 셉니다. */
function 만나이(생: string, 기준: string): string {
  const [by, bm, bd] = String(생 ?? "").split("-").map(Number);
  const [ny, nm, nd] = String(기준 ?? "").split("-").map(Number);
  if (!by || !ny) return "";
  let n = ny - by;
  if (nm < bm || (nm === bm && nd < bd)) n -= 1;
  return n >= 0 ? String(n) : "";
}

/**
 * 한 사람의 한 청구 구간치를 모읍니다.
 *
 * **얼린 단가(`calc_snapshot`)를 씁니다.** 나중에 설정에서 단가를 고쳐도
 * 이미 낸 종이와 다시 뽑은 종이가 달라지면 안 됩니다.
 */
export function 모으기(billId: number, opt: { 담당자?: string; 시설장?: string } = {}): 비용총괄값 {
  const b = db.query<any, [number]>("SELECT * FROM billing WHERE id = ?").get(billId);
  if (!b) throw new Error("그 청구를 찾을 수 없습니다.");

  const rec = db.query<any, [string]>(
    "SELECT * FROM recipient WHERE id = ?").get(b.recipient_id);
  if (!rec) throw new Error("대상자를 찾을 수 없습니다.");
  const p = JSON.parse(rec.payload || "{}");
  const org = db.query<any, []>("SELECT * FROM organization WHERE id = 1").get();

  /*
   * 「※ <서비스비용 지원대상자>만 작성 및 제출」 —
   * 전액 자부담이면 이 종이를 낼 자리가 아닙니다.
   */
  const tier = rec.copay_tier_id
    ? db.query<any, [number]>("SELECT * FROM copay_tier WHERE id = ?").get(rec.copay_tier_id)
    : null;
  if (Number(tier?.rate ?? 0) >= 1)
    throw new Error(
      "전액 자부담 대상자입니다. 서식8 은 「서비스비용 지원대상자」만 냅니다.");

  let snap: any = null;
  try { snap = b.calc_snapshot ? JSON.parse(b.calc_snapshot) : null; } catch { /* 옛 자료 */ }
  /** 서비스별 **얼린 단가**(평일·휴일). 없으면 지금 설정값을 씁니다. */
  const 얼린단가 = new Map<number, { 평일: number; 휴일: number | null }>();
  if (Array.isArray(snap?.lines))
    for (const l of snap.lines)
      if (l?.serviceId != null)
        얼린단가.set(Number(l.serviceId), {
          평일: Number(l.unitPrice ?? 0),
          휴일: l.holidayPrice == null ? null : Number(l.holidayPrice),
        });

  const from = String(b.period_from ?? "");
  const to = String(b.period_to ?? "");

  /*
   * ── 실적은 **청구서와 같은 자리**에서 가져옵니다 ────────────
   * `billing.실적줄들` 이 30분 환산과 **하루 상한**까지 다 해 줍니다.
   * 여기서 따로 셈하면 언젠가 두 종이가 다른 금액을 말합니다.
   */
  const rows = 실적줄들(String(b.recipient_id), from, to);

  const 휴일할증 = !!db.query<any, []>(
    `SELECT rp.holiday_enabled FROM region_profile rp
       JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`).get()?.holiday_enabled;

  const 이름들: string[] = [];
  const 줄들: 실적줄[] = [];
  /* 종이는 **날짜 차례**로 읽습니다 — 청구서는 서비스 차례입니다. */
  for (const r of [...rows].sort((x, y) =>
    x.served_on < y.served_on ? -1 : x.served_on > y.served_on ? 1 : x.id - y.id)) {
    if (!이름들.includes(r.name)) 이름들.push(r.name);

    const 얼린 = 얼린단가.get(Number(r.service_id));
    const 평일 = 얼린?.평일 ?? r.unit_price;
    const 휴일값 = 얼린 ? (얼린.휴일 ?? 평일) : (r.holiday_price ?? 평일);
    const 단가 = r.is_holiday && 휴일할증 ? 휴일값 : 평일;

    const 시간제 = r.unit === "hour";
    const 금액 = Math.round(단가 * (r.인정분 / 60));
    const 인원 = 1;                 // 우리 자료는 한 방문에 제공인력 한 사람입니다

    /*
     * **진행시간이 있으면 그 차이가 제공시간**입니다 (무무 님 지시).
     * 아직 `start_at`·`end_at` 이 안 채워지는 동안은 잰 분을 그대로 씁니다 —
     * 현장앱이 붙으면 두 값이 같아집니다.
     */
    const 시작 = 시각말(r.start_at), 끝 = 시각말(r.end_at);
    const 걸린분 = 시작 && 끝 ? 분차이(시작, 끝) : r.잰분;

    줄들.push({
      일자: r.served_on,
      요일: 요일(r.served_on),
      시작, 끝,
      제공분: 시간제 ? 걸린분 : null,
      인정분: 시간제 && r.잰분 != null ? r.인정분 : null,
      단가말: 단가말(r.unit, 단가, 시간제 && r.잰분 != null ? r.인정분 : null),
      이용금액: 금액,
      투입인원: 인원,
      총금액: 금액 * 인원,
    });
  }

  const [해, 달] = String(b.issued_on || to || today()).split("-").map(Number);

  return {
    기관: {
      이름: String(org?.name ?? ""),
      담당자: String(opt.담당자 ?? ""),
      연락처: String(org?.phone ?? ""),
    },
    이용자: {
      이름: String(p.name ?? ""),
      생년월일: String(p.birth ?? ""),
      만나이: 만나이(String(p.birth ?? ""), to || today()),
      성별: String(p.gender ?? ""),
      주소: String(p.address ?? ""),
    },
    주요내용: 이름들.join(" · "),
    줄들,
    총액: 줄들.reduce((s, x) => s + x.총금액, 0),
    구간: { 부터: from, 까지: to },
    보고: { 해: 해 || 0, 달: 달 || 0 },
    시설장: String(opt.시설장 ?? org?.ceo_name ?? ""),
  };
}

/**
 * 서식8 을 채운 hwpx 를 만듭니다.
 *
 * 이름표를 못 찾으면 **터뜨립니다.** 서식이 개정되어 글자가 바뀌면
 * 조용히 빈 종이가 나가는 것이 가장 나쁩니다.
 */
export function build(v: 비용총괄값): Buffer {
  const d = new Hwpx(readFileSync(templatePath()));
  const tbl = d.tables()[1];
  if (!tbl) throw new Error("서식8 에서 본문 표를 찾지 못했습니다.");

  const 받: string[] = [];
  const 칸 = (n: keyof typeof 자리) => d.cell(tbl, 자리[n][0], 자리[n][1]);

  // ── 제공기관 · 돌봄대상자 ─────────────────────────────────
  d.setCell(칸("기관명"), v.기관.이름);
  d.setCell(칸("담당자"), v.기관.담당자);
  d.setCell(칸("연락처"), v.기관.연락처);

  d.setCell(칸("성명"), v.이용자.이름);
  d.setCell(칸("생년월일"), v.이용자.생년월일);
  // 「세」는 서식의 글자입니다. 숫자를 그 앞에 두고 말은 살립니다.
  d.setCell(칸("만나이"), v.이용자.만나이 ? `${v.이용자.만나이} 세` : "세");
  d.setCell(칸("성별"), v.이용자.성별);
  d.setCell(칸("주소"), v.이용자.주소);
  d.setCell(칸("주요내용"), v.주요내용);

  /*
   * ── 실적 줄 ───────────────────────────────────────────────
   *
   * 서식이 준 다섯 줄로 모자라면 늘립니다. 남으면 **비워 둡니다** —
   * 줄을 지우지 않습니다. 종이에 빈 줄이 남는 것이 서식의 모습입니다.
   */
  if (v.줄들.length > 서식줄수) {
    const 더 = v.줄들.length - 서식줄수;
    d.행늘리기(tbl, d.rows(tbl)[본뜰행], 더);
  }

  /*
   * ── 첫 줄의 **정렬**을 아래 줄에 맞춥니다 ───────────────────
   * 서식의 첫 실적 줄(r10)은 예시라 정렬이 나머지와 다릅니다
   * (단가 JUSTIFY · 금액 RIGHT · 나머지 줄은 전부 CENTER).
   * **손대기 전에** 아래 빈 줄의 문단 모양을 적어 둡니다.
   */
  const 본보기정렬 = d.cells(d.rows(tbl)[첫실적행 + 1]).map((tc) => d.칸문단모양(tc));

  v.줄들.forEach((줄, i) => {
    const ri = 첫실적행 + i;
    d.setCell(d.cell(tbl, ri, 0), String(i + 1));
    d.setCell(d.cell(tbl, ri, 1), `${날짜말(줄.일자)}\n(${줄.요일})`, false);
    d.setCell(d.cell(tbl, ri, 2), 줄.시작 && 줄.끝 ? `${줄.시작}~\n${줄.끝}` : "", false);
    // 제공시간 = **실제로 있었던 시간**(끝 − 시작). 환산값이 아닙니다.
    d.setCell(d.cell(tbl, ri, 3), 시간말(줄.제공분), false);
    d.setCell(d.cell(tbl, ri, 4), 줄.단가말, false);
    d.setCell(d.cell(tbl, ri, 5), `${금액말(줄.이용금액)}원`);
    d.setCell(d.cell(tbl, ri, 6), `${줄.투입인원}명`);
    d.setCell(d.cell(tbl, ri, 7), `${금액말(줄.총금액)}원`);

    // 한 표 안에서 줄마다 정렬이 다르면 종이가 삐뚤어 보입니다.
    d.cells(d.rows(tbl)[ri]).forEach((tc, ci) => d.칸문단모양맞추기(tc, 본보기정렬[ci]));
  });

  // 남는 줄은 비웁니다 — 예시 줄(r10)의 ○○ 가 남아 있으면 안 됩니다.
  const 실적행수 = d.rows(tbl).length - 첫실적행 - 1;   // 마지막은 총액 줄
  for (let i = v.줄들.length; i < 실적행수; i++)
    d.cells(d.rows(tbl)[첫실적행 + i]).forEach((tc, ci) => {
      d.setCell(tc, "");
      d.칸문단모양맞추기(tc, 본보기정렬[ci]);
    });

  {
    const 마지막 = d.rows(tbl)[d.rows(tbl).length - 1];
    const 총액칸 = d.cells(마지막)[1];
    if (!총액칸) throw new Error("서식8 에서 「비용총괄 총액」 칸을 찾지 못했습니다.");
    d.setCell(총액칸, `${금액말(v.총액)}원`);
  }

  /*
   * ── 표를 쪽 너머로 이어지게 ────────────────────────────────
   * 줄을 늘리지 않았더라도 끕니다 — 서식8 이 늘 같은 모습이어야 합니다.
   */
  d.글자처럼취급끄기(tbl);

  /*
   * ── 맨 아래 ───────────────────────────────────────────────
   * 「2026년    월    」 — 이 서식에는 **「일」이 없습니다**(편람 그대로).
   * 그래서 `날짜얹기` 를 못 씁니다. 해와 달만 넣습니다.
   */
  /*
   * 「＿＿＿＿ "기관은 서비스 제공 결과에 따라 … 보고합니다."」
   *
   * 그 언더바는 **밑줄을 그은 빈칸 열여섯 자**입니다(따로 run 이 있습니다).
   * 거기에 기관 이름이 들어갑니다 — 「해남돌봄센터 기관은 … 보고합니다」.
   * 빈칸 수를 지켜 넣으므로 뒤 글자가 밀리지 않습니다.
   */
  if (!기관이름넣기(d, v.기관.이름)) 받.push("보고 문장의 기관명");
  if (!보고달넣기(d, v.보고.해, v.보고.달)) 받.push("보고 연월");
  if (v.시설장 && !d.얹기문서("(성명)", v.시설장, "시설장")) 받.push("시설장 성명");

  if (받.length)
    throw new Error(
      `서식8 에서 이름표를 못 찾았습니다 — ${[...new Set(받)].join(" · ")}\n` +
      `서식이 바뀌었을 수 있습니다. 「서식/${서식이름}」을 확인해 주세요.`
    );

  const 흠 = d.audit();
  if (흠.length) throw new Error(`서식8 자체 점검에 걸렸습니다 — ${흠.join(" · ")}`);
  return d.save();
}

/**
 * 「2026년    월    」에 해와 달을 넣습니다. **글자 수를 지킵니다.**
 *
 * 해는 이미 네 자리로 찍혀 있으니 그 자리를 바꾸고, 달은 「월」 바로
 * 앞 빈칸의 오른쪽 끝에 붙입니다 — 종이에서 그게 자연스럽습니다.
 */
function 보고달넣기(d: Hwpx, 해: number, 달: number): boolean {
  if (!해 || !달) return true;                 // 넣을 것이 없으면 그냥 둡니다
  return d.글고치기문서((글) => {
    if (!/^\s*\d{4}년\s+월\s*$/.test(글)) return null;
    let 나온것 = 글.replace(/\d{4}년/, `${해}년`);
    const m = /(\s+)월/.exec(나온것);
    if (!m) return null;
    const 폭 = m[1].length;
    const 달글 = String(달);
    const 채움 = 달글.length >= 폭 ? 달글 : " ".repeat(폭 - 달글.length) + 달글;
    return 나온것.slice(0, m.index) + 채움 + "월" + 나온것.slice(m.index + m[0].length);
  });
}

/**
 * 보고 문장 앞 **밑줄 친 빈칸**에 기관 이름을 넣습니다.
 *
 * 그 문단은 run 이 셋입니다 — ①밑줄 친 빈칸 열여섯 자 ②빈칸 하나
 * ③「"기관은 … 보고합니다."」. 우리가 고치는 것은 ①뿐입니다.
 * **빈칸 수를 지킵니다** — 길면 그냥 넘겨 씁니다(기관 이름을 자르지 않습니다).
 */
function 기관이름넣기(d: Hwpx, 이름: string): boolean {
  if (!이름) return true;                       // 넣을 것이 없으면 그냥 둡니다
  return d.글고치기문서((글) => {
    if (!/^ {4,}$/.test(글)) return null;       // 밑줄 친 빈칸만 골라냅니다
    return 이름.length >= 글.length
      ? 이름
      : 이름 + " ".repeat(글.length - 이름.length);
  }, { 앵커: "기관은 서비스 제공 결과" });
}

/** 파일 이름 — 사람이 폴더에서 알아볼 수 있게. */
export function 파일이름(v: 비용총괄값): string {
  const 성함 = (v.이용자.이름 || "이용자").replace(/[\\/:*?"<>|]/g, "");
  /*
   * **어느 기간치인가**를 이름에 씁니다. 보고한 날(9월)을 쓰면
   * 8월치 종이가 「2026-09」로 저장되어 폴더에서 헷갈립니다.
   */
  const 달 = String(v.구간.부터 || "").slice(0, 7)
    || `${v.보고.해}-${String(v.보고.달).padStart(2, "0")}`;
  return `개인별 서비스 비용총괄_${성함}_${달}.hwpx`;
}
