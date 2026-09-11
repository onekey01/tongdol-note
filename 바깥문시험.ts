/**
 * 바깥에서 들어오는 길 —  bun 바깥문시험.ts
 *
 * ═══════════════════════════════════════════════════════════
 *  왜 이 시험이 있나
 * ═══════════════════════════════════════════════════════════
 *
 * (2026-09-08 무무 — 「**외부에서 뚫고 들어올 가능성**에 대한
 *  보안점검까지 이루어져야 해.」)
 *
 * ── 「127.0.0.1 에만 열어 뒀으니 안전하다」는 틀렸습니다 ────
 *
 * 이 프로그램은 자기 컴퓨터에만 귀를 엽니다. 그래서 사무실 밖에서
 * 직접 들어올 수는 없습니다. 그런데 **길이 하나 더 있습니다 —
 * 관리자의 브라우저입니다.**
 *
 * 관리자가 점심때 뉴스를 보다 나쁜 광고가 붙은 쪽을 엽니다. 그 쪽의
 * 자바스크립트는 **그 컴퓨터 안에서** 돕니다. 그러니 127.0.0.1 도
 * 두드릴 수 있습니다 (DNS 되박기 — `server/문지기.ts` 에 자세히).
 *
 * 2026-09-08 점검 전에 실제로 이랬습니다 —
 *
 *   · `Host` 를 `evil.example.com` 으로 보내도 **그대로 200 을 냈습니다**
 *   · `/api/bootstrap` 이 로그인 없이 **기관명·대표자·전화·사업자번호·
 *     계좌번호**를 통째로 냈습니다
 *   · `/api/health` 가 **자료함 전체 경로**를 냈습니다 —
 *     `C:\Users\Bak Byeongseob\...` 처럼 **윈도 사용자 이름**이 그대로
 *   · 로그인 비밀번호를 **몇 번을 틀리든** 그대로 받았습니다
 *
 * ── ★ 이 시험은 진짜 소켓으로 두드립니다 ★ ────────────────
 *
 * `fetch` 로는 `Host` 를 마음대로 못 씁니다 — 브라우저와 마찬가지로
 * 주소에서 자동으로 채웁니다. 그래서 **날 HTTP 를 손으로 써서**
 * 보냅니다. 공격하는 쪽이 하는 것과 같은 방식입니다.
 */
import { connect } from "node:net";
import { 빈자료함띄우기 } from "./도구/빈자료함";

let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: unknown, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}

/** 날 HTTP 한 통. `Host` 를 비롯해 무엇이든 마음대로 적을 수 있습니다. */
function 날로(포트: number, 줄들: string[], 몸통 = ""): Promise<string> {
  return new Promise((풀기) => {
    const s = connect(포트, "127.0.0.1", () => {
      const 머리 = [...줄들];
      if (몸통) 머리.push(`Content-Length: ${Buffer.byteLength(몸통)}`);
      s.write(머리.join("\r\n") + "\r\n\r\n" + 몸통);
    });
    let 답 = "";
    s.on("data", (d) => { 답 += d.toString("utf8"); });
    s.on("end", () => 풀기(답));
    s.on("error", () => 풀기(""));
    setTimeout(() => { s.end(); 풀기(답); }, 4000);
  });
}
const 코드 = (r: string) => Number(/^HTTP\/1\.[01] (\d{3})/.exec(r)?.[1] ?? 0);
const 몸 = (r: string) => (r.split("\r\n\r\n").slice(1).join("\r\n\r\n") ?? "");

console.log("\n  바깥에서 들어오는 길 시험");
console.log("  ═══════════════════════════════════════════════════\n");

const 집 = await 빈자료함띄우기();
const 포트 = Number(new URL(집.주소).port);

