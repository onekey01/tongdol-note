/*
 * ── 문지기 — 바깥에서 들어오는 것을 여기서 걸러 냅니다 ─────
 *
 * (2026-09-08 무무 — 「**외부에서 뚫고 들어올 가능성**에 대한 보안점검까지
 *  이루어져야 해.」)
 *
 * ── 「127.0.0.1 에만 열어 뒀으니 안전하다」가 왜 틀린가 ─────
 *
 * 이 프로그램은 자기 컴퓨터에만 귀를 엽니다. 그래서 사무실 밖에서 직접
 * 들어올 수는 없습니다. 그런데 **길이 하나 더 있습니다 — 관리자의
 * 브라우저입니다.**
 *
 * 관리자가 점심때 뉴스를 보다 나쁜 광고가 붙은 쪽을 엽니다. 그 쪽의
 * 자바스크립트는 **그 컴퓨터 안에서** 돕니다. 그러니 127.0.0.1 도
 * 두드릴 수 있습니다. 이것을 「**DNS 되박기**(rebinding)」라고 합니다 —
 *
 *   ① 나쁜 쪽이 `evil.example.com` 을 아주 짧은 수명으로 알려 줍니다
 *   ② 브라우저가 그 쪽을 엽니다 (진짜 나쁜 서버에 붙습니다)
 *   ③ 잠시 뒤 같은 이름이 이번엔 **127.0.0.1** 을 가리키게 바꿉니다
 *   ④ 브라우저는 「같은 쪽」이라고 믿고, 그 쪽 자바스크립트가
 *      **우리 프로그램의 답을 그대로 읽습니다**
 *
 * 브라우저의 다른 막이(같은 출처 규칙·SameSite 쿠키)는 이 수법에
 * **안 걸립니다.** 브라우저가 보기에 이름이 같기 때문입니다.
 *
 * ── 막는 법은 한 줄입니다 ──────────────────────────────────
 *
 * 요청에 실려 오는 **`Host` 머리글은 브라우저가 「원래 치려던 이름」을
 * 적어 보냅니다.** 되박기가 일어나면 거기 `evil.example.com` 이
 * 적혀 옵니다. 그러니 **우리가 아는 이름이 아니면 그냥 안 받으면**
 * 됩니다. 그게 이 파일입니다.
 *
 * 2026-09-08 점검 전에는 **아무 이름이나 받고 있었습니다.**
 */
import { networkInterfaces } from "node:os";

/** 우리가 우리로 아는 이름들. 여기 없으면 안 받습니다. */
const 우리이름 = new Set(["127.0.0.1", "localhost", "::1", "[::1]", "0.0.0.0"]);

