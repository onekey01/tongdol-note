import { mkdirSync, existsSync, statSync, readdirSync, copyFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, isAbsolute, basename, dirname, parse as 경로쪼개기 } from "node:path";
import { Database } from "bun:sqlite";
import { db, DB_PATH, DATA_DIR, metaGet, metaSet } from "./db";

/**
 * 백업 — **자료함 파일을 한 부 더 떠 두는 일.**
 *
 * ── 왜 프로그램이 해야 하는가 ──────────────────────────────
 * 이 프로그램의 자료는 **파일 하나**(tongdol.db)에 다 들어 있습니다.
 * 그 파일이 날아가면 기관의 대상자·실적·청구가 통째로 사라집니다.
 * 「가끔 복사해 두세요」라고 말로 하면 아무도 안 합니다.
 *
 * 처음에는 켜는 스크립트(run.ps1)가 복사하게 해 두었습니다.
 * 그런데 **한 번 켜 놓고 몇 주를 그대로 쓰는** 것이 이 바닥의 실제 모습입니다.
 * 켤 때만 뜨면 그 몇 주가 통째로 빈 채로 남습니다. 그래서 프로그램이 합니다.
 *
 * ── 어디에 두는가 ──────────────────────────────────────────
 * 기본은 자료함 옆(`data/보관`)입니다. 안 정해도 백업은 됩니다.
 *
 * 다만 같은 디스크에 두면 **그 디스크가 죽을 때 원본과 함께 죽습니다.**
 * 그래서 **다른 곳을 정할 수 있게** 했습니다 — USB, 외장하드, 공유 폴더.
 * 정해 두면 거기에도 함께 떠 둡니다. 옆자리 것을 없애지는 않습니다.
 *
 * ── 얼마나 자주, 얼마나 남기는가 ──────────────────────────
 * 기관이 정합니다 (기본 여섯 시간마다 · 최근 스무 부).
 * 다만 **지우는 것은 우리가 만든 파일뿐**입니다 (tongdol-날짜-시각.db).
 * 남의 폴더를 정했을 때 거기 있던 남의 파일을 건드리면 안 됩니다.
 */

/**
 * ── 얼마나 자주 뜨는가 ─────────────────────────────────────
 *
 * 하루 한 번이면 **그날 아침 이후의 일이 통째로 날아갈 수 있습니다.**
 * 40명 실적을 오후 내내 넣다가 저녁에 파일이 깨지면 그 반나절이 없어집니다.
 *
 * 그렇다고 한 시간마다 뜨면, 보관 부수가 하루 이틀치로 차 버려서
 * **정작 「사흘 전 것으로 되돌리기」가 안 됩니다.** 잦은 것과 오래 가는 것은
 * 서로 반대 방향이라 어느 한쪽으로 몰면 다른 쪽을 잃습니다.
 */
export const 주기들 = [
  { 값: 0,  이름: "켤 때만",        설명: "프로그램을 켤 때 한 부. 오래 켜 두면 그동안은 안 뜹니다." },
  { 값: 1,  이름: "한 시간마다",    설명: "가장 촘촘합니다. 대신 같은 개수라도 되돌릴 수 있는 날짜가 짧아집니다." },
  { 값: 6,  이름: "여섯 시간마다",  설명: "근무 중 두세 번. 최악의 손실이 몇 시간입니다. 권합니다." },
  { 값: 24, 이름: "하루 한 번",     설명: "가볍지만, 하루치 일이 날아갈 수 있습니다." },
] as const;

export const 기본주기 = 6;
export const 기본부수 = 20;

export function 주기(): number {
  const v = Number(metaGet("backup_every") ?? 기본주기);
  return 주기들.some((x) => x.값 === v) ? v : 기본주기;
}
export function 부수(): number {
  const v = Number(metaGet("backup_keep") ?? 기본부수);
  return Number.isFinite(v) && v >= 3 && v <= 200 ? Math.round(v) : 기본부수;
}

const 오늘 = () => new Date().toISOString().slice(0, 10);

/**
 * 백업 파일 이름.
 *
 * 하루 한 번이던 시절에는 날짜만 붙였는데, 하루에 여러 번 뜨게 되니
 * 같은 이름을 덮어써서 **하루 중 어느 시점인지 알 수 없었습니다.**
 * 그래서 시각을 붙입니다 — `tongdol-2026-08-28-1430.db`
 */
