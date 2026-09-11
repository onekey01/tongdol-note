/**
 * 방문 찍기 시험 —  bun 도구/찍기시험.ts
 *
 * ── 왜 이렇게까지 하나 ──────────────────────────────────────
 *
 * 「QR 을 읽는다」는 것은 브라우저와 카메라가 실제로 도는 일입니다.
 * 함수를 따로 불러 보는 시험으로는 **안 읽히는 것을 못 잡습니다.**
 * 그래서 진짜 브라우저를 띄우고, **가짜 카메라에 진짜 방문표 영상을
 * 물려서** 앱이 눈으로 읽게 합니다.
 *
 *   방문표 QR 그림  →  영상(y4m)  →  크로미움의 가짜 카메라
 *                                  →  앱의 찍기 화면이 읽음
 *
 * ── 여기서 보는 것 ─────────────────────────────────────────
 *
 *   1. 목록은 **이름만** 보이고, 눌러야 그 집으로 들어가는가
 *   2. 시작을 찍으면 시각이 적히는가
 *   3. ★ 확인사항이 **서비스마다 다른가** (서식3 · 4 · 5)
 *   4. 끝을 찍고 **서명**까지 받아지는가
 *   5. 적은 것이 **껐다 켜도 남아 있는가** (폰이 꺼져도 남아야 합니다)
 *   6. ★ 옆집 방문표는 물리치고, **누구 집인지 말해 주는가**
 *   7. 나갈 때 **카메라가 꺼지는가** (주머니 속에서 계속 찍으면 안 됩니다)
 *
 * ★ https 나 localhost 가 아니면 crypto.subtle 이 없습니다.
 *   그래서 localhost 로 띄웁니다.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { 새열쇠, 싸기, 짐싸기, 짐풀기, 덩이풀기 } from "../server/우편함자물쇠";

const 뿌리 = fileURLToPath(new URL("..", import.meta.url));
const 글 = readFileSync(뿌리 + "현장앱/올릴것/index.html", "utf8");

const 기관열쇠 = 새열쇠();
const 인력번호 = crypto.randomUUID();
const 기관번호 = crypto.randomUUID();
const 오늘 = new Date().toISOString().slice(0, 10);

const 갑표 = "AAAA1111bbbb2222cccc33";
const 을표 = "ZZZZ9999yyyy8888xxxx77";
const 병표 = "MMMM5555nnnn4444oooo11";
const 사람들 = [
  /*
   * 김복순 님만 `계획분` 이 있습니다 — 90분짜리 가사지원.
   * 시험이 시작하고 몇 초 만에 끝을 찍으니 **늘 미달**입니다.
   * 그래서 「계획된 서비스 제공시간을 충족하지 못하였습니다」가
   * 반드시 떠야 합니다 (3-1).
   *
   * 나머지 두 분은 `계획분` 이 없습니다 — 사무실이 요일에 분을
   * 안 적어 둔 배정입니다. **그런 집에서는 물으면 안 됩니다.**
   */
  { 이름: "김복순", 주소: "해남군 해남읍 성내리 12-3", 연락처: "061-534-1234",
    서비스: "가사지원", 메모: "대문 옆 초인종 고장", 집표: 갑표, 갈래: "가사",
    계획분: 90 },
  { 이름: "박정자", 주소: "해남군 삼산면 봉학리 45", 연락처: "010-2222-3333",
    서비스: "동행지원", 메모: "", 집표: 을표, 갈래: "동행" },
  { 이름: "이말순", 주소: "해남군 문내면 우수영로 88", 연락처: "061-533-7788",
    서비스: "식사지원", 메모: "", 집표: 병표, 갈래: "식사" },
];

/** 시험에 쓸 「전달사진」 — 4000×3000 짜리 큰 원본입니다. */
const 큰사진 = "data:image/jpeg;base64," +
  (await Bun.file(뿌리 + "도구/시험사진.b64").text()).trim();

/** 폰이 우편함에 올린 보고들. 시험이 뜯어 봅니다. */
const 보낸것: any[] = [];
/** 올라간 사진 — 잠긴 덩어리 그대로. 여기서 풀어 봅니다. */
const 올린사진: { 길: string; 덩이: Buffer }[] = [];
const 사진표: any[] = [];
/** 켜 두면 사진 올리기만 실패합니다 (보고는 갑니다). 3-4 에서 씁니다. */
let 사진막기 = false;

/*
 * 할일번호는 실제로 **UUID 꼴**입니다(할일보내기.할일번호).
 * 시험에서 「할일-0」 같은 것을 쓰면, 보고번호를 UUID 꼴로 만드는
 * 자리가 그냥 지나가서 **시험이 아무것도 안 봅니다.**
 * 가짜도 진짜처럼 생겨야 합니다.
 */
const 할일번호들 = 사람들.map(() => crypto.randomUUID());

let 통과수 = 0, 실패수 = 0;
function 맞아야(무엇: string, 참인가: boolean, 곁들임 = "") {
  if (참인가) { 통과수++; console.log(`  통과  ${무엇}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${곁들임 ? "\n          " + 곁들임 : ""}`); }
}
function 같아야(무엇: string, 실제: unknown, 바람: unknown) {
  맞아야(무엇, 실제 === 바람, `나온 것 ${JSON.stringify(실제)} · 바란 것 ${JSON.stringify(바람)}`);
}

/**
 * QR 그림을 **카메라에 물릴 영상**으로 만듭니다.
 *
 * 크로미움의 가짜 카메라는 y4m 을 먹습니다. 종이를 손에 들고 대는 것을
 * 흉내 내려고, 흰 바탕 가운데에 QR 을 놓고 조금 여백을 둡니다.
 */
