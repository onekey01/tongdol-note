/**
 * 현장앱을 **진짜 브라우저에 띄워** 확인합니다.
 *
 *   bun 도구/현장앱시험.ts
 *
 * 우편함은 가짜로 세웁니다 (fetch 를 가로챕니다). 진짜 Supabase 없이
 * **등록 → 여섯자리 → 오늘 갈 곳**까지 한 바퀴를 돌려 봅니다.
 *
 * 여기서 보는 것 —
 *   1. 등록 안 된 폰에 안내가 뜨는가
 *   2. 주소에 표가 실려 오면 등록이 도는가
 *   3. **기관 PC 가 싼 열쇠를 폰이 푸는가**
 *   4. 여섯 자리로 잠그고 다시 여는가 (틀리면 막히는가)
 *   5. **오늘 갈 곳에 이름·주소가 제대로 풀려 나오는가**
 *   6. 저장소에 **맨 열쇠가 남지 않는가**  ← 폰을 주웠을 때
 */
import { chromium, type Page } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { 새열쇠, 싸기, 짐싸기, 키쌍만들기, 싼것풀기 } from "../server/우편함자물쇠";

const 뿌리 = fileURLToPath(new URL("..", import.meta.url));
const 글 = readFileSync(뿌리 + "현장앱/올릴것/index.html", "utf8");

let 통과 = 0, 실패 = 0;
function 본다(무엇: string, ok: boolean, 덧말 = "") {
  if (ok) { 통과++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}

// ── 가짜 우편함이 내줄 것들 ─────────────────────────────────
const 기관열쇠 = 새열쇠();
const 인력번호 = crypto.randomUUID();

// ── 계정으로 들어오기 (v1.7.27) ────────────────────────────
//  사무실 PC 인 척할 열쇠쌍입니다. 폰이 이 공개쪽으로 비밀번호를 싸고,
//  우리가 개인쪽으로 풀어 맞춰 봅니다 — 진짜와 같은 길입니다.
const 기관쌍 = await 키쌍만들기();
const 기관번호 = crypto.randomUUID();
const 폰번호 = crypto.randomUUID();
const 바른아이디 = "bs.park";
const 바른비번 = "해남2026!";
const 사람들 = [
  { 이름: "김복순", 주소: "해남군 해남읍 성내리 12-3", 연락처: "061-534-1234", 서비스: "가사지원" },
  { 이름: "박정자", 주소: "해남군 삼산면 봉학리 45", 연락처: "010-2222-3333", 서비스: "동행지원" },
];

const 오늘 = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

const 브라우저 = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});

/*
 * ★ localhost 로 띄웁니다 ★
 * WebCrypto 는 https 나 localhost 에서만 열립니다.
 * about:blank 나 file:// 에서는 crypto.subtle 이 아예 없습니다.
 */
const 서버 = Bun.serve({
  port: 0,
  fetch: () => new Response(글, { headers: { "content-type": "text/html; charset=utf-8" } }),
});
const 주소 = `http://localhost:${서버.port}/`;

const 쪽: Page = await (await 브라우저.newContext()).newPage();
const 콘솔오류: string[] = [];
쪽.on("pageerror", (e) => 콘솔오류.push(e.message));

