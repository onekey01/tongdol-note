import * as CFB from "cfb";
import { createHash, createDecipheriv } from "node:crypto";

/**
 * 암호가 걸린 엑셀 파일을 풉니다.
 *
 * 지자체가 보내주는 대상자 명단은 개인정보라 대부분 암호가 걸려 있습니다.
 * 기관이 매달 "암호를 풀어 다른 이름으로 저장" 하는 수고를 없애려고
 * 프로그램이 직접 풉니다. 암호는 저장하지 않습니다. 푸는 순간에만 씁니다.
 *
 * 방식: ECMA-376 Agile Encryption (엑셀 2010 이후 표준)
 *   1) 암호 + 소금(salt) 을 정해진 횟수만큼 되풀이해 해시 → 기본키
 *   2) 기본키로 '진짜 열쇠' 를 풀어냄
 *   3) 진짜 열쇠로 본문을 조각(4096바이트)마다 풀어냄
 *
 * 조각마다 열쇠벡터(IV)가 달라서 조각 번호를 섞어 다시 만들어야 합니다.
 * 이 부분이 안 맞으면 파일이 깨진 채로 나옵니다.
 */

const BLOCK = 4096;

// 규격에 정해진 고정값입니다. 용도마다 다른 값을 섞어 열쇠를 만듭니다.
const B_KEY = Buffer.from([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]);
const B_VERIN = Buffer.from([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]);
const B_VERVAL = Buffer.from([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]);

export class WrongPassword extends Error {}
export class NotEncrypted extends Error {}

function attr(xml: string, tag: string, name: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\s${name}="([^"]*)"`));
  return m ? m[1] : "";
}

function hashOf(algo: string) {
  const a = algo.toUpperCase();
  if (a === "SHA512") return "sha512";
  if (a === "SHA384") return "sha384";
  if (a === "SHA256") return "sha256";
  if (a === "SHA1") return "sha1";
  throw new Error(`모르는 해시 방식입니다: ${algo}`);
}

function fit(buf: Buffer, size: number, pad = 0x36): Buffer {
  if (buf.length === size) return buf;
  if (buf.length > size) return buf.subarray(0, size);
  return Buffer.concat([buf, Buffer.alloc(size - buf.length, pad)]);
}

/** 암호 → 되풀이 해시로 만든 기본키 */
function baseKey(pw: string, salt: Buffer, spin: number, algo: string): Buffer {
  const h = hashOf(algo);
  let k = createHash(h).update(Buffer.concat([salt, Buffer.from(pw, "utf16le")])).digest();
  const n = Buffer.alloc(4);
  for (let i = 0; i < spin; i++) {
    n.writeUInt32LE(i, 0);
    k = createHash(h).update(Buffer.concat([n, k])).digest();
  }
  return k;
}

/** 기본키 + 용도별 고정값 → 그 용도의 열쇠 */
function derive(base: Buffer, blockKey: Buffer, algo: string, bits: number): Buffer {
  const k = createHash(hashOf(algo)).update(Buffer.concat([base, blockKey])).digest();
  return fit(k, bits / 8);
}

function aesCbcDecrypt(key: Buffer, iv: Buffer, data: Buffer): Buffer {
  const d = createDecipheriv(key.length === 16 ? "aes-128-cbc" : "aes-256-cbc", key, iv);
  d.setAutoPadding(false);
  return Buffer.concat([d.update(data), d.final()]);
}

/** 파일이 암호로 잠겨 있는가? (엑셀 파일은 zip, 잠긴 파일은 OLE 구조입니다) */
export function isEncrypted(buf: Buffer): boolean {
  return buf.length > 8 && buf.readUInt32BE(0) === 0xd0cf11e0;
}

