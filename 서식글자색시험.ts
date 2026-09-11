/**
 * **우리가 채운 값은 검정 정자체로 나가는가** —  bun 서식글자색시험.ts
 *
 * ── 왜 있나 ────────────────────────────────────────────────
 *
 * 2026-09-11, 파일럿 첫날. 무무 님이 물으셨습니다 —
 *   「편람의 예시와 같이 파란색 이텔릭체로 출력이 되면
 *     당연히 안되는 것을 너도 알고 설계를 했을 꺼야.」
 *
 * 뽑아 보니 **그렇게 나가고 있었습니다.**
 *
 *   서식4(식사) 한 장에 **47군데** — 회차·날짜·시각은 파랑,
 *                                    배달장소·식단은 **파란 기울임**
 *   서식5(동행)          **4군데** — 동행 장소
 *
 * 편람 서식은 「이렇게 적으세요」를 파란 기울임 예시 글씨로 그려 두었고,
 * 우리는 값을 **그 자리 run 에 그대로 얹었습니다.** 그래서 값이 그 모양을
 * 물려받았습니다. 지자체가 받으면 「예시를 안 지우고 낸 서류」입니다.
 *
 * ── 무엇을 지키나 ──────────────────────────────────────────
 *
 * **서식이 그려 둔 말은 한 글자도 안 건드립니다.** 원본에 없던 글자,
 * 즉 **우리가 넣은 것만** 골라서 검정 정자체인지 봅니다.
 * (`server/hwpx.ts` 의 `검정정자체ID` 가 하는 일입니다.)
 */
import { readFileSync } from "node:fs";
import { Hwpx } from "./server/hwpx";
import { parse, find, attr, kids, plain } from "./server/xml";
import { db, initDb } from "./server/db";

initDb();

let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, 참: boolean, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}

/** 그 파일 안의 「글자 조각 → 색·기울임」 목록. */
function 조각들(바이트: Buffer) {
  const d: any = new Hwpx(바이트);
  const 판 = find(parse(d.zip.text("Contents/header.xml")).root, "charProperties")[0];
  const 모양 = new Map<string, { 색: string; 이탤: boolean }>();
  for (const c of 판 ? kids(판, "charPr") : [])
    모양.set(String(attr(c, "id")), {
      색: String(attr(c, "textColor") ?? "#000000"),
      이탤: kids(c, "italic").length > 0,
    });
  const 나온것: { 글: string; 색: string; 이탤: boolean }[] = [];
  for (const run of find(parse(d.zip.text("Contents/section0.xml")).root, "run")) {
    const 글 = kids(run, "t").map((t: any) => plain(t)).join("");
    if (!글) continue;
    나온것.push({ 글, ...(모양.get(String(attr(run, "charPrIDRef"))) ?? { 색: "#000000", 이탤: false }) });
  }
  return 나온것;
}

const 검정 = (c: string) => !c || /^#?0{6}$/i.test(String(c).replace("#", ""));

/** 원본에 없던 글자 = 우리가 넣은 것. 그중 검정 정자체가 아닌 것. */
function 물든것(원본길: string, 뽑은것: Buffer) {
  const 옛것 = new Set(조각들(readFileSync(원본길)).map((x) => x.글));
  return 조각들(뽑은것)
    .filter((x) => !옛것.has(x.글))
    .filter((x) => x.이탤 || !검정(x.색));
}

/* ── 시범자료로 한 달치를 뽑습니다 ─────────────────────────── */
const 달 = "2026-08";
const 배정 = db.query<any, [string]>(
  `SELECT a.id, sv.record_type AS 갈래, sv.name AS 서비스,
          (SELECT COUNT(*) FROM delivery d WHERE d.assignment_id=a.id
            AND substr(d.served_on,1,7)=? AND d.outcome='제공') AS 수
     FROM assignment a JOIN service sv ON sv.id=a.service_id
    ORDER BY 수 DESC`).all(달);

