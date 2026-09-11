/**
 * 서비스 제공·이용 계약서 — PDF.
 *
 * **어르신(이용자)과 제공기관 사이의 계약서**입니다.
 * 지자체에 내는 것이 아니라 두 벌 뽑아 한 벌은 어르신께, 한 벌은 기관이 보관합니다.
 *
 * ── 본문은 「서비스 제공 이용 계약서.hwp」 그대로입니다 ─────────────
 * 계약 사항 12개 조항과 5-1~5-5 세부 조항은 **한 글자도 바꾸지 않았습니다.**
 * 계약서 문구를 프로그램이 임의로 다듬으면 그 순간 법적 성격이 달라집니다.
 * 서비스가 늘거나 규정이 바뀌면 이 파일의 `조항` 만 고치면 됩니다.
 *
 * ── 사람이 손으로 쓸 것을 줄이는 것이 목적입니다 ──────────────────
 * 성명·생년월일·성별·주소·전화·대리인 2명·서비스 종류·계약기간·기관 정보는
 * 이미 시스템에 있는 값입니다. 그걸 또 손으로 옮겨 적을 이유가 없습니다.
 * **서명란만 비워 둡니다** — 그건 사람이 그 자리에서 해야 하는 일입니다.
 */

import { 주소한줄 } from "./util";
import { Doc, mm, 도장준비, 직인, 연회색, 회색 } from "./pdf";
import { db } from "./db";

const 날짜 = (ymd?: string | null) =>
  ymd ? `${ymd.slice(0, 4)}. ${Number(ymd.slice(5, 7))}. ${Number(ymd.slice(8, 10))}.` : "";
const 값 = (v: unknown, 빈말 = "") => (String(v ?? "").trim() || 빈말);

/* ── 계약 사항 ────────────────────────────────────────────
   원본 서식의 문구 그대로. 앞의 번호까지 포함해 적어 둡니다. */
const 조항: { t: string; 들여씀?: boolean }[] = [
  { t: "1. 이용자와 제공기관(제공인력)은 서로를 인격적으로 존중하고, 상호 인권을 침해하지 않습니다.\n" +
       "- 이용자와 제공인력은 서로 협의한 공식적인 호칭을 사용합니다.\n" +
       "- 이용자와 제공인력은 서로 명령이나 지시하는 말투를 삼갑니다.\n" +
       "- 이용자와 제공인력은 서로 돌봄을 재촉하거나 서두르지 않습니다.\n" +
       "- 이용자와 제공인력은 서로 욕설 및 폭언, 성적 모멸감을 주는 성희롱이나 성폭력, " +
       "신체적 위해를 가하는 폭력행위를 하지 않습니다." },
  { t: "2. 이용자는 <통합돌봄>이 돌봄 위기를 돕는 한시적·일시적 서비스로 서비스 내용과 횟수는 " +
       "<읍면 사무소> 돌봄 계획에 따름을 알고 있습니다." },
  { t: "3. 제공기관(제공인력)은 <읍면사무소>에서 수립된 돌봄 계획보다 더 많은 서비스를 임의 제공하며 " +
       "이용자에게 비용을 추가로 요구할 수 없습니다." },
  { t: "4. 이용자가 사전 취소 없이 예정된 일정에 자택이나 약속장소에 없으셔서, 서비스를 이용하지 " +
       "않으셨더라도 비용이 지출되며, 1인당 연간 지원한도액에서 차감됩니다.\n" +
       "※ 서비스 취소는 서비스 예정일 최소 1일 전까지 하셔야 합니다." },
  { t: "5. 본 서비스는 이용자에 대한 서비스에 한정되며, 이용자가 아닌 가족이나 동거인 등에게는 " +
       "제공하지 않습니다. 또한, 정해진 돌봄 서비스 외에 과도한 업무가 요구될 경우 서비스가 " +
       "중단될 수 있습니다." },
  { t: "5-1. 가사지원는 일상적인 신체활동·가사활동을 지원하며, 대청소나 김장담그기 등 과도한 업무는 " +
       "불가합니다.", 들여씀: true },
  { t: "5-2. 식사지원은 단순 배달이 아닌 돌봄서비스로 대면배달 원칙을 준수해야 합니다. " +
       "3회 연속 대면 수령하지 않은 경우 식사지원을 포함한 통합돌봄 서비스가 중지됩니다.", 들여씀: true },
  { t: "5-3. 동행지원은 병원과 관공서의 외출을 동행하며, 은행 업무 동행은 불가합니다.", 들여씀: true },
  { t: "5-4. 이미용 지원은 커트 등 기본적인 미용 서비스를 제공하며, 파마·손발톱 관리 서비스 제공은 " +
       "불가합니다.", 들여씀: true },
  { t: "5-5. 안전생활환경 시공 전 제공기관과 충분히 협의하여야 합니다. 시공 후 환불이 불가능하며, " +
       "A/S를 요청할 경우 일부 사항에 대해 본인부담금이 발생할 수 있습니다.", 들여씀: true },
  { t: "6. 이용자는 가정 내에 CCTV 등이 설치되어 있을 경우 정확한 위치를 제공인력에게 알려줍니다. " +
       "CCTV 등에 녹화된 제공자의 영상은 개인정보에 해당됩니다." },
  { t: "7. 이용자에게 반려동물이 있을 경우 제공기관(제공인력)에게 미리 알려줍니다.\n" +
       "이용자에게 사랑스러운 반려동물이 제공인력에게는 위험일 수 있습니다." },
  { t: "8. 이용자는 단정한 옷차림으로 제공자를 맞이하며(속옷차림 금지), 제공인력은 단정한 옷차림으로 " +
       "이용자를 방문합니다." },
  { t: "9. 제공기관(제공인력)은 정해진 돌봄 서비스 업무 범위 내에서 일방적인 서비스가 아닌 이용자가 " +
       "필요하고 원하는 서비스를 제공하며, 제공할 서비스는 미리 안내합니다." },
  { t: "10. 제공기관(제공인력)은 통합돌봄 전문 인력으로서 질 높은 서비스를 제공합니다." },
  { t: "11. 제공기관(제공인력)은 이용자의 인적사항 및 상담내용 등 업무와 관련하여 습득한 개인정보에 " +
       "대해 철저하게 보안을 유지하고 보호합니다. 서비스 제공기간은 물론 종료 후에도 개인정보를 " +
       "이용하거나 이를 제3자에게 제공 또는 누설하지 않습니다." },
  { t: "12. 이용자와 제공기관(제공인력은) 자신의 귀책 사유로 상대에게 손해를 끼치게 되면 이를 " +
       "배상해야 합니다. 이용자와 제공기관의 분쟁 발생 시 당사자 간 합의에 따라 처리하고, " +
       "만약 합의에 도달하지 못한 경우에는 관련 법규나 관례에 따릅니다." },
];

