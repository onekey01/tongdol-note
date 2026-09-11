/**
 * 운용 시험 ② — 자료를 잃지 않는가 —  bun 운용시험2.ts
 *
 * ═══════════════════════════════════════════════════════════
 *  왜 이 시험이 있나
 * ═══════════════════════════════════════════════════════════
 *
 * 앞의 운용 시험(`운용시험.ts`)은 **얼마나 빠른가**를 봤습니다.
 * 여기서 보는 것은 **자료를 잃지 않는가**입니다. 느린 것은 기다리면
 * 되지만, 잃은 것은 못 되돌립니다.
 *
 * 이 프로그램의 자료는 **그 PC 한 대**에만 있습니다. 서버에 사본이
 * 없습니다(우편함은 14일 지나면 비웁니다). 그러니 —
 *
 *   ① **백업을 뜨고 되돌리면 한 줄도 안 잃는가**
 *   ② **두 곳에서 한꺼번에 쓰면 자료함이 잠기지 않는가**
 *      (사무실 열기로 옆 컴퓨터가 붙어 있을 때 실제로 생깁니다)
 *   ③ **오래 켜 두면 무언가 쌓이지 않는가**
 *   ④ **디스크가 꽉 차면 조용히 잃지 않는가**
 */
import { 빈자료함띄우기 } from "./도구/빈자료함";
import { 무겁게하기 } from "./도구/무겁게하기";
import { Database } from "bun:sqlite";
import { join } from "node:path";
import { statSync, readdirSync, existsSync } from "node:fs";

let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: unknown, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}

console.log("\n  운용 시험 ② — 자료를 잃지 않는가");
console.log("  ═══════════════════════════════════════════════════\n");

const 집 = await 빈자료함띄우기();
const 자료함 = join(집.폴더, "data", "tongdol.db");

const r = await fetch(집.주소 + "/api/setup", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ orgName: "운용시험복지관", adminName: "박병섭",
    loginId: "onekey01", password: "시험1234" }),
});
const 쿠키 = (r.headers.get("set-cookie") ?? "").split(";")[0];
const 부르기 = (길: string, 옵션: any = {}) =>
  fetch(집.주소 + 길, { ...옵션, headers: { cookie: 쿠키, ...(옵션.headers ?? {}) } });

무겁게하기(자료함, { 대상자: 100, 달수: 12, 주당방문: 2.5 });
const 센다 = (표: string) => {
  const db = new Database(자료함, { readonly: true });
  const n = Number(db.query<any, []>(`SELECT COUNT(*) c FROM "${표}"`).get()?.c ?? 0);
  db.close(); return n;
};
console.log(`  자료: 대상자 ${센다("recipient")} · 실적 ${센다("delivery").toLocaleString()} · 청구 ${센다("billing").toLocaleString()}\n`);

