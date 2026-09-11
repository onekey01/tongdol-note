import { inflateRawSync, deflateRawSync } from "node:zlib";

/**
 * zip 읽기·쓰기 — **원본 포장을 그대로 되살리기 위해** 직접 만들었습니다.
 *
 * ── 왜 라이브러리를 안 쓰는가 ──────────────────────────────
 * .hwpx 는 zip 입니다. 그런데 한글은 포장까지 봅니다.
 * `version.xml` 과 그림은 **무압축**으로 들어 있고, 항목마다 날짜·속성이 다릅니다.
 * 흔한 zip 라이브러리는 전부 다시 압축하면서 이 정보를 지웁니다.
 * 그러면 한글이 「변조되었을 가능성이 있습니다」라며 열지 않습니다.
 *
 * 그래서 여기서는
 *   · 손대지 않은 항목은 **압축된 바이트를 그대로 복사**합니다 (다시 압축하지 않음)
 *   · 압축 방식·날짜·속성·추가필드를 항목마다 그대로 옮깁니다
 *   · 항목 순서도 원본 그대로 둡니다
 *
 * 손댄 항목만 새로 압축합니다.
 */

const LOCAL = 0x04034b50;
const CEN = 0x02014b50;
const EOCD = 0x06054b50;

export type Entry = {
  name: string;
  /** 0 = 무압축(STORED), 8 = DEFLATE */
  method: number;
  crc: number;
  csize: number;
  usize: number;
  time: number;
  date: number;
  flags: number;
  versionMadeBy: number;
  versionNeeded: number;
  intAttr: number;
  extAttr: number;
  extraLocal: Buffer;
  extraCentral: Buffer;
  comment: Buffer;
  /** 압축된 그대로의 바이트. 손대지 않으면 이걸 그대로 씁니다. */
  raw: Buffer;
};

// ── CRC32 ──────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

export function crc32(buf: Buffer): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// ── 읽기 ───────────────────────────────────────────────────
export class Zip {
  entries: Entry[] = [];
  private byName = new Map<string, Entry>();

  constructor(buf: Buffer) {
    // 끝에서 EOCD 를 찾습니다. 주석이 붙어 있을 수 있어 뒤에서부터 훑습니다.
    let eocd = -1;
    for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
      if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("zip 이 아닙니다 (끝 표지를 못 찾음).");

    const count = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);

