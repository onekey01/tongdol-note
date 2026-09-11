/**
 * PDF 만들기 — 한글이 안 깨지는 최소한의 조판 도구.
 *
 * ─────────────────────────────────────────────────────────────
 * 왜 직접 만들었나
 * ─────────────────────────────────────────────────────────────
 * 지자체와 어르신께 나가는 종이는 **PDF** 입니다.
 * 한글(.hwp)이 깔려 있지 않은 곳에서도 열리고, 메일로 보내기 좋고,
 * 무엇보다 **받는 쪽에서 글자가 밀리지 않습니다.**
 *
 * 그런데 PDF 에 한글을 넣는 일은 생각보다 까다롭습니다.
 * PDF 는 「글꼴을 파일 안에 같이 넣어야」 글자가 보입니다.
 * 안 넣으면 받는 사람 컴퓨터에 그 글꼴이 있어야 하는데,
 * 없으면 네모(□□□)가 됩니다.
 *
 * ─────────────────────────────────────────────────────────────
 * 글꼴에서 겪은 것 — 적어 둡니다
 * ─────────────────────────────────────────────────────────────
 * pdf-lib 에는 「쓴 글자만 골라 넣기(subset)」 기능이 있습니다.
 * 파일이 작아지니 당연히 켜야 할 것 같은데,
 * **한글 글꼴에서는 글자가 통째로 사라집니다.**
 *   「통합돌봄 서비스 이용 본인부담금 청구서」 → 「통합돌봄 서비 서」
 * 글자를 복사하면 제대로 나오는데 눈에 보이는 그림만 빠집니다.
 * 그래서 더 무섭습니다 — 뽑아 보기 전엔 모릅니다.
 *
 * 그래서 반대로 했습니다.
 *   1. 글꼴을 **미리** 잘라 둡니다 (한글 음절 11,172자 전부 + 기호).
 *      4.6MB → 1.26MB 로 줄었고, 어떤 이름·주소가 와도 글자가 있습니다.
 *   2. PDF 에 넣을 때는 subset 을 **끕니다.** 그래야 안 사라집니다.
 *
 * 글꼴은 나눔고딕입니다 (SIL Open Font License 1.1 — 함께 배포 가능).
 * 프로그램 안에 같이 넣어 두었으므로 따로 설치할 것이 없습니다.
 *
 * ─────────────────────────────────────────────────────────────
 * 체크박스는 글자로 안 씁니다
 * ─────────────────────────────────────────────────────────────
 * ☑ 같은 글자는 글꼴마다 있기도 하고 없기도 합니다.
 * 없으면 빈칸이 되므로 **네모와 체크를 선으로 직접 그립니다.**
 */