/* ── 자료 모으기 ──────────────────────────────────────── */
export function gather(recipientId: string) {
  const rec = db.query<any, [string]>("SELECT * FROM recipient WHERE id = ?").get(recipientId);
  if (!rec) throw new Error("대상자를 찾을 수 없습니다.");
  const p = JSON.parse(rec.payload || "{}");
  const org = db.query<any, []>("SELECT * FROM organization WHERE id = 1").get();

  /*
   * 계약에 담을 서비스와 기간 — **살아 있는 의뢰**를 봅니다.
   * 한 사람이 서비스를 여럿 받으면 계약서에는 한 줄로 모아 적고,
   * 계약기간은 그중 **가장 이른 시작 ~ 가장 늦은 종료** 로 잡습니다.
   */
  const 의뢰 = db.query<any, [string]>(
    `SELECT rf.service_id, rf.period_from, rf.period_to, rf.cycle_text, sv.name
       FROM referral rf JOIN service sv ON sv.id = rf.service_id
      WHERE rf.recipient_id = ?
      ORDER BY rf.period_from, rf.id`
  ).all(recipientId);

  // 서비스 이름이 겹치면 한 번만. 주기가 다르면 괄호로 붙입니다.
  const 서비스: string[] = [];
  for (const r of 의뢰) {
    const 표기 = r.cycle_text ? `${r.name}(${r.cycle_text})` : r.name;
    if (!서비스.includes(표기)) 서비스.push(표기);
  }
  const 시작 = 의뢰.map((r) => r.period_from).filter(Boolean).sort()[0] ?? "";
  const 끝 = 의뢰.map((r) => r.period_to).filter(Boolean).sort().at(-1) ?? "";

  const 대리인: any[] = Array.isArray(p.guardians) ? p.guardians : [];

  return {
    recipient: {
      id: recipientId,
      name: 값(p.name), birth: 값(p.birth), gender: 값(p.gender),
      address: 값(주소한줄(p)), phone: 값(p.phone), phoneHome: 값(p.phoneHome),
      cctv: 값(p.cctv), pet: 값(p.pet), caution: 값(p.caution),
      dong: rec.dong ?? "",
    },
    대리인,
    org,
    서비스, 시작, 끝,
  };
}

export async function build(recipientId: string, opt: {
  계약일?: string; 담당자?: string; 담당자연락처?: string;
} = {}) {
  const g = gather(recipientId);
  const d = await Doc.새로({ 여백: { 위: mm(16), 아래: mm(15), 좌: mm(18), 우: mm(18) } });
  d.쪽마다((doc, n) => {
    // 계약서는 두세 쪽이 됩니다. 쪽번호가 없으면 한 장이 빠져도 모릅니다.
    doc.글(`— ${n} —`, {
      x: doc.여백.좌, y: 841.89 - doc.여백.아래 + 4,
      폭: doc.폭, align: "c", size: 8, color: 회색,
    });
  });
  그리기(d, g, opt, await 도장준비(d, g.org?.stamp_png));
  return { pdf: await d.저장(), data: g, name: `계약서_${g.recipient.name}.pdf` };
}

