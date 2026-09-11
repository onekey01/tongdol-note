/**
 * 한글 문서(.hwpx) → PDF.
 *
 * ── 왜 우리가 그리지 않는가 ──────────────────────────────────────
 * 지자체에 내는 서류는 **서식이 완전히 같아야 하고 확장자만 달라야** 합니다.
 * PDF 를 직접 그리면 글꼴·선 굵기·여백·용지가 전부 우리가 정한 값이 되어,
 * 아무리 비슷하게 맞춰도 **같은 서식이 아닙니다.**
 * (한 번 그렇게 만들었다가 되돌렸습니다 — `남은일.md` 에 적어 두었습니다.)
 *
 * 그래서 **한글에게 시킵니다.** 사람이 하던 일을 그대로 대신할 뿐입니다.
 *
 * ── 「PDF 로 저장」이 아니라 「인쇄」인 이유 ─────────────────────
 * 한글 2022 의 「PDF 로 저장」은 **한 줄에 칸이 7개 이상인 표의 마지막 칸을
 * 통째로 빠뜨립니다.** 기록지의 「직접 서비스 제공일」 칸이 그래서 사라졌습니다.
 * 우리가 만든 파일만이 아니라 **아무것도 안 채운 원본 서식, 한컴이 배포한
 * 작성예시도 똑같이** 사라집니다 (2026-08 확인). 한글의 화면·미리보기는 멀쩡하니
 * 내보내기 쪽 문제입니다.
 * 그래서 윈도우 기본 프린터인 「Microsoft Print to PDF」로 **인쇄**합니다.
 * 종이에 뽑는 것과 같은 길이라 화면에 보이는 그대로 나옵니다.
 *
 * ── 되는 곳 ─────────────────────────────────────────────────────
 * **한글이 깔린 윈도우 PC**에서만 됩니다. 그 밖에서는 못 합니다.
 * 못 하는 경우에도 **hwpx 는 그대로 받을 수 있습니다** —
 * 한글에서 열어 **인쇄 → Microsoft Print to PDF** 로 뽑으시면 됩니다.
 * (한글의 「PDF로 저장」은 위에 적은 이유로 칸을 빠뜨리니 쓰지 마세요.)
 */

import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { 일감시작, 일감끝 } from "./지킴이";

export type 변환할것 = { name: string; data: Buffer };
export type 변환결과 = { name: string; pdf: Buffer };

/**
 * 변환기를 쓸 수 있는 환경인가. 화면에서 PDF 단추를 보일지 정하는 데 씁니다.
 *
 * 한글이 정말 깔려 있는지까지 봅니다 — 윈도우라고 다 있는 것이 아닙니다.
 * 레지스트리에 `HWPFrame.HwpObject` 가 등록돼 있으면 한글이 있는 것입니다.
 * 한 번 확인하고 기억해 둡니다 (화면을 열 때마다 물어보면 느립니다).
 */
let 확인기억: { 된다: boolean; 왜: string } | null = null;
export function 쓸수있나(): { 된다: boolean; 왜: string } {
  if (확인기억) return 확인기억;

  const 답 = (된다: boolean, 왜: string) => (확인기억 = { 된다, 왜 });

  if (process.platform !== "win32")
    return 답(false, "한글은 윈도우에서만 돕니다. 이 프로그램은 지금 윈도우가 아닌 곳에서 돌고 있습니다.");
  if (!스크립트경로())
    return 답(false, "「도구/한글PDF변환.ps1」 파일을 못 찾았습니다. 프로그램 폴더에 함께 있어야 합니다.");

  try {
    const r = Bun.spawnSync(["reg", "query", "HKCR\\HWPFrame.HwpObject"],
                            { stdout: "pipe", stderr: "pipe" });
    if (r.exitCode !== 0)
      return 답(false, "이 PC 에서 한글(HWP)을 찾지 못했습니다. 한글이 깔린 PC 에서만 PDF 로 바꿀 수 있습니다.");
  } catch {
    // 레지스트리를 못 읽으면 있다고 보고 넘어갑니다 — 진짜 없으면 변환할 때 알려 줍니다.
  }
  return 답(true, "");
}

