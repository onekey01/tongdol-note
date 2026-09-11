import { readFileSync } from "node:fs";
import { Zip } from "./zip";
import {
  parse, serialize, find, kids, attr, setAttr, setText,
  clone, remove, insertAfter, append, collapse, plain, isNode, editChunk, unesc,
  type Doc, type Node,
} from "./xml";

/**
 * 한글 서식(.hwpx) 채우기.
 *
 * .hwpx 는 zip 안에 XML 이 든 공개 형식입니다(한글 2014 이상).
 * 서식의 선·글꼴·여백은 건드리지 않고 **글자만** 바꿔 넣으므로,
 * 지자체가 받는 모습은 기관이 지금 쓰는 것과 똑같습니다.
 *
 * ══════════════════════════════════════════════════════════
 * 한 문장으로 : **한글은 「적어둔 숫자와 실제 내용이 어긋나면」 파일을 거부합니다.**
 * ══════════════════════════════════════════════════════════
 *
 * .hwpx 안에는 눈에 보이는 글자 말고도 한글이 화면에 그리려고 미리 계산해 둔
 * 숫자가 잔뜩 있습니다. 행이 몇 개인지, 이 칸이 몇 번째 행인지, 이 줄이 세로
 * 어디쯤인지, 몇 번째 글자에서 줄이 접히는지. 글자만 바꾸고 이 숫자를 안 고치면
 * 문서가 자기모순에 빠지고, 그때 「손상되었거나 변조되었을 가능성이 있습니다」가 뜹니다.
 *
 * 여덟 번 실패하며 알아낸 규칙 — `도구/hwpx_규칙.md` 에 자세히 있습니다.
 *
 *   1. 이름표(namespace)를 원본 그대로 둔다      → xml.ts 가 원본 글자를 그대로 씁니다
 *   2. zip 포장도 원본 그대로 만든다             → zip.ts 가 압축 바이트를 그대로 옮깁니다
 *   3. 행을 늘리거나 줄이지 않는다               → 서식이 가진 줄 수 안에서 씁니다
 *   4. ctrl 이 든 run 은 건드리지 않는다         → _write
 *   5. run 을 지우지 않는다                      → _write
 *   6. 글자모양 번호를 바꾸지 않는다             → 색은 한글에서 서식을 고칩니다
 *   7. 줄을 늘리면 세로 위치를 다시 계산한다     → vertpos = 첫줄 + 1500 × 줄번호
 *   8. 줄 정보(lineseg)는 하나만 남긴다          → oneLineseg  ← 마지막 관문
 *
 * 규칙 1·2 는 파이썬에서 뒷수습으로 막던 것인데, 여기서는 파서와 zip 을 직접 만들어
 * **구조적으로** 없앴습니다. 「읽고 안 고치고 쓰면 원본과 1바이트도 다르지 않다」가
 * 성립하므로, 내가 고친 것 말고는 아무것도 안 변했음이 늘 보장됩니다.
 */

const SECTION = "Contents/section0.xml";
const HEADER = "Contents/header.xml";

type Counts = Record<string, number>;
const PARTS = ["colPr", "ctrl", "tbl", "tr", "tc", "run", "p"];

/**
 * 한글·한자는 한 칸(1000), 영문·숫자는 반 칸(500)으로 봅니다.
 *
 * ── 좁은 기호는 따로 셉니다 (2026-08-31) ────────────────────────
 * 마침표·쉼표·괄호·띄어쓰기까지 반 칸으로 세면 「7. 30.(1회차)」 같은
 * 짧은 글이 칸을 넘는 것으로 잘못 나와 **두 줄로 끊겼습니다.**
 * 이 글자들은 실제로 그 절반쯤입니다.
 */
const 좁은글자 = new Set([" ", ".", ",", ":", ";", "(", ")", "[", "]", "'", "`", "|", "!", "1"]);
function charWidth(ch: string): number {
  if (좁은글자.has(ch)) return 250;
  const c = ch.codePointAt(0) ?? 0;
  const wide =
    (c >= 0x1100 && c <= 0x115f) ||   // 한글 자모
    (c >= 0x2e80 && c <= 0xa4cf) ||   // 한자·부수·가나
    (c >= 0xac00 && c <= 0xd7a3) ||   // 한글 음절
    (c >= 0xf900 && c <= 0xfaff) ||   // 한자 호환
    (c >= 0xfe30 && c <= 0xfe6f) ||
    (c >= 0xff00 && c <= 0xff60) ||   // 전각
    (c >= 0xffe0 && c <= 0xffe6);
  return wide ? 1000 : 500;
}

const widthOf = (s: string) => [...s].reduce((n, c) => n + charWidth(c), 0);

/**
 * 칸 너비를 넘지 않게 미리 끊습니다.
 *
 * 한글은 글자가 칸을 넘어 접히면 접힌 줄마다 위치를 따로 적습니다.
 * 우리는 접힘을 정확히 계산할 수 없으므로 **아예 접히지 않을 만큼 짧게 끊어**
 * 「한 문단 = 한 줄」로 만듭니다. 그러면 줄 위치를 하나씩만 적으면 됩니다.
 */
import {
  얹기 as 값얹기, 날짜얹기 as 날짜채우기, 자리바꾸기 as 자리채우기,
  기간얹기 as 기간채우기,
} from "./서식채우기";

