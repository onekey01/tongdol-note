/**
 * **소스를 올릴 때 열쇠가 딸려 가지 않는지** 봅니다 — bun 깃올리기시험.ts
 *
 * ── 왜 있나 (2026-09-11) ───────────────────────────────────
 *
 * 소스를 GitHub 에 처음 올린 날, **열쇠가 새어 나갔습니다.**
 *
 *   · `_to_delete` 폴더가 통째로 올라갔습니다
 *   · 그 안 `_ship.tgz` · `_ship2.tgz` **묶음 안에 .env** 가 있었습니다
 *   · 저장소는 공개였습니다
 *
 * 막는 장치는 있었습니다. 다만 **파일 이름만** 보고 있었습니다.
 * 이름이 `.tgz` 였으니 그냥 지나갔습니다.
 *
 * 이런 것은 **한 번 새면 되돌릴 수 없습니다.** 지워도 기록에 남고,
 * 그 사이에 누가 받아 갔는지 알 길이 없습니다. 그래서 셉니다.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, 참: boolean, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}
const 뿌리 = import.meta.dir;

console.log("\n── .gitignore 가 막고 있나 ─────────────────────────────\n");
const 무시길 = join(뿌리, ".gitignore");
본다(".gitignore 가 있다", existsSync(무시길));
const 무시 = existsSync(무시길) ? readFileSync(무시길, "utf8") : "";
for (const 줄 of ["_to_delete/", "*.tgz", "*.zip", ".env"]) {
  본다(`★ ${줄} 를 막는다`, 무시.split(/\r?\n/).some((l) => l.trim() === 줄),
    줄 === "_to_delete/" ? "여기로 새어 나갔습니다" : "");
}

console.log("\n── 올리는 도구의 세 겹 검사 ───────────────────────────\n");
const 밀길 = join(뿌리, "gitpush.ps1");
본다("gitpush.ps1 이 있다", existsSync(밀길));
const 밀 = existsSync(밀길) ? readFileSync(밀길, "utf8") : "";
본다("① 이름으로 — .env · .pem 을 막는다", /\\\.env\(\$\|\\\.\)/.test(밀) && /\\\.pem\$/.test(밀));
본다("★★ ② 묶음 파일은 아예 안 올린다",
  /tgz\|tar\|tar\\\.gz\|zip/.test(밀), "이것이 없어서 새어 나갔습니다");
본다("★★ ③ 파일 **안**도 훑는다 (Supabase 열쇠)",
  /sb_secret_\[A-Za-z0-9_\\-\]\{12,\}/.test(밀));
본다("③ 잠긴 열쇠(PEM)도 찾는다", /BEGIN \[A-Z \]\*PRIVATE KEY/.test(밀));
본다("③ 토큰(JWT)도 찾는다", /eyJhbGciOi/.test(밀));
본다("걸리면 담아 둔 것을 되돌린다 (reset)", /깃 reset \| Out-Null/.test(밀));
본다("이름이 버전 번호면 다시 묻는다", /\^v\?\\d\+\(\\\.\\d\+\)\+\$/.test(밀),
  "이름 칸에 v1.21.36 이 들어간 일이 있었습니다");
본다("메일에 골뱅이가 없으면 다시 묻는다", /\[\^@\\s\]\+@\[\^@\\s\]\+/.test(밀));

console.log("\n── 청소 도구 ──────────────────────────────────────────\n");
본다("깃 청소.bat 이 있다", existsSync(join(뿌리, "깃 청소.bat")));
const 청길 = join(뿌리, "gitclean.ps1");
본다("그 짝 gitclean.ps1 이 있다", existsSync(청길));
const 청 = existsSync(청길) ? readFileSync(청길, "utf8") : "";
본다("기록을 처음부터 다시 쓴다", /checkout --orphan/.test(청));
본다("GitHub 을 덮어쓴다", /push --force/.test(청));
본다("★ 「네」라고 쳐야만 움직인다", /-ne "네"/.test(청), "되돌릴 수 없는 일입니다");
본다("★ 다시 쓰기 전에 한 번 더 훑는다", /나쁜이름/.test(청));
본다("열쇠는 바꿔야 한다고 말해 준다", /바꾸는 것이 해결/.test(청));

console.log("\n── 지금 폴더에 열쇠가 적힌 글 파일이 있나 ─────────────\n");
/*
 * 올리는 도구가 쓰는 것과 **같은 모양**으로 이 폴더를 훑습니다.
 * 여기서 걸리면 올릴 때도 걸립니다 — 미리 알자는 것입니다.
 * (.env 는 .gitignore 가 막으니 빼고 봅니다.)
 */
const 열쇠모양: Array<[string, RegExp]> = [
  ["Supabase 열쇠", /sb_secret_[A-Za-z0-9_\-]{12,}/],
  ["잠긴 열쇠(PEM)", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["토큰(JWT)", /eyJhbGciOi[A-Za-z0-9_\-]{24,}/],
  ["GitHub 토큰", /(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})/],
  ["AWS 열쇠", /AKIA[0-9A-Z]{16}/],
];
const 글아닌것 = /\.(png|jpg|jpeg|gif|ico|pdf|ttf|otf|woff2?|hwpx|xlsx|docx|pptx|exe|dll|db|zip|tgz|mp4|mp3|wav|b64)$/i;
const 안볼폴더 = new Set(["node_modules", "data", "dist-web", "_to_delete", ".git", "올릴것"]);
const 걸린것: string[] = [];
let 본파일 = 0;
(function 훑기(길: string, 깊이 = 0) {
  if (깊이 > 6) return;
  for (const 이름 of readdirSync(길)) {
    if (안볼폴더.has(이름) || /^통돌Note_\d/.test(이름)) continue;
    const 온길 = join(길, 이름);
    let st; try { st = statSync(온길); } catch { continue; }
    if (st.isDirectory()) { 훑기(온길, 깊이 + 1); continue; }
    if (글아닌것.test(이름) || 이름 === ".env" || 이름.endsWith(".env")) continue;
    if (st.size > 2 * 1024 * 1024) continue;
    let 속: string; try { 속 = readFileSync(온길, "utf8"); } catch { continue; }
    본파일++;
    for (const [무엇, 꼴] of 열쇠모양)
      if (꼴.test(속)) { 걸린것.push(`${온길.slice(뿌리.length + 1)}  ← ${무엇}`); break; }
  }
})(뿌리);
본다(`★★ 올라갈 글 파일에 열쇠가 안 적혀 있다`, 걸린것.length === 0,
  걸린것.length ? 걸린것.join(" · ") : `${본파일}개 훑음`);

console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
process.exit(실패수 ? 1 : 0);
