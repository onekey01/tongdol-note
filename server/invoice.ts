/**
 * 본인부담금 청구서 — PDF.
 *
 * 기관이 **어르신께** 드리는 종이입니다 (지자체에 내는 것이 아닙니다).
 * 「이번 달 이만큼 서비스를 받으셨고, 본인부담금은 이만큼입니다」를 알리고
 * 수납계좌를 안내합니다. 수납이 끝나면 그때 영수증(receipt.ts)이 나갑니다.
 *
 * ── 서식은 「본인부담금 청구서(통돌).hwp」 를 따릅니다 ──────────────
 * 원본 서식은 표 11행 × 9열이고 서비스 줄이 **딱 2줄**입니다
 * (식사지원 · 이미용서비스가 예시로 박혀 있습니다).
 * 한 어르신이 서비스를 셋 넷 받는 일이 흔하므로 그대로 쓰면 모자랍니다.
 * PDF 로 직접 그리므로 **줄은 필요한 만큼** 늘립니다. 칸 이름과 차례는 서식 그대로입니다.
 *
 * ── 금액은 새로 계산하지 않습니다 ────────────────────────────────
 * 확정(issue)한 달이면 `calc_snapshot` 에 **얼려 둔 값**을 그대로 씁니다.
 * 단가가 나중에 올라도 이미 드린 청구서와 숫자가 달라지면 안 됩니다.
 * 아직 확정 전이면 「지금 계산」이라고 종이에 적어 둡니다 — 바뀔 수 있는 숫자입니다.
 */

import { 주소한줄 } from "./util";
import { Doc, mm, 도장준비, 직인, 연회색, 회색 } from "./pdf";
import { won } from "./money";
import * as billing from "./billing";

const 날짜 = (ymd: string) =>
  ymd ? `${ymd.slice(0, 4)}. ${Number(ymd.slice(5, 7))}. ${Number(ymd.slice(8, 10))}.` : "";
const 짧은날짜 = (ymd: string) =>
  ymd ? `${Number(ymd.slice(5, 7))}. ${Number(ymd.slice(8, 10))}.` : "";

/** 비어 있으면 「설정에서 채워 주세요」가 보이게 — 빈칸으로 나가면 다시 뽑아야 합니다. */
const 값 = (v: unknown, 빈말 = "") => {
  const s = String(v ?? "").trim();
  return s || 빈말;
};

export type 청구서자료 = ReturnType<typeof billing.one>;

/**
 * 「본인부담금 20%」처럼 구간 이름에 이미 비율이 들어 있으면 그대로 씁니다.
 * 없을 때만 괄호로 덧붙입니다 — 「20% (20%)」 같은 겹말을 막습니다.
 */
function 부담률표기(t: { label: string; rate: number }) {
  const label = String(t?.label ?? "").trim() || "면제";
  const pct = Math.round((t?.rate ?? 0) * 1000) / 10;
  return /\d\s*%/.test(label) ? label : `${label}  (${pct}%)`;
}

export async function build(recipientId: string, month: string, opt: {
  발행일?: string;          // 없으면 오늘
} = {}) {
  const b = billing.one(recipientId, month);
  const d = await 새문서();
  그리기(d, b, opt, await 도장준비(d, b.org?.stamp_png));
  return { pdf: await d.저장(), data: b, name: 파일이름(b) };
}

const 새문서 = () =>
  Doc.새로({ 여백: { 위: mm(20), 아래: mm(18), 좌: mm(20), 우: mm(20) } });

export function 파일이름(b: 청구서자료) {
  return `${b.month}_본인부담금청구서_${b.recipient.name ?? ""}.pdf`;
}

/**
 * 한 사람 몫을 **이미 만들어 둔 문서에** 그립니다.
 *
 * 문서를 새로 만들지 않는 것이 요점입니다.
 * 사람마다 따로 만들어 이어 붙이면 **글꼴이 사람 수만큼** 들어갑니다
 * (한 벌 1.2MB — 3명이 2.9MB 였습니다).
 * 한 문서에 쪽만 늘리면 글꼴은 한 번이고 40명이 1MB 를 넘지 않습니다.
 */