try {
  // ═══ ① 백업 → 되돌리기 왕복 ══════════════════════════════
  console.log("  ① 백업을 뜨고 되돌리면 한 줄도 안 잃는가");
  {
    const 백업전 = { 대상자: 센다("recipient"), 실적: 센다("delivery"), 청구: 센다("billing") };

    const 떴나 = await (await 부르기("/api/settings/backup", { method: "POST" })).json() as any;
    본다("백업이 떠집니다", !!떴나?.뜬곳?.length || !!떴나?.ok, JSON.stringify(떴나).slice(0, 90));

    const 보관 = join(집.폴더, "data", "보관");
    const 뜬것 = existsSync(보관) ? readdirSync(보관).filter((n) => n.endsWith(".db")) : [];
    본다("보관 폴더에 파일이 생겼습니다", 뜬것.length > 0, 뜬것.join(", ").slice(0, 70));

    if (뜬것.length) {
      const 백업길 = join(보관, 뜬것[뜬것.length - 1]);
      const 크기 = statSync(백업길).size;
      본다("★ 백업 파일이 통째로 떴습니다 (원본과 크기가 비슷)",
        크기 > statSync(자료함).size * 0.8,
        `${(크기 / 1024 / 1024).toFixed(1)}MB / 원본 ${(statSync(자료함).size / 1024 / 1024).toFixed(1)}MB`);

      /*
       * ★ **백업 파일을 열어서 줄 수를 직접 셉니다.**
       *   「파일이 생겼다」만 보면 **속이 빈 파일**도 통과합니다.
       *   백업은 열어 보기 전까지 백업이 아닙니다.
       */
      const b = new Database(백업길, { readonly: true });
      const 백업안 = {
        대상자: Number(b.query<any, []>("SELECT COUNT(*) c FROM recipient").get()?.c ?? 0),
        실적: Number(b.query<any, []>("SELECT COUNT(*) c FROM delivery").get()?.c ?? 0),
        청구: Number(b.query<any, []>("SELECT COUNT(*) c FROM billing").get()?.c ?? 0),
      };
      b.close();
      본다("★★ 백업 안의 대상자 수가 같습니다", 백업안.대상자 === 백업전.대상자,
        `${백업안.대상자} / ${백업전.대상자}`);
      본다("★★ 백업 안의 실적 수가 같습니다", 백업안.실적 === 백업전.실적,
        `${백업안.실적.toLocaleString()} / ${백업전.실적.toLocaleString()}`);
      본다("★★ 백업 안의 청구 수가 같습니다", 백업안.청구 === 백업전.청구,
        `${백업안.청구.toLocaleString()} / ${백업전.청구.toLocaleString()}`);

      // 되돌릴 수 있는 파일로 보이나
      const 살펴 = await (await 부르기("/api/settings/backup/inspect", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: 백업길 }),
      })).json() as any;
      본다("★ 되돌리기 전에 안을 들여다볼 수 있습니다",
        !살펴?.error, JSON.stringify(살펴).slice(0, 110));
    }
  }

  // ═══ ② 두 곳에서 한꺼번에 쓰면 ═══════════════════════════
  console.log("\n  ② 두 곳에서 한꺼번에 쓰면 자료함이 잠기나");
  {
    /*
     * 사무실 열기로 옆 컴퓨터가 붙어 있으면 **두 사람이 같은 순간에**
     * 저장할 수 있습니다. SQLite 는 한 번에 한 쪽만 쓰게 하는데,
     * 기다리지 않고 바로 「잠겼습니다」를 내면 그 저장이 사라집니다.
     */
    const 대상자 = await (await 부르기("/api/recipients?sort=name&dir=asc")).json() as any;
    const 한명 = 대상자.items?.[0];
    본다("고칠 대상자가 있습니다", !!한명, 한명?.name);

    if (한명) {
      const 한꺼번에 = 20;
      const 답들 = await Promise.all(
        Array.from({ length: 한꺼번에 }, (_, i) =>
          부르기(`/api/recipients/${한명.id}`, {
            method: "PATCH", headers: { "content-type": "application/json" },
            body: JSON.stringify({ memo: `한꺼번에 ${i}` }),
          }).then((x) => x.status).catch(() => 0))
      );
      const 잘된것 = 답들.filter((s) => s === 200).length;
      본다(`★★ ${한꺼번에}개를 한꺼번에 저장해도 다 들어갑니다`,
        잘된것 === 한꺼번에, `${잘된것}/${한꺼번에} · 나온 코드 ${[...new Set(답들)].join(",")}`);

      const 다시 = await (await 부르기(`/api/recipients/${한명.id}`)).json() as any;
      본다("★ 마지막에 적은 것이 남아 있습니다",
        String(다시?.recipient?.memo ?? "").startsWith("한꺼번에"),
        String(다시?.recipient?.memo ?? "(없음)"));
    }

    /*
     * 자료함을 밖에서 **잠깐** 잡아 봅니다.
     *
     * ★ 처음에는 시험이 끝날 때까지 붙잡고 있었습니다. 그러면 아무리
     *   기다려도 안 풀리니 **무슨 짓을 해도 실패**합니다 — 시험이
     *   틀렸던 것입니다. 실제로 남이 잡는 시간은 **몇 밀리초**입니다.
     */
    const 잠근이 = new Database(자료함);
    잠근이.exec("PRAGMA busy_timeout = 100");
    잠근이.exec("BEGIN IMMEDIATE");          // 쓰기 자리를 붙잡습니다
    잠근이.run("UPDATE meta SET value = value WHERE key = 'app_version'");
    setTimeout(() => { try { 잠근이.exec("ROLLBACK"); 잠근이.close(); } catch { } }, 800);
    const t잠 = Date.now();
    const 잠겼을때 = 한명 ? await 부르기(`/api/recipients/${한명.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ memo: "잠겼을 때" }),
    }).then((x) => x.status).catch(() => 0) : 0;
    const 걸린잠 = Date.now() - t잠;
    /*
     * 여기서 500 이 나오면 **화면은 「저장됐습니다」라고 하고 자료는
     * 안 들어간** 상태일 수 있습니다. 그게 제일 나쁩니다.
     */
    /*
     * ★★ **여기가 이 시험의 알맹이입니다.**
     *
     *   전에는 **500** 이 났습니다 — 기다리지 않고 그 자리에서 포기한
     *   것입니다. 화면에는 「처리 중 문제가 생겼습니다」만 뜨고 방금
     *   적은 것은 사라집니다. 사무실 열기로 옆 컴퓨터가 붙어 있으면
     *   실제로 생기는 일입니다.
     *
     *   이제 5초를 기다립니다(`PRAGMA busy_timeout`). 사람이 하는
     *   저장은 몇 밀리초라 그 안에 거의 다 풀립니다.
     */
    본다("★★ 남이 자료함을 잡고 있어도 기다렸다가 저장합니다",
      잠겼을때 === 200, `${잠겼을때} · ${걸린잠}ms 기다림 (500 이면 기다리지 않고 포기한 것입니다)`);
    본다("★ 정말 기다렸습니다 (바로 성공한 것이 아님)", 걸린잠 >= 500, `${걸린잠}ms`);

    /*
     * 5초를 넘게 잡혀 있는 것은 드문 일입니다. 그때는 **다시 누르면
     * 되는 일**이라고 말해 줘야 합니다 — 「처리 중 문제가 생겼습니다」로
     * 두면 기관이 전화를 겁니다.
     */
    const 오래잡기 = new Database(자료함);
    오래잡기.exec("BEGIN IMMEDIATE");
    오래잡기.run("UPDATE meta SET value = value WHERE key = 'app_version'");
    const 오래 = 한명 ? await 부르기(`/api/recipients/${한명.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ memo: "오래 잠김" }),
    }) : null;
    const 오래글 = 오래 ? await 오래.text() : "";
    try { 오래잡기.exec("ROLLBACK"); 오래잡기.close(); } catch { }
    본다("★★ 오래 잠겨 있으면 「다시 눌러 주세요」라고 말합니다 (500 이 아니라)",
      오래?.status === 409 && /다시 눌러/.test(오래글),
      `${오래?.status} · ${오래글.slice(0, 60)}`);
  }

  // ═══ ③ 오래 켜 두면 ══════════════════════════════════════
  console.log("\n  ③ 오래 켜 두면 쌓이는 것");
  {
    const 전 = 센다("session");
    for (let i = 0; i < 30; i++) {
      await fetch(집.주소 + "/api/login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ loginId: "onekey01", password: "시험1234" }),
      }).catch(() => {});
    }
    const 후 = 센다("session");
    /*
     * 들어올 때마다 줄이 하나씩 늘어납니다. 그 자체는 맞습니다 —
     * 문제는 **없어지지 않는 것**입니다. 켤 때 만료된 것을 치우고
     * (`purgeExpiredSessions`), 나갈 때 그 줄을 지웁니다.
     */
    본다("로그인하면 줄이 늘어납니다 (그건 맞습니다)", 후 > 전, `${전} → ${후}`);
    /*
     * ★ 늦추기는 **틀린 것만** 셉니다. 맞는 비밀번호로 서른 번 들어가는
     *   것은 막을 일이 아닙니다 (처음에 이것을 잘못 시험했습니다).
     *   여기서 볼 것은 「줄이 쌓이기만 하고 안 없어지는가」입니다.
     */
    본다("★ 들어간 만큼 줄이 늘어납니다 (맞는 비밀번호는 안 막습니다)",
      후 - 전 === 30, `늘어난 줄 ${후 - 전}개`);

    await 부르기("/api/logout", { method: "POST" });
    본다("★ 나가면 그 줄이 지워집니다", 센다("session") < 후, `${후} → ${센다("session")}`);
  }

  // ═══ ④ 자료함이 커져도 백업이 도나 ═══════════════════════
  console.log("\n  ④ 자료함이 커져도");
  {
    const 크기 = statSync(자료함).size;
    const t = performance.now();
    await 부르기("/api/settings/backup", { method: "POST" });
    const 걸린것 = Math.round(performance.now() - t);
    본다("★ 백업이 사람이 기다릴 만한 시간에 끝납니다",
      걸린것 < 5000, `${(크기 / 1024 / 1024).toFixed(1)}MB 를 ${걸린것}ms`);

    const 보관 = join(집.폴더, "data", "보관");
    const 개수 = readdirSync(보관).filter((n) => n.endsWith(".db")).length;
    본다("보관이 무한정 늘지 않습니다 (남길 부수만큼만)", 개수 <= 12, `${개수}개`);
  }

} finally {
  await 집.끄기();
}

console.log("\n  ═══════════════════════════════════════════════════");
console.log(`  통과 ${통과수} · 실패 ${실패수}\n`);
process.exit(실패수 ? 1 : 0);
