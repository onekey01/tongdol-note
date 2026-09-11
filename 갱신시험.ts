/**
 * 갱신(업데이트) 뼈대 시험 — 7-가.
 *
 * 여기서 보는 것:
 *  1) 버전 번호가 **한 곳(package.json)**에서만 나오는가
 *  2) 버전 견주기가 **숫자로** 되는가 — 글자로 하면 0.10 < 0.9 가 됩니다
 *  3) **내림 막이** — 더 새 버전이 만든 자료함으로는 **안 켜지는가**
 *  4) **갱신 전 백업** — 버전이 바뀌면 한 부 뜨는가
 *  5) 그 백업이 **자동 정리에서 빠지고, 되돌릴 수는 있는가**
 *  6) **자료함은 그대로인가** — 갈아 끼우는 것은 실행 파일뿐입니다
 *
 * 진짜 자료함을 건드리면 안 되므로 **딴 폴더에서** 프로그램을 켜 봅니다.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "bun:sqlite";
import { 버전, 버전견주기 } from "./server/version";
import { SCHEMA_VERSION } from "./server/schema";

const 결과: { n: string; ok: boolean; d?: string }[] = [];
const 통과 = (n: string, ok: boolean, d = "") => 결과.push({ n, ok: !!ok, d });

const 뿌리 = process.cwd();
const 마당 = mkdtempSync(join(tmpdir(), "갱신시험-"));

/** 딴 폴더에서 프로그램을 한 번 켰다 끕니다. 켜지면 그 자리에 자료함이 생깁니다. */
function 켜보기(작업폴더: string, 초 = 12) {
  const r = spawnSync("bun", ["run", join(뿌리, "server/index.ts")], {
    cwd: 작업폴더,
    env: { ...process.env, TONGDOL_NO_OPEN: "1", PORT: "5799" },
    encoding: "utf-8",
    timeout: 초 * 1000,
  });
  return { 글: `${r.stdout ?? ""}${r.stderr ?? ""}`, 코드: r.status };
}