/** 폰이 올린 공개쪽을 받아 두었다가, 기관 PC 인 척 열쇠를 싸서 돌려줍니다. */
async function 가짜우편함붙이기(p: Page) {
  await p.route("**/auth/v1/**", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      /*
       * ★ 한글로 만들면 안 됩니다 ★
       * 표딱지는 HTTP 머리말(Authorization)에 실립니다. 머리말에는
       * ISO-8859-1 밖의 글자를 못 씁니다. 진짜 표딱지는 영문·숫자입니다.
       * (처음에 한글로 썼다가 여기서 걸렸습니다.)
       */
      body: JSON.stringify({
        access_token: "fake-access-token-" + Date.now(),
        refresh_token: "fake-refresh-token",
        // 폰이 「내가 누구인지」를 알아야 자기 이름으로 요청을 냅니다.
        user: { id: 폰번호 },
      }),
    });
  });

  let 올라온공개쪽: string | null = null;
  let 온표식: any = null;
  (globalThis as any).__표식보기 = () => 온표식;

  // ── 기관 목록 — 폰이 어디로 여쭐지 고릅니다 ──
  await p.route("**/rest/v1/org?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify([{ id: 기관번호, name: "해남 시험 복지관",
                              pub_key: 기관쌍.공개 }]) });
  });

  /*
   * ── 로그인 요청 — 사무실 PC 가 하는 일을 그대로 흉내 냅니다 ──
   *
   * ★ 흉내는 **진짜만큼 깐깐해야** 합니다. 여기서 아무 비밀번호나
   *   통과시키면 시험은 늘 초록이고, 정작 현장에서 아무나 들어옵니다.
   *   그래서 진짜처럼 풀어 보고, 맞춰 보고, 틀리면 거절합니다.
   */
  const 요청들 = new Map<string, any>();

  await p.route("**/rest/v1/device_request**", async (route) => {
    const req = route.request();

    if (req.method() === "POST") {
      const 몸 = JSON.parse(req.postData() || "{}");
      // 진짜 우편함이 막는 것: 남의 이름으로는 못 냅니다.
      if (몸.device_user_id !== 폰번호) {
        await route.fulfill({ status: 403, contentType: "application/json",
          body: JSON.stringify({ message: "new row violates row-level security policy" }) });
        return;
      }
      const 번호 = 몸.id || crypto.randomUUID();
      let 답: any = { id: 번호, status: "거절", reason: "아이디나 비밀번호가 맞지 않습니다",
                      answer_enc: null, worker_id: null };
      try {
        const 온것 = JSON.parse(await 싼것풀기(기관쌍.개인, 몸.asked_enc));
        온표식 = 온것.표식 ?? null;
        if (온것.아이디 === 바른아이디 && 온것.비밀번호 === 바른비번 &&
            (온것.공개쪽 || "").length >= 40) {
          답 = { id: 번호, status: "됨", reason: null, worker_id: 인력번호,
                 answer_enc: await 싸기(온것.공개쪽, 기관열쇠) };
        }
      } catch { /* 못 풀면 거절 그대로 */ }
      요청들.set(번호, 답);
      // 진짜 PostgREST 처럼 return=minimal 이면 몸 없이 201 을 돌려줍니다.
      await route.fulfill({ status: 201, contentType: "application/json", body: "" });
      return;
    }

    const m = req.url().match(/id=eq\.([0-9a-fA-F-]{36})/);
    const 줄 = m ? 요청들.get(m[1]) : null;
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(줄 ? [줄] : []) });
  });

  await p.route("**/rest/v1/rpc/register_device", async (route) => {
    const 몸 = JSON.parse(route.request().postData() || "{}");
    올라온공개쪽 = 몸.p_pub_key;
    await route.fulfill({ status: 200, contentType: "application/json",
                          body: JSON.stringify(인력번호) });
  });

  await p.route("**/rest/v1/worker_device**", async (route) => {
    // 기관 PC 가 하는 일: 폰의 공개쪽으로 기관 열쇠를 쌉니다.
    const 싼것 = 올라온공개쪽 ? await 싸기(올라온공개쪽, 기관열쇠) : null;
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(싼것 ? [{ worker_id: 인력번호, wrapped_key: 싼것 }] : []) });
  });

  /*
   * 오늘치와 **앞날치**를 모두 내줍니다.
   * 진짜 우편함처럼 `served_on` 조건을 보고 걸러야 합니다 —
   * 무르게 만들면 「이번 주 화면이 오늘 것만 보여도」 통과합니다.
   */
  const 내일 = (() => {
    const d = new Date(`${오늘}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-` +
           `${String(d.getDate()).padStart(2, "0")}`;
  })();

  await p.route("**/rest/v1/job**", async (route) => {
    const url = route.request().url();
    const 다: { 날: string; 사람: any }[] = [
      ...사람들.map((사람) => ({ 날: 오늘, 사람 })),
      { 날: 내일, 사람: { 이름: "내일어르신", 주소: "해남군 화산면 1", 서비스: "가사지원" } },
    ];

    const eq = url.match(/served_on=eq\.([0-9-]+)/);
    const gte = url.match(/served_on=gte\.([0-9-]+)/);
    const lte = url.match(/served_on=lte\.([0-9-]+)/);
    const 고른것 = 다.filter((x) =>
      eq ? x.날 === eq[1]
        : (!gte || x.날 >= gte[1]) && (!lte || x.날 <= lte[1]));

    const 줄들 = await Promise.all(고른것.map(async (x, i) => ({
      id: `job-${x.날}-${i}`, served_on: x.날,
      payload_enc: await 짐싸기(기관열쇠, x.사람),
    })));
    await route.fulfill({ status: 200, contentType: "application/json",
                          body: JSON.stringify(줄들) });
  });
}

