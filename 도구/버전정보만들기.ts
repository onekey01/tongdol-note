/*
 * ── 버전정보 만들기 (「통돌Note 만들기.bat」이 끝에 부릅니다) ──
 *
 *   bun 도구/버전정보만들기.ts <zip경로> <버전번호> <꼭해야하나 0|1>
 *
 * 하는 일 —
 *   1. 「이번에 바뀐 것.txt」를 읽습니다 (한 줄에 하나)
 *   2. zip 의 지문(SHA-256)과 크기를 잽니다
 *   3. version.json 을 만들고 **개인 열쇠로 서명**합니다
 *   4. 「올릴것」 폴더에 **올릴 파일 세 개만** 담아 놓습니다
 *
 * ── 왜 만들기 안에 붙였나 ──────────────────────────────────
 *
 * 따로 돌리는 것으로 두면 **잊습니다.** 잊으면 새 버전을 올려도 기관의
 * 프로그램은 「새 버전이 있다」를 영영 모릅니다. 조용히 아무 일도 안
 * 일어나는 고장이라, 몇 달 뒤에나 알아챕니다. 그래서 zip 을 만든
 * 그 자리에서 같이 만듭니다.
 *
 * ── 왜 파일 이름이 영문인가 ────────────────────────────────
 *
 * GitHub 은 올린 파일 이름에서 영문·숫자가 아닌 글자를 **점(.)으로**
 * 바꿉니다. 「버전정보.json」을 올리면 「.....json」이 되어 프로그램이
 * 못 찾습니다. 그래서 **올리는 것만** 영문으로 씁니다.
 */

import { createHash, sign as 서명하기 } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, statSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { 버전정보이름, 서명이름 } from "../server/업데이트열쇠";

const 나가기 = (말: string) => { console.log(`\n  ✗ ${말}\n`); process.exit(1); };

const [zip경로, 버전번호, 꼭말] = process.argv.slice(2);
if (!zip경로 || !버전번호) 나가기("쓰는 법: bun 도구/버전정보만들기.ts <zip경로> <버전번호> [0|1]");
if (!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(버전번호)) 나가기(`버전 번호 모양이 아닙니다: ${버전번호}`);
if (!existsSync(zip경로)) 나가기(`zip 을 찾지 못했습니다: ${zip경로}`);

const 뿌리 = join(import.meta.dir, "..");

// ── 1. 개인 열쇠 ────────────────────────────────────────────
const 집 = process.env.USERPROFILE || process.env.HOME || ".";
const 개인열쇠길 = process.env.TONGDOL_SIGN_KEY || join(집, "통돌Note-서명열쇠", "개인열쇠.pem");
if (!existsSync(개인열쇠길)) {
  나가기(
    `서명할 개인 열쇠가 없습니다.\n     찾은 자리: ${개인열쇠길}\n` +
    `     「서명열쇠 만들기.bat」을 먼저 한 번 눌러 주세요.`
  );
}
const 개인열쇠 = readFileSync(개인열쇠길, "utf8");

// ── 2. 바뀐 것 ──────────────────────────────────────────────
/*
 * 메모장이 UTF-8 로 저장하면 그대로 읽고, 옛날 방식(CP949)으로
 * 저장했으면 그쪽으로 읽습니다. **어느 쪽으로 저장하셔도 됩니다.**
 * 저장 방식 때문에 버전을 못 내는 일이 없어야 합니다.
 */
function 글읽기(길: string): string {
  const 바이트 = readFileSync(길);
  const 속 = 바이트[0] === 0xef && 바이트[1] === 0xbb && 바이트[2] === 0xbf ? 바이트.subarray(3) : 바이트;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(속);
  } catch {
    return new TextDecoder("euc-kr").decode(속);
  }
}

const 바뀐것파일 = join(뿌리, "이번에 바뀐 것.txt");
if (!existsSync(바뀐것파일)) {
  나가기(
    `「이번에 바뀐 것.txt」가 없습니다.\n` +
    `     프로그램 폴더에 그 이름으로 파일을 만들고, 무엇이 바뀌었는지\n` +
    `     **한 줄에 하나씩** 적어 주세요.`
  );
}
const 바뀐것 = 글읽기(바뀐것파일)
  .split(/\r?\n/)
  .map((s) => s.replace(/^[-*·]\s*/, "").trim())
  .filter((s) => s.length > 0 && !s.startsWith("#"))
  .slice(0, 20)
  .map((s) => s.slice(0, 120));