try {
  // ═══ ① DNS 되박기 ════════════════════════════════════════
  console.log("  ① DNS 되박기 — 남의 이름으로 들어오면 안 받습니다");
  for (const 나쁜이름 of [
    "evil.example.com", "evil.example.com:5757", "attacker.io",
    "rebind.badsite.kr:80", "xn--e1afmkfd.example",
  ]) {
    const r = await 날로(포트, ["GET /api/health HTTP/1.1", `Host: ${나쁜이름}`, "Connection: close"]);
    본다(`★★ Host: ${나쁜이름} 는 막힙니다`, 코드(r) === 403, `${코드(r)}`);
  }
  {
    const r = await 날로(포트, ["GET /api/health HTTP/1.0", "Connection: close"]);
    본다("★ Host 가 아예 없으면 막습니다", 코드(r) === 400 || 코드(r) === 403, `${코드(r)}`);
  }
  for (const 우리이름 of [`127.0.0.1:${포트}`, `localhost:${포트}`, "127.0.0.1"]) {
    const r = await 날로(포트, ["GET /api/health HTTP/1.1", `Host: ${우리이름}`, "Connection: close"]);
    본다(`우리 이름(${우리이름})은 그대로 됩니다`, 코드(r) === 200, `${코드(r)}`);
  }
  {
    /*
     * ★★ 되박기로 노리는 진짜 목표 — **아직 개설 안 된 기관을 가로채기.**
     *   빈 자료함으로 처음 켠 PC 는 `/api/setup` 이 열려 있습니다.
     *   남이 그것을 먼저 부르면 **자기 아이디로 관리자를 만들어** 버립니다.
     */
    const 몸통 = JSON.stringify({
      orgName: "가로챈기관", adminName: "남", loginId: "attacker", password: "hack1234",
    });
    const r = await 날로(포트, [
      "POST /api/setup HTTP/1.1", "Host: evil.example.com",
      "Content-Type: application/json", "Connection: close",
    ], 몸통);
    본다("★★★ 남의 이름으로는 기관 개설도 못 합니다 (빈 PC 가로채기)",
      코드(r) === 403, `${코드(r)}`);
    const 확인 = await 날로(포트, ["GET /api/bootstrap HTTP/1.1", `Host: 127.0.0.1:${포트}`, "Connection: close"]);
    본다("★★★ 그래서 기관은 아직 개설 안 된 채 그대로입니다",
      몸(확인).includes('"needsSetup":true'), 몸(확인).slice(0, 60));
  }

  // ═══ ② 어디서 눌렀나 ═════════════════════════════════════
  console.log("\n  ② 남의 쪽에서 눌러 보내는 요청 (CSRF)");
  {
    const 몸통 = JSON.stringify({ loginId: "onekey01", password: "x" });
    const r = await 날로(포트, [
      "POST /api/login HTTP/1.1", `Host: 127.0.0.1:${포트}`,
      "Origin: https://evil.example.com",
      "Content-Type: application/json", "Connection: close",
    ], 몸통);
    본다("★★ 남의 쪽에서 온 POST 는 막힙니다", 코드(r) === 403, `${코드(r)}`);
  }
  {
    const r = await 날로(포트, [
      "GET /api/bootstrap HTTP/1.1", `Host: 127.0.0.1:${포트}`,
      "Origin: https://evil.example.com", "Connection: close",
    ]);
    본다("읽기만 하는 GET 은 Origin 을 안 봅니다 (막으면 화면이 안 돕니다)",
      코드(r) === 200, `${코드(r)}`);
    본다("★ 그래도 CORS 머리글은 안 붙습니다 (붙으면 남이 답을 읽습니다)",
      !/access-control-allow-origin/i.test(r));
  }

  // ═══ ③ 로그인 없이 무엇이 보이나 ═════════════════════════
  console.log("\n  ③ 로그인 없이 보이는 것");
  {
    const r = await 날로(포트, ["GET /api/health HTTP/1.1", `Host: 127.0.0.1:${포트}`, "Connection: close"]);
    const 것 = JSON.parse(몸(r) || "{}");
    본다("★★ 자료함 **경로**를 안 냅니다 (윈도 사용자 이름이 들어 있습니다)",
      !것.dbPath, String(것.dbPath ?? "(없음)"));
    본다("★ 대신 지문을 냅니다 (같은 자료함인지 견주는 데는 이것으로 충분)",
      typeof 것.dbKey === "string" && 것.dbKey.length === 16, 것.dbKey);
    본다("★ 설치 시각도 안 냅니다", !것.installedAt);
    본다("버전은 냅니다 (원격으로 도울 때 첫 물음입니다)", !!것.version, 것.version);
  }
  for (const 길 of ["/api/recipients", "/api/staff", "/api/settings", "/api/update",
                    "/api/recordbook", "/api/billing"]) {
    const r = await 날로(포트, [`GET ${길} HTTP/1.1`, `Host: 127.0.0.1:${포트}`, "Connection: close"]);
    본다(`${길} 는 로그인해야 보입니다`, 코드(r) === 401 || 코드(r) === 403, `${코드(r)}`);
  }

  // ═══ ④ 기관을 개설한 뒤 ══════════════════════════════════
  console.log("\n  ④ 기관을 개설한 뒤 — 기관 정보가 새나");
  {
    const 몸통 = JSON.stringify({
      orgName: "해남시험복지관", phone: "061-530-0000", adminName: "박병섭",
      loginId: "onekey01", password: "시험1234",
    });
    const r = await 날로(포트, [
      "POST /api/setup HTTP/1.1", `Host: 127.0.0.1:${포트}`,
      "Content-Type: application/json", "Connection: close",
    ], 몸통);
    본다("우리 이름으로는 기관 개설이 됩니다", 코드(r) === 200, `${코드(r)}`);

    // 기관 표에 사업자번호·계좌를 넣어 둡니다 (새는지 보려고).
    const { db, initDb } = await import("./server/db");
    initDb();
    db.run(`UPDATE organization SET biz_no = ?, bank_name = ?, bank_account = ?,
            bank_holder = ?, ceo_name = ? WHERE id = 1`,
      ["123-45-67890", "농협", "301-1234-5678-01", "해남시험복지관", "박대표"]);
  }
  {
    const r = await 날로(포트, ["GET /api/bootstrap HTTP/1.1", `Host: 127.0.0.1:${포트}`, "Connection: close"]);
    const 것 = JSON.parse(몸(r) || "{}");
    본다("로그인 화면이 쓰는 기관 이름은 나옵니다", 것?.org?.name === "해남시험복지관", 것?.org?.name);
    for (const [칸, 뭐] of [["biz_no", "사업자등록번호"], ["bank_account", "계좌번호"],
                            ["bank_holder", "예금주"], ["ceo_name", "대표자 성명"],
                            ["phone", "대표 전화"], ["address", "주소"]] as const) {
      본다(`★★ ${뭐}는 로그인 전에 안 나옵니다`, 것?.org?.[칸] === undefined,
        String(것?.org?.[칸] ?? "(없음)"));
    }
  }

  // ═══ ⑤ 로그인 쿠키 ══════════════════════════════════════
  console.log("\n  ⑤ 로그인 쿠키");
  {
    const r = await 날로(포트, [
      "POST /api/login HTTP/1.1", `Host: 127.0.0.1:${포트}`,
      "Content-Type: application/json", "Connection: close",
    ], JSON.stringify({ loginId: "onekey01", password: "시험1234" }));
    본다("멀쩡한 비밀번호로는 들어가집니다", 코드(r) === 200, `${코드(r)}`);
    const 쿠키줄 = (/set-cookie:([^\r]*)/i.exec(r)?.[1] ?? "").trim();
    본다("★ HttpOnly — 화면의 자바스크립트가 못 읽습니다", /HttpOnly/i.test(쿠키줄));
    본다("★ SameSite=Lax — 남의 쪽에서 온 요청에는 안 실립니다", /SameSite=Lax/i.test(쿠키줄));
    본다("Path=/ 로 붙습니다", /Path=\//i.test(쿠키줄), 쿠키줄.slice(0, 70));
  }

  // ═══ ⑥ 비밀번호 무차별 대입 ══════════════════════════════
  /*
   * ★ **여기부터는 그 아이디가 잠깁니다.** 그래서 맨 뒤에 둡니다 —
   *   앞에 두면 뒤에 오는 시험이 죄다 「429」로 죽습니다. 그리고
   *   서버는 **딴 프로세스**라 이 시험이 서버의 기록을 못 지웁니다
   *   (처음에 지울 수 있는 줄 알고 짰다가 여섯 가지가 죽었습니다).
   */
  console.log("\n  ⑥ 비밀번호 무차별 대입");
  {
    const 틀리기 = (아이디: string) => 날로(포트, [
      "POST /api/login HTTP/1.1", `Host: 127.0.0.1:${포트}`,
      "Content-Type: application/json", "Connection: close",
    ], JSON.stringify({ loginId: 아이디, password: "틀린것" }));

    // 있는 아이디와 없는 아이디의 답이 같아야 합니다 — **잠기기 전에** 봅니다.
    const 있는것 = await 틀리기("onekey01");
    const 없는것 = await 틀리기("없는사람아무개");
    본다("★ 있는 아이디와 없는 아이디의 답이 같습니다",
      코드(있는것) === 코드(없는것) && 몸(있는것) === 몸(없는것),
      `${코드(있는것)} / ${코드(없는것)}`);

    /*
     * 셈은 이렇습니다 — **틀린 횟수가 다섯이 되는 순간부터** 늦춥니다.
     * 그러니 그냥 받는 것은 **다섯 번**이고, 막히는 것은 **여섯 번째**입니다.
     * (위 「있는/없는 아이디」에서 onekey01 이 이미 한 번 틀렸습니다.)
     */
    let 그냥받은것 = 1;
    for (let i = 0; i < 4; i++) if (코드(await 틀리기("onekey01")) === 401) 그냥받은것++;
    본다("다섯 번까지는 그냥 「맞지 않습니다」 (사람은 오타를 냅니다)",
      그냥받은것 === 5, `${그냥받은것}/5`);

    const 여섯째 = await 틀리기("onekey01");
    본다("★★ 여섯 번째부터 늦춥니다", 코드(여섯째) === 429,
      `${코드(여섯째)} · ${몸(여섯째).slice(0, 60)}`);

    // 맞는 비밀번호라도 늦추는 동안에는 안 됩니다 — 그래야 뜻이 있습니다.
    const 맞는것 = await 날로(포트, [
      "POST /api/login HTTP/1.1", `Host: 127.0.0.1:${포트}`,
      "Content-Type: application/json", "Connection: close",
    ], JSON.stringify({ loginId: "onekey01", password: "시험1234" }));
    본다("★ 늦추는 동안에는 맞는 비밀번호도 기다립니다", 코드(맞는것) === 429, `${코드(맞는것)}`);

    // 다른 아이디는 그대로 됩니다 — 한 사람이 막혔다고 기관이 잠기면 안 됩니다.
    const 남 = await 틀리기("또다른사람");
    본다("★★ 다른 아이디는 안 막힙니다 (기관 전체가 잠기면 안 됩니다)",
      코드(남) === 401, `${코드(남)}`);
  }

  // ═══ ⑥-나. 늦추기 셈 자체 ════════════════════════════════
  /*
   * 「시간이 지나면 풀린다」는 **서버를 몇 분 세워 두어야** 볼 수 있어
   * 시험으로 삼기 어렵습니다. 대신 셈하는 함수를 그 자리에서 봅니다 —
   * 규칙이 사는 자리가 거기입니다.
   */
  console.log("\n  ⑥-나. 늦추기 셈");
  {
    const { 얼마나기다려야, 틀렸다, 맞았다, 기록비우기: 비우기 } = await import("./server/문지기");
    비우기();
    const 열쇠 = "시험:늦추기";
    const 때 = 1_000_000_000_000;
    for (let i = 0; i < 4; i++) 틀렸다(열쇠, 때);
    본다("네 번 틀린 뒤(= 다섯 번째 시도)까지는 안 늦춥니다",
      얼마나기다려야(열쇠, 때) === 0);
    틀렸다(열쇠, 때);                      // 다섯 번째로 틀림
    본다("★ 다섯 번 틀리면(= 여섯 번째 시도부터) 늦춥니다",
      얼마나기다려야(열쇠, 때) > 0, `${얼마나기다려야(열쇠, 때)}ms`);
    본다("★★ 시간이 지나면 저절로 풀립니다 (영영 잠그지 않습니다)",
      얼마나기다려야(열쇠, 때 + 31_000) === 0);
    본다("★★ 10분 아무 일 없으면 아예 잊습니다 (어제 실수를 오늘 안 뭅니다)",
      얼마나기다려야(열쇠, 때 + 11 * 60_000) === 0);
    for (let i = 0; i < 20; i++) 틀렸다(열쇠, 때);
    본다("★ 아무리 틀려도 5분을 안 넘습니다 (남이 일부러 잠그지 못하게)",
      얼마나기다려야(열쇠, 때) <= 5 * 60_000, `${Math.round(얼마나기다려야(열쇠, 때) / 1000)}초`);
    맞았다(열쇠);
    본다("맞으면 그 자리에서 풀립니다", 얼마나기다려야(열쇠, 때) === 0);
    비우기();
  }

  // ═══ ⑦ 파일 길 빠져나가기 ════════════════════════════════
  console.log("\n  ⑦ 파일 길로 빠져나가기");
  for (const 길 of [
    "/../server/db.ts", "/../../etc/passwd", "/..%2f..%2fetc%2fpasswd",
    "/dist-web/../../server/업데이트열쇠.ts",
  ]) {
    const r = await 날로(포트, [`GET ${길} HTTP/1.1`, `Host: 127.0.0.1:${포트}`, "Connection: close"]);
    const 알맹이 = 몸(r);
    const 새나 = /import |export const|공개열쇠|root:x:/.test(알맹이);
    /*
     * 200 이 나오는 것은 맞습니다 — 화면 안에서 주소가 바뀌는 방식이라
     * 모르는 길은 `index.html` 로 되돌립니다. **무엇을 돌려주는지**를
     * 봐야 합니다. 소스가 나오면 그때가 뚫린 것입니다.
     */
    본다(`★★ ${길} 로 파일이 안 새어 나옵니다`,
      !새나 && (알맹이.includes("<!doctype") || 알맹이.includes("<!DOCTYPE") || 코드(r) === 404),
      `${코드(r)} · ${알맹이.slice(0, 40).replace(/\n/g, " ")}`);
  }

} finally {
  await 집.끄기();
}

console.log("\n  ═══════════════════════════════════════════════════");
console.log(`  통과 ${통과수} · 실패 ${실패수}\n`);
process.exit(실패수 ? 1 : 0);
