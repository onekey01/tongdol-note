/*
 * ── 업데이트 안내 ──────────────────────────────────────────
 *
 * 켤 때 조용히 「새 버전이 나왔나」를 보고, 나왔으면 **뒤에서 받아서 풀어
 * 놓고**, 화면 위에 띠 하나를 띄웁니다. 관리자가 「지금 갈아 끼우기」를
 * 누르면 프로그램이 스스로 꺼지고 몇 초 뒤 새 버전으로 다시 켜집니다.
 *
 * ── 왜 이렇게 나눠 놓았나 ──────────────────────────────────
 *
 * 실제로 갈아 끼우는 순간에 남는 일이 **적을수록** 안전합니다. 그래서
 * 무거운 것(받기 · 지문 대조 · 압축 풀기)은 프로그램이 **켜져 있는 동안**
 * 다 끝내 둡니다. 마지막에 남는 것은 **폴더 옮기기 두 번과 켜기 하나**,
 * 몇 초짜리입니다. 그 사이에 정전이 나도 옛 exe 는 `data\update\old\`
 * 에 그대로 있습니다.
 *
 * ── 하지 않는 것 ───────────────────────────────────────────
 *
 * **묻지 않고 저절로 바꾸지 않습니다.** 이건 기술 때문이 아니라 업무
 * 때문입니다. 이 프로그램은 청구서를 만듭니다. 밤사이 셈이 바뀌면
 * 어제와 오늘 금액이 다른데 **아무도 이유를 모른 채** 군에 서류가
 * 나갑니다. 나중에 「왜 달라졌냐」에 기관이 답할 말이 없습니다.
 * 그래서 바뀐 것을 읽고 **누른 흔적**이 남는 편이 낫습니다.
 *
 * ── 인터넷이 없어도 ────────────────────────────────────────
 *
 * 여기서 나는 어떤 잘못도 **켜지는 것을 막지 않습니다.** 3초 안에 답이
 * 없으면 조용히 넘어갑니다. 파일럿 기관은 시골이고, 인터넷이 없다고
 * 프로그램이 안 켜지면 그날 업무가 멈춥니다.
 */

import { createHash, verify as 서명검사 } from "node:crypto";
import { join, dirname } from "node:path";
import {
  mkdirSync, rmSync, existsSync, writeFileSync, readdirSync, renameSync, statSync,
} from "node:fs";
import { DATA_DIR, metaGet, metaSet } from "./db";
import { 버전, 버전견주기 } from "./version";
import { 공개열쇠, 기본주소, 버전정보이름, 서명이름 } from "./업데이트열쇠";
import { Zip } from "./zip";

// ── 자리 ────────────────────────────────────────────────────
/*
 * **여기 이름들은 반드시 영문입니다.**
 *
 * 「통돌Note 갈아끼우기.bat」이 이 길을 그대로 적어 씁니다. cmd 는 .bat
 * 파일의 바이트를 기계 코드 페이지로 읽기 때문에, 한글이 섞이면 어느 날
 * 파싱이 깨집니다. 갱신 스크립트가 깨지는 것은 **제일 나쁜 고장**입니다 —
 * 그때 기관은 아무것도 못 합니다.
 *
 * 기관이 보게 되는 이름(`이전버전`)은 새 버전이 켜진 뒤에 **프로그램이**
 * 붙입니다. 프로그램은 한글을 아무 문제 없이 다룹니다.
 */
export const 준비터 = join(DATA_DIR, "update");
export const 푼자리 = join(준비터, "payload");
export const 옛것자리 = join(준비터, "old");
const 준비표 = join(준비터, "ready.txt");
const 번호표 = join(준비터, "pid.txt");

// ── 열쇠 ────────────────────────────────────────────────────
const 열쇠머리 = "-----BEGIN PUBLIC KEY-----\n";
const 열쇠꼬리 = "\n-----END PUBLIC KEY-----\n";
function 열쇠로(b64: string): string {
  return 열쇠머리 + (b64.match(/.{1,64}/g) ?? []).join("\n") + 열쇠꼬리;
}

