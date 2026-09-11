/**
 * **바탕화면 아이콘이 뿌옇지 않은지** 봅니다 —  bun 아이콘시험.ts
 *
 * ── 왜 있나 (2026-09-11) ───────────────────────────────────
 *
 * 무무 님이 바탕화면 아이콘이 뿌옇다고 하셨습니다. 두 번 걸렸습니다.
 *
 * 【첫 번째 — 반만 맞았습니다】
 *   .ico 안의 열 장이 전부 PNG 로 눌려 있었고, 125%·150% 배율에서 쓰는
 *   20·40·96 이 없었습니다. BMP 로 다시 굽고 크기도 채웠습니다.
 *   **그런데도 그대로 뿌옜습니다.**
 *
 * 【진짜 까닭 — exe 안의 「아이콘 목차」】
 *   bun 은 exe 에 그림 열 장을 1~10 번으로 잘 넣습니다. 그런데 **bun
 *   본체가 갖고 있던 목차**(IDI_MYICON)를 지우지 않습니다. 거기엔
 *   「그림 한 장뿐. 256×256. 번호는 1번」이라고 적혀 있습니다.
 *
 *   윈도는 **이름 붙은 목차를 번호 목차보다 먼저** 봅니다. 그래서 그
 *   목차를 집고 **1번 그림**을 꺼냅니다. 크기 순으로 넣으면 1번은
 *   **16×16** — 윈도는 여태 16×16 을 48 로, 96 으로 **늘려서** 그리고
 *   있었습니다.
 *
 * 【고친 법】
 *   .ico 에 **큰 것부터** 담습니다. 그러면 1번이 256×256 이 되어
 *   IDI_MYICON 이 적어 둔 것과 맞습니다. 아래에서 그 차례를 셉니다.
 *
 * 아이콘은 **한 번 만들면 다시 안 보게 되는 물건**이라, 조용히 나빠지면
 * 아무도 안 알아챕니다. 그래서 셉니다.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, 참: boolean, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}

const 길 = join(import.meta.dir, "도구", "아이콘.ico");
console.log("\n── 도구/아이콘.ico ────────────────────────────────────\n");
본다("아이콘 파일이 있다", existsSync(길));
if (!existsSync(길)) { console.log("\n0가지 중 0가지 통과, 1가지 실패\n"); process.exit(1); }

const d = readFileSync(길);
본다("ICO 파일이 맞다", d.readUInt16LE(0) === 0 && d.readUInt16LE(2) === 1);

const 장수 = d.readUInt16LE(4);
type 칸 = { 크기: number; 꼴: string; 바이트: number };
const 칸들: 칸[] = [];
for (let i = 0; i < 장수; i++) {
  const o = 6 + i * 16;
  const 크기 = d[o] || 256;
  const 길이 = d.readUInt32LE(o + 8);
  const 자리 = d.readUInt32LE(o + 12);
  const 머리 = d.subarray(자리, 자리 + 8);
  const png = 머리[0] === 0x89 && 머리[1] === 0x50 && 머리[2] === 0x4e && 머리[3] === 0x47;
  칸들.push({ 크기, 꼴: png ? "PNG" : "BMP", 바이트: 길이 });
}
console.log("   " + 칸들.map((x) => `${x.크기}${x.꼴 === "PNG" ? "P" : ""}`).join(" · "));

/*
 * ★ 윈도가 배율마다 찾는 크기입니다.
 *   100% → 16·32·48 · 125% → 20·40 · 150% → 24·48 · 200% → 32·64·96
 *   하나라도 없으면 그 배율에서 늘려 그립니다.
 */
for (const 크기 of [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]) {
  본다(`${크기}×${크기} 장이 있다`, 칸들.some((x) => x.크기 === 크기));
}

const 작은것 = 칸들.filter((x) => x.크기 < 256);
본다("★★ 256 아닌 크기는 **전부 BMP** 다",
  작은것.length > 0 && 작은것.every((x) => x.꼴 === "BMP"),
  작은것.filter((x) => x.꼴 !== "BMP").map((x) => `${x.크기}=PNG`).join(" ") || "");

