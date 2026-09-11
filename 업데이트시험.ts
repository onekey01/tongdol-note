/**
 * 업데이트 안내 —  bun 업데이트시험.ts
 *
 * ═══════════════════════════════════════════════════════════
 *  왜 이 시험이 있나
 * ═══════════════════════════════════════════════════════════
 *
 * (2026-09-08 무무 — 「업데이트 내용이 있으면 관리자가 프로그램 실행 시
 *  업데이트 알림과 함께 **자동으로 업데이트** 할 수 있는 방법은 없을까?」)
 *
 * 손으로 갈아 끼울 때는 버전정보가 틀려도 그냥 성가신 정도였습니다.
 * **저절로 받아서 갈아 끼우기 시작하면 성격이 달라집니다.** 버전정보를
 * 고칠 수 있는 사람은 그때부터 **기관 PC 에 아무 프로그램이나 깔 수
 * 있습니다.** 통합돌봄 자료가 들어 있는 컴퓨터입니다.
 *
 * 그래서 여기서 보는 것은 「잘 될 때 잘 되나」가 아니라
 * **「나쁜 것을 정말로 거절하나」** 입니다. 시험 열 개 중 여덟이
 * 거절하는 쪽입니다.
 *
 * ── ★ 왜 진짜 HTTP 서버를 세우는가 ★ ───────────────────────
 *
 * 함수만 불러 보면 「받아 오는 길」이 통째로 안 지나갑니다. 실제로
 * 새는 자리는 대개 그 길입니다 — 302 를 따라가는가, 크기를 넘겨
 * 보내면 어떻게 되는가, 답이 없으면 걸려 있는가. 그래서 이 시험은
 * **진짜 서버를 세워 진짜로 받아 옵니다.**
 */
import { generateKeyPairSync, sign as 서명하기, createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { zipFiles } from "./server/zip";
import { 버전 as 지금버전, 버전견주기 } from "./server/version";

/*
 * 시험용 버전 번호는 **지금 버전보다 한 칸 위**로 그때그때 만듭니다.
 * "1.16.31" 처럼 박아 두면 다음에 버전을 올리는 날 이 시험이 조용히
 * 「받을 것 없음」으로 넘어가면서 **아무것도 안 보게 됩니다.**
 * (실제로 1.15 → 1.16 으로 올린 날 그 일이 났습니다.)
 */
const 새버전번호 = (() => {
  const [큰, 작은, 끝] = 지금버전.split(".").map(Number);
  return `${큰}.${작은 + 1}.${끝}`;
})();
import {
  서명확인, 버전정보읽기, 받는곳믿을만한가, 풀기, 푼것점검,
  버전정보가져오기, 글자만,
} from "./server/업데이트";

let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: unknown, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}
async function 던지나(무엇: string, 한다: () => any, 말조각 = "") {
  try {
    await 한다();
    실패수++; console.log(`✗ 실패  ${무엇}  — 던지지 않고 그냥 지나갔습니다`);
  } catch (e) {
    const 말 = e instanceof Error ? e.message : String(e);
    if (말조각 && !말.includes(말조각)) {
      실패수++; console.log(`✗ 실패  ${무엇}  — 다른 까닭으로 던졌습니다: ${말}`);
    } else { 통과수++; console.log(`  통과  ${무엇}  — ${말}`); }
  }
}

// ── 시험용 열쇠 한 쌍 ───────────────────────────────────────
const 한쌍 = generateKeyPairSync("ed25519");
const 공개 = 한쌍.publicKey.export({ type: "spki", format: "der" }).toString("base64");
const 남의한쌍 = generateKeyPairSync("ed25519");
const 남의공개 = 남의한쌍.publicKey.export({ type: "spki", format: "der" }).toString("base64");
const 서명 = (글: Buffer, 열쇠 = 한쌍.privateKey) => 서명하기(null, 글, 열쇠).toString("base64");

const 마당 = mkdtempSync(join(tmpdir(), "업데이트시험-"));

