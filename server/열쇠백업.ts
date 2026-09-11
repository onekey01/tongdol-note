/**
 * `.env` 자동 백업.
 *
 * 왜 필요한가 —
 *
 *   `.env` 안에 **기관 열쇠**(TONGDOL_ORG_KEY)가 있습니다.
 *   이것을 잃으면 우편함에 있는 덩어리를 **영영 못 엽니다.**
 *   되살릴 방법이 없습니다 — 열쇠가 곧 자료입니다.
 *
 *   그런데 「백업하세요」라고 적어 두는 것으로는 안 됩니다.
 *   사람은 안 합니다. 그래서 **프로그램이 알아서** 뜹니다.
 *
 * 어떻게 —
 *
 *   프로그램을 켤 때, 그리고 10분마다 자료함 백업이 돌 때 같이 봅니다.
 *   **내용이 바뀌었을 때만** 새로 뜹니다. 안 바뀌었으면 아무 일도 안 합니다.
 *   같은 파일이 백 장 쌓이는 것을 막으려는 것입니다.
 *
 * 어디에 —
 *
 *   `data/보관/열쇠/`  ← 자료함 백업과 같은 자리
 *   자료함과 열쇠는 **같이 있어야** 쓸모가 있습니다.
 *   자료함만 살리고 열쇠를 잃으면 우편함 것을 못 열고,
 *   열쇠만 살리고 자료함을 잃으면 원본이 없습니다.
 *
 * ★ 이 폴더는 .gitignore 로 막혀 있습니다 (`data/`).
 *   배포 꾸러미에 열쇠가 딸려 나가면 안 됩니다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const 뿌리 = dirname(dirname(fileURLToPath(import.meta.url)));
const 원본 = join(뿌리, ".env");
const 둘곳 = join(뿌리, "data", "보관", "열쇠");
const 남길장수 = 20;

/** 내용이 같은지 봅니다 — 바뀌었을 때만 뜹니다. */
function 마지막것(): string | null {
  if (!existsSync(둘곳)) return null;
  const 들 = readdirSync(둘곳).filter((f) => f.startsWith("env-")).sort();
  if (!들.length) return null;
  try { return readFileSync(join(둘곳, 들[들.length - 1]), "utf8"); }
  catch { return null; }
}

/** 오래된 것을 치웁니다. 쌓이기만 하면 그것대로 짐입니다. */
function 오래된것치우기(): void {
  const 들 = readdirSync(둘곳)
    .filter((f) => f.startsWith("env-"))
    .map((f) => ({ f, t: statSync(join(둘곳, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const x of 들.slice(남길장수)) {
    try { unlinkSync(join(둘곳, x.f)); } catch { /* 못 지워도 넘어갑니다 */ }
  }
}

/**
 * 바뀌었으면 한 장 뜹니다.
 * 돌려주는 값 = 뜬 파일 이름 (안 떴으면 null).
 */
export function 열쇠백업하기(): string | null {
  if (!existsSync(원본)) return null;          // 우편함을 안 쓰는 기관
  const 지금 = readFileSync(원본, "utf8");
  if (지금 === 마지막것()) return null;         // 안 바뀌었으면 할 일 없음

  mkdirSync(둘곳, { recursive: true });
  const 때 = new Date();
  const 이름 =
    `env-${때.getFullYear()}${String(때.getMonth() + 1).padStart(2, "0")}` +
    `${String(때.getDate()).padStart(2, "0")}-` +
    `${String(때.getHours()).padStart(2, "0")}${String(때.getMinutes()).padStart(2, "0")}` +
    `${String(때.getSeconds()).padStart(2, "0")}.txt`;

  writeFileSync(join(둘곳, 이름), 지금, "utf8");
  오래된것치우기();
  return 이름;
}
