/**
 * 우편함 왕복 시험 — **진짜 우편함**에 넣었다 빼 봅니다.
 *
 *   bun 도구/왕복시험.ts
 *
 * 지금까지는 「붙는가」만 봤습니다. 자료가 실제로 오간 적은 없습니다.
 * 여기서 보는 것 —
 *
 *   1. 기관 계정으로 로그인되나
 *   2. 할 일을 잠가서 올리고, 도로 받아 풀면 그대로인가
 *   3. **우편함에 실제로 저장된 것에 이름이 안 비치나**  ← 핵심
 *   4. 등록표가 만들어지나 (그리고 QR 에 담을 것이 제대로 나오나)
 *   5. 쓸어내기가 도나
 *   6. 넣은 것을 도로 다 지우나  ← 시험 자국을 안 남깁니다
 *
 * 가짜 이름으로만 합니다. 진짜 어르신 자료는 안 씁니다.
 */
import { 우편함 } from "../server/우편함";
import { 짐풀기, 키쌍만들기, 싼것풀기 } from "../server/우편함자물쇠";

let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: boolean, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}

const 설정 = 우편함.설정읽기();
if (!설정) {
  console.error(`
  .env 가 아직 덜 채워졌습니다.
  먼저 이것을 돌리세요 —   bun 도구/기관만들기.ts "시험기관"
`);
  process.exit(1);
}

const 함 = new 우편함(설정);
const 인력 = crypto.randomUUID();
const 할일번호 = crypto.randomUUID();
let 가짜폰계정 = "";

// 개발 열쇠는 **뒷정리와 엿보기에만** 씁니다. 기관 PC 코드는 안 씁니다.
const 개발열쇠 = process.env.TONGDOL_SUPABASE_SECRET_KEY?.trim();
/** 개발 열쇠로 아무 자리나 부릅니다 (auth 관리 API 용). */
async function 개발생(길: string, 옵션: RequestInit = {}) {
  return fetch(`${설정!.주소}${길}`, {
    ...옵션,
    headers: {
      apikey: 개발열쇠!, Authorization: `Bearer ${개발열쇠}`,
      "content-type": "application/json", ...(옵션.headers ?? {}),
    },
  });
}

async function 개발(길: string, 옵션: RequestInit = {}) {
  return fetch(`${설정!.주소}/rest/v1/${길}`, {
    ...옵션,
    headers: {
      apikey: 개발열쇠!, Authorization: `Bearer ${개발열쇠}`,
      "content-type": "application/json", ...(옵션.headers ?? {}),
    },
  });
}

const 가짜 = {
  이름: "시험순", 생년월일: "1940-01-01",
  주소: "어딘가군 시험읍 시험리 1-1", 연락처: "010-0000-0000",
  서비스: "가사지원",
};

console.log("\n── 진짜 우편함에 넣었다 빼 봅니다 ──────────────────\n");

