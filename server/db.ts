import { Database } from "bun:sqlite";
import { mkdirSync, existsSync, renameSync, unlinkSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { createTables, migrate, SCHEMA_VERSION } from "./schema";
import { 버전 } from "./version";
import { seedBuiltinProfile } from "./seed";

/**
 * 데이터 파일 위치
 * - 개발 중        : 프로젝트 폴더의 data/tongdol.db
 * - 만들어서 배포 시 : 실행 파일 옆의 data/tongdol.db
 * 어느 쪽이든 "이 기관의 원본"이 여기 한 파일에 들어갑니다.
 */
export const DATA_DIR = join(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = join(DATA_DIR, "tongdol.db");

/*
 * ── 옛 이름 자료함을 새 이름으로 ───────────────────────────
 *
 * 이름을 **챙김 Note → 통돌 Note** 로 바꾸면서 자료함 파일 이름도
 * `chaengkim.db` → `tongdol.db` 가 됐습니다.
 *
 * 그냥 두면 프로그램이 **빈 자료함을 새로 만들고**, 기관은 대상자도
 * 실적도 통째로 사라진 것으로 봅니다. 실제로는 옆에 멀쩡히 있는데도요.
 * **가장 무서운 종류의 사고**라, 켜기 전에 여기서 조용히 이어 붙입니다.
 *
 * 옮기지 않고 **이름만 바꿉니다.** 짝꿍 파일(-wal, -shm)도 함께 —
 * 안 옮기면 옛 자료의 남은 조각이 붕 뜹니다.
 * 새 이름 파일이 이미 있으면 아무것도 하지 않습니다.
 */
{
  const 옛자료함 = join(DATA_DIR, "chaengkim.db");
  if (!existsSync(DB_PATH) && existsSync(옛자료함)) {
    try {
      for (const 끝 of ["", "-wal", "-shm"]) {
        const 옛것 = 옛자료함 + 끝;
        if (existsSync(옛것)) renameSync(옛것, DB_PATH + 끝);
      }
      console.log("  이름     자료함을 chaengkim.db → tongdol.db 로 바꿨습니다.");
    } catch (e) {
      console.log(`  이름     자료함 이름을 못 바꿨습니다 — ${e}`);
    }
  }
}

/*
 * ── 되돌리기는 **여기서, 열기 전에** 일어납니다 ────────────
 *
 * 백업으로 되돌릴 때 돌아가는 도중에 파일을 바꾸면 자료가 깨집니다.
 * 그래서 화면에서는 바꿀 파일을 `_복원예정.db` 로 놓아 두기만 하고,
 * **다음에 켤 때 아무도 파일을 열기 전에** 이 자리에서 바꿔치웁니다.
 *
 * WAL 짝꿍 파일(-wal, -shm)도 함께 치웁니다. 안 치우면 옛 자료의
 * 남은 조각이 새 파일 위에 얹혀 이상한 상태가 됩니다.
 */
const 복원예정 = join(DATA_DIR, "_복원예정.db");
if (existsSync(복원예정)) {
  try {
    for (const 짝꿍 of [`${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
      try { if (existsSync(짝꿍)) unlinkSync(짝꿍); } catch { }
    }
    copyFileSync(복원예정, DB_PATH);
    unlinkSync(복원예정);
    console.log("  되돌림   백업 파일로 자료함을 되돌렸습니다.");
  } catch (e) {
    console.log(`  되돌림   실패 — ${e}`);
  }
}

export const db = new Database(DB_PATH, { create: true });

// 쓰기 도중 프로그램이 꺼져도 데이터가 깨지지 않게 합니다.
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

/*
 * ── ★ 남이 쓰고 있으면 **기다립니다** (2026-09-08 운용 시험) ──
 *
 * SQLite 는 한 번에 한 쪽만 쓰게 합니다. 그 자리가 잡혀 있을 때
 * 기본값은 **기다리지 않고 그 자리에서 「잠겼습니다」**를 내는 것입니다.
 * 그러면 화면에는 「처리 중 문제가 생겼습니다」만 뜨고, 방금 적은
 * 것은 사라집니다.
 *
 * 언제 생기나 —
 *   · **사무실 열기**로 옆 컴퓨터가 붙어 있을 때 두 사람이 같은 순간에 저장
 *   · 백업을 뜨는 동안 누가 저장
 *   · 제공인력 폰이 보낸 보고가 들어오는 순간 사무실이 저장
 *
 * 5초를 기다리게 합니다. 사람이 하는 저장은 **몇 밀리초**에 끝나므로
 * 5초 안에 거의 다 풀립니다. 기다려서 되는 것을 못 했다고 하는 것보다
 * 낫습니다.
 *
 * (2026-09-08 시험에서 확인 — 밖에서 자료함을 잡은 채 저장하면
 *  **500 이 났습니다.** 500 은 「우리가 처리하다 실패했다」는 뜻이라
 *  기관은 무엇을 해야 할지 알 수 없습니다.)
 */
db.exec("PRAGMA busy_timeout = 5000;");

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  내림막이();
  갱신전백업();

  createTables(db);
  migrate(db);          // 옛 자료함에 새로 생긴 칸을 덧붙입니다
  const builtinProfileId = seedBuiltinProfile(db);

  if (!metaGet("installed_at")) metaSet("installed_at", new Date().toISOString());
  metaSet("schema_version", String(SCHEMA_VERSION));
  metaSet("app_version", 버전);

  return {
    installedAt: metaGet("installed_at") ?? "",
    schemaVersion: SCHEMA_VERSION,
    version: 버전,
    builtinProfileId,
  };
}

/**
 * ── 내림 막이 ─────────────────────────────────────────────
 *
 * **새 버전이 만든 자료함을 옛 버전으로 열면 안 됩니다.**
 *
 * 그동안은 `schema_version` 을 **쓰기만 하고 읽지 않았습니다.** 그래서 옛 버전이
 * 새 자료함을 그냥 열고, 버전을 **옛 번호로 되돌려 썼습니다.** 옛 버전은 새로 생긴
 * 칸을 모르니 그 칸을 비운 채 저장하고, **어긋난 것을 아무도 모릅니다.**
 * USB 를 오가거나 되돌리기를 쓰다 보면 실제로 일어납니다.
 *
 * 그래서 **켜지지 않고 멈춥니다.** 자료가 조용히 어긋나는 것보다
 * 오늘 못 켜는 것이 낫습니다 — 못 켜는 것은 눈에 보이고, 어긋난 것은 안 보입니다.
 */
function 내림막이() {
  const 적힌것 = Number(metaGet("schema_version") ?? 0);
  if (!Number.isFinite(적힌것) || 적힌것 <= SCHEMA_VERSION) return;

  const 만든버전 = metaGet("app_version") ?? "더 새 버전";
  console.log("");
  console.log("  ┌──────────────────────────────────────────────┐");
  console.log("  │  이 자료함은 더 새 버전에서 만든 것입니다.     │");
  console.log("  └──────────────────────────────────────────────┘");
  console.log("");
  console.log(`  자료함이 만들어진 버전   ${만든버전} (구조 ${적힌것})`);
  console.log(`  지금 켜려는 버전         ${버전} (구조 ${SCHEMA_VERSION})`);
  console.log("");
  console.log("  옛 버전으로 열면 새로 생긴 칸을 몰라 자료가 어긋납니다.");
  console.log("  그래서 켜지 않았습니다. 자료는 그대로 있습니다.");
  console.log("");
  console.log("  새 버전 프로그램으로 켜 주세요.");
  console.log("  (새 버전을 잃어버리셨으면 만든 사람에게 알려 주세요.)");
  console.log("");
  process.exit(1);
}

/**
 * ── 갱신 전 백업 ──────────────────────────────────────────
 *
 * 버전이 바뀐 것을 알아채면 **자료함을 한 부 떠 두고** 시작합니다.
 * 새 버전이 `migrate()` 로 칸을 더하기 **전**의 모습이라, 새 버전에 문제가 있어
 * 옛 버전으로 돌아가야 할 때 돌아갈 자리가 됩니다.
 *
 * 이 파일은 **자동 정리에서 뺍니다**(`backup.ts`). 개수가 찼다고 지우면
 * 되돌아갈 유일한 자리가 사라집니다 — 되돌리기 안전 백업과 같은 이유입니다.
 */
function 갱신전백업() {
  const 옛버전 = metaGet("app_version");
  if (!옛버전 || 옛버전 === 버전) return;   // 처음 켜는 것이거나 같은 버전이면 안 뜹니다

  try {
    const 자리 = join(DATA_DIR, "보관");
    mkdirSync(자리, { recursive: true });
    const 안전 = (v: string) => v.replace(/[^0-9A-Za-z.\-]/g, "_");
    let 이름 = `tongdol-갱신전-${안전(옛버전)}.db`;
    for (let n = 2; existsSync(join(자리, 이름)) && n < 100; n++)
      이름 = `tongdol-갱신전-${안전(옛버전)}-${n}.db`;
    db.exec("VACUUM INTO ?", [join(자리, 이름)] as any);
    console.log(`  갱신     ${옛버전} → ${버전}. 먼저 한 부 떠 두었습니다 (${이름})`);
  } catch (e) {
    /*
     * 떠 두지 못해도 **켜기는 합니다.**
     * 되돌리기와 다릅니다 — 되돌리기는 지금 자료를 버리는 일이라 못 뜨면
     * 멈춰야 하지만, 갱신은 자료를 버리지 않습니다. 다만 크게 알려 둡니다.
     */
    console.log(`  갱신     ${옛버전} → ${버전}. **갱신 전 백업을 못 떴습니다** — ${e}`);
  }
}

export function metaGet(key: string): string | null {
  const row = db
    .query<{ value: string }, [string]>("SELECT value FROM meta WHERE key = ?")
    .get(key);
  return row?.value ?? null;
}

export function metaSet(key: string, value: string) {
  db.run(
    "INSERT INTO meta (key, value) VALUES (?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

/** 기관이 아직 개설되지 않았으면 true. 최초 실행 화면을 띄우는 기준입니다. */
export function needsSetup(): boolean {
  const org = db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM organization").get();
  const usr = db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM app_user").get();
  return (org?.c ?? 0) === 0 || (usr?.c ?? 0) === 0;
}