function 그리기(d: Doc, b: 청구서자료, opt: { 발행일?: string }, 도장: any) {
  d.쪽나누기();                  // 사람마다 새 쪽에서 시작합니다 (첫 사람은 그대로)
  const W = d.폭;
  const 오늘 = opt.발행일 ?? b.bill?.issuedOn ?? new Date().toISOString().slice(0, 10);

  /* ── 제목 ── */
  d.글("통합돌봄 서비스 이용 본인부담금 청구서", {
    size: 17, bold: true, align: "c",
  });
  d.y += 12;

  /* ── 기관·대상자 ──
     서식의 1~3행. 이름표 칸은 옅은 바탕으로 구분합니다. */
  const 표1 = [W * 0.16, W * 0.34, W * 0.16, W * 0.34];
  d.표(표1, [
    { cells: [
      { t: "서비스 제공\n기관명", bold: true, align: "c", fill: 연회색 },
      { t: 값(b.org?.name, "— 설정에서 기관명을 채워 주세요 —"), span: 3 },
    ] },
    { cells: [
      { t: "기관주소", bold: true, align: "c", fill: 연회색 },
      { t: 값(주소한줄({ address: b.org?.address, addressDetail: b.org?.address_detail }), "—") },
      { t: "고유번호", bold: true, align: "c", fill: 연회색 },
      { t: 값(b.org?.unique_no ?? b.org?.biz_no, "—") },
    ] },
    { cells: [
      { t: "대상자 명", bold: true, align: "c", fill: 연회색 },
      { t: 값(b.recipient.name) },
      { t: "생년월일", bold: true, align: "c", fill: 연회색 },
      { t: 값(b.recipient.birth) },
    ] },
    { cells: [
      { t: "본인부담률", bold: true, align: "c", fill: 연회색 },
      { t: 부담률표기(b.copayTier) },
      { t: "청구 기간", bold: true, align: "c", fill: 연회색 },
      { t: `${날짜(b.from)} ~ ${날짜(b.to)}` },
    ] },
  ], { minH: 22 });

  d.y += 10;

  /* ── 서비스 제공 내역 ──
     서식은 두 줄뿐이지만 받는 서비스 수만큼 늘립니다. */
  const 표2 = [W * 0.26, W * 0.2, W * 0.1, W * 0.16, W * 0.15, W * 0.13];
  const 머리 = [
    { cells: [{ t: "서비스 제공 내역", span: 6, bold: true, align: "c", fill: 연회색 }] },
    { cells: [
      { t: "서비스 종류", bold: true, align: "c", fill: 연회색 },
      { t: "제공기간", bold: true, align: "c", fill: 연회색 },
      { t: "건수", bold: true, align: "c", fill: 연회색 },
      { t: "서비스 제공 비용", bold: true, align: "c", fill: 연회색, size: 8.6 },
      { t: "본인부담금", bold: true, align: "c", fill: 연회색 },
      { t: "비고", bold: true, align: "c", fill: 연회색 },
    ] },
  ];

  const 줄들 = b.lines.map((l: any) => ({
    cells: [
      { t: 값(l.service) },
      { t: `${짧은날짜(b.from)} ~ ${짧은날짜(b.to)}`, align: "c" as const, size: 8.6 },
      { t: `${l.count}건`, align: "c" as const },
      { t: `${won(l.amount)}원`, align: "r" as const },
      { t: "", align: "r" as const },
      { t: l.over ? "생애한도 초과" : (l.holiday ? `휴일 ${l.holiday}건` : ""), size: 8.2 },
    ],
  }));

  // 받는 서비스가 없으면 빈 줄 두 개 — 서식의 모양을 지킵니다.
  if (줄들.length === 0)
    for (let i = 0; i < 2; i++)
      줄들.push({ cells: Array.from({ length: 6 }, () => ({ t: "" })) as any });

  d.표(표2, [
    ...머리,
    ...줄들,
    { cells: [
      { t: "총 액", span: 3, bold: true, align: "c", fill: 연회색 },
      { t: `${won(b.total)}원`, align: "r", bold: true },
      { t: `${won(b.copay)}원`, align: "r", bold: true },
      { t: "" },
    ] },
  ], { 머리반복: 2, minH: 20 });

  /* 본인부담금은 **총액에 한 번** 절삭합니다.
     줄마다 적으면 더한 값이 총액과 안 맞아 어르신이 물으십니다. 그래서 줄에는 안 씁니다. */
  d.y += 4;
  d.글(
    `※ 본인부담금은 서비스 제공 비용 합계에 본인부담률을 적용한 뒤 ` +
    `${b.profile?.rounding_unit ?? 10}원 단위로 ` +
    `${b.profile?.rounding_mode === "floor" ? "절삭" : b.profile?.rounding_mode === "ceil" ? "올림" : "반올림"}` +
    `하여 한 번에 계산합니다. 줄마다 나눈 값은 적지 않습니다.`,
    { size: 8.2, color: 회색 }
  );

  if (!b.frozen) {
    d.y += 3;
    d.글("※ 아직 확정하지 않은 달입니다. 실적이나 단가가 바뀌면 금액이 달라질 수 있습니다.",
         { size: 8.2, color: 회색 });
  }

  /* ── 청구 문구와 날짜 ── */
  d.y += 20;
  d.글("통합돌봄 서비스 중 본인일부 부담금을 청구합니다.", { size: 11, align: "c" });
  d.y += 16;
  d.글(날짜(오늘), { size: 11, align: "c" });
  d.y += 18;

  /* 수행기관 명 + 직인. 직인 그림이 없으면 점선 자리만 둡니다 (손도장). */
  const 기관 = `수행기관 명 :  ${값(b.org?.name)}`;
  const 기관폭 = d.폭재기(기관, 11, true);
  const 기관x = d.여백.좌 + (W - 기관폭 - mm(16)) / 2;
  d.글(기관, { x: 기관x, y: d.y, size: 11, bold: true, 폭: 기관폭 + 4 });
  직인(d, 기관x + 기관폭 + mm(4), d.y - mm(4), 도장);
  d.y += 34;      // 직인이 아래 가로줄에 닿지 않게 넉넉히 띄웁니다

  /* ── 수납계좌 ── */
  d.선(d.여백.좌, d.y, d.여백.좌 + W, d.y);
  d.y += 8;
  d.글("※ 본인부담금 수납계좌 안내", { size: 10, bold: true });
  d.y += 3;
  const 계좌 = [
    ["은행명", 값(b.org?.bank_name, "—")],
    ["계좌번호", 값(b.org?.bank_account, "—")],
    ["예금주", 값(b.org?.bank_holder, "—")],
  ];
  d.표([W * 0.16, W * 0.84], 계좌.map(([k, v]) => ({
    cells: [
      { t: k, bold: true, align: "c" as const, fill: 연회색 },
      { t: v },
    ],
  })), { minH: 18 });

  if (!b.org?.bank_account) {
    d.y += 4;
    d.글("※ 수납계좌가 비어 있습니다. 「설정 → 기관 정보」에서 채우면 여기에 나옵니다.",
         { size: 8.2, color: 회색 });
  }
}