import { PDFDocument, PDFFont, PDFPage, rgb, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import 본문글꼴 from "../글꼴/NanumGothic-ko.ttf" with { type: "file" };
import 굵은글꼴 from "../글꼴/NanumGothicBold-ko.ttf" with { type: "file" };
// 나눔고딕에 없는 기호(☑ ☐ 등)만 담은 4KB짜리 글꼴. 서식의 글자를 그대로 찍으려고 둡니다.
import 기호글꼴 from "../글꼴/Symbols-ko.ttf" with { type: "file" };

/* ── 종이 ─────────────────────────────────────────────── */
export const A4 = { w: 595.28, h: 841.89 };   // 210 × 297 mm
export const mm = (v: number) => (v * 72) / 25.4;

export const 검정 = rgb(0, 0, 0);
export const 회색 = rgb(0.45, 0.45, 0.45);
export const 연회색 = rgb(0.93, 0.93, 0.93);
export const 줄색 = rgb(0.25, 0.25, 0.25);

/* ── 글꼴 읽기 ─────────────────────────────────────────── */
/**
 * 프로그램에 같이 넣어 둔 글꼴을 씁니다.
 * 혹시 못 찾으면 프로그램 폴더의 「글꼴」 안을 봅니다
 * (개발 중에 글꼴만 바꿔 보고 싶을 때를 위해서입니다).
 */
async function 글꼴읽기(포함: string, 이름: string): Promise<Buffer> {
  for (const p of [
    join(process.cwd(), "글꼴", 이름),
    join(import.meta.dir, "..", "글꼴", 이름),
  ]) if (existsSync(p)) return readFileSync(p);
  return Buffer.from(await Bun.file(포함).arrayBuffer());
}

/* ── 글꼴에 없는 글자 ───────────────────────────────────── */
/**
 * 글꼴에 없는 글자는 **소리 없이 사라집니다.**
 *
 * 이모지나 한자를 이름·주소에 넣으면 PDF 가 만들어지긴 하는데
 * 그 자리만 빈칸이 됩니다. 오류도 안 나고 로그도 안 남습니다.
 * 계약서에서 이런 식으로 글자가 없어지면 아무도 모르고 넘어갑니다.
 *
 * 그래서 **눈에 보이게** 바꿉니다 — 「□」로 찍히면 뽑아 본 사람이 바로 압니다.
 * 글꼴이 그 글자를 아는지는 글꼴 자신에게 물어봅니다 (목록을 따로 안 들고 있어야
 * 나중에 글꼴을 바꿔도 어긋나지 않습니다).
 */
const 없는글자 = "□";
function 글자있나(font: PDFFont, cp: number): boolean {
  const inner: any = (font as any).embedder?.font;
  if (typeof inner?.hasGlyphForCodePoint !== "function") return true;  // 못 물어보면 통과
  try { return !!inner.hasGlyphForCodePoint(cp); } catch { return true; }
}

/**
 * 나눔고딕에 **없는 기호**를 위한 작은 글꼴을 하나 더 둡니다.
 *
 * 관공서 서식에는 ☑ ☐ 같은 글자가 그대로 박혀 있습니다.
 * 나눔고딕에는 이 글자가 없어서 예전에는 「□」로 바꿔 찍었는데,
 * **제출 서류의 글자를 우리가 바꾸면 안 됩니다.**
 * 그래서 그 글자들만 담은 4KB짜리 글꼴(DejaVu 에서 잘라 냄)을 같이 넣고,
 * 글자마다 **어느 글꼴로 찍을지 갈라서** 찍습니다.
 * 서식에 적힌 글자를 그대로 찍는 것이 목적입니다.
 */
export type 조각 = { t: string; f: PDFFont };

/* ── 글 나누기 ─────────────────────────────────────────── */
/**
 * 한 줄에 안 들어가면 나눕니다.
 *
 * 한글은 글자 사이 아무 데서나 나뉘어도 되지만
 * 영어·숫자는 낱말 가운데서 자르면 읽기 나쁩니다.
 * 그래서 **한글은 한 글자씩, 영문·숫자는 낱말째로** 다룹니다.
 * 여는 괄호 앞과 닫는 괄호·쉼표·마침표 앞에서는 자르지 않습니다.
 */
const 뒤에붙는것 = new Set([...".,)]}」』〉》%원건회명일월년:;!?…·"]);
const 앞에붙는것 = new Set([...`([{「『〈《₩$`]);

function 낱말들(s: string): string[] {
  const out: string[] = [];
  let buf = "";
  const 라틴 = (c: string) => /[0-9A-Za-z@.\-_/]/.test(c);
  for (const c of s) {
    if (라틴(c)) { buf += c; continue; }
    if (buf) { out.push(buf); buf = ""; }
    out.push(c);
  }
  if (buf) out.push(buf);
  return out;
}

/**
 * 한 줄에 안 들어가면 나눕니다.
 * 폭을 재는 일은 밖에서 받습니다(`재기`) — 글꼴이 섞여 있어도 같은 셈을 쓰려는 것입니다.
 */
export function 줄나누기(
  s: string, 재기: (t: string) => number, 폭: number
): string[] {
  const 결과: string[] = [];
  for (const 단락 of String(s ?? "").split("\n")) {
    if (단락 === "") { 결과.push(""); continue; }
    const ws = 낱말들(단락);
    let line = "";
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i];
      const 후보 = line + w;
      if (line && 재기(후보) > 폭) {
        // 닫는 부호는 앞 줄에 매답니다 — 줄 첫머리에 「)」가 오면 보기 싫습니다.
        if (뒤에붙는것.has(w) && line) { 결과.push(line + w); line = ""; continue; }
        // 여는 부호는 다음 줄로 데려갑니다.
        결과.push(line.replace(/\s+$/, ""));
        line = w === " " ? "" : w;
      } else line = 후보;
      // 여는 부호 뒤에 바로 줄이 끊기지 않게 한 글자 더 봅니다.
      if (앞에붙는것.has(w) && i + 1 < ws.length) {
        const 다음 = line + ws[i + 1];
        if (재기(다음) > 폭 && line !== w) {
          결과.push(line.slice(0, -w.length).replace(/\s+$/, ""));
          line = w;
        }
      }
    }
    결과.push(line);
  }
  return 결과.length ? 결과 : [""];
}