function 파일이름(when = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `tongdol-${when.getFullYear()}-${p(when.getMonth() + 1)}-${p(when.getDate())}` +
         `-${p(when.getHours())}${p(when.getMinutes())}.db`;
}

/**
 * 우리가 만든 백업 파일인가. **남의 파일은 절대 건드리지 않습니다.**
 * 옛 이름(날짜만)도 우리 것으로 봅니다 — 지난 백업을 남겨 두어야 합니다.
 */
/*
 * ── 옛 이름(chaengkim-…)도 우리 것으로 봅니다 ──────────────
 *
 * 이름을 챙김 Note → 통돌 Note 로 바꾸면서 새로 뜨는 백업은 `tongdol-…`
 * 이 됩니다. 그런데 **이미 떠 둔 것들은 옛 이름 그대로** 보관 폴더에 있습니다.
 *
 * 알아보지 못하면 그것들이 **목록에서 사라지고, 되돌릴 수도 없습니다.**
 * 이름을 바꾼 날 이전의 백업이 통째로 없는 것이 되는 셈입니다.
 * 그래서 **파일은 그대로 두고 알아보기만 넓힙니다** — 옛 파일을 손대면
 * 그 순간이 새로운 사고 자리가 됩니다.
 */
const 이름앞 = "(?:tongdol|chaengkim)";

const 때맞춰뜬것 = (name: string) =>
  new RegExp(`^${이름앞}-\\d{4}-\\d{2}-\\d{2}(-\\d{4})?\\.db$`).test(name) ||
  new RegExp(`^${이름앞}-\\d{8}\\.db$`).test(name);   // 옛 run.ps1 이 만들던 이름

/**
 * 되돌리기 직전에 떠 두는 것 — `tongdol-되돌리기전-…`.
 * **이것은 자동 정리에서 뺍니다.** 잘못 되돌렸을 때 돌아올 유일한 자리인데
 * 부수가 찼다고 지워 버리면 되돌리기가 외길이 됩니다.
 */
/*
 * 버전을 갈아 끼울 때 뜨는 것 — `tongdol-갱신전-0.1.0.db`.
 * **되돌릴 수는 있고, 자동 정리에서는 뺍니다.** 새 버전이 이상해서
 * 옛 버전으로 돌아가야 할 때 **돌아갈 유일한 자리**입니다.
 */
const 갱신전것 = (name: string) =>
  new RegExp(`^${이름앞}-갱신전-.+\\.db$`).test(name);

const 되돌리기전것 = (name: string) =>
  new RegExp(`^${이름앞}-되돌리기전-\\d{4}-\\d{2}-\\d{2}-\\d{4}(-\\d+)?\\.db$`).test(name);

/** 목록에 보이고 되돌릴 수 있는 것. */
const 우리것인가 = (name: string) =>
  때맞춰뜬것(name) || 되돌리기전것(name) || 갱신전것(name);

/** 오래되면 지워도 되는 것 — 때맞춰 뜬 것만. */
const 지워도되나 = 때맞춰뜬것;

/** 자료함 옆의 기본 자리. */
export const 기본자리 = join(DATA_DIR, "보관");

/** 기관이 따로 정한 자리 (없으면 빈 문자열). */
export function 정한자리(): string {
  return metaGet("backup_dir") ?? "";
}

/**
 * 그 폴더에 백업을 둘 수 있는가.
 *
 * **정하기 전에 실제로 써 봅니다.** 「저장했습니다」 해 놓고 정작 백업 때
 * 실패하면, 그 사실을 아무도 모른 채 몇 달이 지납니다.
 */
export function 자리검사(dir: string): { ok: boolean; why?: string } {
  const d = String(dir ?? "").trim();
  if (!d) return { ok: true };                      // 안 정한 것도 괜찮습니다
  if (!isAbsolute(d)) return { ok: false, why: "전체 경로로 적어 주세요. 예) D:\\백업" };
  try {
    mkdirSync(d, { recursive: true });
    if (!statSync(d).isDirectory()) return { ok: false, why: "폴더가 아닙니다." };
    const 시험 = join(d, ".tongdol-write-test");
    writeFileSync(시험, "ok");
    unlinkSync(시험);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, why: `그 폴더에 쓸 수 없습니다. (${e?.code ?? e?.message ?? "알 수 없음"})` };
  }
}