export function decryptXlsx(buf: Buffer, password: string): Buffer {
  if (!isEncrypted(buf)) throw new NotEncrypted("암호가 걸린 파일이 아닙니다.");

  const cfb = CFB.read(buf, { type: "buffer" });
  const info = CFB.find(cfb, "EncryptionInfo");
  const pack = CFB.find(cfb, "EncryptedPackage");
  if (!info || !pack) throw new Error("암호 정보를 찾지 못했습니다.");

  const infoBuf = Buffer.from(info.content as Uint8Array);
  const packBuf = Buffer.from(pack.content as Uint8Array);

  // 앞 8바이트는 버전 정보, 그 뒤가 설정 XML 입니다.
  const xml = infoBuf.subarray(8).toString("utf8");
  if (!xml.includes("keyData")) {
    throw new Error("옛 방식으로 잠긴 파일입니다. 엑셀에서 암호를 풀어 저장한 뒤 올려 주세요.");
  }

  const keySalt = Buffer.from(attr(xml, "keyData", "saltValue"), "base64");
  const keyBits = Number(attr(xml, "keyData", "keyBits"));
  const keyHash = attr(xml, "keyData", "hashAlgorithm");

  const encPart = xml.slice(xml.indexOf("<p:encryptedKey"));
  const pSalt = Buffer.from(attr(encPart, "p:encryptedKey", "saltValue"), "base64");
  const pSpin = Number(attr(encPart, "p:encryptedKey", "spinCount"));
  const pBits = Number(attr(encPart, "p:encryptedKey", "keyBits"));
  const pHash = attr(encPart, "p:encryptedKey", "hashAlgorithm");
  const encKey = Buffer.from(attr(encPart, "p:encryptedKey", "encryptedKeyValue"), "base64");
  const verIn = Buffer.from(attr(encPart, "p:encryptedKey", "encryptedVerifierHashInput"), "base64");
  const verVal = Buffer.from(attr(encPart, "p:encryptedKey", "encryptedVerifierHashValue"), "base64");

  const base = baseKey(password, pSalt, pSpin, pHash);

  // 암호가 맞는지 먼저 확인합니다. 틀리면 여기서 걸립니다.
  const vIn = aesCbcDecrypt(derive(base, B_VERIN, pHash, pBits), fit(pSalt, 16), verIn);
  const vVal = aesCbcDecrypt(derive(base, B_VERVAL, pHash, pBits), fit(pSalt, 16), verVal);
  const want = createHash(hashOf(pHash)).update(vIn).digest();
  if (!want.subarray(0, 20).equals(vVal.subarray(0, 20))) {
    throw new WrongPassword("암호가 맞지 않습니다.");
  }

  // 진짜 열쇠를 꺼냅니다.
  const secret = aesCbcDecrypt(derive(base, B_KEY, pHash, pBits), fit(pSalt, 16), encKey)
    .subarray(0, pBits / 8);

  // 본문은 앞 8바이트가 '원래 길이', 그 뒤가 암호문입니다.
  const size = Number(packBuf.readBigUInt64LE(0));
  const body = packBuf.subarray(8);

  const out: Buffer[] = [];
  const n = Buffer.alloc(4);
  for (let i = 0; i * BLOCK < body.length; i++) {
    n.writeUInt32LE(i, 0);
    // 조각마다 열쇠벡터가 다릅니다. 조각 번호를 소금에 섞어 만듭니다.
    const iv = fit(createHash(hashOf(keyHash)).update(Buffer.concat([keySalt, n])).digest(), 16);
    const chunk = body.subarray(i * BLOCK, Math.min((i + 1) * BLOCK, body.length));
    out.push(aesCbcDecrypt(secret, iv, chunk));
  }

  return Buffer.concat(out).subarray(0, size);
}

/** 암호가 걸려 있으면 풀고, 아니면 그대로 돌려줍니다. */
export function openXlsx(buf: Buffer, password?: string): Buffer {
  if (!isEncrypted(buf)) return buf;
  if (!password) throw new WrongPassword("암호가 걸린 파일입니다. 암호를 입력해 주세요.");
  return decryptXlsx(buf, password);
}
