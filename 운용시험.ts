/**
 * 운용 시험 —  bun 운용시험.ts
 *
 * 기관 한 곳이 **2년**을 쓴 만큼 자료를 넣고, 화면과 API 가 얼마나
 * 걸리는지 잽니다. 파일럿에서 느려지면 그때는 자료가 이미 들어 있어
 * 고치기가 어렵습니다.
 */
import { 빈자료함띄우기 } from "./도구/빈자료함";
import { 무겁게하기, 이년치, type 규모 } from "./도구/무겁게하기";
import { join } from "node:path";

const 집 = await 빈자료함띄우기();
console.log("  빈 자료함:", 집.주소);

// 기관 개설
const r = await fetch(집.주소 + "/api/setup", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ orgName: "해남무겁게복지관", adminName: "박병섭",
    loginId: "onekey01", password: "시험1234" }),
});
console.log("  기관 개설:", r.status);
const 쿠키 = (r.headers.get("set-cookie") ?? "").split(";")[0];

console.log("\n  자료를 불립니다 (2년치)…");
const t0 = performance.now();
const 잣대: 규모 = process.argv[2] === "파일럿"
  ? { 대상자: 100, 달수: 12, 주당방문: 2.5 }   // 파일럿 기관이 첫 해에 쌓을 만큼
  : 이년치;                                    // 넉넉히 잡은 2년치
const 것 = 무겁게하기(join(집.폴더, "data", "tongdol.db"), 잣대);
console.log(`  잣대: 대상자 ${잣대.대상자}명 · ${잣대.달수}달치`);
console.log(`  대상자 ${것.대상자수.toLocaleString()} · 배정 ${것.배정수.toLocaleString()} · ` +
  `실적 ${것.실적수.toLocaleString()} · 청구 ${것.청구수.toLocaleString()}`);
console.log(`  자료함 ${(것.크기 / 1024 / 1024).toFixed(1)} MB · 넣는 데 ${Math.round((performance.now() - t0) / 1000)}초`);

const 달 = new Date().toISOString().slice(0, 7);
const 잴것: [string, string][] = [
  ["홈", "/api/home"],
  ["대상자 목록", "/api/recipients?sort=name&dir=asc"],
  ["대상자 찾기(이름)", "/api/recipients?q=김&sort=name&dir=asc"],
  ["종사자", "/api/staff"],
  ["배정·주간계획", "/api/assign"],
  ["제공실적 (이번 달)", `/api/records?month=${달}`],
  ["정산 (이번 달)", `/api/billing?month=${달}`],
  ["통계 (올해)", `/api/stats?year=${달.slice(0, 4)}`],
  ["기록지 (이번 달)", `/api/recordbook?month=${달}`],
  ["설정", "/api/settings"],
];

console.log("\n  ── 화면이 부르는 것을 재 봅니다 ──────────────");
const 느린것: string[] = [];
for (const [이름, 길] of 잴것) {
  const 잰것: number[] = [];
  let 코드 = 0, 크기 = 0;
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    const res = await fetch(집.주소 + 길, { headers: { cookie: 쿠키 } });
    const 글 = await res.text();
    잰것.push(performance.now() - t); 코드 = res.status; 크기 = 글.length;
  }
  const 가운데 = Math.round(잰것.sort((a, b) => a - b)[1]);
  const 표 = 가운데 > 1000 ? "★★ 느림" : 가운데 > 300 ? "★ 좀 느림" : "";
  if (가운데 > 300) 느린것.push(`${이름} ${가운데}ms`);
  console.log(`  ${이름.padEnd(20)} ${String(가운데).padStart(5)}ms  ${코드}  ${(크기/1024).toFixed(0)}KB  ${표}`);
}

console.log("\n  ── 요약 ──────────────────────────────────────");
if (느린것.length === 0) console.log("  300ms 넘는 화면이 없습니다.");
else console.log("  손봐야 할 곳: " + 느린것.join(" · "));

await 집.끄기();