try {
  await 가짜우편함붙이기(쪽);

  console.log("\n── 1. 등록 안 된 폰 ────────────────────────────────\n");
  await 쪽.goto(주소);
  await 쪽.waitForSelector("#본문 h1");
  본다("들어가기 화면이 뜬다", (await 쪽.textContent("#본문 h1"))!.includes("들어가기"));
  본다("기관이 채워진다",
       (await 쪽.textContent("#본문"))!.includes("해남 시험 복지관"));
  본다("WebCrypto 가 열린다", (await 쪽.evaluate(() => typeof crypto?.subtle)) === "object");
  /*
   * ★ 브라우저를 탓하는 말이 없어야 합니다 ★
   *   한때 「카카오톡 안에서 열지 마세요」라는 빨간 칸을 띄웠습니다.
   *   무무가 물렸습니다 — 「앱 실행을 브라우저로 제한하면 안돼.」
   *   되살아나면 여기서 걸립니다.
   */
  본다("★ 브라우저를 제한하는 말이 없다",
       !(await 쪽.textContent("#본문"))!.includes("여기서 등록하시면 안 됩니다"));

  console.log("\n── 1-2. 아이디·비밀번호로 들어가기 ★ ───────────────\n");
  /*
   * 여기가 이번 버전의 고갱이입니다. 브라우저를 바꿔도, 폰을 바꿔도
   * 사무실에 다시 오지 않고 들어갈 수 있어야 합니다.
   */
  await 쪽.fill("#아이디칸", 바른아이디);
  await 쪽.fill("#비번칸", "틀린비번");
  await 쪽.click("#들어가기단추");
  await 쪽.waitForSelector("text=들어가지 못했습니다", { timeout: 30000 });
  const 막힌말 = (await 쪽.textContent("#본문"))!;
  본다("★ 틀린 비밀번호는 막는다", true);
  /*
   * ★ 「그런 아이디가 없습니다」와 「비밀번호가 틀렸습니다」를 갈라 주면
   *   맞혀 보는 사람에게 어느 쪽이 맞았는지 알려 주는 셈입니다.
   */
  본다("★ 어느 쪽이 틀렸는지 안 알려 준다",
       막힌말.includes("아이디나 비밀번호가 맞지 않습니다"));
  본다("★ 비밀번호가 화면에 안 남는다", !막힌말.includes("틀린비번"));

  await 쪽.click("text=다시 해 보기");
  await 쪽.waitForSelector("#들어가기단추", { timeout: 20000 });
  await 쪽.fill("#아이디칸", 바른아이디);
  await 쪽.fill("#비번칸", 바른비번);
  await 쪽.click("#들어가기단추");
  await 쪽.waitForSelector("#p1", { timeout: 30000 });
  본다("★ 바른 아이디·비밀번호로 들어간다", true);
  본다("★ 사무실이 싼 열쇠를 폰이 풀었다", true, "여섯 자리를 묻는다는 것이 그 증거");
  const 저장전 = await 쪽.evaluate(() => localStorage.getItem("통돌.기기"));
  본다("★ 아직 저장 전이다 (여섯 자리를 정해야 저장)", !저장전);

  /*
   * ★ 표식이 실제로 만들어져 올라왔나 (2026-09-05) ★
   *   비어 있으면 「브라우저만 바뀐 것은 조용히」가 통째로 죽습니다 —
   *   모르면 알리는 쪽이라 **늘** 알림이 뜹니다.
   */
  const 온표 = (globalThis as any).__표식보기?.();
  본다("★ 기기 표식이 올라온다", !!온표 && typeof 온표 === "object",
       온표 ? JSON.stringify(온표) : "(없음)");
  본다("★ 화면 크기가 0 이 아니다",
       !!온표?.화면 && !/^0x|x0$/.test(온표.화면), 온표?.화면 ?? "(없음)");
  본다("★ 바탕을 알아본다", !!온표?.바탕 && 온표.바탕 !== "기타", 온표?.바탕 ?? "(없음)");

  // 다음 절(QR 등록)을 위해 이 폰을 처음 상태로 되돌립니다.
  await 쪽.evaluate(() => localStorage.clear());

  console.log("\n── 2. 주소로 들어온 등록표 ─────────────────────────\n");
  /*
   * 휴대폰 카메라로 QR 을 찍으면 브라우저가 **새로 엽니다.**
   * goto 로 '#' 뒤만 바꾸면 화면이 새로 안 열리므로 reload 로 그 상황을 만듭니다.
   * (앱에도 hashchange 를 달아 두었으니 어느 쪽이든 돕니다.)
   */
  await 쪽.goto(주소 + "#표=시험용등록표1234");
  await 쪽.reload();
  try {
    await 쪽.waitForSelector("#p1", { timeout: 20000 });
  } catch {
    // 무엇이 막혔는지 화면에 뜬 말을 그대로 보여 줍니다
    console.log("    화면에 뜬 것 ▶ " + (await 쪽.textContent("#본문"))?.replace(/\s+/g, " ").trim());
    throw new Error("등록이 여섯 자리까지 못 갔습니다");
  }
  본다("등록이 돌아 여섯 자리를 묻는다", true);
  본다("★ 기관 PC 가 싼 열쇠를 폰이 풀었다", true, "여기까지 왔다는 것이 그 증거");

  console.log("\n── 3. 여섯 자리 정하기 ─────────────────────────────\n");
  await 쪽.fill("#p1", "246813");
  await 쪽.fill("#p2", "246812");
  await 쪽.click("#정함");
  본다("두 번 넣은 것이 다르면 막는다",
       (await 쪽.textContent("#말"))!.includes("다릅니다"));

  await 쪽.fill("#p1", "111111"); await 쪽.fill("#p2", "111111");
  await 쪽.click("#정함");
  본다("너무 쉬운 숫자를 막는다", (await 쪽.textContent("#말"))!.includes("쉬운"));

  await 쪽.fill("#p1", "246813"); await 쪽.fill("#p2", "246813");
  await 쪽.click("#정함");
  /*
   * 여섯 자리를 푸는 데 **일부러** 시간이 걸리게 해 두었습니다(60만 번).
   * 그래서 화면이 바뀌기를 기다려야 합니다 — 있던 h1 을 기다리면
   * 아직 안 바뀐 화면을 보게 됩니다. (여기서 한 번 걸렸습니다.)
   */
  await 쪽.waitForSelector("text=등록이 끝났습니다", { timeout: 30000 });
  본다("정하면 끝났다고 알린다", true, "여섯 자리 잠그기가 끝날 때까지 기다림");
  본다("주소에서 표가 지워진다", !(await 쪽.evaluate(() => location.hash)));

  console.log("\n── 4. 저장소를 들여다봅니다 ★ ──────────────────────\n");
  const 저장된 = await 쪽.evaluate(() => localStorage.getItem("통돌.기기"));
  본다("저장된 것이 있다", !!저장된);
  본다("★ 맨 기관 열쇠가 안 남았다", !저장된!.includes(기관열쇠));
  본다("★ 사람 이름이 안 남았다", !사람들.some((p) => 저장된!.includes(p.이름)));
  본다("여섯 자리가 안 남았다", !저장된!.includes("246813"));

  console.log("\n── 5. 오늘 갈 곳 ───────────────────────────────────\n");
  await 쪽.click("text=오늘 갈 곳 보기");
  await 쪽.waitForSelector(".사람", { timeout: 20000 });
  const 본글 = await 쪽.textContent("#본문");
  본다("두 곳이 나온다", (await 쪽.locator(".사람").count()) === 2);
  본다("이름이 풀려 나온다", 본글!.includes("김복순") && 본글!.includes("박정자"));
  /*
   * 주소와 연락처는 **목록이 아니라 그 집 화면**에 있습니다.
   * 목록에는 이름과 서비스만 둡니다 — 화면 차례를 2026-09-05 에
   * 그렇게 다시 지었습니다(무무 지시). 그래서 눌러 들어가서 봅니다.
   */
  await 쪽.locator(".사람").first().click();
  await 쪽.waitForSelector("text=서비스 시작", { timeout: 20000 });
  const 집글 = await 쪽.textContent("#본문");
  본다("주소가 풀려 나온다", 집글!.includes("성내리 12-3"));
  본다("전화를 누를 수 있다",
       (await 쪽.getAttribute("a.전화", "href")) === "tel:0615341234");
  await 쪽.click("text=오늘 갈 곳으로");
  await 쪽.waitForSelector(".사람", { timeout: 20000 });

  console.log("\n── 6. 잠갔다 다시 열기 ─────────────────────────────\n");
  await 쪽.click("text=잠그고 나가기");
  await 쪽.waitForSelector("#p");
  await 쪽.fill("#p", "999999");
  await 쪽.waitForSelector("#말:not(:empty)", { timeout: 20000 });
  본다("틀린 여섯 자리를 막는다", (await 쪽.textContent("#말"))!.includes("틀렸"));
  본다("몇 번 남았는지 알려 준다", (await 쪽.textContent("#말"))!.includes("남았"));

  await 쪽.fill("#p", "246813");
  await 쪽.waitForSelector(".사람", { timeout: 20000 });
  본다("맞는 여섯 자리로 열린다", (await 쪽.locator(".사람").count()) === 2);

  console.log("\n── 7. 새로 켰을 때 ─────────────────────────────────\n");
  await 쪽.reload();
  await 쪽.waitForSelector("#p", { timeout: 20000 });
  본다("다시 켜면 여섯 자리를 묻는다", true);
  await 쪽.fill("#p", "246813");
  await 쪽.waitForSelector(".사람", { timeout: 20000 });
  본다("그대로 열린다 (표딱지가 살아 있다)", (await 쪽.locator(".사람").count()) === 2);

  console.log("\n── 8. 저절로 잠기나 ───────────────────────────────\n");
  {
    /*
     * 10분을 기다릴 수는 없으니, 앱이 쓰는 시간을 3초로 줄여 놓고 봅니다.
     * 「잠그기 단추만 두면 아무도 안 누른다」가 이 기능을 넣은 까닭입니다.
     */
    await 쪽.evaluate(() => {
      // @ts-ignore — 앱 안의 값입니다
      놀린시간 = 3000; 시계다시();
    });
    await 쪽.waitForSelector("#p", { timeout: 20000 });
    본다("놀려 두면 저절로 잠긴다", true);
    본다("왜 잠겼는지 알려 준다",
         (await 쪽.textContent("#본문"))!.includes("안 쓰셔서"));
  }

  console.log("\n── 9. 앱을 새로 올려도 등록이 살아 있나 ★ ──────────\n");
  {
    /*
     * ★ 현장에서 가장 중요한 성질입니다 ★
     *
     * 앱을 고쳐 새로 올릴 때마다 제공인력 열 명을 사무실로 부를 수는 없습니다.
     * 그래서 **파일이 바뀌어도 등록은 살아 있어야** 합니다.
     *
     * 살아 있는 이유 — 폰에 잠가 둔 것은 **주소(origin)마다** 따로 보관됩니다.
     * 같은 주소에 새 파일을 올리면 보관함은 그대로입니다.
     * 반대로 **주소가 바뀌면** 그 보관함에 손이 닿지 않아 처음처럼 보입니다.
     *
     * 아래에서 둘 다 확인합니다.
     */

    // (가) 같은 주소에 **다른 파일**을 올린 셈 치고 — 등록이 살아 있어야 합니다
    await 쪽.goto(주소);
    await 쪽.waitForSelector("#p", { timeout: 20000 });
    본다("같은 주소면 새 파일이어도 여섯 자리만 묻는다", true);
    await 쪽.fill("#p", "246813");
    await 쪽.waitForSelector(".사람", { timeout: 20000 });
    본다("★ 앱을 새로 올려도 등록이 살아 있다", (await 쪽.locator(".사람").count()) === 2,
         "사무실로 다시 부를 필요 없음");

    // (나) **주소가 바뀌면** — 처음처럼 보여야 합니다
    const 다른곳 = Bun.serve({ port: 0,
      fetch: () => new Response(글, { headers: { "content-type": "text/html; charset=utf-8" } }) });
    await 쪽.goto(`http://localhost:${다른곳.port}/`);
    await 쪽.waitForSelector("#본문 h1", { timeout: 20000 });
    /*
     * 예전에는 이것이 **큰일**이었습니다 — 주소가 바뀌면 제공인력 전원이
     * 사무실에 다시 와서 QR 을 찍어야 했으니까요. 이제는 그 자리에서
     * 아이디·비밀번호로 다시 들어가면 됩니다. 그래도 주소는 함부로
     * 바꾸지 않는 것이 맞습니다 — 전원이 한 번씩 다시 들어가야 하니까요.
     */
    본다("★ 주소가 바뀌면 처음처럼 보인다",
         (await 쪽.textContent("#본문 h1"))!.includes("들어가기"),
         "이제는 사무실에 안 와도 아이디·비밀번호로 다시 들어갑니다");
    다른곳.stop();

    // 옛 주소로 돌아오면 다시 살아 있어야 합니다 (지워진 것이 아니라 못 본 것)
    await 쪽.goto(주소);
    await 쪽.waitForSelector("#p", { timeout: 20000 });
    본다("옛 주소로 돌아오면 그대로 있다", true, "지워진 것이 아니라 주소가 달랐던 것");
  }

  // ══ 앞날 일정 — 이번 주 · 이번 달 ★ ══════════════════════
  console.log("\n── 10. 이번 주 · 이번 달 ★ ─────────────────────────\n");
  /*
   * 지금까지 폰에는 오늘치만 보였습니다. 「내일 어디 가지」를 알려면
   * 사무실에 전화해야 했습니다.
   * (2026-09-05 무무 — 「본인에게 할당 된 당일일정과 주간일정, 월간일정」)
   */
  {
    await 쪽.goto(주소);
    await 쪽.waitForSelector("#p", { timeout: 20000 });
    await 쪽.fill("#p", "246813");
    await 쪽.waitForSelector(".사람", { timeout: 20000 });

    본다("★ 오늘·이번 주·이번 달 띠가 있다",
      (await 쪽.locator(".띠칸").count()) === 3,
      (await 쪽.locator(".띠칸").allInnerTexts()).join(" · "));
    본다("지금은 「오늘」이 골라져 있다",
      (await 쪽.locator(".띠칸.고름").innerText()).includes("오늘"));

    await 쪽.locator(".띠칸", { hasText: "이번 주" }).click();
    await 쪽.waitForSelector(".앞날날", { timeout: 20000 });
    const 주글 = await 쪽.textContent("#본문");
    본다("★ 이번 주 화면이 열린다", 주글!.includes("이번 주"));
    본다("★ 내일 일정이 보인다", 주글!.includes("내일어르신"),
      "오늘치만 보이면 이 시험이 걸립니다");
    본다("오늘 것도 같이 보인다", 주글!.includes("김복순"));
    본다("★ 오늘 날짜에 「오늘」 딱지가 붙는다",
      (await 쪽.locator(".앞날날머리 .딱지").count()) >= 1);

    /*
     * ★ 앞날 화면은 **보기만** 합니다. 내일 것을 미리 찍어 두면
     *   진행시간이 통째로 거짓이 됩니다.
     */
    본다("★ 앞날 화면에서는 못 찍는다",
      !주글!.includes("서비스 시작") && (await 쪽.locator(".사람.누름").count()) === 0,
      "찍는 것은 오늘 화면에서만");
    본다("보기만 하는 화면이라고 말해 준다", 주글!.includes("보기만 하는 화면"));

    await 쪽.locator(".띠칸", { hasText: "이번 달" }).click();
    await 쪽.waitForSelector(".앞날날", { timeout: 20000 });
    본다("★ 이번 달 화면도 열린다",
      (await 쪽.textContent("#본문"))!.includes("이번 달"));

    await 쪽.locator("button", { hasText: "오늘로 돌아가기" }).click();
    await 쪽.waitForSelector(".사람.누름", { timeout: 20000 });
    본다("오늘로 돌아온다", (await 쪽.locator(".사람.누름").count()) === 2);
  }

  본다("화면에 오류가 안 났다", 콘솔오류.length === 0, 콘솔오류.join(" / ") || "없음");
} catch (e) {
  실패++;
  console.log(`\n✗ 실패  ${(e as Error).message}`);
} finally {
  await 브라우저.close();
  서버.stop();
}

console.log(`\n${"─".repeat(52)}\n  ${통과 + 실패}가지 중 ${통과}가지 통과, ${실패}가지 실패\n`);
process.exit(실패 ? 1 : 0);
