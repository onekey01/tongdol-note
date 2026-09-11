import { 버전 } from "./version";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { initDb, metaGet, DB_PATH } from "./db";
import { purgeExpiredSessions, currentUser } from "./auth";
import { handleApi } from "./api";
import { 백업하기, 뜰때인가, 주기, 주기들 } from "./backup";
import { 지킴이켜기, 붙음, 떨어짐 } from "./지킴이";
import { 보내기시작 } from "./할일보내기";
import { 집표채우기 } from "./방문표";
import { 받기시작, 옛메모옮기기 } from "./보고받기";
import { 옛메모지키우기 } from "./sticky";
import { 뒷정리, 확인하기 as 업데이트확인하기 } from "./업데이트";
import * as 사무실 from "./사무실열기";
import { 로그인받기시작 } from "./계정로그인";
import { 열쇠백업하기 } from "./열쇠백업";
import { 예약된때 } from "./근무시간";
import { 문지기, 랜이름정하기, 얼마나기다려야, 틀렸다, 맞았다, 기다리란말 } from "./문지기";
import { createHash } from "node:crypto";

/** ─────────────────────────────────────────────────────────
 *  통돌 Note — 기관 PC 프로그램
 *
 *  중요 원칙 두 가지
 *  1) 반드시 127.0.0.1 에만 귀를 엽니다.
 *     → 바깥에서 이 PC로 들어올 수 없고, 윈도우 방화벽 경고도 안 뜹니다.
 *  2) 화면(HTML/JS)도 이 프로그램이 직접 내줍니다.
 *     → 같은 출처라서 브라우저의 로컬 네트워크 접근 경고가 안 뜹니다.
 *  ───────────────────────────────────────────────────────── */

/**
 * 이 프로그램의 버전 번호.
 *
 * `TONGDOL_버전흉내` 로 바꿔 볼 수 있습니다 — **시험에서만** 씁니다.
 * 「옛 버전이 돌고 있을 때 제대로 알려 주는가」를 보려면 두 버전이 서로
 * 달라야 하는데, 진짜로 옛 버전을 깔아 둘 수는 없기 때문입니다.
 */
const 내버전 = process.env.TONGDOL_버전흉내 || 버전;

const HOST = "127.0.0.1";
const PREFERRED_PORTS = [5757, 5758, 5759, 5760, 5761];
const WEB_DIR = join(process.cwd(), "dist-web");
const IS_DEV = !existsSync(WEB_DIR);

/** 브라우저로 그 주소를 엽니다. 못 열어도 넘어갑니다 — 주소는 창에 찍힙니다. */
function 브라우저로열기(주소: string) {
  if (process.env.TONGDOL_NO_OPEN === "1") return;
  const cmd =
    process.platform === "win32"
      ? ["cmd", "/c", "start", "", 주소]
      : process.platform === "darwin"
      ? ["open", 주소]
      : ["xdg-open", 주소];
  try {
    Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
  } catch {
    /* 못 열어도 주소는 창에 찍혀 있으니 넘어갑니다. */
  }
}

/*
 * ── 이미 돌고 있으면 두 번 켜지 않습니다 ────────────────────
 *
 * 창을 닫으면 프로그램도 함께 꺼집니다(`server/지킴이.ts`). 그것으로
 * 대부분 막히지만, **다 막지는 못합니다** — 검은 창을 그대로 둔 채
 * 바탕화면 아이콘을 또 누르는 일이 있습니다. 그러면 두 개가 돌고,
 * 어느 쪽에 적었는지 헷갈립니다.
 *
 * 그래서 켤 때도 봅니다. 먼저 두드려 보고, **같은 자료함**을 쓰는
 * 통돌 Note 가 이미 돌고 있으면 새로 켜지 않고 **그 화면만 열어 줍니다.**
 *
 * 「같은 자료함」인지까지 보는 까닭 — 다른 폴더의 통돌 Note 라면 그건
 * 남의 기관 것입니다. 그 화면을 열어 주면 **엉뚱한 기관의 자료**를
 * 보게 됩니다. 그럴 때는 조용히 다음 포트에 제 것을 새로 엽니다.
 */