try {
  // ── 1·2. 버전 번호와 견주기 ───────────────────────────────────
  const pkg = JSON.parse(await Bun.file(join(뿌리, "package.json")).text());
  /*
   * 버전 번호는 **세 자리**인데 손으로 적는 것은 앞 두 자리뿐입니다.
   * 맨 뒷자리는 자료함 구조 번호라 코드에서 따 옵니다 — 그래서 둘이
   * 어긋날 수가 없습니다. 어긋나면 「지금 몇 버전 쓰세요?」가 무너집니다.
   */
  const 앞두자리 = String(pkg.version).split(".").slice(0, 2).join(".");
  통과("**앞 두 자리는 package.json 하나에서 나온다**",
    버전.startsWith(앞두자리 + "."), `${버전} / ${pkg.version}`);
  통과("**맨 뒷자리는 자료함 구조 번호와 같다** (손으로 적지 않습니다)",
    버전 === `${앞두자리}.${SCHEMA_VERSION}`, `${버전} / 구조 ${SCHEMA_VERSION}`);
  통과("버전 번호는 세 자리다", /^\d+\.\d+\.\d+$/.test(버전), 버전);

  const 소스 = await Bun.file(join(뿌리, "server/index.ts")).text();
  통과("**소스에 버전 번호를 손으로 적어 두지 않았다**",
    !/version:\s*"\d+\.\d+/.test(소스),
    (소스.match(/version:[^\n]*/) ?? ["(없음 — 맞습니다)"])[0].trim());

  통과("버전 견주기 — 같으면 0", 버전견주기("1.2.3", "1.2.3") === 0);
  통과("버전 견주기 — 앞이 크면 1", 버전견주기("0.2.0", "0.1.9") === 1);
  통과("**0.10 이 0.9 보다 크다** (글자로 견주면 뒤집힙니다)",
    버전견주기("0.10.0", "0.9.0") === 1, String(버전견주기("0.10.0", "0.9.0")));
  통과("자리 수가 달라도 됩니다", 버전견주기("1.0", "1.0.0") === 0);

  // ── 3. 내림 막이 ───────────────────────────────────────────
  /*
   * 새 버전이 만든 자료함을 흉내 냅니다 — 구조 번호를 지금보다 크게 적어 둡니다.
   * 프로그램이 **켜지면 안 됩니다.**
   */
  const 미래 = join(마당, "미래자료함");
  mkdirSync(join(미래, "data"), { recursive: true });
  {
    const d = new Database(join(미래, "data", "tongdol.db"), { create: true });
    d.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
    d.run("INSERT INTO meta (key,value) VALUES ('schema_version', ?)", [String(SCHEMA_VERSION + 1)]);
    d.run("INSERT INTO meta (key,value) VALUES ('app_version','9.9.99')");
    d.close();
  }
  const 막힘 = 켜보기(미래);
  통과("**더 새 버전이 만든 자료함으로는 안 켜진다**", 막힘.코드 === 1, `종료코드 ${막힘.코드}`);
  통과("왜 안 켜지는지 사람 말로 알려 준다",
    막힘.글.includes("더 새 버전에서 만든 것입니다"), 막힘.글.split("\n").find((x) => x.includes("더 새 버전")) ?? 막힘.글.slice(0, 80));
  통과("어느 버전으로 켜야 하는지 알려 준다",
    막힘.글.includes("9.9.99") && 막힘.글.includes("새 버전 프로그램으로 켜 주세요"));
  통과("**자료는 건드리지 않았다고 말해 준다**", 막힘.글.includes("자료는 그대로 있습니다"));

  // ── 4·6. 갱신 전 백업 ──────────────────────────────────────
  /*
   * 옛 버전이 쓰던 자료함을 흉내 냅니다 — 구조는 지금과 같고 버전 번호만 옛것.
   * 켜면 **한 부 떠 두고** 그대로 열려야 합니다.
   */
  const 옛것 = join(마당, "옛버전자료함");
  mkdirSync(join(옛것, "data"), { recursive: true });
  켜보기(옛것);   // 한 번 켜서 제대로 된 자료함을 만듭니다
  const 자료함 = join(옛것, "data", "tongdol.db");
  통과("빈 폴더에서 켜면 자료함이 생긴다", existsSync(자료함));

  // 표적 하나를 심어 둡니다 — 갱신 뒤에도 그대로 있어야 합니다.
  {
    const d = new Database(자료함);
    d.run("INSERT INTO meta (key,value) VALUES ('시험표적','건드리면안됨') " +
          "ON CONFLICT(key) DO UPDATE SET value=excluded.value");
    d.run("UPDATE meta SET value = '0.0.9' WHERE key = 'app_version'");   // 옛 버전으로 위장
    d.close();
  }

  /*
   * ── 이미 떠 둔 백업들을 심어 둡니다 ───────────────────────
   *
   * 기관이 제일 무서워하는 것은 「새것 깔았다가 백업까지 날아가는 것」입니다.
   * 갱신은 **더하기만** 해야 합니다. 네 가지를 다 놓고 확인합니다.
   */
  const 보관자리 = join(옛것, "data", "보관");
  mkdirSync(보관자리, { recursive: true });
  const 심은백업 = [
    "tongdol-2026-01-02.db",                 // 때맞춰 뜬 것
    "tongdol-되돌리기전-2026-01-02-0900.db",
    "tongdol-갱신전-0.0.1.db",               // 지난번 갱신 때 뜬 것
    "기관이직접넣은메모.txt",                   // 우리 것이 아닌 파일
  ];
  for (const f of 심은백업) writeFileSync(join(보관자리, f), "심어둔것");

  const 갱신 = 켜보기(옛것);
  통과("**버전이 바뀌면 갱신 전 백업을 뜬다**",
    갱신.글.includes("갱신") && 갱신.글.includes("0.0.9"),
    갱신.글.split("\n").find((x) => x.includes("갱신")) ?? "(못 찾음)");

  const 보관 = readdirSync(join(옛것, "data", "보관"));
  const 뜬것 = 보관.filter((f) => f.startsWith("tongdol-갱신전-0.0.9"));
  통과("**파일 이름에 어느 버전에서 왔는지 남는다**",
    뜬것.length > 0, 뜬것.join(" · ") || "(없음)");

  // ── 갱신은 **더하기만** 한다 ───────────────────────────────
  /*
   * 「새것 깔았다가 백업까지 날아가면」이 기관이 제일 무서워하는 일입니다.
   * 자동 정리는 「때맞춰 뜬 것」만 지우고, 되돌리기전·갱신전은 건드리지 않습니다.
   * 심어 둔 네 가지가 **하나도 안 없어져야** 합니다.
   */
  for (const f of 심은백업) {
    통과(`**갱신해도 이미 있던 백업이 그대로다** — ${f}`,
      보관.includes(f), 보관.includes(f) ? "" : "사라졌습니다");
    if (보관.includes(f)) {
      const 속 = await Bun.file(join(보관자리, f)).text();
      통과(`  그 파일 속도 안 건드렸다 — ${f}`, 속 === "심어둔것", 속.slice(0, 20));
    }
  }
  통과("**보관은 늘기만 했다** (심은 4 + 갱신전 + 때맞춰 뜬 것)",
    보관.length >= 심은백업.length + 1, `${보관.length}개`);

  {
    const d = new Database(자료함);
    const 표적 = d.query<{ value: string }, []>(
      "SELECT value FROM meta WHERE key='시험표적'").get();
    const 지금버전 = d.query<{ value: string }, []>(
      "SELECT value FROM meta WHERE key='app_version'").get();
    d.close();
    통과("**자료는 그대로다** (갈아 끼우는 것은 실행 파일뿐)",
      표적?.value === "건드리면안됨", 표적?.value ?? "(사라짐)");
    통과("버전 번호가 새것으로 올라간다", 지금버전?.value === 버전, 지금버전?.value ?? "");
  }

  const 두번째 = 켜보기(옛것);
  통과("**같은 버전으로 다시 켜면 또 뜨지 않는다** (보관이 헛되이 차지 않게)",
    !두번째.글.includes("갱신     "), 두번째.글.split("\n").find((x) => x.includes("갱신")) ?? "(안 뜸 — 맞습니다)");

  // ── 5. 자동 정리에서 빠지고, 되돌릴 수는 있는가 ────────────
  const bk = await import("./server/backup");
  통과("**갱신 전 백업은 되돌릴 수 있다**",
    bk.되돌릴수있는파일인가(join(옛것, "data", "보관", 뜬것[0] ?? "tongdol-갱신전-0.0.9.db")),
    뜬것[0] ?? "");

  /* 자동 정리는 「때맞춰 뜬 것」만 지웁니다. 이름 모양으로 확인합니다. */
  const 정리대상 = /^tongdol-\d{4}-\d{2}-\d{2}(-\d{4})?\.db$|^tongdol-\d{8}\.db$/;
  통과("**자동 정리가 지우는 목록에는 없다** (돌아갈 유일한 자리입니다)",
    !(뜬것[0] ?? "").match(정리대상), 뜬것[0] ?? "");
} finally {
  try { rmSync(마당, { recursive: true, force: true }); } catch { }
  let 실패 = 0;
  for (const r of 결과) {
    if (!r.ok) 실패++;
    console.log(`${r.ok ? "  통과" : "✗ 실패"}  ${r.n}${r.d ? "   — " + r.d : ""}`);
  }
  console.log(`\n${결과.length}가지 중 ${결과.length - 실패}가지 통과, ${실패}가지 실패`);
  process.exit(실패 ? 1 : 0);
}
