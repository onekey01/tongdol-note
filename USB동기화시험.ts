/**
 * USB 로 오간 자료 맞추기 —  bun USB동기화시험.ts
 *
 * ═══════════════════════════════════════════════════════════
 *  왜 이 시험이 있나
 * ═══════════════════════════════════════════════════════════
 *
 * (2026-09-06 무무 — 「USB에 백업된 파일을 가지고 **집에서 작업** 시
 *  다음날 출근하여 백업USB를 기관PC에 꽂아 프로그램을 열면
 *  **최신 데이터로 동기화** 해줘야 해」)
 *
 * ── 이 기능이 잘못되면 나는 일 ──────────────────────────────
 *
 *  ① **말없이 덮어씁니다.** 어제 집에서 한 것을 가져오는 사이,
 *     그날 오전에 사무실에서 넣은 실적이 사라집니다. 없어진 줄도
 *     모르고 며칠 지나면 어느 쪽이 맞는지도 알 수 없습니다.
 *  ② **번호로 견주다 엉뚱한 것을 같다고 봅니다.** 두 자료함은 한
 *     뿌리에서 갈라졌지만 그 뒤로 각자 번호를 이어 매깁니다 —
 *     집에서 넣은 김씨와 사무실에서 넣은 박씨가 같은 번호를 받습니다.
 *     번호로 세면 「사라질 것 0건」이라고 거짓말을 합니다.
 *  ③ **되돌릴 자리 없이 덮습니다.** 잘못 눌렀는데 돌아갈 데가 없으면
 *     그건 백업이 있는 프로그램이 아닙니다.
 *  ④ **더 새 버전의 자료함을 가져옵니다.** 집 컴퓨터가 새 버전이면 이 PC 가
 *     모르는 칸이 들어 있고, 가져오는 순간 그 칸이 조용히 사라집니다.
 *
 * ── 그래서 이 시험이 보는 것 ────────────────────────────────
 *
 *   ①  꽂힌 USB 에서 가져올 만한 것을 찾는가
 *   ②  ★ **사무실에만 있는 것**을 제대로 세는가 (번호 말고 사람이 아는 이름으로)
 *   ③  ★ 양쪽에서 따로 적은 「갈라짐」을 알아보는가
 *   ④  가져올 것이 없을 때 조르지 않는가
 *   ⑤  ★ 더 새 버전 · 빈 파일 · 이 PC 가 최신 — 세 가지를 막는가
 *   ⑥  ★ 가져오기 전에 **지금 것을 한 부 떠 두는가**
 *   ⑦  ★ 바로 안 바뀌고 **다음에 켤 때** 바뀌는가
 *   ⑧  홈 화면에 띠가 뜨는가 (설정 깊은 데 있으면 아무도 안 봅니다)
 *   ⑨  ★ 서버가 「본 것과 다른 것」을 막는가
 *   ⑩  관리자만 할 수 있는가
 */
import { randomUUID } from "node:crypto";
import { mkdtempSync, existsSync, readdirSync, rmSync, statSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "bun:sqlite";
import { db, initDb, DB_PATH, metaGet, metaSet } from "./server/db";
initDb();
import { 시험관리자 } from "./도구/시험관리자";
import { USB살펴보기, 견주기 } from "./server/USB동기화";
import { 기본자리 } from "./server/backup";
import { home } from "./server/home";

const 주소 = "http://127.0.0.1:5757";
let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: unknown, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}
const 터지나 = (f: () => unknown): string | null => {
  try { f(); return null; } catch (e: any) { return String(e?.message ?? e); }
};

const 오늘 = new Date().toISOString().slice(0, 10);
const 올해 = Number(오늘.slice(0, 4));

/** 시험이 쓸 가짜 USB 폴더. */
const USB = mkdtempSync(join(tmpdir(), "usb-"));
const 옛자리 = metaGet("backup_dir") ?? "";
const 옛예약 = { 어디: metaGet("restore_from") ?? "", 언제: metaGet("restore_at") ?? "" };
const 복원예정 = join(DB_PATH.replace(/[^/\\]+$/, ""), "_복원예정.db");

