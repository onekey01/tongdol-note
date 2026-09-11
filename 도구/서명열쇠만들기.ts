/*
 * ── 업데이트 서명 열쇠 만들기 (한 번만) ────────────────────
 *
 * 「서명열쇠 만들기.bat」이 이것을 부릅니다.
 *
 * 하는 일 —
 *   1. Ed25519 열쇠 한 쌍을 만듭니다
 *   2. **개인쪽**을 프로젝트 폴더 **바깥**에 둡니다
 *        C:\Users\<사용자>\통돌Note-서명열쇠\개인열쇠.pem
 *   3. **공개쪽**을 server/업데이트열쇠.ts 에 적어 넣습니다
 *   4. GitHub 주인 이름을 물어 기본 주소도 적어 넣습니다
 *
 * ── 개인쪽을 왜 바깥에 두나 ────────────────────────────────
 *
 * 프로젝트 폴더 안에 두면 언젠가 **zip 에 딸려 들어가서 기관에 나갑니다.**
 * 그 순간 서명은 아무 뜻도 없어집니다 — 그 파일을 가진 사람은 누구나
 * 새 버전을 만들 수 있으니까요. 폴더 바깥이면 그 사고가 아예 안 납니다.
 *
 * ── 이미 만들었는데 또 돌리면 ──────────────────────────────
 *
 * **덮어쓰지 않습니다.** 열쇠를 바꾸면 이미 나가 있는 버전들이 새 서명을
 * 못 믿습니다. 그 기관들은 손으로 한 번 갈아 끼워야 합니다. 그러니
 * 실수로 덮는 일이 없게 막아 둡니다. 정말 바꾸려면 개인열쇠.pem 을
 * 손으로 옮겨 두고 다시 돌리십시오.
 */

import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync, chmodSync } from "node:fs";
import { join } from "node:path";

const 나가기 = (말: string) => { console.log(`\n  ${말}\n`); process.exit(1); };

function 물어보기(말: string, 기본: string): string {
  process.stdout.write(`  ${말}`);
  const buf = Buffer.alloc(1024);
  let n = 0;
  try { n = require("node:fs").readSync(0, buf, 0, 1024, null); } catch { n = 0; }
  const 답 = buf.toString("utf8", 0, n).trim();
  return 답 || 기본;
}

console.log("");
console.log("  통돌 Note — 업데이트 서명 열쇠 만들기");
console.log("  ─────────────────────────────────────────");
console.log("");

// ── 1. 둘 자리 ──────────────────────────────────────────────
const 집 = process.env.USERPROFILE || process.env.HOME || ".";
const 열쇠방 = join(집, "통돌Note-서명열쇠");
const 개인열쇠길 = join(열쇠방, "개인열쇠.pem");

if (existsSync(개인열쇠길)) {
  console.log(`  이미 있습니다 —  ${개인열쇠길}`);
  console.log("");
  console.log("  **덮어쓰지 않습니다.** 열쇠를 바꾸면 이미 기관에 나가 있는");
  console.log("  버전들이 새 서명을 못 믿어, 그 기관은 손으로 한 번 갈아 끼워야");
  console.log("  합니다. 정말 바꾸시려면 위 파일을 다른 데로 옮기고 다시 돌리세요.");
  console.log("");
  process.exit(0);
}

// ── 2. GitHub 주인 이름 ─────────────────────────────────────
console.log("  버전을 올려 둘 자리를 정합니다.");
console.log("  GitHub 주소가 이런 모양이면 —");
console.log("      https://github.com/【주인이름】/tongdol-note");
console.log("");
const 주인 = 물어보기("GitHub 주인 이름: ", "");
if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(주인)) {
  나가기("주인 이름이 GitHub 이름 모양이 아닙니다. 영문·숫자·붙임표만 됩니다.");
}
const 저장소 = "tongdol-note";
const 주소 = `https://github.com/${주인}/${저장소}/releases/latest/download`;

// ── 3. 열쇠 만들기 ──────────────────────────────────────────
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const 개인pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const 공개b64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");

mkdirSync(열쇠방, { recursive: true });
writeFileSync(개인열쇠길, 개인pem, "utf8");
try { chmodSync(개인열쇠길, 0o600); } catch { }
writeFileSync(join(열쇠방, "읽어보기.txt"),
  [
    "통돌 Note — 업데이트 서명 열쇠",
    "",
    "개인열쇠.pem 은 **새 버전을 낼 때 서명하는 데** 씁니다.",
    "",
    "  · 남에게 보내지 마세요. 이 파일을 가진 사람은 누구나",
    "    기관 PC 가 믿는 새 버전을 만들 수 있습니다.",
    "  · 프로젝트 폴더 안으로 옮기지 마세요. 그러면 언젠가",
    "    zip 에 딸려 들어가 기관에 나갑니다.",
    "  · **어딘가에 한 부 더 두세요.** 잃어버리면 새 열쇠를 만들고,",
    "    이미 나가 있는 기관은 손으로 한 번 갈아 끼워야 합니다.",
    "",
    `만든 날: ${new Date().toISOString().slice(0, 10)}`,
    `올릴 자리: ${주소}`,
    "",
  ].join("\n"), "utf8");

// ── 4. 프로그램에 공개쪽 심기 ───────────────────────────────
const 열쇠파일 = join(import.meta.dir, "..", "server", "업데이트열쇠.ts");
if (!existsSync(열쇠파일)) 나가기(`server/업데이트열쇠.ts 를 찾지 못했습니다.`);

let 글 = readFileSync(열쇠파일, "utf8");
const 앞 = 글;
글 = 글.replace(/export const 공개열쇠 = "[^"]*";/, `export const 공개열쇠 = "${공개b64}";`);
글 = 글.replace(/export const 기본주소 = "[^"]*";/, `export const 기본주소 = "${주소}";`);
if (글 === 앞) 나가기("업데이트열쇠.ts 에서 고칠 줄을 찾지 못했습니다. 파일이 바뀐 것 같습니다.");
writeFileSync(열쇠파일, 글, "utf8");

// 정말 들어갔는지 되읽어 봅니다.
const 다시 = readFileSync(열쇠파일, "utf8");
if (!다시.includes(공개b64) || !다시.includes(주소)) 나가기("적어 넣었는데 되읽으니 없습니다. 손으로 확인해 주세요.");

console.log("");
console.log("  다 됐습니다.");
console.log("");
console.log(`    개인 열쇠   ${개인열쇠길}`);
console.log("                ← 남에게 보내지 마세요. 한 부 더 두세요.");
console.log(`    공개 열쇠   server\\업데이트열쇠.ts 에 넣었습니다`);
console.log(`    올릴 자리   ${주소}`);
console.log("");
console.log("  다음에 하실 일");
console.log("    1. 「통돌Note 만들기.bat」으로 새 버전을 만듭니다");
console.log("    2. 끝에 생기는 「올릴것」 폴더의 파일 세 개를 GitHub 에 올립니다");
console.log("       (자세한 것은 「업데이트 올리는 법.md」)");
console.log("");
