/**
 * 우편함을 들여다봅니다 —  bun 도구/우편함살펴보기.ts
 *
 * ── 왜 필요한가 ────────────────────────────────────────────
 *
 * 「폰에 오늘 갈 곳이 안 뜬다」가 나오면 막힌 데가 셋입니다.
 *
 *   ① 기관 PC 가 **안 올렸다**       (그날갈곳 이 걸러 냈거나, 안 돌았거나)
 *   ② 올렸는데 **인력 번호가 다르다** (그 폰이 볼 수 없는 자리에 있음)
 *   ③ 올렸고 번호도 맞는데 **폰이 못 본다** (등록·열쇠 문제)
 *
 * 셋은 고치는 자리가 전혀 다릅니다. 그런데 눈으로는 다 똑같이
 * 「안 뜬다」로 보입니다. 그래서 **우편함을 직접 열어** 셋 중
 * 어느 것인지 잘라 말해 줍니다.
 *
 * ★ 사람에 관한 것은 잠겨서 올라가 있습니다. 여기서는 이 PC 의
 *   기관 열쇠로 풀어서 보여 줍니다 — 이 PC 니까 되는 일입니다.
 *   우편함은 못 봅니다.
 */
import { db, initDb } from "../server/db";
import { 우편함 } from "../server/우편함";
import { 짐풀기 } from "../server/우편함자물쇠";
import { 그날갈곳 } from "../server/할일보내기";
import { today } from "../server/util";

/*
 * ★ 자료함을 손보기 전에 **칸을 맞춰 둡니다** (2026-09-11).
 *
 *   갱신(migrate)은 `initDb()` 안에서 돕니다. 그런데 그것을 부르는 것은
 *   프로그램 본체(server/index.ts)뿐이라, 이 도구를 곧장 `bun` 으로 돌리면
 *   **옛 자료함을 그대로 열어** 새로 생긴 칸을 못 찾습니다 —
 *
 *       SQLiteError: no such column: a.monthly_times
 *
 *   실제로 2026-09-11 에 이것으로 멈췄습니다. 한 줄이면 끝날 일입니다.
 */
initDb();


const 설정 = 우편함.설정읽기();
if (!설정) {
  console.error("\n  .env 가 아직 안 채워졌습니다 (우편함을 안 쓰는 기관입니다).\n");
  process.exit(1);
}
const 함 = new 우편함(설정);
const 날 = process.argv[2] || today();

console.log("");
console.log("  통돌 Note — 우편함 들여다보기");
console.log("  " + "=".repeat(56));
console.log(`  날짜  ${날}`);
console.log("");

/* ── ① 이 PC 는 오늘 무엇을 보낼 생각인가 ──────────────────── */
console.log("  ① 이 PC 가 보낼 것 (그날갈곳)");
console.log("  " + "-".repeat(56));
const 갈곳 = 그날갈곳(날);
if (!갈곳.length) {
  console.log("      없습니다.");
  console.log("      → 배정·요일·기간·대상자 상태·기기등록 중 하나가 걸린 것입니다.");
} else {
  for (const j of 갈곳) {
    const 짐 = j.짐 as any;
    console.log(`      ${짐.이름} · ${짐.서비스}   [${짐.갈래}]`);
    console.log(`        할일번호 ${j.id}`);
    console.log(`        인력번호 ${j.worker_id}`);
    console.log(`        집표     ${짐.집표 || "(없음 — 방문표를 아직 안 뽑았습니다)"}`);
  }
}
console.log("");

/* ── ② 등록된 폰들 ────────────────────────────────────────── */
console.log("  ② 이 기관에 등록된 폰");
console.log("  " + "-".repeat(56));
const 인력들 = db.query<{ name: string; mailbox_worker_id: string | null; status: string }, []>(
  `SELECT u.name, u.mailbox_worker_id, u.status
     FROM app_user u JOIN worker w ON w.user_id = u.id`).all();
for (const p of 인력들)
  console.log(`      ${p.name} (${p.status})  ${p.mailbox_worker_id || "- 기기등록 안 함"}`);
if (!인력들.length) console.log("      제공인력이 없습니다.");
console.log("");

