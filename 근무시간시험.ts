/**
 * 근무시간 시험 —  bun 근무시간시험.ts
 *
 * ── 무엇을 보나 ────────────────────────────────────────────
 *
 *   1. 종료 예약이 **일회성**인가 — 걸고, 읽고, 물리고, 지나면 사라지는가
 *   2. 엉뚱한 시간은 물리치는가
 *   3. ★ **예약을 걸어도 창을 닫으면 통돌 Note 가 꺼지는가**
 *
 * ── 왜 일회성인가 ──────────────────────────────────────────
 *
 * 처음에는 「몇 시간 뒤에 끌까요」를 **상시 설정**으로 만들었습니다.
 * 무무가 곧바로 물렸습니다 — 「켜는것은 상시이지만 끄는 것은 일시적
 * 이벤트로 필요할때만 시간 설정해서 끄도록 해줘야 해.」 (2026-09-05)
 *
 * 늘 몇 시간 뒤에 꺼지면 하루 종일 자리를 지키는 날에도 꺼집니다.
 * 반차라 일찍 나가는 날만 거는 것이 맞습니다.
 *
 * ── 3번이 핵심인 까닭 ──────────────────────────────────────
 *
 * 한때 「예약을 걸면 창을 닫아도 안 꺼지게」 해 볼까 했습니다.
 * 이것도 무무가 물렸습니다 — 「일반 이용자가 백그라운드에서
 * 돌아가고 있는 상황을 인지할 수 있는 방법이 없어.」
 *
 * 규칙은 하나뿐입니다 — **창을 닫으면 꺼집니다.** 종료 예약은
 * 윈도우가 들고 있으므로 그래도 컴퓨터는 제 시각에 꺼집니다.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const 결과: { n: string; ok: boolean; d?: string }[] = [];
const 맞아야 = (n: string, ok: unknown, d = "") => 결과.push({ n, ok: !!ok, d });
const 같아야 = (n: string, 실제: unknown, 바람: unknown) =>
  맞아야(n, 실제 === 바람, `나온 것 ${JSON.stringify(실제)} · 바란 것 ${JSON.stringify(바람)}`);
const 잠깐 = (ms: number) => new Promise((r) => setTimeout(r, ms));

const 뿌리 = process.cwd();
const 주소 = "http://127.0.0.1:5757";

/* ── 1·2. 예약을 다루는 법 ───────────────────────────────── */
console.log("\n── 1. 종료 예약은 일회성입니다 ───────────────────────\n");
{
  const { initDb, metaGet, metaSet } = await import("./server/db");
  initDb();
  const { 예약된때, 예약중인가, 종료예약취소, 예약시간들 } =
    await import("./server/근무시간");

  const 옛것 = metaGet("shutdown_at") ?? "";
  try {
    종료예약취소();
    같아야("처음에는 예약이 없음", 예약된때(), null);
    맞아야("그래서 예약 중이 아님", 예약중인가() === false);

    /*
     * 진짜 `shutdown` 은 이 시험 컴퓨터에 없습니다(윈도우가 아닙니다).
     * 예약이 **어떻게 다뤄지는가**를 보는 것이 목적이라, 자료함에
     * 직접 적어 두고 읽는 쪽을 봅니다.
     */
    const 두시간뒤 = new Date(Date.now() + 2 * 3600_000).toISOString();
    metaSet("shutdown_at", 두시간뒤);
    같아야("★ 걸어 두면 그 시각을 읽어 옴", 예약된때(), 두시간뒤);
    맞아야("예약 중이라고 나옴", 예약중인가() === true);

    종료예약취소();
    같아야("★ 물리면 없어짐", 예약된때(), null);

    /*
     * ★ **지난 예약은 스스로 지웁니다.**
     *   안 지우면 어제 걸었던 것이 오늘 화면에 그대로 떠서
     *   「곧 꺼진다」고 겁을 줍니다.
     */
    metaSet("shutdown_at", new Date(Date.now() - 60_000).toISOString());
    같아야("★ 이미 지난 예약은 없는 것으로 봄", 예약된때(), null);
    같아야("★ 그리고 자료함에서도 지움", metaGet("shutdown_at"), "");

    맞아야("고를 수 있는 시간이 여럿", 예약시간들.length >= 4);
    맞아야("★ 「안 함」 같은 상시 항목이 없음",
      예약시간들.every((x) => x.값 > 0),
      "끄기는 상시 설정이 아니라 그날의 예약입니다");
  } finally {
    metaSet("shutdown_at", 옛것);
  }
}

