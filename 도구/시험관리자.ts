/**
 * 시험이 쓸 **자기 관리자 계정**을 만들어 줍니다.
 *
 * ═══════════════════════════════════════════════════════════
 *  왜 있나 — 2026-09-07 에 일곱 개가 한꺼번에 드러났습니다
 * ═══════════════════════════════════════════════════════════
 *
 * 화면 시험 일곱 개가 `admin` / `admin1234` 를 **파일 안에 적어** 두고
 * 있었습니다. 그런 계정은 **어느 컴퓨터에도 없습니다** — 기관마다
 * 관리자 아이디가 다르고, 여기 자료함의 관리자는 `onekey01` 입니다.
 *
 * 그래서 로그인이 **조용히** 실패하고, 시험은 로그인 화면 앞에서
 * 「30초 기다렸는데 화면이 안 뜬다」로만 죽었습니다. 진짜 까닭이
 * 로그인이라는 것이 어디에도 안 보였고, 그 상태로 몇 주가 지났습니다.
 * 그동안 그 시험들은 **아무것도 지키지 않고 있었습니다.**
 *
 * ── 그래서 규칙 하나 ────────────────────────────────────────
 *
 *   **시험은 자기 계정을 만들어 쓰고, 끝나면 지웁니다.**
 *
 *   · 남의 계정 비밀번호를 시험 파일에 적어 두지 않습니다
 *   · 기관이 아이디를 바꿔도 시험이 안 깨집니다
 *   · 시험끼리 같은 계정을 물고 늘어지지 않습니다
 *
 * ── 쓰는 법 ─────────────────────────────────────────────────
 *
 *     import { 시험관리자 } from "./도구/시험관리자";
 *     const 관 = await 시험관리자();
 *     ...
 *     await 관.들어가기(page);        // 로그인 화면이면 들어갑니다
 *     ...
 *     관.치우기();                    // finally 에서
 */
import { db, initDb } from "../server/db";
import { 설정마쳤다고 } from "./설정마침";
import { hashPassword } from "../server/auth";
import { randomUUID } from "node:crypto";

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


export type 시험계정 = {
  id: number;
  아이디: string;
  비밀번호: string;
  /** 로그인 화면이면 들어갑니다. 이미 들어가 있으면 아무 일도 안 합니다. */
  들어가기: (page: any) => Promise<boolean>;
  /** 쿠키 한 줄 — 서버를 직접 두드리는 시험용. */
  쿠키받기: (주소?: string) => Promise<string>;
  치우기: () => void;
};

export async function 시험관리자(
  이름 = "시험관리자", 역할: string[] = ["admin"]
): Promise<시험계정> {
  /*
   * ★ 역할을 **글자 하나로 넘겨도** 버티게 합니다 (2026-09-08 에 찾음).
   *
   *   `시험관리자("이름", "admin")` 처럼 배열이 아니라 글자를 넘긴 곳이
   *   있었습니다. 그러면 `role` 칸에 `"a"`, `roles` 칸에 `'"admin"'` 이
   *   들어가 **어느 쪽으로도 제대로 안 읽히는 줄**이 자료함에 남습니다.
   *   그 줄 하나가 「관리자가 한 명은 있어야 합니다」를 뚫었습니다.
   */
  /*
   * ★ 최초 설정 마법사를 지나가게 해 둡니다 (v35 · 2026-09-08).
   *   안 그러면 이 계정으로 들어가도 **마법사 앞에서 막혀** 시험이
   *   보려던 화면을 못 봅니다. 마법사 자체는 `첫설정시험.ts` ·
   *   `첫설정화면시험.ts` 가 **빈 자료함에서 진짜로 걸어서** 지킵니다.
   */
  설정마쳤다고();

  const 역할들 = (Array.isArray(역할) ? 역할 : [역할]).filter(Boolean);
  if (역할들.length === 0) throw new Error("시험관리자: 역할이 비었습니다.");
  const 아이디 = `t-${randomUUID().slice(0, 8)}`;
  const 비밀번호 = "시험1234";
  const id = Number(db.run(
    `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload, created_at)
     VALUES (?,?,?,?,?,'active','{}',?)`,
    [이름, 아이디, await hashPassword(비밀번호), 역할들[0], JSON.stringify(역할들),
     new Date().toISOString()]).lastInsertRowid);

  return {
    id, 아이디, 비밀번호,

    async 들어가기(page: any): Promise<boolean> {
      if (!(await page.locator("input#id").count())) return false;   // 이미 들어가 있음
      await page.fill("input#id", 아이디);
      await page.fill('input[type="password"]', 비밀번호);
      await page.locator("button.primary").first().click();
      /*
       * ★ **들어갔는지 확인하고 넘어갑니다.** 그냥 기다리기만 하면
       *   못 들어간 채로 다음 줄이 돌고, 뒤에 오는 시험이 죄다
       *   「기다렸는데 안 뜬다」로 죽습니다 — 그게 이 파일이 생긴 까닭입니다.
       */
      try {
        await page.waitForSelector("input#id", { state: "detached", timeout: 8000 });
      } catch {
        throw new Error(
          `시험 계정(${아이디})으로 못 들어갔습니다. ` +
          `통돌 Note 가 http 로 떠 있는지 보아 주세요.`);
      }
      await page.waitForTimeout(600);
      return true;
    },

    async 쿠키받기(주소 = "http://127.0.0.1:5757"): Promise<string> {
      const r = await fetch(`${주소}/api/login`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ loginId: 아이디, password: 비밀번호 }),
      });
      if (!r.ok) throw new Error(`시험 계정으로 못 들어갔습니다 (${r.status}).`);
      return r.headers.get("set-cookie")?.split(";")[0] ?? "";
    },

    치우기() {
      try { db.run("DELETE FROM app_user WHERE id = ?", [id]); } catch { }
    },
  };
}

/**
 * 설정 화면의 **그 탭**을 열고 기다립니다.
 *
 * (2026-09-07) 설정이 「일반 / 기관 정보 / 계산 규칙」 세 탭으로 갈렸습니다.
 * 그래서 `/settings` 로 가기만 하면 **일반 탭만** 보이고, 단가·한도·공휴일을
 * 보던 시험들이 「칸이 없다」로 죽었습니다. 갈래를 나눈 대가입니다.
 *
 * 시험마다 탭 단추를 손으로 찾게 두면, 탭 이름을 한 번 바꿀 때 시험을
 * 여섯 군데 고쳐야 합니다. 그래서 **여는 자리를 한 곳**으로 둡니다.
 *
 *     await 설정탭열기(page, 주소, '계산 규칙')
 */
export async function 설정탭열기(
  page: any, 주소: string, 탭: '일반' | '기관 정보' | '계산 규칙' = '일반'
): Promise<void> {
  if (!/\/settings\b/.test(page.url()))
    await page.goto(주소.replace(/\/$/, "") + "/settings", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  const 띠 = page.locator(".설정탭띠");
  if (!(await 띠.count())) return;        // 탭이 없던 옛 버전이면 그냥 둡니다
  await 띠.locator("button", { hasText: 탭 }).first().click();
  await page.waitForTimeout(800);
}