export function 자리정하기(dir: string) {
  const d = String(dir ?? "").trim();
  const r = 자리검사(d);
  if (!r.ok) throw new Error(r.why ?? "그 폴더는 쓸 수 없습니다.");
  metaSet("backup_dir", d);
  return { ok: true, dir: d };
}

/** 한 폴더에 떠 두고, 오래된 것을 정리합니다. */
function 한자리에(dir: string, 이름: string): { 만듦: boolean; 경로: string } {
  mkdirSync(dir, { recursive: true });
  const 경로 = join(dir, 이름);
  const 만듦 = !existsSync(경로);
  if (만듦) {
    /*
     * WAL 을 쓰므로 **그냥 복사하면 아직 안 옮겨진 것이 빠질 수 있습니다.**
     * SQLite 에게 「이 파일로 통째로 떠 달라」고 맡깁니다.
     */
    db.exec("VACUUM INTO ?", [경로] as any);
  }
  // 오래된 것 정리 — **우리가 만든 파일만.**
  const 우리파일 = readdirSync(dir).filter(지워도되나).sort();
  for (const f of 우리파일.slice(0, Math.max(0, 우리파일.length - 부수()))) {
    try { unlinkSync(join(dir, f)); } catch { }
  }
  return { 만듦, 경로 };
}

/** 이제 뜰 때가 됐는가. 켤 때는 언제나 한 부 뜹니다. */
export function 뜰때인가(): boolean {
  const 시간 = 주기();
  if (시간 === 0) return false;                    // 「켤 때만」
  const 마지막 = metaGet("backup_at");
  if (!마지막) return true;
  return Date.now() - new Date(마지막).getTime() >= 시간 * 60 * 60 * 1000;
}

/**
 * 백업합니다. 같은 분(分)에 이미 뜬 것이 있으면 그냥 넘어갑니다.
 * `강제` 를 주면 그것도 다시 뜹니다(「지금 백업」 단추).
 */
export function 백업하기(강제 = false): { 뜬곳: string[]; 건너뜀: boolean; 날: string } {
  const 이름 = 파일이름();
  const 자리들 = [기본자리, 정한자리()].filter(Boolean) as string[];
  const 뜬곳: string[] = [];
  let 하나라도 = false;

  for (const dir of 자리들) {
    try {
      if (강제) { try { unlinkSync(join(dir, 이름)); } catch { } }
      const r = 한자리에(dir, 이름);
      if (r.만듦) 하나라도 = true;
      뜬곳.push(r.경로);
    } catch (e: any) {
      // 한 자리가 막혀도 다른 자리는 떠 둡니다. 막힌 것은 화면이 알려 줍니다.
      metaSet("backup_error", `${dir} — ${e?.message ?? e}`);
    }
  }
  if (뜬곳.length) {
    metaSet("backup_at", new Date().toISOString());
    metaSet("backup_error", "");
  }
  return { 뜬곳, 건너뜀: !하나라도 && !강제, 날: 오늘() };
}

