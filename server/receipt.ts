import { 주소한줄 } from "./util";
import { calcLines, won, type Line, type Rounding } from "./money";

/**
 * 본인부담금 영수증 — A4 한 장에 두 벌.
 *
 * 위 : 기관 보관용 (이용자 확인 서명을 받아 5년 보관)
 * 아래: 이용자 보관용 (기관 연락처·수납계좌)
 * 가운데 자르는 선으로 잘라 아래쪽을 이용자에게 드립니다.
 *
 * 직인은 자료함에 저장된 그림을 기관명 옆에 겹쳐 찍습니다.
 * 없으면 점선 동그라미가 나오므로 손도장을 찍으면 됩니다.
 *
 * 브라우저에서 열어 Ctrl+P 로 인쇄하면 A4 한 장에 맞습니다.
 * PDF 로 저장도 같은 창에서 됩니다.
 */

export type ReceiptData = {
  org: any;
  no: string;
  issuedOn: string;      // 2026. 8. 23.
  method: string;        // 계좌이체 | 현금
  recipient: { name: string; birth: string };
  copayLabel: string;
  copayRate: number;
  lines: Line[];
  rounding: Rounding;
  sample?: boolean;
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

function stamp(org: any) {
  return org?.stamp_png
    ? `<img class="stamp" src="${esc(org.stamp_png)}" alt="">`
    : `<span class="stamp-slot">직인</span>`;
}

function copy(d: ReceiptData, kind: "기관 보관용" | "이용자 보관용") {
  const calc = calcLines(d.lines, d.copayRate, d.rounding);
  const mine = kind === "기관 보관용";

  const rows = calc.rows.map((r) => `
      <tr>
        <td class="c">${esc(r.name)}</td>
        <td class="c">${esc(r.from)}${r.to ? ` ~ ${esc(r.to)}` : ""}</td>
        <td class="c">${r.count}</td>
        <td class="r">${won(r.amount)}</td>
        <td class="r">${won(r.copay)}</td>
        <td class="c"></td>
      </tr>`).join("");

  return `
  <section class="copy">
    <div class="head">
      <div class="title">통합돌봄 서비스 이용 본인부담금 영수증</div>
      <div class="badge">${kind}</div>
    </div>
    <div class="no">영수번호 ${esc(d.no)} &nbsp;·&nbsp; 발행일 ${esc(d.issuedOn)}${
      d.sample ? ' &nbsp;·&nbsp; <b>견본</b>' : ""}</div>

    <table>
      <tr>
        <th class="key">기관명</th><td class="l">${esc(d.org?.name)}</td>
        <th class="key">고유번호</th><td class="l">${esc(d.org?.unique_no) || "—"}</td>
      </tr>
      <tr>
        <th class="key">기관주소</th><td class="l" colspan="3">${esc(주소한줄({ address: d.org?.address, addressDetail: d.org?.address_detail })) || "—"}</td>
      </tr>
      <tr>
        <th class="key">대상자 명</th><td class="l">${esc(d.recipient.name)}</td>
        <th class="key">생년월일</th><td class="l">${esc(d.recipient.birth) || "—"}</td>
      </tr>
      <tr>
        <th class="key">본인부담률</th><td class="l">${esc(d.copayLabel)}</td>
        <th class="key">수납방법</th><td class="l">${esc(d.method)}</td>
      </tr>
    </table>

    <div class="gap"></div>

    <table>
      <tr>
        <th>서비스 종류</th><th>제공기간</th><th>건수</th>
        <th>서비스 제공 비용</th><th>본인부담금</th><th>비고</th>
      </tr>${rows}
      <tr class="total">
        <th colspan="2">총 액</th><td class="c">${calc.count}</td>
        <td class="r">${won(calc.total)}</td>
        <td class="r">${won(calc.copayTotal)}</td><td></td>
      </tr>
    </table>

    <div class="stmt">위 금액을 <b>정히 영수</b>하였음을 확인합니다.</div>
    <div class="date">${esc(d.issuedOn)}</div>

    <div class="signs">
      <div class="sign org-sign">
        <div class="lbl">수행기관</div>
        <div class="line"><span>${esc(d.org?.name)}${
          d.org?.ceo_name ? `&nbsp; ${esc(d.org.ceo_name)}` : ""}</span></div>
        ${stamp(d.org)}
      </div>
      <div class="sign">
        <div class="lbl">${mine ? "이용자 확인" : "문의"}</div>
        <div class="line">
          <span>${mine ? "" : esc(d.org?.phone) || ""}</span>
          ${mine ? '<span class="hint">(서명 또는 인)</span>' : ""}
        </div>
      </div>
    </div>

    <div class="foot">
      ${mine
        ? "※ 이 영수증은 기관이 보관하는 수납 증빙입니다. 이용자 확인 서명을 받아 5년간 보관합니다."
        : `※ 이 영수증은 이용자께 드리는 것입니다. 잘 보관해 주세요.<br>
           <span class="bank">수납계좌 &nbsp; ${esc(d.org?.bank_name) || "—"} &nbsp; ${
             esc(d.org?.bank_account) || "—"} &nbsp; 예금주 ${esc(d.org?.bank_holder) || esc(d.org?.name)}</span>`}
    </div>
  </section>`;
}

export function receiptHtml(d: ReceiptData): string {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>본인부담금 영수증 — ${esc(d.recipient.name)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #eceeed; }
  body { font-family: 'Batang', 'Noto Serif KR', 'Malgun Gothic', serif; color: #000; }

  .bar {
    position: sticky; top: 0; z-index: 5;
    background: #0e5c52; color: #fff; padding: 10px 16px;
    font-family: 'Pretendard', 'Malgun Gothic', sans-serif; font-size: 13px;
    display: flex; align-items: center; gap: 12px;
  }
  .bar button {
    font: inherit; padding: 5px 12px; border-radius: 3px; cursor: pointer;
    border: 1px solid #fff; background: #fff; color: #0e5c52; font-weight: 600;
  }
  .bar .tip { opacity: .85; }

  .sheet {
    width: 210mm; height: 297mm; padding: 12mm 14mm; margin: 12px auto;
    background: #fff; display: flex; flex-direction: column;
    box-shadow: 0 2px 10px rgba(0,0,0,.15);
  }
  .cut {
    flex: 0 0 auto; margin: 4mm 0; display: flex; align-items: center; gap: 3mm;
    font-size: 8pt; color: #555; letter-spacing: .3em;
  }
  .cut::before, .cut::after { content: ''; flex: 1; border-top: 1px dashed #999; }
  .copy { flex: 1 1 0; display: flex; flex-direction: column; min-height: 0; }

  .head { display: flex; align-items: flex-end; margin-bottom: 3mm; }
  .title { font-size: 16pt; font-weight: 700; letter-spacing: .08em; flex: 1; }
  .badge { font-size: 9pt; border: 1px solid #000; padding: 1mm 3mm; letter-spacing: .1em; white-space: nowrap; }
  .no { font-size: 8.5pt; color: #333; margin-bottom: 2mm; }

  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th, td { border: 1px solid #000; padding: 1.6mm 2mm; }
  th { background: #f0f0f0; font-weight: 600; text-align: center; white-space: nowrap; }
  td.l { text-align: left; } td.c { text-align: center; }
  td.r { text-align: right; font-variant-numeric: tabular-nums; }
  th.key { width: 22mm; }
  tr.total th, tr.total td { background: #f0f0f0; font-weight: 700; }
  .gap { height: 2.5mm; }

  .stmt { font-size: 10pt; text-align: center; margin: 3.5mm 0 2mm; }
  .stmt b { font-size: 12pt; }
  .date { font-size: 10pt; text-align: center; margin-bottom: 3mm; }

  .signs { display: flex; gap: 6mm; align-items: flex-start; }
  .sign { flex: 1; font-size: 9pt; }
  .sign .lbl { color: #333; margin-bottom: 1.5mm; }
  .sign .line {
    border-bottom: 1px solid #000; height: 9mm;
    display: flex; align-items: flex-end; justify-content: space-between; padding-bottom: .8mm;
  }
  .sign .hint { font-size: 8pt; color: #666; }

  .org-sign { position: relative; }
  .stamp { position: absolute; right: 2mm; bottom: -1mm; width: 17mm; height: 17mm; object-fit: contain; }
  .stamp-slot {
    position: absolute; right: 2mm; bottom: -1mm; width: 17mm; height: 17mm;
    border: 1px dashed #aaa; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 7pt; color: #aaa;
  }

  .foot { margin-top: auto; font-size: 8pt; color: #444; line-height: 1.5; }
  .foot .bank { border: 1px solid #000; padding: 1.5mm 2.5mm; display: inline-block; }

  @media print {
    body { background: #fff; }
    .bar { display: none; }
    .sheet { margin: 0; box-shadow: none; }
  }
</style></head>
<body>
  <div class="bar">
    <button onclick="window.print()">인쇄 / PDF로 저장</button>
    <span class="tip">A4 한 장입니다. 잘라서 아래쪽을 이용자에게 드리세요.${
      d.org?.stamp_png ? "" : " · 직인을 올리지 않아 점선 자리가 나옵니다(설정 → 기관 직인)."}</span>
  </div>
  <div class="sheet">
    ${copy(d, "기관 보관용")}
    <div class="cut">✁ 자르는 선</div>
    ${copy(d, "이용자 보관용")}
  </div>
</body></html>`;
}