const 볼것: { 이름: string; 원본: string; 배정: number }[] = [];
for (const [갈래, 원본] of [
  ["time", "서식/가사지원 제공기록지(서식3).hwpx"],
  ["meal", "서식/식사 관리 제공기록지(서식4).hwpx"],
] as const) {
  const 것 = 배정.find((x: any) => x.갈래 === 갈래 && x.수 > 0);
  if (것) 볼것.push({ 이름: `${것.서비스} (배정 ${것.id})`, 원본, 배정: 것.id });
}
// 동행·이미용은 서식5 로 나갑니다.
{
  const 것 = 배정.find((x: any) => /동행|이미용/.test(x.서비스) && x.수 > 0);
  if (것) 볼것.push({
    이름: `${것.서비스} (배정 ${것.id})`,
    원본: "서식/병원동행·이미용 제공기록지(서식5).hwpx", 배정: 것.id });
}

console.log("\n── 제공기록지 — 우리가 넣은 값의 글자 모양 ──────────────\n");
본다("시범자료로 뽑아 볼 배정을 찾았다", 볼것.length >= 2,
  볼것.map((x) => x.이름).join(" · "));

const { 만들기 } = await import("./server/제공기록지");
for (const v of 볼것) {
  let 파일들: { name: string; data: Buffer }[] = [];
  try { 파일들 = 만들기(v.배정, 달) as any; }
  catch (e: any) { 본다(`${v.이름} — 뽑힌다`, false, e?.message ?? String(e)); continue; }
  본다(`${v.이름} — 뽑힌다`, 파일들.length > 0, `${파일들.length}장`);
  for (const f of 파일들) {
    const 나쁜것 = 물든것(v.원본, f.data);
    본다(`★★ ${f.name} — 우리가 넣은 값이 **모두 검정 정자체**`,
      나쁜것.length === 0,
      나쁜것.length
        ? 나쁜것.slice(0, 3).map((x) =>
            `「${x.글.replace(/\s+/g, " ").trim().slice(0, 20)}」${x.색}${x.이탤 ? "·기울임" : ""}`).join(" ")
          + (나쁜것.length > 3 ? ` … 그 밖 ${나쁜것.length - 3}개` : "")
        : "");
  }
}

/* ── 계약서·영수증·비용총괄도 같은 눈으로 ──────────────────
 *
 * (무무 2026-09-11 — 「**어떤 서식이든** … 입력된 데이터값이 무조건적으로
 *  우선이 되어야 하며 … 검은색의 반이텔릭으로」)
 *
 * 서식2 계약서는 서명 줄 하나가 **통째로 빨강**입니다. 거기에 이름을
 * 얹으면 이름도 빨강이 됩니다. 그렇다고 덩이째 검정으로 바꾸면 서식이
 * 그려 둔 「본 인 (성명)」까지 검정이 되어 **서식을 고친 것**이 됩니다.
 * 그래서 덩이를 쪼개어 **우리 값만** 검정으로 찍습니다
 * (`server/hwpx.ts` 의 `값만검정`).
 */