/* ── 표의 칸 ───────────────────────────────────────────── */
export type Cell = {
  t?: string;                 // 넣을 글 (\n 으로 줄바꿈)
  span?: number;              // 가로로 몇 칸을 먹는지
  세로?: number;               // 세로로 몇 줄을 먹는지 (표전체 에서만)
  bold?: boolean;
  size?: number;
  align?: "l" | "c" | "r";
  valign?: "t" | "m";
  fill?: RGB;
  color?: RGB;
  pad?: number;               // 사방 여백
  들여씀?: number;             // 왼쪽만 더 밀기 (pad 를 키우면 위아래까지 벌어집니다)
  lead?: number;              // 줄 간격 배수
  검정박스?: boolean;          // ■ 대신 그려 넣기
  체크?: boolean | null;       // true 체크됨 / false 빈 네모 / null 없음
  테두리없음?: boolean;
};
export type Row = { cells: Cell[]; h?: number; minH?: number };

/* ── 문서 ─────────────────────────────────────────────── */
export class Doc {
  doc!: PDFDocument;
  page!: PDFPage;
  본문!: PDFFont;
  굵게!: PDFFont;
  기호!: PDFFont;      // 본문 글꼴에 없는 기호를 받아 주는 예비 글꼴
  여백 = { 위: mm(18), 아래: mm(16), 좌: mm(18), 우: mm(18) };
  y = 0;                       // 위에서부터 잰 값
  쪽수 = 0;
  private 쪽처음 = 0;           // 이 쪽에서 글이 시작되는 자리
  private 쪽꾸미기?: (d: Doc, n: number) => void;

  static async 새로(opt?: { 여백?: Partial<Doc["여백"]> }) {
    const d = new Doc();
    d.doc = await PDFDocument.create();
    d.doc.registerFontkit(fontkit);
    // subset 은 반드시 꺼 둡니다 — 켜면 한글 글자가 사라집니다 (맨 위 설명 참고).
    d.본문 = await d.doc.embedFont(await 글꼴읽기(본문글꼴, "NanumGothic-ko.ttf"), { subset: false });
    d.굵게 = await d.doc.embedFont(await 글꼴읽기(굵은글꼴, "NanumGothicBold-ko.ttf"), { subset: false });
    d.기호 = await d.doc.embedFont(await 글꼴읽기(기호글꼴, "Symbols-ko.ttf"), { subset: false });
    if (opt?.여백) Object.assign(d.여백, opt.여백);
    d.새쪽();
    return d;
  }

  /**
   * 쪽마다 붙일 것 (쪽번호 등). 새 쪽을 열 때마다 불립니다.
   *
   * 첫 쪽은 이 함수를 걸기 **전에** 이미 열려 있습니다.
   * 그래서 여기서 지금 한 번 발라 줍니다 — 안 그러면 1쪽만 쪽번호가 빠집니다.
   * (계약서를 뽑아 보고 2쪽에만 번호가 있어서 알았습니다.)
   */
  쪽마다(fn: (d: Doc, n: number) => void) {
    this.쪽꾸미기 = fn;
    if (this.빈쪽) {
      const y = this.y;
      fn(this, this.쪽수);
      this.y = y; this.쪽처음 = y;      // 꾸미기가 커서를 건드려도 되돌립니다
    }
    return this;
  }