async function 영상만들기(글자: string, 낼곳: string) {
  const png = "/tmp/siheom-qr.png";
  await QRCode.toFile(png, 글자, { errorCorrectionLevel: "H", margin: 4, width: 480, type: "png" });
  await Bun.$`ffmpeg -y -loop 1 -i ${png} -t 2 -r 10 -vf scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:-1:-1:color=white -pix_fmt yuv420p ${낼곳}`.quiet();
}

await Bun.$`mkdir -p ${뿌리}현장앱/그림`.quiet();
/*
 * ★ 영상 파일 이름을 **영문으로** 짓습니다.
 *   크로미움에 `--use-file-for-fake-video-capture=…` 로 넘기는 값인데,
 *   한글 이름을 주면 「Could not start video source」로 카메라가 안 열립니다.
 *   (2026-09-04. `.bat` 에 한글을 못 쓰는 것과 같은 갈래의 일입니다.)
 */
const 갑영상 = "/tmp/qr-a.y4m";
const 을영상 = "/tmp/qr-b.y4m";
const 딴영상 = "/tmp/qr-other.y4m";
await 영상만들기("TDV1:" + 갑표, 갑영상);
await 영상만들기("TDV1:" + 을표, 을영상);
await 영상만들기("https://example.com/우유", 딴영상);   // 냉장고에 붙은 아무 QR

const 서버 = Bun.serve({ port: 0,
  fetch: () => new Response(글, { headers: { "content-type": "text/html; charset=utf-8" } }) });
const 주소 = `http://localhost:${서버.port}/`;

/** 그 영상을 문 카메라로 브라우저를 엽니다. */
async function 브라우저열기(영상: string) {
  return chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-fake-ui-for-media-stream",
           "--use-fake-device-for-media-stream",
           `--use-file-for-fake-video-capture=${영상}`],
  });
}

/** 우편함을 흉내 냅니다 — 실제 Supabase 에 붙지 않습니다. */
async function 우편함흉내(쪽: any) {
  쪽.on("pageerror", (e: any) => console.log("  [앱오류]", e.message));
  let 공개쪽: string | null = null;
  /*
   * ★ 가짜 표딱지를 **한글로 지으면 안 됩니다.**
   *   표딱지는 `Authorization` 머리에 실리는데, HTTP 머리에는
   *   ISO-8859-1 밖의 글자가 못 들어갑니다. 처음에 「가짜표딱지」라고
   *   지었다가 등록이 통째로 안 됐습니다 (2026-09-04). 앱 잘못이 아니라
   *   시험 잘못이었습니다 — **가짜도 진짜처럼 생겨야** 합니다.
   */
  await 쪽.route("**/auth/v1/**", (r: any) => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ access_token: "fake.access.token", refresh_token: "fake-refresh-token" }) }));
  await 쪽.route("**/rest/v1/rpc/register_device", (r: any) => {
    공개쪽 = JSON.parse(r.request().postData() || "{}").p_pub_key;
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(인력번호) });
  });
  await 쪽.route("**/rest/v1/worker_device**", async (r: any) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify(공개쪽
      ? [{ worker_id: 인력번호, org_id: 기관번호, wrapped_key: await 싸기(공개쪽, 기관열쇠) }]
      : []) }));
  /* 사진 파일이 올라가는 자리 (Storage) */
  await 쪽.route("**/storage/v1/object/**", async (r: any) => {
    /*
     * `사진막기` 를 켜 두면 **사진만** 실패합니다 — 보고는 잘 갑니다.
     * 신호가 약해 큰 것만 못 올라가는 실제 상황을 흉내 냅니다 (3-4).
     */
    if (사진막기) {
      return r.fulfill({ status: 500, contentType: "application/json",
                         body: JSON.stringify({ message: "storage down" }) });
    }
    const 길 = decodeURIComponent(r.request().url().split("/object/")[1]);
    올린사진.push({ 길, 덩이: r.request().postDataBuffer() as Buffer });
    return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  /* 사진이 어디 있는지 적는 표 */
  await 쪽.route("**/rest/v1/photo**", async (r: any) => {
    const 몸 = JSON.parse(r.request().postData() || "{}");
    const 탈 = 칸보기("photo", 몸);
    if (탈) return r.fulfill({ status: 400, contentType: "application/json",
                              body: JSON.stringify({ message: 탈 }) });
    사진표.push(몸);
    return r.fulfill({ status: 201, contentType: "application/json", body: "" });
  });
  /*
   * 사무실로 보내는 자리. 무엇이 올라갔는지 붙잡아 둡니다 —
   * 「보냈다고 화면에 뜨는가」가 아니라 **정말 올라갔는가**를 봐야 합니다.
   */
  /*
   * ★ 흉내 우편함이 **진짜보다 너그러우면 안 됩니다.**
   *
   * 처음에는 무엇이 오든 201 을 돌려줬습니다. 그래서 폰이 `org_id` 를
   * 안 실어 보내는 것을 시험이 못 잡았고, 현장에서 「신호가 되는 곳에서
   * 다시 눌러 주세요」만 뜨는 채로 나갔습니다 (2026-09-05 무무가 발견).
   *
   * 진짜 우편함에서 **비면 안 되는 칸**은 여기서도 막습니다.
   */
  const 꼭있어야 = {
    report: ["id", "job_id", "org_id", "worker_id", "payload_enc"],
    photo: ["id", "report_id", "org_id", "path"],
  };
  const 칸보기 = (표: "report" | "photo", 몸: any) => {
    const 빈것 = 꼭있어야[표].filter((k) => 몸[k] === undefined || 몸[k] === null || 몸[k] === "");
    return 빈것.length ? `null value in column "${빈것[0]}" violates not-null constraint` : null;
  };

  await 쪽.route("**/rest/v1/report**", async (r: any) => {
    const 몸 = JSON.parse(r.request().postData() || "{}");
    const 탈 = 칸보기("report", 몸);
    if (탈) return r.fulfill({ status: 400, contentType: "application/json",
                              body: JSON.stringify({ message: 탈 }) });
    보낸것.push(몸);
    return r.fulfill({ status: 201, contentType: "application/json", body: "" });
  });
  await 쪽.route("**/rest/v1/job**", async (r: any) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify(await Promise.all(사람들.map(async (p, i) => ({
      id: 할일번호들[i], served_on: 오늘, payload_enc: await 짐싸기(기관열쇠, p) })))) }));
}

