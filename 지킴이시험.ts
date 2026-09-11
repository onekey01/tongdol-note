/**
 * 켜고 끄는 규칙 시험 —  bun 지킴이시험.ts
 *
 * ── 규칙 ───────────────────────────────────────────────────
 *
 *   1. 창이 열려 있으면 **안 꺼진다** (새로고침도 견딘다)
 *   2. 창 두 개 중 하나만 닫아도 **안 꺼진다**
 *   3. **마지막 창을 닫으면 꺼진다** — 검은 창이 남으면 기관이
 *      「이게 뭐지」 하고 못 씁니다 (2026-09-05 무무)
 *   4. 꺼진 뒤 정말 안 남아 있다
 *   5. 그래도 두 개가 도는 일이 있어(검은 창을 둔 채 아이콘을 또 누름)
 *      **켤 때도** 막는다 — 같은 자료함이면 새로 안 켜고 그 화면만 연다
 *   6. **다른 자료함**이면 남의 기관 것이므로 제 것을 새로 연다
 *
 * ── 꺼져도 자료를 안 잃습니다 ──────────────────────────────
 *
 * 한때 3번을 없앴던 적이 있습니다. 「꺼지면 폰과의 왕복이 멈춘다」고
 * 봤기 때문인데, **과장이었습니다.** 폰과 PC 사이에는 우편함이 있고
 * 보관 기간이 **14일**입니다(`우편함/001_기틀.sql`). 꺼져 있는 동안
 * 폰이 보낸 것은 거기서 기다렸다가 다음에 켜면 들어옵니다.
 * 꺼지는 것은 **늦어지는 것**이지 잃는 것이 아닙니다.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const 결과: { n: string; ok: boolean; d?: string }[] = [];
const 맞아야 = (n: string, ok: unknown, d = "") => 결과.push({ n, ok: !!ok, d });
const 잠깐 = (ms: number) => new Promise((r) => setTimeout(r, ms));

const 뿌리 = process.cwd();
const 주소 = "http://127.0.0.1:5757";
const 둘째주소 = "http://127.0.0.1:5758";

/**
 * 딴 폴더에서 프로그램을 켭니다. 진짜 자료함을 안 건드리게.
 *
 * `마당` 을 주면 **그 폴더에서** 켭니다 — 같은 자료함으로 두 번 켜는
 * 것을 흉내 낼 때 씁니다.
 *
 * ★ `지킴이끄기` 를 주면 `TONGDOL_NO_OPEN=1` 로 켭니다.
 *   그러면 브라우저도 안 열리고 **지킴이도 안 돕니다**(index.ts 의 `지킬까`).
 *   두 번 켜기를 볼 때는 프로그램이 안 꺼진 채로 있어야 하므로 이걸 씁니다.
 *   지킴이 자체를 볼 때는 주면 안 됩니다 — 브라우저는 이 시험 컴퓨터에
 *   기본 브라우저가 없어 조용히 안 열립니다.
 */