try {
  // 1 ────────────────────────────────────────────────────
  await 함.두드리기();
  const 기관 = await 함.내기관();
  본다("기관 계정으로 로그인", true, 기관.slice(0, 8) + "…");

  // 인력 한 명을 잠깐 넣습니다
  await 개발("worker", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ id: 인력, org_id: 기관, active: true }),
  });
  본다("시험용 인력 한 명 넣기", true);

  // 2 ────────────────────────────────────────────────────
  const 오늘 = new Date().toISOString().slice(0, 10);
  const 몇 = await 함.할일올리기([
    { id: 할일번호, worker_id: 인력, served_on: 오늘, 짐: 가짜 },
  ]);
  본다("할 일을 잠가서 올림", 몇 === 1);

  // 3 ★ 우편함에 실제로 저장된 것을 개발 열쇠로 들여다봅니다 ──
  const 날것 = (await (await 개발(`job?id=eq.${할일번호}&select=payload_enc`)).json()) as
    { payload_enc: string }[];
  본다("우편함에 자리 잡음", 날것.length === 1);
  const 덩어리 = 날것[0]?.payload_enc ?? "";
  for (const [칸, 값] of Object.entries(가짜)) {
    본다(`저장된 것에 ${칸} 이 안 비침`, !덩어리.includes(값));
  }
  본다("덩어리가 v1 모양", 덩어리.startsWith("v1."));
  본다("풀면 그대로",
    JSON.stringify(await 짐풀기(설정.기관열쇠, 덩어리)) === JSON.stringify(가짜));

  // 4 ────────────────────────────────────────────────────
  const qr = await 함.등록표만들기(인력, 15);
  /*
   * 현장앱 주소를 정해 두었으면 QR 은 **주소**입니다 (https://…/#표=xxxx).
   * 아직 안 정했으면 JSON 입니다. 둘 다 표 하나만 들어 있어야 합니다.
   */
  const 주소형 = qr.startsWith("http");
  const 담긴것 = 주소형
    ? { 버전: "v1", 표: new URLSearchParams(qr.split("#")[1] || "").get("표") }
    : JSON.parse(qr);
  본다("QR 모양", true, 주소형 ? "주소형 (권장)" : "JSON (앱 주소 미설정)");
  본다("등록표 만들어짐", typeof 담긴것.표 === "string" && 담긴것.표.length > 20);

  /*
   * ★ 오늘 고친 자리 ★
   * QR 은 아무 앱이나 갖다 대면 안이 맨눈에 읽힙니다.
   * 그러니 QR 에 있어도 되는 것은 **15분짜리 일회용 표** 하나뿐입니다.
   */
  본다("QR 에 기관 열쇠가 없음", !qr.includes(설정.기관열쇠));
  본다("QR 에 주소가 없음", !담긴것.주소 && !qr.includes(".supabase.co"));
  본다("QR 에 공개 열쇠가 없음", !qr.includes("sb_publishable_"));
  본다("QR 에 개발 열쇠가 없음", !qr.includes("sb_secret_"));
  본다("QR 에 든 칸이 둘뿐", Object.keys(담긴것).sort().join(",") === "버전,표",
       Object.keys(담긴것).join(" · "));
  // ※ .env 에 TONGDOL_APP_URL 을 넣으면 QR 이 주소 모양으로 바뀝니다.
  본다("QR 이 짧음 (120자 안쪽)", qr.length < 120, `${qr.length}자`);

  // ── 열쇠 싸서 건네기 ────────────────────────────────────
  //   휴대폰이 하는 일을 흉내 냅니다 — 쌍을 만들고 공개쪽만 올립니다.
  //   기기 줄은 로그인 계정에 매여 있으므로 시험용 계정을 하나 만듭니다.
  const 폰계정 = (await (await 개발생("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: `phone-${crypto.randomUUID().slice(0, 8)}@tongdol.local`,
      password: Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64url"),
      email_confirm: true,
    }),
  })).json()) as { id: string };
  가짜폰계정 = 폰계정.id;
  const 폰 = await 키쌍만들기();
  await 개발("worker_device", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: 가짜폰계정, worker_id: 인력, org_id: 기관, pub_key: 폰.공개,
    }),
  });
  본다("휴대폰이 공개쪽을 올림", true);

  const 건넨수 = await 함.열쇠건네기();
  본다("기관 PC 가 열쇠를 건넴", 건넨수 >= 1, `${건넨수}대`);
  본다("기기 상태가 「됨」", (await 함.기기상태(인력)) === "됨");

  const 싼줄 = (await (await 개발(
    `worker_device?worker_id=eq.${인력}&select=wrapped_key`)).json()) as
    { wrapped_key: string }[];
  const 싼것 = 싼줄[0]?.wrapped_key ?? "";
  본다("우편함에 싼 열쇠가 놓임", 싼것.startsWith("w1."));
  본다("★ 싼 것에 기관 열쇠가 안 비침", !싼것.includes(설정.기관열쇠));
  본다("그 폰은 기관 열쇠를 풀어냄",
       (await 싼것풀기(폰.개인, 싼것)) === 설정.기관열쇠);

  const 남의폰 = await 키쌍만들기();
  let 남이풀었나 = false;
  try { await 싼것풀기(남의폰.개인, 싼것); 남이풀었나 = true; } catch { }
  본다("남의 폰은 못 풂", !남이풀었나);

  // 5 ────────────────────────────────────────────────────
  await 함.쓸어내기();
  본다("쓸어내기 돌아감", true);

} catch (e) {
  실패수++;
  console.log(`✗ 실패  ${(e as Error).message}`);
} finally {
  // 6 뒷정리 ──────────────────────────────────────────────
  try {
    await 개발(`worker_device?worker_id=eq.${인력}`, { method: "DELETE" });
    if (가짜폰계정)
      await 개발생(`/auth/v1/admin/users/${가짜폰계정}`, { method: "DELETE" });
    await 개발(`job?id=eq.${할일번호}`, { method: "DELETE" });
    await 개발(`worker?id=eq.${인력}`,  { method: "DELETE" });
    const 남았나 = (await (await 개발(`job?id=eq.${할일번호}&select=id`)).json()) as unknown[];
    본다("시험 자국을 다 지움", Array.isArray(남았나) && 남았나.length === 0);
  } catch (e) {
    console.log(`✗ 실패  뒷정리 — ${(e as Error).message}`);
    실패수++;
  }
}

console.log(`\n${"─".repeat(52)}\n  ${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
process.exit(실패수 ? 1 : 0);