if (바뀐것.length === 0) {
  나가기(
    `「이번에 바뀐 것.txt」가 비어 있습니다.\n` +
    `     기관은 이 줄들을 읽고 **깔지 말지**를 정합니다.\n` +
    `     「버그 수정 및 안정성 개선」은 아무 말도 안 한 것입니다.`
  );
}

// ── 3. 지문과 크기 ──────────────────────────────────────────
const 덩이 = readFileSync(zip경로);
const 지문 = createHash("sha256").update(덩이).digest("hex");
const 크기 = 덩이.length;

// ── 4. 올릴 이름 ────────────────────────────────────────────
const 올릴zip = `tongdol-note-${버전번호}.zip`;
const { 기본주소 } = await import("../server/업데이트열쇠");
if (!기본주소 || !/^https:\/\/github\.com\/[^/]+\/[^/]+\//.test(기본주소)) {
  나가기(`업데이트 주소가 정해지지 않았습니다. 「서명열쇠 만들기.bat」을 먼저 눌러 주세요.`);
}
/*
 * 받는곳은 **그 버전 전용 주소**입니다. `latest` 가 아닙니다 —
 * `latest` 로 두면 버전정보에 적힌 지문과 실제로 받는 파일이 어긋나는
 * 순간(다음 버전을 올리는 그 몇 초)이 생깁니다.
 */
const 받는곳 = 기본주소.replace(/\/releases\/latest\/download\/?$/, `/releases/download/v${버전번호}/${올릴zip}`);

// ── 5. 버전정보 + 서명 ────────────────────────────────────────
const 정보 = {
  버전: 버전번호,
  낸날: new Date().toISOString().slice(0, 10),
  바뀐것,
  꼭해야하나: String(꼭말 ?? "0") === "1",
  받는곳,
  지문,
  크기,
};
const 글 = JSON.stringify(정보, null, 2) + "\n";
const 글바이트 = Buffer.from(글, "utf8");
const 서명 = 서명하기(null, 글바이트, 개인열쇠).toString("base64");

// ── 6. 올릴것 폴더 ──────────────────────────────────────────
const 올릴곳 = join(뿌리, "올릴것");
rmSync(올릴곳, { recursive: true, force: true });
mkdirSync(올릴곳, { recursive: true });
writeFileSync(join(올릴곳, 버전정보이름), 글바이트);
writeFileSync(join(올릴곳, 서명이름), 서명 + "\n", "utf8");
copyFileSync(zip경로, join(올릴곳, 올릴zip));

// 되읽어 확인합니다 — 적었다고 믿지 않습니다.
const { verify: 서명검사 } = await import("node:crypto");
const { createPublicKey } = await import("node:crypto");
const 공개 = createPublicKey(개인열쇠);
const 맞나 = 서명검사(null, readFileSync(join(올릴곳, 버전정보이름)),
  공개, Buffer.from(readFileSync(join(올릴곳, 서명이름), "utf8").trim(), "base64"));
if (!맞나) 나가기("방금 만든 서명이 스스로 확인되지 않습니다. 올리지 마세요.");

console.log("");
console.log("  업데이트 올릴 것");
console.log("  ─────────────────────────────────────────");
console.log(`    폴더    올릴것`);
console.log(`      ${버전정보이름}      버전 ${버전번호} · 바뀐 것 ${바뀐것.length}줄${정보.꼭해야하나 ? " · **꼭 해야 하는 버전**" : ""}`);
console.log(`      ${서명이름}  서명 (확인까지 마쳤습니다)`);
console.log(`      ${올릴zip}   ${(크기 / 1024 / 1024).toFixed(1)} MB`);
console.log("");
for (const 줄 of 바뀐것) console.log(`      · ${줄}`);
console.log("");
console.log(`    받는곳  ${받는곳}`);
console.log(`            ← GitHub 에서 태그를 **v${버전번호}** 로 내셔야 이 주소가 맞습니다`);
console.log("");