/* ── 3. 예약이 걸려 있어도 창을 닫으면 꺼진다 ────────────── */
function 켜기(마당: string, 환경: Record<string, string> = {}) {
  try { symlinkSync(join(뿌리, "dist-web"), join(마당, "dist-web")); } catch { }
  const p = spawn("bun", ["run", join(뿌리, "server/index.ts")], {
    cwd: 마당, env: { ...process.env, ...환경 }, stdio: ["ignore", "pipe", "pipe"],
  });
  let 글 = "";
  p.stdout.on("data", (d) => { 글 += String(d); });
  p.stderr.on("data", (d) => { 글 += String(d); });
  return { p, 마당, 글보기: () => 글 };
}

async function 살아있나() {
  try {
    const r = await fetch(주소 + "/api/health", { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}

async function 켜지길기다리기(몇초 = 25) {
  for (let i = 0; i < 몇초 * 2; i++) {
    if (await 살아있나()) return true;
    await 잠깐(500);
  }
  return false;
}

async function 줄잇기(): Promise<WebSocket> {
  const 줄 = new WebSocket(주소.replace("http", "ws") + "/alive");
  await new Promise<void>((풀기) => {
    줄.onopen = () => 풀기(); 줄.onerror = () => 풀기(); setTimeout(풀기, 3000);
  });
  return 줄;
}

const 치울것: { p: any; 마당: string }[] = [];
try {

console.log("\n── 3. ★ 예약이 걸려 있어도 창을 닫으면 꺼진다 ────────\n");
{
  const 마당 = mkdtempSync(join(tmpdir(), "근무시간-"));
  const 첫 = 켜기(마당, { TONGDOL_NO_OPEN: "1" });
  치울것.push(첫);
  await 켜지길기다리기();
  첫.p.kill();
  await 잠깐(1500);
  맞아야("자료함이 생김", existsSync(join(마당, "data", "tongdol.db")));

  // 두 시간 뒤 종료가 예약된 것처럼 자료함에 적어 둡니다.
  {
    const { Database } = await import("bun:sqlite");
    const db = new Database(join(마당, "data", "tongdol.db"));
    db.run("INSERT INTO meta (key, value) VALUES ('shutdown_at', ?) " +
           "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
           [new Date(Date.now() + 2 * 3600_000).toISOString()]);
    db.close();
  }

  const 버전 = 켜기(마당, { TONGDOL_유예: "2000", TONGDOL_첫유예: "20000" });
  치울것.push(버전);
  맞아야("예약이 걸린 채로 켜짐", await 켜지길기다리기());

  const 줄 = await 줄잇기();
  await 잠깐(600);
  줄.close();
  await 잠깐(6000);
  맞아야("★ 예약이 걸려 있어도 마지막 창을 닫으면 꺼진다", !(await 살아있나()),
    "예약은 윈도우가 들고 있으니, 통돌 Note 가 꺼져도 컴퓨터는 제 시각에 꺼집니다");

  const 글 = 버전.글보기();
  맞아야("★ 검은 창이 몇 시에 꺼지는지 알려 준다",
    글.includes("종료예약"),
    (글.split("\n").find((x) => x.includes("종료예약")) ?? "").trim());
  맞아야("★ 그래도 창 닫기로 끄라고 안내한다",
    글.includes("브라우저 창을 닫으시면"));
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
