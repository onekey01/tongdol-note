/**
 * 기관 하나를 우편함에 세웁니다. **기관마다 한 번만** 합니다.
 *
 *   bun 도구/기관만들기.ts "공룡복지관"
 *
 * 무엇을 만드나 —
 *   1. 우편함 로그인 계정 하나 (그 기관 PC 가 쓸 것)
 *   2. org 줄 하나
 *   3. 둘을 잇는 org_member 줄
 *   4. 그 기관의 **기관 열쇠** (잠그고 푸는 열쇠)
 *
 * 그리고 .env 에 네 줄을 적어 넣습니다.
 *
 * ★ 개발 열쇠(sb_secret_)를 쓰는 **유일한 도구**입니다.
 *   기관에 나가는 프로그램에는 이 파일이 들어가지 않습니다.
 */
import { 새열쇠 } from "../server/우편함자물쇠";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const 이름 = process.argv[2]?.trim();
if (!이름) {
  console.error("\n  쓰는 법:  bun 도구/기관만들기.ts \"기관 이름\"\n");
  process.exit(1);
}

const 주소 = process.env.TONGDOL_SUPABASE_URL?.trim();
const 개발열쇠 = process.env.TONGDOL_SUPABASE_SECRET_KEY?.trim();
const 공개열쇠 = process.env.TONGDOL_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!주소 || !개발열쇠 || !공개열쇠) {
  console.error("\n  .env 에 주소와 열쇠 두 개가 있어야 합니다.\n");
  process.exit(1);
}

/** 개발 열쇠로 부릅니다 — 이 도구에서만. */
async function 개발(길: string, 옵션: RequestInit = {}) {
  const r = await fetch(`${주소}${길}`, {
    ...옵션,
    headers: {
      apikey: 개발열쇠!,
      Authorization: `Bearer ${개발열쇠}`,
      "content-type": "application/json",
      ...(옵션.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`${길} 실패 (${r.status}) ${await r.text()}`);
  return r;
}

if (process.env.TONGDOL_ORG_KEY?.trim()) {
  console.error(`
  이미 .env 에 기관이 들어 있습니다 (TONGDOL_ORG_KEY).
  기관을 또 세우면 앞의 열쇠를 잃어 **옛 덩어리를 못 열게 됩니다.**
  정말 새로 세우시려면 .env 에서 TONGDOL_ORG_* 네 줄을 먼저 지우세요.
`);
  process.exit(1);
}

const 말 = (s: string) => console.log(`  ${s}`);

/** 도중에 실패하면 만든 것을 되돌립니다 — 붕 뜬 계정을 안 남기려고. */
const 되돌릴것: (() => Promise<unknown>)[] = [];
async function 되돌리기() {
  for (const f of 되돌릴것.reverse()) {
    try { await f(); } catch { /* 되돌리기 실패는 조용히 넘어갑니다 */ }
  }
}

/*
 * 지난번 실패로 붕 뜬 계정이 있으면 먼저 치웁니다.
 * org-…@tongdol.local 인데 어느 기관에도 안 이어진 계정이 그것입니다.
 */
async function 붕뜬계정치우기() {
  const 목록 = (await (await 개발("/auth/v1/admin/users?per_page=200")).json()) as
    { users?: { id: string; email: string }[] };
  const 후보 = (목록.users ?? []).filter((u) => /^org-[0-9a-f]{8}@tongdol\.local$/.test(u.email ?? ""));
  if (!후보.length) return;
  const 이어진 = (await (await 개발("/rest/v1/org_member?select=user_id")).json()) as
    { user_id: string }[];
  const 이어진집합 = new Set(이어진.map((r) => r.user_id));
  let 치운수 = 0;
  for (const u of 후보) {
    if (이어진집합.has(u.id)) continue;
    await 개발(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" });
    치운수++;
  }
  if (치운수) 말(`통과  지난번에 붕 뜬 계정 ${치운수}개를 치웠습니다`);
}

console.log(`\n  기관을 세웁니다 — 「${이름}」\n`);

try {
  await 붕뜬계정치우기();

  // ── 1. 기관 줄 ──────────────────────────────────────────
  const 기관 = (await (await 개발("/rest/v1/org", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ name: 이름 }),
  })).json()) as { id: string }[];
  var 기관번호 = 기관[0].id;
  되돌릴것.push(() => 개발(`/rest/v1/org?id=eq.${기관번호}`, { method: "DELETE" }));
  말(`통과  기관 줄     ${기관번호}`);

  // ── 2. 로그인 계정 ──────────────────────────────────────
  //  사람이 아니라 프로그램이 쓰는 계정이라 진짜 메일함이 없는 주소를 씁니다.
  var 이메일 = `org-${crypto.randomUUID().slice(0, 8)}@tongdol.local`;
  var 비밀번호 = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
  const 사용자 = (await (await 개발("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email: 이메일, password: 비밀번호, email_confirm: true }),
  })).json()) as { id: string };
  되돌릴것.push(() => 개발(`/auth/v1/admin/users/${사용자.id}`, { method: "DELETE" }));
  말(`통과  로그인 계정  ${이메일}`);

  // ── 3. 잇기 ─────────────────────────────────────────────
  await 개발("/rest/v1/org_member", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ user_id: 사용자.id, org_id: 기관번호 }),
  });
  말("통과  계정과 기관을 이었습니다");

  // ── 4. 기관 열쇠 ────────────────────────────────────────
  var 기관열쇠 = 새열쇠();
  말("통과  기관 열쇠를 만들었습니다 (이 PC 밖으로 안 나갑니다)");
} catch (e) {
  console.error(`\n  ✗ 실패 — ${(e as Error).message}`);
  console.error("  만들던 것을 되돌립니다…");
  await 되돌리기();
  console.error("  되돌렸습니다. 우편함은 손대기 전 상태입니다.\n");
  process.exit(1);
}

// ── 5. .env 에 적기 ───────────────────────────────────────
// ★ 윈도우에서 .pathname 은 "/C:/Users/…" 가 되어 깨집니다. fileURLToPath 를 써야 합니다.
const 길 = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(길)) copyFileSync(길, `${길}.bak.${Date.now()}`);
let 글 = existsSync(길) ? readFileSync(길, "utf8") : "";
글 = 글.replace(/^TONGDOL_(ORG_EMAIL|ORG_PASSWORD|ORG_KEY|ORG_ID)=.*$/gm, "").trimEnd();
글 += `

# ── 기관 「${이름}」 — 도구/기관만들기.ts 가 적었습니다 (${new Date().toISOString().slice(0,10)})
# ★ ORG_KEY 를 잃으면 우편함의 덩어리를 아무도 못 엽니다. 백업에 꼭 같이 넣으세요.
TONGDOL_ORG_ID=${기관번호}
TONGDOL_ORG_EMAIL=${이메일}
TONGDOL_ORG_PASSWORD=${비밀번호}
TONGDOL_ORG_KEY=${기관열쇠}
`;
writeFileSync(길, 글 + "\n", "utf8");
말(`통과  .env 에 적었습니다`);

console.log(`
  ────────────────────────────────────────────────
  「${이름}」이 우편함에 섰습니다.

  ★ 다음 두 가지를 꼭 지키세요 ★
    · .env 를 백업에 포함하세요 — TONGDOL_ORG_KEY 를 잃으면
      우편함에 있는 덩어리를 **영영 못 엽니다.**
    · 이 도구는 기관마다 딱 한 번만 돌리세요.
`);