console.log("\n── 계약서 · 영수증 · 비용총괄 ──────────────────────────\n");
{
  const rid = String((db.query<any, []>(
    "SELECT recipient_id AS r FROM assignment ORDER BY id LIMIT 1").get())?.r);
  if (rid && rid !== "undefined") {
    const c = await import("./server/계약서2");
    let 나온것: Buffer | null = null;
    try { 나온것 = c.build(c.모으기(rid, {} as any)); }
    catch (e: any) { 본다("서식2 계약서 — 뽑힌다", false, e?.message ?? String(e)); }
    if (나온것) {
      본다("서식2 계약서 — 뽑힌다", true);
      const 나쁜것 = 물든것("서식/서비스 제공·이용 계약서(서식2).hwpx", 나온것);
      본다("★★ 서식2 — 우리가 넣은 값이 **모두 검정 정자체**",
        나쁜것.length === 0,
        나쁜것.slice(0, 3).map((x) =>
          `「${x.글.replace(/\s+/g, " ").trim().slice(0, 20)}」${x.색}`).join(" "));

      /*
       * ★ 서식이 **회색으로 그려 둔 「(서명 또는 인)」**은 회색 그대로여야
       *   합니다. 값을 얹으면서 덩이째 검정으로 바꿔 버리면 여기서 잡힙니다.
       */
      const 옛것 = 조각들(readFileSync("서식/서비스 제공·이용 계약서(서식2).hwpx"));
      const 새것 = 조각들(나온것);
      const 회색 = (것: any[]) => 것.filter((x) =>
        /서명 또는 인/.test(x.글) && !검정(x.색)).length;
      본다("★ 서식이 회색으로 그려 둔 「(서명 또는 인)」은 회색 그대로",
        회색(새것) === 회색(옛것) && 회색(옛것) > 0,
        `원본 ${회색(옛것)}조각 → 뽑은 것 ${회색(새것)}조각`);
    }
  }
}
{
  const rows = db.query<any, []>("SELECT id FROM billing ORDER BY id LIMIT 5").all();
  let 영수증됨 = false, 총괄됨 = false;
  for (const r of rows) {
    if (!영수증됨) try {
      const 영 = await import("./server/영수증");
      const b = 영.build(영.gather(r.id));
      const 나쁜것 = 물든것("서식/본인부담금 영수증(서식7).hwpx", b);
      본다("★★ 서식7 영수증 — 우리가 넣은 값이 모두 검정 정자체",
        나쁜것.length === 0, 나쁜것.slice(0, 2).map((x) => `「${x.글.slice(0, 18)}」${x.색}`).join(" "));
      영수증됨 = true;
    } catch { }
    if (!총괄됨) try {
      const 총 = await import("./server/비용총괄");
      const b = 총.build(총.모으기(r.id, {}));
      const 나쁜것 = 물든것("서식/개인별 서비스 비용총괄(서식8).hwpx", b);
      본다("★★ 서식8 비용총괄 — 우리가 넣은 값이 모두 검정 정자체",
        나쁜것.length === 0, 나쁜것.slice(0, 2).map((x) => `「${x.글.slice(0, 18)}」${x.색}`).join(" "));
      총괄됨 = true;
    } catch { }
    if (영수증됨 && 총괄됨) break;
  }
  본다("영수증·비용총괄을 뽑아 볼 청구가 있었다", 영수증됨 && 총괄됨,
    `영수증 ${영수증됨} · 비용총괄 ${총괄됨}`);
}

/* ── 서식이 제 글자로 그려 둔 색은 **그대로** 두어야 합니다 ── */
/*
 * 글자로 견주면 안 됩니다 — 서식이 예시로 적어 둔 「1회차」 자리에 우리도
 * 「1회차」를 적으므로, 글자만 보면 **같은 글자가 검정이 되었다**로 보입니다.
 * 그건 바뀐 것이 아니라 **우리 값이 그 자리를 대신한 것**입니다.
 *
 * 그래서 **글자모양표(charPr) 자체**를 견줍니다. 우리는 원래 있던 모양을
 * **하나도 고치지 않고**, 검정 정자체를 새로 만들어 그쪽을 가리키게만 합니다.
 * 그러니 원래 모양이 하나라도 달라졌으면 서식을 건드린 것입니다.
 */
console.log("\n── 서식이 그려 둔 글자모양을 안 건드렸나 ────────────────\n");
{
  const 모양표 = (바이트: Buffer) => {
    const d: any = new Hwpx(바이트);
    const 판 = find(parse(d.zip.text("Contents/header.xml")).root, "charProperties")[0];
    const m = new Map<string, string>();
    for (const c of 판 ? kids(판, "charPr") : [])
      m.set(String(attr(c, "id")),
        `${attr(c, "textColor") ?? ""}|${kids(c, "italic").length}|${attr(c, "height") ?? ""}`);
    return m;
  };
  for (const v of 볼것) {
    const 파일들 = 만들기(v.배정, 달) as any as { name: string; data: Buffer }[];
    const 옛 = 모양표(readFileSync(v.원본));
    const 새 = 모양표(파일들[0].data);
    const 바뀐것: string[] = [];
    for (const [id, 값] of 옛) {
      const n = 새.get(id);
      if (n === undefined) 바뀐것.push(`id=${id} 없어짐`);
      else if (n !== 값) 바뀐것.push(`id=${id} ${값} → ${n}`);
    }
    본다(`★ ${v.이름} — 서식이 그려 둔 글자모양이 하나도 안 바뀌었다`,
      바뀐것.length === 0, 바뀐것.slice(0, 3).join(" · "));
    본다(`  (검정 정자체를 새로 만들어 붙였을 뿐)`, 새.size >= 옛.size,
      `원래 ${옛.size}개 → 지금 ${새.size}개`);
  }
}

console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
process.exit(실패수 ? 1 : 0);