console.log("\n  업데이트 안내 시험");
console.log("  ═══════════════════════════════════════════════════\n");

// ═══ 1. 서명 ═══════════════════════════════════════════════
console.log("  ① 서명 — 우리가 쓴 것만 믿습니다");
{
  const 글 = Buffer.from(`{"버전":"${새버전번호}"}`, "utf8");
  const s = 서명(글);

  본다("우리 서명은 통과합니다", 서명확인(글, s, 공개) === true);
  본다("남의 열쇠로 확인하면 막힙니다", 서명확인(글, s, 남의공개) === false);
  본다("남의 열쇠로 서명한 것은 막힙니다",
    서명확인(글, 서명(글, 남의한쌍.privateKey), 공개) === false);

  const 고친글 = Buffer.from(`{"버전":"9.99.31"}`, "utf8");
  본다("★ 글을 한 글자만 바꿔도 막힙니다", 서명확인(고친글, s, 공개) === false);

  본다("★ 열쇠가 비어 있으면 무조건 막습니다 (「없으니 그냥 믿자」로 안 빠집니다)",
    서명확인(글, s, "") === false);
  본다("서명이 비어 있으면 막습니다", 서명확인(글, "", 공개) === false);
  본다("서명이 base64 가 아니면 막습니다", 서명확인(글, "@@@@@", 공개) === false);
  본다("서명 길이가 64바이트가 아니면 막습니다",
    서명확인(글, Buffer.alloc(63).toString("base64"), 공개) === false);
  본다("열쇠가 엉뚱한 글자면 막습니다 (터지지 않고)",
    서명확인(글, s, "이것은열쇠가아닙니다") === false);
}

// ═══ 2. 버전정보 모양 ════════════════════════════════════════
console.log("\n  ② 버전정보 — 모양이 어긋나면 안 씁니다");
const 좋은정보 = {
  버전: 새버전번호,
  낸날: "2026-09-08",
  바뀐것: ["청구서 반올림이 군 방식과 어긋나던 것을 고쳤습니다"],
  꼭해야하나: false,
  받는곳: `https://github.com/onekey01/tongdol-note/releases/download/v${새버전번호}/tongdol-note-${새버전번호}.zip`,
  지문: "a".repeat(64),
  크기: 42_000_000,
};
{
  const 읽은것 = 버전정보읽기(JSON.stringify(좋은정보));
  본다("멀쩡한 버전정보는 읽힙니다", 읽은것.버전 === 새버전번호 && 읽은것.바뀐것.length === 1);

  const 나쁜것: [string, any, string][] = [
    ["버전 번호가 글자면", { ...좋은정보, 버전: "새버전" }, "버전 번호"],
    ["버전 번호가 비면", { ...좋은정보, 버전: "" }, "버전 번호"],
    ["낸 날이 모양이 아니면", { ...좋은정보, 낸날: "2026/09/08" }, "낸 날"],
    ["바뀐 것이 비면", { ...좋은정보, 바뀐것: [] }, "바뀐 것"],
    ["바뀐 것이 빈 글자뿐이면", { ...좋은정보, 바뀐것: ["", "   "] }, "바뀐 것"],
    ["받는곳이 http 면", { ...좋은정보, 받는곳: "http://github.com/a/b/c.zip" }, "https"],
    ["받는곳이 주소가 아니면", { ...좋은정보, 받는곳: "그냥글자" }, "주소 모양"],
    ["지문이 짧으면", { ...좋은정보, 지문: "abc" }, "지문"],
    ["지문에 16진이 아닌 글자가 있으면", { ...좋은정보, 지문: "z".repeat(64) }, "지문"],
    ["크기가 없으면", { ...좋은정보, 크기: undefined }, "크기"],
    ["크기가 터무니없이 크면", { ...좋은정보, 크기: 900_000_000 }, "크기"],
    ["크기가 터무니없이 작으면", { ...좋은정보, 크기: 10 }, "크기"],
  ];
  for (const [무엇, 것, 조각] of 나쁜것) {
    await 던지나(무엇 + " 막습니다", () => 버전정보읽기(JSON.stringify(것)), 조각);
  }
  await 던지나("JSON 이 아니면 막습니다", () => 버전정보읽기("{{{"), "JSON");

  // 바깥에서 온 글이라 길이와 제어문자를 다듬습니다.
  const 긴것 = 버전정보읽기(JSON.stringify({ ...좋은정보, 바뀐것: ["가".repeat(500)] }));
  본다("★ 바뀐 것 한 줄이 길면 잘립니다 (띠가 화면을 안 덮게)",
    긴것.바뀐것[0].length === 120, `${긴것.바뀐것[0].length}자`);

  const 많은것 = 버전정보읽기(JSON.stringify({
    ...좋은정보, 바뀐것: Array.from({ length: 50 }, (_, i) => `줄 ${i}`),
  }));
  본다("바뀐 것이 스무 줄을 넘으면 잘립니다", 많은것.바뀐것.length === 20);

  본다("★ 줄바꿈·제어문자는 걷어냅니다",
    글자만("가\n나\t다\x00라") === "가 나 다 라", 글자만("가\n나\t다\x00라"));

  본다("꼭해야하나는 true 일 때만 참입니다",
    버전정보읽기(JSON.stringify({ ...좋은정보, 꼭해야하나: "예" })).꼭해야하나 === false);
}