/** 화면에 보여 줄 것 — 어디에 · 언제 · 몇 부. */
export function 백업정보() {
  const 정한곳 = 정한자리();
  const 자리들 = [
    { 무엇: "이 컴퓨터", 경로: 기본자리, 정한것: false },
    ...(정한곳 ? [{ 무엇: "따로 정한 곳 (USB 등)", 경로: 정한곳, 정한것: true }] : []),
  ].map((x) => {
    let 파일: { 이름: string; 경로: string; 크기: number; 때: string; 되돌리기전: boolean }[] = [];
    let 문제 = "";
    try {
      파일 = readdirSync(x.경로).filter(우리것인가).map((f) => {
        const st = statSync(join(x.경로, f));
        return {
          이름: f,
          경로: join(x.경로, f),
          크기: st.size,
          때: new Date(st.mtimeMs).toISOString(),
          되돌리기전: 되돌리기전것(f),
        };
      }).sort((a, b) => (a.때 < b.때 ? 1 : a.때 > b.때 ? -1 : 0));   // 새것부터
    } catch (e: any) {
      문제 = x.정한것 ? "그 폴더를 읽지 못했습니다. 옮겼거나 USB 가 빠졌을 수 있습니다." : "";
    }
    return { ...x, 파일, 문제 };
  });

  let 원본크기 = 0;
  try { 원본크기 = statSync(DB_PATH).size; } catch { }

  return {
    원본: DB_PATH,
    원본크기,
    이름: basename(DB_PATH),
    마지막: metaGet("backup_at") ?? "",
    오류: metaGet("backup_error") ?? "",
    주기: 주기(),
    주기들,
    부수: 부수(),
    자리들,
    // 되돌리기를 예약해 두었다면 화면 맨 위에 띄웁니다.
    예약: 예약된것(),
    // 「지금 자료함에는 이만큼 들어 있다」 — 백업과 견주는 기준입니다.
    지금: 지금상태(),
  };
}

/** 얼마나 자주 뜰지, 몇 부를 남길지 정합니다. */
export function 주기정하기(시간: unknown, 남길부수: unknown) {
  if (시간 !== undefined && 시간 !== null && String(시간) !== "") {
    const v = Number(시간);
    if (!주기들.some((x) => x.값 === v)) throw new Error("그 주기는 고를 수 없습니다.");
    metaSet("backup_every", String(v));
  }
  if (남길부수 !== undefined && 남길부수 !== null && String(남길부수) !== "") {
    const n = Number(남길부수);
    if (!Number.isFinite(n) || n < 3 || n > 200)
      throw new Error("보관 개수는 3~200 사이로 정해 주세요.");
    metaSet("backup_keep", String(Math.round(n)));
  }
  return { 주기: 주기(), 부수: 부수() };
}


/**
 * ── 되돌리기 ───────────────────────────────────────────────
 *
 * 백업은 **떠 두는 것만으로는 절반**입니다. 되돌릴 수 없으면 없는 것과 같습니다.
 *
 * ── 왜 바로 바꿔치지 않는가 ────────────────────────────────
 * 프로그램이 그 파일을 **열어 놓고 쓰는 중**입니다.
 * 돌아가는 도중에 발밑의 파일을 바꾸면 자료가 깨집니다.
 * 그래서 **바꿀 파일을 옆에 놓아 두고, 다음에 켤 때 바꿉니다.**
 *
 * ── 지금 것을 먼저 떠 둡니다 ───────────────────────────────
 * 되돌리기는 **지금 자료를 버리는 일**입니다.
 * 잘못 골랐을 때 돌아올 자리가 없으면 안 되므로, 바꾸기 전에
 * 지금 것을 `되돌리기전-...` 이름으로 한 부 떠 둡니다.
 */
const 복원예정 = join(DATA_DIR, "_복원예정.db");

/** 백업 파일 안을 들여다봅니다 — 고르기 전에 「이게 맞나」를 보려고. */
export function 들여다보기(경로: string) {
  if (!existsSync(경로)) throw new Error("그 파일을 찾을 수 없습니다.");
  const 손님 = new Database(경로, { readonly: true });
  try {
    const 세기 = (sql: string) => {
      try { return (손님.query<{ n: number }, []>(sql).get()?.n ?? 0) as number; }
      catch { return 0; }
    };
    const 한줄 = (sql: string) => {
      try { return (손님.query<any, []>(sql).get() as any) ?? null; } catch { return null; }
    };
    return {
      경로,
      대상자: 세기("SELECT COUNT(*) AS n FROM recipient"),
      실적: 세기("SELECT COUNT(*) AS n FROM delivery"),
      청구: 세기("SELECT COUNT(*) AS n FROM billing"),
      메모: 세기("SELECT COUNT(*) AS n FROM sticky"),
      // 가장 마지막에 찍힌 실적 — 「어디까지 들어 있는가」를 한눈에.
      마지막실적: 한줄("SELECT MAX(served_on) AS n FROM delivery")?.n ?? "",
      크기: statSync(경로).size,
      만든때: new Date(statSync(경로).mtimeMs).toISOString(),
    };
  } finally { 손님.close(); }
}