// ── 버전정보 ──────────────────────────────────────────────────
export type 버전정보 = {
  버전: string;
  낸날: string;
  바뀐것: string[];
  꼭해야하나: boolean;
  받는곳: string;
  /** 받은 zip 의 SHA-256, 소문자 16진 64글자 */
  지문: string;
  /** 받은 zip 의 바이트 수 */
  크기: number;
};

export type 형편 =
  | { 무엇: "조용" }
  | { 무엇: "받는중"; 새버전: string; 온것: number; 전체: number }
  | { 무엇: "준비됨"; 정보: 버전정보 }
  | { 무엇: "갈아끼우는중" };

let 지금형편: 형편 = { 무엇: "조용" };
let 도는중 = false;

// ── 설정 ────────────────────────────────────────────────────
/** 기본은 **켜기**입니다. 설정에서 언제든 끕니다. */
export function 켜져있나(): boolean {
  return metaGet("update_on") !== "0";
}
export function 켜고끄기(켤까: boolean) {
  metaSet("update_on", 켤까 ? "1" : "0");
}
/** 비어 있으면 코드에 적힌 기본 자리를 씁니다. */
export function 읽어올곳(): string {
  const v = (metaGet("update_url") ?? "").trim();
  return v || 기본주소;
}
export function 읽어올곳정하기(주소: string) {
  metaSet("update_url", (주소 ?? "").trim());
}

// ── 글자 다듬기 ─────────────────────────────────────────────
/*
 * 바뀐 것은 **바깥에서 받아 온 글**입니다. 화면에 HTML 로 넣지 않고
 * 글자로만 그립니다(화면 쪽에서). 여기서는 길이를 자르고 줄바꿈·제어
 * 문자를 걷어냅니다. 한 줄이 길어지면 띠가 화면을 덮습니다.
 */
export function 글자만(s: unknown, 최대 = 120): string {
  return String(s ?? "")
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .trim()
    .slice(0, 최대);
}

// ── 서명 확인 ───────────────────────────────────────────────
/**
 * 버전정보 파일의 **바이트 그대로**에 대해 서명을 봅니다.
 *
 * JSON 을 풀었다가 다시 묶어서 견주지 않는 까닭 — 키 순서나 띄어쓰기가
 * 한 글자만 달라도 서명이 어긋납니다. **받은 바이트에 그대로** 견주면
 * 그런 일이 아예 없습니다.
 */
export function 서명확인(글: Buffer, 서명b64: string, 열쇠b64: string = 공개열쇠): boolean {
  const 열쇠 = (열쇠b64 ?? "").trim();
  if (!열쇠) return false;                 // 열쇠가 없으면 **무조건 아니오**
  let 서명: Buffer;
  try {
    서명 = Buffer.from(String(서명b64 ?? "").trim(), "base64");
  } catch { return false; }
  if (서명.length !== 64) return false;    // Ed25519 서명은 64바이트
  try {
    return 서명검사(null, 글, 열쇠로(열쇠), 서명);
  } catch { return false; }
}

// ── 버전정보 읽기 ─────────────────────────────────────────────
/**
 * 모양이 조금이라도 어긋나면 **던집니다.** 「대충 맞으면 쓰자」로
 * 두면, 버전정보를 고칠 수 있는 사람이 이상한 값을 밀어 넣습니다.
 */