const 사람 = randomUUID();
let 서비스 = 0, 배정 = 0, 계정: number | null = null, 인력: number | null = null;
let 관: any = null;
const 지울파일: string[] = [];

/** 지금 자료함을 그 자리로 한 부 떠 둡니다 (백업과 같은 방식). */
function 떠두기(경로: string) {
  db.exec("VACUUM INTO ?", [경로] as any);
  지울파일.push(경로);
  return 경로;
}

/** 그 파일 안에서 한 줄 고칩니다 — 「집에서 한 일」을 흉내 냅니다. */
function 집에서적기(경로: string, 무엇: (손: Database) => void) {
  const 손 = new Database(경로);
  try { 무엇(손); } finally { 손.close(); }
  // 백업보다 새 파일로 보이게 시각을 밀어 둡니다.
  const t = Date.now() / 1000 + 60;
  utimesSync(경로, t, t);
}

try {
  관 = await 시험관리자("USB시험관리자");

  const 프로필: any = db.query(
    `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id
      WHERE o.id = 1`).get();
  if (!프로필) throw new Error("기관이 없습니다. 통돌 Note 를 한 번 켜 주세요.");

  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at)
          VALUES (?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: "USB시험" }), "해남읍", "이용", `${올해 - 1}-01-01`, "x"]);
  계정 = Number(db.run(
    `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload, created_at)
     VALUES ('USB인력', ?, 'x', 'worker', '["worker"]', 'active', '{}', 'x')`,
    [`usb-${randomUUID().slice(0, 8)}`]).lastInsertRowid);
  인력 = Number(db.run(
    `INSERT INTO worker (user_id, hired_on, status, created_at) VALUES (?,?, 'active','x')`,
    [계정, `${올해 - 1}-01-01`]).lastInsertRowid);
  서비스 = Number(db.run(
    `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                          holiday_price, record_type, lifetime_cap, outside_annual_cap,
                          monthly_cap_minutes, monthly_cap_count, noshow_billable,
                          sort_order, active, custom)
     VALUES (?,?,'일상생활돌봄','가사지원','청소','USB시험가사','hour',24000,NULL,'time',
             NULL,0,0,0,0,970,1,1)`,
    [프로필.id, `USB-${randomUUID().slice(0, 6)}`]).lastInsertRowid);
  배정 = Number(db.run(
    `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
     VALUES (?,?,?,'[]',?,'x')`,
    [사람, 서비스, 인력, `${올해 - 1}-01-01`]).lastInsertRowid);

  // ══════════════════════════════════════════════════════════
  //  ① 꽂힌 USB 에서 찾는가
  // ══════════════════════════════════════════════════════════
  console.log("\n── ① USB 에서 가져올 것 찾기 ★ ────────────────\n");
  {
    metaSet("backup_dir", "");
    본다("★ 백업 자리를 안 정했으면 조르지 않는다",
      USB살펴보기().볼것있나 === false,
      USB살펴보기().까닭);

    metaSet("backup_dir", 기본자리);
    본다("★ 자료함 옆(이 컴퓨터 안)은 후보가 아니다",
      USB살펴보기().볼것있나 === false,
      "거기 있는 것은 이 PC 가 스스로 뜬 백업입니다 — 켤 때마다 자기 백업을 가져오라고 조르면 안 됩니다");

    metaSet("backup_dir", USB);
    본다("빈 USB 면 가져올 것이 없다", USB살펴보기().볼것있나 === false);

    떠두기(join(USB, "tongdol-2026-09-06-0900.db"));
    const 찾음 = USB살펴보기();
    본다("★ USB 의 백업 파일을 찾는다", 찾음.볼것있나 === true, `${찾음.후보.length}개`);
    본다("★ 「되돌리기전-」 파일은 후보가 아니다",
      (() => {
        떠두기(join(USB, "tongdol-되돌리기전-2026-09-06-0800.db"));
        return !USB살펴보기().후보.some((f) => f.이름.includes("되돌리기전"));
      })(),
      "그건 가져올 것이 아니라 **돌아갈 자리**입니다");
    본다("★ 통돌 Note 백업이 아닌 파일은 안 본다",
      (() => {
        Bun.write(join(USB, "남의파일.db"), "x");
        지울파일.push(join(USB, "남의파일.db"));
        return !USB살펴보기().후보.some((f) => f.이름 === "남의파일.db");
      })());
  }

  // ══════════════════════════════════════════════════════════
  //  ② 같은 파일이면 「같음」
  // ══════════════════════════════════════════════════════════
  console.log("\n── ② 그대로 떠 온 것은 「같음」 ────────────────\n");
  const 처음뜬것 = join(USB, "tongdol-2026-09-06-0900.db");
  {
    const 견 = 견주기(처음뜬것);
    본다("★ 방금 뜬 것과는 다를 것이 없다", 견.판단 === "같음",
      `${견.판단} · 저쪽에만 ${견.저쪽에만} · 이쪽에만 ${견.이쪽에만}`);
    본다("★ 가져오라고 하지 않는다", 견.가져올수있나 === false, 견.못하는까닭);
  }

  // ══════════════════════════════════════════════════════════
  //  ③ ★★ 집에서만 적었으면 — 안심하고 가져와도 됩니다
  // ══════════════════════════════════════════════════════════
  console.log("\n── ③ **집에서만 적었을 때** ★★ ────────────────\n");
  const 집것 = 떠두기(join(USB, "tongdol-2026-09-07-2200.db"));
  {
    집에서적기(집것, (손) => {
      손.run(
        `INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                               is_holiday,planned,minutes,created_at)
         VALUES (?,?,?,?,'제공',0,1,120,'x')`,
        [배정, 사람, 서비스, `${오늘.slice(0, 7)}-21`]);
      손.run(
        `INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                               is_holiday,planned,minutes,created_at)
         VALUES (?,?,?,?,'제공',0,1,90,'x')`,
        [배정, 사람, 서비스, `${오늘.slice(0, 7)}-22`]);
    });
    const 견 = 견주기(집것);
    본다("★★ 집에서 한 2건을 알아본다", 견.저쪽에만 === 2,
      `${견.저쪽에만}건 — 이것이 「집에서 하신 일」입니다`);
    본다("★★ 이 컴퓨터에서 사라질 것은 없다", 견.이쪽에만 === 0,
      "안심하고 덮어도 되는 경우입니다");
    본다("★ 「저쪽이 새것」으로 본다", 견.판단 === "저쪽이새것", 견.판단);
    본다("★ 가져올 수 있다", 견.가져올수있나 === true);
    본다("실적 줄에서 2건으로 세어진다",
      견.줄들.find((r) => r.이름 === "실적")?.저쪽에만 === 2);
    본다("사람이 읽는 말이 붙는다", /2건/.test(견.말), 견.말);
  }

  // ══════════════════════════════════════════════════════════
  //  ④ ★★ 양쪽에서 따로 적었으면 — 사라지는 것이 있습니다
  // ══════════════════════════════════════════════════════════
  console.log("\n── ④ **양쪽에서 따로 적었을 때** ★★★ ──────────\n");
  {
    /*
     * ★ 여기가 이 시험의 핵심입니다.
     *   사무실에서 **번호가 겹치도록** 한 줄 넣습니다 — 집에서 넣은 줄과
     *   자동 번호가 이어서 매겨지는 자리입니다. 번호로 견주면
     *   「사라질 것 0건」이라고 거짓말을 합니다.
     */
    db.run(
      `INSERT INTO delivery (assignment_id,recipient_id,service_id,served_on,outcome,
                             is_holiday,planned,minutes,created_at)
       VALUES (?,?,?,?,'제공',0,1,60,'x')`,
      [배정, 사람, 서비스, `${오늘.slice(0, 7)}-23`]);
    db.run(
      `INSERT INTO sticky (recipient_id, text, created_at, updated_at, author)
       VALUES (?,?,?,?,'시험')`,
      [사람, "사무실에서 적은 메모", new Date().toISOString(), new Date().toISOString()]);

    const 견 = 견주기(집것);
    본다("★★★ 이 컴퓨터에만 있는 것을 **놓치지 않는다**", 견.이쪽에만 === 2,
      `${견.이쪽에만}건 (실적 1 · 메모 1) — 번호로 견주면 0건이라고 거짓말합니다`);
    본다("★★ 집에서 한 것도 그대로 센다", 견.저쪽에만 === 2, `${견.저쪽에만}건`);
    본다("★★ 「갈라짐」으로 본다", 견.판단 === "갈라짐", 견.판단);
    본다("★★ 무엇이 사라지는지 갈라 보여 준다",
      견.줄들.find((r) => r.이름 === "실적")?.이쪽에만 === 1 &&
      견.줄들.find((r) => r.이름 === "메모")?.이쪽에만 === 1,
      "「2건」만으로는 청구서 2장인지 메모 2개인지 모릅니다");
    본다("★★ 말에 사라질 건수가 들어간다",
      견.말.includes("사라집니다") && 견.말.includes("2건"), 견.말);
    /*
     * ★ 이 글은 화면에 **그대로** 찍힙니다. 굵게 만들어 주는 것이 없어서
     *   별표를 넣으면 「**2건이 사라집니다**」처럼 별표가 그냥 보입니다
     *   (2026-09-07 화면에서 확인했습니다).
     */
    본다("★ 화면에 그대로 찍히는 글이라 별표를 안 쓴다",
      !견.말.includes("**") && !견.못하는까닭.includes("**"),
      견.말);
    본다("갈라져도 가져올 수는 있다 (사람이 정할 일)", 견.가져올수있나 === true,
      "막으면 집에서 한 일을 영영 못 가져옵니다 — 알려 주고 사람이 고르게 합니다");
  }

  // ══════════════════════════════════════════════════════════
  //  ⑤ 막아야 할 것들
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑤ 막아야 하는 것 ★ ────────────────────────\n");
  {
    // 이 PC 가 더 최신
    const 옛것 = 떠두기(join(USB, "tongdol-2026-09-01-0800.db"));
    집에서적기(옛것, (손) => {
      손.run("DELETE FROM delivery WHERE served_on = ?", [`${오늘.slice(0, 7)}-23`]);
      손.run("DELETE FROM sticky WHERE text = '사무실에서 적은 메모'");
    });
    const a = 견주기(옛것);
    본다("★ 이 PC 가 최신이면 가져오지 못하게 한다",
      a.판단 === "이쪽이새것" && a.가져올수있나 === false, a.못하는까닭);

    // 더 새 버전
    const 새버전 = 떠두기(join(USB, "tongdol-2026-09-08-0800.db"));
    집에서적기(새버전, (손) => {
      손.run("UPDATE meta SET value = ? WHERE key = 'schema_version'", ["999"]);
    });
    const c = 견주기(새버전);
    본다("★★ 더 새 버전의 자료함은 막는다", c.가져올수있나 === false, c.못하는까닭);
    본다("★ 왜 안 되는지 말해 준다",
      c.못하는까닭.includes("새 버전") && c.못하는까닭.includes("올려"),
      "그냥 「안 됩니다」로 끝나면 기관은 무엇을 해야 할지 모릅니다");

    // 빈 자료함
    const 빈것 = 떠두기(join(USB, "tongdol-2026-09-02-0800.db"));
    집에서적기(빈것, (손) => {
      손.run("DELETE FROM delivery");
      손.run("DELETE FROM recipient");
    });
    const e = 견주기(빈것);
    본다("★ 빈 자료함은 막는다", e.가져올수있나 === false, e.못하는까닭);

    // 없는 파일 · 자료함이 아닌 파일
    본다("★ 없는 파일은 까닭을 말한다",
      (터지나(() => 견주기(join(USB, "없는것.db"))) ?? "").includes("USB"),
      터지나(() => 견주기(join(USB, "없는것.db"))) ?? "");
  }

  // ══════════════════════════════════════════════════════════
  //  ⑥ 홈 화면에 뜨는가
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑥ **홈에 뜨는가** ★★ ──────────────────────\n");
  {
    /* 으뜸이 「갈라짐」인 집것이 되도록 시각을 가장 새로 밀어 둡니다. */
    const t = Date.now() / 1000 + 600;
    utimesSync(집것, t, t);
    const h: any = home();
    본다("★★ 홈이 USB 를 알려 준다", !!h.USB?.띄울까,
      h.USB?.말 ?? "(안 뜸)");
    본다("★ 사라질 건수도 같이 준다", h.USB?.이쪽에만 === 2, `${h.USB?.이쪽에만}건`);
    본다("★ 갈라짐이라고 알려 준다", h.USB?.판단 === "갈라짐");

    // 볼 것이 없으면 안 떠야 합니다
    metaSet("backup_dir", "");
    본다("★★ 가져올 것이 없으면 안 뜬다", home().USB == null,
      "매일 아침 뜨는 띠가 되면 아무도 안 읽습니다");
    metaSet("backup_dir", USB);

    /*
     * ★ **USB 는 꽂혀 있는데 가져올 것만 없는 경우**도 봐야 합니다.
     *   위의 것은 백업 자리를 아예 안 정한 경우라, 「같음이면 안 띄운다」를
     *   지나가 버립니다 (2026-09-07 에 실제로 그 손질이 안 걸렸습니다).
     *   USB 를 꽂아 두고 다니는 기관은 **매일 아침** 이 띠를 봅니다 —
     *   할 일이 없는 날에도 뜨면 있는 날에도 안 읽습니다.
     */
    {
      const 같은것 = 떠두기(join(USB, "tongdol-2026-09-09-0900.db"));
      const t2 = Date.now() / 1000 + 3000;
      utimesSync(같은것, t2, t2);
      본다("★★ USB 는 꽂혀 있어도 **같으면 안 뜬다**", home().USB == null,
        `${USB살펴보기().으뜸.split("/").pop()} 이 으뜸인데 견주면 「${견주기(같은것).판단}」`);

      // 이 PC 가 최신일 때도 뜨면 안 됩니다
      const 옛것2 = 떠두기(join(USB, "tongdol-2026-09-10-0900.db"));
      집에서적기(옛것2, (손) => {
        손.run("DELETE FROM sticky WHERE text = '사무실에서 적은 메모'");
      });
      const t3 = Date.now() / 1000 + 4000;
      utimesSync(옛것2, t3, t3);
      본다("★★ 이 PC 가 최신일 때도 안 뜬다", home().USB == null,
        `견주면 「${견주기(옛것2).판단}」 — 가져올 것이 없는데 조르면 안 됩니다`);

      // 다시 갈라진 것을 으뜸으로 돌려 놓습니다
      const t4 = Date.now() / 1000 + 6000;
      utimesSync(집것, t4, t4);
      본다("갈라진 것이 다시 으뜸이 됐다", USB살펴보기().으뜸 === 집것);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  ⑦ 돌고 있는 서버로 진짜 가져오기 ★★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑦ **진짜로 가져와 본다** ★★★ ──────────────\n");
  {
    const 쿠키 = await 관.쿠키받기(주소);
    const 두드리기 = async (길: string, 옵션: RequestInit = {}) => {
      const r = await fetch(주소 + 길, {
        ...옵션,
        headers: { cookie: 쿠키, "content-type": "application/json", ...(옵션.headers ?? {}) },
      });
      let 몸: any = null; try { 몸 = await r.json(); } catch { }
      return { 상태: r.status, 몸 };
    };

    const 봄 = await 두드리기("/api/settings/backup/usb");
    본다("★ 서버가 후보와 견줌을 같이 준다",
      봄.상태 === 200 && 봄.몸?.찾음?.볼것있나 === true && !!봄.몸?.견,
      `${봄.몸?.찾음?.후보?.length ?? 0}개 · ${봄.몸?.견?.판단 ?? "-"}`);

    /*
     * ★ **본 것과 다른 숫자를 보내면 막습니다.**
     *   화면이 본 뒤 USB 를 다시 꽂았거나 백업이 새로 떴으면 숫자가
     *   달라집니다. 자료함을 통째로 바꾸는 일이라 「본 것과 다른 것을
     *   덮는」 일이 있으면 안 됩니다.
     */
    const 엉뚱 = await 두드리기("/api/settings/backup/usb/import", {
      method: "POST", body: JSON.stringify({ path: 집것, 사라질건수: 0 }),
    });
    본다("★★ 본 것과 다른 건수를 보내면 막는다", 엉뚱.상태 >= 400,
      String(엉뚱.몸?.error ?? 엉뚱.상태));
    본다("★ 아직 예약이 안 걸렸다", !existsSync(복원예정),
      "막았다면서 예약이 걸려 있으면 막은 것이 아닙니다");

    /*
     * ★ **서버가 스스로도 막아야 합니다.**
     *   화면이 이미 「가져오기」 단추를 안 보여 주지만, 화면이 본 것과
     *   지금 파일이 다를 수 있습니다 — 그 사이에 USB 를 뽑았다 꽂았거나
     *   다른 사람이 백업을 새로 떴을 수 있습니다. 자료함을 통째로 바꾸는
     *   일이라 막는 자리는 **서버**여야 합니다.
     */
    {
      const 새버전막힘 = await 두드리기("/api/settings/backup/usb/import", {
        method: "POST",
        body: JSON.stringify({ path: join(USB, "tongdol-2026-09-08-0800.db"), 사라질건수: 0 }),
      });
      본다("★★ 서버가 **더 새 버전**을 막는다", 새버전막힘.상태 >= 400,
        String(새버전막힘.몸?.error ?? 새버전막힘.상태));
      본다("★ 그때도 예약이 안 걸린다", !existsSync(복원예정));

      const 빈것막힘 = await 두드리기("/api/settings/backup/usb/import", {
        method: "POST",
        body: JSON.stringify({ path: join(USB, "tongdol-2026-09-02-0800.db"), 사라질건수: 0 }),
      });
      본다("★★ 서버가 **빈 자료함**을 막는다", 빈것막힘.상태 >= 400,
        String(빈것막힘.몸?.error ?? 빈것막힘.상태));

      const 최신막힘 = await 두드리기("/api/settings/backup/usb/import", {
        method: "POST",
        body: JSON.stringify({ path: join(USB, "tongdol-2026-09-01-0800.db"), 사라질건수: 0 }),
      });
      본다("★★ 서버가 **이 PC 가 최신인 것**을 막는다", 최신막힘.상태 >= 400,
        String(최신막힘.몸?.error ?? 최신막힘.상태));
      본다("★ 세 번 막은 뒤에도 예약이 없다", !existsSync(복원예정),
        "막았다면서 예약이 걸려 있으면 막은 것이 아닙니다");
    }

    const 백업전 = readdirSync(기본자리).length;
    const 냄 = await 두드리기("/api/settings/backup/usb/import", {
      method: "POST", body: JSON.stringify({ path: 집것, 사라질건수: 2 }),
    });
    본다("★★★ 가져오기가 된다", 냄.상태 === 200, JSON.stringify(냄.몸?.지금것을떠둠 ?? 냄.몸));

    본다("★★★ 가져오기 전에 지금 것을 한 부 떠 뒀다",
      !!냄.몸?.지금것을떠둠 && existsSync(String(냄.몸.지금것을떠둠)),
      `${냄.몸?.지금것을떠둠} — 잘못 눌러도 돌아올 자리가 있어야 합니다`);
    본다("보관 폴더에 파일이 하나 늘었다",
      readdirSync(기본자리).length > 백업전);
    본다("★ 떠 둔 것에 **지금 자료가 들어 있다**",
      (() => {
        const 손 = new Database(String(냄.몸.지금것을떠둠), { readonly: true });
        try {
          const n = Number((손.query<any, []>(
            "SELECT COUNT(*) AS n FROM sticky WHERE text = '사무실에서 적은 메모'"
          ).get() as any)?.n ?? 0);
          return n === 1;
        } finally { 손.close(); }
      })(),
      "사무실에서 적은 것이 그 안에 있어야 되돌릴 수 있습니다");

    본다("★★★ **지금 자료함은 아직 안 바뀌었다**",
      Number((db.query<any, []>(
        "SELECT COUNT(*) AS n FROM sticky WHERE text = '사무실에서 적은 메모'"
      ).get() as any)?.n ?? 0) === 1,
      "쓰는 중에 자료함이 통째로 갈리면 열어 둔 화면이 거짓말을 합니다");
    본다("★★ 다음에 켤 때 바뀌도록 예약됐다", existsSync(복원예정));
    본다("★ 어느 파일로 바꿀지 적혀 있다", metaGet("restore_from") === 집것,
      String(metaGet("restore_from")));

    본다("★ 바꿔 넣을 파일에 **집에서 한 것**이 들어 있다",
      (() => {
        const 손 = new Database(복원예정, { readonly: true });
        try {
          const n = Number((손.query<any, [string]>(
            "SELECT COUNT(*) AS n FROM delivery WHERE served_on = ?"
          ).get(`${오늘.slice(0, 7)}-21`) as any)?.n ?? 0);
          return n === 1;
        } finally { 손.close(); }
      })());

    // 물러 둡니다 — 시험이 진짜로 자료함을 갈아 끼우면 안 됩니다.
    const 무름 = await 두드리기("/api/settings/backup/restore/cancel", { method: "POST" });
    본다("★★ 무를 수 있다", 무름.상태 === 200 && !existsSync(복원예정),
      "무를 수 없으면 잘못 누른 사람이 다음 아침까지 마음을 졸입니다");
  }

  // ══════════════════════════════════════════════════════════
  //  ⑧ 관리자만
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑧ 관리자만 한다 ★ ─────────────────────────\n");
  {
    const 사무 = await 시험관리자("USB시험사무", ["staff"]);
    const 인 = await 시험관리자("USB시험인력", ["worker"]);
    try {
      const 무 = await 사무.쿠키받기(주소);
      const 력 = await 인.쿠키받기(주소);
      const 두 = async (쿠: string, 길: string, 옵션: RequestInit = {}) => {
        const r = await fetch(주소 + 길, {
          ...옵션, headers: { cookie: 쿠, "content-type": "application/json", ...(옵션.headers ?? {}) },
        });
        return r.status;
      };
      본다("★★ 사무직원은 가져오지 못한다",
        await 두(무, "/api/settings/backup/usb/import", {
          method: "POST", body: JSON.stringify({ path: 집것, 사라질건수: 2 }),
        }) === 403);
      본다("★★ 제공인력은 보지도 못한다",
        await 두(력, "/api/settings/backup/usb") === 403);
      본다("★ 막힌 뒤에도 예약이 안 걸렸다", !existsSync(복원예정));
    } finally { 사무.치우기(); 인.치우기(); }
  }

} catch (e: any) {
  실패수++;
  console.log(`\n✗ 실패  시험 도중 터짐 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 5).join("\n"));
} finally {
  /*
   * ★ **예약을 반드시 지웁니다.** 남겨 두면 다음에 통돌 Note 를 켤 때
   *   시험이 만든 파일로 자료함이 통째로 갈립니다.
   */
  try { rmSync(복원예정, { force: true }); } catch { }
  metaSet("restore_from", 옛예약.어디);
  metaSet("restore_at", 옛예약.언제);
  metaSet("backup_dir", 옛자리);

  db.run("DELETE FROM sticky WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM delivery WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM assignment WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM recipient WHERE id = ?", [사람]);
  if (서비스) { try { db.run("DELETE FROM service WHERE id = ?", [서비스]); } catch { } }
  try {
    if (인력) db.run("DELETE FROM worker WHERE id = ?", [인력]);
    if (계정) db.run("DELETE FROM app_user WHERE id = ?", [계정]);
  } catch { }
  관?.치우기();

  // 시험이 만든 「되돌리기전-」 백업도 치웁니다.
  try {
    for (const f of readdirSync(기본자리))
      if (f.includes("되돌리기전") &&
          Date.now() - statSync(join(기본자리, f)).mtimeMs < 10 * 60 * 1000)
        rmSync(join(기본자리, f), { force: true });
  } catch { }
  try { rmSync(USB, { recursive: true, force: true }); } catch { }

  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