const 큰것 = 칸들.find((x) => x.크기 === 256);
본다("256 은 PNG 다 (BMP 면 파일이 1MB 를 넘습니다)", 큰것?.꼴 === "PNG", 큰것?.꼴 ?? "없음");

본다("빈 장이 없다", 칸들.every((x) => x.바이트 > 0));

/* 원본이 남아 있어야 언제든 다시 지을 수 있습니다. */
본다("원본 아이콘-1024.png 이 남아 있다",
  existsSync(join(import.meta.dir, "도구", "아이콘-1024.png")),
  "이게 없으면 다시 지을 수 없습니다");
본다("다시 짓는 도구가 남아 있다",
  existsSync(join(import.meta.dir, "도구", "아이콘만들기.py")));


console.log("\n── ★ 큰 것이 1번이라야 합니다 ─────────────────────────\n");
{
  /*
   * 이 한 줄이 이번 일의 핵심입니다. .ico 에 적힌 차례가 그대로 exe 안의
   * 번호(1,2,3…)가 되고, exe 에 남아 있는 옛 목차는 **늘 1번**을 가리킵니다.
   * 작은 것이 1번이면 윈도가 그것을 늘려 그립니다.
   */
  본다("★★ 맨 앞 장이 가장 큰 장이다 (1번 = 256)",
    칸들.length > 0 && 칸들[0].크기 === Math.max(...칸들.map((x) => x.크기)),
    칸들.length ? `맨 앞 = ${칸들[0].크기}` : "");
  본다("크기가 큰 것부터 작은 것 차례다",
    칸들.every((x, i) => i === 0 || 칸들[i - 1].크기 > x.크기),
    칸들.map((x) => x.크기).join(">"));
}

console.log("\n── 배포본에도 담기나 ──────────────────────────────────\n");
{
  /*
   * install.ps1 은 바로가기에 `도구\아이콘.ico` 를 댑니다. 그런데 build.ps1
   * 이 그 파일을 안 담아서, 그 줄은 **한 번도 돌지 않았습니다.**
   */
  const 빌드길 = join(import.meta.dir, "build.ps1");
  if (existsSync(빌드길)) {
    const 빌드 = readFileSync(빌드길, "utf8");
    본다("★ build.ps1 이 아이콘.ico 를 배포본에 담는다",
      /보낼도구\s*\+=\s*\$아이콘파일/.test(빌드),
      "안 담으면 바로가기가 exe 목차를 거칩니다");
  }
  const 인길 = join(import.meta.dir, "install.ps1");
  if (existsSync(인길)) {
    const 인 = readFileSync(인길, "utf8");
    본다("install.ps1 이 바로가기에 그것을 댄다",
      /IconLocation\s*=\s*\$아이콘/.test(인));
  }
}