/** 지금 자료함은 어디까지 들어 있는가. 백업과 견주려고. */
export function 지금상태() {
  const 세기 = (sql: string) => {
    try { return (db.query<{ n: number }, []>(sql).get()?.n ?? 0) as number; } catch { return 0; }
  };
  let 크기 = 0;
  try { 크기 = statSync(DB_PATH).size; } catch { }
  return {
    경로: DB_PATH,
    대상자: 세기("SELECT COUNT(*) AS n FROM recipient"),
    실적: 세기("SELECT COUNT(*) AS n FROM delivery"),
    청구: 세기("SELECT COUNT(*) AS n FROM billing"),
    메모: 세기("SELECT COUNT(*) AS n FROM sticky"),
    마지막실적: (db.query<any, []>("SELECT MAX(served_on) AS n FROM delivery").get() as any)?.n ?? "",
    크기,
  };
}

/**
 * 이 백업으로 되돌리도록 **예약**합니다.
 * 실제 바꿔치기는 다음에 프로그램을 켤 때 일어납니다(`대기중인복원()`).
 */
export function 되돌릴수있는파일인가(경로: string) {
  // 화면에서 온 경로를 그대로 열지 않습니다.
  // 우리가 만든 이름(tongdol-…)이나 자료함 이름만 봅니다.
  const 이름 = basename(경로);
  return 우리것인가(이름) || 이름 === basename(DB_PATH);
}

export function 되돌리기예약(경로: string) {
  if (!isAbsolute(경로)) throw new Error("전체 경로를 적어 주세요.");
  if (!되돌릴수있는파일인가(경로))
    throw new Error("통돌 Note 가 만든 백업 파일이 아닙니다.");
  들여다보기(경로);                       // 열리는 파일인지 먼저 확인
  const p = (n: number) => String(n).padStart(2, "0");
  const 이제 = new Date();
  const 앞 =
    `tongdol-되돌리기전-${이제.getFullYear()}-${p(이제.getMonth() + 1)}-${p(이제.getDate())}` +
    `-${p(이제.getHours())}${p(이제.getMinutes())}`;
  /*
   * 이름은 분 단위라 **같은 분에 두 번 되돌리면 부딪힙니다.**
   * SQLite 는 그때 「output file already exists」라는 영어를 뱉는데,
   * 그 말이 화면에 그대로 뜨면 쓰는 사람은 무슨 일인지 알 수 없습니다.
   * 게다가 덮어 버리면 **먼저 떠 둔 안전 백업이 사라집니다** — 그것이
   * 되돌리기를 무를 유일한 자리이므로, 덮지 않고 빈 이름을 찾습니다.
   */
  mkdirSync(기본자리, { recursive: true });
  let 안전이름 = `${앞}.db`;
  for (let n = 2; existsSync(join(기본자리, 안전이름)) && n < 100; n++)
    안전이름 = `${앞}-${n}.db`;
  // 지금 것을 먼저 떠 둡니다. 잘못 골랐을 때 돌아올 자리입니다.
  // **이것이 안 되면 되돌리지 않습니다.** 돌아올 자리 없이 지금 자료를
  // 버리는 것은, 백업을 만들어 놓은 뜻과 정반대입니다.
  try {
    db.exec("VACUUM INTO ?", [join(기본자리, 안전이름)] as any);
  } catch (e: any) {
    throw new Error(
      "되돌리기 전에 지금 자료를 먼저 떠 두어야 하는데, 그것이 안 됐습니다. " +
      "디스크가 꽉 찼거나 보관 폴더를 쓸 수 없는지 확인해 주세요. 되돌리지 않았습니다."
    );
  }

  copyFileSync(경로, 복원예정);
  metaSet("restore_from", 경로);
  metaSet("restore_at", new Date().toISOString());
  return { ok: true, 지금것을떠둠: join(기본자리, 안전이름) };
}

export function 예약취소() {
  try { unlinkSync(복원예정); } catch { }
  metaSet("restore_from", "");
  metaSet("restore_at", "");
  return { ok: true };
}