  새쪽() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.쪽수 += 1;
    this.y = this.여백.위;
    this.쪽꾸미기?.(this, this.쪽수);
    this.쪽처음 = this.y;
    return this.page;
  }

  /** 이 쪽에 아직 아무것도 안 그렸는가. */
  get 빈쪽() { return this.y <= this.쪽처음 + 0.01; }

  /**
   * 다음 것을 새 쪽에서 시작합니다.
   * **이미 빈 쪽이면 아무것도 하지 않습니다** — 안 그러면 백지가 한 장 낍니다.
   * 사람마다 한 장씩 나가는 청구서에서 이 구분이 필요했습니다.
   */
  쪽나누기() { if (!this.빈쪽) this.새쪽(); }

  get 폭() { return A4.w - this.여백.좌 - this.여백.우; }
  get 바닥() { return A4.h - this.여백.아래; }
  /** 위에서 잰 y 를 PDF 좌표로. */
  Y(y: number) { return A4.h - y; }
  글꼴(bold?: boolean) { return bold ? this.굵게 : this.본문; }

  /**
   * 한 줄을 **글꼴별 조각**으로 가릅니다.
   *
   * 본문 글꼴(나눔고딕)에 없는 글자는 기호 글꼴로 넘깁니다.
   * 둘 다 없으면 그때만 「□」로 바꿉니다 — 소리 없이 사라지는 것보다 낫습니다.
   */
  조각내기(s: string, bold?: boolean): 조각[] {
    const 본 = this.글꼴(bold);
    const out: 조각[] = [];
    for (const ch of String(s ?? "")) {
      const cp = ch.codePointAt(0)!;
      const f = 글자있나(본, cp) ? 본
              : 글자있나(this.기호, cp) ? this.기호
              : null;
      const t = f ? ch : 없는글자;
      const 글꼴 = f ?? 본;
      const 끝 = out[out.length - 1];
      if (끝 && 끝.f === 글꼴) 끝.t += t;
      else out.push({ t, f: 글꼴 });
    }
    return out;
  }

  폭재기(s: string, size: number, bold?: boolean) {
    return this.조각내기(s, bold)
      .reduce((w, r) => w + r.f.widthOfTextAtSize(r.t, size), 0);
  }

  /** 한 줄을 찍습니다. 글꼴이 섞여 있으면 조각마다 이어 찍습니다. */
  찍기(s: string, x: number, y: number, size: number, bold?: boolean, color?: RGB) {
    let cx = x;
    for (const r of this.조각내기(s, bold)) {
      if (r.t) this.page.drawText(r.t, {
        x: cx, y, size, font: r.f, color: color ?? 검정,
      });
      cx += r.f.widthOfTextAtSize(r.t, size);
    }
  }

  /** 이 문서의 셈으로 폭을 재는 함수. 줄나누기에 넘깁니다. */
  재기(size: number, bold?: boolean) {
    return (t: string) => this.폭재기(t, size, bold);
  }

  /** 남은 자리가 h 보다 적으면 새 쪽. */
  자리확인(h: number) {
    if (this.y + h > this.바닥) { this.새쪽(); return true; }
    return false;
  }

  /* ── 글 ── */
  글(s: string, o: {
    x?: number; y?: number; size?: number; bold?: boolean;
    align?: "l" | "c" | "r"; 폭?: number; color?: RGB; lead?: number;
  } = {}) {
    const size = o.size ?? 10;
    const 폭 = o.폭 ?? this.폭;
    const x0 = o.x ?? this.여백.좌;
    let y = o.y ?? this.y;
    const lead = (o.lead ?? 1.45) * size;
    for (const line of 줄나누기(s, this.재기(size, o.bold), 폭)) {
      const w = this.폭재기(line, size, o.bold);
      const x = o.align === "c" ? x0 + (폭 - w) / 2
              : o.align === "r" ? x0 + 폭 - w
              : x0;
      if (line) this.찍기(line, x, this.Y(y + size * 0.82), size, o.bold, o.color);
      y += lead;
    }
    if (o.y === undefined) this.y = y;
    return y;
  }

  선(x1: number, y1: number, x2: number, y2: number, w = 0.7, c: RGB = 줄색) {
    this.page.drawLine({
      start: { x: x1, y: this.Y(y1) }, end: { x: x2, y: this.Y(y2) },
      thickness: w, color: c,
    });
  }

  네모(x: number, y: number, w: number, h: number, o: {
    선?: number; 색?: RGB; 채움?: RGB;
  } = {}) {
    this.page.drawRectangle({
      x, y: this.Y(y + h), width: w, height: h,
      borderWidth: o.선 ?? 0.7, borderColor: o.색 ?? 줄색,
      color: o.채움,
    });
  }

  /** ■ — 글꼴에 없을까 봐 직접 그립니다. */
  검정네모(x: number, y: number, s = 5) {
    this.page.drawRectangle({ x, y: this.Y(y + s), width: s, height: s, color: 검정 });
  }

  /** 체크상자. on 이면 ✓ 를 선으로 그립니다. */
  체크상자(x: number, y: number, s: number, on: boolean) {
    this.page.drawRectangle({
      x, y: this.Y(y + s), width: s, height: s,
      borderWidth: 0.8, borderColor: 검정,
    });
    if (!on) return;
    const p = s * 0.22;
    this.page.drawLine({
      start: { x: x + p, y: this.Y(y + s * 0.55) },
      end: { x: x + s * 0.42, y: this.Y(y + s - p) },
      thickness: 1.2, color: 검정,
    });
    this.page.drawLine({
      start: { x: x + s * 0.42, y: this.Y(y + s - p) },
      end: { x: x + s - p, y: this.Y(y + p) },
      thickness: 1.2, color: 검정,
    });
  }

  /* ── 표 ── */
  /**
   * 표를 그립니다. 줄 높이는 안에 든 글을 보고 저절로 정합니다.
   * 한 쪽에 안 들어가면 **행 단위로** 다음 쪽으로 넘깁니다
   * (행을 반으로 자르면 읽을 수 없게 됩니다).
   */
  표(colW: number[], rows: Row[], o: {
    x?: number; y?: number; size?: number; lead?: number;
    minH?: number; pad?: number; 머리반복?: number;
  } = {}) {
    const x0 = o.x ?? this.여백.좌;
    const 기본크기 = o.size ?? 9.5;
    const 기본여백 = o.pad ?? 4;
    const 기본최소 = o.minH ?? 16;
    if (o.y !== undefined) this.y = o.y;

    const 머리 = o.머리반복 ? rows.slice(0, o.머리반복) : [];
    const 그리기 = (row: Row): number => {
      const size = 기본크기;
      // 1) 칸마다 줄을 나눠 보고 가장 높은 것으로 행 높이를 정합니다.
      const 잰것: { c: Cell; x: number; w: number; lines: string[]; lead: number }[] = [];
      let ci = 0, x = x0;
      for (const c of row.cells) {
        const span = c.span ?? 1;
        const w = colW.slice(ci, ci + span).reduce((a, b) => a + b, 0);
        const pad = c.pad ?? 기본여백;
        const cs = c.size ?? size;
        const lead = (c.lead ?? 1.4) * cs;
        const 여유 = w - pad * 2 - (c.들여씀 ?? 0)
                   - (c.체크 != null ? cs + 4 : 0) - (c.검정박스 ? cs + 3 : 0);
        const lines = c.t
          ? 줄나누기(c.t, this.재기(cs, c.bold), Math.max(8, 여유)) : [];
        잰것.push({ c, x, w, lines, lead });
        x += w; ci += span;
      }
      const 필요 = Math.max(
        row.h ?? 0, row.minH ?? 기본최소,
        ...잰것.map((m) => m.lines.length * m.lead + (m.c.pad ?? 기본여백) * 1.4)
      );
      // 2) 자리가 없으면 새 쪽 — 행을 쪼개지 않습니다.
      if (this.y + 필요 > this.바닥) {
        this.새쪽();
        for (const h of 머리) 그리기(h);
      }
      const yTop = this.y;
      // 3) 칸을 그립니다.
      for (const m of 잰것) {
        const { c } = m;
        if (c.fill) this.네모(m.x, yTop, m.w, 필요, { 채움: c.fill, 선: 0, 색: c.fill });
        if (!c.테두리없음) this.네모(m.x, yTop, m.w, 필요);
        const cs = c.size ?? size;
        const pad = c.pad ?? 기본여백;
        let tx = m.x + pad + (c.들여씀 ?? 0);
        const 글높이 = m.lines.length * m.lead;
        let ty = c.valign === "t" ? yTop + pad * 0.9
               : yTop + Math.max(pad * 0.7, (필요 - 글높이) / 2);
        if (c.체크 != null) {
          this.체크상자(m.x + pad, ty + cs * 0.12, cs * 0.85, !!c.체크);
          tx += cs + 4;
        }
        if (c.검정박스) { this.검정네모(m.x + pad, ty + cs * 0.28, cs * 0.55); tx += cs * 0.55 + 3; }
        const 글폭 = m.w - (tx - m.x) - pad;


        for (const line of m.lines) {
          if (line) {
            const w = this.폭재기(line, cs, c.bold);
            const lx = c.align === "c" ? tx + (글폭 - w) / 2
                     : c.align === "r" ? tx + 글폭 - w
                     : tx;
            this.찍기(line, lx, this.Y(ty + cs * 0.82), cs, c.bold, c.color);
          }
          ty += m.lead;
        }
      }
      this.y = yTop + 필요;
      return 필요;
    };

    for (const r of rows) 그리기(r);
    return this.y;
  }

  /**
   * ── 표 전체를 한 번에 재고 한 번에 그립니다 ──────────────────────
   *
   * 위의 `표()` 는 줄을 하나씩 그리며 자리가 모자라면 쪽을 넘깁니다.
   * 그 방식으로는 **세로로 합쳐진 칸**을 못 그립니다 —
   * 아래 줄 높이를 아직 모르는데 칸 높이를 정해야 하기 때문입니다.
   *
   * 관공서 서식에는 세로 병합이 흔합니다(기록지의 「대상자 주소지」가 그렇습니다).
   * 그래서 서식을 그대로 옮길 때는 이쪽을 씁니다 —
   * **모든 줄 높이를 먼저 재고**, 자리가 모자라면 표를 통째로 다음 쪽으로 넘긴 뒤 그립니다.
   *
   * `세로` 가 2 이상인 칸은 그만큼의 줄 높이를 합쳐 씁니다.
   */
  표전체(colW: number[], rows: Row[], o: {
    x?: number; y?: number; size?: number; minH?: number; pad?: number;
  } = {}) {
    const x0 = o.x ?? this.여백.좌;
    const 기본크기 = o.size ?? 9.5;
    const 기본여백 = o.pad ?? 4;
    const 기본최소 = o.minH ?? 16;
    if (o.y !== undefined) this.y = o.y;

    // 1) 칸을 격자 위에 놓습니다. 세로로 합쳐진 칸은 아래 줄의 자리를 미리 차지합니다.
    type 놓인칸 = {
      c: Cell; 열: number; 가로: number; 세로: number;
      x: number; w: number; lines: string[]; lead: number; cs: number; 줄index: number;
    };
    const 놓인: 놓인칸[] = [];
    const 찜 = rows.map(() => new Set<number>());   // 줄마다 이미 찬 격자 자리

    rows.forEach((row, ri) => {
      let 열 = 0;
      for (const c of row.cells) {
        while (찜[ri].has(열)) 열 += 1;             // 위에서 내려온 칸은 건너뜁니다
        const 가로 = c.span ?? 1;
        const 세로 = c.세로 ?? 1;
        const w = colW.slice(열, 열 + 가로).reduce((a, b) => a + b, 0);
        const x = x0 + colW.slice(0, 열).reduce((a, b) => a + b, 0);
        const pad = c.pad ?? 기본여백;
        const cs = c.size ?? 기본크기;
        const lead = (c.lead ?? 1.4) * cs;
        const 여유 = w - pad * 2 - (c.들여씀 ?? 0) - (c.체크 != null ? cs + 4 : 0);
        const lines = c.t ? 줄나누기(c.t, this.재기(cs, c.bold), Math.max(8, 여유)) : [];
        놓인.push({ c, 열, 가로, 세로, x, w, lines, lead, cs, 줄index: ri });
        for (let k = 1; k < 세로; k++)
          for (let j = 열; j < 열 + 가로; j++) 찜[ri + k]?.add(j);
        열 += 가로;
      }
    });

    // 2) 줄 높이 — 한 줄짜리 칸으로 먼저 정하고, 세로로 합쳐진 칸이 모자라면 늘립니다.
    const 높이 = rows.map((r) => Math.max(r.h ?? 0, r.minH ?? 기본최소));
    const 글높이 = (m: 놓인칸) => m.lines.length * m.lead + (m.c.pad ?? 기본여백) * 1.4;
    for (const m of 놓인)
      if (m.세로 === 1) 높이[m.줄index] = Math.max(높이[m.줄index], 글높이(m));
    for (const m of 놓인) {
      if (m.세로 === 1) continue;
      const 가진것 = 높이.slice(m.줄index, m.줄index + m.세로).reduce((a, b) => a + b, 0);
      const 필요 = 글높이(m);
      if (필요 > 가진것) 높이[m.줄index + m.세로 - 1] += 필요 - 가진것;
    }

    // 3) 표가 통째로 들어갈 자리가 없으면 새 쪽에서 시작합니다.
    const 전체높이 = 높이.reduce((a, b) => a + b, 0);
    if (this.y + 전체높이 > this.바닥 && !this.빈쪽) this.새쪽();

    const 줄맨위: number[] = [];
    let y = this.y;
    for (const h of 높이) { 줄맨위.push(y); y += h; }

    // 4) 그립니다.
    for (const m of 놓인) {
      const { c } = m;
      const yTop = 줄맨위[m.줄index];
      const h = 높이.slice(m.줄index, m.줄index + m.세로).reduce((a, b) => a + b, 0);
      if (c.fill) this.네모(m.x, yTop, m.w, h, { 채움: c.fill, 선: 0, 색: c.fill });
      if (!c.테두리없음) this.네모(m.x, yTop, m.w, h);

      const pad = c.pad ?? 기본여백;
      let tx = m.x + pad + (c.들여씀 ?? 0);
      const gh = m.lines.length * m.lead;
      let ty = c.valign === "t" ? yTop + pad * 0.9
             : yTop + Math.max(pad * 0.7, (h - gh) / 2);
      if (c.체크 != null) {
        this.체크상자(m.x + pad, ty + m.cs * 0.12, m.cs * 0.85, !!c.체크);
        tx += m.cs + 4;
      }
      const 글폭 = m.w - (tx - m.x) - pad;
      for (const line of m.lines) {
        if (line) {
          const w = this.폭재기(line, m.cs, c.bold);
          const lx = c.align === "c" ? tx + (글폭 - w) / 2
                   : c.align === "r" ? tx + 글폭 - w
                   : tx;
          this.찍기(line, lx, this.Y(ty + m.cs * 0.82), m.cs, c.bold, c.color);
        }
        ty += m.lead;
      }
    }

    this.y = y;
    return this.y;
  }

  async 저장(): Promise<Buffer> {
    return Buffer.from(await this.doc.save());
  }
}

