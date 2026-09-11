/**
 * 우편함 자물쇠 — 잠그고 푸는 것만 합니다.
 *
 * 이 파일의 규칙 두 가지 —
 *
 *   1. **브라우저에서도 그대로 돕니다.** 표준 WebCrypto 만 씁니다.
 *      기관 PC(Bun)와 휴대폰(브라우저)이 **같은 코드**를 쓰게 하려는 것입니다.
 *      두 쪽이 다른 코드를 쓰면 언젠가 어긋나고, 어긋나면 못 엽니다.
 *
 *   2. **열쇠는 우편함을 지나가지 않습니다.** 기관 PC 가 만들어서
 *      등록 QR 에 실어 휴대폰으로 직접 건넵니다.
 *
 * 방식은 AES-GCM 256 입니다. 덩어리 모양 —
 *
 *     v1.<12바이트 소금>.<잠긴 글>
 *
 * 소금(IV)은 매번 새로 뽑습니다. 같은 글을 두 번 잠가도 다르게 나옵니다.
 * GCM 은 덧붙은 검사값이 있어서 **한 글자만 건드려도 안 열립니다.**
 */

const 부호 = new TextEncoder();
const 해독 = new TextDecoder();

/** 바이트 → base64url (= 없이). QR·URL 에 그대로 실을 수 있습니다. */
function 예순넷(b: Uint8Array): string {
  let s = "";
  for (const n of b) s += String.fromCharCode(n);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/*
 * 돌려주는 것을 Uint8Array<ArrayBuffer> 로 못 박습니다.
 * 그냥 new Uint8Array(n) 은 ArrayBufferLike 라, WebCrypto 가 요구하는
 * BufferSource 와 타입이 안 맞습니다 (공유 메모리일 수도 있어서).
 */
function 예순넷풀기(s: string): Uint8Array<ArrayBuffer> {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 기관 열쇠를 새로 하나 만듭니다. 기관마다 딱 하나. */
export function 새열쇠(): string {
  return 예순넷(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(32))));
}

async function 열쇠읽기(열쇠: string): Promise<CryptoKey> {
  const raw = 예순넷풀기(열쇠);
  if (raw.length !== 32)
    throw new Error(`기관 열쇠는 32바이트여야 합니다 (지금 ${raw.length}바이트)`);
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** 글을 잠급니다. 무엇을 넣든 밖에서는 뜻 모를 덩어리입니다. */
export async function 잠그기(열쇠: string, 글: string): Promise<string> {
  const k = await 열쇠읽기(열쇠);
  const 소금 = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const 잠긴 = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: 소금 }, k, 부호.encode(글)),
  );
  return `v1.${예순넷(소금)}.${예순넷(잠긴)}`;
}

/** 덩어리를 풉니다. 열쇠가 다르거나 한 글자라도 건드려졌으면 던집니다. */
export async function 풀기(열쇠: string, 덩어리: string): Promise<string> {
  const 쪽 = 덩어리.split(".");
  if (쪽.length !== 3 || 쪽[0] !== "v1")
    throw new Error("우편함 덩어리 모양이 아닙니다");
  const k = await 열쇠읽기(열쇠);
  try {
    const 푼 = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: 예순넷풀기(쪽[1]) }, k, 예순넷풀기(쪽[2]),
    );
    return 해독.decode(푼);
  } catch {
    throw new Error("열지 못했습니다 — 열쇠가 다르거나 내용이 바뀌었습니다");
  }
}

/** 무엇이든 잠가서 넣고, 꺼낼 때 되돌립니다. */
/**
 * ── 사진처럼 **큰 덩이**를 잠급니다 ─────────────────────────
 *
 * 글이 아니라 바이트를 그대로 다룹니다.
 * 사진을 예순넷(base64)으로 바꿔서 글로 잠그면 **크기가 1.33배**가 됩니다.
 * 한 장에 300KB 면 400KB 가 되어 올라갑니다 — 제공인력의 데이터 요금입니다.
 *
 * 나오는 모양:  [소금 12바이트][잠긴 것]
 * 앞 12바이트를 떼어 내면 그것이 소금(IV)입니다. 따로 적어 둘 것이 없습니다.
 */
export async function 덩이잠그기(열쇠: string, 덩이: Uint8Array): Promise<Uint8Array> {
  const k = await 열쇠읽기(열쇠);
  const 소금 = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const 잠긴 = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: 소금 }, k, 덩이 as BufferSource),
  );
  const 나갈것 = new Uint8Array(new ArrayBuffer(12 + 잠긴.length));
  나갈것.set(소금, 0);
  나갈것.set(잠긴, 12);
  return 나갈것;
}

/** 잠근 덩이를 풉니다. 한 바이트라도 건드려졌으면 던집니다. */
export async function 덩이풀기(열쇠: string, 덩이: Uint8Array): Promise<Uint8Array> {
  if (덩이.length < 13) throw new Error("사진 덩이가 너무 짧습니다");
  const k = await 열쇠읽기(열쇠);
  const 소금 = 덩이.slice(0, 12);
  const 속 = 덩이.slice(12);
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: 소금 }, k, 속 as BufferSource),
  );
}

