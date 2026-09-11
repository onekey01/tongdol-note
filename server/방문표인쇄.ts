/**
 * 방문표를 **종이에 뽑는 화면**.
 *
 * 관리자가 「방문표 인쇄」를 누르면 새 창에 이 화면이 뜨고,
 * 브라우저의 인쇄로 그대로 나갑니다. 따로 프로그램을 안 깝니다.
 *
 * ── 종이 크기를 왜 이렇게 잡았나 ──────────────────────────────
 *
 * A4 한 장에 여덟 장(가로 둘 × 세로 넷). 한 장이 대략 95 × 65 mm 로,
 * 어르신 댁 문 안쪽에 붙었을 때 **팔을 뻗지 않고 폰을 대는** 크기입니다.
 * 더 작게 하면 눈이 어두운 분이 계신 집에서 어디 붙었는지 못 찾습니다.
 *
 * ── 종이에 뭐라고 적나 ────────────────────────────────────────
 *
 * 붙이는 분(제공인력 또는 관리자)에게 하는 말과, 어르신께 하는 말이
 * 다릅니다. 어르신은 이 종이가 **무엇인지 모르면 떼십니다.**
 * 그래서 「떼지 마세요」와 까닭을 큰 글씨로 같이 적습니다.
 */
import type { 방문표 } from "./방문표";

const 담 = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * 종이에 찍는 사업 이름.
 *
 * 「2026년 의료·요양 통합돌봄 사업 안내」 표지의 **공식 명칭 그대로**입니다.
 * 우리가 지어낸 말을 어르신 댁 문에 붙이면 안 됩니다 —
 * 이 종이는 지자체 점검 때 눈에 띄는 물건입니다.
 * 해가 바뀌어도 안 고쳐도 되도록 연도는 뺐습니다.
 */
export const 사업명 = "의료·요양 통합돌봄 사업";

export function 방문표화면(것들: 방문표[], 기관이름: string, 기관전화 = ""): string {
  if (!것들.length)
    return `<!doctype html><meta charset="utf-8"><title>방문표</title>
      <body style="font:16px/1.7 'Malgun Gothic',sans-serif;padding:60px;text-align:center">
      <p>뽑을 방문표가 없습니다.</p>
      <p style="color:#666;font-size:14px">대상자를 고르고 다시 눌러 주세요.</p>`;

  const 칸들 = 것들.map((v) => `
    <div class="표">
      <div class="qr">${v.qr}</div>
      <div class="글">
        <div class="사업">${담(사업명)}</div>
        <div class="이름">${담(v.이름)}</div>
        <div class="말">
          <b>사업 종료 시까지 제거하지 마세요</b><br>
          방문한 것을 적는 표입니다.<br>
          담당자가 오면 이곳에 휴대전화를 댑니다.
        </div>
        <div class="기관">${담(기관이름)}${기관전화 ? ` · ${담(기관전화)}` : ""}</div>
      </div>
    </div>`).join("");

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>방문표 ${것들.length}장</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:'Malgun Gothic','맑은 고딕',sans-serif; color:#111; }

  /* 인쇄 때는 안 나가는 안내띠 */
  .안내 { background:#eef4ff; border-bottom:1px solid #c7d8f5; padding:14px 20px;
          font-size:14px; line-height:1.7; }
  .안내 b { color:#1a4fa0; }
  .안내 button { font-size:15px; padding:7px 18px; margin-left:14px; cursor:pointer; }

  /*
   * minmax(0,1fr) 인 까닭 — 그냥 1fr 로 두면 긴 글이 든 칸이
   * **제 너비를 밀어서** 왼쪽만 넓어집니다.
   * 처음 뽑았을 때 실제로 그렇게 나왔습니다.
   *
   * ★ 여기 보기로 진짜 같은 주소를 적어 두었다가 뺐습니다 —
   *   이 주석은 **인쇄되는 종이의 원본에 그대로 실려 나갑니다.**
   */
  .버전 { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:0; }

  .표 { display:flex; align-items:center; gap:5mm;
        height:65mm; padding:5mm;
        border:1px dashed #bbb;              /* 자르는 자리 */
        break-inside:avoid; page-break-inside:avoid; }
  .qr  { flex:0 0 34mm; }
  .qr svg { width:34mm; height:34mm; display:block; }
  .글  { flex:1; min-width:0; }

  /*
   * 주소를 뺐습니다 (2026-09-04 지시).
   * 붙일 집을 가리자고 넣었던 것인데, 이 종이는 **계약서와 같이
   * 그 집으로 들고 가는 것**이라 헷갈릴 일이 없습니다.
   * 그러면 문에 붙는 종이에 주소까지 적을 까닭이 없습니다.
   */
  .사업 { font-size:8.5pt; color:#555; letter-spacing:-0.3px; }
  .이름 { font-size:20pt; font-weight:700; letter-spacing:-0.5px; margin-top:0.5mm; }
  .말   { font-size:9pt; line-height:1.55; margin-top:3mm; }
  .말 b { font-size:11pt; color:#b3261e; letter-spacing:-0.5px; }
  .기관 { font-size:8pt; color:#888; margin-top:2.5mm; }

  @media print {
    .안내 { display:none; }
    .표 { border-color:#ddd; }
  }
</style></head>
<body>
  <div class="안내">
    <b>방문표 ${것들.length}장</b> — 그대로 인쇄해서 점선을 따라 자르시고,
    <b>어르신 댁 문 안쪽</b> 눈높이에 붙여 주세요.<br>
    비바람을 맞는 바깥쪽은 안 됩니다. 종이가 상하면 못 읽습니다.
    붙이신 뒤 <b>현장앱으로 한 번 찍어 보시면</b> 제대로 붙었는지 알 수 있습니다.
    <button onclick="window.print()">인쇄</button>
  </div>
  <div class="버전">${칸들}</div>
</body></html>`;
}