export function wrap(line: string, limit: number): string[] {
  if (limit <= 0 || !line) return [line];
  const out: string[] = [];
  let cur = "", w = 0;

  for (const word of line.split(" ")) {
    const piece = cur ? " " + word : word;
    const pw = widthOf(piece);
    if (cur && w + pw > limit) {
      out.push(cur);
      cur = word; w = widthOf(word);
    } else {
      cur += piece; w += pw;
    }
    // 띄어쓰기 없이 긴 덩어리는 글자 단위로 자릅니다.
    while (w > limit && [...cur].length > 1) {
      let keep = "", kw = 0;
      for (const c of cur) {
        const cw = charWidth(c);
        if (kw + cw > limit) break;
        keep += c; kw += cw;
      }
      if (!keep) break;
      out.push(keep);
      cur = cur.slice(keep.length);
      w = widthOf(cur);
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}

export class Hwpx {
  private zip: Zip;
  doc: Doc;
  private srcParts: Counts;
  /*
   * 「길이를 안 바꾼 채 글자만 얹은」 문단들.
   *
   * 줄 정보(lineseg)가 여러 개인 것은 **글자 수가 바뀌었을 때만** 문제입니다.
   * 한글이 「12번째 글자부터 둘째 줄」이라고 적어 둔 것과 실제 글자 수가
   * 어긋나면 파일을 안 엽니다. 그런데 `얹기` 는 **빈칸 위에 값을 얹고
   * 글자 수를 그대로 두므로** 그 기록이 여전히 맞습니다. 손대면 오히려 어긋납니다.
   */
  private 길이그대로 = new Set<Node>();
  private 길이바뀜 = new Set<Node>();
  /*
   * 문단마다 **글자 자리 수**를 처음에 적어 둡니다.
   *
   * 줄 정보(lineseg)는 「몇 번째 글자부터 둘째 줄」(textpos)로 적혀 있습니다.
   * 줄이 여럿인 문단에서 자리 수가 바뀌면 그 숫자가 전부 어긋나 한글이
   * 파일을 안 엽니다. 그래서 나중에 다시 세어 견줍니다.
   */
  private 원래자리수 = new Map<Node, number>();

  /* ═══════════════════════════════════════════════════════════
   * ── ★ 우리가 넣은 값은 **검정 정자체**로 ★ (2026-09-11) ─────
   *
   * 편람 서식은 「이렇게 적으세요」를 **파란 기울임 예시 글씨**로
   * 그려 두었습니다. 서식4(식사)는 회차·날짜·시각이 파랑, 배달장소·식단이
   * **파란 기울임**입니다. 서식5(동행)는 동행 장소가 파랑입니다.
   *
   * 우리는 값을 **그 자리 run 에 그대로 얹습니다.** 그러면 값도 파란
   * 기울임으로 나갑니다 — 지자체가 받으면 「예시를 안 지운 서류」입니다.
   * 실제로 그렇게 나가고 있었습니다 (서식4 한 장에 47군데).
   *
   * ── 서식을 고치는 것이 아닙니다 ────────────────────────────
   *
   * 서식이 그려 둔 **말·선·여백은 한 글자도 안 건드립니다.**
   * 바꾸는 것은 **우리가 넣은 글자의 모양**뿐입니다 — 사람이 한글에서
   * 검정 글씨로 쳐 넣은 것과 같은 모습이 됩니다.
   *
   * ── 어떻게 ────────────────────────────────────────────────
   *
   * 그 run 이 쓰던 글자모양(charPr)과 **크기·글꼴이 똑같고 색만 검정,
   * 기울임만 없는** 것을 header.xml 에서 찾습니다. 있으면 그것을 쓰고,
   * 없으면 그것을 하나 만들어 넣습니다. 원래 모양은 **지우지 않습니다** —
   * 서식이 제 글자에 쓰고 있기 때문입니다.
   */
  private 헤더: Doc | null = null;
  private 헤더바뀜 = false;
  /** 원래 charPr id → 검정 정자체 id */
  private 검정표 = new Map<string, string>();

  private 헤더열기(): Doc {
    if (!this.헤더) this.헤더 = parse(this.zip.text(HEADER));
    return this.헤더;
  }

  /** 색이 검정(또는 안 정함)인가. */
  private static 검정인가(색: string | null): boolean {
    if (!색) return true;
    return /^#?0{6}$/i.test(String(색).replace("#", ""));
  }

  /**
   * 이 charPr 을 **검정 정자체**로 바꾼 것의 id.
   * 이미 검정 정자체면 그대로 돌려줍니다.
   */
  private 검정정자체ID(원래: string | null): string | null {
    if (원래 == null) return null;
    const 있던것 = this.검정표.get(원래);
    if (있던것 !== undefined) return 있던것;

    let 답: string | null = 원래;
    try {
      const h = this.헤더열기();
      const 목록 = find(h.root, "charProperties")[0];
      if (!목록) throw new Error("charProperties 없음");
      const 것들 = kids(목록, "charPr");
      const 나 = 것들.find((c) => String(attr(c, "id")) === String(원래));
      if (!나) throw new Error("그 charPr 없음");

      const 색 = attr(나, "textColor");
      const 기울 = kids(나, "italic").length > 0;
      if (Hwpx.검정인가(색) && !기울) { 답 = 원래; }
      else {
        /* 이미 같은 모양의 검정 정자체가 있으면 그것을 씁니다. */
        const 나열쇠 = Hwpx.모양열쇠(나);
        const 짝 = 것들.find((c) =>
          c !== 나 && Hwpx.검정인가(attr(c, "textColor"))
          && kids(c, "italic").length === 0
          && Hwpx.모양열쇠(c) === 나열쇠);
        if (짝) 답 = String(attr(짝, "id"));
        else {
          /* 없으면 원래 것을 본떠 하나 만듭니다. 원래 것은 그대로 둡니다. */
          const 새것 = clone(나);
          const 새id = String(것들.reduce(
            (m, c) => Math.max(m, Number(attr(c, "id") ?? 0)), -1) + 1);
          setAttr(새것, "id", 새id);
          setAttr(새것, "textColor", "#000000");
          for (const it of kids(새것, "italic")) remove(it);
          append(목록, 새것);
          const 수 = Number(attr(목록, "itemCnt") ?? 것들.length);
          setAttr(목록, "itemCnt", String(수 + 1));
          답 = 새id;
        }
        this.헤더바뀜 = true;
      }
    } catch {
      /*
       * header.xml 을 못 읽거나 모양이 낯설면 **그냥 둡니다.**
       * 색이 이상한 것보다 파일이 안 열리는 것이 훨씬 나쁩니다.
       */
      답 = 원래;
    }
    this.검정표.set(원래, 답 ?? 원래);
    return 답;
  }

  /** 색·기울임을 뺀 나머지 모양이 같은지 견줄 열쇠. */
  private static 모양열쇠(c: Node): string {
    const 태그 = c.open
      .replace(/\sid="[^"]*"/, "")
      .replace(/\stextColor="[^"]*"/, "");
    const 속 = kids(c).filter((k) => k.name !== "italic")
      .map((k) => k.open).join("");
    return 태그 + "|" + 속;
  }

  /** 그 run 이 넣는 글자를 **검정 정자체**로 찍게 합니다. */
  private 검정으로(run: Node): void {
    const 지금 = attr(run, "charPrIDRef");
    const 새것 = this.검정정자체ID(지금);
    if (새것 != null && 새것 !== 지금) setAttr(run, "charPrIDRef", 새것);
  }

  /**
   * 값이 **서식의 말과 한 덩이에 섞여** 들어간 자리를 쪼개어,
   * **우리가 넣은 글자만** 검정 정자체로 찍습니다.
   *
   * ── 왜 쪼개나 ──────────────────────────────────────────────
   *
   * 서식2 계약서의 서명 줄은 **한 덩이 전체가 빨강**입니다 —
   *   「'서비스 이용자' 본 인 (성명) ____ (서명 또는 인)」
   * 여기에 이름을 얹으면 이름도 빨강으로 나갑니다. 그렇다고 덩이째
   * 검정으로 바꾸면 **서식이 그려 둔 「본 인 (성명)」까지** 검정이 되어
   * 서식을 고친 것이 됩니다.
   *
   * 그래서 덩이를 [앞][우리 값][뒤] 셋으로 쪼개고 **가운데만** 검정으로
   * 찍습니다. 앞뒤는 원래 글자모양 그대로입니다.
   *
   *   (무무 2026-09-11 — 「어떤 서식이든 … 입력된 데이터값이 무조건적으로
   *    우선이 되어야 하며 … 검은색의 반이텔릭(기울이지 않은)으로」)
   *
   * ── 못 쪼개면 그냥 둡니다 ──────────────────────────────────
   *
   * 글자 덩이가 여럿인 run 은 순서가 꼬일 수 있어 손대지 않습니다.
   * 색이 이상한 것보다 **한글이 파일을 못 여는 것**이 훨씬 나쁩니다.
   * 그런 자리가 있으면 `서식글자색시험.ts` 가 잡아 줍니다.
   */
  private 값만검정(run: Node, t: Node, 옛글: string, 새글: string): void {
    // 앞뒤로 그대로인 부분을 걷어내면 가운데가 **우리가 넣은 것**입니다.
    let 앞 = 0;
    while (앞 < 옛글.length && 앞 < 새글.length && 옛글[앞] === 새글[앞]) 앞++;
    let 뒤 = 0;
    while (뒤 < 옛글.length - 앞 && 뒤 < 새글.length - 앞
           && 옛글[옛글.length - 1 - 뒤] === 새글[새글.length - 1 - 뒤]) 뒤++;

    const 앞글 = 새글.slice(0, 앞);
    const 값글 = 새글.slice(앞, 새글.length - 뒤);
    const 뒷글 = 새글.slice(새글.length - 뒤);
    if (!값글) return;                       // 넣은 것이 없으면 할 일 없습니다

    // 덩이 전체가 우리 값이면 **쪼갤 것 없이** 그 run 을 검정으로.
    if (!앞글 && !뒷글) { this.검정으로(run); return; }

    // 글자 덩이가 여럿인 run 은 건드리지 않습니다.
    if (kids(run, "t").length !== 1) return;

    const 원래 = attr(run, "charPrIDRef");
    const 검정 = this.검정정자체ID(원래);
    if (검정 == null || 검정 === 원래) return;      // 이미 검정 정자체

    /* 지금 모습을 본떠 둡니다 — 아래에서 run 을 고치기 **전**이어야 합니다. */
    const 본 = clone(run, run.parent);
    const 새run = (모양: string, 글: string): Node => {
      const r = clone(본, run.parent);
      setAttr(r, "charPrIDRef", 모양);
      setText(kids(r, "t")[0], 글);
      return r;
    };

    if (앞글) {
      // [앞]은 지금 run 에 그대로 두고(원래 모양), 뒤에 [값][뒤]를 붙입니다.
      setText(t, 앞글);
      const 값run = 새run(검정, 값글);
      insertAfter(run, 값run);
      this.쪼갠run++;
      if (뒷글) { insertAfter(값run, 새run(원래 ?? "0", 뒷글)); this.쪼갠run++; }
    } else {
      // 앞이 없으면 지금 run 이 [값]이 되고, 뒤에 [뒤]만 붙입니다.
      setAttr(run, "charPrIDRef", 검정);
      setText(t, 값글);
      if (뒷글) { insertAfter(run, 새run(원래 ?? "0", 뒷글)); this.쪼갠run++; }
    }
  }

  /** 쪼개느라 늘어난 run. `audit()` 의 셈에서 빼 줍니다. */
  private 쪼갠run = 0;

  constructor(src: Buffer | string) {
    this.zip = new Zip(typeof src === "string" ? readFileSync(src) : src);
    this.doc = parse(this.zip.text(SECTION));
    this.srcParts = this.count();
    for (const p of find(this.doc.root, "p"))
      this.원래자리수.set(p, Hwpx.자리수(p));
  }

  /**
   * 문단의 **글자 자리 수**. 한글이 textpos 를 세는 방식과 같게 셉니다 —
   * **줄바꿈도 한 자리**입니다.
   */
  private static 자리수(p: Node): number {
    let n = 0;
    const 훑기 = (node: Node) => {
      for (const k of node.kids) {
        if (!isNode(k)) { n += unesc(k.text).length; continue; }
        if (k.name === "lineBreak") { n += 1; continue; }
        if (k.name === "run" || k.name === "t") 훑기(k);
      }
    };
    훑기(p);
    return n;
  }

  private count(): Counts {
    const n: Counts = {};
    for (const k of PARTS) n[k] = 0;
    const seen = (node: Node) => {
      if (node.name in n) n[node.name]++;
      for (const k of node.kids) if (isNode(k)) seen(k);
    };
    seen(this.doc.root);
    return n;
  }

  // ── 표·행·칸 ─────────────────────────────────────────────
  tables(): Node[] { return find(this.doc.root, "tbl"); }
  rows(tbl: Node): Node[] { return find(tbl, "tr"); }
  cells(tr: Node): Node[] { return kids(tr, "tc"); }

  cell(tbl: Node, r: number, c: number): Node {
    const rows = this.rows(tbl);
    const row = rows[r];
    if (!row) throw new Error(`${r}번 행이 없습니다 (행 ${rows.length}개).`);
    const cs = this.cells(row);
    const one = cs[c];
    if (!one) throw new Error(`${r}행 ${c}번 칸이 없습니다 (칸 ${cs.length}개).`);
    return one;
  }

  // ── 칸에 글자 넣기 ───────────────────────────────────────
  /**
   * 줄바꿈(\n)은 문단으로 나눠 넣습니다.
   *
   * 서식이 가진 문단 하나에 첫 줄을 쓰고, 둘째 줄부터는 그 문단을 복제합니다.
   * 복제할 때 **부품(ctrl)이 든 run 은 떼어냅니다** — 한 칸 안에 같은 부품이
   * 두 번 들어가면 안 되기 때문입니다.
   */
  setCell(tc: Node, value: string, doWrap = true) {
    const paras = find(tc, "p");
    if (paras.length === 0) return;
    const first = paras[0];

    // 원래 있던 나머지 문단은 지웁니다 (첫 문단만 남기고 다시 짭니다).
    for (const p of paras.slice(1)) remove(p);

    const { base, step, horz } = this.linesegOf(first);

    let lines = String(value ?? "").split("\n");
    if (lines.length === 0) lines = [""];

    if (doWrap && horz) {
      /*
       * ── 여유를 0.88 → 0.98 로 (2026-08-31) ────────────────────────
       *
       * 서식9(세로)로 바꾸니 칸이 좁아져 우리 줄바꿈이 글자를 엉뚱하게
       * 끊었습니다 — 「7.⏎30.(1회차⏎)」처럼요.
       *
       * 재 보니 우리 셈은 이미 넉넉했습니다. 서식의 글자는 **10pt·비율 100%**
       * 라 한글 한 자가 딱 1000 HWPUNIT 이고(`charPr height="1000"`,
       * `ratio hangul="100"`), 영문·숫자는 500 으로 잡았는데 실제로는
       * 「1」「.」처럼 그보다 훨씬 좁은 글자가 많습니다.
       * 그 위에 0.88 을 또 곱하니 **들어갈 글자를 두 줄로 쪼개고** 있었습니다.
       *
       * 조금 넘쳐도 한글이 알아서 접습니다. 우리가 미리 끊어 놓는 것은
       * 「대충 이쯤」이지 「여기서 반드시」가 아닙니다.
       */
      const limit = Math.floor(horz * 0.98);
      const out: string[] = [];
      for (const l of lines) {
        // '- ' 로 시작하는 항목은 이어지는 줄을 들여씁니다.
        const pad = l.startsWith("- ") ? "  " : "";
        const parts = wrap(l, limit);
        out.push(parts[0]);
        for (const p of parts.slice(1)) out.push(pad + p);
      }
      lines = out;
    }

    this.writePara(first, lines[0]);
    this.oneLineseg(first, base);

    let prev = first;
    for (let i = 1; i < lines.length; i++) {
      const c = clone(first, first.parent);
      // 둘째 줄부터는 부품이 든 run 을 떼어냅니다.
      for (const r of kids(c, "run")) if (!this.isPlain(r)) remove(r);
      this.writePara(c, lines[i]);
      this.oneLineseg(c, base + step * i);
      insertAfter(prev, c);
      prev = c;
    }
  }

  /** 글자만 든 run 인가? (ctrl 같은 부품이 들어 있으면 아님) */
  private isPlain(run: Node): boolean {
    return kids(run).every((g) => g.name === "t");
  }

  /**
   * 문단에 글자를 넣습니다.
   *
   * 절대 건드리면 안 되는 것 — `<hp:ctrl>` 이 들어 있는 run.
   * 여기에 colPr(단 설정) 같은 부품이 있고 문단 맨 앞에 있어야 합니다.
   * 지우거나 그 앞에 글자를 끼우면 한글이 파일을 열지 않습니다.
   *
   * run 은 **늘리지도 줄이지도 않습니다.** 남는 것은 글자만 비웁니다.
   * (원본에 있던 빈 run 하나를 지웠더니 한글이 파일을 열지 않았습니다.)
   */
  private writePara(p: Node, value: string) {
    const runs = kids(p, "run");
    if (runs.length === 0) return;

    const plains = runs.filter((r) => this.isPlain(r));
    const target = plains[0];
    if (!target) return;                     // 글자용 run 이 없으면 손대지 않습니다

    for (const extra of plains.slice(1)) {
      for (const t of kids(extra, "t")) remove(t);
      collapse(extra);
    }

    // 우리가 넣는 글자는 **검정 정자체**로 (위 「검정정자체ID」 참고).
    if (value !== "") this.검정으로(target);

    const ts = kids(target, "t");
    if (value === "") {
      // 글자를 비웁니다. **run 은 남깁니다** — 지우면 한글이 파일을 안 엽니다.
      // 글자 조각은 통째로 빼고 run 을 빈 태그 모양으로 되돌립니다.
      for (const t of ts) remove(t);
      collapse(target);
      return;
    }
    for (const extra of ts.slice(1)) remove(extra);
    if (ts[0]) {
      setText(ts[0], value);
    } else {
      // 글자 조각이 없으면 run 안에 하나 만듭니다. 이름표는 run 것을 따릅니다.
      const pre = target.qname.includes(":") ? target.qname.split(":")[0] + ":" : "";
      const t: Node = {
        name: "t", qname: `${pre}t`, open: `<${pre}t>`, close: `</${pre}t>`,
        kids: [], parent: null, dirty: true,
      };
      // append 가 빈 run(`<hp:run .../>`)을 먼저 열어 줍니다.
      // 안 열고 붙이면 글자가 run 밖으로 새어 나갑니다.
      append(target, t);
      setText(t, value);
    }
  }

  /**
   * 문단의 줄 정보를 **한 개만** 남기고 맨 앞으로 되돌립니다.  ← 마지막 관문
   *
   * 한글은 글자가 칸 너비를 넘어 접히면 줄 정보를 여러 개 적어 둡니다.
   *   "청소하기, 빨래하기, 식사준비, 기타"  →  textpos=0 과 textpos=12
   * 여기에 짧은 글자를 넣으면 「12번째 글자부터 둘째 줄」이라는 기록만 남아
   * 실제 글자 수와 어긋나고, 한글은 그 문서를 열지 않습니다.
   *
   * 줄 정보는 화면에 그리기 위한 계산 결과일 뿐이라, 하나만 남겨 두면
   * 한글이 열 때 알아서 다시 계산합니다.
   */
  private oneLineseg(p: Node, vertpos: number) {
    for (const lsa of kids(p, "linesegarray")) {
      const segs = kids(lsa, "lineseg");
      for (const extra of segs.slice(1)) remove(extra);
      if (segs[0]) {
        setAttr(segs[0], "textpos", "0");
        setAttr(segs[0], "vertpos", String(vertpos));
      }
    }
  }

  /** 문단의 첫 줄 위치, 한 줄 높이, 칸 너비. */
  private linesegOf(p: Node) {
    for (const lsa of kids(p, "linesegarray")) {
      for (const s of kids(lsa, "lineseg")) {
        const vert = Number(attr(s, "vertpos") ?? 0);
        const size = Number(attr(s, "vertsize") ?? 1000);
        const gap = Number(attr(s, "spacing") ?? 500);
        const horz = Number(attr(s, "horzsize") ?? 0);
        return { base: vert, step: size + gap, horz };
      }
    }
    return { base: 0, step: 1500, horz: 0 };
  }

  // ── 저장 전 자체 점검 ────────────────────────────────────
  /** 한글이 싫어하는 모양이 남아 있는지 스스로 확인합니다. */
  audit(): string[] {
    const bad: string[] = [];
    const now = this.count();

    // 부품은 하나도 늘거나 줄면 안 됩니다.
    // 글자만 바꾸는 것이 원칙이므로, 개수가 달라졌다면 뭔가 부순 것입니다.
    for (const k of ["colPr", "ctrl", "tbl", "tc", "tr"]) {
      if (now[k] !== this.srcParts[k])
        bad.push(`${k} 개수 ${this.srcParts[k]} → ${now[k]}`);
    }

    /*
     * ── run 이 문단보다 **더 늘면** 뭔가 잘못 붙인 것입니다 ──────
     *
     * 문단 하나에 run 하나가 우리가 짓는 모양입니다. 그보다 run 이
     * 많아졌다면 글자 토막을 겹쳐 붙였다는 뜻이고, 한글이 싫어합니다.
     * **일부러 넣은 그림 run 은 빼고 셉니다** — 직인은 글자가 아니라
     * 떠 있는 그림이라 문단을 안 늘리고 run 만 하나 늘립니다.
     *
     * ── ★ 줄어드는 것은 막지 않습니다 (2026-09-05 에 고침) ★ ────
     *
     *   처음에는 「똑같이 늘어야 한다」로 못 박았습니다. 그런데 서식4
     *   (식사관리)에는 편람 **작성예시가 그대로 박혀** 있고, 그 예시
     *   글자들은 한 문단이 run 여러 개로 잘게 나뉘어 있습니다
     *   (「콩나물 무침, 미역줄기, 계란찜」 한 줄이 run 대여섯 개).
     *
     *   우리가 그 칸을 우리 식단으로 덮어쓰면 run 이 하나로 합쳐지면서
     *   **확 줄어듭니다.** 그것을 「부순 것」으로 보고 막고 있었습니다.
     *   하지만 그건 정확히 우리가 해야 하는 일입니다 — 안 덮어쓰면
     *   남의 집 식단이 우리 어르신 기록지에 실려 나갑니다.
     *   (2026-09-05 무무 — 「표 안의 내용이 이상하다면 예시로 입력된
     *    값을 무시하고 서식에 맞게 입력함을 원칙으로」)
     *
     *   문단이 줄어드는 것도 같습니다. 여러 문단짜리 칸을 한 줄로
     *   채우면 줄어드는 것이 맞습니다. 표의 뼈대(tbl·tr·tc)는 위에서
     *   이미 「하나도 늘거나 줄면 안 된다」로 막고 있습니다 —
     *   한글이 파일을 못 여는 진짜 원인은 그쪽입니다.
     */
    const run늘어난것 = now.run - this.그림run - this.쪼갠run - this.srcParts.run;
    const 문단늘어난것 = now.p - this.srcParts.p;
    if (run늘어난것 > 문단늘어난것) {
      bad.push(
        `run 이 문단보다 더 늘었습니다 (run ${this.srcParts.run + this.그림run}→${now.run}, ` +
        `문단 ${this.srcParts.p}→${now.p})`
      );
    }

    for (const tbl of this.tables()) {
      const rows = this.rows(tbl);
      if (attr(tbl, "rowCnt") !== String(rows.length))
        bad.push(`행 개수 불일치 ${attr(tbl, "rowCnt")} ≠ ${rows.length}`);
      rows.forEach((tr, ri) => {
        for (const tc of this.cells(tr)) {
          for (const a of kids(tc, "cellAddr")) {
            if (attr(a, "rowAddr") !== String(ri)) bad.push(`행 번호 어긋남 r${ri}`);
          }
        }
      });
    }

    // 줄 정보는 문단마다 하나여야 합니다 (규칙 8).
    for (const p of find(this.doc.root, "p")) {
      for (const lsa of kids(p, "linesegarray")) {
        const segs = kids(lsa, "lineseg");
        // 길이를 그대로 둔 문단은 줄 정보가 여전히 맞습니다 (`얹기`).
        if (segs.length > 1 && p.dirty && !this.길이그대로.has(p))
          bad.push("손댄 문단에 줄 정보가 둘 이상");
      }
    }

    /*
     * ── 줄이 여럿인 문단의 **글자 자리 수** ─────────────────────
     *
     * 여기서 걸러야 할 것이 「알 수 없는 오류입니다」입니다.
     * lineseg 의 textpos 는 「몇 번째 글자부터 둘째 줄」인데, 그 셈에는
     * **줄바꿈도 한 자리**로 들어갑니다. 자리 수가 달라지면 그 숫자가
     * 가리키는 곳이 어긋나서 한글이 파일을 아예 안 엽니다.
     *
     * 줄이 하나뿐인 문단은 textpos 가 0 하나라 괜찮습니다.
     */
    for (const [p, 원래] of this.원래자리수) {
      const segs = kids(p, "linesegarray").flatMap((l) => kids(l, "lineseg"));
      if (segs.length < 2) continue;
      const 지금 = Hwpx.자리수(p);
      if (지금 !== 원래)
        bad.push(
          `줄이 ${segs.length}개인 문단의 글자 자리가 ${원래} → ${지금} 로 바뀜 ` +
          `(줄 정보 textpos 가 어긋나 한글이 못 엽니다)`
        );
      /*
       * 「줄바꿈 수 + 1 = 줄 정보 수」로 못박고 싶겠지만 **그러면 안 됩니다.**
       * 줄은 자동으로도 넘어갑니다 — 줄바꿈이 하나도 없는데 줄 정보가 셋인
       * 문단이 원본 서식(서식9)에 실제로 있습니다. 그걸 흠으로 삼으면
       * 멀쩡한 서류가 안 나갑니다. **자리 수만 지키면 textpos 는 맞습니다.**
       */
    }
    return [...new Set(bad)];
  }

  /*
   * ── 용지(pagePr)를 건드리는 기능은 **일부러 두지 않았습니다** ──────
   *
   * 한때 「표가 용지보다 넓으니 가로로 돌리자」고 pagePr 의 가로·세로를 맞바꿨습니다.
   * 그랬더니 한글에서 **표의 마지막 칸이 통째로 사라졌습니다.**
   *
   * 서식은 이미 한글에서 가로로 보입니다 — 서식 파일 안에 든 한글의 미리보기
   * 그림(Preview/PrvImage.png)이 A4 가로 비율이고 칸이 다 나옵니다.
   * 우리가 숫자를 바꾸면 한글의 셈이 어긋납니다.
   *
   * **용지·여백은 한글이 알아서 합니다. 우리는 칸만 채웁니다.**
   */

  /** 지금 XML 을 글자로. 시험할 때 씁니다. */
  xml(): string { return serialize(this.doc); }

  save(): Buffer {
    const problems = this.audit();
    if (problems.length)
      throw new Error("한글이 열지 못할 모양입니다: " + problems.sort().join(", "));

    const 바꾸기: Record<string, Buffer> = { [SECTION]: Buffer.from(this.xml(), "utf8") };

    /*
     * 검정 정자체를 새로 만들었으면 header.xml 도 함께 담습니다.
     * 원래 있던 글자모양은 하나도 안 지웠습니다 — 서식이 제 글자에 씁니다.
     */
    if (this.헤더바뀜 && this.헤더)
      바꾸기[HEADER] = Buffer.from(serialize(this.헤더), "utf8");

    /*
     * ── 넣은 그림을 꾸러미에 마저 담습니다 ──────────────────────
     *
     * 그림 하나에 **세 곳**이 맞아야 합니다 — 파일, `content.hpf` 의 목록,
     * 그리고 문단 안의 `<hp:pic>`. 문단은 `그림겹치기` 가 이미 했고,
     * 나머지 둘을 여기서 합니다. 하나라도 빠지면 한글이 파일을 못 엽니다.
     */
    if (this.넣은그림.length) {
      for (const g of this.넣은그림) this.zip.더하기(g.이름, g.바이트);

      let hpf = this.zip.text("Contents/content.hpf");
      const 더할것 = this.넣은그림
        .filter((g) => !hpf.includes(`id="${g.id}"`))
        .map((g) =>
          `<opf:item id="${g.id}" href="${g.이름}"` +
          ` media-type="image/${g.종류 === "jpeg" ? "jpg" : "png"}" isEmbeded="1"/>`)
        .join("");
      if (더할것) {
        const i = hpf.indexOf("</opf:manifest>");
        if (i < 0) throw new Error("content.hpf 에서 목록을 찾지 못했습니다.");
        hpf = hpf.slice(0, i) + 더할것 + hpf.slice(i);
        바꾸기["Contents/content.hpf"] = Buffer.from(hpf, "utf8");
      }
    }

    return this.zip.write(바꾸기);
  }

  /**
   * ── 표 위에 있는 **제목 문단**의 글자 ─────────────────────────
   *
   * 서식9 의 제목(「<서식9> 모니터링- 서비스 제공기관 기록지(제공기관 ➜ 군)」)은
   * 표가 아니라 그냥 문단입니다. 그 글자도 **서식이 정한 것**이라
   * 코드에 옮겨 적지 않고 여기서 꺼내 씁니다.
   *
   * 표 **바깥**의 맨 위 문단들만 봅니다 — 표를 만나면 거기서 멈춥니다.
   */
  머리문단글(): string {
    const 줄: string[] = [];
    for (const k of this.doc.root.kids) {
      if (!isNode(k) || k.name !== "p") continue;
      if (find(k, "tbl").length) break;          // 표를 만나면 거기까지
      const t = find(k, "t").map((x) => plain(x)).join("").trim();
      if (t) 줄.push(t);
    }
    return 줄.join("\n");
  }

  /** 칸 안의 글자를 읽습니다. 시험·확인용. */
  cellText(tc: Node): string {
    return find(tc, "p")
      .map((p) => find(p, "t").map((t) => plain(t)).join(""))
      .join("\n");
  }

  /* ═══════════════════════════════════════════════════════════
   * 이름표 뒤에 **값만** 얹기 (B-1 · 서식7·2·8 에서 씁니다)
   *
   * `setCell` 은 칸을 통째로 갈아 끼웁니다. 서식7 처럼 **이름표와 값이
   * 같은 줄**에 있는 서식에서는 그러면 「거래번호 :」라는 **서식의 글자까지
   * 지웁니다.** 제출 서식에는 하면 안 되는 일입니다.
   *
   * ── 왜 run 단위인가 ─────────────────────────────────────────
   * 한 문단이 run 여럿으로 쪼개져 있고 **run 마다 글자 모양이 다릅니다**
   * (밑줄·굵기). 문단 글을 통째로 다시 쓰면 그 모양이 뭉개집니다.
   * 그래서 **run 하나의 글자만** 고칩니다 — 나머지는 손도 안 댑니다.
   *
   * ── 줄 정보를 안 건드립니다 ────────────────────────────────
   * 글자 수를 그대로 두므로(`서식채우기.ts`) 한글이 다시 접을 일이 없습니다.
   * `lineseg` 를 손대면 오히려 어긋납니다.
   * ═════════════════════════════════════════════════════════ */

  /* ═══════════════════════════════════════════════════════════
   * ── 행 늘리기 ───────────────────────────────────────────────
   *
   * **오래 「하면 안 되는 일」이었습니다.** `기록지_만들기.py` 에 이렇게
   * 적혀 있습니다 — 「행을 복제하거나 지우면 한글이 파일을 열지 않습니다.
   * (행 번호·행 개수를 다시 맞춰도 마찬가지였습니다.)」
   *
   * 그때 못 맞춘 것이 무엇인지 이제 압니다. 행 하나를 늘리면 **다섯 곳**이
   * 함께 움직여야 합니다 —
   *
   *   ① `<hp:tbl rowCnt>`                     행이 몇인가
   *   ② 뒤따르는 모든 칸의 `<hp:cellAddr rowAddr>`  몇 번째 행인가
   *   ③ `<hp:tbl><hp:sz height>`              표 전체 높이
   *   ④ 표를 감싼 문단의 `lineseg` 세로 크기   표가 차지하는 자리
   *   ⑤ 늘린 뒤의 **기준값 다시 잡기**         audit 이 셈을 다시 하게
   *
   * 하나라도 빠지면 한글이 「알 수 없는 오류입니다」만 내놓습니다.
   * **늘린 뒤에는 반드시 한글에서 열어 확인하세요.**
   *
   * ── 여섯 벌을 한글에 물어봤습니다 (2026-09-03) ──────────────
   *
   * **여섯 장 다 열렸습니다** — 표 높이를 안 고친 것도, lineseg 를 안 고친
   * 것도. 그러니 **열림 여부를 가르는 것은 ①rowCnt 와 ②rowAddr** 이고,
   * ③④ 는 열리라고가 아니라 **종이가 제대로 보이라고** 고칩니다.
   * (그래도 ③④ 를 빼지 않습니다. 한글이 봐주는 것과 맞는 것은 다릅니다.)
   *
   * ── 어느 줄을 본뜰 것인가 — **선 굵기가 여기서 갈립니다** ───
   *
   * 처음 만든 시험지에서 늘린 줄 위에 **검은 굵은 줄**이 그어졌습니다.
   * 칸마다 `borderFillIDRef` 로 테두리를 가리키는데, 서식8 의 실적 줄은
   * 자리마다 다른 것을 씁니다 —
   *
   *   첫 줄(r10)      bf53        위 실선 · 아래 점선
   *   가운데(r11~13)  bf51        위 점선 · 아래 점선   ← **이것을 본뜹니다**
   *   마지막 줄(r14)  bf52·bf165  아래가 **굵은 실선 0.7mm**
   *
   * 마지막 줄을 본뜨면 **그 굵은 아래선까지 따라옵니다.** 표가 거기서
   * 끝난 것처럼 보입니다.
   *
   * **그러니 늘 「가운데 빈 줄」을 본떠 「가운데」에 넣습니다.**
   * 그러면 마지막 줄의 굵은 아래선이 제자리(표 맨 밑)에 그대로 남습니다.
   * ═══════════════════════════════════════════════════════════ */

  /**
   * `본뜰행` 을 본떠 그 **바로 뒤에** 행을 `몇개` 만큼 넣습니다.
   *
   * 본뜬 행의 글자는 지웁니다 — 틀만 가져옵니다.
   * 넣은 행들을 돌려줍니다 (위에서부터 차례로).
   *
   * **본뜰 행은 「가운데 줄」이어야 합니다** — 위 머리말 참고.
   * 표의 마지막 줄을 본뜨면 그 줄의 굵은 아래선이 따라옵니다.
   */
  행늘리기(tbl: Node, 본뜰행: Node, 몇개: number): Node[] {
    if (몇개 <= 0) return [];

    /*
     * **마지막 줄은 본뜨지 않습니다.** 표의 맨 아랫줄은 아래 테두리가
     * 굵은 실선인 경우가 많고(서식8 은 0.7mm), 본뜨면 그 굵은 줄이
     * 표 한가운데에 그어집니다. 조용히 넘어가면 종이가 이상해지는데
     * 시험은 다 통과합니다 — 그러니 여기서 터뜨립니다.
     */
    const 줄들 = this.rows(tbl);
    if (줄들[줄들.length - 1] === 본뜰행)
      throw new Error(
        "표의 마지막 줄은 본뜰 수 없습니다 — 굵은 아래 테두리가 따라옵니다. " +
        "가운데 빈 줄을 본떠 주세요.");

    const 행높이 = Number(
      attr(kids(this.cells(본뜰행)[0], "cellSz")[0] ?? 본뜰행, "height") ?? 0);
    if (!행높이) throw new Error("본뜰 행의 높이를 못 읽었습니다.");

    const 새행들: Node[] = [];
    let 앞 = 본뜰행;
    for (let i = 0; i < 몇개; i++) {
      const 새 = clone(본뜰행, 본뜰행.parent);
      // 틀만 가져옵니다 — 글자는 비웁니다.
      for (const tc of this.cells(새)) this.setCell(tc, "");
      insertAfter(앞, 새);
      새행들.push(새);
      앞 = 새;
    }

    // ① 행이 몇인가
    const 행수 = this.rows(tbl).length;
    setAttr(tbl, "rowCnt", String(행수));

    // ② 몇 번째 행인가 — 처음부터 다시 매깁니다 (틀리면 한글이 안 엽니다)
    this.rows(tbl).forEach((tr, ri) => {
      for (const tc of this.cells(tr))
        for (const a of kids(tc, "cellAddr")) setAttr(a, "rowAddr", String(ri));
    });

    // ③ 표 전체 높이
    const 잰것 = kids(tbl, "sz")[0];
    if (잰것) {
      const 높이 = Number(attr(잰것, "height") ?? 0) + 행높이 * 몇개;
      setAttr(잰것, "height", String(높이));
    }

    /*
     * ④ 표를 감싼 문단이 차지하는 자리
     *
     * **「글자처럼 취급」일 때만** 합니다. 그때는 표가 글자 한 개처럼
     * 문단 줄 안에 들어앉아 있어, 표가 커지면 그 줄도 같이 커져야 합니다.
     * 취급을 껐으면 문단은 그냥 빈 줄이라 손댈 것이 없습니다.
     */
    if (this.글자처럼인가(tbl)) {
      const p = this.감싼문단(tbl);
      const 내줄 = p ? this.문단제줄(p) : [];
      const 마지막 = 내줄[내줄.length - 1];
      if (마지막) {
        for (const 이름 of ["vertsize", "textheight", "baseline"]) {
          const v = Number(attr(마지막, 이름) ?? 0);
          if (v) setAttr(마지막, 이름, String(v + 행높이 * 몇개));
        }
      }
    }

    // ⑤ 기준값 다시 잡기 — 여기서부터가 「손대지 않은 모습」입니다
    this.srcParts = this.count();
    this.원래자리수 = new Map();
    for (const p of find(this.doc.root, "p")) this.원래자리수.set(p, Hwpx.자리수(p));
    this.길이그대로 = new Set();
    this.길이바뀜 = new Set();
    this.그림run = 0;

    return 새행들;
  }

  /* ═══════════════════════════════════════════════════════════
   * ── 「글자처럼 취급」 끄기 ──────────────────────────────────
   *
   * 서식8 의 표는 **글자처럼 취급**으로 놓여 있습니다. 글자 한 개처럼
   * 문단 줄 안에 들어앉아 있다는 뜻입니다. 그래서 줄을 늘려 표가 한 쪽을
   * 넘으면, 글자가 줄바꿈되듯 **표가 통째로 다음 쪽으로 넘어갑니다.**
   * 첫 쪽이 통째로 비고 둘째 쪽에 표만 덩그러니 남습니다.
   *
   * 취급을 끄면 표는 제 자리를 차지하는 물건이 되고, 이미 켜져 있는
   * `pageBreak="CELL"`(쪽 경계에서 **칸 단위로 나눔**)이 살아나
   * **쪽을 넘어가며 자연스럽게 이어집니다.**
   *
   * ── 편람의 다른 서식이 이미 그렇습니다 ──────────────────────
   * 서식9(모니터링)·서식4(식사)는 `treatAsChar="0"` 이고 표가 여러 쪽에
   * 걸쳐 있습니다. 우리가 새로 정하는 것이 아니라 **편람이 이미 쓰는
   * 방식으로 맞추는 것**입니다.
   *
   * ── 함께 고쳐야 하는 것 ─────────────────────────────────────
   * 표를 감싼 문단의 줄 정보가 지금은 **표 높이**로 적혀 있습니다
   * (42578 = 표 42296 + 바깥 여백 282). 취급을 끄면 그 문단은 그냥
   * **빈 줄 하나**이므로 글자 높이로 되돌립니다. 서식9·서식4 가 그렇습니다.
   *   · vertsize = textheight = 글자 높이
   *   · baseline = 글자 높이의 85% (서식9·서식4 둘 다 이 비율입니다)
   *   · horzsize = 0 (표가 더는 줄 안에서 폭을 차지하지 않습니다)
   * ═══════════════════════════════════════════════════════════ */

  /** 이 표가 「글자처럼 취급」인가. */
  private 글자처럼인가(tbl: Node): boolean {
    const pos = kids(tbl, "pos")[0];
    return !pos || attr(pos, "treatAsChar") !== "0";
  }

  /** 이 표를 담고 있는 문단. */
  private 감싼문단(tbl: Node): Node | null {
    for (const p of find(this.doc.root, "p"))
      if (kids(p, "run").some((r) => kids(r, "tbl").includes(tbl))) return p;
    return null;
  }

  /**
   * **문단 자신의** 줄 정보만.
   *
   * `find(p, "lineseg")` 는 표 **안쪽 칸의 문단들**까지 다 딸려 옵니다.
   * 문단 자신의 것은 `<hp:p>` 바로 아래 `<hp:linesegarray>` 에 있습니다.
   */
  private 문단제줄(p: Node): Node[] {
    return kids(p, "linesegarray").flatMap((a) => kids(a, "lineseg"));
  }

  /** header.xml 의 글자모양 높이. 한 번만 읽어 둡니다. */
  private 글자높이표: Map<string, number> | null = null;
  private 글자높이(id: string | null): number {
    if (!this.글자높이표) {
      this.글자높이표 = new Map();
      try {
        for (const c of find(parse(this.zip.text("Contents/header.xml")).root, "charPr"))
          this.글자높이표.set(String(attr(c, "id")), Number(attr(c, "height") ?? 0));
      } catch { /* 못 읽으면 아래 기본값을 씁니다 */ }
    }
    return this.글자높이표.get(String(id)) || 1000;
  }

  /**
   * 표의 **「글자처럼 취급」을 끕니다.** 쪽을 넘어가며 이어지게 됩니다.
   *
   * 이미 꺼져 있으면 아무것도 안 합니다.
   * 행을 늘리기 **전에 부르든 뒤에 부르든** 결과는 같습니다.
   */
  글자처럼취급끄기(tbl: Node): void {
    const pos = kids(tbl, "pos")[0];
    if (!pos) throw new Error("표의 자리 정보(hp:pos)를 찾지 못했습니다.");
    if (attr(pos, "treatAsChar") === "0") return;
    setAttr(pos, "treatAsChar", "0");

    const p = this.감싼문단(tbl);
    if (!p) throw new Error("표를 감싼 문단을 찾지 못했습니다.");

    const 그run = kids(p, "run").find((r) => kids(r, "tbl").includes(tbl));
    const 높이 = this.글자높이(그run ? attr(그run, "charPrIDRef") : null);

    for (const s of this.문단제줄(p)) {
      setAttr(s, "vertsize", String(높이));
      setAttr(s, "textheight", String(높이));
      setAttr(s, "baseline", String(Math.round(높이 * 0.85)));
      setAttr(s, "horzsize", "0");
    }
  }

  /** 그 칸 안의 모든 문단. */
  paras(tc: Node): Node[] { return find(tc, "p"); }

  /* ═══════════════════════════════════════════════════════════
   * ── 칸의 **문단 모양**(정렬) ────────────────────────────────
   *
   * 서식8 의 **첫 실적 줄**은 서식이 그려 둔 **예시**입니다. 그래서 정렬이
   * 나머지 줄과 다릅니다 — 단가 칸은 `JUSTIFY`, 금액 칸들은 `RIGHT`,
   * 그런데 빈 줄 넷은 전부 `CENTER` 입니다.
   *
   * 우리가 예시 글자를 덮어써도 **정렬은 그대로 남아**, 한 표 안에서
   * 첫 줄만 삐뚤어져 보입니다(2026-09-04 무무 님 지적).
   *
   * 그래서 **아래 줄의 문단 모양을 첫 줄에 옮겨 붙입니다.** 우리가 값을
   * 새로 정하는 것이 아니라 **서식이 이미 쓰고 있는 값**을 가져다 쓰는
   * 것이므로, 「서식은 안 고친다」와 어긋나지 않습니다.
   * ═════════════════════════════════════════════════════════ */

  /** 그 칸 첫 문단의 **문단 모양 번호**. 없으면 `null`. */
  칸문단모양(tc: Node): string | null {
    const p = find(tc, "p")[0];
    return p ? attr(p, "paraPrIDRef") : null;
  }

  /** 그 칸의 **모든 문단**을 이 문단 모양으로 맞춥니다. */
  칸문단모양맞추기(tc: Node, id: string | null): void {
    if (!id) return;
    for (const p of find(tc, "p")) setAttr(p, "paraPrIDRef", id);
  }

  /**
   * 칸 안에서 **이름표를 가진 run 을 찾아** 값을 얹습니다.
   *
   * 못 찾으면 `false`. **부르는 쪽이 이것을 보고 터뜨려야 합니다** —
   * 조용히 넘어가면 빈 종이가 어르신께 갑니다.
   */
  얹기(tc: Node, 이름표: string, 값: string,
       정렬: "왼쪽" | "오른쪽" = "왼쪽"): boolean {
    return this.토막고치기(tc, (글) => 값얹기(글, 이름표, 값, 정렬));
  }

  /**
   * 칸 안의 **글 토막**을 하나씩 짚어 가며 `고침` 을 시킵니다.
   *
   * **`<hp:t>` 를 통째로 갈아 끼우지 않습니다.** 그 안에 `<hp:lineBreak/>` 가
   * 끼어 있으면 함께 지워지는데, 한글은 줄 정보를 **「몇 번째 글자부터 둘째 줄」**
   * 로 적어 두고 **줄바꿈도 한 자리로 셉니다.** 지우면 그 숫자가 어긋나
   * 「알 수 없는 오류입니다」가 뜹니다. (2026-09-01 실제로 겪음)
   *
   * `몇번째` 는 **맞은 것 중에서** 몇 번째를 고칠지입니다 (날짜 틀이 한 칸에
   * 둘 있을 때 씁니다).
   */
  private 토막고치기(
    tc: Node, 고침: (글: string) => string | null, 몇번째 = 0
  ): boolean {
    let 본것 = 0;
    for (const p of find(tc, "p")) {
      for (const run of kids(p, "run")) {
        for (const t of kids(run, "t")) {
          // 맞는지만 먼저 봅니다 — 건너뛸 것을 고쳐 놓으면 되돌릴 수 없습니다.
          let 맞았나 = false;
          let 옛글 = "", 새글 = "";
          const r = editChunk(t, (글) => {
            const 새것 = 고침(글);
            if (새것 === null) return null;
            맞았나 = true;
            if (본것++ < 몇번째) return null;        // ← 순서만 세고 넘어감
            옛글 = 글; 새글 = 새것;
            return 새것;
          });
          if (r.됐나) {
            // 우리가 넣은 글자만 검정 정자체로 찍습니다.
            this.값만검정(run, t, 옛글, 새글);
            this.길이표시(p, r.길이그대로);
            return true;
          }
          if (맞았나) continue;                     // 맞았지만 내 차례가 아니었음
        }
      }
    }
    return false;
  }

  /**
   * 글자 수가 그대로면 줄 정보를 **그냥 둡니다** — 여전히 맞는 기록입니다.
   * 바뀌었으면 하나만 남깁니다(`setCell` 과 같은 이유).
   *
   * **줄바꿈이 든 문단은 건드리지 않습니다.** 줄이 여럿인 것이 원래 맞는
   * 모습이라 하나로 줄이면 그것이야말로 어긋납니다.
   */
  private 길이표시(p: Node, 그대로: boolean) {
    if (그대로) { if (!this.길이바뀜.has(p)) this.길이그대로.add(p); return; }
    if (find(p, "lineBreak").length) { this.길이그대로.add(p); return; }
    this.길이그대로.delete(p);
    this.길이바뀜.add(p);
    const { base } = this.linesegOf(p);
    this.oneLineseg(p, base);
  }

  /**
   * **자리 표시**(◯◯◯◯ 같은 것)를 값으로 바꿉니다. 못 찾으면 `false`.
   *
   * 빈칸과 같은 것이라 **그 자리를 값이 대신**합니다 — 뒤에 붙이지 않습니다.
   */
  자리바꾸기칸(tc: Node, 자리: string, 값: string): boolean {
    return this.토막고치기(tc, (글) => 자리채우기(글, 자리, 값));
  }

  /*
   * ── 그림 겹치기 (직인) ──────────────────────────────────────
   *
   * 넣은 그림들. `save()` 가 이걸 보고 꾸러미와 `content.hpf` 를 함께 손봅니다.
   * 세 곳이 아귀가 맞아야 한글이 파일을 엽니다.
   */
  private 넣은그림: { id: string; 이름: string; 바이트: Buffer; 종류: string }[] = [];
  /** 그림 때문에 늘어난 run. `audit()` 의 셈에서 빼 줍니다. */
  private 그림run = 0;

  /**
   * `이름표` 가 든 문단 **위에 그림을 겹쳐** 놓습니다. 찍었으면 `true`.
   *
   * **글자가 아닌 떠 있는 그림**입니다(`treatAsChar="0"`). 글자로 넣으면
   * 뒤따르는 「(인)」을 옆으로 밀어 서식이 틀어집니다. 문단의 **오른쪽 끝**을
   * 기준 삼아 왼쪽·위로 물려 놓고, 글자를 덮게(`IN_FRONT_OF_TEXT`) 합니다.
   *
   * 글자 수는 하나도 안 바뀌므로 줄 정보(textpos)도 그대로입니다.
   */
  그림겹치기(
    tc: Node, 이름표: string,
    그림: { 바이트: Buffer; 종류: string },
    자리: { 지름: number; 오른쪽에서: number; 위에서: number }
  ): boolean {
    // 이름표가 든 문단 찾기
    let 대상: Node | null = null;
    for (const p of find(tc, "p")) {
      const 글 = find(p, "t").map((t) => plain(t)).join("");
      if (글.includes(이름표)) { 대상 = p; break; }
    }
    if (!대상) return false;

    const n = this.넣은그림.length + 1;
    const 확장 = 그림.종류 === "jpeg" ? "jpg" : "png";
    const id = `stamp${n}`;
    const 파일 = `BinData/${id}.${확장}`;
    this.넣은그림.push({ id, 이름: 파일, 바이트: 그림.바이트, 종류: 그림.종류 });

    const D = Math.round(자리.지름);
    /*
     * 「(인)」 위로 오게 오른쪽에서 물립니다. 떠 있는 그림의 offset 은
     * 기준선에서 **오른쪽·아래가 양수**이므로, 왼쪽·위로 가려면 음수입니다.
     */
    const dx = -(자리.오른쪽에서 + D);
    const dy = -(자리.위에서);

    const xml =
      `<hp:run charPrIDRef="0">` +
      `<hp:pic id="${1000000 + n}" zOrder="${900 + n}" numberingType="PICTURE"` +
      ` textWrap="IN_FRONT_OF_TEXT" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None"` +
      ` href="" groupLevel="0" instid="${2000000 + n}" reverse="0">` +
      `<hp:offset x="0" y="0"/>` +
      `<hp:orgSz width="${D}" height="${D}"/>` +
      `<hp:curSz width="${D}" height="${D}"/>` +
      `<hp:flip horizontal="0" vertical="0"/>` +
      `<hp:rotationInfo angle="0" centerX="${Math.round(D / 2)}"` +
      ` centerY="${Math.round(D / 2)}" rotateimage="1"/>` +
      `<hp:renderingInfo>` +
      `<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
      `<hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
      `<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
      `</hp:renderingInfo>` +
      `<hc:img binaryItemIDRef="${id}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>` +
      `<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${D}" y="0"/>` +
      `<hc:pt2 x="${D}" y="${D}"/><hc:pt3 x="0" y="${D}"/></hp:imgRect>` +
      `<hp:imgClip left="0" right="${D}" top="0" bottom="${D}"/>` +
      `<hp:inMargin left="0" right="0" top="0" bottom="0"/>` +
      `<hp:imgDim dimwidth="${D}" dimheight="${D}"/>` +
      `<hp:effects/>` +
      `<hp:sz width="${D}" widthRelTo="ABSOLUTE" height="${D}"` +
      ` heightRelTo="ABSOLUTE" protect="0"/>` +
      `<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="1"` +
      ` holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP"` +
      ` horzAlign="RIGHT" vertOffset="${dy}" horzOffset="${dx}"/>` +
      `<hp:outMargin left="0" right="0" top="0" bottom="0"/>` +
      `<hp:shapeComment>직인</hp:shapeComment>` +
      `</hp:pic></hp:run>`;

    /*
     * 그림 run 은 **문단의 맨 앞**에 넣습니다. 떠 있는 그림이라 자리는
     * 위 `hp:pos` 가 정하므로 순서는 상관없고, 맨 앞이 줄 정보와 안 얽힙니다.
     */
    const 새run = parse(xml).root;
    새run.parent = 대상;
    대상.kids.unshift(새run);
    this.그림run++;
    let n2: Node | null = 대상;
    while (n2) { n2.dirty = true; n2 = n2.parent; }
    return true;
  }

  /** 「20   년    월     일」 같은 날짜 틀을 채웁니다. 못 찾으면 `false`. */
  날짜얹기칸(tc: Node, 해: number, 달: number, 날: number, 몇번째 = 0): boolean {
    return this.토막고치기(tc, (글) => 날짜채우기(글, 해, 달, 날), 몇번째);
  }

  /* ═══════════════════════════════════════════════════════════
   * ── 표 **밖**의 문단 ────────────────────────────────────────
   *
   * 계약서(서식2)의 맨 아래 서명란은 표가 아니라 그냥 문단입니다 —
   *
   *     󰡐서비스 이용자󰡑  본 인  (성명)          (서명 또는 인)
   *                       대리인 (관계)   (성명)  (서명 또는 인)
   *
   * 한 문단에 채울 곳이 둘인 줄도 있어, **문단을 먼저 짚고 그 안에서만**
   * 채웁니다. 문서 전체에서 이름표를 찾으면 위쪽 줄의 「(성명)」을
   * 잘못 집습니다.
   * ═══════════════════════════════════════════════════════════ */

  /**
   * **홑문단** — 안에 다른 문단을 품지 않은 문단.
   *
   * hwpx 에서 표는 **문단 안에** 들어갑니다. 그래서 표를 감싼 문단의 글자를
   * 읽으면 **표 안의 모든 글자가 이어 붙어** 나옵니다 (계약서에서는 921자).
   * 그런 문단을 상대로 채우면 표 안의 **서식 라벨**을 고칩니다 —
   * 「생년월일」이 「생2026년월일」이 된 적이 있습니다 (2026-09-02).
   *
   * 그래서 문서 단위로 찾을 때는 **홑문단만** 봅니다.
   */
  private 홑문단인가(p: Node): boolean {
    return find(p, "p").length === 1;   // 자기 자신만
  }

  /** 이 문단이 표 **안**에 있나. */
  private 표안인가(p: Node): boolean {
    let n: Node | null = p.parent;
    while (n) { if (n.name === "tc") return true; n = n.parent; }
    return false;
  }

  /**
   * 홑문단만 차례로. 문서 단위로 무언가를 찾을 때 쓰는 기준입니다.
   *
   * `표밖만` 은 **표 안의 라벨과 표 밖의 같은 말**을 가려야 할 때 씁니다.
   * 계약서의 날짜 틀이 그렇습니다 — 표 안 「생년월일」 라벨도 년·월·일이
   * 다 있어 날짜 틀로 걸립니다.
   */
  private 홑문단들(표밖만 = false): Node[] {
    return find(this.doc.root, "p")
      .filter((p) => this.홑문단인가(p) && !(표밖만 && this.표안인가(p)));
  }

  /** 이 문단 **자기 글**만 고칩니다 (품고 있는 문단은 안 건드립니다). */
  private 홑문단고치기(
    p: Node, 고침: (글: string) => string | null, 몇번째 = 0
  ): boolean {
    let 본것 = 0;
    for (const run of kids(p, "run")) {
      for (const t of kids(run, "t")) {
        let 맞았나 = false;
        let 옛글 = "", 새글 = "";
        const r = editChunk(t, (글) => {
          const 새것 = 고침(글);
          if (새것 === null) return null;
          맞았나 = true;
          if (본것++ < 몇번째) return null;
          옛글 = 글; 새글 = 새것;
          return 새것;
        });
        if (r.됐나) {
          // 서식 말과 한 덩이에 섞여 들어가는 자리입니다 — 값만 검정으로.
          this.값만검정(run, t, 옛글, 새글);
          this.길이표시(p, r.길이그대로);
          return true;
        }
        if (맞았나) continue;
      }
    }
    return false;
  }

  /** `앵커` 글자가 든 **첫 홑문단**. 없으면 `null`. */
  문단찾기(앵커: string): Node | null {
    for (const p of this.홑문단들()) {
      const 글 = find(p, "t").map((t) => plain(t)).join("");
      if (글.includes(앵커)) return p;
    }
    return null;
  }

  /**
   * `앵커` 가 든 홑문단을 찾아 **그 문단 안에서만** 이름표 뒤에 값을 얹습니다.
   * 앵커를 생략하면 이름표 자체를 앵커로 씁니다.
   */
  얹기문서(이름표: string, 값: string, 앵커?: string): boolean {
    const p = this.문단찾기(앵커 ?? 이름표);
    if (!p) return false;
    return this.홑문단고치기(p, (글) => 값얹기(글, 이름표, 값));
  }

  /** 홑문단 하나 안에서만 이름표 뒤에 값을 얹습니다. */
  얹기홑문단(p: Node, 이름표: string, 값: string): boolean {
    return this.홑문단고치기(p, (글) => 값얹기(글, 이름표, 값));
  }

  /**
   * 문서의 홑문단을 하나씩 보여 주고, **처음 고쳐진 데서 멈춥니다.**
   *
   * `얹기`·`날짜얹기` 로 안 되는 별난 틀에 씁니다. 서식8 맨 아래
   * 「2026년    월    」처럼 **「일」이 없는 날짜**가 그렇습니다.
   * 고칠 것이 아니면 `null` 을 돌려주세요.
   */
  글고치기문서(
    고침: (글: string) => string | null,
    옵션: { 앵커?: string; 표밖만?: boolean } = {}
  ): boolean {
    const 앵커 = 옵션.앵커;
    for (const p of this.홑문단들(옵션.표밖만 ?? true)) {
      if (앵커) {
        const 글 = find(p, "t").map((t) => plain(t)).join("");
        if (!글.includes(앵커)) continue;
      }
      if (this.홑문단고치기(p, 고침)) return true;
    }
    return false;
  }

  /**
   * 문서 곳곳의 `옛` 을 `새` 로 바꿉니다. 바꾼 문단 수를 돌려줍니다.
   *
   * 계약서의 「□ 확인」을 「☑ 확인」으로 바꾸는 데 씁니다. 서식이 적어 둔
   * **말은 그대로 두고 표시만** 바꾸는 것이라, 기록지에서 「○ 를 ☑ 로」
   * 바꾼 것과 같은 생각입니다.
   *
   * **길이가 같아야만 합니다.** 다르면 줄 정보(textpos)가 어긋나
   * 한글이 파일을 못 엽니다 — 그래서 여기서 미리 막습니다.
   */
  글자바꾸기(옛: string, 새: string): number {
    if (옛.length !== 새.length)
      throw new Error(
        `길이가 다릅니다 — 「${옛}」(${옛.length}) → 「${새}」(${새.length}). ` +
        `줄 정보가 어긋나 한글이 파일을 못 엽니다.`
      );
    let 셈 = 0;
    for (const p of this.홑문단들()) {
      // 한 문단에 여럿 있을 수 있어 다 바뀔 때까지 돕니다.
      while (this.홑문단고치기(p, (글) => (글.includes(옛) ? 글.split(옛).join(새) : null))) 셈++;
    }
    return 셈;
  }

  /**
   * 문서의 날짜 틀을 채웁니다 — **홑문단만** 봅니다.
   *
   * 날짜 틀은 「년·월·일이 다 있는 글」이면 무엇이든 맞습니다. 표를 감싼
   * 문단을 상대로 하면 그 안의 **「생년월일」 라벨**이 걸립니다.
   * `앵커` 로 어느 줄인지 좁힐 수 있습니다.
   */
  날짜얹기문서(해: number, 달: number, 날: number,
             옵션: { 앵커?: string; 표밖만?: boolean } = {}): boolean {
    const 앵커 = 옵션.앵커;
    for (const p of this.홑문단들(옵션.표밖만 ?? false)) {
      if (앵커) {
        const 글 = find(p, "t").map((t) => plain(t)).join("");
        if (!글.includes(앵커)) continue;
      }
      if (this.홑문단고치기(p, (글) => 날짜채우기(글, 해, 달, 날))) return true;
    }
    return false;
  }

  /** 「2025.   .     . ~ 2025.   .     .」 기간 틀. 못 찾으면 `false`. */
  기간얹기칸(
    n: Node,
    시작: { 해: number; 달: number; 날: number },
    끝: { 해: number; 달: number; 날: number },
    해고침: boolean
  ): boolean {
    return this.토막고치기(n, (글) => 기간채우기(글, 시작, 끝, 해고침));
  }

  /**
   * 손댄 칸에 줄 정보가 하나씩만 남았는지 (규칙 8).
   * 손대지 않은 머리글 칸은 여러 개인 게 정상이라 세지 않습니다.
   */
  multiLineseg(tc: Node): number {
    let n = 0;
    for (const p of find(tc, "p"))
      for (const lsa of kids(p, "linesegarray"))
        if (kids(lsa, "lineseg").length > 1) n++;
    return n;
  }
}
