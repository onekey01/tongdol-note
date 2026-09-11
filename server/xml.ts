/**
 * XML 만지기 — **손댄 곳만 다시 쓰는** 파서.
 *
 * ── 왜 라이브러리를 안 쓰는가 ──────────────────────────────
 * 흔한 XML 라이브러리는 문서를 읽어 자기 방식으로 다시 씁니다.
 * 그 과정에서 이름표(`hs:sec` → `ns0:sec`)가 바뀌고, 안 쓰는 선언이 사라지고,
 * 빈 태그 모양(`<a/>` ↔ `<a />`)과 속성 순서가 달라집니다.
 * XML 규격으로는 같은 문서인데 **한글은 「변조」로 봅니다.**
 *
 * 파이썬으로 만들 때 이것 때문에 여러 번 거부당했고,
 * 「원본 여는 태그를 문자열로 다시 붙이기」 같은 뒷수습을 했습니다.
 *
 * ── 그래서 이렇게 만들었습니다 ─────────────────────────────
 * 조각마다 **원본의 글자 그대로**를 들고 있습니다.
 * 안 건드린 조각은 원본 글자를 그대로 내보냅니다 — 다시 쓰지 않습니다.
 * 건드린 조각만 새로 짭니다. 그래서
 *
 *   읽는다 → 아무것도 안 고친다 → 쓴다  ⇒  **원본과 1바이트도 다르지 않음**
 *
 * 이 성질이 있으면 「내가 고친 것 말고는 아무것도 안 변했다」를 늘 보장할 수 있습니다.
 */

export type Node = {
  /** 이름표를 뗀 이름. `hp:run` → `run` */
  name: string;
  /** 이름표까지 붙은 원래 이름 */
  qname: string;
  /** 원본의 여는 태그 글자 그대로. 속성을 고칠 때만 바뀝니다. */
  open: string;
  /** 닫는 태그. 빈 태그(`<a/>`)면 빈 문자열 */
  close: string;
  kids: Kid[];
  parent: Node | null;
  /** 손댔는가. 손대면 위쪽으로 올라가며 표시합니다. */
  dirty: boolean;
};

/** 조각은 태그이거나 글자입니다. 글자는 원본 그대로(엔티티 포함) 들고 있습니다. */
export type Kid = Node | { text: string };

export const isNode = (k: Kid): k is Node => (k as Node).name !== undefined;

const local = (q: string) => {
  const i = q.indexOf(":");
  return i < 0 ? q : q.slice(i + 1);
};

/** 문서 앞머리(`<?xml ...?>` 와 그 뒤 공백)와 뿌리 조각. */
export type Doc = { head: string; root: Node; tail: string };

export function parse(src: string): Doc {
  let i = 0;
  // 앞머리 — 선언·주석·처리지시. 뿌리 태그 앞까지 그대로 들고 갑니다.
  const rootAt = (() => {
    let p = 0;
    while (p < src.length) {
      const lt = src.indexOf("<", p);
      if (lt < 0) throw new Error("XML 이 아닙니다.");
      const c = src[lt + 1];
      if (c !== "?" && c !== "!") return lt;
      const gt = src.indexOf(">", lt);
      p = gt + 1;
    }
    throw new Error("뿌리 태그를 못 찾았습니다.");
  })();
  const head = src.slice(0, rootAt);
  i = rootAt;

  let cur: Node | null = null;
  let root: Node | null = null;

  while (i < src.length) {
    if (src[i] !== "<") {
      // 글자. 다음 태그 전까지.
      const lt = src.indexOf("<", i);
      const end = lt < 0 ? src.length : lt;
      const text = src.slice(i, end);
      if (cur) cur.kids.push({ text });
      else if (root) return { head, root, tail: src.slice(i) };
      i = end;
      continue;
    }

    // 주석·CDATA·처리지시는 글자로 통째 보존합니다.
    if (src.startsWith("<!--", i)) {
      const e = src.indexOf("-->", i) + 3;
      if (cur) cur.kids.push({ text: src.slice(i, e) });
      i = e; continue;
    }
    if (src.startsWith("<![CDATA[", i)) {
      const e = src.indexOf("]]>", i) + 3;
      if (cur) cur.kids.push({ text: src.slice(i, e) });
      i = e; continue;
    }
    if (src.startsWith("<?", i) || src.startsWith("<!", i)) {
      const e = src.indexOf(">", i) + 1;
      if (cur) cur.kids.push({ text: src.slice(i, e) });
      i = e; continue;
    }

    if (src[i + 1] === "/") {
      // 닫는 태그
      const e = src.indexOf(">", i) + 1;
      if (cur) {
        cur.close = src.slice(i, e);
        cur = cur.parent;
      }
      i = e;
      if (!cur && root) return { head, root, tail: src.slice(i) };
      continue;
    }

    // 여는 태그. 속성값 안의 `>` 를 태그 끝으로 착각하지 않게 인용부호를 따라갑니다.
    let j = i + 1, quote = "";
    while (j < src.length) {
      const c = src[j];
      if (quote) { if (c === quote) quote = ""; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === ">") break;
      j++;
    }
    const openRaw = src.slice(i, j + 1);
    const selfClose = openRaw.endsWith("/>");
    const m = openRaw.match(/^<([^\s/>]+)/);
    if (!m) throw new Error(`태그를 못 읽었습니다: ${openRaw.slice(0, 40)}`);
    const qname = m[1];

    const node: Node = {
      name: local(qname), qname, open: openRaw, close: "",
      kids: [], parent: cur, dirty: false,
    };
    if (cur) cur.kids.push(node);
    if (!root) root = node;
    if (!selfClose) cur = node;
    i = j + 1;
    if (!cur && root && selfClose && root === node) return { head, root, tail: src.slice(i) };
  }

  if (!root) throw new Error("뿌리 태그가 없습니다.");
  return { head, root, tail: "" };
}