export function 버전정보읽기(글: string): 버전정보 {
  let o: any;
  try { o = JSON.parse(글); } catch { throw new Error("버전정보가 JSON 이 아닙니다."); }
  if (!o || typeof o !== "object") throw new Error("버전정보 모양이 아닙니다.");

  const 새버전 = String(o.버전 ?? "");
  if (!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(새버전)) throw new Error("버전 번호 모양이 아닙니다.");

  const 낸날 = String(o.낸날 ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(낸날)) throw new Error("낸 날 모양이 아닙니다.");

  const 바뀐것 = (Array.isArray(o.바뀐것) ? o.바뀐것 : [])
    .slice(0, 20).map((x: unknown) => 글자만(x)).filter((x: string) => x.length > 0);
  if (바뀐것.length === 0) throw new Error("바뀐 것이 한 줄도 없습니다.");

  const 받는곳 = String(o.받는곳 ?? "");
  let u: URL;
  try { u = new URL(받는곳); } catch { throw new Error("받는곳이 주소 모양이 아닙니다."); }
  if (u.protocol !== "https:") throw new Error("받는곳이 https 가 아닙니다.");

  const 지문 = String(o.지문 ?? "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(지문)) throw new Error("지문(SHA-256) 모양이 아닙니다.");

  const 크기 = Number(o.크기);
  if (!Number.isFinite(크기) || 크기 < 1_000_000 || 크기 > 500_000_000)
    throw new Error("크기가 1MB~500MB 밖입니다.");

  return { 버전: 새버전, 낸날, 바뀐것, 꼭해야하나: o.꼭해야하나 === true, 받는곳, 지문, 크기 };
}

/**
 * **받는곳은 버전정보를 읽어 온 그 자리에서만** 받습니다.
 *
 * 서명이 이미 막아 주지만, 한 겹 더 둡니다. 서명 열쇠를 잃어버려 새로
 * 만드는 날 같은 때에 이 줄이 마지막 그물이 됩니다. 같은 호스트, 같은
 * 앞 두 칸(주인/저장소)이어야 합니다.
 */
export function 받는곳믿을만한가(받는곳: string, 읽어온곳: string): boolean {
  try {
    const a = new URL(받는곳), b = new URL(읽어온곳);
    if (a.protocol !== "https:" || b.protocol !== "https:") return false;
    if (a.host !== b.host) return false;
    const 칸 = (u: URL) => u.pathname.split("/").filter(Boolean).slice(0, 2).join("/");
    return 칸(a) === 칸(b) && 칸(a).length > 0;
  } catch { return false; }
}

// ── 받아 오기 ───────────────────────────────────────────────
async function 데려오기(주소: string, 밀리초: number): Promise<Response> {
  const 끊개 = new AbortController();
  const 시계 = setTimeout(() => 끊개.abort(), 밀리초);
  try {
    return await fetch(주소, { signal: 끊개.signal, redirect: "follow" });
  } finally { clearTimeout(시계); }
}

/** 버전정보 + 서명을 읽어 확인까지 마칩니다. 못 믿을 것은 던집니다. */
export async function 버전정보가져오기(곳: string, 열쇠?: string): Promise<버전정보> {
  const 바탕 = 곳.replace(/\/+$/, "");
  const [r1, r2] = await Promise.all([
    데려오기(`${바탕}/${버전정보이름}`, 3000),
    데려오기(`${바탕}/${서명이름}`, 3000),
  ]);
  if (!r1.ok) throw new Error(`버전정보를 못 읽었습니다 (${r1.status}).`);
  if (!r2.ok) throw new Error(`서명을 못 읽었습니다 (${r2.status}).`);

  const 글 = Buffer.from(await r1.arrayBuffer());
  if (글.length > 64 * 1024) throw new Error("버전정보가 너무 큽니다.");
  const 서명 = (await r2.text()).trim();

  if (!서명확인(글, 서명, 열쇠 ?? 공개열쇠))
    throw new Error("버전정보의 서명이 맞지 않습니다. 받지 않습니다.");

  const 정보 = 버전정보읽기(글.toString("utf8"));
  if (!받는곳믿을만한가(정보.받는곳, `${바탕}/${버전정보이름}`))
    throw new Error("받는곳이 버전정보와 다른 자리를 가리킵니다. 받지 않습니다.");
  return 정보;
}

// ── 풀기 ────────────────────────────────────────────────────
/*
 * zip 안의 이름을 **그대로 믿지 않습니다.** `..` 이 섞인 이름 하나면
 * 프로그램 폴더 바깥에 파일을 쓸 수 있습니다(zip-slip). 우리가 만든
 * zip 이지만, 검사는 **받는 쪽에서** 합니다. 만드는 쪽을 못 믿게 되는
 * 날이 바로 이 검사가 필요한 날입니다.
 */
function 안전한이름(이름: string): boolean {
  if (!이름 || 이름.length > 200) return false;
  if (이름.includes("\\")) return false;
  if (이름.startsWith("/")) return false;
  if (/^[a-zA-Z]:/.test(이름)) return false;
  return !이름.split("/").some((칸) => 칸 === ".." || 칸 === "." || 칸 === "");
}

export function 풀기(zip버퍼: Buffer, 어디에: string): number {
  const z = new Zip(zip버퍼);
  const 이름들 = z.names();
  if (이름들.length === 0) throw new Error("zip 이 비어 있습니다.");

  /*
   * zip 맨 위에는 `통돌Note_1.16.31/` 폴더 한 겹이 있습니다. 그 한 겹을
   * **벗겨서** 풉니다. 벗기면 푼 자리가 늘 `payload\` 로 같아지고,
   * .bat 이 한글이 섞인 길을 다룰 일이 없어집니다.
   */
  const 첫칸 = 이름들[0].split("/")[0];
  const 한겹 = 첫칸.length > 0 && 이름들.every((n) => n === 첫칸 || n.startsWith(첫칸 + "/"));
  const 벗길 = 한겹 ? 첫칸.length + 1 : 0;

  rmSync(어디에, { recursive: true, force: true });
  mkdirSync(어디에, { recursive: true });

  let 센것 = 0;
  for (const e of z.entries) {
    const 안쪽 = e.name.slice(벗길);
    if (!안쪽 || 안쪽.endsWith("/")) continue;          // 폴더는 건너뜁니다
    if (!안전한이름(안쪽)) throw new Error(`zip 안에 이상한 이름이 있습니다: ${e.name}`);
    const 갈곳 = join(어디에, 안쪽);
    mkdirSync(dirname(갈곳), { recursive: true });
    writeFileSync(갈곳, z.read(e.name));
    센것++;
  }
  if (센것 === 0) throw new Error("zip 에서 아무것도 나오지 않았습니다.");
  return 센것;
}

/** 푼 것이 정말 통돌 Note 인지 봅니다. 아니면 갈아 끼우지 않습니다. */
export function 푼것점검(자리: string): { 됨: boolean; 까닭: string } {
  if (!existsSync(자리)) return { 됨: false, 까닭: "푼 자리가 없습니다." };
  const exe = readdirSync(자리).filter((n) => n.toLowerCase().endsWith(".exe"));
  if (exe.length !== 1) return { 됨: false, 까닭: `실행 파일이 ${exe.length}개입니다 (하나여야 합니다).` };
  const 크기 = statSync(join(자리, exe[0])).size;
  if (크기 < 20 * 1024 * 1024) return { 됨: false, 까닭: "실행 파일이 너무 작습니다." };
  if (!existsSync(join(자리, "dist-web", "index.html")))
    return { 됨: false, 까닭: "화면(dist-web)이 들어 있지 않습니다." };
  return { 됨: true, 까닭: "" };
}

// ── 확인 한 바퀴 ────────────────────────────────────────────
const 하루 = 24 * 60 * 60 * 1000;

/**
 * 켤 때 한 번 부릅니다. **어떤 잘못도 밖으로 던지지 않습니다** —
 * 업데이트 확인 때문에 프로그램이 안 켜지는 일은 없어야 합니다.
 */
export async function 확인하기(옵션: { 억지로?: boolean; 열쇠?: string } = {}): Promise<형편> {
  if (도는중) return 지금형편;
  if (!켜져있나() && !옵션.억지로) return (지금형편 = { 무엇: "조용" });
  if (!(공개열쇠 ||옵션.열쇠)) return (지금형편 = { 무엇: "조용" });

  // 이미 받아 둔 것이 있으면 그것을 보여 주고 끝냅니다.
  const 이미 = 준비된것();
  if (이미) return (지금형편 = { 무엇: "준비됨", 정보: 이미 });

  if (!옵션.억지로) {
    const 지난번 = Number(metaGet("update_last") ?? 0);
    if (Date.now() - 지난번 < 하루) return 지금형편;
  }

  도는중 = true;
  try {
    metaSet("update_last", String(Date.now()));
    const 정보 = await 버전정보가져오기(읽어올곳(), 옵션.열쇠);

    if (버전견주기(정보.버전, 버전) <= 0) return (지금형편 = { 무엇: "조용" });

    지금형편 = { 무엇: "받는중", 새버전: 정보.버전, 온것: 0, 전체: 정보.크기 };
    const 덩이 = await 내려받기(정보);

    풀기(덩이, 푼자리);
    const 봄 = 푼것점검(푼자리);
    if (!봄.됨) {
      rmSync(준비터, { recursive: true, force: true });
      throw new Error(봄.까닭);
    }
    mkdirSync(준비터, { recursive: true });
    writeFileSync(준비표, `${정보.버전}\n`, "utf8");
    metaSet("update_ready", JSON.stringify(정보));
    return (지금형편 = { 무엇: "준비됨", 정보 });
  } catch (e) {
    /*
     * 조용히 넘어갑니다. 인터넷이 없는 것과 서명이 틀린 것을 화면에서
     * 가려 봐야 기관이 할 수 있는 일이 없습니다. 남길 곳은 검은 창입니다.
     */
    console.log(`  업데이트 확인을 건너뜁니다 — ${e instanceof Error ? e.message : e}`);
    return (지금형편 = { 무엇: "조용" });
  } finally {
    도는중 = false;
  }
}

async function 내려받기(정보: 버전정보): Promise<Buffer> {
  const r = await 데려오기(정보.받는곳, 10 * 60 * 1000);
  if (!r.ok) throw new Error(`새 버전을 못 받았습니다 (${r.status}).`);

  const 조각: Buffer[] = [];
  let 온것 = 0;
  const 읽개 = r.body?.getReader();
  if (!읽개) throw new Error("받을 것이 비어 있습니다.");
  for (;;) {
    const { done, value } = await 읽개.read();
    if (done) break;
    온것 += value.byteLength;
    if (온것 > 정보.크기) throw new Error("받은 것이 버전정보에 적힌 크기보다 큽니다.");
    조각.push(Buffer.from(value));
    지금형편 = { 무엇: "받는중", 새버전: 정보.버전, 온것, 전체: 정보.크기 };
  }
  const 덩이 = Buffer.concat(조각);
  if (덩이.length !== 정보.크기)
    throw new Error(`받은 크기가 다릅니다 (${덩이.length} / ${정보.크기}).`);

  const 지문 = createHash("sha256").update(덩이).digest("hex");
  if (지문 !== 정보.지문)
    throw new Error("받은 파일의 지문이 버전정보와 다릅니다. 버립니다.");
  return 덩이;
}

// ── 형편 보기 ───────────────────────────────────────────────
export function 준비된것(): 버전정보 | null {
  if (!existsSync(준비표)) return null;
  const 적힌것 = metaGet("update_ready");
  if (!적힌것) return null;
  try {
    const 정보 = 버전정보읽기(적힌것);
    if (버전견주기(정보.버전, 버전) <= 0) return null;    // 이미 그 버전이면 볼 것 없음
    if (!푼것점검(푼자리).됨) return null;
    return 정보;
  } catch { return null; }
}

export function 형편보기(): 형편 {
  const 이미 = 준비된것();
  if (이미 && 지금형편.무엇 !== "갈아끼우는중") return { 무엇: "준비됨", 정보: 이미 };
  return 지금형편;
}

/** 「나중에」 — 이 버전에 대해서는 오늘 하루 띠를 접습니다. */
export function 나중에(어느버전: string) {
  metaSet("update_later", JSON.stringify({ 버전: 어느버전, 때: Date.now() }));
}
export function 접어뒀나(어느버전: string): boolean {
  try {
    const o = JSON.parse(metaGet("update_later") ?? "{}");
    return o.버전 === 어느버전 && Date.now() - Number(o.때 || 0) < 하루;
  } catch { return false; }
}

// ── 갈아 끼우기 ─────────────────────────────────────────────
export function 갈아끼우기(): { 됨: boolean; 말: string } {
  const 정보 = 준비된것();
  if (!정보) return { 됨: false, 말: "받아 둔 새 버전이 없습니다." };
  if (process.platform !== "win32")
    return { 됨: false, 말: "갈아 끼우기는 윈도에서만 됩니다." };

  const 바트 = join(process.cwd(), "통돌Note 갈아끼우기.bat");
  if (!existsSync(바트))
    return { 됨: false, 말: "「통돌Note 갈아끼우기.bat」이 프로그램 폴더에 없습니다." };

  writeFileSync(번호표, `${process.pid}\n`, "utf8");
  metaSet("update_from", 버전);
  metaSet("update_to", 정보.버전);

  try {
    Bun.spawn({
      cmd: ["cmd", "/c", "start", "", "/D", process.cwd(), 바트],
      cwd: process.cwd(),
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch (e) {
    return { 됨: false, 말: `갈아끼우기를 시작하지 못했습니다 — ${e}` };
  }

  지금형편 = { 무엇: "갈아끼우는중" };
  /*
   * 화면이 「끄는 중입니다」를 받아 보고 나서 꺼져야 합니다. 곧바로
   * 꺼지면 브라우저에는 연결이 끊긴 흰 화면만 남습니다.
   */
  setTimeout(() => process.exit(0), 1200);
  return { 됨: true, 말: "프로그램을 끄고 새 버전으로 다시 켭니다. 잠시만 기다려 주세요." };
}

// ── 새 버전이 켜진 뒤 뒷정리 ──────────────────────────────────
/**
 * 갈아 끼운 **다음 버전**이 켜질 때 한 번 돕니다.
 *
 * .bat 이 옛 exe 를 `data\update\old\` 에 두고 갔습니다. 그것을 사람이
 * 알아볼 이름으로 `이전버전\` 에 옮기고, 준비터를 비웁니다.
 * (한글 이름은 여기서 붙입니다 — .bat 이 못 하는 일입니다.)
 */
export function 뒷정리(): void {
  try {
    const 갔던버전 = metaGet("update_to");
    if (!갔던버전) return;
    if (버전견주기(버전, 갔던버전) < 0) return;      // 아직 안 켜졌습니다

    const 옛버전 = metaGet("update_from") ?? "이전";
    if (existsSync(옛것자리)) {
      const 것들 = readdirSync(옛것자리).filter((n) => n.toLowerCase().endsWith(".exe"));
      if (것들.length > 0) {
        const 둘곳 = join(process.cwd(), "이전버전");
        mkdirSync(둘곳, { recursive: true });
        let 이름 = `통돌Note_${옛버전}.exe`;
        for (let n = 2; existsSync(join(둘곳, 이름)); n++) 이름 = `통돌Note_${옛버전}-${n}.exe`;
        try { renameSync(join(옛것자리, 것들[0]), join(둘곳, 이름)); } catch { }
      }
    }

    const 적힌것 = metaGet("update_ready");
    if (적힌것) 목록에더하기(적힌것);

    rmSync(준비터, { recursive: true, force: true });
    metaSet("update_ready", "");
    metaSet("update_to", "");
    metaSet("update_from", "");
    지금형편 = { 무엇: "조용" };
  } catch { /* 뒷정리가 켜지는 것을 막지 않습니다 */ }
}

// ── 지난 목록 ───────────────────────────────────────────────
/** 띠를 닫은 뒤에도 「무엇이 바뀌었더라」를 볼 자리입니다. */
export function 지난목록(): 버전정보[] {
  try {
    const a = JSON.parse(metaGet("update_log") ?? "[]");
    return Array.isArray(a) ? a.slice(0, 30) : [];
  } catch { return []; }
}
function 목록에더하기(버전정보글: string) {
  try {
    const 것 = JSON.parse(버전정보글);
    const 목록 = 지난목록().filter((x) => x.버전 !== 것.버전);
    목록.unshift({ ...것, 받는곳: "", 지문: "" });   // 주소·지문은 남길 까닭이 없습니다
    metaSet("update_log", JSON.stringify(목록.slice(0, 30)));
  } catch { }
}

/** 받아 둔 것을 버립니다 (설정에서 「받아 둔 것 지우기」). */
export function 치우기() {
  rmSync(준비터, { recursive: true, force: true });
  metaSet("update_ready", "");
  지금형편 = { 무엇: "조용" };
}