// ═══ 3. 받는곳 ═════════════════════════════════════════════
console.log("\n  ③ 받는곳 — 버전정보를 읽어 온 그 자리에서만 받습니다");
{
  const 읽어온곳 = "https://github.com/onekey01/tongdol-note/releases/latest/download/version.json";
  본다("같은 저장소면 받습니다",
    받는곳믿을만한가(좋은정보.받는곳, 읽어온곳) === true);
  본다("★ 다른 호스트면 안 받습니다",
    받는곳믿을만한가("https://evil.example.com/x.zip", 읽어온곳) === false);
  본다("★ 같은 호스트라도 다른 주인이면 안 받습니다",
    받는곳믿을만한가("https://github.com/남/tongdol-note/releases/download/v1/x.zip", 읽어온곳) === false);
  본다("★ 같은 주인이라도 다른 저장소면 안 받습니다",
    받는곳믿을만한가("https://github.com/onekey01/딴것/releases/download/v1/x.zip", 읽어온곳) === false);
  본다("http 면 안 받습니다",
    받는곳믿을만한가("http://github.com/onekey01/tongdol-note/x.zip", 읽어온곳) === false);
  본다("주소가 아니면 안 받습니다 (터지지 않고)",
    받는곳믿을만한가("그냥글자", 읽어온곳) === false);
}