/** 예약된 되돌리기가 있는가. 화면이 「다시 켜 주세요」를 띄우는 데 씁니다. */
export function 예약된것() {
  if (!existsSync(복원예정)) return null;
  return {
    어느것: metaGet("restore_from") ?? "",
    언제: metaGet("restore_at") ?? "",
  };
}


/**
 * ── 폴더 고르개 ───────────────────────────────────────────
 *
 * 「따로 둘 곳」을 **손으로 타이핑하게 두면 안 됩니다.**
 * `D:\통돌Note백업` 을 `D;\` 로 잘못 쳐도 화면은 그럴듯하고,
 * 정작 백업이 안 되는 것은 몇 달 뒤에 압니다.
 *
 * 직인은 `<input type="file">` 로 고릅니다. 그런데 **폴더는 그렇게 못 고릅니다** —
 * 브라우저는 보안상 고른 폴더의 **전체 경로를 알려 주지 않습니다.**
 * (`webkitdirectory` 도 `showDirectoryPicker()` 도 상대 경로·손잡이만 줍니다.)
 * 그런데 우리 서버는 **그 컴퓨터 안에서 돌고 있습니다.** 그러니 서버가 폴더를
 * 훑어 목록으로 내주고, 화면은 탐색기처럼 눌러 들어가면 됩니다.
 *
 * **읽기만 합니다.** 여기서는 아무것도 만들거나 지우지 않습니다.
 */

/** 이 컴퓨터의 드라이브(윈도) 또는 뿌리(리눅스·맥). */
function 드라이브들(): { 경로: string; 이름: string }[] {
  if (process.platform !== "win32") {
    const 집 = process.env.HOME ?? "/";
    return [
      { 경로: "/", 이름: "/" },
      ...(집 !== "/" && existsSync(집) ? [{ 경로: 집, 이름: "내 폴더" }] : []),
    ];
  }
  const 목록: { 경로: string; 이름: string }[] = [];
  for (let c = 65; c <= 90; c++) {              // A: ~ Z:
    const d = `${String.fromCharCode(c)}:\\`;
    try { if (existsSync(d)) 목록.push({ 경로: d, 이름: d }); } catch { }
  }
  return 목록;
}

/**
 * 그 폴더 안의 **하위 폴더만** 돌려줍니다. 파일은 안 보여 줍니다 —
 * 여기서 고르는 것은 폴더이고, 파일까지 늘어놓으면 찾기만 어려워집니다.
 */
export function 폴더보기(경로?: string) {
  const 뿌리들 = 드라이브들();
  if (!경로) {
    return {
      지금: "", 이름: "이 컴퓨터", 위: null as string | null,
      뿌리들, 폴더들: 뿌리들, 쓸수있나: false, 문제: "",
    };
  }
  if (!isAbsolute(경로)) throw new Error("전체 경로를 적어 주세요. 예) D:\\통돌Note백업");

  let 폴더들: { 경로: string; 이름: string }[] = [];
  let 문제 = "";
  try {
    폴더들 = readdirSync(경로, { withFileTypes: true })
      // 숨김 폴더는 뺍니다. 백업을 거기에 둘 일이 없고, 목록만 어지럽힙니다.
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => ({ 경로: join(경로, e.name), 이름: e.name }))
      .sort((a, b) => a.이름.localeCompare(b.이름, "ko"))
      .slice(0, 500);   // 폴더가 수천 개인 자리도 있습니다. 화면이 죽으면 안 됩니다.
  } catch (e: any) {
    문제 = "이 폴더를 열지 못했습니다. 권한이 없거나 USB 가 빠졌을 수 있습니다.";
  }

  // 위로 가기 — 드라이브 뿌리면 「이 컴퓨터」로 올라갑니다.
  const 쪼갬 = 경로쪼개기(경로);
  const 위 = 쪼갬.root === 경로 || 경로 === "/" ? null : dirname(경로);

  return {
    지금: 경로,
    이름: basename(경로) || 경로,
    위,
    뿌리들,
    폴더들,
    // **정말 쓸 수 있는 자리인지 실제로 써 보고** 알려 줍니다.
    ...(() => {
      if (문제) return { 쓸수있나: false, 문제 };
      const r = 자리검사(경로);
      return { 쓸수있나: r.ok, 문제: r.ok ? "" : r.why };
    })(),
  };
}