    for (let i = 0; i < count; i++) {
      if (buf.readUInt32LE(p) !== CEN) throw new Error("zip 목차가 깨졌습니다.");
      const versionMadeBy = buf.readUInt16LE(p + 4);
      const versionNeeded = buf.readUInt16LE(p + 6);
      const flags = buf.readUInt16LE(p + 8);
      const method = buf.readUInt16LE(p + 10);
      const time = buf.readUInt16LE(p + 12);
      const date = buf.readUInt16LE(p + 14);
      const crc = buf.readUInt32LE(p + 16);
      const csize = buf.readUInt32LE(p + 20);
      const usize = buf.readUInt32LE(p + 24);
      const nlen = buf.readUInt16LE(p + 28);
      const elen = buf.readUInt16LE(p + 30);
      const clen = buf.readUInt16LE(p + 32);
      const intAttr = buf.readUInt16LE(p + 36);
      const extAttr = buf.readUInt32LE(p + 38);
      const off = buf.readUInt32LE(p + 42);

      const name = buf.toString("utf8", p + 46, p + 46 + nlen);
      const extraCentral = buf.subarray(p + 46 + nlen, p + 46 + nlen + elen);
      const comment = buf.subarray(p + 46 + nlen + elen, p + 46 + nlen + elen + clen);

      // 자료가 어디서 시작하는지는 지역 헤더를 봐야 압니다
      // (지역 헤더의 추가필드 길이가 목차의 것과 다를 수 있습니다).
      if (buf.readUInt32LE(off) !== LOCAL) throw new Error(`지역 헤더가 깨졌습니다: ${name}`);
      const lnlen = buf.readUInt16LE(off + 26);
      const lelen = buf.readUInt16LE(off + 28);
      const extraLocal = buf.subarray(off + 30 + lnlen, off + 30 + lnlen + lelen);
      const start = off + 30 + lnlen + lelen;

      this.entries.push({
        name, method, crc, csize, usize, time, date, flags,
        versionMadeBy, versionNeeded, intAttr, extAttr,
        extraLocal: Buffer.from(extraLocal),
        extraCentral: Buffer.from(extraCentral),
        comment: Buffer.from(comment),
        raw: Buffer.from(buf.subarray(start, start + csize)),
      });
      p += 46 + nlen + elen + clen;
    }
    for (const e of this.entries) this.byName.set(e.name, e);
  }

  has(name: string) { return this.byName.has(name); }

  /** 안에 든 항목 이름들. 서식을 오려낼 때 무엇을 뺄지 고르는 데 씁니다. */
  names(): string[] { return this.entries.map((e) => e.name); }

  /** 풀어서 돌려줍니다. */
  read(name: string): Buffer {
    const e = this.byName.get(name);
    if (!e) throw new Error(`zip 안에 없습니다: ${name}`);
    return e.method === 0 ? e.raw : inflateRawSync(e.raw);
  }

  text(name: string): string {
    return this.read(name).toString("utf8");
  }

  /**
   * 다시 포장합니다.
   *
   * `replace` 에 없는 항목은 **압축된 바이트를 그대로** 옮깁니다.
   * 다시 압축하지 않으므로 손대지 않은 부분은 원본과 1바이트도 다르지 않습니다.
   *
   * `빼기` 에 든 이름은 **아예 넣지 않습니다.** 편람에서 서식 한 장을 오려낼 때
   * 안 쓰는 구역과 그림을 덜어내는 데 씁니다. 채우기(`Hwpx.save`)는 이 칸을
   * 안 쓰므로, 평소 길에서는 아무것도 사라지지 않습니다.
   */
  /**
   * 꾸러미에 **새 파일을 더합니다** — 직인 그림을 `BinData/` 에 넣을 때 씁니다.
   *
   * 이미 있는 이름이면 아무것도 안 합니다 (그건 `write` 의 `replace` 가 할 일).
   * 새 항목은 한글이 넣어 둔 다른 항목과 같은 모양으로 만듭니다 —
   * 압축(deflate), 날짜 1980-01-01, 추가필드 없음.
   */
  더하기(name: string, data: Buffer): void {
    if (this.byName.has(name)) return;
    const raw = deflateRawSync(data, { level: 9 });
    const e: Entry = {
      name, method: 8, crc: crc32(data), csize: raw.length, usize: data.length,
      time: 0, date: 0x0021,          // 1980-01-01 — 다른 항목과 같게
      flags: 0, versionMadeBy: 20, versionNeeded: 20,
      intAttr: 0, extAttr: 0,
      extraLocal: Buffer.alloc(0), extraCentral: Buffer.alloc(0),
      comment: Buffer.alloc(0), raw,
    };
    this.entries.push(e);
    this.byName.set(name, e);
  }

  write(replace: Record<string, Buffer> = {}, 빼기?: Set<string>): Buffer {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;

    for (const e of this.entries) {
      if (빼기?.has(e.name)) continue;
      const fresh = replace[e.name];
      let method = e.method, crc = e.crc, csize = e.csize, usize = e.usize, raw = e.raw;

      // 바꿔 달라고 했는데 **내용이 원본과 같으면** 손대지 않습니다.
      // 다시 압축하면 압축기 설정 차이로 바이트가 달라져서,
      // 「읽고 안 고치고 쓰면 원본 그대로」가 깨집니다.
      // 그 성질이 있어야 「내가 고친 것 말고는 아무것도 안 변했다」를 잴 수 있습니다.
      if (fresh && crc32(fresh) === e.crc && fresh.length === e.usize) {
        // 같은 내용 — 원본 바이트를 그대로 씁니다.
      } else if (fresh) {
        usize = fresh.length;
        crc = crc32(fresh);
        // 무압축이던 항목은 무압축 그대로 둡니다 (한글이 그렇게 넣어 둔 것).
        raw = e.method === 0 ? fresh : deflateRawSync(fresh, { level: 9 });
        csize = raw.length;
        method = e.method;
      }

      const nameBuf = Buffer.from(e.name, "utf8");

      const lh = Buffer.alloc(30);
      lh.writeUInt32LE(LOCAL, 0);
      lh.writeUInt16LE(e.versionNeeded, 4);
      // 자료 뒤에 크기를 따로 적는 방식(bit 3)은 쓰지 않습니다.
      // 크기를 헤더에 바로 적으므로 그 표시를 끕니다.
      lh.writeUInt16LE(e.flags & ~0x0008, 6);
      lh.writeUInt16LE(method, 8);
      lh.writeUInt16LE(e.time, 10);
      lh.writeUInt16LE(e.date, 12);
      lh.writeUInt32LE(crc, 14);
      lh.writeUInt32LE(csize, 18);
      lh.writeUInt32LE(usize, 22);
      lh.writeUInt16LE(nameBuf.length, 26);
      lh.writeUInt16LE(e.extraLocal.length, 28);
      locals.push(lh, nameBuf, e.extraLocal, raw);

      const ch = Buffer.alloc(46);
      ch.writeUInt32LE(CEN, 0);
      ch.writeUInt16LE(e.versionMadeBy, 4);
      ch.writeUInt16LE(e.versionNeeded, 6);
      ch.writeUInt16LE(e.flags & ~0x0008, 8);
      ch.writeUInt16LE(method, 10);
      ch.writeUInt16LE(e.time, 12);
      ch.writeUInt16LE(e.date, 14);
      ch.writeUInt32LE(crc, 16);
      ch.writeUInt32LE(csize, 20);
      ch.writeUInt32LE(usize, 24);
      ch.writeUInt16LE(nameBuf.length, 28);
      ch.writeUInt16LE(e.extraCentral.length, 30);
      ch.writeUInt16LE(e.comment.length, 32);
      ch.writeUInt16LE(0, 34);              // 디스크 번호
      ch.writeUInt16LE(e.intAttr, 36);
      ch.writeUInt32LE(e.extAttr, 38);
      ch.writeUInt32LE(offset, 42);
      centrals.push(ch, nameBuf, e.extraCentral, e.comment);

      offset += 30 + nameBuf.length + e.extraLocal.length + csize;
    }

    const cdBuf = Buffer.concat(centrals);
    // 뺀 것이 있으면 항목 수도 줄어야 합니다 — 목차 개수가 안 맞으면 못 엽니다.
    const 넣은수 = this.entries.filter((e) => !빼기?.has(e.name)).length;
    const end = Buffer.alloc(22);
    end.writeUInt32LE(EOCD, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(넣은수, 8);
    end.writeUInt16LE(넣은수, 10);
    end.writeUInt32LE(cdBuf.length, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20);

    return Buffer.concat([...locals, cdBuf, end]);
  }
}

/**
 * 새 zip 만들기 — 기록지 여러 장을 한 묶음으로 낼 때 씁니다.
 *
 * 여기 들어가는 것은 우리가 만든 파일이라 원본 포장을 지킬 필요가 없습니다.
 * 그냥 압축해서 담습니다.
 */
export function zipFiles(files: { name: string; data: Buffer }[]): Buffer {
  const now = new Date();
  // MS-DOS 날짜·시각 (1980년 기준)
  const date =
    ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const time =
    (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);

  const locals: Buffer[] = [], centrals: Buffer[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, "utf8");
    const raw = deflateRawSync(f.data, { level: 9 });
    const crc = crc32(f.data);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(LOCAL, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);   // 이름이 UTF-8 이라고 알립니다 (한글 파일명)
    lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(time, 10);
    lh.writeUInt16LE(date, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(raw.length, 18);
    lh.writeUInt32LE(f.data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    locals.push(lh, nameBuf, raw);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(CEN, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(time, 12);
    ch.writeUInt16LE(date, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(raw.length, 20);
    ch.writeUInt32LE(f.data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);

    offset += 30 + nameBuf.length + raw.length;
  }

  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(EOCD, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}
