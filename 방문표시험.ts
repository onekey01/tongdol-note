/**
 * 방문표 시험 —  bun 방문표시험.ts
 *
 * 여기서 보는 것 —
 *   1. 집표가 한 번 생기면 **안 바뀌는가**  ← 종이를 다시 붙이러 다닐 수 없습니다
 *   2. 사람마다 다른가, 그리고 추측할 수 있을 만큼 짧지 않은가
 *   3. 인쇄하기 전에는 안 생기는가 (10분마다 도는 일이 자료함에 글을 쓰면 안 됩니다)
 *   4. QR 안에 **이름이 안 들어가는가**  ← 문에 붙는 종이입니다
 *   5. 인쇄 화면이 꺾쇠(<)를 그대로 흘리지 않는가
 *   6. 할 일 짐에 집표가 **실려 나가는가**  ← 이게 없으면 현장앱이 대조를 못 합니다
 *   7. 아직 안 뽑은 집도 할 일은 **그대로 나가는가** (인쇄가 밀렸다고 일이 멈추면 안 됩니다)
 *
 * 시험이 끝나면 만든 것을 도로 지웁니다.
 */
import { db } from "./server/db";
import { 집표, 집표있는것, 방문표하나, 방문표여럿, 머리 } from "./server/방문표";
import { 방문표화면 } from "./server/방문표인쇄";

let 통과수 = 0, 실패수 = 0;
function 같아야(무엇: string, 실제: unknown, 바람: unknown) {
  if (실제 === 바람) { 통과수++; console.log(`  통과  ${무엇}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}\n          나온 것 ${JSON.stringify(실제)}\n          바란 것 ${JSON.stringify(바람)}`); }
}
function 맞아야(무엇: string, 참인가: boolean) { 같아야(무엇, !!참인가, true); }

// ── 시험용 대상자 두 분 ───────────────────────────────────────
const 이제 = new Date().toISOString();
const 만든것: string[] = [];
function 넣기(이름: string) {
  const id = crypto.randomUUID();
  db.run(
    `INSERT INTO recipient (id, payload, search_text, dong, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, '이용', ?, ?)`,
    [id, JSON.stringify({ name: 이름, address: "해남군 해남읍 성내리 12-3" }), 이름, "해남읍", 이제, 이제]
  );
  만든것.push(id);
  return id;
}
const 갑 = 넣기("김복순시험");
const 을 = 넣기("박정자시험");

try {

console.log("\n── 1. 인쇄하기 전에는 안 생깁니다 ──────────────────\n");
같아야("갓 들어온 분은 집표가 없음", 집표있는것(갑), null);

console.log("\n── 2. 한 번 생기면 안 바뀝니다 ─────────────────────\n");
const 갑표 = 집표(갑);
같아야("두 번째로 물어도 같은 값", 집표(갑), 갑표);
같아야("세 번째도 같은 값", 집표(갑), 갑표);
같아야("이제는 있는 것으로 나옴", 집표있는것(갑), 갑표);

console.log("\n── 3. 사람마다 다르고, 짧지 않습니다 ───────────────\n");
const 을표 = 집표(을);
맞아야("두 분의 집표가 다름", 갑표 !== 을표);
같아야("길이 22자 (16바이트)", 갑표.length, 22);
맞아야("영숫자와 - _ 만 (주소줄·QR 에 그대로 실림)", /^[A-Za-z0-9_-]{22}$/.test(갑표));

console.log("\n── 4. QR 안에 사람 것이 안 들어갑니다 ──────────────\n");
const 표 = await 방문표하나(갑);
같아야("이름은 종이에는 나옴", 표.이름, "김복순시험");
맞아야("QR 그림에 이름이 없음", !표.qr.includes("김복순시험"));
맞아야("QR 그림에 주소가 없음", !표.qr.includes("성내리"));
맞아야("QR 그림에 대상자 번호가 없음", !표.qr.includes(갑));
맞아야("QR 은 SVG", 표.qr.trimStart().startsWith("<svg"));
같아야("QR 머리는 TDV1:", 머리, "TDV1:");

console.log("\n── 5. 인쇄 화면 ────────────────────────────────────\n");
const 화면 = 방문표화면(await 방문표여럿([갑, 을]), "해남<시험>기관", "061-530-0000");
맞아야("두 사람이 다 들어감", 화면.includes("김복순시험") && 화면.includes("박정자시험"));
/*
 * 어르신은 이 종이가 **무엇인지 모르면 떼십니다.** 그래서 「떼지 마세요」에
 * 해당하는 말이 반드시 있어야 합니다. 다만 **정확한 문구는 바뀔 수 있으므로**
 * 글자를 그대로 견주지 않습니다 — 2026-09-09 에 「사업 종료 시까지
 * 제거하지 마세요」로 바뀌어 있었는데 시험만 옛 글자를 붙들고 있었습니다.
 */
맞아야("떼지 말라는 말이 있음",
  /떼지 마|제거하지 마|떼시면 안|그대로 두세요/.test(화면));
맞아야("기관 이름의 꺾쇠가 막혔음", 화면.includes("해남&lt;시험&gt;기관"));
맞아야("날 꺾쇠가 안 남았음", !화면.includes("해남<시험>기관"));
맞아야("A4 로 잡혀 있음", 화면.includes("size: A4"));
맞아야("기관 전화가 찍힘 — 물어볼 데가 있어야 안 떼십니다", 화면.includes("061-530-0000"));
맞아야("칸 너비가 긴 주소에 안 밀림", 화면.includes("minmax(0,1fr)"));
같아야("아무도 없으면 빈 화면", 방문표화면([], "기관").includes("뽑을 방문표가 없습니다"), true);

console.log("\n── 6. 할 일 짐에 실려 나갑니다 ─────────────────────\n");
/*
 * 배정까지 만들면 서비스·인력·기기등록이 다 있어야 해서 시험이 무거워집니다.
 * 여기서는 **짐을 싸는 자리**가 집표를 넣는지만 봅니다 —
 * 그날갈곳() 이 SELECT 하는 이름(r.집표)과 자료함의 칸 이름이 맞는지가 핵심입니다.
 */
const 칸들 = db.query<{ name: string }, []>("PRAGMA table_info(recipient)").all().map((c) => c.name);
맞아야("자료함에 visit_code 칸이 생겼음", 칸들.includes("visit_code"));

const 글 = await Bun.file("server/할일보내기.ts").text();
맞아야("그날갈곳() 이 visit_code 를 읽어 옴", 글.includes("r.visit_code AS 집표"));
맞아야("짐에 집표를 실음", 글.includes("집표: r.집표 ?? \"\""));

console.log("\n── 7. 안 뽑은 집도 할 일은 나갑니다 ────────────────\n");
const 병 = 넣기("최말순시험");
const 병줄 = db.query<{ visit_code: string | null }, [string]>(
  "SELECT visit_code FROM recipient WHERE id = ?").get(병);
같아야("집표는 비어 있고", 병줄?.visit_code ?? null, null);
맞아야("그래도 빈 글자로 실려 나감 (?? \"\")", 글.includes("?? \"\""));

} finally {
  for (const id of 만든것) db.run("DELETE FROM recipient WHERE id = ?", [id]);
  console.log(`\n  치움    시험용 대상자 ${만든것.length}분을 지웠습니다`);
}

console.log("\n" + "─".repeat(52));
console.log(`  통과 ${통과수} · 실패 ${실패수}`);
console.log("");
process.exit(실패수 ? 1 : 0);