// ── 다시 쓰기 ──────────────────────────────────────────────
export function serialize(d: Doc): string {
  return d.head + write(d.root) + d.tail;
}

function write(n: Node): string {
  const body = n.kids.map((k) => (isNode(k) ? write(k) : k.text)).join("");
  return n.open + body + n.close;
}

// ── 다니기 ─────────────────────────────────────────────────
export function* walk(n: Node): Generator<Node> {
  yield n;
  for (const k of n.kids) if (isNode(k)) yield* walk(k);
}

export function find(n: Node, name: string): Node[] {
  const out: Node[] = [];
  for (const x of walk(n)) if (x.name === name) out.push(x);
  return out;
}

/** 바로 아래 자식만. */
export function kids(n: Node, name?: string): Node[] {
  return n.kids.filter((k): k is Node => isNode(k) && (!name || k.name === name));
}

export function attr(n: Node, name: string): string | null {
  const m = n.open.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
}

/**
 * 글자 안에서 바꿔야 하는 것은 `&` `<` `>` 셋뿐입니다.
 * 따옴표는 글자 안에서 그대로 둡니다 — 한글이 만든 파일도 그렇습니다.
 * 굳이 `&quot;` 로 바꾸면 XML 로는 맞지만 원본과 다른 모양이 됩니다.
 */