function 켜기(마당?: string, 지킴이끄기 = false, 환경: Record<string, string> = {}) {
  const 곳 = 마당 ?? mkdtempSync(join(tmpdir(), "켜기시험-"));
  /*
   * 화면 폴더(dist-web)가 **옆에 있어야 「실행 모드」**입니다.
   * 없으면 개발 모드라 실제와 다르게 돕니다.
   */
  try { symlinkSync(join(뿌리, "dist-web"), join(곳, "dist-web")); } catch { }
  const p = spawn("bun", ["run", join(뿌리, "server/index.ts")], {
    cwd: 곳,
    env: {
      ...process.env,
      ...(지킴이끄기 ? { TONGDOL_NO_OPEN: "1" } : {}),
      ...환경,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let 글 = "";
  p.stdout.on("data", (d) => { 글 += String(d); });
  p.stderr.on("data", (d) => { 글 += String(d); });
  return { p, 마당: 곳, 글보기: () => 글 };
}

/** 프로그램이 아직 살아 있나 — 주소를 두드려 봅니다. */
async function 살아있나(어디: string) {
  try {
    const r = await fetch(어디 + "/api/health", { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}

/** 그 주소가 쓰는 자료함이 어디인가. */
async function 자료함(어디: string): Promise<string | null> {
  try {
    const r = await fetch(어디 + "/api/health", { signal: AbortSignal.timeout(1500) });
    if (!r.ok) return null;
    return ((await r.json()) as any)?.dbKey ?? null;   // 경로 대신 지문 (2026-09-08)
  } catch { return null; }
}

/** 켜질 때까지 기다립니다. 자료함을 처음 만드는 데 시간이 좀 걸립니다. */
async function 켜지길기다리기(어디: string, 몇초 = 25) {
  for (let i = 0; i < 몇초 * 2; i++) {
    if (await 살아있나(어디)) return true;
    await 잠깐(500);
  }
  return false;
}

/** 화면이 붙는 것과 같은 줄(WebSocket)을 하나 잇습니다. */
async function 줄잇기(): Promise<WebSocket> {
  const 줄 = new WebSocket(주소.replace("http", "ws") + "/alive");
  await new Promise<void>((풀기) => {
    줄.onopen = () => 풀기();
    줄.onerror = () => 풀기();
    setTimeout(풀기, 3000);
  });
  return 줄;
}

const 치울것: { p: any; 마당: string }[] = [];

try {

// ══ 1. 지킴이가 켜진 채로 ════════════════════════════════
console.log("\n── 1. 창을 닫으면 꺼진다 ─────────────────────────────\n");
{
  const 한판 = 켜기(undefined, false, { TONGDOL_유예: "3000", TONGDOL_첫유예: "25000" });
  치울것.push(한판);
  맞아야("프로그램이 켜졌다", await 켜지길기다리기(주소));
  맞아야("★ 끄는 법을 창 닫기로 안내한다",
    한판.글보기().includes("브라우저 창을 닫으시면"),
    (한판.글보기().split("\n").find((x) => x.includes("닫으시면")) ?? "").trim());

  // 창 하나 — 유예를 훌쩍 넘겨도 안 꺼져야 합니다.
  const 창1 = await 줄잇기();
  await 잠깐(5000);
  맞아야("★ 창이 열려 있으면 안 꺼진다 (유예를 넘겨도)", await 살아있나(주소));

  // 새로고침 — 줄이 한 번 끊깁니다. 여기서 죽으면 못 씁니다.
  창1.close();
  await 잠깐(700);
  const 창1다시 = await 줄잇기();
  await 잠깐(5000);
  맞아야("★ 새로고침해도 안 꺼진다", await 살아있나(주소),
    "여기서 죽으면 F5 를 누를 때마다 프로그램이 죽습니다");

  // 창 두 개 → 하나만 닫기
  const 창2 = await 줄잇기();
  await 잠깐(500);
  창2.close();
  await 잠깐(5000);
  맞아야("★ 두 개 중 하나만 닫으면 안 꺼진다", await 살아있나(주소));

  // 마지막 창을 닫으면
  창1다시.close();
  await 잠깐(1200);
  맞아야("창을 닫자마자 바로 꺼지지는 않는다 (새로고침일 수 있으므로)",
    await 살아있나(주소));
  await 잠깐(4500);
  맞아야("★ 마지막 창을 닫으면 꺼진다", !(await 살아있나(주소)),
    "검은 창이 남으면 기관은 「이게 뭐지」 하고 못 씁니다");
  맞아야("★ 왜 꺼지는지 알려 준다",
    한판.글보기().includes("창이 닫혀서 프로그램을 끕니다"));
  맞아야("★ 그동안 온 것은 우편함에서 기다린다고 알려 준다",
    한판.글보기().includes("우편함에서 기다렸다가"),
    (한판.글보기().split("\n").find((x) => x.includes("우편함")) ?? "").trim());
  await 잠깐(800);
  맞아야("★ 뒤에 남아 있지 않다", 한판.p.exitCode !== null || 한판.p.killed,
    `종료코드 ${한판.p.exitCode}`);
}

// ══ 2. 두 번 켜기는 지킴이를 꺼 두고 봅니다 ═══════════════
await 잠깐(1000);
const 첫버전 = 켜기(undefined, true);
치울것.push(첫버전);
맞아야("지킴이를 꺼 두면 창 없이도 살아 있다", await 켜지길기다리기(주소));

// ══ 3. 같은 자료함으로 두 번 켜면 ═════════════════════════
console.log("\n── 3. ★ 같은 자료함이면 두 번 안 켜진다 ──────────────\n");
{
  // 첫버전과 **같은 폴더**에서 또 켭니다 — 바탕화면 아이콘을 또 누른 셈입니다.
  const 둘째 = 켜기(첫버전.마당, true);
  치울것.push(둘째);
  await 잠깐(8000);

  맞아야("★ 둘째는 스스로 물러난다", 둘째.p.exitCode === 0,
    `종료코드 ${둘째.p.exitCode}`);
  맞아야("★ 「이미 켜져 있습니다」라고 알려 준다",
    둘째.글보기().includes("이미 켜져 있습니다"),
    (둘째.글보기().split("\n").find((x) => x.includes("이미")) ?? "").trim());
  맞아야("★ 열어 줄 주소를 찍어 준다", 둘째.글보기().includes(주소));
  맞아야("★ 첫버전은 멀쩡히 살아 있다", await 살아있나(주소),
    "둘째가 첫버전을 밀어내면 안 됩니다");
  맞아야("둘째 자리(5758)에는 아무것도 안 열렸다", !(await 살아있나(둘째주소)));
}

// ══ 3-2. 옛 버전이 돌고 있으면 말해 준다 ═══════════════════
console.log("\n── 3-2. ★ 옛 버전이 돌고 있으면 알려 준다 ──────────────\n");
/*
 * 고친 것을 받으려고 다시 켰는데 앞 것이 아직 살아 있으면, 새것이
 * 조용히 물러납니다. 그러면 화면은 열리는데 **고친 것은 하나도 안
 * 들어간 채**로 쓰게 됩니다. 반드시 말해 줘야 합니다.
 * (2026-09-05 무무가 「검은창이 같이 안 닫혀」로 겪었습니다.)
 */
{
  const 옛버전 = 켜기(첫버전.마당, true, { TONGDOL_버전흉내: "1.0.1" });
  치울것.push(옛버전);
  await 잠깐(8000);
  const 글 = 옛버전.글보기();
  맞아야("★ 옛 버전이라고 알려 준다", 글.includes("옛 버전"), 글.slice(0, 200));
  맞아야("★ 두 버전 번호를 다 찍어 준다",
    글.includes("지금 도는 것") && 글.includes("새로 깐 것"));
  맞아야("★ 어떻게 하면 되는지 알려 준다",
    글.includes("브라우저 창을 모두"), "안내가 없으면 사람이 못 빠져나옵니다");
}

// ══ 4. 다른 자료함이면 제 것을 연다 ═══════════════════════
console.log("\n── 4. ★ 다른 자료함이면 새로 연다 (남의 기관) ────────\n");
{
  const 딴마당 = mkdtempSync(join(tmpdir(), "딴기관-"));
  mkdirSync(join(딴마당, "data"), { recursive: true });
  const 딴것 = 켜기(딴마당, true);
  치울것.push(딴것);

  맞아야("★ 딴 자료함은 제 자리를 새로 연다", await 켜지길기다리기(둘째주소),
    "여기서 물러나면 남의 기관 화면을 열어 주게 됩니다");
  const 갑 = await 자료함(주소);
  const 을 = await 자료함(둘째주소);
  맞아야("★ 둘이 서로 다른 자료함을 본다", !!갑 && !!을 && 갑 !== 을,
    `${갑}\n          ${을}`);
}

} finally {
  for (const x of 치울것.reverse()) {
    try { x.p.kill(); } catch { }
    try { rmSync(x.마당, { recursive: true, force: true }); } catch { }
  }
  let 실패 = 0;
  console.log("");
  for (const r of 결과) {
    if (!r.ok) 실패++;
    console.log(`${r.ok ? "  통과" : "✗ 실패"}  ${r.n}${r.d ? "   — " + r.d : ""}`);
  }
  console.log(`\n${결과.length}가지 중 ${결과.length - 실패}가지 통과, ${실패}가지 실패`);
  process.exit(실패 ? 1 : 0);
}