/* ── 직인 ─────────────────────────────────────────────── */
/**
 * 직인 그림을 문서에 **한 번만** 넣어 둡니다.
 *
 * 40명을 한 파일로 낼 때 사람마다 넣으면 같은 그림이 40번 들어갑니다.
 * 문서를 만들 때 한 번 불러 두고, 찍을 때는 그 결과를 넘겨 씁니다.
 */
export async function 도장준비(d: Doc, png?: string | null) {
  if (!png || !png.startsWith("data:image")) return null;
  try {
    const b64 = png.slice(png.indexOf(",") + 1);
    return png.includes("image/jpeg")
      ? await d.doc.embedJpg(Buffer.from(b64, "base64"))
      : await d.doc.embedPng(Buffer.from(b64, "base64"));
  } catch { return null; }   // 그림이 깨졌으면 아래 점선 자리로
}

/** 직인 자리. 그림이 없으면 점선 동그라미 — 손도장을 찍으시면 됩니다. */
export function 직인(d: Doc, x: number, y: number, 도장: any, 지름 = mm(16)) {
  if (도장) {
    d.page.drawImage(도장, { x, y: d.Y(y + 지름), width: 지름, height: 지름, opacity: 0.9 });
    return;
  }
  d.page.drawCircle({
    x: x + 지름 / 2, y: d.Y(y + 지름 / 2), size: 지름 / 2,
    borderWidth: 0.6, borderColor: 회색, borderDashArray: [2, 2],
  });
  d.글("직인", {
    x, y: y + 지름 / 2 - 4, size: 7, 폭: 지름, align: "c", color: 회색,
  });
}

/** 여러 PDF 를 한 파일로 잇습니다 — 글꼴이 한 번만 들어가 훨씬 가볍습니다. */
export async function 이어붙이기(들: Buffer[]): Promise<Buffer> {
  const out = await PDFDocument.create();
  for (const b of 들) {
    const src = await PDFDocument.load(b);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  return Buffer.from(await out.save());
}