/** 등록 → 6자리 → 오늘 갈 곳까지 한 번에. */
async function 오늘까지가기(쪽: any) {
  await 쪽.goto(주소 + "#표=시험표");
  try { await 쪽.waitForSelector("#p1", { timeout: 25000 }); }
  catch (e) { console.log("  [화면]", (await 쪽.locator("body").innerText()).slice(0, 400)); throw e; }
  await 쪽.fill("#p1", "246813"); await 쪽.fill("#p2", "246813");
  await 쪽.click("#정함");
  await 쪽.waitForSelector("text=등록이 끝났습니다", { timeout: 30000 });
  await 쪽.click("text=오늘 갈 곳 보기");
  await 쪽.waitForSelector(".사람", { timeout: 20000 });
}

const 찍기 = (쪽: any, 이름: string) =>
  쪽.screenshot({ path: `${뿌리}현장앱/그림/${이름}.png`, fullPage: true });

/* ═══ 1. 목록 → 집 화면 → 시작 찍기 ══════════════════════════ */
console.log("\n── 1. 목록에서 눌러 들어가 시작을 찍는다 ─────────────\n");
const 브1 = await 브라우저열기(갑영상);
const 버전1 = await 브1.newContext({ viewport: { width: 390, height: 844 },
  permissions: ["camera"], deviceScaleFactor: 2 });
const 쪽 = await 버전1.newPage();
await 우편함흉내(쪽);
await 오늘까지가기(쪽);

맞아야("목록에 세 줄이 뜸", (await 쪽.locator(".사람").count()) === 3);
맞아야("★ 목록에는 찍기 단추가 없음 (이름만)",
  !(await 쪽.locator("text=시작 찍기").first().isVisible().catch(() => false)));
맞아야("서비스 이름이 줄마다 붙음",
  await 쪽.locator("text=가사지원").first().isVisible());
await 찍기(쪽, "6-오늘갈곳");

await 쪽.locator(".사람").first().click();          // 김복순 · 가사지원
await 쪽.waitForSelector("text=서비스 시작", { timeout: 15000 });
맞아야("★ 사람을 누르면 그 집 화면으로 들어감", true);
맞아야("주소가 보임", await 쪽.locator("text=성내리").isVisible());
맞아야("메모가 보임", await 쪽.locator("text=초인종").isVisible());
맞아야("어느 서식인지 알려 줌", await 쪽.locator("text=서식3").isVisible());
await 찍기(쪽, "7-집화면");

await 쪽.click("text=서비스 시작");
await 쪽.waitForSelector("#눈", { timeout: 15000 });
await 쪽.waitForSelector("text=시작을 찍었습니다", { timeout: 25000 });
맞아야("★ 방문표를 읽고 시작 시각을 적음", true);
await 찍기(쪽, "8-시작찍음");

/* ═══ 2. 확인사항 — 서식3 가사지원 ═══════════════════════════ */
console.log("\n── 2. 확인사항 · 서식3 가사지원 ──────────────────────\n");
await 쪽.click("text=확인사항 적기");
await 쪽.waitForSelector("text=오늘 해 드린 것", { timeout: 15000 });
맞아야("★ 편람 열한 가지가 다 나옴",
  (await 쪽.locator(".칸고름").count()) === 11);
for (const 것 of ["청소", "세탁", "말벗"])
  맞아야(`「${것}」이 있음`, await 쪽.locator(`text=${것}`).first().isVisible());

await 쪽.locator('.칸고름:has-text("청소") input').check();
await 쪽.locator('.칸고름:has-text("세탁") input').check();
await 쪽.fill("#기타한것", "약 봉투 정리");
await 쪽.fill("#특이", "무릎이 아프시다고 하셔서 외출은 다음으로 미뤘습니다.");
await 쪽.waitForTimeout(700);                        // 늦게적기(400ms) 가 돌 틈
맞아야("고른 개수가 화면에 보임",
  (await 쪽.locator("#몇가지").textContent() || "").includes("2가지"));

/* ── 사진 ─────────────────────────────────────────────────── */
console.log("\n── 2-2. 사진 넣기 ────────────────────────────────────\n");
맞아야("사진 칸이 있음", await 쪽.locator("text=사진").first().isVisible());
맞아야("원본이 폰에 남는다고 알려 줌",
  (await 쪽.locator("body").innerText()).includes("원본은 휴대폰에 그대로 남습니다"));

/*
 * ★ 사진을 어떻게 넣나 —
 *
 * `setInputFiles` 가 이 컨테이너의 크로미움에서 **아무것도 안 넣습니다**
 * (영문 id 로도 안 됩니다 — 시험 도구 쪽 한계입니다).
 * 그래서 브라우저 안에서 진짜 File 을 만들어 칸에 넣고 change 를 쏩니다.
 * 사람이 사진을 고른 뒤 일어나는 일은 **그대로 다 돕니다** —
 * 못 보는 것은 폰의 사진 고르는 창뿐인데, 그건 어차피 못 봅니다.
 */
await 쪽.evaluate(async (그림: string) => {
  const 몸통 = await (await fetch(그림)).blob();
  const 통 = new DataTransfer();
  for (let i = 0; i < 2; i++)
    통.items.add(new File([몸통], `사진${i}.jpg`, { type: "image/jpeg" }));
  const 칸 = document.getElementById("사진고르기") as HTMLInputElement;
  칸.files = 통.files;
  칸.dispatchEvent(new Event("change"));
}, 큰사진);
await 쪽.waitForSelector(".사진하나", { timeout: 25000 });
await 쪽.waitForFunction(() => document.querySelectorAll(".사진하나").length === 2,
  null, { timeout: 20000 });
