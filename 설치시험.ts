/**
 * 설치 파일 — **눌러서 돌려 봅니다** (2026-09-08 무무 지시).
 *
 *   bun 설치시험.ts
 *
 * ── ★ 이 시험이 왜 있나 ★ ──────────────────────────────────
 *
 * 설치 파일은 **기관이 제일 먼저 만나는 것**이고, 여기서 어긋나면
 * 그 뒤의 모든 것이 소용없습니다. 그런데 이건 윈도에서 도는 것이라
 * 「파일럿 PC 에서 봐 주세요」로 미루기 쉽습니다 — 그러면 아무도
 * 안 봅니다.
 *
 * 그래서 **PowerShell 을 이 컨테이너에 받아서 진짜로 돌립니다.**
 * 윈도만 되는 것(바로가기·꼬리표 떼기)은 못 보지만, **자료를 지키는
 * 규칙**은 여기서 다 볼 수 있습니다.
 *
 * ── 여기서 보는 것 ─────────────────────────────────────────
 *   1) 압축을 안 푼 자리(임시 폴더)에서는 **멈춘다** ★ 자료가 사라지는 길
 *   2) exe 가 없으면 멈춘다
 *   3) Program Files 는 **거절한다**
 *   4) ★★ **자료함(data\)을 절대 안 덮어쓴다** — 다시 깔아도 그대로
 *   5) 챙길 것이 다 따라간다
 *   6) 설치 파일 한 쌍은 **안 따라간다**
 *   7) 검은 창에 **별표(**)가 안 보인다**
 *   8) 「통돌Note 설치.bat」은 **한글이 한 글자도 없다** (cmd 가 깨뜨립니다)
 *   9) install.ps1 은 **BOM 이 있다** (없으면 한글이 깨집니다)
 *  10) 「통돌Note 만들기.bat」이 설치 파일을 **zip 에 넣어 보낸다**
 */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const PWSH = "/opt/pwsh/pwsh";
const 뿌리 = import.meta.dir;

let 통과수 = 0, 실패수 = 0;
function 통과해야(무엇: string, 참: unknown, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}

/** 받은 것(압축 푼 폴더)을 시늉으로 하나 차립니다. */
function 받은것차리기(자리: string) {
  mkdirSync(자리, { recursive: true });
  for (const d of ["dist-web", "서식", "글꼴", "도구"]) mkdirSync(join(자리, d), { recursive: true });
  writeFileSync(join(자리, "통돌Note.exe"), Buffer.alloc(22 * 1024 * 1024, 7));
  writeFileSync(join(자리, "dist-web", "index.html"), "<html></html>");
  writeFileSync(join(자리, "서식", "모니터링 기록지(서식9).hwpx"), "x");
  writeFileSync(join(자리, "글꼴", "NanumGothic-ko.ttf"), "x");
  writeFileSync(join(자리, "도구", "아이콘.ico"), "x");
  writeFileSync(join(자리, "설치 안내.html"), "<html>안내</html>");
  writeFileSync(join(자리, "사용설명서.html"), "<html>설명서</html>");
  writeFileSync(join(자리, "통돌Note 갈아끼우기.bat"), "rem x");
  cpSync(join(뿌리, "install.ps1"), join(자리, "install.ps1"));
  cpSync(join(뿌리, "통돌Note 설치.bat"), join(자리, "통돌Note 설치.bat"));
}

async function 돌리기(폴더: string, 넣을답: string[]): Promise<string> {
  const p = Bun.spawn({
    cmd: [PWSH, "-NoProfile", "-File", join(폴더, "install.ps1")],
    cwd: 폴더, stdin: "pipe", stdout: "pipe", stderr: "pipe",
  });
  p.stdin.write(넣을답.join("\n") + "\n"); p.stdin.end();
  const [o, e] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  await p.exited;
  return o + e;
}