/** 사무실 열기로 열어 둔 랜 주소 — 열려 있는 동안만 늘어납니다. */
let 랜이름: string | null = null;
export function 랜이름정하기(주소: string | null) {
  랜이름 = 주소 ? 주소.replace(/^https?:\/\//, "").split(":")[0] : null;
}

/** 이 컴퓨터가 가진 랜 주소들 — 사무실 열기가 켜졌을 때만 씁니다. */
export function 내랜주소들(): string[] {
  const 것 = networkInterfaces();
  const 목록: string[] = [];
  for (const 이름 of Object.keys(것)) {
    for (const n of 것[이름] ?? []) {
      if (n.family === "IPv4" && !n.internal) 목록.push(n.address);
    }
  }
  return 목록;
}

/** `Host: 127.0.0.1:5757` 에서 이름만 떼어 냅니다. */
export function 이름만(host: string | null): string {
  const h = String(host ?? "").trim().toLowerCase();
  if (!h) return "";
  if (h.startsWith("[")) return h.slice(0, h.indexOf("]") + 1);   // [::1]:5757
  return h.split(":")[0];
}

export type 문지기결과 = { 됨: true } | { 됨: false; 까닭: string; 코드: number };

/**
 * ── ① 이름 검사 (DNS 되박기 막이) ──────────────────────────
 *
 * `Host` 가 우리가 아는 이름이 아니면 **아무 답도 주지 않습니다.**
 * 이름이 없어도(옛 HTTP/1.0) 안 받습니다 — 요즘 브라우저는 늘 보냅니다.
 */
export function 이름괜찮나(req: Request, 랜도되나 = false): 문지기결과 {
  const 이름 = 이름만(req.headers.get("host"));
  if (!이름) return { 됨: false, 까닭: "Host 머리글이 없습니다.", 코드: 400 };
  if (우리이름.has(이름)) return { 됨: true };
  if (랜도되나) {
    if (랜이름 && 이름 === 랜이름) return { 됨: true };
    if (내랜주소들().includes(이름)) return { 됨: true };
  }
  return {
    됨: false,
    코드: 403,
    까닭:
      "이 프로그램은 이 컴퓨터에서만 씁니다.\n" +
      "브라우저 주소창에 http://127.0.0.1 로 시작하는 주소를 넣어 주세요.",
  };
}

/**
 * ── ② 어디서 눌렀나 검사 (건드리는 요청만) ─────────────────
 *
 * 읽기만 하는 GET 은 안 봅니다. **자료를 바꾸는 요청**에만 `Origin` 을
 * 봅니다 — 브라우저가 그런 요청에는 「어느 쪽에서 눌렀는지」를 꼭
 * 적어 보내기 때문입니다. 우리 쪽이 아니면 안 받습니다.
 *
 * `Origin` 이 아예 없는 것은 받습니다 — 브라우저가 아닌 것(시험 도구,
 * 우리 스스로의 부름)에는 없기 때문입니다. 브라우저를 거쳐 오는 나쁜
 * 요청에는 **반드시 있습니다.**
 */
const 바꾸는것 = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export function 어디서눌렀나(req: Request, 랜도되나 = false): 문지기결과 {
  if (!바꾸는것.has(req.method)) return { 됨: true };
  const o = req.headers.get("origin");
  if (!o) return { 됨: true };
  let 이름 = "";
  try { 이름 = new URL(o).hostname.toLowerCase(); } catch { 이름 = ""; }
  if (우리이름.has(이름)) return { 됨: true };
  if (랜도되나 && (이름 === 랜이름 || 내랜주소들().includes(이름))) return { 됨: true };
  return {
    됨: false, 코드: 403,
    까닭: "다른 쪽에서 온 요청이라 받지 않았습니다.",
  };
}

/** 둘 다 봅니다. 하나라도 걸리면 그 자리에서 막습니다. */
export function 문지기(req: Request, 랜도되나 = false): 문지기결과 {
  const a = 이름괜찮나(req, 랜도되나);
  if (!a.됨) return a;
  return 어디서눌렀나(req, 랜도되나);
}

/*
 * ── ③ 자꾸 틀리면 늦춥니다 ────────────────────────────────
 *
 * 로그인 비밀번호와 사무실 번호(여섯 자리)를 지킵니다.
 *
 * **잠그지는 않습니다.** 영영 못 들어가게 하면 기관이 통째로 잠기고,
 * 그건 남이 일부러 틀려서 만들 수 있는 상태이기도 합니다. 대신
 * **점점 느리게** 만듭니다 — 사람은 못 느끼고 기계만 못 견딥니다.
 *
 * 여섯 자리 번호는 백만 가지입니다. 늦추기가 없으면 랜 안에서
 * **몇 시간이면 다 눌러 볼 수 있습니다.** 이 파일이 그것을 막습니다.
 */
type 틀린것 = { 번: number; 언제: number };
const 틀린기록 = new Map<string, 틀린것>();

/** 얼마를 기다려야 하나 (밀리초). 0 이면 지금 해도 됩니다. */
export function 얼마나기다려야(열쇠: string, 지금 = Date.now()): number {
  const r = 틀린기록.get(열쇠);
  if (!r) return 0;
  /* 10분 동안 아무 일 없으면 잊습니다 — 어제 실수를 오늘까지 물지 않습니다. */
  if (지금 - r.언제 > 10 * 60_000) { 틀린기록.delete(열쇠); return 0; }
  const 쉴것 = 쉬는시간(r.번);
  const 남은것 = r.언제 + 쉴것 - 지금;
  return 남은것 > 0 ? 남은것 : 0;
}

/** 다섯 번까지는 그냥, 그 뒤로 점점 길게. 최대 5분. */
function 쉬는시간(번: number): number {
  if (번 < 5) return 0;
  if (번 < 8) return 30_000;
  if (번 < 12) return 60_000;
  return 5 * 60_000;
}

export function 틀렸다(열쇠: string, 지금 = Date.now()) {
  const r = 틀린기록.get(열쇠);
  틀린기록.set(열쇠, { 번: (r?.번 ?? 0) + 1, 언제: 지금 });
}

export function 맞았다(열쇠: string) { 틀린기록.delete(열쇠); }

/** 사람이 읽을 말로. 「30초 뒤에 다시」 */
export function 기다리란말(밀리초: number): string {
  const 초 = Math.ceil(밀리초 / 1000);
  if (초 <= 60) return `${초}초 뒤에 다시 해 주세요.`;
  return `${Math.ceil(초 / 60)}분 뒤에 다시 해 주세요.`;
}

/** 시험에서만 씁니다. */
export function 기록비우기() { 틀린기록.clear(); }