맞아야("★ 두 장이 들어감", (await 쪽.locator(".사진하나").count()) === 2);
맞아야("몇 장인지 세어 줌",
  (await 쪽.locator("text=2 / 4").first().isVisible()));

const 줄인크기 = await 쪽.evaluate(() => {
  const img = document.querySelector(".사진하나 img") as HTMLImageElement;
  return { 글자수: img.src.length, w: img.naturalWidth, h: img.naturalHeight };
});
맞아야(`★ 긴 쪽이 1600 으로 줄어듦 (${줄인크기.w}×${줄인크기.h})`,
  Math.max(줄인크기.w, 줄인크기.h) === 1600);
await 찍기(쪽, "9-확인사항-가사");

// 한 장 빼기
쪽.once("dialog", (d: any) => d.accept());
await 쪽.locator(".사진빼기").first().click();
await 쪽.waitForFunction(() => document.querySelectorAll(".사진하나").length === 1,
  null, { timeout: 15000 });
맞아야("한 장 빼면 한 장 남음", (await 쪽.locator(".사진하나").count()) === 1);

/* ═══ 3. 끝 찍기 → 서명 ═════════════════════════════════════ */
console.log("\n── 3. 끝 찍기 그리고 서명 ────────────────────────────\n");
await 쪽.click("text=다 적었습니다");
await 쪽.waitForSelector("text=서비스 끝", { timeout: 15000 });

/* ── 3-1. ★ 계획한 시간을 못 채웠으면 한 번 묻습니다 ────────
 *
 * 「가사지원·이동지원처럼 **시간에 따라 값이 달라지는** 서비스는
 *   계획보다 짧게 끝내려 할 때 경고가 떠야 한다」 (2026-09-05 무무 지시)
 *
 * 김복순 님은 90분 계획인데 시험은 몇 초 만에 끝냅니다 — 반드시 뜹니다.
 * 두 갈래를 다 봅니다: **아니라고 하면 안 적히고**, 그렇다고 하면 적힙니다.
 */
console.log("\n── 3-1. 계획 시간 미달 경고 ──────────────────────────\n");
{
  let 물음 = "";
  쪽.once("dialog", async (d: any) => { 물음 = d.message(); await d.dismiss(); });
  await 쪽.click("text=서비스 끝");
  await 쪽.waitForSelector("text=서비스 끝", { timeout: 20000 });   // 그 집 화면으로 되돌아옴
  await 쪽.waitForTimeout(400);

  맞아야("★ 계획 시간을 못 채우면 물어봄", 물음.length > 0, JSON.stringify(물음));
  맞아야("★ 무무가 준 문구 그대로",
    물음.includes("계획된 서비스 제공시간을 충족하지 못하였습니다"), JSON.stringify(물음));
  맞아야("★ 몇 분 남았는지 알려 줌", /\(.*남음\)/.test(물음), JSON.stringify(물음));
  맞아야("★ 「정말로 종결 하시겠습니까?」로 물음",
    물음.includes("정말로 종결 하시겠습니까?"), JSON.stringify(물음));
  맞아야("★ 아니라고 하면 종료 시각이 안 적힘",
    await 쪽.locator("text=서비스 끝").first().isVisible(),
    "적혔다면 「서명 받기」 화면으로 넘어갔을 것입니다");
  맞아야("★ 아니라고 해도 시작 시각은 그대로 있음",
    (await 쪽.locator("text=시작").count()) > 0);
}

쪽.once("dialog", (d: any) => d.accept());
await 쪽.click("text=서비스 끝");
await 쪽.waitForSelector("text=끝을 찍었습니다", { timeout: 25000 });
맞아야("★ 종료 시각이 적힘", true);

/* ── 3-2. ★ 끝을 잘못 찍었을 때 되돌리기 ────────────────────
 *
 * 「끝 qr코드를 실수로 찍었을 때 끝qr을 다시 찍을 방법도 없어.」
 * (2026-09-05 무무)
 *
 * 계획 시간 경고가 1차 방어막이라면 이것이 2차입니다. 1차는 사무실이
 * 분을 안 적어 두면 안 뜨지만, 2차는 늘 있어야 합니다.
 */
console.log("\n── 3-2. 끝을 잘못 찍었을 때 되돌리기 ─────────────────\n");
{
  await 쪽.click("text=나중에 받겠습니다");           // 그 집 화면으로
  await 쪽.waitForSelector("text=끝을 잘못 찍었습니다", { timeout: 15000 });
  맞아야("★ 그 집 화면에 「끝을 잘못 찍었습니다」가 있음", true);

  // ① 물어보고, 아니라고 하면 그대로 둡니다.
  let 물음 = "";
  쪽.once("dialog", async (d: any) => { 물음 = d.message(); await d.dismiss(); });
  await 쪽.click("text=끝을 잘못 찍었습니다");
  await 쪽.waitForTimeout(800);
  맞아야("★ 되돌리기 전에 물어봄", 물음.length > 0, JSON.stringify(물음.slice(0, 60)));
  맞아야("★ 시작·적은 것·사진은 그대로 둔다고 알려 줌",
    물음.includes("시작 시각과 적어 두신 것, 사진은 그대로 둡니다"),
    JSON.stringify(물음));
  맞아야("★ 아니라고 하면 종료 시각이 그대로 있음",
    await 쪽.locator("text=이용자 확인서명 받기").first().isVisible(),
    "지워졌다면 「서비스 끝」 화면으로 돌아갔을 것입니다");

  // ② 그렇다고 하면 지워지고, 끝을 다시 찍을 수 있어야 합니다.
  쪽.once("dialog", (d: any) => d.accept());
  await 쪽.click("text=끝을 잘못 찍었습니다");
  await 쪽.waitForSelector("text=서비스 끝", { timeout: 15000 });
  맞아야("★ 되돌리면 「서비스 끝」을 다시 찍을 수 있음", true);
  맞아야("★ 시작 시각은 안 지워짐", (await 쪽.locator("text=시작").count()) > 0);
  맞아야("★ 적어 둔 것도 안 지워짐 — 사진이 그대로 있음",
    await (async () => {
      await 쪽.click("text=확인사항 적기");
      await 쪽.waitForSelector(".사진판", { timeout: 15000 });
      const n = await 쪽.locator(".사진하나").count();
      await 쪽.click("text=다 적었습니다");
      await 쪽.waitForSelector("text=서비스 끝", { timeout: 15000 });
      return n === 1;
    })());

  // ③ 다시 찍습니다. 계획 시간 경고도 다시 떠야 합니다.
  쪽.once("dialog", (d: any) => d.accept());
  await 쪽.click("text=서비스 끝");
  await 쪽.waitForSelector("text=끝을 찍었습니다", { timeout: 25000 });
  맞아야("★ 끝을 다시 찍으면 적힘", true);
  await 쪽.click("text=나중에 받겠습니다");
  await 쪽.waitForSelector("text=이용자 확인서명 받기", { timeout: 15000 });
}