function 그리기(d: Doc, g: ReturnType<typeof gather>, opt: {
  계약일?: string; 담당자?: string; 담당자연락처?: string;
}, 도장: any) {
  const W = d.폭;
  const 오늘 = opt.계약일 ?? new Date().toISOString().slice(0, 10);

  d.글("통합돌봄 서비스 제공·이용 계약서", { size: 16, bold: true, align: "c" });
  d.y += 12;

  /* ── 서비스 이용자 ── */
  머리("■ 서비스 이용자");
  const c1 = [W * 0.13, W * 0.24, W * 0.13, W * 0.17, W * 0.13, W * 0.2];
  d.표(c1, [
    { cells: [
      { t: "성 명", ...라벨 }, { t: g.recipient.name },
      { t: "생년월일", ...라벨 }, { t: g.recipient.birth },
      { t: "성별", ...라벨 }, { t: g.recipient.gender },
    ] },
    { cells: [{ t: "주 소", ...라벨 }, { t: g.recipient.address, span: 5 }] },
    { cells: [
      { t: "전화번호", ...라벨 },
      { t: `(집) ${g.recipient.phoneHome}`, span: 2 },
      { t: `(핸드폰) ${g.recipient.phone}`, span: 3 },
    ] },
  ], { minH: 20 });

  /*
   * 대리인·비상연락처.
   *
   * **비어 있는 것이 정상입니다.** 계약서는 초기상담을 가서 그 자리에서 씁니다.
   * 가기 전에 보호자 연락처를 알고 있는 경우가 오히려 드뭅니다.
   * 그래서 「—」 같은 것을 찍지 않고 **손으로 적을 자리를 넉넉히 비워 둡니다.**
   * 아는 것이 있으면 미리 찍혀 나가고, 없으면 그 자리에서 받아 적으시면 됩니다.
   */
  const 대 = (i: number) => g.대리인[i] ?? { relation: "", name: "", phone: "" };
  d.표([W * 0.13, W * 0.29, W * 0.29, W * 0.29], [0, 1].map((i) => ({
    cells: [
      { t: "대리인\n비상연락처", ...라벨, size: 8.6 },
      { t: `(관  계)  ${대(i).relation}` },
      { t: `(성  명)  ${대(i).name}` },
      { t: `(연락처)  ${대(i).phone}` },
    ],
  })), { minH: 28 });

  /* 방문 전 확인 — 서식에는 없지만 6·7조가 요구하는 내용입니다.
     조항에 적힌 것을 실제로 확인했다는 자리가 있어야 조항이 살아 있습니다. */
  if (g.recipient.cctv || g.recipient.pet || g.recipient.caution) {
    d.y += 4;
    d.표([W * 0.13, W * 0.87], [
      ...(g.recipient.cctv ? [{ cells: [{ t: "CCTV", ...라벨 }, { t: g.recipient.cctv }] }] : []),
      ...(g.recipient.pet ? [{ cells: [{ t: "반려동물", ...라벨 }, { t: g.recipient.pet }] }] : []),
      ...(g.recipient.caution ? [{ cells: [{ t: "그 밖 주의", ...라벨 }, { t: g.recipient.caution }] }] : []),
    ], { minH: 18 });
    d.y += 2;
    d.글("※ 6·7조와 관련하여 이용자가 알려주신 내용입니다.", { size: 8, color: 회색 });
  }

  /* ── 서비스 제공기관 ── */
  d.y += 10;
  머리("■ 서비스 제공기관");
  d.표([W * 0.13, W * 0.37, W * 0.13, W * 0.37], [
    { cells: [
      { t: "서비스 종류", ...라벨 },
      // 의뢰가 아직 안 들어온 채로 계약하러 가는 경우도 있습니다. 그때는 손으로 씁니다.
      { t: g.서비스.join(", "), span: 3 },
    ] },
    { cells: [
      { t: "계약기간", ...라벨 },
      { t: `${날짜(g.시작) || "____. __. __."} ~ ${날짜(g.끝) || "____. __. __."}`, span: 3 },
    ] },
    { cells: [
      { t: "기 관 명", ...라벨 }, { t: 값(g.org?.name) },
      { t: "대표자 성명", ...라벨 }, { t: 값(g.org?.ceo_name) },
    ] },
    { cells: [
      { t: "전화번호", ...라벨 }, { t: 값(g.org?.phone) },
      { t: "담 당 자", ...라벨 },
      { t: `(성  명) ${값(opt.담당자)}\n(연락처) ${값(opt.담당자연락처, 값(g.org?.phone))}`, size: 9 },
    ] },
  ], { minH: 20 });

  /* ── 계약 사항 ── */
  d.y += 10;
  머리("■ 계약 사항 (이용자 ↔ 제공기관(제공인력))");
  /* 오른쪽 「■ 확인」 칸은 어르신이 한 조항씩 짚어 보며 표시하는 자리입니다.
     체크가 미리 되어 있으면 확인한 적이 없는데 확인한 것이 되므로 **빈 네모**로 둡니다. */
  d.표([W * 0.86, W * 0.14], 조항.map((c) => ({
    cells: [
      { t: c.t, size: 8.8, valign: "t" as const, pad: 5, 들여씀: c.들여씀 ? 12 : 0 },
      { t: "확인", align: "c" as const, size: 8.8, 체크: false },
    ],
  })), { minH: 18, 머리반복: 0 });

  /* ── 서명 ── */
  d.자리확인(mm(58));
  d.y += 14;
  d.글("위 계약 사항을 충분히 설명 듣고 이해하였으며, 이에 동의하여 계약을 체결합니다.",
       { size: 9.5, align: "c" });
  d.y += 14;
  d.글(`${오늘.slice(0, 4)}년      월      일`, { size: 11, align: "c" });
  d.y += 16;

  const 반 = W / 2;
  /*
   * 이용자 쪽은 그 자리에서 **직접** 서명하십니다 — 도장을 대신 찍어 드릴 수 없습니다.
   * 기관 쪽은 설정에 넣어 둔 **직인**을 찍어 나갑니다.
   * 직인이 없으면 점선 자리만 나오므로 손도장을 찍으시면 됩니다.
   */
  서명칸(d.여백.좌, "이 용 자", g.recipient.name);
  서명칸(d.여백.좌 + 반, "제공기관", 값(g.org?.name), true);
  d.y += mm(20);

  d.글("※ 이 계약서는 2부를 작성하여 이용자와 제공기관이 각각 1부씩 보관합니다.",
       { size: 8.2, color: 회색, align: "c" });

  /* ── 조각들 ── */
  function 머리(t: string) {
    d.글(t, { size: 10.5, bold: true });
    d.y += 3;
  }
  /**
   * 서명칸. `기관` 이면 직인 자리를 함께 둡니다.
   *
   * 이용자 쪽에는 도장 자리를 안 둡니다 — 그 자리에서 직접 서명하시는 것이고,
   * 미리 동그라미를 그려 두면 도장을 꼭 찍어야 하는 것처럼 보입니다.
   */
  function 서명칸(x: number, 이름표: string, 값1: string, 기관 = false) {
    const y0 = d.y;
    d.글(`${이름표} :`, { x, y: y0, size: 10, bold: true, 폭: mm(22) });
    d.글(값1, { x: x + mm(24), y: y0, size: 10, 폭: 반 - mm(46) });
    // 서명 자리 — 여기는 사람이 직접 씁니다.
    d.선(x + mm(24), y0 + mm(9), x + 반 - mm(20), y0 + mm(9), 0.6, 회색);
    d.글("(서명 또는 인)", { x: x + mm(24), y: y0 + mm(10), size: 7.5, color: 회색 });
    if (!기관) return;
    // 기관 직인은 이름 끝에 살짝 겹쳐 찍습니다 — 종이 도장을 찍는 자리와 같습니다.
    const 끝 = x + mm(24) + Math.min(d.폭재기(값1, 10), 반 - mm(50));
    직인(d, 끝 + mm(3), y0 - mm(3), 도장);
  }
}

const 라벨 = { bold: true, align: "c" as const, fill: 연회색 };

/** 여러 사람의 계약서를 한 파일로. 글꼴이 한 번만 들어갑니다. */
export async function buildAll(ids: string[], opt: {
  계약일?: string; 담당자?: string; 담당자연락처?: string;
} = {}) {
  if (!ids.length) throw new Error("계약서를 만들 대상자를 골라 주세요.");
  const d = await Doc.새로({ 여백: { 위: mm(16), 아래: mm(15), 좌: mm(18), 우: mm(18) } });
  d.쪽마다((doc, n) => {
    doc.글(`— ${n} —`, {
      x: doc.여백.좌, y: 841.89 - doc.여백.아래 + 4,
      폭: doc.폭, align: "c", size: 8, color: 회색,
    });
  });
  let n = 0, 도장: any = null;
  for (const id of ids) {
    const g = gather(id);
    if (n === 0) 도장 = await 도장준비(d, g.org?.stamp_png);  // 기관은 하나 — 한 번만 넣습니다
    d.쪽나누기();
    그리기(d, g, opt, 도장);
    n += 1;
  }
  return { pdf: await d.저장(), count: n, name: `계약서_${n}명.pdf` };
}
