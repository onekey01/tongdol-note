/**
 * 사무실 안에서 열기 시험 —  bun 사무실열기시험.ts
 *
 *   (통돌 Note 가 켜져 있어야 합니다)
 *
 * ═══════════════════════════════════════════════════════════
 *  왜 이 시험이 있나
 * ═══════════════════════════════════════════════════════════
 *
 * 이것은 **바깥으로 문을 하나 여는** 일입니다. 이 프로그램에서 여태
 * 한 번도 안 했던 일이고, 잘못 만들면 사무실 와이파이에 붙은 아무
 * 기기가 어르신 자료를 봅니다.
 *
 * 「막았다」고 적어 두는 것으로는 부족합니다. **진짜로 두 번째 귀를
 * 열고, 밖에서 두드려 봅니다.**
 *
 * ── 여기서 보는 것 ─────────────────────────────────────────
 *
 *   1. ★ **안 열면 그 포트가 아예 없는가** (평소에는 문이 없어야 합니다)
 *   2. ★ 열어도 **번호 없이는 아무것도 안 보이는가** — 화면도 API 도
 *   3. ★ 틀린 번호는 막히는가
 *   4. 맞는 번호를 넣으면 **그다음 로그인**을 묻는가
 *   5. ★ 번호를 넣어도 **로그인 없이는 자료가 안 나오는가** (두 겹입니다)
 *   6. ★ **닫으면 그 자리에서 끊기는가**
 *   7. 껐다 켜면 닫힌 채로 시작하는가 (여기서는 「상태」로 갈음합니다)
 */
import { randomUUID } from "node:crypto";
import { db, initDb } from "./server/db";
import { hashPassword } from "./server/auth";
initDb();

const 로컬 = "http://127.0.0.1:5757";
let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: unknown, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}

const 지울사람: number[] = [];

async function 계정(이름: string, 역할: string[]) {
  const login = `lan-${randomUUID().slice(0, 8)}`;
  const r = db.run(
    `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload, created_at)
     VALUES (?,?,?,?,?,'active','{}',?)`,
    [이름, login, await hashPassword("시험1234"), 역할[0], JSON.stringify(역할),
     new Date().toISOString()]);
  const id = Number(r.lastInsertRowid); 지울사람.push(id);
  return { id, login, 비번: "시험1234" };
}