await 쪽.click("text=서명 받기");
await 쪽.waitForSelector("#서명", { timeout: 15000 });
맞아야("서명판이 열림", true);
맞아야("아직 안 그렸으니 단추가 잠겨 있음",
  await 쪽.locator("#다됨").isDisabled());

// 손가락으로 긋는 흉내
const 네모 = await 쪽.locator("#서명").boundingBox();
await 쪽.mouse.move(네모!.x + 40, 네모!.y + 120);
await 쪽.mouse.down();
for (const [dx, dy] of [[30,-50],[30,50],[30,-40],[40,30],[35,-25],[30,20]])
  await 쪽.mouse.move(네모!.x + 40 + dx * 3, 네모!.y + 120 + dy);
await 쪽.mouse.up();
await 쪽.waitForTimeout(200);
맞아야("★ 그으면 단추가 풀림", !(await 쪽.locator("#다됨").isDisabled()));
await 찍기(쪽, "10-서명");

/*
 * 서명을 마치면 **그 집 화면으로 돌아옵니다** (서명 화면에 안 머뭅니다).
 * 그 집 일이 다 끝났으니 다음 집으로 갈 수 있어야 하기 때문입니다.
 */
/*
 * ★ 여기서 **사진만** 못 올라가게 막아 둡니다.
 *   서명을 마치면 앱이 그 자리에서 사무실로 보냅니다. 보고는 가고
 *   사진만 실패하는 상황을 만들어, 아래 3-4 에서 그것이 어떻게
 *   다뤄지는지 봅니다.
 */
사진막기 = true;

await 쪽.click("#다됨");
await 쪽.waitForSelector("text=적은 것 보기", { timeout: 20000 });
맞아야("★ 서명을 마치면 그 집 화면으로 돌아옴", true);
맞아야("서명을 받은 것으로 표시됨",
  await 쪽.locator("text=받았습니다").first().isVisible());

/* ── 서명하면 그 자리에서 사무실로 갑니다 ─────────────────── */
console.log("\n── 3-3. 서명을 마치면 사무실로 보냅니다 ──────────────\n");
/*
 * ★ 「보냈습니다」로만 기다리면 안 됩니다 — **「아직 안 보냈습니다」에도
 *   그 글자가 들어 있습니다.** 그래서 한동안 이 기다림이 늘 곧장
 *   통과했고, 화면이 안 바뀌는 것을 시험이 못 봤습니다.
 */
await 쪽.waitForFunction(() => {
  const t = document.body.innerText;
  return t.includes("보냈습니다") && !t.includes("아직 안 보냈습니다");
}, null, { timeout: 20000 }).catch(() => {});
맞아야("★ 보낸 뒤 화면이 스스로 바뀜 (「아직 안 보냈습니다」가 사라짐)",
  !(await 쪽.locator("body").innerText()).includes("아직 안 보냈습니다"),
  "안 바뀌면 다 보내고도 현장은 안 갔다고 봅니다");
맞아야("★ 보고가 우편함으로 올라감", 보낸것.length === 1,
  `올라간 건수 ${보낸것.length}`);
if (보낸것.length) {
  const b = 보낸것[0];
  맞아야("시작·종료 시각이 실려 있음", !!b.started_at && !!b.ended_at);
  맞아야("방문표를 찍었다고 표시됨 (qr_ok)", b.qr_ok === true);
  맞아야("인력번호가 실려 있음", b.worker_id === 인력번호);
  맞아야("★ 기관번호가 실려 있음 (없으면 우편함이 거절합니다)",
    b.org_id === 기관번호, `나온 것 ${b.org_id}`);
  맞아야("★ 사람에 관한 것은 잠겨서 나감 (맨눈에 안 보임)",
    !JSON.stringify(b).includes("김복순"));
  맞아야("보고 번호가 UUID 꼴", /^[0-9a-f-]{36}$/.test(String(b.id)));
  맞아야("★ 보고 번호가 할일번호에서 나온 것 (다시 보내도 같음)",
    b.id !== b.job_id && b.id.slice(0, 24) === b.job_id.slice(0, 24),
    `보고 ${b.id} · 할일 ${b.job_id}`);
  const 푼것: any = await 짐풀기(기관열쇠, b.payload_enc);
  맞아야("★ 풀면 확인사항이 그대로 들어 있음",
    (푼것.적은것?.한것 ?? []).includes("청소") &&
    (푼것.적은것?.한것 ?? []).includes("세탁"),
    JSON.stringify(푼것.적은것));
  맞아야("★ 특이사항도 실려 있음",
    String(푼것.적은것?.특이사항 ?? "").includes("무릎"));
  맞아야("★ 서명 그림도 실려 있음",
    String(푼것.서명 ?? "").startsWith("data:image/png"));
}

