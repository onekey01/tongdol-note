/**
 * **두 번 눌러 쓰는 파일**(.bat)이 성한지 봅니다 —  bun 눌러쓰는파일시험.ts
 *
 * ── 왜 있나 ────────────────────────────────────────────────
 *
 * 2026-09-11. 무무 님이 「서명열쇠 만들기.bat」을 누르니 검은 창에
 * 이런 것들이 쏟아졌습니다.
 *
 *     'ote'은(는) 내부 또는 외부 명령... 이 아닙니다.
 *     'e-click'은(는) ...
 *     'project'은(는) ...
 *     'ASCII'은(는) ...
 *
 * 영어 주석의 **낱말 가운데 토막들**입니다. 까닭은 둘이었습니다 —
 *
 *   ① 줄끝이 **LF** 뿐이었습니다 (윈도 .bat 은 CRLF 라야 합니다)
 *   ② 한글 경로를 .bat 안에 **직접** 적고 있었습니다
 *
 * cmd.exe 는 .bat 의 바이트를 기계 코드 페이지로 읽고 **바이트 자리로**
 * 되짚어 갑니다. 둘 중 하나만 어긋나도 자리가 밀려 낱말 가운데부터
 * 다시 읽고, 그 토막을 명령으로 실행하려 듭니다.
 *
 * ★ 기관 PC 에서 이런 일이 나면 **아무도 못 고칩니다.** 그래서 셉니다.
 *
 * ── 같이 보는 것 ───────────────────────────────────────────
 *
 * 「통돌Note 갈아끼우기.bat」— 기관이 「지금 업데이트」를 누르면
 * 마지막에 이 파일이 프로그램을 바꿔 낍니다. 그런데 **배포본에 안
 * 들어가고 있었습니다.** 받기까지 다 되고 마지막 한 걸음에서 멎습니다.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, 참: boolean, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}

const 뿌리 = import.meta.dir;

console.log("\n── .bat 은 ASCII · CRLF 라야 합니다 ────────────────────\n");

const 바트들 = readdirSync(뿌리).filter((n) => n.toLowerCase().endsWith(".bat"));
본다("두 번 눌러 쓰는 파일을 찾았다", 바트들.length > 0, `${바트들.length}개`);

for (const 이름 of 바트들.sort()) {
  const b = readFileSync(join(뿌리, 이름));
  const 높은 = [...b].filter((x) => x > 127).length;
  const cr = [...b].filter((x) => x === 13).length;
  const lf = [...b].filter((x) => x === 10).length;

  본다(`${이름} — ASCII 뿐이다`, 높은 === 0,
    높은 ? `ASCII 밖 바이트 ${높은}개 — 한글을 .ps1 로 옮기세요` : "");
  본다(`${이름} — 줄끝이 CRLF 다`, lf > 0 && cr >= lf,
    cr >= lf ? "" : `CR ${cr} · LF ${lf} — LF 뿐이면 cmd 가 낱말 가운데부터 읽습니다`);
}

console.log("\n── 한글 일은 .ps1 이 합니다 ────────────────────────────\n");
{
  const 짝 = [
    ["서명열쇠 만들기.bat", "signkey.ps1"],
    ["통돌Note 만들기.bat", "build.ps1"],
    ["통돌Note 설치.bat", "install.ps1"],
    ["통돌Note 시작.bat", "run.ps1"],
    ["깃 올리기.bat", "gitpush.ps1"],
    ["깃 청소.bat", "gitclean.ps1"],
  ] as const;
  for (const [바트, 피에스] of 짝) {
    if (!existsSync(join(뿌리, 바트))) continue;
    본다(`${바트} 의 짝 ${피에스} 가 있다`, existsSync(join(뿌리, 피에스)),
      "하나만 있으면 눌러도 아무 일이 없습니다");
    if (existsSync(join(뿌리, 피에스))) {
      const b = readFileSync(join(뿌리, 피에스));
      const 한글있나 = [...b].some((x) => x > 127);
      const bom = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;
      본다(`  ${피에스} — 한글이 있으면 UTF-8 BOM 이 붙어 있다`,
        !한글있나 || bom,
        한글있나 ? (bom ? "BOM 있음" : "✗ BOM 이 없어 PowerShell 이 한글을 깹니다") : "한글 없음");
    }
  }
}

console.log("\n── 자동 업데이트가 마지막에 부르는 것 ──────────────────\n");
{
  const 갈 = "통돌Note 갈아끼우기.bat";
  본다(`★ ${갈} 이 프로젝트에 있다`, existsSync(join(뿌리, 갈)));

  /*
   * 배포본(`build.ps1`)이 이 파일을 **담는지** 봅니다. 안 담으면
   * 기관 PC 에는 없고, 「지금 업데이트」가 마지막에서 멎습니다.
   */
  const 빌드 = readFileSync(join(뿌리, "build.ps1"), "utf8");
  본다("★★ build.ps1 이 그것을 배포본에 담는다",
    /Copy-Item[^\n]*갈아끼우기/.test(빌드),
    /갈아끼우기/.test(빌드) ? "" : "build.ps1 에 갈아끼우기가 한 번도 안 나옵니다");
  본다("build.ps1 이 담겼는지 끝에서 확인도 한다",
    /Check[^\n]*갈아끼우기/.test(빌드));

  /*
   * 프로그램이 찾는 이름과 **글자 하나까지** 같아야 합니다.
   * 이름이 어긋나면 「폴더에 없습니다」로 끝납니다.
   */
  const 업 = readFileSync(join(뿌리, "server", "업데이트.ts"), "utf8");
  const m = /join\(process\.cwd\(\),\s*"([^"]+\.bat)"\)/.exec(업);
  본다("프로그램이 찾는 이름과 파일 이름이 같다",
    !!m && m[1] === 갈, m ? `프로그램은 「${m[1]}」을 찾습니다` : "찾는 줄을 못 봤습니다");
}

console.log("\n── install.ps1 이 그것을 깔린 폴더에 남기나 ────────────\n");
{
  const 인 = readFileSync(join(뿌리, "install.ps1"), "utf8");
  /* 이름으로 빼는 것들만 안 따라갑니다. 갈아끼우기는 그 목록에 없어야 합니다. */
  본다("★ install.ps1 이 갈아끼우기를 빼지 않는다",
    !/\$것\.Name -eq "통돌Note 갈아끼우기\.bat"/.test(인),
    "빼면 깔린 폴더에 없어 업데이트가 마지막에서 멎습니다");
}

console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
process.exit(실패수 ? 1 : 0);