/* ── ③ 우편함에 실제로 무엇이 있나 ────────────────────────── */
console.log("  ③ 우편함에 실제로 들어 있는 것");
console.log("  " + "-".repeat(56));
let 우편함것: any[] = [];
try {
  우편함것 = await 함.그날올라간것(날);
} catch (e) {
  console.log(`      X 우편함에 못 붙었습니다 - ${(e as Error).message}`);
  console.log("        인터넷이나 .env 의 열쇠를 봐 주세요.");
  process.exit(1);
}

if (!우편함것.length) {
  console.log("      비어 있습니다.");
} else {
  for (const r of 우편함것) {
    let 속 = "(못 풀었습니다 - 기관 열쇠가 바뀌었을 수 있습니다)";
    try {
      const p = (await 짐풀기(설정.기관열쇠, r.payload_enc)) as any;
      속 = `${p.이름} · ${p.서비스}  [${p.갈래 ?? "갈래없음"}]`
         + `  집표 ${p.집표 ? "있음" : "★없음"}`;
    } catch {}
    console.log(`      ${속}`);
    console.log(`        할일번호 ${r.id}`);
    console.log(`        인력번호 ${r.worker_id}`);
    console.log(`        올라간 때 ${r.created_at}`);
  }
}
console.log("");

/* ── ④ 그래서 어디가 막혔나 ──────────────────────────────── */
console.log("  ④ 판정");
console.log("  " + "=".repeat(56));

const 등록된번호 = new Set(인력들.map((p) => p.mailbox_worker_id).filter(Boolean) as string[]);

if (!갈곳.length) {
  console.log("      막힌 곳 - ① 이 PC 가 보낼 것이 없습니다.");
  console.log("        배정 화면에서 오늘 날짜에 걸리는 배정이 있는지,");
  console.log("        그 대상자가 「이용」인지, 제공인력이 기기등록을 했는지 봐 주세요.");
} else if (!우편함것.length) {
  console.log("      막힌 곳 - ② 보낼 것은 있는데 우편함이 비었습니다.");
  console.log("        올리는 일이 아직 안 돈 것입니다.");
  console.log("        프로그램을 껐다 켜시면 3초 뒤에 한 번 올립니다");
  console.log("        (그 뒤로는 10분마다).");
} else {
  const 짝없는 = 우편함것.filter((r) => !등록된번호.has(r.worker_id));
  const 갈래없는: string[] = [];
  const 집표없는: string[] = [];
  for (const r of 우편함것) {
    try {
      const p = (await 짐풀기(설정.기관열쇠, r.payload_enc)) as any;
      if (!p.갈래) 갈래없는.push(p.이름);
      if (!p.집표) 집표없는.push(p.이름);
    } catch {}
  }

  if (짝없는.length) {
    console.log("      막힌 곳 - ③ 우편함에 있는 것의 인력번호가");
    console.log("        이 PC 에 등록된 번호와 다릅니다. 그 폰은 못 봅니다.");
    for (const r of 짝없는) console.log(`          ${r.worker_id}`);
  } else if (갈래없는.length || 집표없는.length) {
    console.log("      올라가 있기는 한데 **옛 버전으로 올라간 것**입니다.");
    if (갈래없는.length) console.log(`        갈래 없음: ${갈래없는.join(", ")}`);
    if (집표없는.length) console.log(`        집표 없음: ${집표없는.join(", ")}`);
    console.log("        프로그램을 껐다 켜시면 같은 자리에 새로 덮어씁니다.");
  } else {
    console.log("      OK - 우편함까지는 멀쩡합니다.");
    console.log("        올라간 것도, 인력번호도, 집표도, 갈래도 다 맞습니다.");
    console.log("");
    console.log("        그러면 남은 것은 **폰 쪽**입니다.");
    console.log("        · 폰에서 「새로 고치기」를 한 번 눌러 보세요");
    console.log("        · 폰의 날짜가 오늘이 맞는지 보세요");
    console.log("        · 그래도 안 뜨면 폰 화면을 그대로 보내 주세요");
  }
}
console.log("");