/* ── 보고는 갔는데 사진만 못 간 경우 ───────────────────────── */
console.log("\n── 3-4. ★ 사진만 못 갔을 때 ──────────────────────────\n");
/*
 * ★ **조용히 사진을 잃던 자리**입니다.
 *
 *   예전에는 사진 올리기가 실패하면 그냥 삼키고 「보냄」을 찍었습니다.
 *   그러고 나면 맨 위에서 `기.보냄` 이라고 곧장 돌아가 버려 다시 보낼
 *   길이 없었습니다. 화면은 초록으로 「보냈습니다」, 사무실 제공실적의
 *   사진 칸은 비어 있음 — 아무도 모릅니다.
 *   (2026-09-05 무무 — 「촬영해 올렸던 사진도 보이지 않는데」)
 *
 *   사진은 편람이 서식 뒷장에 붙이라고 한 **근거**입니다.
 */
{
  맞아야("★ 사진이 막혀 있으니 아직 안 올라감", 올린사진.length === 0,
    `올라간 장수 ${올린사진.length}`);
  맞아야("★ 보고는 그래도 갔음 (사진 때문에 보고까지 막지 않음)",
    보낸것.length === 1);

  const 글자 = await 쪽.locator("body").innerText();
  맞아야("★ 화면이 「사진 1장이 아직 안 갔습니다」라고 알려 줌",
    글자.includes("1장이 아직 안 갔습니다"),
    "여기서 조용하면 현장은 다 보낸 줄 압니다");
  맞아야("★ 사진만 다시 보낼 자리가 있음",
    await 쪽.locator("text=사진 다시 보내기").first().isVisible());

  // 신호가 돌아왔습니다. 눌러 봅니다.
  사진막기 = false;
  await 쪽.click("text=사진 다시 보내기");
  await 쪽.waitForFunction(() => !document.body.innerText.includes("아직 안 갔습니다"),
    null, { timeout: 20000 }).catch(() => { });

  맞아야("★ 다시 누르니 사진이 올라감", 올린사진.length === 1,
    `올라간 장수 ${올린사진.length}`);
  맞아야("★ 사진 표에도 그때 적힘", 사진표.length === 1);
  맞아야("★ 보고를 두 번 보내지는 않음", 보낸것.length === 1,
    `올라간 건수 ${보낸것.length}`);
  맞아야("★ 다 가고 나면 「아직 안 갔습니다」가 사라짐",
    !(await 쪽.locator("body").innerText()).includes("아직 안 갔습니다"));
}

/* ── 목록에 뭐라고 뜨나 ────────────────────────────────────── */
console.log("\n── 3-4-2. ★ 잘 갔으면 「전송 완료」 ──────────────────\n");
/*
 * 무무가 정한 문구입니다 — 「정상적으로 올라갔으면 목록에서 해당
 * 서비스에 대해 "전송 완료" 문구만 띄워주면 되」 (2026-09-05).
 */
{
  await 쪽.click("text=오늘 갈 곳으로");
  await 쪽.waitForSelector(".사람", { timeout: 20000 });
  const 첫줄 = await 쪽.locator(".사람").first().innerText();
  맞아야("★ 목록에 「전송 완료」로 뜸", 첫줄.includes("전송 완료"),
    JSON.stringify(첫줄.replace(/\n/g, " / ")));
  맞아야("옛 문구(「끝났습니다」)는 안 씀", !첫줄.includes("끝났습니다"));
  await 쪽.locator(".사람").first().click();
  await 쪽.waitForSelector("text=적은 것 보기", { timeout: 15000 });
}

/* ── 사진이 잠겨서 올라갔는가 ─────────────────────────────── */
console.log("\n── 3-5. 사진이 잠겨서 올라갔는가 ─────────────────────\n");
맞아야("★ 사진 파일이 올라감", 올린사진.length === 1, `올라간 장수 ${올린사진.length}`);
맞아야("사진 표에도 한 줄 적힘", 사진표.length === 1);
if (올린사진.length && 사진표.length) {
  const 사진 = 올린사진[0];
  맞아야("길이 <기관번호>/<보고번호>/<사진번호>",
    사진.길.startsWith(`사진/${기관번호}/${보낸것[0].id}/`), 사진.길);
  맞아야("표의 길과 실제 올린 길이 같음",
    사진표[0].path === 사진.길.replace("사진/", ""),
    `표 ${사진표[0].path} · 실제 ${사진.길}`);

  /*
   * ★ 여기가 핵심입니다.
   *   올라간 것이 사진이 아니라 **잠긴 덩어리**여야 합니다.
   *   JPEG 는 늘 FF D8 로 시작합니다. 그것이 보이면 맨눈에 읽히는 것입니다.
   */
  맞아야("★ 올라간 것이 JPEG 가 아님 (잠겨 있음)",
    !(사진.덩이[0] === 0xff && 사진.덩이[1] === 0xd8),
    `첫 두 바이트 ${사진.덩이[0].toString(16)} ${사진.덩이[1].toString(16)}`);

  const 푼사진 = await 덩이풀기(기관열쇠, new Uint8Array(사진.덩이));
  맞아야("★ 기관 열쇠로 풀면 진짜 JPEG",
    푼사진[0] === 0xff && 푼사진[1] === 0xd8);
  맞아야(`줄인 사진이 원본보다 작음 (${Math.round(푼사진.length / 1024)}KB)`,
    푼사진.length < 4000 * 3000 * 0.05);

  const 딴열쇠 = 새열쇠();
  let 막혔나 = false;
  try { await 덩이풀기(딴열쇠, new Uint8Array(사진.덩이)); } catch { 막혔나 = true; }
  맞아야("★ 남의 열쇠로는 안 열림", 막혔나);
}
맞아야("화면에도 「보냈습니다」로 뜸",
  await 쪽.locator("text=보냈습니다").first().isVisible());