/*
 * 자료함이 같은지 견주는 **지문**입니다.
 *
 * ★ 반드시 `이미돌고있나` **위**에 있어야 합니다. 아래에 두었더니
 *   `const` 는 선언 전에 못 읽는다는 규칙에 걸려 그 자리에서 터졌고,
 *   그 함수의 `catch` 가 그것을 삼켜 **늘 「아무도 없다」로 답했습니다.**
 *   그래서 두 번째로 켠 프로그램이 물러나지 않고 둘이 같이 돌았습니다.
 *   화면은 멀쩡해 보이는데 어느 쪽에 적었는지 모르게 되는, 제일 나쁜
 *   갈래입니다. (2026-09-08 지킴이시험이 잡았습니다)
 */
const 자료함지문 = createHash("sha256").update(DB_PATH).digest("hex").slice(0, 16);

async function 이미돌고있나(): Promise<{ 주소: string; 버전: string } | null> {
  for (const port of PREFERRED_PORTS) {
    const 주소 = `http://${HOST}:${port}`;
    try {
      const r = await fetch(주소 + "/api/health", { signal: AbortSignal.timeout(700) });
      if (!r.ok) continue;
      const 것 = (await r.json()) as { app?: string; dbKey?: string; version?: string };
      if (것?.app === "통돌 Note" && 것?.dbKey === 자료함지문)
        return { 주소, 버전: String(것.version ?? "") };
    } catch {
      /* 아무도 없거나, 남의 프로그램입니다. 다음 번호를 봅니다. */
    }
  }
  return null;
}

/*
 * ★ 자료함을 만지기 **전에** 봅니다.
 *   initDb() 는 자료함 모양을 고치는 일(migrate)을 합니다. 이미 돌고 있는
 *   프로그램 옆에서 그 일을 또 하면 안 됩니다.
 */
{
  const 돌고있는것 = await 이미돌고있나();
  if (돌고있는것) {
    console.log("");
    if (돌고있는것.버전 && 돌고있는것.버전 !== 내버전) {
      /*
       * ★ **옛 버전이 돌고 있으면 반드시 말해 줍니다.**
       *
       *   고친 것을 받으려고 다시 켰는데, 앞 것이 아직 살아 있으면
       *   이 새것이 조용히 물러납니다. 그러면 화면은 열리는데
       *   **고친 것은 하나도 안 들어간 채**로 씁니다. 「분명 새로 켰는데
       *   왜 그대로지」가 됩니다 — 제일 찾기 어려운 갈래입니다.
       *   (2026-09-05 무무가 「검은창이 같이 안 닫혀」로 겪었습니다.)
       */
      console.log("  ※ 이미 켜져 있는 통돌 Note 가 **옛 버전**입니다.");
      console.log(`     지금 도는 것  v${돌고있는것.버전}`);
      console.log(`     새로 깐 것    v${내버전}`);
      console.log("");
      console.log("  새 것으로 쓰시려면 — 열려 있는 통돌 Note **브라우저 창을 모두**");
      console.log("  닫아 주세요. 그러면 옛것이 스스로 꺼집니다. 그 뒤에 이것을");
      console.log("  다시 실행하시면 됩니다.");
      console.log("");
      console.log("  일단 지금 도는 옛 버전 화면을 엽니다.");
    } else {
      console.log("  통돌 Note 는 이미 켜져 있습니다. 그 화면을 엽니다.");
      console.log("  (두 개가 돌면 어느 쪽에 적었는지 헷갈리므로 새로 켜지 않습니다.)");
    }
    console.log(`  주소     ${돌고있는것.주소}`);
    console.log("");
    브라우저로열기(돌고있는것.주소);
    /*
     * 옛 버전이면 검은 창을 **남겨 둡니다.** 곧바로 닫히면 위 안내를
     * 아무도 못 읽습니다.
     */
    if (돌고있는것.버전 && 돌고있는것.버전 !== 내버전) {
      console.log("  이 창은 엔터를 누르시면 닫힙니다.");
      for await (const _ of console) break;
    }
    process.exit(0);
  }
}

const meta = initDb();
purgeExpiredSessions(); // 만료된 로그인 흔적을 켤 때 한 번 치웁니다.