async function 들어가기(밑: string, login: string, 비번: string, 쿠키 = "") {
  const r = await fetch(`${밑}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(쿠키 ? { cookie: 쿠키 } : {}) },
    body: JSON.stringify({ loginId: login, password: 비번 }),
  });
  if (!r.ok) return null;
  return r.headers.get("set-cookie")?.split(";")[0] ?? null;
}

let 닫아야하나 = false;

try {
  const 관리자 = await 계정("사무실시험관리자", ["admin"]);
  const 보조 = await 계정("사무실시험보조", ["staff"]);
  const 관쿠 = await 들어가기(로컬, 관리자.login, 관리자.비번);
  if (!관쿠) throw new Error("관리자로 못 들어갔습니다.");

  const 관리자로 = (길: string, 옵션: RequestInit = {}) =>
    fetch(로컬 + 길, {
      ...옵션,
      headers: { cookie: 관쿠, "content-type": "application/json", ...(옵션.headers ?? {}) },
    });

  // ══ 1. 안 열었을 때 ══════════════════════════════════════
  console.log("\n── 1. 평소에는 문이 없다 ★ ─────────────────────────\n");
  {
    const s = await (await 관리자로("/api/settings/lan")).json();
    본다("처음에는 닫혀 있다", s.열림 === false, JSON.stringify(s.열림));
    본다("고를 수 있는 시간이 온다", (s.시간들 ?? []).length >= 3,
      (s.시간들 ?? []).map((x: any) => x.이름).join(" · "));

    /*
     * ★ 안 열었으면 그 포트에 **아무것도 없어야** 합니다.
     *   「열려는 있는데 막는다」가 아니라 「문 자체가 없다」입니다.
     */
    let 붙었나 = false;
    try {
      await fetch("http://127.0.0.1:5858/", { signal: AbortSignal.timeout(1500) });
      붙었나 = true;
    } catch { }
    본다("★ 안 열면 그 포트가 아예 없다", !붙었나,
      "「막는다」가 아니라 「문이 없다」입니다");
  }

  // ══ 2. 열기 ══════════════════════════════════════════════
  console.log("\n── 2. 열어 봅니다 ──────────────────────────────────\n");
  let 밖: string, 번호: string;
  {
    const r = await 관리자로("/api/settings/lan",
      { method: "POST", body: JSON.stringify({ hours: 2 }) });
    const s = await r.json();
    if (!r.ok) throw new Error(`못 열었습니다: ${s.error ?? r.status}`);
    닫아야하나 = true;

    본다("★ 열린다", s.열림 === true);
    본다("주소가 나온다", /^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/.test(s.주소 ?? ""), s.주소);
    본다("★ 여섯 자리 번호가 나온다", /^\d{6}$/.test(s.번호 ?? ""), s.번호);
    본다("닫힐 때가 정해진다", !!s.닫힐때,
      s.닫힐때 ? new Date(s.닫힐때).toLocaleTimeString("ko-KR") : "");

    번호 = s.번호;
    /*
     * 시험은 같은 컴퓨터에서 도니 127.0.0.1 로 두드립니다.
     * **두 번째 귀는 0.0.0.0 에 열려 있어** 로컬로도 들어갑니다 —
     * 중요한 것은 「그 포트」이지 어느 주소로 가느냐가 아닙니다.
     */
    밖 = `http://127.0.0.1:${new URL(s.주소).port}`;
  }

  // ══ 3. 번호 없이 ═════════════════════════════════════════
  console.log("\n── 3. 번호 없이는 ★★ ──────────────────────────────\n");
  {
    const 화면 = await fetch(밖 + "/");
    const 글 = await 화면.text();
    본다("★ 화면 대신 번호를 묻는다", 글.includes("사무실 번호를"),
      글.slice(0, 60).replace(/\s+/g, " "));
    본다("★ 로그인 화면이 안 보인다", !글.includes("비밀번호") || 글.includes("번호를 넣어"),
      "로그인 화면이 보이면 비밀번호를 맞혀 볼 수 있습니다");

    const api = await fetch(밖 + "/api/recipients");
    본다("★★ 대상자 API 가 막힌다", api.status === 401, `${api.status}`);

    /*
     * ★ 로그인 자체도 막아야 합니다. 여기가 뚫리면 번호가 있으나 마나입니다.
     */
    const 로긴 = await fetch(밖 + "/api/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ loginId: 보조.login, password: 보조.비번 }),
    });
    본다("★★ 번호 없이는 로그인도 못 한다", 로긴.status === 401, `${로긴.status}`);
  }

  console.log("\n── 4. 틀린 번호 ────────────────────────────────────\n");
  {
    const r = await fetch(밖 + "/lan-number", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "n=000000",
    });
    const 글 = await r.text();
    본다("★ 틀린 번호는 막힌다", r.status === 401 && 글.includes("맞지 않습니다"),
      `${r.status}`);
    본다("쿠키를 안 준다", !(r.headers.get("set-cookie") ?? "").includes("ck_lan"));
  }

  // ══ 5. 맞는 번호 ═════════════════════════════════════════
  console.log("\n── 5. 맞는 번호를 넣으면 ★ ────────────────────────\n");
  let 번호쿠키 = "";
  {
    const r = await fetch(밖 + "/lan-number", {
      method: "POST", redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `n=${번호}`,
    });
    본다("★ 번호가 맞으면 들여보낸다", r.status === 302, `${r.status}`);
    번호쿠키 = (r.headers.get("set-cookie") ?? "").split(";")[0];
    본다("번호 쿠키를 준다", 번호쿠키.startsWith("ck_lan="), 번호쿠키);
    본다("★ 창을 닫으면 사라지는 쿠키다",
      !(r.headers.get("set-cookie") ?? "").toLowerCase().includes("max-age") &&
      !(r.headers.get("set-cookie") ?? "").toLowerCase().includes("expires"),
      "옆자리 컴퓨터에 오래 남길 까닭이 없습니다");

    /*
     * ★★ 번호를 넣어도 **로그인 없이는 자료가 안 나옵니다.** 두 겹입니다.
     */
    const api = await fetch(밖 + "/api/recipients", { headers: { cookie: 번호쿠키 } });
    본다("★★ 번호만으로는 자료가 안 나온다", api.status === 401, `${api.status}`);
  }

  console.log("\n── 6. 번호 + 로그인 ────────────────────────────────\n");
  {
    const 보조쿠 = await 들어가기(밖, 보조.login, 보조.비번, 번호쿠키);
    본다("★ 번호를 넣은 뒤에는 로그인이 된다", !!보조쿠);

    const 둘 = `${번호쿠키}; ${보조쿠}`;
    const 목록 = await fetch(밖 + "/api/recipients", { headers: { cookie: 둘 } });
    본다("★ 그제야 대상자가 보인다", 목록.status === 200, `${목록.status}`);

    /*
     * 권한은 그대로입니다 — 사무직원은 설정을 못 고칩니다.
     * 밖에서 들어왔다고 더 열리거나 더 닫히면 안 됩니다.
     */
    const 설정 = await fetch(밖 + "/api/settings/hours", {
      method: "PATCH", headers: { cookie: 둘, "content-type": "application/json" },
      body: JSON.stringify({ autoStart: true }),
    });
    본다("★ 밖에서 들어와도 권한은 그대로다 (사무직원은 설정 못 고침)",
      설정.status === 403, `${설정.status}`);
  }

  // ══ 7. 닫기 ══════════════════════════════════════════════
  console.log("\n── 7. 닫으면 ★★ ───────────────────────────────────\n");
  {
    const r = await 관리자로("/api/settings/lan", { method: "DELETE" });
    const s = await r.json();
    닫아야하나 = false;
    본다("닫힌다고 답한다", s.열림 === false);

    let 붙었나 = false;
    try {
      await fetch(밖 + "/", { signal: AbortSignal.timeout(1500) });
      붙었나 = true;
    } catch { }
    본다("★★ 닫으면 그 자리에서 끊긴다", !붙었나,
      "번호를 아는 사람도 더는 못 들어옵니다");

    const s2 = await (await 관리자로("/api/settings/lan")).json();
    본다("상태도 닫힘으로 바뀐다", s2.열림 === false);
  }

  console.log("\n── 8. 여는 것은 관리자만 ───────────────────────────\n");
  {
    const 보조쿠 = await 들어가기(로컬, 보조.login, 보조.비번);
    const r = await fetch(로컬 + "/api/settings/lan", {
      method: "POST",
      headers: { cookie: 보조쿠!, "content-type": "application/json" },
      body: JSON.stringify({ hours: 2 }),
    });
    본다("★ 사무직원은 못 연다", r.status === 403, `${r.status}`);
  }

} catch (e: any) {
  실패수++;
  console.log(`\n✗ 실패  시험 도중 터짐 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 4).join("\n"));
} finally {
  if (닫아야하나) {
    /* 시험이 중간에 터져도 **문은 반드시 닫습니다.** */
    try {
      const { 닫기 } = await import("./server/사무실열기");
      닫기();
    } catch { }
  }
  for (const id of 지울사람) {
    db.run("DELETE FROM session WHERE user_id = ?", [id]);
    db.run("DELETE FROM app_user WHERE id = ?", [id]);
  }
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