await 찍기(쪽, "11-끝난집");

/* ═══ 3-4. 끝난 뒤에는 못 고치고, 수정 단추로만 열리는가 ═════ */
console.log("\n── 3-6. 끝난 뒤에는 읽기 전용 ────────────────────────\n");
await 쪽.click("text=적은 것 보기");
await 쪽.waitForSelector("text=다 끝난 건입니다", { timeout: 15000 });
맞아야("★ 다 끝난 건이라고 알려 줌", true);
맞아야("★ 고를 칸이 잠겨 있음",
  await 쪽.locator('.칸고름:has-text("청소") input').isDisabled());
맞아야("★ 특이사항도 잠겨 있음", await 쪽.locator("#특이").isDisabled());
맞아야("사진 빼기도 잠김",
  (await 쪽.locator(".사진빼기").count()) === 0 ||
  (await 쪽.locator(".사진빼기").first().isDisabled()));
맞아야("아래에 수정 단추가 있음",
  await 쪽.locator('button:has-text("수정")').isVisible());
await 찍기(쪽, "17-읽기전용");

쪽.once("dialog", (d: any) => d.accept());
await 쪽.locator('button:has-text("수정")').click();
await 쪽.waitForSelector("text=고치는 중입니다", { timeout: 15000 });
맞아야("★ 수정을 누르면 고칠 수 있게 됨",
  !(await 쪽.locator("#특이").isDisabled()));

const 보낸수전 = 보낸것.length;
await 쪽.fill("#특이", "고친 뒤 특이사항입니다.");
await 쪽.waitForTimeout(700);
/*
 * ★ `text=` 로 누르면 **안내문 속의 같은 글자**가 먼저 잡힙니다.
 *   「다 고치시면 고친 것 보내기를 눌러 주세요」라는 문장이 위에 있어서,
 *   단추가 아니라 그 문단을 눌렀고 아무 일도 안 일어났습니다.
 *   단추만 고르도록 못 박습니다.
 */
await 쪽.locator('button:has-text("고친 것 보내기")').click();
await 쪽.waitForSelector("text=적은 것 보기", { timeout: 20000 });
맞아야("★ 고치면 사무실로 다시 보냄", 보낸것.length === 보낸수전 + 1,
  `전 ${보낸수전} · 후 ${보낸것.length}`);
if (보낸것.length > 보낸수전) {
  const 고친것: any = await 짐풀기(기관열쇠, 보낸것[보낸것.length - 1].payload_enc);
  맞아야("★ 고친 내용이 실려 감",
    String(고친것.적은것?.특이사항 ?? "").includes("고친 뒤"));
  맞아야("★ 고친 시각이 실려 감",
    Array.isArray(고친것.고침) && 고친것.고침.length === 1,
    JSON.stringify(고친것.고침));
  같아야("보고 번호는 그대로 (덮어쓰기)",
    보낸것[보낸것.length - 1].id, 보낸것[0].id);
}
await 쪽.click("text=적은 것 보기");
await 쪽.waitForSelector("text=고친 기록", { timeout: 15000 });
맞아야("★ 고친 기록이 화면에 남음", true);
await 찍기(쪽, "18-고친기록");
await 쪽.click("text=돌아가기");
await 쪽.waitForSelector("text=오늘 갈 곳으로", { timeout: 15000 });

/* ═══ 4. 껐다 켜도 남아 있는가 ═══════════════════════════════ */
console.log("\n── 4. 폰이 꺼져도 다 남아 있는가 ─────────────────────\n");
await 쪽.click("text=오늘 갈 곳으로");
await 쪽.waitForSelector(".사람", { timeout: 15000 });
맞아야("목록에 「전송 완료」로 보임",
  await 쪽.locator("text=전송 완료").first().isVisible());
await 찍기(쪽, "12-목록-끝난뒤");

await 쪽.click("text=잠그고 나가기");
await 쪽.waitForSelector("#p", { timeout: 15000 });
await 쪽.reload();                                   // 폰을 껐다 켠 셈
await 쪽.waitForSelector("#p", { timeout: 15000 });
await 쪽.fill("#p", "246813");
await 쪽.waitForSelector(".사람", { timeout: 30000 });
맞아야("★ 껐다 켜도 「전송 완료」가 남아 있음",
  await 쪽.locator("text=전송 완료").first().isVisible());

await 쪽.locator(".사람").first().click();
await 쪽.waitForSelector("text=적은 것 보기", { timeout: 15000 });
await 쪽.click("text=적은 것 보기");
await 쪽.waitForSelector("text=오늘 해 드린 것", { timeout: 15000 });
맞아야("★ 골랐던 것이 그대로 있음",
  await 쪽.locator('.칸고름:has-text("청소") input').isChecked());
// 위 3-4 에서 「고친 뒤 특이사항입니다」로 고쳤습니다. 그것이 남아야 맞습니다.
맞아야("★ 적었던 특이사항이 그대로 있음",
  (await 쪽.inputValue("#특이")).includes("고친 뒤"),
  await 쪽.inputValue("#특이"));
맞아야("★ 기타에 적은 것도 그대로",
  (await 쪽.inputValue("#기타한것")) === "약 봉투 정리");
await 브1.close();

/* ═══ 5. 확인사항이 서비스마다 다른가 ════════════════════════ */
console.log("\n── 5. 서식4 식사 · 서식5 동행 ────────────────────────\n");
const 브2 = await 브라우저열기(을영상);
const 버전2 = await 브2.newContext({ viewport: { width: 390, height: 844 },
  permissions: ["camera"], deviceScaleFactor: 2 });