function 스크립트경로(): string | null {
  for (const p of [
    join(process.cwd(), "도구", "한글PDF변환.ps1"),
    join(import.meta.dir, "..", "도구", "한글PDF변환.ps1"),
  ]) if (existsSync(p)) return p;
  return null;
}

/**
 * 여러 hwpx 를 한 번에 PDF 로. **한글을 한 번만 띄웁니다** —
 * 파일마다 켰다 끄면 40명에 몇 분씩 걸립니다.
 */
export async function 변환(것들: 변환할것[]): Promise<변환결과[]> {
  const 확인 = 쓸수있나();
  if (!확인.된다) throw new Error(확인.왜);
  if (것들.length === 0) return [];

  /*
   * 한글을 불러서 도는 일이라 40명이면 몇 분 걸립니다.
   * 그 사이 사람이 브라우저 창을 닫아도 **프로그램이 꺼지면 안 됩니다** —
   * 반쯤 만든 파일이 남고, 다시 뽑아야 하는지 아닌지도 알 수 없습니다.
   * 도는 동안 지킴이의 시계를 멈춰 둡니다.
   */
  일감시작();
  const 방 = mkdtempSync(join(tmpdir(), "tongdol-pdf-"));
  try {
    const 줄: string[] = [];
    const 짝: { hwpx: string; pdf: string; name: string }[] = [];
    것들.forEach((f, i) => {
      const hwpx = join(방, `${i}.hwpx`);
      const pdf = join(방, `${i}.pdf`);
      writeFileSync(hwpx, f.data);
      줄.push(`${hwpx}\t${pdf}`);
      짝.push({ hwpx, pdf, name: f.name.replace(/\.hwpx$/i, ".pdf") });
    });
    const 목록 = join(방, "목록.txt");
    writeFileSync(목록, 줄.join("\r\n"), "utf8");

    /*
     * 매개변수 이름은 **영문**입니다 (-ListFile).
     * 한글로 지었다가 윈도우 PowerShell 5.1 이 스크립트를 CP949 로 잘못 읽어
     * 통째로 깨졌습니다. 스크립트도 UTF-8 **BOM** 으로 저장해 두었습니다.
     */
    const proc = Bun.spawnSync([
      "powershell.exe", "-NoProfile", "-NonInteractive",
      "-ExecutionPolicy", "Bypass",
      "-File", 스크립트경로()!,
      "-ListFile", 목록,
    ], { stdout: "pipe", stderr: "pipe" });

    const 나온말 = new TextDecoder().decode(proc.stdout) +
                   new TextDecoder().decode(proc.stderr);

    const 결과: 변환결과[] = [];
    const 못한것: string[] = [];
    for (const s of 짝) {
      if (existsSync(s.pdf)) 결과.push({ name: s.name, pdf: readFileSync(s.pdf) });
      else 못한것.push(s.name);
    }

    if (결과.length === 0)
      throw new Error(
        "한글로 PDF 를 만들지 못했습니다.\n\n" +
        (나온말.trim() || "(한글이 아무 말도 하지 않았습니다)") +
        "\n\n한글이 깔려 있는지 확인해 주세요. " +
        "그동안은 「한글」 단추로 hwpx 를 받아 한글에서 「PDF로 저장」 하시면 됩니다."
      );
    if (못한것.length)
      console.warn("PDF 로 못 바꾼 것:", 못한것.join(", "), "\n", 나온말.trim());

    return 결과;
  } finally {
    try { rmSync(방, { recursive: true, force: true }); } catch { }
    일감끝();
  }
}

/**
 * 여러 PDF 를 한 파일로 잇습니다.
 *
 * **쪽 내용은 손대지 않습니다** — 한글이 만든 쪽을 그대로 옮겨 담을 뿐입니다.
 * 지자체에 메일로 보낼 때 파일이 하나면 편하고, 인쇄를 한 번에 걸 수 있습니다.
 */
export async function 한파일로(들: 변환결과[]): Promise<Buffer> {
  if (들.length === 1) return 들[0].pdf;
  const out = await PDFDocument.create();
  for (const one of 들) {
    const src = await PDFDocument.load(one.pdf);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  return Buffer.from(await out.save());
}