console.log("\n── 만들어진 exe 안의 아이콘 목차 ──────────────────────\n");
{
  /*
   * 여기가 이번에 놓쳤던 자리입니다. .ico 가 아무리 멀쩡해도 exe 안의
   * **목차**가 엉뚱한 번호를 가리키면 뿌옇게 나옵니다. exe 가 있을 때만
   * 봅니다 (만들기 전에는 없는 것이 정상입니다).
   */
  const exe길 = [join(import.meta.dir, "tongdol-note.exe"),
                 join(import.meta.dir, "통돌Note.exe")].find((p) => existsSync(p));
  if (!exe길) {
    console.log("   (아직 만든 exe 가 없어 건너뜁니다 — 「통돌Note 만들기.bat」뒤에 다시 보세요)");
  } else {
    const b = readFileSync(exe길);
    const e = b.readUInt32LE(0x3c);
    const 섹수 = b.readUInt16LE(e + 6);
    const 옵크기 = b.readUInt16LE(e + 20);
    const 매직 = b.readUInt16LE(e + 24);
    const dd = e + 24 + (매직 === 0x20b ? 112 : 96) + 2 * 8;
    const 자원rva = b.readUInt32LE(dd);
    const 섹들: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 섹수; i++) {
      const o = e + 24 + 옵크기 + 40 * i;
      섹들.push([b.readUInt32LE(o + 12), b.readUInt32LE(o + 8),
                 b.readUInt32LE(o + 16), b.readUInt32LE(o + 20)]);
    }
    const 자리 = (rva: number) => {
      for (const [vad, vsz, rsz, rof] of 섹들)
        if (rva >= vad && rva < vad + Math.max(vsz, rsz)) return rof + (rva - vad);
      return -1;
    };
    const 밑 = 자리(자원rva);
    const 목록 = (off: number) => {
      const 이름수 = b.readUInt16LE(밑 + off + 12);
      const 번호수 = b.readUInt16LE(밑 + off + 14);
      const 나온것: Array<{ 이름붙음: boolean; 키: number; 값: number }> = [];
      for (let i = 0; i < 이름수 + 번호수; i++) {
        const o = 밑 + off + 16 + 8 * i;
        나온것.push({ 이름붙음: i < 이름수, 키: b.readUInt32LE(o) & 0x7fffffff, 값: b.readUInt32LE(o + 4) });
      }
      return 나온것;
    };
    const 잎 = (값: number) => {
      const de = 밑 + (값 & 0x7fffffff);
      return { 자리: 자리(b.readUInt32LE(de)), 길이: b.readUInt32LE(de + 4) };
    };

    const 그림: Record<number, number> = {};   // 번호 → 실제 가로 픽셀
    const 목차들: Array<{ 이름붙음: boolean; 칸: Array<{ 폭: number; 번호: number }> }> = [];

    for (const t of 목록(0)) {
      if (t.키 !== 3 && t.키 !== 14) continue;
      for (const n of 목록(t.값 & 0x7fffffff)) {
        for (const l of 목록(n.값 & 0x7fffffff)) {
          const { 자리: dof } = 잎(l.값);
          if (t.키 === 3) {
            const png = b[dof] === 0x89 && b[dof + 1] === 0x50;
            그림[n.키] = png ? b.readUInt32BE(dof + 16) : b.readInt32LE(dof + 4);
          } else {
            const 수 = b.readUInt16LE(dof + 4);
            const 칸: Array<{ 폭: number; 번호: number }> = [];
            for (let i = 0; i < 수; i++) {
              const o = dof + 6 + 14 * i;
              칸.push({ 폭: b[o] || 256, 번호: b.readUInt16LE(o + 12) });
            }
            목차들.push({ 이름붙음: n.이름붙음, 칸 });
          }
          break;                       // 말(언어) 하나만 보면 됩니다
        }
      }
    }

    본다("exe 안에 아이콘 그림이 들어 있다", Object.keys(그림).length > 0,
      `${Object.keys(그림).length}장`);
    본다("exe 안에 아이콘 목차가 있다", 목차들.length > 0, `${목차들.length}개`);

    /* 윈도는 이름 붙은 목차를 먼저 봅니다 — 그것이 곧 바탕화면 아이콘입니다. */
    const 먼저 = 목차들.find((g) => g.이름붙음) ?? 목차들[0];
    if (먼저) {
      const 큰것 = Math.max(...먼저.칸.map((c) => c.폭));
      const 실제 = 그림[먼저.칸.find((c) => c.폭 === 큰것)!.번호] ?? 0;
      console.log(`   윈도가 집는 목차 — ${먼저.칸.map((c) => `${c.폭}(→${c.번호}번)`).join(" · ")}`);
      본다("★★ 윈도가 집는 목차의 그림이 **정말 그 크기다**",
        실제 >= 큰것,
        `적힌 크기 ${큰것} · 실제 그림 ${실제}`);
      본다("★ 그 그림이 128 보다 작지 않다 (작으면 늘려 그립니다)", 실제 >= 128,
        `${실제}px`);
    }

    /* 모든 목차가 제 크기를 가리켜야 합니다. */
    let 어긋남 = 0;
    for (const g of 목차들)
      for (const c of g.칸)
        if ((그림[c.번호] ?? 0) < c.폭) 어긋남++;
    본다("목차에 적힌 크기와 실제 그림 크기가 다 맞는다", 어긋남 === 0,
      어긋남 ? `${어긋남}군데 어긋남` : "");
  }
}

console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
process.exit(실패수 ? 1 : 0);
