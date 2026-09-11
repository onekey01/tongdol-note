/** 현장앱 화면을 휴대폰 크기로 찍어 봅니다.  bun 도구/현장앱그림.ts */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { 새열쇠, 싸기, 짐싸기 } from "../server/우편함자물쇠";

const 뿌리 = fileURLToPath(new URL("..", import.meta.url));
const 글 = readFileSync(뿌리 + "현장앱/올릴것/index.html", "utf8");
const 기관열쇠 = 새열쇠();
const 인력번호 = crypto.randomUUID();
const 오늘 = new Date().toISOString().slice(0, 10);
const 사람들 = [
  { 이름: "김복순", 주소: "해남군 해남읍 성내리 12-3", 연락처: "061-534-1234", 서비스: "가사지원" },
  { 이름: "박정자", 주소: "해남군 삼산면 봉학리 45", 연락처: "010-2222-3333", 서비스: "동행지원" },
  { 이름: "이말순", 주소: "해남군 문내면 우수영로 88", 연락처: "061-533-7788", 서비스: "가사지원",
    메모: "대문 옆 초인종이 고장났습니다. 전화 주세요." },
];

const 브라우저 = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const 서버 = Bun.serve({ port: 0,
  fetch: () => new Response(글, { headers: { "content-type": "text/html; charset=utf-8" } }) });
const 주소 = `http://localhost:${서버.port}/`;

const 버전 = await 브라우저.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const 쪽 = await 버전.newPage();

let 공개쪽: string | null = null;
await 쪽.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json",
  body: JSON.stringify({ access_token: "fake-token", refresh_token: "fake-refresh" }) }));
await 쪽.route("**/rest/v1/rpc/register_device", (r) => {
  공개쪽 = JSON.parse(r.request().postData() || "{}").p_pub_key;
  return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(인력번호) });
});
await 쪽.route("**/rest/v1/worker_device**", async (r) => r.fulfill({
  status: 200, contentType: "application/json",
  body: JSON.stringify(공개쪽 ? [{ worker_id: 인력번호, wrapped_key: await 싸기(공개쪽, 기관열쇠) }] : []) }));
await 쪽.route("**/rest/v1/job**", async (r) => r.fulfill({
  status: 200, contentType: "application/json",
  body: JSON.stringify(await Promise.all(사람들.map(async (p, i) => ({
    id: `j${i}`, served_on: 오늘, payload_enc: await 짐싸기(기관열쇠, p) })))) }));

const 찍기 = async (이름: string) =>
  쪽.screenshot({ path: `${뿌리}현장앱/그림/${이름}.png`, fullPage: true });

await Bun.$`mkdir -p ${뿌리}현장앱/그림`.quiet();

await 쪽.goto(주소);
await 쪽.waitForSelector("#본문 h1");
await 찍기("1-처음");

await 쪽.goto(주소 + "#표=시험표"); await 쪽.reload();
await 쪽.waitForSelector("#p1", { timeout: 30000 });
await 찍기("2-여섯자리");

await 쪽.fill("#p1", "246813"); await 쪽.fill("#p2", "246813");
await 쪽.click("#정함");
await 쪽.waitForSelector("text=등록이 끝났습니다", { timeout: 30000 });
await 찍기("3-끝남");

await 쪽.click("text=오늘 갈 곳 보기");
await 쪽.waitForSelector(".사람", { timeout: 20000 });
await 찍기("4-오늘갈곳");

await 쪽.click("text=잠그기");
await 쪽.waitForSelector("#p");
await 찍기("5-잠금");

await 브라우저.close(); 서버.stop();
console.log("  현장앱/그림/ 에 다섯 장 찍었습니다");