/**
 * 한 달치를 **한 파일로** 묶습니다. zip 이 아니라 PDF 한 장짜리 묶음입니다.
 *
 * zip 으로 나눠 주면 사람마다 글꼴이 한 벌씩(1.2MB) 들어가 40명이면 50MB 가 됩니다.
 * 한 문서에 쪽만 늘리면 글꼴은 한 번, 전체가 1MB 남짓입니다.
 * 무엇보다 **인쇄를 한 번에** 걸 수 있어 현장에서 이게 훨씬 낫습니다.
 */
export async function buildAll(month: string, ids?: string[]) {
  const 사람들 = billing.month(month).items
    .filter((r: any) => !ids?.length || ids.includes(r.id));

  const d = await 새문서();
  let 도장: any = null, 넣은사람 = 0;
  for (const p of 사람들) {
    const one = billing.one(p.id, month);
    if (!one.lines.length) continue;      // 실적이 없으면 청구할 것이 없습니다
    if (넣은사람 === 0) 도장 = await 도장준비(d, one.org?.stamp_png);
    그리기(d, one, {}, 도장);
    넣은사람 += 1;
  }
  if (넣은사람 === 0) throw new Error("이 달에 청구할 것이 없습니다.");
  return {
    pdf: await d.저장(),
    count: 넣은사람,
    name: `${month}_본인부담금청구서_${넣은사람}명.pdf`,
  };
}