// ═══ 4. 풀기 ═══════════════════════════════════════════════
console.log("\n  ④ 풀기 — zip 안의 이름을 그대로 믿지 않습니다");
function 버전만들기(버전: string, 크게 = true): Buffer {
  /*
   * exe 를 **아무 값이나 채운 바이트**로 만듭니다. 0 으로 채우면 압축이
   * 21MB 를 몇 KB 로 줄여 버려, 버전정보의 「크기가 1MB 는 넘어야 한다」
   * 검사에 걸립니다. 진짜 exe 는 안 줄어듭니다 — 그쪽에 맞춥니다.
   */
  const 알맹이 = Buffer.allocUnsafe(크게 ? 21 * 1024 * 1024 : 1024);
  for (let i = 0; i < 알맹이.length; i += 4) 알맹이.writeUInt32LE((i * 2654435761) >>> 0, i);
  return zipFiles([
    { name: `통돌Note_${버전}/통돌Note.exe`, data: 알맹이 },
    { name: `통돌Note_${버전}/dist-web/index.html`, data: Buffer.from("<html>통돌</html>") },
    { name: `통돌Note_${버전}/서식/서식9.hwpx`, data: Buffer.from("서식") },
  ]);
}
{
  const 자리 = join(마당, "푼것");
  const 센것 = 풀기(버전만들기(새버전번호), 자리);
  본다("버전 셋이 풀립니다", 센것 === 3, `${센것}개`);
  본다("★ 맨 위 폴더 한 겹이 벗겨집니다 (.bat 이 한글 길을 안 다루게)",
    existsSync(join(자리, "통돌Note.exe")) && !existsSync(join(자리, `통돌Note_${새버전번호}`)));
  본다("속 폴더는 그대로입니다", existsSync(join(자리, "dist-web", "index.html")));
  본다("푼 것 점검을 지납니다", 푼것점검(자리).됨 === true);

  await 던지나("★ 이름에 `..` 이 섞이면 안 풉니다 (zip-slip)",
    () => 풀기(zipFiles([
      { name: `통돌Note_${새버전번호}/../../../나쁜것.exe`, data: Buffer.from("x") },
    ]), join(마당, "나쁜1")), "이상한 이름");

  await 던지나("★ 이름이 절대경로면 안 풉니다",
    () => 풀기(zipFiles([
      { name: "/etc/나쁜것", data: Buffer.from("x") },
      { name: "/tmp/또", data: Buffer.from("x") },
    ]), join(마당, "나쁜2")), "이상한 이름");

  await 던지나("★ 이름에 역슬래시가 있으면 안 풉니다",
    () => 풀기(zipFiles([
      { name: `통돌Note_${새버전번호}/..\\..\\나쁜것`, data: Buffer.from("x") },
    ]), join(마당, "나쁜3")), "이상한 이름");

  await 던지나("빈 zip 은 막습니다", () => 풀기(zipFiles([]), join(마당, "나쁜4")), "");
}

// ═══ 5. 푼 것 점검 ═════════════════════════════════════════
console.log("\n  ⑤ 푼 것 점검 — 통돌 Note 가 아니면 안 갈아 끼웁니다");
{
  const 자리 = join(마당, "점검");
  풀기(zipFiles([
    { name: "x/통돌Note.exe", data: Buffer.alloc(1024) },
    { name: "x/dist-web/index.html", data: Buffer.from("<html>") },
  ]), 자리);
  본다("★ 실행 파일이 너무 작으면 막습니다 (반쯤 받은 것)",
    푼것점검(자리).됨 === false, 푼것점검(자리).까닭);

  const 자리2 = join(마당, "점검2");
  풀기(zipFiles([{ name: "x/통돌Note.exe", data: Buffer.alloc(21 * 1024 * 1024, 1) }]), 자리2);
  본다("★ 화면(dist-web)이 없으면 막습니다",
    푼것점검(자리2).됨 === false, 푼것점검(자리2).까닭);

  const 자리3 = join(마당, "점검3");
  풀기(zipFiles([
    { name: "x/통돌Note.exe", data: Buffer.alloc(21 * 1024 * 1024, 1) },
    { name: "x/딴것.exe", data: Buffer.alloc(21 * 1024 * 1024, 1) },
    { name: "x/dist-web/index.html", data: Buffer.from("<html>") },
  ]), 자리3);
  본다("실행 파일이 둘이면 막습니다", 푼것점검(자리3).됨 === false, 푼것점검(자리3).까닭);

  본다("아예 없는 자리는 막습니다", 푼것점검(join(마당, "없는자리")).됨 === false);
}

