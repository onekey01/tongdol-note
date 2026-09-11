/*
 * ── 빈 자료함으로 프로그램 한 대 띄우기 ────────────────────
 *
 * 「아무것도 없는 상태에서 처음 켜는 길」은 **개발하면서 거의 안 지나갑니다.**
 * 그래서 거기가 제일 잘 깨지는데, 정작 시험하기가 제일 번거롭습니다 —
 * 개발용 자료함에는 이미 기관이 개설되어 있어 첫 화면이 안 뜹니다.
 *
 * 그 번거로움 때문에 실제로 **시험 하나가 조용히 죽어 있었습니다**
 * (`서비스손입력시험.ts` — 이미 개설된 자료함에서 「기관 개설 화면」을
 * 기다리다 30초 만에 터졌습니다. 2026-09-08 에 찾음).
 *
 * 그래서 한 줄로 되게 만들어 둡니다.
 *
 *     const 집 = await 빈자료함띄우기();
 *     ... 집.주소 로 브라우저를 붙입니다 ...
 *     await 집.끄기();
 *
 * ── 어떻게 도나 ────────────────────────────────────────────
 *
 * 자료함 자리는 `process.cwd()/data` 입니다(`server/db.ts`). 그래서
 * **빈 폴더를 하나 만들어 거기서 켜면** 자료함도 거기 새로 생깁니다.
 * 화면·서식·글꼴은 원래 폴더를 가리키게 이어 둡니다(symlink) — 복사하면
 * 100MB 가 넘고 느립니다.
 *
 * 포트는 5757 부터 차례로 잡습니다. 개발용이 이미 5757 을 쓰고 있으면
 * 저절로 5758 로 갑니다 — 자료함 자리가 달라 서로를 「이미 켜져 있는
 * 나」로 오해하지 않습니다(`server/index.ts` 의 `이미돌고있나`).
 */
import { mkdtempSync, rmSync, symlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

export type 빈집 = {
  /** 브라우저를 붙일 주소. 예: http://127.0.0.1:5758 */
  주소: string;
  /** 그 프로그램이 쓰는 폴더 (자료함은 그 안의 data/) */
  폴더: string;
  /** 검은 창에 찍힌 것 전부 */
  창글: () => string;
  끄기: () => Promise<void>;
};

/** 프로젝트 뿌리 — 이 파일이 `도구/` 안에 있다는 것에 기댑니다. */
const 뿌리 = join(import.meta.dir, "..");

export async function 빈자료함띄우기(옵션: { 기다림?: number } = {}): Promise<빈집> {
  const 폴더 = mkdtempSync(join(tmpdir(), "통돌-빈자료함-"));

  /*
   * 화면(dist-web)이 없으면 프로그램이 **개발 모드**로 켜져 화면을 안 냅니다.
   * 그러면 브라우저로 걸어 볼 수가 없으니 먼저 짚고 넘어갑니다.
   */
  if (!existsSync(join(뿌리, "dist-web", "index.html"))) {
    rmSync(폴더, { recursive: true, force: true });
    throw new Error(
      "dist-web 이 없어 빈 자료함을 띄울 수 없습니다.\n" +
      "  먼저 `bunx vite build` 로 화면을 한 번 지어 주세요."
    );
  }
  for (const 이름 of ["dist-web", "서식", "글꼴", "도구", "node_modules"]) {
    const 원래 = join(뿌리, 이름);
    if (existsSync(원래)) symlinkSync(원래, join(폴더, 이름));
  }

  let 창 = "";
  const 아이 = Bun.spawn({
    cmd: ["bun", "run", join(뿌리, "server", "index.ts")],
    cwd: 폴더,
    env: { ...process.env, TONGDOL_STAY: "1", TONGDOL_NO_OPEN: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  (async () => { for await (const 쪽 of 아이.stdout) 창 += new TextDecoder().decode(쪽); })();
  (async () => { for await (const 쪽 of 아이.stderr) 창 += new TextDecoder().decode(쪽); })();

  /*
   * 켜질 때까지 기다립니다. 검은 창에 찍힌 **주소를 읽어서** 씁니다 —
   * 포트를 여기서 짐작하면 개발용과 부딪칠 때 엉뚱한 프로그램을
   * 시험하게 됩니다. **그게 제일 나쁜 갈래입니다.**
   */
  const 끝날때 = Date.now() + (옵션.기다림 ?? 25_000);
  let 주소 = "";
  while (Date.now() < 끝날때) {
    const m = /주소\s+(http:\/\/127\.0\.0\.1:\d+)/.exec(창);
    if (m) {
      주소 = m[1];
      // 정말 그 자료함인지 확인합니다.
      try {
        const r = await fetch(주소 + "/api/health", { signal: AbortSignal.timeout(1500) });
        const 것 = (await r.json()) as any;
        /*
         * 자료함 **경로** 대신 **지문**으로 견줍니다 — 2026-09-08 보안
         * 점검에서 경로를 로그인 없이 내주지 않도록 바꿨습니다.
         */
        const 내지문 = createHash("sha256")
          .update(join(폴더, "data", "tongdol.db")).digest("hex").slice(0, 16);
        if (것?.dbKey === 내지문) break;
        주소 = "";
      } catch { 주소 = ""; }
    }
    await Bun.sleep(300);
  }
  if (!주소) {
    try { 아이.kill(); } catch { }
    rmSync(폴더, { recursive: true, force: true });
    throw new Error("빈 자료함 프로그램이 안 켜졌습니다.\n" + 창.slice(0, 800));
  }

  return {
    주소, 폴더,
    창글: () => 창,
    async 끄기() {
      try { 아이.kill(); } catch { }
      await Bun.sleep(300);
      rmSync(폴더, { recursive: true, force: true });
    },
  };
}