/** 화면 파일을 찾아서 돌려줍니다. 없으면 null. */
async function serveStatic(pathname: string): Promise<Response | null> {
  if (IS_DEV) return null;

  const rel = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(WEB_DIR, rel);

  // dist-web 밖으로 빠져나가려는 요청은 막습니다.
  if (!filePath.startsWith(WEB_DIR)) return null;

  const file = Bun.file(filePath);
  if (await file.exists()) return new Response(file);

  // 화면 안에서 주소가 바뀌는 경우(SPA)를 위해 index.html 로 되돌립니다.
  const index = Bun.file(join(WEB_DIR, "index.html"));
  if (await index.exists()) return new Response(index);

  return null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/*
 * ── 켜져 있나 묻는 자리 ────────────────────────────────────
 *
 * **로그인 없이** 답합니다 — 두 번째로 켜지는 프로그램이 「내가 벌써
 * 돌고 있나」를 물어야 하기 때문입니다(`이미돌고있나`).
 *
 * ★ 그래서 **자료함 경로를 안 보냅니다** (2026-09-08 점검).
 *   경로에는 `C:\Users\Bak Byeongseob\...` 처럼 **윈도 사용자 이름**이
 *   그대로 들어 있습니다. 로그인도 안 한 쪽에 사람 이름을 흘릴
 *   까닭이 없습니다. 대신 **지문**을 보냅니다 — 같은 자료함인지
 *   견주는 데는 그것으로 충분하고, 되돌려 읽을 수는 없습니다.
 *
 *   경로 자체는 **들어온 사람에게만** 보냅니다 (설정 → 백업 화면).
 */

function health(req?: Request) {
  const 들어온사람 = req ? currentUser(req) : null;
  return json({
    ok: true,
    app: "통돌 Note",
    version: 내버전,
    schemaVersion: meta.schemaVersion,
    dbKey: 자료함지문,
    mode: IS_DEV ? "개발" : "실행",
    now: new Date().toISOString(),
    ...(들어온사람 ? { dbPath: DB_PATH, installedAt: meta.installedAt } : {}),
  });
}

/*
 * ── 탈이 났을 때 무슨 말을 하나 ────────────────────────────
 *
 * 「처리 중 문제가 생겼습니다」한 줄로 다 뭉뚱그리고 있었습니다.
 * 그런데 그중 하나는 **우리 잘못이 아니고, 다시 누르면 되는 것**입니다 —
 * **자료함이 잠긴 것**입니다.
 *
 * 언제 생기나 (2026-09-08 운용 시험에서 확인) —
 *   · 사무실 열기로 옆 컴퓨터가 붙어 있을 때 두 사람이 같은 순간에 저장
 *   · 백업을 뜨는 동안 누가 저장
 *   · 제공인력 폰이 보낸 보고가 들어오는 순간 사무실이 저장
 *
 * 대부분은 `PRAGMA busy_timeout` 이 5초를 기다려 저절로 풀립니다.
 * 5초를 넘게 잡혀 있는 것은 드문 일인데, 그때 「문제가 생겼습니다」만
 * 뜨면 기관은 **무엇을 해야 할지 모릅니다.** 다시 누르면 되는 일에
 * 전화를 겁니다. 그래서 그 한 갈래만 따로 말해 줍니다.
 */
function 탈났을때(e: unknown, pathname: string, 어디 = "api"): Response {
  const 말 = e instanceof Error ? e.message : String(e);
  const 잠김 = /SQLITE_BUSY|database is locked|database table is locked/i.test(말) ||
    String((e as any)?.code ?? "").includes("SQLITE_BUSY");
  if (잠김) {
    console.error(`[${어디}] ${pathname} — 자료함이 잠겨 있습니다`);
    return json({
      error:
        "다른 곳에서 저장하는 중입니다.\n" +
        "잠시 뒤에 다시 눌러 주세요. 방금 적으신 것은 그대로 있습니다.",
    }, 409);
  }
  console.error(`[${어디}]`, pathname, e);
  return json({ error: "처리 중 문제가 생겼습니다." }, 500);
}

/** 쓸 수 있는 포트를 찾을 때까지 차례로 시도합니다. */
function listen() {
  let lastError: unknown = null;

  for (const port of PREFERRED_PORTS) {
    try {
      return Bun.serve({
        hostname: HOST,
        port,
        async fetch(req, srv) {
          /*
           * 화면이 열려 있는 동안 붙들고 있는 **가느다란 줄**입니다.
           * 이 줄이 다 끊기면 프로그램이 스스로 꺼집니다 (`지킴이.ts`).
           * 로그인 전에도 붙습니다 — 로그인 화면만 띄워 놓고 닫는 경우도
           * 똑같이 꺼져야 하기 때문입니다.
           */
          /*
           * ── ★ 문지기 (2026-09-08 보안 점검에서 넣음) ★ ──────
           *
           * 「127.0.0.1 에만 열어 뒀으니 안전하다」는 **틀렸습니다.**
           * 관리자의 브라우저가 길이 됩니다 — 나쁜 쪽이 자기 이름을
           * 잠깐 127.0.0.1 로 바꿔 두면(DNS 되박기) 그 쪽 자바스크립트가
           * 우리 답을 그대로 읽습니다. 브라우저의 다른 막이는 이 수법에
           * 안 걸립니다.
           *
           * 막는 법은 **Host 머리글을 보는 것** 하나입니다.
           * 자세한 까닭은 `server/문지기.ts` 에 적어 두었습니다.
           */
          const 문 = 문지기(req);
          if (!문.됨) return new Response(문.까닭, {
            status: 문.코드,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });

          /*
           * ★ 주소를 뜯는 것은 **문지기 뒤**입니다. `Host` 가 없는 요청은
           *   주소가 아예 안 만들어져 여기서 터집니다 — 그러면 500 이
           *   나가는데, 500 은 「우리가 처리하다 실패했다」는 뜻이라
           *   막은 것과 다릅니다. (2026-09-08 시험에서 잡음)
           */
          const { pathname } = new URL(req.url);

          if (pathname === "/alive") {
            if (srv.upgrade(req)) return undefined as any;
            return new Response("줄을 잇지 못했습니다.", { status: 400 });
          }

          if (pathname === "/api/health") return health(req);

          // 나머지 /api/* 는 api.ts 가 맡습니다.
          try {
            const res = await handleApi(req);
            if (res) return res;
          } catch (e) {
            return 탈났을때(e, pathname);
          }

          const stat = await serveStatic(pathname);
          if (stat) return stat;

          if (IS_DEV) {
            return new Response(
              "화면이 아직 만들어지지 않았습니다.\n" +
              "개발 중에는 별도 창에서 `bun run dev:web` 을 실행하고\n" +
              "http://localhost:5173 으로 접속하세요.",
              { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } }
            );
          }
          return new Response("찾을 수 없습니다", { status: 404 });
        },
        websocket: {
          open() { 붙음(); },
          close() { 떨어짐(); },
          message() { /* 주고받을 말은 없습니다. 붙어 있다는 것 자체가 뜻입니다. */ },
        },
      });
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

const server = listen();
const url = `http://${HOST}:${server.port}`;

/* ══════════════════════════════════════════════════════════════
 *  사무실 안 다른 컴퓨터에서 들어오는 **두 번째 귀**
 *
 *  평소에는 **없습니다.** 관리자가 설정에서 열 때만 생기고, 정한
 *  시각이 되면 스스로 닫힙니다. 프로그램을 껐다 켜면 닫힌 채로
 *  시작합니다. 자세한 까닭은 `server/사무실열기.ts` 에.
 * ══════════════════════════════════════════════════════════════ */

/** 번호를 묻는 화면. 로그인 화면보다 **앞**에 섭니다. */
function 번호묻기(틀렸나 = false, 늦춤말 = ""): Response {
  return new Response(`<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>통돌 Note</title><style>
  body { font-family: -apple-system, "Malgun Gothic", sans-serif; background:#eef2f0;
    margin:0; display:flex; align-items:center; justify-content:center; min-height:100vh }
  .상자 { background:#fff; padding:28px 30px; border-radius:12px; max-width:340px;
    box-shadow:0 2px 14px rgba(0,0,0,.08) }
  h1 { font-size:1.15rem; margin:0 0 6px }
  p { color:#5b6b64; font-size:.9rem; line-height:1.6; margin:0 0 14px }
  input { width:100%; padding:13px; font-size:1.4rem; letter-spacing:.3em;
    text-align:center; border:1px solid #cfd8d4; border-radius:8px; box-sizing:border-box }
  button { width:100%; padding:13px; margin-top:10px; font-size:1rem; border:0;
    border-radius:8px; background:#0e5c52; color:#fff; cursor:pointer }
  .틀림 { color:#8f3630; font-size:.88rem; margin:8px 0 0 }
</style></head><body>
<form class="상자" method="POST" action="/lan-number">
  <h1>사무실 번호를 넣어 주세요</h1>
  <p>관리자 컴퓨터 화면에 뜬 <b>여섯 자리</b>입니다.<br>
     번호를 넣은 뒤 <b>본인 아이디와 비밀번호</b>로 들어갑니다.</p>
  <input name="n" inputmode="numeric" pattern="[0-9]{6}" maxlength="6"
         autocomplete="off" autofocus placeholder="000000">
  ${늦춤말 ? `<p class="틀림">여러 번 틀렸습니다. ${늦춤말}</p>`
      : 틀렸나 ? '<p class="틀림">번호가 맞지 않습니다.</p>' : ""}
  <button type="submit">확인</button>
</form></body></html>`, {
    status: 틀렸나 ? 401 : 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * 두 번째 귀. 본래 화면과 **같은 것**을 내주되, 앞에 번호를 묻습니다.
 *
 * ★ `/alive` 는 잇지 않습니다. 그 줄이 끊기면 프로그램이 꺼지는데,
 *   옆자리 사람이 창을 닫았다고 사무실 PC 가 꺼지면 안 됩니다.
 */
function 사무실귀(port: number) {
  return Bun.serve({
    hostname: "0.0.0.0",
    port,
    async fetch(req, srv) {

      /*
       * 이 귀는 **사무실 안 다른 컴퓨터**에게 열어 둔 것입니다. 그래도
       * 「우리 주소로 온 것」만 받습니다 — 바깥의 어떤 이름이 이 컴퓨터를
       * 가리키게 해 놓고 들어오는 길을 막습니다.
       */
      const 문 = 문지기(req, true);
      if (!문.됨) return new Response(문.까닭, {
        status: 문.코드, headers: { "content-type": "text/plain; charset=utf-8" },
      });

      const { pathname } = new URL(req.url);   // 문지기 뒤에서 뜯습니다
      const 쿠키 = req.headers.get("cookie");

      if (pathname === "/lan-number" && req.method === "POST") {
        /*
         * ── ★ 자꾸 틀리면 늦춥니다 (2026-09-08 보안 점검) ★ ───
         *
         * 여섯 자리는 **백만 가지**입니다. 늦추기가 없으면 사무실 랜
         * 안에서 몇 시간이면 다 눌러 볼 수 있습니다. 그런데 이 귀는
         * 한 번에 여덟 시간까지 열립니다.
         *
         * 누가 두드리는지로 셉니다 — 한 대가 막혀도 옆자리 직원은
         * 그대로 들어올 수 있어야 합니다.
         */
        const 누구 = `랜:${srv.requestIP(req)?.address ?? "모름"}`;
        const 기다릴것 = 얼마나기다려야(누구);
        if (기다릴것 > 0) return 번호묻기(true, 기다리란말(기다릴것));

        const 폼 = await req.formData().catch(() => null);
        const 넣은것 = String(폼?.get("n") ?? "").trim();
        if (넣은것 && 넣은것 === 사무실.지금번호())
          return new Response(null, {
            status: 302,
            headers: {
              location: "/",
              /*
               * 번호 쿠키는 **창을 닫으면 사라집니다**(만료를 안 줍니다).
               * 옆자리 컴퓨터에 오래 남겨 둘 까닭이 없습니다.
               */
              "set-cookie": `ck_lan=${넣은것}; Path=/; HttpOnly; SameSite=Lax`,
            },
          });
        // (맞았으면 위에서 돌아갑니다 — 여기 아래는 틀린 길입니다)
        틀렸다(누구);
        return 번호묻기(true);
      }

      if (!사무실.번호맞나(쿠키)) {
        // 화면이든 API 든 번호 먼저입니다.
        if (pathname.startsWith("/api/"))
          return json({ error: "사무실 번호를 다시 넣어 주세요." }, 401);
        return 번호묻기();
      }

      if (pathname === "/api/health") return health();
      try {
        const res = await handleApi(req);
        if (res) return res;
      } catch (e) {
        return 탈났을때(e, pathname, "사무실");
      }
      const stat = await serveStatic(pathname);
      if (stat) return stat;
      return new Response("찾을 수 없습니다", { status: 404 });
    },
  });
}

/** api.ts 가 부릅니다 — 여는 일은 여기서만 합니다(포트를 아는 곳이라). */
export function 사무실열기실행(시간: number) {
  return 사무실.열기(시간, 사무실귀);
}

console.log("");
console.log("  통돌 Note 가 실행되었습니다.");
console.log("  ─────────────────────────────────────────");
console.log(`  주소     ${url}`);
console.log(`  자료함   ${DB_PATH}`);
console.log(`  상태     ${IS_DEV ? "개발 모드 (화면은 5173)" : "실행 모드"}`);
console.log("  ─────────────────────────────────────────");
/*
 * ── 끄는 법 ────────────────────────────────────────────────
 *
 * **브라우저 창을 닫으면 이 프로그램도 함께 꺼집니다.**
 * 검은 창이 남아 있으면 기관은 「이게 뭐지」 하고 손을 못 댑니다 —
 * Ctrl+C 를 아는 사람은 만든 사람뿐입니다 (2026-09-05 무무).
 *
 * 꺼져 있는 동안 폰이 보낸 것은 **우편함에서 14일 기다립니다.**
 * 다음에 켜면 6초 뒤에 다 받아 옵니다. 자세한 까닭은 `server/지킴이.ts` 에.
 *
 * 지킴이를 **끄고 싶을 때**(시험을 돌리거나, 창 없이 오래 띄워 둘 때)는
 * `TONGDOL_STAY=1` 을 넣고 켜면 됩니다.
 * 개발 모드와 `TONGDOL_NO_OPEN=1` 일 때도 자동으로 안 끕니다 —
 * 아무도 안 붙을 것을 알면서 기다리다 끄는 것은 뜻이 없습니다.
 */
/*
 * ★ **종료 예약을 걸어도 지킴이는 그대로 돕니다.**
 *
 *   창을 닫으면 통돌 Note 는 꺼집니다 — 규칙은 하나입니다.
 *   무무가 못박았습니다: 「일반 이용자가 백그라운드에서 돌아가고
 *   있는 상황을 인지할 수 있는 방법이 없어.」 (2026-09-05)
 *
 *   종료 예약은 **윈도우가** 들고 있으므로, 창을 닫아 통돌 Note 가
 *   꺼져도 컴퓨터는 예약한 시각에 꺼집니다.
 */
const 지킬까 =
  !IS_DEV &&
  process.env.TONGDOL_STAY !== "1" &&
  process.env.TONGDOL_NO_OPEN !== "1";

{
  const 예약 = 예약된때();
  if (예약) {
    const 때 = new Date(예약);
    console.log(`  종료예약 오늘 ${String(때.getHours()).padStart(2, "0")}:${String(때.getMinutes()).padStart(2, "0")} 에 컴퓨터가 꺼집니다`);
  }
}
if (지킬까) {
  console.log("  끄실 때는 브라우저 창을 닫으시면 됩니다. 이 창도 함께 닫힙니다.");
  console.log("  (급하시면 이 창에서 Ctrl+C 를 누르셔도 됩니다.)");
} else {
  console.log("  끄시려면 이 창에서 Ctrl+C 를 누르세요.");
}
console.log("");

if (지킬까) {
  지킴이켜기(() => {
    console.log("");
    console.log("  창이 닫혀서 프로그램을 끕니다. 자료는 저장돼 있습니다.");
    console.log("  (그동안 폰이 보낸 것은 우편함에서 기다렸다가, 다음에 켜면 들어옵니다.)");
    console.log("");
    process.exit(0);
  });
}

/*
 * ── 백업 ───────────────────────────────────────────────────
 * **켤 때 한 번**, 그다음은 기관이 정한 주기대로.
 *
 * 켤 때만 뜨게 해 두었더니, 한 번 켜 놓고 몇 주를 그대로 쓰는 동안
 * 그 몇 주가 통째로 빈 채로 남았습니다. 그게 이 바닥의 실제 모습입니다.
 *
 * **10분마다 「뜰 때가 됐나」만 물어봅니다.** 주기를 재는 일은 여기서 하지 않고
 * `뜰때인가()` 가 마지막 백업 시각과 설정을 견줍니다. 그래야 설정을 바꿨을 때
 * 프로그램을 다시 켜지 않아도 바로 새 주기로 돕니다.
 */
function 백업돌리기(첫판 = false) {
  try {
    if (!첫판 && !뜰때인가()) return;
    const r = 백업하기(첫판);
    for (const 곳 of r.뜬곳) console.log(`  백업     ${곳}`);

    /*
     * `.env` 도 같이 뜹니다 — 안에 **기관 열쇠**가 있고,
     * 그것을 잃으면 우편함의 덩어리를 영영 못 엽니다.
     * 자료함과 열쇠는 **같이 있어야** 쓸모가 있습니다.
     * 바뀌었을 때만 뜨므로 같은 파일이 쌓이지 않습니다.
     */
    const 열쇠장 = 열쇠백업하기();
    if (열쇠장) console.log(`  백업     data\\보관\\열쇠\\${열쇠장}`);
    if (첫판) {
      const 이름 = 주기들.find((x) => x.값 === 주기())?.이름 ?? "";
      console.log(`  백업주기 ${이름}`);
      console.log("");
    }
  } catch (e) {
    console.log(`  백업     실패 — ${e}`);
  }
}
백업돌리기(true);
setInterval(() => 백업돌리기(), 10 * 60 * 1000);

/*
 * 예전에 내부 메모에 쌓아 둔 현장 특이사항을 **포스트잇으로 옮깁니다.**
 * 옮길 것이 없으면 아무 일도 안 합니다.
 */
const 옮긴수 = 옛메모옮기기();
if (옮긴수) console.log(`  메모     현장 특이사항 ${옮긴수}줄을 포스트잇으로 옮겼습니다`);

/*
 * 이미 붙어 있던 **현장 메모지(파랑)를 글에 맞게 키웁니다** — 한 번만.
 * 새로 오는 것만 커지면, 화면을 여신 분에게는 안 고쳐진 것으로 보입니다
 * (2026-09-07 무무). 자세한 것은 server/sticky.ts 의 `옛메모지키우기`.
 *
 * ★ **아무 말도 안 합니다** (2026-09-07 무무 — 「굳이 안내문은 넣지 마
 *   정신사나워」). 켤 때 뜨는 줄은 기관이 **무언가 해야 할 때**만
 *   쓰는 자리입니다. 저절로 끝난 뒷정리까지 한 줄씩 늘어놓으면
 *   정작 봐야 할 줄(백업 실패 같은)이 그 사이에 묻힙니다.
 */
옛메모지키우기();

/*
 * ── 업데이트 ───────────────────────────────────────────────
 *
 * ① 갈아 끼운 **다음 버전**이 켜진 것이면 뒷정리를 합니다 — .bat 이 두고
 *    간 옛 exe 를 사람이 알아볼 이름으로 `이전버전\` 에 옮기고 준비터를
 *    비웁니다. (.bat 은 한글 이름을 못 다뤄서 여기서 붙입니다.)
 *
 * ② 새 버전이 나왔는지 **뒤에서** 봅니다. `await` 하지 않습니다 —
 *    인터넷이 느리다고 프로그램이 늦게 켜지면 안 됩니다. 안에서 나는
 *    모든 잘못을 스스로 삼키므로 여기서는 붙잡을 것이 없습니다.
 */
뒷정리();
업데이트확인하기().catch(() => { });

// 방문표가 없는 옛 분들에게 한 번 만들어 붙입니다 (v1.6.26 전에 등록된 분들).
const 채운수 = 집표채우기();
if (채운수) console.log(`  방문표   ${채운수}분에게 새로 만들어 두었습니다`);

/*
 * 오늘 갈 곳을 우편함에 올립니다 (현장앱이 볼 것).
 * 우편함을 안 쓰는 기관이면 아무 일도 하지 않습니다.
 */
보내기시작();

/*
 * 현장앱이 올린 보고를 받아 실적에 넣습니다.
 * 우편함을 안 쓰는 기관이면 아무 일도 하지 않습니다.
 */
받기시작();

/*
 * 제공인력이 **새 휴대폰·새 브라우저로 들어오는** 것을 받습니다.
 * 사람이 폰 앞에서 기다리는 일이라 5초마다 봅니다.
 */
로그인받기시작();

/** 실행하면 브라우저를 자동으로 엽니다. */
if (!IS_DEV) 브라우저로열기(url);

export { server, metaGet };