export async function 짐싸기(열쇠: string, 짐: unknown): Promise<string> {
  return 잠그기(열쇠, JSON.stringify(짐));
}
export async function 짐풀기<T = unknown>(열쇠: string, 덩어리: string): Promise<T> {
  return JSON.parse(await 풀기(열쇠, 덩어리)) as T;
}

/**
 * 일회용 등록표를 만듭니다.
 * 표 자체는 QR 로만 나가고, 우편함에는 **해시만** 저장합니다.
 * 우편함이 새어도 표를 되만들 수 없습니다.
 */
export function 새등록표(): string {
  return 예순넷(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(24))));
}

export async function 표해시(표: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", 부호.encode(표)));
  return [...h].map((n) => n.toString(16).padStart(2, "0")).join("");
}

/* ══════════════════════════════════════════════════════════════
 *  열쇠 싸서 건네기 (v1.6.25)
 *
 *  왜 이게 필요한가 —
 *
 *    처음에는 기관 열쇠를 QR 에 그대로 실었습니다. 그런데 QR 은
 *    **아무 앱이나 갖다 대면 안에 든 글이 맨눈에 읽힙니다.**
 *    어깨너머로 찍히거나, 사진첩에 남거나, 어딘가에 붙여넣어지면
 *    그 기관의 모든 덩어리가 열립니다. 그리고 기관 열쇠는
 *    **바꾸면 그 전에 잠근 것을 못 엽니다** — 되돌리기가 아주 비쌉니다.
 *
 *  그래서 QR 에서 열쇠를 뺐습니다. 대신 이렇게 건넵니다 —
 *
 *    1. 휴대폰이 자물쇠 **한 쌍**을 만듭니다 (공개쪽·개인쪽)
 *    2. **공개쪽만** 우편함에 올립니다 — 새도 아무 쓸모가 없습니다
 *    3. 기관 PC 가 그 공개쪽으로 **기관 열쇠를 싸서** 우편함에 둡니다
 *    4. 그 폰의 개인쪽으로만 풀립니다. 우편함은 싼 덩어리만 보고 못 엽니다
 *
 *  이제 QR 이 찍혀도 나오는 것은 **15분짜리 일회용 표 하나**뿐입니다.
 *  이미 썼으면 그것마저 쓸모없습니다.
 *
 *  방식은 ECDH(P-256) + AES-GCM 입니다. 둘 다 브라우저에 이미 있습니다.
 * ══════════════════════════════════════════════════════════════ */

const 곡선 = { name: "ECDH", namedCurve: "P-256" } as const;

/** 휴대폰이 부릅니다. 공개쪽은 밖에 내도 되고, 개인쪽은 그 폰에만 둡니다. */
export async function 키쌍만들기(): Promise<{ 공개: string; 개인: string }> {
  const 쌍 = await crypto.subtle.generateKey(곡선, true, ["deriveKey"]);
  const 공개 = new Uint8Array(await crypto.subtle.exportKey("raw", 쌍.publicKey));
  const 개인 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", 쌍.privateKey));
  return { 공개: 예순넷(공개), 개인: 예순넷(개인) };
}

async function 공개쪽읽기(s: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", 예순넷풀기(s), 곡선, true, []);
}
async function 개인쪽읽기(s: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("pkcs8", 예순넷풀기(s), 곡선, false, ["deriveKey"]);
}

/** 두 쪽을 맞춰 **같은 자물쇠**를 얻습니다. 양쪽이 각자 계산하고, 오가지 않습니다. */
async function 맞춘열쇠(내개인: CryptoKey, 남공개: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: 남공개 }, 내개인,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

/**
 * 기관 PC 가 부릅니다 — 받는 사람의 공개쪽으로 글을 쌉니다.
 * 쌀 때마다 한 번 쓰고 버리는 쌍을 새로 만듭니다.
 * 모양:  w1.<내 공개쪽>.<소금>.<싼 글>
 */
export async function 싸기(받는이공개: string, 글: string): Promise<string> {
  const 한번쓸쌍 = await crypto.subtle.generateKey(곡선, true, ["deriveKey"]);
  const 자물쇠 = await 맞춘열쇠(한번쓸쌍.privateKey, await 공개쪽읽기(받는이공개));
  const 소금 = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const 싼것 = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: 소금 }, 자물쇠, 부호.encode(글)),
  );
  const 내공개 = new Uint8Array(await crypto.subtle.exportKey("raw", 한번쓸쌍.publicKey));
  return `w1.${예순넷(내공개)}.${예순넷(소금)}.${예순넷(싼것)}`;
}

/** 휴대폰이 부릅니다 — 제 개인쪽으로 풉니다. 다른 폰은 못 풉니다. */
export async function 싼것풀기(내개인: string, 싼것: string): Promise<string> {
  const 쪽 = 싼것.split(".");
  if (쪽.length !== 4 || 쪽[0] !== "w1")
    throw new Error("싼 덩어리 모양이 아닙니다");
  const 자물쇠 = await 맞춘열쇠(await 개인쪽읽기(내개인), await 공개쪽읽기(쪽[1]));
  try {
    return 해독.decode(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: 예순넷풀기(쪽[2]) }, 자물쇠, 예순넷풀기(쪽[3]),
    ));
  } catch {
    throw new Error("풀지 못했습니다 — 이 기기의 것이 아니거나 내용이 바뀌었습니다");
  }
}