const escText = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 속성값에는 따옴표까지 바꿔야 합니다. 그게 값을 끝내는 글자니까요. */
const escAttr = (s: string) => escText(s).replace(/"/g, "&quot;");

/** 읽을 때는 되돌립니다. */
export const unesc = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
   .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
   .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
   .replace(/&amp;/g, "&");

/**
 * 속성 하나만 갈아 끼웁니다.
 *
 * 여는 태그 전체를 다시 짜지 않습니다 — **그 속성 자리만** 문자열로 바꿉니다.
 * 그래야 속성 순서·따옴표·띄어쓰기가 원본 그대로 남습니다.
 */
export function setAttr(n: Node, name: string, value: string) {
  const re = new RegExp(`(\\s${name}=")[^"]*(")`);
  if (re.test(n.open)) {
    n.open = n.open.replace(re, `$1${escAttr(value)}$2`);
  } else {
    // 없던 속성은 태그 끝 바로 앞에 붙입니다.
    n.open = n.open.endsWith("/>")
      ? `${n.open.slice(0, -2)} ${name}="${escAttr(value)}"/>`
      : `${n.open.slice(0, -1)} ${name}="${escAttr(value)}">`;
  }
  mark(n);
}

function mark(n: Node | null) {
  while (n) { n.dirty = true; n = n.parent; }
}

/** 글자를 넣습니다. 자식은 모두 지워지고 글자 하나만 남습니다. */
export function setText(n: Node, text: string) {
  n.kids = text === "" ? [] : [{ text: escText(text) }];
  // 빈 태그였다면 여닫는 모양으로 바꿔야 글자가 들어갑니다.
  if (text !== "") openUp(n);
  if (text === "" && n.close !== "") {
    // 원본이 여닫는 모양이었으면 그대로 둡니다 (빈 <hp:t></hp:t> 는 원본에도 있습니다).
  }
  mark(n);
}

/**
 * **글 토막 하나만** 고칩니다. 형제로 있는 태그는 건드리지 않습니다.
 *
 * ── 왜 `setText` 로는 안 되는가 ──────────────────────────────
 *
 * `<hp:t>` 안에는 글자만 있는 것이 아닙니다. 줄바꿈이 이렇게 끼어 있습니다 —
 *
 *     <hp:t>서비스 가격    원<hp:lineBreak/>정부 지원금    원</hp:t>
 *
 * `setText` 는 **자식을 전부 지우고** 글자 하나만 남기므로 `<hp:lineBreak/>`
 * 가 사라집니다. 그러면 세 줄이 한 줄로 뭉개지는 것으로 끝나지 않습니다 —
 * 한글은 줄 정보를 **「몇 번째 글자부터 둘째 줄」**(textpos)로 적어 두는데,
 * **줄바꿈도 글자 한 자리로 셉니다.** 두 개가 사라지면 그 숫자가 전부
 * 어긋나서 한글이 「알 수 없는 오류입니다」를 냅니다. (2026-09-01 실제로 겪음)
 *
 * 그래서 **토막을 제자리에서** 고칩니다. 앞뒤 태그는 그대로 둡니다.
 *
 * `고침` 이 `null` 을 주면 그 토막은 내 것이 아니라는 뜻이라 다음으로 넘어갑니다.
 * 하나도 못 고치면 `됐나: false`.
 */
export function editChunk(
  n: Node, 고침: (글: string) => string | null
): { 됐나: boolean; 길이그대로: boolean } {
  for (const k of n.kids) {
    if (isNode(k)) continue;             // ← 줄바꿈 같은 태그는 뛰어넘습니다
    const 지금 = unesc(k.text);
    const 새것 = 고침(지금);
    if (새것 === null) continue;
    k.text = escText(새것);
    mark(n);
    return { 됐나: true, 길이그대로: 지금.length === 새것.length };
  }
  return { 됐나: false, 길이그대로: true };
}

/** 원본 글자 그대로 (엔티티가 그대로 붙어 있습니다). 다시 쓸 때 씁니다. */
export function text(n: Node): string {
  return n.kids.map((k) => (isNode(k) ? text(k) : k.text)).join("");
}

/** 사람이 읽을 글자. 엔티티를 되돌립니다. */
export function plain(n: Node): string {
  return unesc(text(n));
}

// ── 고치기 ─────────────────────────────────────────────────
export function remove(n: Node) {
  const p = n.parent;
  if (!p) return;
  p.kids = p.kids.filter((k) => k !== n);
  n.parent = null;
  mark(p);
}

/** 깊은 복사. 원본 글자를 그대로 물려받으므로 서식이 따라옵니다. */
export function clone(n: Node, parent: Node | null = null): Node {
  const c: Node = {
    name: n.name, qname: n.qname, open: n.open, close: n.close,
    kids: [], parent, dirty: n.dirty,
  };
  c.kids = n.kids.map((k) => (isNode(k) ? clone(k, c) : { text: k.text }));
  return c;
}

/**
 * 빈 태그를 여닫는 모양으로 바꿉니다.
 *
 * `<hp:run charPrIDRef="12"/>` 안에 글자를 넣으려면 먼저 이걸 해야 합니다.
 * 안 하면 `<hp:run .../>` 뒤에 글자가 따라붙어 **run 밖으로 새어 나갑니다.**
 */
export function openUp(n: Node) {
  if (n.close !== "") return;
  n.open = n.open.replace(/\s*\/>$/, ">");
  n.close = `</${n.qname}>`;
}

/**
 * 자식이 하나도 없으면 빈 태그(`<a/>`)로 되돌립니다.
 *
 * 글자를 비운 run 은 `<hp:run charPrIDRef="12"/>` 모양이어야 합니다.
 * `<hp:run charPrIDRef="12"></hp:run>` 은 XML 로는 같지만,
 * **한글이 실제로 연 파일이 앞의 모양**이라 그쪽에 맞춥니다.
 * 확인할 수 없는 영역에서는 되는 것으로 증명된 모양을 씁니다.
 */
export function collapse(n: Node) {
  if (n.kids.length > 0 || n.close === "") return;
  n.open = n.open.replace(/>$/, "/>");
  n.close = "";
  mark(n);
}

/** 자식을 맨 뒤에 붙입니다. 빈 태그면 알아서 열어 줍니다. */
export function append(p: Node, child: Node) {
  openUp(p);
  child.parent = p;
  p.kids.push(child);
  mark(p);
}

/** `ref` 바로 뒤에 넣습니다. */
export function insertAfter(ref: Node, node: Node) {
  const p = ref.parent;
  if (!p) throw new Error("넣을 자리가 없습니다.");
  const i = p.kids.indexOf(ref);
  node.parent = p;
  p.kids.splice(i + 1, 0, node);
  mark(p);
}

export function indexIn(n: Node): number {
  return n.parent ? n.parent.kids.indexOf(n) : -1;
}