// ═══ 6. 진짜로 받아 오기 ═══════════════════════════════════
console.log("\n  ⑥ 진짜 서버에서 받아 오기 — 코드가 도는 그 길로");
{
  /*
   * ── ★ 왜 https 서버까지 세우는가 ★ ────────────────────────
   *
   * 처음에는 http 로 세우고, 시험 안에서 받아 오는 절차를 **다시 적어**
   * 견주었습니다. 그러면 시험은 통과하는데 **진짜 코드는 안 지나갑니다.**
   * 실제로 그 상태에서 `내려받기` 의 지문 대조를 지워 봤더니
   * **시험이 하나도 안 울었습니다.**
   *
   * 그래서 스스로 서명한 인증서로 https 서버를 세우고, `확인하기()` 를
   * **그대로 부릅니다.** 이제 지문 대조를 지우면 시험이 웁니다.
   */
  const 인증서 = Bun.spawnSync([
    "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2",
    "-keyout", join(마당, "t.key"), "-out", join(마당, "t.crt"),
    "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1",
  ]);
  본다("시험용 인증서를 만들었습니다", 인증서.exitCode === 0);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";   // 스스로 서명한 것이라

  const zip = 버전만들기(새버전번호);
  const 지문 = createHash("sha256").update(zip).digest("hex");

  let 낼정보: any = null;
  let 낼서명: string | null = null;
  let 버전정보막기 = false;
  let 낼zip = zip;

  const 서버 = Bun.serve({
    port: 0,
    tls: { key: readFileSync(join(마당, "t.key")), cert: readFileSync(join(마당, "t.crt")) },
    fetch(req) {
      const p2 = new URL(req.url).pathname;
      const 글 = Buffer.from(JSON.stringify(낼정보, null, 2) + "\n", "utf8");
      if (p2.endsWith("/version.json")) {
        if (버전정보막기) return new Response("없습니다", { status: 404 });
        return new Response(글);
      }
      if (p2.endsWith("/version.json.sig")) return new Response((낼서명 ?? 서명(글)) + "\n");
      if (p2.endsWith(".zip")) return new Response(낼zip);
      return new Response("?", { status: 404 });
    },
  });
  const 바탕 = `https://127.0.0.1:${서버.port}/onekey01/tongdol-note`;
  const 뿌리 = `${바탕}/releases/latest/download`;
  const 제대로 = () => ({
    ...좋은정보, 지문, 크기: zip.length,
    받는곳: `${바탕}/releases/download/v${새버전번호}/tongdol-note-${새버전번호}.zip`,
  });
  낼정보 = 제대로();

  // ── 버전정보 가져오기 (진짜 함수) ───────────────────────────
  const 가져온것 = await 버전정보가져오기(뿌리, 공개);
  본다("버전정보를 서명까지 확인해서 가져옵니다", 가져온것.버전 === 새버전번호);

  낼서명 = 서명(Buffer.from("딴 글", "utf8"));
  await 던지나("★★ 남이 버전정보를 갈아 끼우면 서명이 안 맞아 막힙니다",
    () => 버전정보가져오기(뿌리, 공개), "서명");

  낼서명 = null;
  await 던지나("★★ 남의 열쇠로 서명한 버전정보는 막힙니다",
    () => 버전정보가져오기(뿌리, 남의공개), "서명");

  낼정보 = { ...제대로(), 받는곳: `https://evil.example.com/x.zip` };
  await 던지나("★★ 받는곳이 딴 자리를 가리키면 막습니다",
    () => 버전정보가져오기(뿌리, 공개), "다른 자리");

  버전정보막기 = true;
  낼정보 = 제대로();
  await 던지나("버전정보를 못 읽으면(404) 그만둡니다", () => 버전정보가져오기(뿌리, 공개), "못 읽었습니다");
  버전정보막기 = false;

  // ── 확인하기() 를 통째로 (자료함이 필요합니다) ────────────
  const { initDb } = await import("./server/db");
  initDb();
  const U = await import("./server/업데이트");
  const 옛주소 = U.읽어올곳();
  const 되돌리기 = () => { U.치우기(); (globalThis as any).__x; };
  U.읽어올곳정하기(뿌리);
  U.켜고끄기(true);

  // (가) 제대로 된 버전
  U.치우기();
  let 형편 = await U.확인하기({ 억지로: true, 열쇠: 공개 });
  본다("★ 확인하기() 가 받아서 풀어 「준비됨」까지 갑니다",
    형편.무엇 === "준비됨" && (형편 as any).정보.버전 === 새버전번호, 형편.무엇);
  본다("★ 푼 것이 정말 자리에 있습니다",
    existsSync(join(U.푼자리, "통돌Note.exe")) && 푼것점검(U.푼자리).됨);
  본다("준비된것() 이 같은 것을 돌려줍니다", U.준비된것()?.버전 === 새버전번호);

  // (나) 지문이 다른 zip 을 내주면
  U.치우기();
  낼zip = Buffer.concat([zip.subarray(0, zip.length - 1), Buffer.from([0xff])]);
  형편 = await U.확인하기({ 억지로: true, 열쇠: 공개 });
  본다("★★ 지문이 다른 파일을 내주면 「준비됨」이 안 됩니다 (반쯤 받다 끊긴 것)",
    형편.무엇 === "조용", 형편.무엇);
  본다("★★ 그때 푼 자리가 남아 있지 않습니다", !existsSync(join(U.푼자리, "통돌Note.exe")));
  낼zip = zip;

  // (다) 버전이 우리보다 낮으면 아무 일도 안 합니다
  U.치우기();
  낼정보 = { ...제대로(), 버전: "0.1.1" };
  형편 = await U.확인하기({ 억지로: true, 열쇠: 공개 });
  본다("★ 우리보다 낮은 버전이면 아무 일도 안 합니다", 형편.무엇 === "조용", 형편.무엇);
  본다("낮은 버전은 받지도 않습니다", !existsSync(join(U.푼자리, "통돌Note.exe")));

  // (라) 꺼 두면 확인조차 안 합니다
  낼정보 = 제대로();
  U.치우기();
  U.켜고끄기(false);
  형편 = await U.확인하기({ 열쇠: 공개 });
  본다("★ 설정에서 껐으면 확인조차 안 합니다", 형편.무엇 === "조용");
  U.켜고끄기(true);

  // (마) 「나중에」는 하루만 접습니다
  U.나중에(새버전번호);
  본다("「나중에」를 누르면 그 버전은 접힙니다", U.접어뒀나(새버전번호) === true);
  본다("★ 다른 버전이 나오면 접힘이 안 먹습니다", U.접어뒀나("9.99.99") === false);

  U.치우기();
  U.읽어올곳정하기(옛주소 === (await import("./server/업데이트열쇠")).기본주소 ? "" : 옛주소);
  되돌리기();
  서버.stop(true);
}