const 터 = mkdtempSync(join(tmpdir(), "설치시험-"));
try {
  if (!existsSync(PWSH)) throw new Error("PowerShell 이 없습니다 — " + PWSH);

  // ── 8·9. 파일 자체 ─────────────────────────────────────────
  console.log("\n── 8·9. 파일이 제대로 저장돼 있나 ──────────────────────\n");
  const bat = readFileSync(join(뿌리, "통돌Note 설치.bat"));
  통과해야("★ 「통돌Note 설치.bat」에 한글이 한 글자도 없다",
    bat.every((b) => b < 128),
    "cmd 는 .bat 을 기계 코드페이지로 읽어 한글이 있으면 깨집니다");
  통과해야("줄바꿈이 윈도 방식(CRLF)이다", bat.includes(Buffer.from("\r\n")));
  const ps = readFileSync(join(뿌리, "install.ps1"));
  통과해야("★ install.ps1 에 BOM 이 있다", ps[0] === 0xef && ps[1] === 0xbb && ps[2] === 0xbf,
    "없으면 윈도 PowerShell 이 한글을 깨뜨립니다");
  통과해야("install.ps1 이름이 ASCII 다", /^[\x20-\x7e]+$/.test("install.ps1"));

  // ── 1. 압축을 안 푼 자리 ★ ────────────────────────────────
  console.log("\n── 1. ★ 압축을 안 풀었으면 멈추나 ★ ───────────────────\n");
  const 임시흉내 = join(터, "Temp", "Rar$EX00.123");
  받은것차리기(임시흉내);
  const 글1 = await 돌리기(임시흉내, ["", ""]);
  통과해야("★ 임시 폴더에서는 멈춘다", /압축을 아직 안 푸셨습니다/.test(글1));
  통과해야("★ 자료가 사라진다고 알려 준다", /자료가 어느 날 통째로 사라집니다/.test(글1));
  통과해야("무엇을 하라는지 셋으로 적어 준다",
    /압축 풀기/.test(글1) && /통돌Note 설치\.bat/.test(글1));
  통과해야("깔지 않았다", !existsSync(join(터, "깔린곳")));

  // ── 2. exe 가 없으면 ──────────────────────────────────────
  console.log("\n── 2. 챙길 것이 없으면 ─────────────────────────────────\n");
  const 반쪽 = join(터, "반쪽");
  mkdirSync(반쪽, { recursive: true });
  cpSync(join(뿌리, "install.ps1"), join(반쪽, "install.ps1"));
  const 글2 = await 돌리기(반쪽, ["", ""]);
  통과해야("exe 가 없으면 멈춘다", /통돌Note\.exe 가 없습니다/.test(글2));

  /* exe 는 있는데 화면(dist-web)이 없으면? — 켜도 흰 화면만 나옵니다. */
  const 반쪽2 = join(터, "반쪽2");
  받은것차리기(반쪽2);
  rmSync(join(반쪽2, "dist-web"), { recursive: true, force: true });
  const 글2b = await 돌리기(반쪽2, [join(터, "안될곳"), ""]);
  통과해야("★ 화면(dist-web)이 없으면 멈춘다", /dist-web 이\(가\) 없습니다/.test(글2b),
    "켜도 흰 화면만 나옵니다");
  통과해야("반쪽만 깔아 놓지 않는다", !existsSync(join(터, "안될곳", "통돌Note.exe")));

  /* 서식이 없으면? — 기록지를 못 뽑습니다. */
  const 반쪽3 = join(터, "반쪽3");
  받은것차리기(반쪽3);
  rmSync(join(반쪽3, "서식"), { recursive: true, force: true });
  const 글2c = await 돌리기(반쪽3, [join(터, "안될곳3"), ""]);
  통과해야("★ 서식이 없으면 멈춘다", /서식 이\(가\) 없습니다/.test(글2c),
    "기관이 군에 낼 종이를 못 뽑습니다");

  // ── 3. Program Files ──────────────────────────────────────
  console.log("\n── 3. Program Files 는 거절하나 ────────────────────────\n");
  const 받은것 = join(터, "받은것");
  받은것차리기(받은것);
  const 글3 = await 돌리기(받은것, ["C:\\Program Files\\통돌Note", ""]);
  통과해야("★ Program Files 는 거절한다", /Program Files 안에는 넣을 수 없습니다/.test(글3));
  통과해야("까닭도 말해 준다", /자료를 저장하지 못합니다/.test(글3));

  // ── 4. ★★ 자료함을 안 덮어쓰나 ★★ ────────────────────────
  console.log("\n── 4. ★★ 자료함을 안 덮어쓰나 ★★ ─────────────────────\n");
  const 깔린곳 = join(터, "깔린곳");
  mkdirSync(join(깔린곳, "data"), { recursive: true });
  writeFileSync(join(깔린곳, "data", "tongdol.db"), "기관의 소중한 자료");
  /* 받은 것에 일부러 남의 자료함을 넣어 둡니다 — 이름으로 막아야 합니다. */
  mkdirSync(join(받은것, "data"), { recursive: true });
  writeFileSync(join(받은것, "data", "tongdol.db"), "남의 자료");

  const 글4 = await 돌리기(받은것, [깔린곳, "n", ""]);
  통과해야("깔렸다", /넣었습니다/.test(글4), (글4.split("\n").find((l) => l.includes("넣었습니다")) ?? "").trim());
  통과해야("★★ **자료함이 그대로다**",
    readFileSync(join(깔린곳, "data", "tongdol.db"), "utf8") === "기관의 소중한 자료",
    readFileSync(join(깔린곳, "data", "tongdol.db"), "utf8"));
  통과해야("쓰던 자료함이라고 알려 준다", /쓰시던 자료함입니다/.test(글4));

  // ── 5·6. 무엇이 따라갔나 ──────────────────────────────────
  console.log("\n── 5·6. 무엇이 따라갔나 ────────────────────────────────\n");
  for (const n of ["통돌Note.exe", "dist-web/index.html", "서식/모니터링 기록지(서식9).hwpx",
                   "글꼴/NanumGothic-ko.ttf", "도구/아이콘.ico",
                   "설치 안내.html", "사용설명서.html", "통돌Note 갈아끼우기.bat"]) {
    통과해야(`${n} 이(가) 따라갔다`, existsSync(join(깔린곳, n)));
  }
  통과해야("★ install.ps1 은 안 따라갔다", !existsSync(join(깔린곳, "install.ps1")));
  통과해야("★ 「통돌Note 설치.bat」도 안 따라갔다",
    !existsSync(join(깔린곳, "통돌Note 설치.bat")),
    "하나만 따라가면 눌러도 아무 일이 없어 기관은 고장으로 봅니다");

  // ── 두 번 깔아도 ──────────────────────────────────────────
  console.log("\n── 다시 깔아도 자료가 그대로인가 ───────────────────────\n");
  const 글5 = await 돌리기(받은것, [깔린곳, "n", ""]);
  통과해야("두 번째는 갈아 끼운다고 말한다", /프로그램만 갈아 끼웁니다/.test(글5));
  통과해야("★★ 두 번 깔아도 자료함이 그대로다",
    readFileSync(join(깔린곳, "data", "tongdol.db"), "utf8") === "기관의 소중한 자료");

  // ── 7. 별표가 안 보이나 ───────────────────────────────────
  console.log("\n── 7. 검은 창에 별표가 안 보이나 ───────────────────────\n");
  통과해야("★ 화면에 별표(**)가 안 보인다", !글4.includes("**"),
    (글4.split("\n").find((l) => l.includes("**")) ?? "").trim().slice(0, 60));
  통과해야("꼬리표를 뗀다고 알려 준다", /꼬리표를 뗐습니다/.test(글4));
  통과해야("어디에 넣었는지 알려 준다", 글4.includes(깔린곳));
  통과해야("다음부터 무엇을 누르는지 알려 준다", /바탕화면의/.test(글4));
  통과해야("폴더를 옮기지 말라고 한다", /옮기거나 지우지 마세요/.test(글4));

  // ── 10. 만들기.bat 이 설치 파일을 넣어 보내나 ─────────────
  console.log("\n── 10. zip 에 설치 파일이 들어가나 ─────────────────────\n");
  const 빌드 = readFileSync(join(뿌리, "build.ps1"), "utf8");
  통과해야("★ 「통돌Note 설치.bat」을 보낼 폴더에 넣는다",
    빌드.includes("통돌Note 설치.bat"),
    "안 넣으면 기관은 설치 파일을 못 받습니다");
  통과해야("★ install.ps1 도 함께 넣는다", /install\.ps1/.test(빌드));
  통과해야("보내기 전에 둘 다 있는지 센다", /Check .*설치/.test(빌드));
  통과해야("★ 하나만 있으면 보내기를 멈춘다",
    /설치bat -ne \$설치ps1/.test(빌드),
    "하나만 보내면 눌러도 아무 일이 없습니다");
  /*
   * ★ 「보낼 목록」과 「셀 목록」이 **같은 글자**를 봐야 합니다.
   *   한쪽만 고치면 안 보내 놓고 있다고 세거나, 그 반대가 됩니다.
   */
  const 보냄 = /foreach \(\$n in @\(([^)]*)\)\) \{\s*\n\s*\$src = Join-Path \$root \$n/.exec(빌드);
  통과해야("★ 보낼 목록에 「통돌Note 설치.bat」이 글자로 들어 있다",
    !!보냄 && 보냄[1].includes("통돌Note 설치.bat"),
    (보냄?.[1] ?? "(목록을 못 찾음)").trim());
} catch (e: any) {
  실패수++;
  console.log(`\n✗ 시험 도중 터졌습니다 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 4).join("\n"));
} finally {
  rmSync(터, { recursive: true, force: true });
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