const 쪽2 = await 버전2.newPage();
await 우편함흉내(쪽2);
await 오늘까지가기(쪽2);

// 둘째 = 박정자 · 동행지원 (서식5)
await 쪽2.locator(".사람").nth(1).click();
await 쪽2.waitForSelector("text=서비스 시작", { timeout: 15000 });
맞아야("동행지원은 서식5 라고 적힘", await 쪽2.locator("text=서식5").isVisible());
await 쪽2.click("text=서비스 시작");
await 쪽2.waitForSelector("text=시작을 찍었습니다", { timeout: 25000 });
await 쪽2.click("text=확인사항 적기");
await 쪽2.waitForSelector("#내용", { timeout: 15000 });
맞아야("★ 서식5 — 제공 장소 칸이 있음", await 쪽2.locator("text=제공 장소").isVisible());
맞아야("★ 서식5 — 가사 열한 가지는 안 나옴",
  (await 쪽2.locator(".칸고름").count()) === 0);
await 쪽2.fill("#장소", "해남종합병원 정형외과");
await 쪽2.fill("#내용", "자택에서 병원까지 동행\n접수·수납 도움\n귀가 동행");
await 쪽2.waitForTimeout(700);
await 찍기(쪽2, "13-확인사항-동행");

await 쪽2.click("text=다 적었습니다");
await 쪽2.waitForSelector("text=서비스 끝", { timeout: 15000 });
await 쪽2.click("text=오늘 갈 곳으로");
await 쪽2.waitForSelector(".사람", { timeout: 15000 });

// 셋째 = 이말순 · 식사지원 (서식4) — 방문표가 없는 셈 치고 곁길로
await 쪽2.locator(".사람").nth(2).click();
await 쪽2.waitForSelector("text=서비스 시작", { timeout: 15000 });
맞아야("식사지원은 서식4 라고 적힘", await 쪽2.locator("text=서식4").isVisible());
쪽2.once("dialog", (d: any) => d.accept());
await 쪽2.click("text=방문표가 없습니다");
await 쪽2.waitForSelector("text=시작을 찍었습니다", { timeout: 15000 });
맞아야("★ 표 없이도 시작이 적힘", true);

await 쪽2.click("text=확인사항 적기");
await 쪽2.waitForSelector("#반찬", { timeout: 15000 });
맞아야("★ 서식4 — 제공 형태(대면/비대면)가 있음",
  (await 쪽2.locator('[data-적을것="제공형태"]').count()) === 2);
맞아야("★ 서식4 — 식단이 「필수」로 표시됨",
  await 쪽2.locator("text=필수").first().isVisible());
맞아야("★ 서식4 — 가사 열한 가지는 안 나옴",
  (await 쪽2.locator('[data-적을것="한것"]').count()) === 0);
await 쪽2.locator('[data-적을것="제공형태"][value="대면배달"]').check();
await 쪽2.fill("#주식", "흰죽");
await 쪽2.fill("#반찬", "콩나물 무침, 미역줄기, 계란찜, 배추김치");
await 쪽2.waitForTimeout(700);
await 찍기(쪽2, "14-확인사항-식사");

await 쪽2.click("text=다 적었습니다");
await 쪽2.waitForSelector("text=표 없이", { timeout: 15000 });
맞아야("★ 표 없이 적은 것이 눈에 띄게 표시됨", true);
await 찍기(쪽2, "15-표없이");

/* ═══ 6. 옆집 표는 물리치는가 ═══════════════════════════════ */
console.log("\n── 6. 옆집 방문표를 찍으면 ───────────────────────────\n");
await 쪽2.click("text=오늘 갈 곳으로");
await 쪽2.waitForSelector(".사람", { timeout: 15000 });
await 쪽2.locator(".사람").first().click();          // 김복순인데 카메라엔 박정자 표
await 쪽2.waitForSelector("text=서비스 시작", { timeout: 15000 });
await 쪽2.click("text=서비스 시작");
await 쪽2.waitForSelector("#눈", { timeout: 15000 });
await 쪽2.waitForFunction(() => (document.getElementById("말")?.textContent || "").length > 3,
                          null, { timeout: 25000 });
const 말 = (await 쪽2.locator("#말").textContent() || "").trim();
맞아야("★ 옆집 표라고 물리침",
  !(await 쪽2.locator("text=시작을 찍었습니다").isVisible()));
맞아야(`★ 누구 집인지 말해 줌 — 「${말}」`, 말.includes("박정자"), 말);
await 찍기(쪽2, "16-옆집표");

/* ═══ 7. 나갈 때 카메라가 꺼지는가 ═══════════════════════════ */
console.log("\n── 7. 나갈 때 카메라가 꺼지는가 ──────────────────────\n");
const 켜져있나 = () => 쪽2.evaluate(() => {
  const v = document.querySelector("video") as HTMLVideoElement | null;
  const s = v && (v.srcObject as MediaStream | null);
  return !!(s && s.getTracks().some((t) => t.readyState === "live"));
});
맞아야("찍는 동안에는 켜져 있음", await 켜져있나());
await 쪽2.evaluate(() => { (window as any).붙든것 = document.querySelector("video"); });
await 쪽2.click("text=그만두기");
await 쪽2.waitForSelector("text=서비스 시작", { timeout: 15000 });
맞아야("★ 그만두면 카메라가 꺼짐", !(await 쪽2.evaluate(() => {
  const v = (window as any).붙든것 as HTMLVideoElement | null;
  const s = v && (v.srcObject as MediaStream | null);
  return !!(s && s.getTracks().some((t) => t.readyState === "live"));
})));

await 브2.close();
서버.stop();
console.log("\n" + "─".repeat(52));
console.log(`  통과 ${통과수} · 실패 ${실패수}`);
console.log("  그림  현장앱/그림/6~16");
console.log("");
process.exit(실패수 ? 1 : 0);