// ═══ 7. 인터넷이 없을 때 ═══════════════════════════════════
console.log("\n  ⑦ 인터넷이 없을 때 — 그래도 켜집니다");
{
  /*
   * 파일럿 기관은 시골입니다. 인터넷이 끊겼다고 프로그램이 안 켜지면
   * 그날 업무가 통째로 멎습니다. **던지지 않고 조용히 넘어가야** 합니다.
   */
  const 죽은곳 = "https://127.0.0.1:1/없는자리";
  let 던졌나 = false;
  try { await 버전정보가져오기(죽은곳, 공개); } catch { 던졌나 = true; }
  본다("버전정보가져오기 자체는 던집니다 (부르는 쪽이 삼킵니다)", 던졌나 === true);

  // 확인하기() 는 안에서 다 삼켜야 합니다 — 실제 코드를 그대로 읽어 봅니다.
  const 코드 = readFileSync("server/업데이트.ts", "utf8");
  const 확인하기몸 = 코드.slice(코드.indexOf("export async function 확인하기"));
  본다("★ 확인하기() 안에 catch 가 있습니다 (켜지는 것을 막지 않게)",
    /catch \(e\) \{/.test(확인하기몸));
  본다("★ 켤 때 부르는 자리가 await 가 아닙니다 (인터넷이 느려도 안 늦게)",
    /업데이트확인하기\(\)\.catch/.test(readFileSync("server/index.ts", "utf8")));
  본다("★ 3초 안에 답이 없으면 끊습니다",
    /데려오기\(`\$\{바탕\}\/\$\{버전정보이름\}`, 3000\)/.test(코드));
}

// ═══ 8. 갈아끼우기.bat ═════════════════════════════════════
console.log("\n  ⑧ 갈아끼우기.bat — 한글이 한 글자도 없어야 합니다");
{
  const 길 = "통돌Note 갈아끼우기.bat";
  본다("파일이 있습니다", existsSync(길));
  const 글 = readFileSync(길, "utf8");
  /*
   * cmd 는 .bat 의 바이트를 **기계 코드 페이지**로 읽습니다. 한글이
   * 섞이면 어느 날 파싱이 깨지고, 그날 기관은 갱신을 못 합니다.
   * (2026 무무 — 「.bat 에는 한글이 들어가면 안 돼」)
   */
  const 한글 = 글.match(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g) ?? [];
  본다("★ 한글이 한 글자도 없습니다", 한글.length === 0, 한글.slice(0, 8).join(""));
  /*
   * ★ 여기가 이 시험의 알맹이입니다 ★
   *
   * 지우는 줄(`del` · `rmdir`)이 **준비터 안쪽만** 가리켜야 합니다.
   * 한 줄이라도 `data\` 를 통째로 가리키면 기관의 **자료함이 날아갑니다.**
   * 되돌릴 방법이 없는 종류의 사고라, 글자로 확인합니다.
   * (`rem` 으로 시작하는 설명 줄은 뺍니다 — 설명에는 자료함 이야기가 나옵니다.)
   */
  const 일하는줄 = 글.split(/\r?\n/).filter((l) => !/^\s*(rem\b|::)/i.test(l));
  const 지우는줄 = 일하는줄.filter((l) => /\b(del|rmdir|rd|erase)\b/i.test(l));
  본다("지우는 줄이 있습니다 (없으면 이 시험이 아무것도 안 봅니다)", 지우는줄.length >= 2);
  본다("★ 지우는 줄이 모두 준비터(%STAGE% · %PAYLOAD%) 안쪽입니다",
    지우는줄.every((l) => /%STAGE%|%PAYLOAD%/.test(l)),
    지우는줄.filter((l) => !/%STAGE%|%PAYLOAD%/.test(l)).join(" | "));
  본다("★ 자료함 파일을 한 번도 건드리지 않습니다",
    일하는줄.every((l) => !/tongdol\.db/i.test(l)));
  본다("★ `data` 폴더를 통째로 지우는 줄이 없습니다",
    일하는줄.every((l) => !/(rmdir|rd)\b[^\n]*\bdata\b\s*"?\s*$/i.test(l)));
  본다("옛 exe 를 먼저 치웁니다 (되돌릴 자리)", /old/.test(글) && /move \/y/.test(글));
  본다("★ 잘못되면 옛 버전을 되돌립니다", /:rollback/.test(글));
  본다("robocopy 실패(8 이상)를 잡습니다", /GEQ 8/.test(글));
  본다("프로그램이 꺼지길 기다립니다", /tasklist/.test(글) && /pid\.txt/.test(글));
  본다("준비된 것이 없으면 그냥 그만둡니다", /:nothing/.test(글));
  본다("실행 파일 이름을 손으로 적지 않습니다 (한글이라)", /for %%F in \("%CD%\\\*\.exe"\)/.test(글));
}

// ═══ 9. 자리 이름 ══════════════════════════════════════════
console.log("\n  ⑨ .bat 이 다루는 길은 모두 영문");
{
  const 코드 = readFileSync("server/업데이트.ts", "utf8");
  for (const [무엇, 값] of [["준비터", "\"update\""], ["푼자리", "\"payload\""], ["옛것자리", "\"old\""]] as const) {
    본다(`${무엇} 는 영문 이름입니다`, 코드.includes(값), 값);
  }
  const bat = readFileSync("통돌Note 갈아끼우기.bat", "utf8");
  본다("bat 과 코드가 같은 자리를 봅니다",
    bat.includes("data\\update") && bat.includes("payload") && bat.includes("ready.txt"));
}

// ═══ 끝 ════════════════════════════════════════════════════
rmSync(마당, { recursive: true, force: true });
console.log("\n  ═══════════════════════════════════════════════════");
console.log(`  통과 ${통과수} · 실패 ${실패수}\n`);
process.exit(실패수 ? 1 : 0);
