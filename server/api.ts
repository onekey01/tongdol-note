import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCHEMA_VERSION } from "./schema";
import { 버전 } from "./version";
import { 주소한줄 } from "./util";
import { db, needsSetup } from "./db";
import { 기기등록시작, 기기끄기, 등록어디까지 } from "./기기등록";
import { 연간쓴돈 } from "./한도";
import {
  currentUser, createSession, destroySession, hashPassword,
  verifyPassword, readCookie, sessionCookie, CLEAR_COOKIE,
} from "./auth";
import {
  json, bad, today, korDate, addDays, daysUntil, calcAge, parseSlots, slotText, 은는,
} from "./util";
import { receiptHtml } from "./receipt";
import { 사진뿌리 } from "./보고받기";
import {
  근무시간정보, 자동시작정하기, 종료예약, 종료예약취소,
} from "./근무시간";
import { 바뀜들, 바뀜지우기, 바뀜모두지우기, 기기끊기, 들어온기록 } from "./계정로그인";
import { 상태 as 사무실상태, 닫기 as 사무실닫기, 열시간들, 사무실주소 } from "./사무실열기";
import { 방문표여럿, 이용중인분들, 집표 } from "./방문표";
import { 방문표화면 } from "./방문표인쇄";
import {
  build as 영수증만들기, gather as 영수증모으기, 파일이름 as 영수증파일이름,
} from "./영수증";
import {
  build as 비용총괄만들기, 모으기 as 비용총괄모으기, 파일이름 as 비용총괄파일이름,
} from "./비용총괄";
import {
  build as 계약서만들기, 모으기 as 계약서모으기, 파일이름 as 계약서파일이름,
} from "./계약서2";
import { preview, apply as applyReferrals, fix as fixReferral } from "./inbox";
import { 관리자넘기기, 관리자들 } from "./staff";
import { 얼마나기다려야, 틀렸다, 맞았다, 기다리란말 } from "./문지기";
import { WrongPassword } from "./office-crypt";
import {
  listStaff, getStaff, createStaff, updateStaff, resetPassword, resign, restore,
  startLeave, endLeave,
  ROLES, ROLE_KO, parseRoles,
} from "./staff";
import {
  listStickies, addSticky, updateSticky, setDone, removeSticky, placeSticky,
  stickyCounts, 대상자보드요약, COLORS, 자리규칙, 보관일수,
} from "./sticky";
import { can, permsOf, visibleRecipientIds } from "./perm";
import {
  listAssign, assignDetail, saveAssign, removeAssign, workerOptions, workerDayLoad,
  closeAssignments, DONE_STATUS, 서비스없는대상자수,
} from "./assign";
import { home, extend } from "./home";
import { month as recordMonth, setCell, fillMonth, REASONS, 공휴일캐시버리기,
         현장적기 } from "./record";
import { 갈래들, 갈래설명, 기본갈래 } from "./미제공";
import { 비대면다시셈, 비대면연속, 비대면한도 } from "./대면배달";
import { 지금목록, 목록정하기, 목록이력, 편람항목 } from "./확인사항";
import { USB살펴보기, 견주기 as USB견주기, 알림거리 as USB알림거리 } from "./USB동기화";
import { 계획재기 } from "./계획재기";
import { 첫설정읽기, 첫설정마치기 } from "./첫설정";
import { 해통계, 생애한도현황 } from "./stats";
import {
  백업정보, 백업하기, 자리정하기, 주기정하기,
  들여다보기, 지금상태, 되돌리기예약, 예약취소, 폴더보기,
} from "./backup";
import {
  month as billMonth, issue, issueAll, pay, unpay, cancel, one as billOne,
} from "./billing";
import {
  listFor, gather, build as buildBook, buildAll, saveNote, 상태값,
} from "./recordbook";
import { 만들기 as 기록지만들기 } from "./제공기록지";

/**
 * ── 서류의 「담당자」와 그 연락처 ────────────────────────────
 *
 * **담당자는 관리자입니다** (2026-09-04 무무 님 지시). 어르신과 군이
 * 전화할 자리라, 제공인력이 뽑았다고 그 사람 이름이 들어가면 안 됩니다.
 *
 *   이름   지금 로그인한 사람이 관리자면 그 사람, 아니면 **관리자 계정**
 *   연락처 그 사람의 전화 → 없으면 **기관 전화**
 *
 * 관리자 계정에 전화를 안 적어 두는 일이 흔합니다(실제로 비어 있었습니다).
 * 그때 칸을 비워 두면 **전화할 곳이 없는 종이**가 나갑니다.
 */
function 서류담당자(me: { id: number; name: string; role?: string } | null):
  { 이름: string; 연락처: string } {
  /*
   * ★ **관리자를 세는 법은 한 가지뿐입니다** (`staff.관리자들`).
   *
   *   여기 있던 `roles LIKE '%admin%'` 가 `parseRoles` 와 서로 다른
   *   답을 냈습니다. 그렇게 두 갈래가 생기면 「관리자가 한 명은 있어야
   *   합니다」 같은 규칙이 조용히 뚫립니다 — 2026-09-08 에 실제로
   *   뚫려 있는 것을 찾았습니다.
   */
  const 첫관리자 = 관리자들()[0];
  const 관리자 = 첫관리자
    ? db.query<any, [number]>("SELECT id, name, phone FROM app_user WHERE id = ?")
        .get(첫관리자.id)
    : null;

  const 나 = me
    ? db.query<any, [number]>(
        "SELECT id, name, phone, role, roles FROM app_user WHERE id = ?").get(me.id)
    : null;
  const 내가관리자 = !!나 &&
    (나.role === "admin" || String(나.roles ?? "").includes("admin"));

  const 쓸사람 = 내가관리자 ? 나 : (관리자 ?? 나);
  const 기관 = db.query<any, []>("SELECT phone FROM organization WHERE id = 1").get();

  return {
    이름: String(쓸사람?.name ?? me?.name ?? ""),
    연락처: String(쓸사람?.phone ?? "") || String(기관?.phone ?? ""),
  };
}

const SUSPEND_DAYS = 90; // 지침: 3개월 이상이면 종결처리
export const STATUSES = ["이용", "중단", "종결", "취소", "직권중단"] as const;

/**
 * 계약서 5-2조:
 * "식사지원은 대면배달 원칙을 준수해야 합니다.
 *  3회 연속 대면 수령하지 않은 경우 식사지원을 포함한 통합돌봄 서비스가 중지됩니다."
 *
 * 누적이 아니라 '연속'입니다. 한 번이라도 정상 수령하면 0으로 돌아갑니다.
 * 2회째에 기관이 알아야 손을 쓸 수 있으므로 그때부터 경고를 띄웁니다.
 */


/** 대상자 한 줄을 화면이 쓰기 좋은 모양으로 바꿉니다. */
function shapeRecipient(row: any) {
  const p = JSON.parse(row.payload || "{}");
  /*
   * 도로명과 상세(동·호수)를 **읽을 때 합쳐서** 내보냅니다.
   * 계약서·기록지·검색은 예전처럼 `address` 하나만 보므로
   * **그쪽 코드를 한 줄도 안 고쳐도** 동·호수가 같이 나갑니다.
   * 칸을 나눠 놓고 출력하는 자리마다 합치게 하면 언젠가 한 곳을 빠뜨립니다.
   */
  const 주소전체 = 주소한줄(p);
  const streak = row.no_show_streak ?? 0;
  // 연속과 **누적**을 둘 다 내보냅니다. 어느 쪽으로 **판단**하는지는
  // 설정값(f2f_mode)이 정합니다 — 군 답은 「연속」입니다(2026-09-08).
  let 비대면: any = null;
  try { 비대면 = 비대면연속(row.id); } catch { /* 옛 자료함이면 건너뜁니다 */ }
  return {
    id: row.id,
    name: p.name ?? "",
    birth: p.birth ?? "",
    age: calcAge(p.birth),
    gender: p.gender ?? "",
    phone: p.phone ?? "",
    phoneHome: p.phoneHome ?? "",
    address: 주소전체,
    /* 고치기 화면은 두 칸으로 나눠 받습니다. 합쳐진 것을 도로 가를 수는 없습니다. */
    addressRoad: p.address ?? "",
    addressDetail: p.addressDetail ?? "",
    dong: row.dong ?? "",
    lat: p.lat ?? null,
    lng: p.lng ?? null,

    // 계약서에 두 명까지 적게 되어 있습니다. 한 명만 있어도 됩니다.
    guardians: Array.isArray(p.guardians) ? p.guardians : [],

    // 제공인력이 방문 '전에' 알아야 하는 것들.
    // 반려동물은 안전 문제이고, CCTV 는 제공인력 초상권 문제입니다.
    // 둘 다 계약서에 이용자가 알리기로 되어 있는 항목입니다(6·7조).
    cctv: p.cctv ?? "",
    pet: p.pet ?? "",
    caution: p.caution ?? "",

    // 계약서 서명을 본인이 직접 할 수 있는지. 못 하면 대리인 칸이 출력됩니다.
    selfSign: p.selfSign !== false,

    noShowStreak: streak,
    noShowWarn: !!비대면?.경고,
    noShowLimit: 비대면?.한계 ?? 3,
    noShowReached: !!비대면?.닿음,
    lastNoShowOn: row.last_no_show_on ?? null,
    // 어느 쪽으로 판단하나 (v33 설정). 세는 것은 아래 둘 다 그대로 갑니다.
    비대면방식: 비대면?.방식 ?? "연속",
    비대면볼값: 비대면?.볼값 ?? 0,
    비대면누적: 비대면?.누적 ?? 0,
    비대면해: 비대면?.해 ?? null,
    status: row.status,
    statusSince: row.status_since,
    statusReason: row.status_reason,
    suspendDeadline: row.suspend_deadline,
    suspendDaysLeft: daysUntil(row.suspend_deadline),
    copayTierId: row.copay_tier_id,
    copayLabel: row.copay_label ?? null,
    noShowCount: row.no_show_count,
    memo: row.memo ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 대리인·비상연락처. 계약서에 두 칸이 있고, 문제 생겼을 때의 예비 연락처입니다. */
function cleanGuardians(list: any): { relation: string; name: string; phone: string }[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((g) => ({
      relation: String(g?.relation ?? "").trim(),
      name: String(g?.name ?? "").trim(),
      phone: String(g?.phone ?? "").trim(),
    }))
    .filter((g) => g.name || g.phone)   // 한 명만 있어도 저장됩니다
    .slice(0, 2);
}

function buildPayload(b: any) {
  return JSON.stringify({
    name: (b.name ?? "").trim(),
    birth: (b.birth ?? "").trim(),
    gender: b.gender ?? "",
    phone: (b.phone ?? "").trim(),
    phoneHome: (b.phoneHome ?? "").trim(),
    address: (b.address ?? "").trim(),
    addressDetail: (b.addressDetail ?? "").trim(),
    lat: b.lat ?? null,
    lng: b.lng ?? null,
    guardians: cleanGuardians(b.guardians),
    cctv: (b.cctv ?? "").trim(),
    pet: (b.pet ?? "").trim(),
    caution: (b.caution ?? "").trim(),
    selfSign: b.selfSign !== false,
  });
}

/** 검색용 문자열. 나중에 암호화하면 이 칸이 blind index 로 바뀝니다. */
function buildSearchText(b: any) {
  const g = cleanGuardians(b.guardians).flatMap((x) => [x.name, x.phone]);
  // 보호자 이름·번호로도 찾을 수 있어야 합니다.
  // 기관에 전화가 오면 "아들 김○○인데요" 로 시작하는 경우가 많습니다.
  return [b.name, b.phone, b.phoneHome, b.dong, b.address, b.addressDetail, b.birth, ...g]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * 파일 내려주기.
 *
 * 한글 파일 이름이 그대로 저장되도록 `filename*` (RFC 5987) 을 씁니다.
 * 옛 브라우저용 `filename=` 도 함께 적어 둡니다.
 */
function download(name: string, data: Buffer, type: string): Response {
  // 한글 이름을 못 읽는 옛 브라우저를 위한 대비책. 한글은 빼고 뼈대만 남깁니다.
  const ascii = name.replace(/[^\x20-\x7e]/g, "").replace(/[",;\\]/g, "").trim()
    || "download.hwpx";
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": type,
      "content-disposition":
        `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "content-length": String(data.length),
    },
  });
}

export async function handleApi(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;
  if (!path.startsWith("/api/")) return null;

  const method = req.method;
  const me = currentUser(req);

  /*
   * ── 우편함을 지금 맞춥니다 ─────────────────────────────────
   *
   * 「오늘 갈 곳」이 달라질 만한 일을 한 뒤에 부릅니다.
   * 올리기만 하는 것이 아니라 **없어져야 할 것도 치웁니다**
   * (할일보내기.오늘갈곳보내기 를 보세요).
   *
   * 왜 여기저기 흩어 두나 — 배정을 고치는 길, 의뢰를 중단하는 길,
   * 대상자 상태를 바꾸는 길이 다 다릅니다. 한 곳에서 잡을 수가 없어
   * **바뀌는 자리마다** 붙입니다. 빠뜨리면 멈춘 집에 찾아가게 됩니다.
   *
   * 기다리지 않습니다 — 인터넷이 느려도 저장 화면은 바로 넘어가야
   * 합니다. 실패해도 10분 뒤 차례에 다시 맞춰집니다.
   */
  const 우편함맞추기 = () => {
    import("./할일보내기")
      .then((m) => m.오늘갈곳보내기())
      .then((r) => {
        if (r.올린수) console.log(`우편함: ${r.올린수}곳을 올렸습니다`);
        if (r.치운수) console.log(`우편함: 더는 안 가는 ${r.치운수}곳을 치웠습니다`);
      })
      .catch((e) => console.error("우편함: 맞추기 실패 —", (e as Error).message));
  };

  /*
   * ── 지금 바로 받아 옵니다 ──────────────────────────────────
   *
   * 저절로 20초마다 받아 오지만, **사람이 기다리고 있는 순간**이
   * 있습니다 — 제공인력이 전화로 「방금 보냈어요」라고 할 때입니다.
   * 그때 20초도 길게 느껴집니다. 눌러서 당길 자리를 둡니다.
   *
   * 여기서는 **기다립니다.** 눌렀으면 결과를 봐야 하니까요.
   */
  const 지금받기 = async () => {
    const m = await import("./보고받기");
    return await m.보고받기();
  };

  // ── 로그인 없이 되는 것들 ────────────────────────────────
  if (path === "/api/bootstrap" && method === "GET") {
    const setup = needsSetup();
    /*
     * ── ★ 로그인 전에는 **기관 이름 하나만** (2026-09-08 점검) ★ ──
     *
     * 여기는 로그인 화면도 부르는 자리라 **누구나** 부를 수 있습니다.
     * 그런데 `SELECT *` 로 기관 표를 통째로 내주고 있었습니다 —
     * 대표자 성명 · 대표 전화 · **사업자등록번호 · 계좌번호**까지.
     *
     * 로그인 화면이 실제로 쓰는 것은 **기관 이름 한 줄**뿐입니다
     * (「공룡복지관」이라고 위에 띄우는 데 씁니다). 나머지는 설정
     * 화면이 `/api/settings` 로 가져갑니다 — 그쪽은 관리자만 열립니다.
     *
     * DNS 되박기까지 겹치면 이 한 줄이 **남의 서버로 새는 길**이
     * 됩니다. 문지기로 그 길도 막았지만, 애초에 안 내주는 것이 낫습니다.
     */
    const 통째로 = setup
      ? null
      : (db.query("SELECT * FROM organization WHERE id = 1").get() as any);
    const org = !통째로 ? null : (me ? 통째로 : { id: 통째로.id, name: 통째로.name });
    return json({
      needsSetup: setup,
      user: me ? { ...me, roles: parseRoles(me.roles) } : null,
      // 화면이 차림표를 감출 때 쓰는 표입니다.
      // 서버가 막는 것과 **같은 표**에서 나옵니다 — 화면만 감추면 막은 게 아닙니다.
      perms: me ? permsOf(me) : null,
      org,
      today: today(),
      /*
       * ── ★ 필수 설정을 마쳤나 (v35 · `할일.md` 7-하) ★ ──────────
       *
       * (2026-09-01 무무 안 — 「기관 정보 → 관리자 등록 → **필수 설정**
       *  → 홈」. 단가·한도가 손도 안 댄 채로 쓰이는 것을 **순서로** 막습니다.)
       *
       * ★ **관리자에게만** 참으로 보냅니다. 사무직원이 켰을 때 마법사가
       *   뜨면 고칠 권한도 없는 화면 앞에서 갇힙니다.
       */
      needsRules: !setup && !!me && parseRoles(me.roles).includes("admin")
        && !(통째로?.setup_done_at),
      /*
       * 버전 번호는 **로그인 전에도** 필요합니다.
       * 「지금 몇 버전 쓰세요?」가 원격 지원의 첫 물음인데,
       * 설정 화면은 권한이 있어야 열립니다. 여기서 함께 보냅니다.
       */
      앱: { 버전: 버전, 구조: SCHEMA_VERSION },
    });
  }

  if (path === "/api/setup" && method === "POST") {
    if (!needsSetup()) return bad("이미 개설된 기관입니다.");
    const b = await req.json().catch(() => ({} as any));

    if (!b.orgName?.trim()) return bad("기관명을 입력해 주세요.");
    if (!b.loginId?.trim()) return bad("관리자 아이디를 입력해 주세요.");
    if (!b.password || String(b.password).length < 4)
      return bad("비밀번호는 4자 이상으로 정해 주세요.");

    /*
     * ── 어느 규칙으로 시작하나 (2026-09-01 바로잡음) ───────────
     *
     * 처음에는 **「복지부 지침 표준」**으로 시작하게 해 두었습니다.
     * 그런데 그 규칙은 **기준선**이라 잠겨 있고, 편람 값(연 150만원 ·
     * 월 12시간 · 생애 100만원)이 **하나도 안 들어 있습니다** — 0 은
     * 「한도를 안 봅니다」라는 뜻입니다.
     *
     * 그래서 기관이 프로그램을 깔면 **한도 경고가 전부 꺼진 채로 시작**했고,
     * 아무도 그 사실을 몰랐습니다. 실제로 파일럿 기관에서 그렇게 되어 있었습니다.
     *
     * 이제 **「우리 지자체 규칙」으로 시작합니다.** 편람 값이 들어 있고,
     * 기관이 자기 지자체 이름으로 바꿔 쓰면 됩니다.
     * 기준선은 **견주려고** 그대로 남아 있습니다 — 설정에서 언제든 고를 수 있습니다.
     */
    const profile =
      db.query<{ id: number }, []>(
        "SELECT id FROM region_profile WHERE is_builtin = 0 ORDER BY id LIMIT 1").get()
      ?? db.query<{ id: number }, []>(
        "SELECT id FROM region_profile WHERE is_builtin = 1").get();

    const now = new Date().toISOString();
    db.run(
      `INSERT INTO organization
         (id, name, biz_no, phone, address, ceo_name,
          bank_name, bank_account, bank_holder, profile_id, created_at, address_detail)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.orgName.trim(), b.bizNo ?? "", b.phone ?? "", b.address ?? "",
        b.ceoName ?? "", b.bankName ?? "", b.bankAccount ?? "", b.bankHolder ?? "",
        profile?.id ?? null, now, b.addressDetail ?? "",
      ]
    );

    const hash = await hashPassword(String(b.password));
    const info = db.run(
      `INSERT INTO app_user (login_id, pw_hash, name, role, roles, status, created_at)
       VALUES (?, ?, ?, 'admin', '["admin"]', 'active', ?)`,
      [b.loginId.trim(), hash, b.adminName?.trim() || "관리자", now]
    );

    const token = createSession(Number(info.lastInsertRowid));
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(token) });
  }

  /*
   * ── 최초 설정 마법사 ────────────────────────────────────────
   *
   * **관리자만.** 기관이 개설된 뒤에만 됩니다.
   * 읽기는 지금 쓰고 있는 값을 그대로 내주고, 저장은 한 번에 씁니다.
   */
  if (path === "/api/setup/rules" && (method === "GET" || method === "POST")) {
    if (needsSetup()) return bad("기관을 먼저 개설해 주세요.", 400);
    if (!me) return bad("로그인이 필요합니다.", 401);
    if (!parseRoles(me.roles).includes("admin"))
      return bad("관리자만 할 수 있습니다.", 403);
    try {
      if (method === "GET") return json(첫설정읽기());
      const b = await req.json().catch(() => ({} as any));
      return json(첫설정마치기(b, me.name));
    } catch (e: any) { return bad(e.message); }
  }

  if (path === "/api/login" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    const 아이디 = String(b.loginId ?? "").trim();

    /*
     * ── ★ 자꾸 틀리면 늦춥니다 (2026-09-08 보안 점검) ★ ────────
     *
     * 전에는 **몇 번을 틀리든 그대로 받았습니다.** 비밀번호를 argon2 로
     * 저장하고 있어 한 번 맞혀 보는 데 시간이 걸리기는 하지만, 그것만
     * 믿을 일이 아닙니다 — 사무실 열기가 켜진 동안에는 옆 컴퓨터에서,
     * 관리자가 나쁜 쪽을 열면 그 쪽에서 두드릴 수 있습니다.
     *
     * **잠그지는 않습니다.** 영영 못 들어가게 하면 남이 일부러 틀려서
     * 기관을 잠글 수 있습니다. 다섯 번까지는 그냥 받고, 그 뒤로 점점
     * 느리게 만듭니다. 사람은 못 느끼고 기계만 못 견딥니다.
     */
    const 누구 = `로그인:${아이디.slice(0, 40).toLowerCase()}`;
    const 기다릴것 = 얼마나기다려야(누구);
    if (기다릴것 > 0)
      return bad(`여러 번 틀렸습니다. ${기다리란말(기다릴것)}`, 429);

    const row = db
      .query<{ id: number; pw_hash: string; status: string }, [string]>(
        "SELECT id, pw_hash, status FROM app_user WHERE login_id = ?"
      )
      .get(아이디);

    /*
     * ★ 없는 아이디도 **똑같이 셉니다.** 「이 아이디는 있다/없다」가
     *   답 속도나 말투로 새면, 남이 아이디부터 골라낼 수 있습니다.
     */
    if (!row) { 틀렸다(누구); return bad("아이디 또는 비밀번호가 맞지 않습니다.", 401); }
    if (row.status !== "active") return bad("사용할 수 없는 계정입니다.", 403);
    if (!(await verifyPassword(String(b.password ?? ""), row.pw_hash))) {
      틀렸다(누구);
      return bad("아이디 또는 비밀번호가 맞지 않습니다.", 401);
    }

    맞았다(누구);
    const token = createSession(row.id);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(token) });
  }

  if (path === "/api/logout" && method === "POST") {
    const token = readCookie(req, "ck_session");
    if (token) destroySession(token);
    return json({ ok: true }, 200, { "set-cookie": CLEAR_COOKIE });
  }

  // ── 여기부터는 로그인이 필요합니다 ────────────────────────
  if (!me) return bad("로그인이 필요합니다.", 401);

  // ── 접근 범위 ────────────────────────────────────────────
  // 아이디·역할을 화면에서 고칠 수 있게 만든 이상, 손이 닿는 범위를
  // 좁혀 두어야 합니다. 자세한 표는 perm.ts 에 있습니다.
  if (path.startsWith("/api/settings") && !can(me, "settings.view"))
    return bad("설정은 관리자와 사무직원만 볼 수 있습니다.", 403);
  if (path.startsWith("/api/settings") && method !== "GET" && !can(me, "settings.edit"))
    return bad("설정을 바꾸는 것은 관리자만 할 수 있습니다.", 403);
  if (path.startsWith("/api/referrals") && !can(me, "referral.manage"))
    return bad("의뢰 접수는 관리자와 사무직원만 할 수 있습니다.", 403);
  // 손으로 넣은 서비스 지우기 — 「/api/referrals」(엑셀)와 **다른 길**입니다.
  if (path.startsWith("/api/referral/") && !can(me, "recipient.edit"))
    return bad("받는 서비스를 고치는 것은 관리자와 사무직원만 할 수 있습니다.", 403);
  if (path.startsWith("/api/assign") && method !== "GET" && !can(me, "recipient.edit"))
    return bad("배정은 관리자와 사무직원만 할 수 있습니다.", 403);
  if (path.startsWith("/api/recipients") && method === "DELETE" && !can(me, "recipient.delete"))
    return bad("대상자 지우기는 관리자만 할 수 있습니다.", 403);
  if (path.startsWith("/api/recipients") && method !== "GET" && !can(me, "recipient.edit"))
    return bad("대상자 정보를 고치는 것은 관리자와 사무직원만 할 수 있습니다.", 403);

  // null 이면 제한 없음. 제공인력은 **배정된 대상자만** 보입니다.
  const visibleIds = visibleRecipientIds(me);

  // 설정
  if (path === "/api/settings" && method === "GET") {
    const org = db.query("SELECT * FROM organization WHERE id = 1").get() as any;
    const profile = db
      .query("SELECT * FROM region_profile WHERE id = ?")
      .get(org?.profile_id) as any;
    const services = db
      .query("SELECT * FROM service WHERE profile_id = ? ORDER BY sort_order")
      .all(profile?.id);
    const tiers = db
      .query("SELECT * FROM copay_tier WHERE profile_id = ? ORDER BY sort_order")
      .all(profile?.id);
    const profiles = db
      .query("SELECT id, name, billing_mode, rounding_unit, rounding_mode, is_builtin FROM region_profile ORDER BY id")
      .all();
    // 배상책임보험은 기관이 인원수를 정해 한 번에 가입합니다.
    // 가입 인원보다 실제 제공인력이 많으면 알려줘야 합니다 —
    // 빠진 사람이 사고를 내면 기관이 그대로 떠안습니다.
    const workers = db.query<{ c: number }, []>(
      `SELECT COUNT(*) AS c FROM worker w JOIN app_user u ON u.id = w.user_id
        WHERE u.status = 'active' AND u.roles LIKE '%worker%'`
    ).get();
    const left = org?.liability_to ? daysUntil(org.liability_to) : null;

    /*
     * 공휴일 — 기관이 적어 넣은 것 **전부.**
     *
     * 처음에는 「올해 앞뒤 몇 해만」 보냈습니다. 화면이 가벼우라고 그랬는데,
     * **넣었는데 화면에 안 보이는** 일이 생겼습니다. 저장은 됐고 할증에도
     * 반영되는데 목록에만 없으니, 쓰는 사람은 안 들어간 줄 알고 또 넣습니다.
     * **자료가 숨는 화면은 만들면 안 됩니다.**
     *
     * 공휴일은 한 해에 열댓 줄입니다. 서른 해를 쌓아도 오백 줄이 안 되니
     * 가벼움을 걱정할 자리가 아니었습니다.
     */
    const holidays = db.query<any, []>(
      "SELECT on_date, name FROM holiday ORDER BY on_date"
    ).all();

    return json({
      org, profile, profiles, services, tiers, holidays,
      /*
       * 버전 번호 — **전화로 확인할 수 있어야 합니다.**
       * 「지금 몇 버전 쓰세요?」가 원격 지원의 첫 물음입니다.
       */
      앱: { 버전: 버전, 구조: SCHEMA_VERSION },
      liability: {
        workerCount: workers?.c ?? 0,
        headcount: org?.liability_headcount ?? null,
        short: org?.liability_headcount != null && (workers?.c ?? 0) > org.liability_headcount,
        daysLeft: left,
        expiring: left !== null && left <= 30,
      },
    });
  }

  /*
   * 공휴일 넣기 · 빼기.
   *
   * 프로그램이 알고 있지 않습니다 — **기관이 관공서 달력을 보고 넣습니다.**
   * 설날·추석은 음력이라 해마다 옮겨 다니고 대체공휴일도 그해 규정을 탑니다.
   * 박아 두면 틀리고, 틀리면 휴일 할증이 어긋납니다.
   */
  /*
   * ── 백업 ─────────────────────────────────────────────────
   *
   * 이 프로그램의 자료는 **파일 하나**에 다 들어 있습니다.
   * 그 파일이 날아가면 기관이 통째로 사라집니다.
   * 그래서 백업을 화면에 꺼내 놓습니다 — 어디에 · 언제 · 몇 부.
   *
   * 같은 디스크에만 두면 **그 디스크가 죽을 때 원본과 함께 죽으므로**
   * 다른 곳(USB·외장하드·공유 폴더)을 정할 수 있게 합니다.
   */
  /*
   * ── 근무시간 — PC 를 켜면 같이 켜기 / 정한 시각에 끄기 ────
   *
   * 관리자가 반차일 때도 사무실 PC 가 돌고 있어야 폰이 열쇠를 받고
   * 보고가 내려옵니다. 자세한 까닭은 `server/근무시간.ts` 에.
   */
  if (path === "/api/settings/hours" && method === "GET") {
    return json(근무시간정보());
  }
  if (path === "/api/settings/hours" && method === "PATCH") {
    if (!can(me, "settings.edit")) return bad("설정은 관리자만 바꿉니다.", 403);
    const b = await req.json().catch(() => ({} as any));
    try {
      await 자동시작정하기(!!b.autoStart);
      return json({ ok: true, 정보: 근무시간정보() });
    } catch (e: any) { return bad(e.message); }
  }
  /*
   * 컴퓨터 종료 **예약** — 그날그날 거는 일회성입니다.
   * 반차라 일찍 나가는 날 「6시간 뒤에 꺼 줘」 하고 거는 자리입니다.
   */
  if (path === "/api/settings/hours/shutdown" && method === "POST") {
    if (!can(me, "settings.edit")) return bad("설정은 관리자만 바꿉니다.", 403);
    const b = await req.json().catch(() => ({} as any));
    try {
      종료예약(b.hours);
      return json({ ok: true, 정보: 근무시간정보() });
    } catch (e: any) { return bad(e.message); }
  }
  if (path === "/api/settings/hours/cancel" && method === "POST") {
    종료예약취소();
    return json({ ok: true, 정보: 근무시간정보() });
  }

  /*
   * ── 사무실 안 다른 컴퓨터에서 들어오게 잠깐 열기 ──────────
   *
   * 사무보조원이 자기 자리에서 대상자를 등록하고 서식을 뽑습니다.
   * **몇 시간짜리**로 열고, 여섯 자리 번호를 묻고, 그다음 본인
   * 아이디·비밀번호로 들어갑니다. 자세한 까닭은 `server/사무실열기.ts` 에.
   */
  if (path === "/api/settings/lan" && method === "GET") {
    return json({ ...사무실상태(), 시간들: 열시간들, 주소있나: !!사무실주소() });
  }
  if (path === "/api/settings/lan" && method === "POST") {
    if (!can(me, "settings.edit")) return bad("여는 것은 관리자만 합니다.", 403);
    const b = await req.json().catch(() => ({} as any));
    try {
      const { 사무실열기실행 } = await import("./index");
      return json({ ok: true, ...사무실열기실행(Number(b.hours)) });
    } catch (e: any) { return bad(e.message); }
  }
  if (path === "/api/settings/lan" && method === "DELETE") {
    if (!can(me, "settings.edit")) return bad("닫는 것은 관리자만 합니다.", 403);
    사무실닫기();
    return json({ ok: true, ...사무실상태() });
  }

  /*
   * ── 업데이트 안내 ────────────────────────────────────────
   *
   * 프로그램을 갈아 끼우는 일이라 **관리자만** 다룹니다. 사무직원
   * 화면에 띠가 뜨면 관리자가 모르는 사이에 버전이 바뀔 수 있고, 그러면
   * 「어제와 오늘 청구액이 왜 다르냐」에 답할 사람이 없어집니다.
   *
   * 읽는 것도 막습니다 — 형편 안에 우리가 버전을 올려 두는 자리 주소가
   * 들어 있습니다.
   */
  if (path.startsWith("/api/update")) {
    if (!can(me, "settings.edit")) return bad("업데이트는 관리자만 다룹니다.", 403);
    const U = await import("./업데이트");

    if (path === "/api/update" && method === "GET") {
      const 형편 = U.형편보기();
      const 접힘 = 형편.무엇 === "준비됨" ? U.접어뒀나(형편.정보.버전) : false;
      /*
       * ── 화면에 안 보내는 것 ─────────────────────────────
       *
       * 버전을 올려 두는 자리 주소와 「서명 열쇠가 들어 있나」는 **안
       * 보냅니다.** 처음에는 둘 다 설정 화면에 그렸는데, 기관 관리자가
       * 그것을 알아서 **할 수 있는 일이 하나도 없습니다.**
       * 주소는 바꿀 일이 없고(바꾸면 갱신만 끊깁니다), 열쇠가 빠진 것은
       * 만든 쪽 실수라 기관이 고칠 수 없습니다.
       * (2026-09-08 무무 — 「이 프로그램 사용자가 알면 어떤 도움이
       *  되길래 넣은거야???」)
       *
       * 열쇠가 빠진 것은 **「통돌Note 만들기.bat」이 내보내기 전에**
       * 잡습니다. 그게 그 실수를 고칠 수 있는 유일한 자리입니다.
       */
      return json({
        형편, 접힘,
        켜짐: U.켜져있나(),
        지난목록: U.지난목록(),
        지금버전: 버전,
      });
    }
    if (path === "/api/update/check" && method === "POST") {
      return json({ 형편: await U.확인하기({ 억지로: true }) });
    }
    if (path === "/api/update/later" && method === "POST") {
      const b = await req.json().catch(() => ({} as any));
      U.나중에(String(b?.버전 ?? ""));
      return json({ ok: true });
    }
    if (path === "/api/update/apply" && method === "POST") {
      return json(U.갈아끼우기());
    }
    if (path === "/api/update/settings" && method === "PATCH") {
      const b = await req.json().catch(() => ({} as any));
      if (typeof b?.켜짐 === "boolean") U.켜고끄기(b.켜짐);
      return json({ ok: true, 켜짐: U.켜져있나() });
    }

  }

  /*
   * ── 새 휴대폰으로 들어온 사람 ────────────────────────────
   *
   * 제공인력이 폰을 바꾸거나 다른 브라우저로 들어오면 **기다리지 않고
   * 바로 들어갑니다.** 현장에서 사무실 연락을 기다리며 서 있으면 안
   * 되기 때문입니다. 대신 여기에 남아 홈에 뜹니다.
   * (2026-09-05 무무 — 「바로 들어가고 사무실은 나중에 본다」)
   *
   * 모르는 새 남이 들어왔다면 「이 기기 끊기」를 누르면 그 자리에서
   * 끊깁니다. 본인이면 다시 로그인하면 그만입니다.
   */
  /*
   * ★ 권한을 봅니다 (2026-09-05 에 막은 구멍) ★
   *
   *   처음에는 로그인만 했으면 누구나 읽고 지울 수 있었습니다.
   *   그런데 이 알림은 **남이 들어왔는지를 아는 유일한 길**입니다.
   *   남의 계정으로 들어온 사람이 제일 먼저 할 일이 바로
   *   「내 흔적 지우기」인데, 그 두 가지가 열려 있었습니다.
   *   읽는 것도 막습니다 — 목록에 종사자 이름과 번호가 들어 있습니다.
   */
  if (path === "/api/devices/changes" && method === "GET") {
    if (!can(me, "settings.edit")) return bad("관리자만 볼 수 있습니다.", 403);
    return json({ 목록: 바뀜들() });
  }
  if (path === "/api/devices/changes" && method === "DELETE") {
    if (!can(me, "settings.edit")) return bad("관리자만 지울 수 있습니다.", 403);
    const b = await req.json().catch(() => ({} as any));
    if (b.때) 바뀜지우기(String(b.때)); else 바뀜모두지우기();
    return json({ ok: true, 목록: 바뀜들() });
  }
  /*
   * 「들어온 기록」 — 홈에 안 띄운 것까지 **전부** 남습니다.
   * 브라우저만 바꿔 들어온 것은 알림을 안 띄우기로 했으므로
   * (거짓 알림이 잦으면 알림 자체가 죽습니다), 나중에 이상하다 싶을 때
   * 볼 자리가 하나는 있어야 합니다. 설정 안쪽에 둡니다.
   */
  if (path === "/api/devices/log" && method === "GET") {
    if (!can(me, "settings.edit")) return bad("관리자만 볼 수 있습니다.", 403);
    return json({ 목록: 들어온기록() });
  }
  if (path === "/api/devices/cut" && method === "POST") {
    if (!can(me, "staff.editOther")) return bad("기기를 끊는 것은 관리자만 합니다.", 403);
    const b = await req.json().catch(() => ({} as any));
    if (!b.인력번호) return bad("어느 분의 기기인지가 없습니다.");
    try {
      const 끊은수 = await 기기끊기(String(b.인력번호));
      if (b.때) 바뀜지우기(String(b.때));
      return json({ ok: true, 끊은수, 목록: 바뀜들() });
    } catch (e: any) { return bad(e.message); }
  }

  if (path === "/api/settings/backup" && method === "GET") {
    return json(백업정보());
  }
  if (path === "/api/settings/backup" && method === "POST") {
    // 지금 백업 — 오늘 것이 있어도 다시 뜹니다.
    try { return json({ ok: true, ...백업하기(true), 정보: 백업정보() }); }
    catch (e: any) { return bad(e.message); }
  }
  if (path === "/api/settings/backup/schedule" && method === "PATCH") {
    const b = await req.json().catch(() => ({} as any));
    try {
      주기정하기(b.every, b.keep);
      return json({ ok: true, 정보: 백업정보() });
    } catch (e: any) { return bad(e.message); }
  }
  /*
   * 폴더 고르개 — **경로를 손으로 치지 않게.**
   * 브라우저는 고른 폴더의 전체 경로를 안 알려 줍니다(보안). 그런데 우리 서버는
   * 그 컴퓨터 안에서 돌고 있으니, 서버가 훑어 목록으로 내주면 됩니다.
   * **읽기만 합니다** — 여기서 만들거나 지우지 않습니다.
   */
  /*
   * ── 주소 찾기는 서버를 안 거칩니다 ───────────────────────
   * 포털에서 쓰던 그 검색창(카카오 우편번호 서비스)을 화면이 바로 띄웁니다.
   * 승인키가 없으니 서버가 대신 물어봐 줄 것도, 감춰 줄 것도 없습니다.
   * 예전에 있던 /api/address 와 승인키 칸은 그래서 없앴습니다.
   */

  if (path === "/api/settings/backup/browse" && method === "GET") {
    try {
      const p = url.searchParams.get("path") ?? "";
      return json(폴더보기(p || undefined));
    } catch (e: any) { return bad(e.message); }
  }

  if (path === "/api/settings/backup/dir" && method === "PATCH") {
    const b = await req.json().catch(() => ({} as any));
    try {
      const r = 자리정하기(String(b.dir ?? ""));
      // 정하자마자 한 번 떠 봅니다 — 「저장했습니다」 해 놓고 정작
      // 백업이 안 되는 상태로 몇 달이 지나면 안 됩니다.
      if (r.dir) 백업하기(true);
      return json({ ok: true, 정보: 백업정보() });
    } catch (e: any) { return bad(e.message); }
  }

  /*
   * ── 되돌리기 ───────────────────────────────────────────────
   *
   * 떠 두기만 하고 되돌릴 수 없으면 백업이 아닙니다.
   *
   * 세 걸음으로 나눕니다. **한 번에 바꿔치지 않습니다.**
   *  1) 들여다보기 — 그 파일에 무엇이 얼마나 들어 있는지 지금 것과 견줍니다.
   *  2) 예약      — 지금 것을 먼저 떠 두고, 바꿀 파일을 옆에 놓습니다.
   *  3) 다시 켜기 — 그때 비로소 바뀝니다 (server/db.ts).
   *
   * 견주는 걸음이 있는 이유: **자동 병합은 불가능**하기 때문입니다.
   * 주말에 USB 로 집에서 일하고 왔는데 사무실 것도 누가 건드렸다면,
   * 어느 쪽을 버릴지는 사람이 정해야 합니다. 숫자를 나란히 놓아 정하게 합니다.
   */
  if (path === "/api/settings/backup/inspect" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try {
      const 그것 = 들여다보기(String(b.path ?? ""));
      return json({ ok: true, 그것, 지금: 지금상태() });
    } catch (e: any) { return bad(e.message); }
  }
  if (path === "/api/settings/backup/restore" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try {
      const r = 되돌리기예약(String(b.path ?? ""));
      return json({ ...r, 정보: 백업정보() });
    } catch (e: any) { return bad(e.message); }
  }
  if (path === "/api/settings/backup/restore/cancel" && method === "POST") {
    예약취소();
    return json({ ok: true, 정보: 백업정보() });
  }

  /*
   * ── USB 로 오간 자료 맞추기 ─────────────────────────────────
   *
   * (2026-09-06 무무 — 「USB에 백업된 파일을 가지고 집에서 작업 시
   *  다음날 출근하여 백업USB를 기관PC에 꽂아 프로그램을 열면
   *  최신 데이터로 동기화 해줘야 해」)
   *
   * 되돌리기와 **같은 길을 씁니다** — 지금 것을 한 부 떠 두고, 다음에
   * 켤 때 바꿔 넣습니다. 다른 것은 **무엇이 사라지는지 미리 세어
   * 보여 준다**는 것뿐입니다. 자세한 것은 server/USB동기화.ts 에.
   */
  if (path === "/api/settings/backup/usb" && method === "GET") {
    try {
      const 찾음 = USB살펴보기();
      const 견 = 찾음.볼것있나 ? USB견주기(찾음.으뜸) : null;
      return json({ 찾음, 견 });
    } catch (e: any) { return bad(e.message); }
  }

  if (path === "/api/settings/backup/usb/compare" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try { return json({ ok: true, 견: USB견주기(String(b.path ?? "")) }); }
    catch (e: any) { return bad(e.message); }
  }

  if (path === "/api/settings/backup/usb/import" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try {
      const 경로 = String(b.path ?? "");
      const 견 = USB견주기(경로);
      /*
       * ★ **여기서 한 번 더 막습니다.** 화면이 이미 막고 있지만, 화면이
       *   본 것과 지금 파일이 다를 수 있습니다 — 그 사이에 USB 를 뽑았다
       *   꽂았거나, 다른 사람이 백업을 새로 떴을 수 있습니다.
       *   자료함을 통째로 바꾸는 일이라 막는 자리는 서버여야 합니다.
       */
      if (!견.가져올수있나) return bad(견.못하는까닭);
      /*
       * ★ 갈라졌으면 **사라질 건수를 눈으로 본 사람만** 지나갑니다.
       *   화면이 그 숫자를 같이 보내야 합니다. 안 보내면 막습니다 —
       *   「예」를 두 번 누르는 것과, 무엇이 사라지는지 알고 누르는 것은
       *   다른 일입니다.
       */
      if (견.판단 === "갈라짐" && Number(b.사라질건수) !== 견.이쪽에만)
        return bad(
          `이 PC 에만 있는 것이 ${견.이쪽에만}건입니다. ` +
          `가져오면 그만큼 사라집니다. 화면을 새로 고친 뒤 다시 눌러 주세요.`);

      const r = 되돌리기예약(경로);
      return json({ ...r, 견, 정보: 백업정보() });
    } catch (e: any) { return bad(e.message); }
  }

  if (path === "/api/settings/holiday" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    const on = String(b.on ?? "").trim();
    const name = String(b.name ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) return bad("날짜를 골라 주세요.");
    if (!name) return bad("무슨 날인지 적어 주세요. 예) 추석 · 대체공휴일");
    if (name.length > 40) return bad("이름은 40자까지입니다.");
    db.run(
      `INSERT INTO holiday (on_date, name, created_at) VALUES (?, ?, ?)
       ON CONFLICT(on_date) DO UPDATE SET name = excluded.name`,
      [on, name, new Date().toISOString()]
    );
    공휴일캐시버리기();
    return json({ ok: true, on, name });
  }
  if (path.startsWith("/api/settings/holiday/") && method === "DELETE") {
    const on = decodeURIComponent(path.slice("/api/settings/holiday/".length));
    db.run("DELETE FROM holiday WHERE on_date = ?", [on]);
    공휴일캐시버리기();
    return json({ ok: true });
  }

  if (path === "/api/settings/org" && method === "PATCH") {
    const b = await req.json().catch(() => ({} as any));
    db.run(
      `UPDATE organization SET
         name = ?, biz_no = ?, unique_no = ?, phone = ?,
         address = ?, address_detail = ?, ceo_name = ?,
         bank_name = ?, bank_account = ?, bank_holder = ?,
         liability_insurer = ?, liability_policy_no = ?,
         liability_from = ?, liability_to = ?, liability_headcount = ?
       WHERE id = 1`,
      [
        b.name ?? "", b.biz_no ?? "", b.unique_no ?? "", b.phone ?? "",
        b.address ?? "", b.address_detail ?? "", b.ceo_name ?? "", b.bank_name ?? "", b.bank_account ?? "", b.bank_holder ?? "",
        b.liability_insurer ?? "", b.liability_policy_no ?? "",
        b.liability_from ?? "", b.liability_to ?? "",
        b.liability_headcount ? Number(b.liability_headcount) : null,
      ]
    );
    return json({ ok: true });
  }

  /*
   * 계산 규칙 **하나하나 고치기.**
   *
   * 예전에는 규칙을 통째로 골라 쓰기만 했습니다. 그런데 지자체마다
   * 「후납인데 반올림은 100원 내림, 할증은 안 씀」처럼 **조합이 제각각**입니다.
   * 미리 만들어 둔 덩어리에서 고르게 하면 반드시 안 맞는 곳이 나옵니다.
   * 그래서 칸을 흩어 놓고 하나씩 정합니다.
   *
   * **「복지부 지침 표준」은 못 고칩니다.** 그건 기준선입니다 —
   * 우리 지자체가 지침과 무엇이 다른지 견주려면 기준이 안 움직여야 합니다.
   *
   * 돈 계산이 달라지는 일이므로 **바꾼 것은 하나하나 남깁니다.**
   */
  if (path === "/api/settings/profile/rules" && method === "PATCH") {
    const b = await req.json().catch(() => ({} as any));
    const id = Number(b.profileId);
    const p = db.query<any, [number]>("SELECT * FROM region_profile WHERE id = ?").get(id);
    if (!p) return bad("없는 규칙입니다.");
    if (p.is_builtin)
      return bad("「복지부 지침 표준」은 기준선이라 고칠 수 없습니다. 우리 지자체 규칙에서 고쳐 주세요.");

    const 숫자 = (v: unknown) => (v === "" || v == null ? null : Number(v));
    const 고칠것: [string, string, any, any][] = [];   // [칸, 보이는이름, 옛값, 새값]
    const 넣기 = (칸: string, 이름: string, 새값: any, 됨: boolean) => {
      if (새값 === undefined) return;
      if (!됨) throw new Error(`${이름} 값이 올바르지 않습니다.`);
      if (String(p[칸] ?? "") !== String(새값)) 고칠것.push([칸, 이름, p[칸], 새값]);
    };

    try {
      if (b.name !== undefined) {
        const nm = String(b.name).trim();
        넣기("name", "규칙 이름", nm, !!nm && nm.length <= 40);
      }
      if (b.billingMode !== undefined)
        넣기("billing_mode", "청구 방식", b.billingMode,
             b.billingMode === "prepaid" || b.billingMode === "postpaid");
      if (b.claimTiming !== undefined)
        넣기("claim_timing", "지자체 청구 시점", b.claimTiming,
             ["monthly", "anniversary", "on_end"].includes(b.claimTiming));
      if (b.copayTiming !== undefined)
        넣기("copay_timing", "본인부담금 청구 시점", b.copayTiming,
             ["monthly", "anniversary", "on_end"].includes(b.copayTiming));
      if (b.roundingUnit !== undefined)
        넣기("rounding_unit", "절삭 단위", 숫자(b.roundingUnit),
             [1, 10, 100, 1000].includes(Number(b.roundingUnit)));
      if (b.roundingMode !== undefined)
        넣기("rounding_mode", "절삭 방식", b.roundingMode,
             ["round", "ceil", "floor"].includes(b.roundingMode));
      if (b.holidayEnabled !== undefined)
        넣기("holiday_enabled", "휴일 할증", b.holidayEnabled ? 1 : 0, true);
      if (b.holidaySurcharge !== undefined) {
        const v = Number(b.holidaySurcharge);
        넣기("holiday_surcharge", "할증 배수", v, Number.isFinite(v) && v >= 1 && v <= 3);
      }
      /*
       * ── 한도 (7-마) ────────────────────────────────────────
       * 편람은 연간 150만 · 안전생활환경 생애 100만이라고 적어 두었지만,
       * **지역마다 다를 수 있어** 설정값으로 둡니다.
       * 0 을 넣으면 「한도를 안 봅니다」라는 뜻입니다.
       */
      if (b.annualCap !== undefined) {
        const v = Number(b.annualCap);
        넣기("annual_cap", "연간 지원한도", v,
             Number.isFinite(v) && v >= 0 && v <= 100_000_000);
      }
      if (b.housingCap !== undefined) {
        const v = Number(b.housingCap);
        넣기("housing_cap", "안전생활환경 생애한도", v,
             Number.isFinite(v) && v >= 0 && v <= 100_000_000);
      }
      /*
       * ── 연간 한도를 **무엇으로** 재나 (2026-09-07 무무) ──────
       *
       * 편람은 「1인 연간 지원한도 150만원」이라고만 적어 두었습니다.
       * 그 150만원이 **총 서비스 비용**인지, 본인부담금을 뺀
       * **군 부담액**인지가 안 적혀 있습니다. 이 답에 따라
       * 「넘었다」가 갈립니다 — 본인부담 20% 구간이면 두 셈이
       * 25% 차이가 납니다.
       *
       * 군에 물어보는 중이라(2026-09-07) **총 서비스 비용**이 기본이고,
       * 답이 오면 여기서 바꿉니다. 코드에 박으면 그때 프로그램을
       * 고치러 가야 합니다.
       */
      if (b.capBasis !== undefined) {
        const v = String(b.capBasis);
        넣기("cap_basis", "연간 한도 기준", v, v === "total" || v === "claim");
      }
      /*
       * ── 연속 비대면 배달 한도 (A-4 · 계약서 5-2조) ──────────
       * 편람과 계약서는 **3회**입니다. 지침이 개정될 수 있어 설정값으로 둡니다.
       * **0 은 「안 봅니다」.** 30보다 크게는 못 넣습니다 — 그쯤이면 오타입니다.
       */
      if (b.f2fLimit !== undefined) {
        const v = Number(b.f2fLimit);
        넣기("f2f_limit", "비대면 배달 한도", v,
             Number.isFinite(v) && Number.isInteger(v) && v >= 0 && v <= 30);
      }
      /*
       * ── 연속으로 세나, 누적으로 세나 (v33 · 2026-09-08 무무) ──
       * 해남 편람·계약서는 **「3회 연속」**이라 기본은 연속입니다.
       * 다른 군이 누적으로 읽을 수 있어 고를 수 있게 뒀습니다.
       * 세는 것은 둘 다 그대로 셉니다 — 이 값은 **판단 기준**만 바꿉니다.
       */
      if (b.f2fMode !== undefined) {
        const v = String(b.f2fMode);
        넣기("f2f_mode", "비대면 배달 세는 법", v, v === "연속" || v === "누적");
      }
      /*
       * ── 하루 최대 서비스 시간 (2026-09-03 무무 님 지시) ──────
       * 편람은 **일 3시간**입니다. 사람마다 다른 경우는 배정의 주간 계획에
       * 요일별 시간을 적습니다 — 거기 적힌 값이 이것보다 앞섭니다.
       * **0 은 「안 봅니다」.** 하루 24시간(1440분)을 넘게는 못 넣습니다.
       */
      if (b.dailyCapMinutes !== undefined) {
        const v = Number(b.dailyCapMinutes);
        넣기("daily_cap_minutes", "하루 최대 서비스 시간", v,
             Number.isFinite(v) && Number.isInteger(v) && v >= 0 && v <= 1440);
      }
      if (b.note !== undefined) 넣기("note", "메모", String(b.note), true);
    } catch (e: any) { return bad(e.message); }

    if (고칠것.length === 0) return json({ ok: true, 바뀐것: 0 });

    const now = new Date().toISOString();
    for (const [칸, 이름, 옛값, 새값] of 고칠것) {
      db.run(`UPDATE region_profile SET ${칸} = ? WHERE id = ?`, [새값, id]);
      db.run(
        `INSERT INTO rule_change_log (changed_at, who, field, before_val, after_val, reason)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [now, me.name, `${p.name} · ${이름}`, String(옛값 ?? ""), String(새값 ?? ""),
         b.reason ?? ""]
      );
    }
    return json({ ok: true, 바뀐것: 고칠것.length });
  }

  // 적용할 계산 규칙 바꾸기 (지침 표준 ↔ 우리 지자체 규칙)
  if (path === "/api/settings/profile" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    const p = db
      .query<{ id: number; name: string }, [number]>(
        "SELECT id, name FROM region_profile WHERE id = ?"
      )
      .get(Number(b.profileId));
    if (!p) return bad("없는 규칙입니다.");

    const before = db
      .query<{ profile_id: number }, []>("SELECT profile_id FROM organization WHERE id = 1")
      .get();
    db.run("UPDATE organization SET profile_id = ? WHERE id = 1", [p.id]);
    // 규칙을 바꾼 것은 돈 계산이 바뀌는 일입니다. 반드시 남깁니다.
    db.run(
      `INSERT INTO rule_change_log (changed_at, who, field, before_val, after_val, reason)
       VALUES (?, ?, '적용 규칙', ?, ?, ?)`,
      [new Date().toISOString(), me.name, String(before?.profile_id ?? ""), p.name,
       b.reason ?? ""]
    );
    return json({ ok: true });
  }

  /* ── 본인부담 구간 ───────────────────────────────────────
   *
   * (2026-09-06 무무 — 「여러 지역에서 범용으로 이 프로그램을 사용할 수
   *  있도록 설정에서 수정 및 저장할 수 있도록 해줘」)
   *
   * 지금까지 **보기만 되고 고칠 수가 없었습니다.** 지침은 이렇게 말합니다 —
   *
   *   「본인부담률 20%~80%」
   *   「**광역지자체별로 본인부담률을 차등 설정**하도록 함」
   *
   * 구간 수도 비율도 지자체마다 다릅니다. 여기가 안 열리면
   * 해남 밖으로는 한 곳도 못 팝니다.
   *
   * ── 지킬 것 셋 ─────────────────────────────────────────
   *
   *  1. **「복지부 지침 표준」은 못 고칩니다** — 서비스 단가와 같은 규칙입니다.
   *  2. **쓰는 사람이 있는 구간은 못 지웁니다.** 지우면 그 대상자의
   *     본인부담이 통째로 사라지고, 청구서가 조용히 틀립니다.
   *  3. **바꾼 것은 반드시 남깁니다** — 돈 계산이 바뀌는 일입니다.
   *     이미 확정한 청구는 그때 값이 얼려 있어 안 흔들립니다.
   */
  const 부담률 = (v: unknown): number => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100)
      throw new Error("부담률은 0 부터 100 사이로 적어 주세요.");
    // 화면은 퍼센트로 받고, 자료함에는 0~1 로 둡니다 (계산이 그 모양입니다).
    return Math.round(n * 10) / 1000;
  };

  /** 규칙이 바뀐 것을 남깁니다. 돈에 닿는 것은 전부 여기를 지납니다. */
  const 규칙기록 = (무엇: string, 옛값: string, 새값: string, 까닭: string) =>
    db.run(
      `INSERT INTO rule_change_log (changed_at, who, field, before_val, after_val, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [new Date().toISOString(), me.name, 무엇, 옛값, 새값, 까닭 ?? ""]);

  /* ── 확인사항 항목 ───────────────────────────────────────
   *
   * (2026-09-06 무무 — 「가사지원 확인사항은 기관의 입맛에 변경하여
   *  사용할 수 있도록 설정에서 항목을 추가/삭제 할 수 있는 기능을 넣자」)
   *
   * 목록을 통째로 받습니다. 한 줄씩 고치는 길을 두지 않는 까닭은,
   * **순서가 곧 폰 화면의 순서**라 순서를 바꾸는 것도 고치는 일이기
   * 때문입니다. 통째로 받으면 순서·추가·삭제가 한 번에 끝납니다.
   *
   * 저장할 때마다 `check_set` 에 **새 줄**이 생깁니다 (얼리기).
   * 자세한 까닭은 server/확인사항.ts 에 적어 두었습니다.
   */
  if (path === "/api/settings/check-items" && method === "GET") {
    return json({ 지금: 지금목록(), 이력: 목록이력(), 편람: [...편람항목] });
  }

  if (path === "/api/settings/check-items" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try {
      const 것 = 목록정하기(b.items, me?.name ?? "관리자", String(b.reason ?? ""));
      /*
       * 바꾼 즉시 폰으로 올립니다. 10분마다 도는 것에만 기대면
       * 관리자가 저장하고 「왜 폰에 안 뜨지」 하며 기다립니다.
       * 실패해도 저장은 이미 끝났습니다 — 다음 차례에 올라갑니다.
       */
      import("./할일보내기")
        .then((m) => m.오늘갈곳보내기())
        .catch((e) => console.error(
          "우편함: 확인사항 바뀐 것 올리기 실패 —", (e as Error).message));
      return json({ ok: true, 지금: 것 });
    } catch (e: any) { return bad(e.message); }
  }

  if (path === "/api/settings/copay" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try {
      const org = db.query<any, []>("SELECT profile_id FROM organization WHERE id = 1").get();
      const p = 고칠수있는프로필(Number(b.profileId ?? org?.profile_id));
      const label = String(b.label ?? "").trim();
      if (!label) return bad("구간 이름을 적어 주세요.");
      if (label.length > 60) return bad("구간 이름이 너무 깁니다.");
      const rate = 부담률(b.rate);
      const 끝 = db.query<{ n: number }, [number]>(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM copay_tier WHERE profile_id = ?"
      ).get(p.id)!.n;
      const i = db.run(
        `INSERT INTO copay_tier (profile_id, label, rate, sort_order) VALUES (?,?,?,?)`,
        [p.id, label, rate, 끝]);
      규칙기록(`${p.name} · 본인부담 구간 넣기`, "", `${label} ${Math.round(rate * 100)}%`, b.reason);
      return json({ ok: true, id: Number(i.lastInsertRowid) });
    } catch (e: any) { return bad(e.message); }
  }

  const mCopay = path.match(/^\/api\/settings\/copay\/(\d+)$/);
  if (mCopay && method === "PATCH") {
    const b = await req.json().catch(() => ({} as any));
    try {
      const t = db.query<any, [number]>(
        "SELECT * FROM copay_tier WHERE id = ?").get(Number(mCopay[1]));
      if (!t) return bad("없는 구간입니다.", 404);
      const p = 고칠수있는프로필(t.profile_id);

      const 고칠것: [string, string, any, any][] = [];
      if (b.label !== undefined) {
        const label = String(b.label).trim();
        if (!label) return bad("구간 이름을 적어 주세요.");
        if (label.length > 60) return bad("구간 이름이 너무 깁니다.");
        if (label !== t.label) 고칠것.push(["label", "이름", t.label, label]);
      }
      if (b.rate !== undefined) {
        const rate = 부담률(b.rate);
        if (Math.abs(rate - Number(t.rate)) > 1e-9)
          고칠것.push(["rate", "부담률", t.rate, rate]);
      }
      if (b.sortOrder !== undefined) {
        const n = Math.max(0, Math.round(Number(b.sortOrder) || 0));
        if (n !== Number(t.sort_order)) 고칠것.push(["sort_order", "차례", t.sort_order, n]);
      }
      if (!고칠것.length) return json({ ok: true, 바뀐것: 0 });

      for (const [칸, 이름, 옛값, 새값] of 고칠것) {
        db.run(`UPDATE copay_tier SET ${칸} = ? WHERE id = ?`, [새값, t.id]);
        const 보이게 = (v: any) => (칸 === "rate" ? `${Math.round(Number(v) * 100)}%` : String(v ?? ""));
        규칙기록(`${p.name} · 본인부담 「${t.label}」 ${이름}`,
                보이게(옛값), 보이게(새값), b.reason);
      }
      return json({ ok: true, 바뀐것: 고칠것.length });
    } catch (e: any) { return bad(e.message); }
  }

  if (mCopay && method === "DELETE") {
    try {
      const t = db.query<any, [number]>(
        "SELECT * FROM copay_tier WHERE id = ?").get(Number(mCopay[1]));
      if (!t) return bad("없는 구간입니다.", 404);
      const p = 고칠수있는프로필(t.profile_id);

      /*
       * ★ **쓰는 분이 있으면 못 지웁니다.**
       *   지우면 그분의 본인부담이 통째로 사라지고, 다음 청구서가
       *   조용히 틀립니다. 「조용히」가 제일 나쁩니다.
       */
      const 쓰는수 = db.query<{ c: number }, [number]>(
        "SELECT COUNT(*) c FROM recipient WHERE copay_tier_id = ?").get(t.id)!.c;
      if (쓰는수 > 0)
        return bad(
          `이 구간을 쓰는 대상자가 ${쓰는수}명 있습니다. ` +
          `그분들을 다른 구간으로 옮긴 뒤에 지워 주세요.`);

      /* 구간이 하나도 없으면 대상자를 등록할 때 고를 것이 없어집니다. */
      const 남은수 = db.query<{ c: number }, [number]>(
        "SELECT COUNT(*) c FROM copay_tier WHERE profile_id = ?").get(t.profile_id)!.c;
      if (남은수 <= 1)
        return bad("구간은 적어도 하나는 있어야 합니다.");

      db.run("DELETE FROM copay_tier WHERE id = ?", [t.id]);
      규칙기록(`${p.name} · 본인부담 구간 지움`,
              `${t.label} ${Math.round(Number(t.rate) * 100)}%`, "", "");
      return json({ ok: true });
    } catch (e: any) { return bad(e.message); }
  }

  /* ── 서비스 (단가표) ─────────────────────────────────────
   *
   * 지침에 없는 서비스를 지자체가 의뢰해 오는 일이 있습니다.
   * 그때 프로그램을 고치러 오지 않아도 되게 화면에서 만들 수 있어야 합니다.
   *
   * 두 가지를 지킵니다.
   *  1. **「복지부 지침 표준」은 못 고칩니다.** 그건 기준선입니다.
   *     기관이 쓰는 것은 자기 지자체 규칙(해남군)이고, 거기서만 고칩니다.
   *  2. **지우지 않습니다.** 실적·의뢰·배정이 이미 가리키고 있어서
   *     지우면 지난 기록지와 청구서가 「이름 없는 서비스」가 됩니다.
   *     안 쓰게 된 것은 `active = 0` 으로 접어 둡니다.
   */
  function 고칠수있는프로필(profileId: number) {
    const p = db.query<any, [number]>(
      "SELECT * FROM region_profile WHERE id = ?").get(profileId);
    if (!p) throw new Error("규칙을 찾을 수 없습니다.");
    if (p.is_builtin)
      throw new Error(
        "「복지부 지침 표준」은 기준선이라 고칠 수 없습니다. " +
        "설정에서 우리 지자체 규칙을 하나 만들어 그쪽에서 고쳐 주세요."
      );
    return p;
  }

  const 돈 = (v: unknown, 이름: string): number => {
    if (v === null || v === undefined || v === "") return 0;
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 0)
      throw new Error(`${은는(이름)} 0 이상 숫자로 적어 주세요.`);
    return n;
  };

  /**
   * 월 한도처럼 **셈이 아니라 개수**인 값. 셈은 돈과 같지만 뜻이 달라
   * 이름을 따로 둡니다 — 나중에 상한을 다르게 잡을 자리이기도 합니다.
   * **0 은 「한도를 안 봅니다」**입니다.
   */
  const 칸수 = (v: unknown, 이름: string): number => {
    const n = 돈(v, 이름);
    if (n > 100_000) throw new Error(`${은는(이름)} 너무 큽니다.`);
    return n;
  };

  /**
   * ── 시간 셈하기 (v1.9.28) ─────────────────────────────────
   *
   * 「몇 분 단위로 세느냐」는 **지자체마다 다릅니다.** 편람은 30분이지만
   * 1시간 단위로 세라는 데도 있고, 해가 바뀌면 또 달라집니다. 프로그램에
   * 못박아 두면 그때마다 저를 부르셔야 합니다 — 그래서 설정에 뒀습니다.
   *
   * 단위는 **30분과 1시간뿐**입니다. 10분·15분을 열어 두면 지자체가 준
   * 단가(시간당)와 나눠떨어지지 않아 1원 단위 오차가 청구서에 남습니다.
   */
  const 셈단위 = (v: unknown): number => {
    const n = Number(v);
    if (n !== 30 && n !== 60)
      throw new Error("시간 셈 단위는 30분 또는 1시간만 됩니다.");
    return n;
  };

  if (path === "/api/settings/service" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try {
      const org = db.query<any, []>("SELECT profile_id FROM organization WHERE id = 1").get();
      const p = 고칠수있는프로필(Number(b.profileId ?? org?.profile_id));
      const name = String(b.name ?? "").trim();
      if (!name) throw new Error("서비스명을 적어 주세요.");
      const unit = ["hour", "meal", "time"].includes(b.unit) ? b.unit : "time";
      const record = ["time", "work", "meal"].includes(b.recordType) ? b.recordType : "time";
      // 코드가 비어 있으면 겹치지 않게 하나 만들어 줍니다.
      const code = String(b.code ?? "").trim()
        || `C${String(Date.now()).slice(-6)}`;
      const 끝 = db.query<{ m: number }, [number]>(
        "SELECT COALESCE(MAX(sort_order), -1) AS m FROM service WHERE profile_id = ?"
      ).get(p.id);
      const now = new Date().toISOString();
      const info = db.run(
        `INSERT INTO service
           (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
            holiday_price, record_type, lifetime_cap,
            monthly_cap_minutes, monthly_cap_count, once_minutes, noshow_billable,
            round_unit, round_half,
            sort_order, active, custom, note, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,1,?,?)`,
        [p.id, code,
         String(b.catL ?? "").trim() || null,
         String(b.catM ?? "").trim() || null,
         String(b.catS ?? "").trim() || null,
         name, unit, 돈(b.unitPrice, "단가"),
         b.holidayPrice === "" || b.holidayPrice == null ? null : 돈(b.holidayPrice, "휴일단가"),
         record,
         b.lifetimeCap === "" || b.lifetimeCap == null ? null : 돈(b.lifetimeCap, "생애한도"),
         // 월 한도 — 0 이면 「안 봅니다」. 시간제는 분, 횟수제는 회.
         칸수(b.monthlyCapMinutes, "월 한도(분)"),
         칸수(b.monthlyCapCount, "월 한도(회)"),
         // 1회 서비스 시간 — 0 이면 「안 정했음」이라 60분을 씁니다 (v36).
         칸수(b.onceMinutes, "1회 서비스 시간(분)"),
         // 노쇼를 비용으로 잡나 — **기본 꺼짐** (2026-09-01).
         b.noshowBillable ? 1 : 0,
         // 시간 셈하기 — 안 보내면 편람 그대로 30분·반올림.
         b.roundUnit == null ? 30 : 셈단위(b.roundUnit),
         b.roundHalf === false ? 0 : 1,
         (끝?.m ?? -1) + 1,
         String(b.note ?? "").trim() || null, now]
      );
      return json({ ok: true, id: Number(info.lastInsertRowid) });
    } catch (e: any) { return bad(e.message); }
  }

  const mSvc = path.match(/^\/api\/settings\/service\/(\d+)$/);
  if (mSvc && method === "PATCH") {
    const b = await req.json().catch(() => ({} as any));
    try {
      const cur = db.query<any, [number]>(
        "SELECT * FROM service WHERE id = ?").get(Number(mSvc[1]));
      if (!cur) return bad("서비스를 찾을 수 없습니다.", 404);
      고칠수있는프로필(cur.profile_id);

      /*
       * **보낸 칸만 고칩니다.** 종사자·대상자에서 겪은 그 문제입니다 —
       * 일부만 보냈는데 안 보낸 칸이 소리 없이 지워지면 아무도 모릅니다.
       */
      // catL → cat_l, unitPrice → unit_price. 자료함 칸 이름으로 바꿔 옛 값을 찾습니다.
      const 스네이크 = (k: string) =>
        k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
      const keep = <T,>(k: string, v: T): T => (k in b ? v : cur[스네이크(k)]);
      const now = new Date().toISOString();
      db.run(
        `UPDATE service SET
           cat_l = ?, cat_m = ?, cat_s = ?, name = ?, unit = ?, unit_price = ?,
           holiday_price = ?, record_type = ?, lifetime_cap = ?,
           monthly_cap_minutes = ?, monthly_cap_count = ?, once_minutes = ?,
           noshow_billable = ?,
           round_unit = ?, round_half = ?,
           active = ?, note = ?, updated_at = ?
         WHERE id = ?`,
        [
          keep("catL", String(b.catL ?? "").trim() || null),
          keep("catM", String(b.catM ?? "").trim() || null),
          keep("catS", String(b.catS ?? "").trim() || null),
          keep("name", String(b.name ?? "").trim() || cur.name),
          keep("unit", ["hour", "meal", "time"].includes(b.unit) ? b.unit : cur.unit),
          keep("unitPrice", 돈(b.unitPrice, "단가")),
          keep("holidayPrice",
            b.holidayPrice === "" || b.holidayPrice == null ? null : 돈(b.holidayPrice, "휴일단가")),
          keep("recordType",
            ["time", "work", "meal"].includes(b.recordType) ? b.recordType : cur.record_type),
          keep("lifetimeCap",
            b.lifetimeCap === "" || b.lifetimeCap == null ? null : 돈(b.lifetimeCap, "생애한도")),
          keep("monthlyCapMinutes", 칸수(b.monthlyCapMinutes, "월 한도(분)")),
          keep("monthlyCapCount", 칸수(b.monthlyCapCount, "월 한도(회)")),
          keep("onceMinutes", 칸수(b.onceMinutes, "1회 서비스 시간(분)")),
          keep("noshowBillable", b.noshowBillable ? 1 : 0),
          "roundUnit" in b ? 셈단위(b.roundUnit) : cur.round_unit,
          keep("roundHalf", b.roundHalf ? 1 : 0),
          keep("active", b.active ? 1 : 0),
          keep("note", String(b.note ?? "").trim() || null),
          now, cur.id,
        ]
      );
      return json({ ok: true });
    } catch (e: any) { return bad(e.message); }
  }

  // ── 기관 직인 ────────────────────────────────────────────
  // 이미지를 자료함 안에 넣습니다. 폴더에 직인 파일이 굴러다니지 않게,
  // 그리고 자료함 하나만 복사하면 백업이 끝나게 하려는 것입니다.
  if (path === "/api/settings/stamp" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    const url = String(b.dataUrl ?? "");
    /*
     * PNG 와 JPG 만 받습니다.
     *
     * 예전에는 WEBP 도 받았는데, **PDF 에 넣을 수 있는 그림이 PNG·JPG 뿐**입니다.
     * WEBP 를 넣어 두면 설정 화면에는 잘 보이는데 청구서·계약서에는 안 찍히고
     * 오류도 안 납니다 — 뽑아 보기 전엔 모릅니다.
     * 화면 쪽에서 어떤 그림이든 PNG 로 바꿔 보내지만, 여기서도 한 번 더 막습니다.
     */
    if (!/^data:image\/(png|jpeg);base64,/.test(url))
      return bad("PNG 또는 JPG 그림만 올릴 수 있습니다. (종이에 찍히려면 이 둘이어야 합니다)");
    if (url.length > 1_400_000) return bad("그림이 너무 큽니다. 1MB 아래로 줄여 주세요.");
    db.run("UPDATE organization SET stamp_png = ? WHERE id = 1", [url]);
    return json({ ok: true });
  }

  if (path === "/api/settings/stamp" && method === "DELETE") {
    db.run("UPDATE organization SET stamp_png = NULL WHERE id = 1");
    return json({ ok: true });
  }

  // 대상자 목록
  if (path === "/api/recipients" && method === "GET") {
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const status = url.searchParams.get("status") ?? "";
    const dong = url.searchParams.get("dong") ?? "";
    const sort = url.searchParams.get("sort") ?? "name";
    const dir = url.searchParams.get("dir") === "desc" ? -1 : 1;

    const rows = db.query(
      `SELECT r.*, t.label AS copay_label, t.rate AS copay_rate
         FROM recipient r
         LEFT JOIN copay_tier t ON t.id = r.copay_tier_id`
    ).all() as any[];

    // 사람마다 '지금 유효한 의뢰'를 서비스별로 하나씩 모읍니다.
    // 같은 서비스가 여러 차수에 걸쳐 오므로 기간이 가장 늦은 것을 씁니다.
    const svcRows = db.query(
      `SELECT recipient_id, name, period_from, period_to, cycle_text FROM (
         SELECT rf.recipient_id, sv.name, rf.period_from, rf.period_to, rf.cycle_text,
                ROW_NUMBER() OVER (
                  PARTITION BY rf.recipient_id, rf.service_id
                  ORDER BY COALESCE(rf.period_from,'') DESC, rf.id DESC) AS rn
           FROM referral rf JOIN service sv ON sv.id = rf.service_id
       ) WHERE rn = 1`
    ).all() as any[];

    const now = today();
    const byPerson = new Map<string, any[]>();
    for (const v of svcRows) {
      const list = byPerson.get(v.recipient_id) ?? [];
      list.push({
        name: v.name,
        from: v.period_from,
        to: v.period_to,
        cycle: v.cycle_text,
        // 기간이 지났으면 그 서비스만 끝난 것입니다.
        // 대상자 전체가 종결된 것은 아니므로 상태는 그대로 둡니다.
        ended: !!v.period_to && v.period_to < now,
      });
      byPerson.set(v.recipient_id, list);
    }

    let items = rows.map((r) => {
      const shaped: any = shapeRecipient(r);
      shaped.services = (byPerson.get(r.id) ?? []).sort(
        (a: any, b: any) => Number(a.ended) - Number(b.ended) || a.name.localeCompare(b.name)
      );
      shaped.serviceNames = shaped.services.map((v: any) => v.name).join(" ");
      // 화면에 짧게 쓸 표기. 부담률에서 만들면 이름이 바뀌어도 늘 맞습니다.
      shaped.copayShort =
        r.copay_rate === null || r.copay_rate === undefined ? null
        : r.copay_rate === 0 ? "면제"
        : `${Math.round(r.copay_rate * 100)}%`;
      return shaped;
    });

    if (q) {
      // 성명·연락처·주소뿐 아니라 서비스명으로도 찾습니다.
      items = items.filter(
        (x: any) =>
          String(x.name).toLowerCase().includes(q) ||
          String(rows.find((r) => r.id === x.id)?.search_text ?? "").includes(q) ||
          x.serviceNames.toLowerCase().includes(q)
      );
    }
    if (status) items = items.filter((x: any) => x.status === status);
    if (dong) items = items.filter((x: any) => x.dong === dong);
    if (visibleIds) items = items.filter((x: any) => visibleIds.has(x.id));

    const pick = (x: any) => {
      switch (sort) {
        case "age": return x.age ?? -1;
        case "dong": return x.dong ?? "";
        case "status": return x.status ?? "";
        case "deadline": return x.suspendDeadline ?? "9999";
        case "copay": return x.copayShort ?? "힣";
        case "services": return x.serviceNames;
        default: return x.name ?? "";
      }
    };
    items.sort((a: any, b: any) => {
      const x = pick(a), y = pick(b);
      const c = typeof x === "number" && typeof y === "number"
        ? x - y : String(x).localeCompare(String(y), "ko");
      return c * dir;
    });

    const dongs = db
      .query<{ dong: string }, []>(
        "SELECT DISTINCT dong FROM recipient WHERE dong IS NOT NULL AND dong <> '' ORDER BY dong"
      )
      .all()
      .map((r) => r.dong);

    return json({ items, dongs, statuses: STATUSES });
  }

  // 대상자 등록
  if (path === "/api/recipients" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    if (!b.name?.trim()) return bad("성명을 입력해 주세요.");
    if (!b.birth?.trim()) return bad("생년월일을 입력해 주세요.");

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO recipient
         (id, payload, search_text, dong, status, status_since,
          copay_tier_id, memo, created_at, updated_at)
       VALUES (?, ?, ?, ?, '이용', ?, ?, ?, ?, ?)`,
      [
        id, buildPayload(b), buildSearchText(b), (b.dong ?? "").trim(),
        today(), b.copayTierId ?? null, b.memo ?? "", now, now,
      ]
    );
    db.run(
      `INSERT INTO status_change (recipient_id, from_status, to_status, changed_on, reason, created_at)
       VALUES (?, NULL, '이용', ?, '등록', ?)`,
      [id, today(), now]
    );
    /*
     * 방문표(문에 붙이는 QR)를 **등록하는 그 자리에서** 만들어 둡니다.
     *
     * 왜 여기인가 — 계약서를 뽑아 상담을 나가실 때 방문표가 같이 나가야
     * 합니다. 상담을 마치고 그 자리에 붙이고 오셔야, 그다음부터
     * 제공인력이 현장앱으로 찍을 수 있습니다. 인쇄할 때 만들면
     * **아직 안 만들어진 상태로 계약서만 들고 나가는** 일이 생깁니다.
     */
    집표(id);
    return json({ ok: true, id });
  }

  // 대상자 한 명
  const mDetail = path.match(/^\/api\/recipients\/([0-9a-f-]{36})$/i);
  if (mDetail) {
    const id = mDetail[1];
    const row = db
      .query(
        `SELECT r.*, t.label AS copay_label, t.rate AS copay_rate
           FROM recipient r LEFT JOIN copay_tier t ON t.id = r.copay_tier_id
          WHERE r.id = ?`
      )
      .get(id) as any;
    if (!row) return bad("대상자를 찾을 수 없습니다.", 404);
    if (visibleIds && !visibleIds.has(id))
      return bad("배정된 대상자만 볼 수 있습니다.", 403);

    if (method === "GET") {
      const history = db
        .query("SELECT * FROM status_change WHERE recipient_id = ? ORDER BY id DESC")
        .all(id);

      // 받는 서비스 — 서비스마다 '지금 유효한' 의뢰 하나씩.
      // 같은 서비스가 여러 차수에 걸쳐 오므로 기간이 가장 늦은 것을 씁니다.
      const services = db.query(
        `SELECT id, name, code, unit, period_from, period_to, period_months,
                cycle_text, cycle_unit, cycle_count, note, batch_label, lifetime_cap,
                referral_id, cancelled_at, cancel_reason
           FROM (
             SELECT sv.id, sv.name, sv.code, sv.unit, sv.lifetime_cap,
                    rf.id AS referral_id,
                    rf.period_from, rf.period_to, rf.period_months,
                    rf.cycle_text, rf.cycle_unit, rf.cycle_count, rf.note, rf.batch_label,
                    rf.cancelled_at, rf.cancel_reason,
                    ROW_NUMBER() OVER (
                      PARTITION BY rf.service_id
                      ORDER BY COALESCE(rf.period_from,'') DESC, rf.id DESC) AS rn
               FROM referral rf JOIN service sv ON sv.id = rf.service_id
              WHERE rf.recipient_id = ?
           ) WHERE rn = 1
           ORDER BY name`
      ).all(id) as any[];

      // 서비스마다 담당이 다릅니다. 한 사람 화면에서 "이건 누가 오나"가
      // 바로 보여야 합니다 — 어르신 전화가 오면 그것부터 묻습니다.
      // 살아 있는 배정이 없으면 **마지막 배정**을 이력으로 보여 줍니다.
      // 종결되면 배정이 자동으로 닫히는데, 그렇다고 화면에서 사라지면
      // "그때 누가 다녔더라"에 답할 수가 없습니다.
      const assigns = new Map<string, any>();
      for (const a of db.query(
        `SELECT sv.name AS service, a.weekly_plan, a.period_to,
                u.name AS worker, u.phone AS worker_phone
           FROM assignment a
           LEFT JOIN service  sv ON sv.id = a.service_id
           LEFT JOIN worker   w  ON w.id  = a.worker_id
           LEFT JOIN app_user u  ON u.id  = w.user_id
          WHERE a.recipient_id = ?
          ORDER BY a.id`
      ).all(id) as any[]) assigns.set(a.service, a);

      const now = today();
      const shapedSvc = services.map((v) => ({
        id: v.id, name: v.name, code: v.code, unit: v.unit,
        worker: assigns.get(v.name)?.worker ?? "",
        workerPhone: assigns.get(v.name)?.worker_phone ?? "",
        slotText: slotText(parseSlots(assigns.get(v.name)?.weekly_plan)),
        // 배정이 닫혔으면 「지난 담당」으로 표시합니다.
        // 종결한 그날은 period_to 가 오늘이라 날짜만으로는 진행중으로 보입니다.
        // 그래서 **사람의 상태**도 함께 봅니다.
        workerEnded: (() => {
          const to = assigns.get(v.name)?.period_to;
          return DONE_STATUS.includes(row.status) || (!!to && to < now);
        })(),
        workerUntil: assigns.get(v.name)?.period_to ?? null,
        from: v.period_from, to: v.period_to, months: v.period_months,
        cycle: v.cycle_text, cycleUnit: v.cycle_unit, cycleCount: v.cycle_count,
        note: v.note, batch: v.batch_label,
        // 손으로 넣은 것을 지울 때 씁니다. 엑셀에서 온 것은 서버가 막습니다.
        // **의뢰 줄의 번호**입니다 — v.id 는 서비스 번호라 다릅니다.
        referralId: v.referral_id,
        lifetimeCap: v.lifetime_cap,
        ended: !!v.period_to && v.period_to < now,
        daysLeft: v.period_to ? daysUntil(v.period_to) : null,
        // 중단한 것은 「끝남」과 다르게 보여야 합니다 — 기간이 다 된 것과
        // 안 하기로 한 것은 뜻이 다릅니다.
        cancelledAt: v.cancelled_at ?? null,
        cancelReason: v.cancel_reason ?? null,
      }));

      /*
       * 그 사람의 모든 의뢰 (차수별 이력).
       *
       * **기간이 겹치는 것끼리 표시합니다.** 4.21~6.30 이 있는데 5.11~7.17 이
       * 새로 오면 6월이 겹칩니다 — 지자체 확인 결과 **둘 다 유효**라
       * 아무것도 안 고치지만, 겹친다는 사실은 보여야 합니다.
       * 청구가 두 번 잡히거나 없는 기간을 서비스한 것이 되는 일을 여기서 막습니다.
       */
      const 의뢰들 = db.query<any, [string]>(
        `SELECT rf.id, rf.service_id, rf.batch_label, sv.name AS service,
                rf.period_from, rf.period_to,
                rf.cycle_text, rf.copay_type, rf.note, rf.diff_state, rf.created_at
           FROM referral rf LEFT JOIN service sv ON sv.id = rf.service_id
          WHERE rf.recipient_id = ?
          ORDER BY rf.id DESC`
      ).all(id);

      const 걸치나 = (a: any, b: any) => {
        const a1 = a.period_from || "0000-00-00", a2 = a.period_to || "9999-99-99";
        const b1 = b.period_from || "0000-00-00", b2 = b.period_to || "9999-99-99";
        return a1 <= b2 && b1 <= a2;
      };
      const referrals = 의뢰들.map((r) => ({
        ...r,
        겹침: 의뢰들
          .filter((o) => o.id !== r.id && o.service_id === r.service_id && 걸치나(r, o))
          .map((o) => ({
            batch: o.batch_label, from: o.period_from ?? "", to: o.period_to ?? "",
          })),
      }));

      const changes = db.query(
        "SELECT field, before_val, after_val, changed_on, who FROM recipient_change WHERE recipient_id = ? ORDER BY id DESC"
      ).all(id);

      const shaped: any = shapeRecipient(row);
      shaped.copayShort =
        row.copay_rate === null || row.copay_rate === undefined ? null
        : row.copay_rate === 0 ? "면제"
        : `${Math.round(row.copay_rate * 100)}%`;
      // 식사지원을 받는 분에게만 대면 수령 세기를 보여줍니다.
      shaped.hasMeal = shapedSvc.some((v) => v.code === "DL-MEAL" || v.name.includes("식사"));

      /*
       * ── 올해 얼마 썼나 (7-마) ────────────────────────────────
       *
       * 계약서 4조가 어르신께 「연간 지원한도액에서 차감됩니다」라고
       * 약속합니다. **그 약속의 남은 숫자**를 여기서 답합니다.
       * 어르신이 「얼마나 남았어요」라고 물으면 이 줄을 읽으면 됩니다.
       */
      const 한도 = 연간쓴돈(id, Number(now.slice(0, 4)));

      return json({
        recipient: shaped, services: shapedSvc, history, referrals, changes, 한도,
      });
    }

    if (method === "PATCH") {
      const b = await req.json().catch(() => ({} as any));

      /*
       * **적어 보내지 않은 칸은 건드리지 않습니다.**
       *
       * 화면은 늘 한 벌을 통째로 보내지만, 앞으로 붙을 현장앱이나 일괄 처리는
       * 「본인부담 구간만」 같이 일부만 보낼 수 있습니다. 그때 나머지가 빈칸으로
       * 밀리면 주소와 보호자 연락처가 소리 없이 지워집니다.
       * 종사자 쪽에서 한 번 겪은 일이라 여기도 같은 방식으로 막습니다.
       */
      const curP = JSON.parse(row.payload || "{}");
      const keep = (k: string) => (b[k] === undefined ? curP[k] : b[k]);
      const merged = {
        name: keep("name"), birth: keep("birth"), gender: keep("gender"),
        phone: keep("phone"), phoneHome: keep("phoneHome"), address: keep("address"),
        lat: keep("lat"), lng: keep("lng"), guardians: keep("guardians"),
        cctv: keep("cctv"), pet: keep("pet"), caution: keep("caution"),
        selfSign: keep("selfSign"),
      };
      if (!String(merged.name ?? "").trim()) return bad("성명을 입력해 주세요.");

      db.run(
        `UPDATE recipient SET payload = ?, search_text = ?, dong = ?,
                copay_tier_id = ?, memo = ?, updated_at = ?
           WHERE id = ?`,
        [
          buildPayload(merged), buildSearchText(merged),
          String(b.dong === undefined ? (row.dong ?? "") : b.dong).trim(),
          b.copayTierId === undefined ? row.copay_tier_id : (b.copayTierId ?? null),
          b.memo === undefined ? (row.memo ?? "") : b.memo,
          new Date().toISOString(), id,
        ]
      );
      return json({ ok: true });
    }

    if (method === "DELETE") {
      db.run("DELETE FROM recipient WHERE id = ?", [id]);
      return json({ ok: true });
    }
  }

  /*
   * ── 받는 서비스를 **손으로** 넣기 ─────────────────────────
   *
   * 지금까지 서비스는 **지자체 엑셀 의뢰로만** 들어왔습니다. 그래서 직접 추가한
   * 대상자는 배정도 실적도 기록지도 할 수가 없었습니다 — 시험도, 엑셀을 아직
   * 못 받은 달의 실제 업무도 막힙니다.
   *
   * **새 표를 만들지 않았습니다.** 손으로 넣은 것도 `referral` 한 줄입니다.
   * 배정·실적·정산·기록지가 전부 이 표를 보고 있어서, 여기 한 줄이 생기면
   * 나머지가 **한 줄도 안 고치고** 그대로 돕니다. 어디서 왔는지는
   * `batch_label` 로 갈립니다 — 엑셀은 시트 이름, 손으로 넣은 것은 「손입력」.
   */
  const 손입력 = "손입력";

  /** 이 기관이 고를 수 있는 서비스 목록. 손으로 넣을 때 고르는 칸에 씁니다. */
  if (path === "/api/service-catalog" && method === "GET") {
    const org = db.query<any, []>("SELECT profile_id FROM organization WHERE id = 1").get();
    const list = db.query<any, [number]>(
      `SELECT id, code, name, unit, unit_price, record_type, lifetime_cap
         FROM service WHERE profile_id = ? ORDER BY sort_order, name`
    ).all(org?.profile_id ?? 0);
    return json({ services: list });
  }

  const mAddSvc = path.match(/^\/api\/recipients\/([0-9a-f-]{36})\/service$/i);
  if (mAddSvc && method === "POST") {
    const rid = mAddSvc[1];
    const row = db.query<any, [string]>("SELECT id FROM recipient WHERE id = ?").get(rid);
    if (!row) return bad("그 대상자를 찾지 못했습니다.", 404);

    const b = await req.json().catch(() => ({} as any));
    const serviceId = Number(b.serviceId);
    if (!serviceId) return bad("서비스를 골라 주세요.");
    const sv = db.query<any, [number]>("SELECT id, name FROM service WHERE id = ?").get(serviceId);
    if (!sv) return bad("그 서비스를 찾지 못했습니다.", 404);

    const from = String(b.from ?? "").trim() || null;
    const to = String(b.to ?? "").trim() || null;
    if (!from) return bad("시작일을 넣어 주세요.");
    if (to && to < from) return bad("끝나는 날이 시작일보다 앞섭니다.");

    const unit = ["week", "month", "lifetime"].includes(String(b.cycleUnit))
      ? String(b.cycleUnit) : "week";
    const count = Math.max(1, Math.min(99, Number(b.cycleCount) || 1));
    /*
     * 주기 글은 **여기서 한 번만** 만듭니다.
     * 엑셀에서 온 것은 원문(「주 2회」)을 그대로 두는데, 손으로 넣은 것은
     * 원문이 없으니 같은 모양으로 지어 줍니다. 화면·기록지가 이 글을 그대로 씁니다.
     */
    const cycleText = unit === "week" ? `주 ${count}회`
                    : unit === "month" ? `월 ${count}회`
                    : `생애 ${count}회`;

    // 기간이 몇 달인지 — 정산이 쓰는 값이라 엑셀과 같은 방법으로 셉니다.
    let months: number | null = null;
    if (from && to) {
      const [y1, m1] = from.split("-").map(Number);
      const [y2, m2] = to.split("-").map(Number);
      months = (y2 - y1) * 12 + (m2 - m1) + 1;
      if (!Number.isFinite(months) || months < 1) months = null;
    }

    /*
     * **같은 서비스를 기간이 겹치게 두 번** 넣으면 청구가 두 번 잡힙니다.
     * 엑셀 쪽은 겹침을 보여만 주고 막지 않습니다 — 지자체가 실제로 그렇게 보내는
     * 일이 있기 때문입니다. 하지만 **사람이 손으로 넣는 자리**는 대부분 실수라
     * 여기서 멈춰 세웁니다.
     */
    const 겹치는것 = db.query<any, [string, number, string, string]>(
      `SELECT id, period_from, period_to FROM referral
        WHERE recipient_id = ? AND service_id = ?
          AND COALESCE(period_from,'0000-00-00') <= ?
          AND COALESCE(period_to,'9999-99-99') >= ?`
    ).get(rid, serviceId, to ?? "9999-99-99", from);
    if (겹치는것)
      return bad(
        `이미 ${겹치는것.period_from ?? "?"} ~ ${겹치는것.period_to ?? "계속"} 로 ` +
        `같은 서비스가 들어 있습니다. 기간이 겹치면 청구가 두 번 잡힙니다.`
      );

    const now = new Date().toISOString();
    db.run(
      `INSERT INTO referral
         (batch_label, recipient_id, service_id, period_from, period_to, period_months,
          cycle_unit, cycle_count, cycle_text, copay_type, note, diff_state, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, '신규', ?)`,
      [손입력, rid, serviceId, from, to, months, unit, count, cycleText,
       String(b.note ?? "").trim() || null, now]
    );
    return json({ ok: true, service: sv.name, cycle: cycleText });
  }

  /*
   * ── 손으로 넣은 것 **고치기** ─────────────────────────────
   *
   * 지우기만 있으면 실적이 한 건이라도 찍힌 순간 **손댈 길이 없어집니다.**
   * 그런데 사람이 가장 흔하게 틀리는 것이 기간과 회차이고, 그것은 보통
   * **실적이 몇 건 쌓인 뒤에** 발견됩니다. 그때 「지울 수 없습니다」만 뜨면
   * 기관은 자료함을 손대거나 포기합니다. 둘 다 나쁩니다.
   *
   * 그래서 **기간·주기·비고는 실적이 있어도 고칠 수 있습니다.**
   * 이 셋은 고쳐도 이미 찍힌 실적이 사라지지 않습니다 — 정산이 다시 셀 뿐입니다.
   *
   * **서비스 종류만 다릅니다.** 실적은 (대상자, 서비스)로 매달려 있어서
   * 종류를 바꾸면 이미 찍힌 실적이 **엉뚱한 서비스에 붙습니다.**
   * 그래서 종류는 **실적이 없을 때만** 바꿉니다.
   */
  const mEditSvc = path.match(/^\/api\/referral\/(\d+)$/);
  if (mEditSvc && method === "PATCH") {
    const rfId = Number(mEditSvc[1]);
    const rf = db.query<any, [number]>("SELECT * FROM referral WHERE id = ?").get(rfId);
    if (!rf) return bad("그 서비스를 찾지 못했습니다.", 404);
    if (rf.batch_label !== 손입력)
      return bad("지자체 의뢰로 들어온 것은 고칠 수 없습니다. 다음 차수로 고쳐 주세요.");

    const b = await req.json().catch(() => ({} as any));

    // 이미 찍힌 실적 — 종류를 바꿔도 되는지 가릅니다.
    const 실적수 = db.query<{ c: number }, [string, number]>(
      `SELECT COUNT(*) AS c FROM delivery d
         JOIN assignment a ON a.id = d.assignment_id
        WHERE a.recipient_id = ? AND a.service_id = ?`
    ).get(rf.recipient_id, rf.service_id)?.c ?? 0;

    let serviceId = rf.service_id;
    if (b.serviceId !== undefined && Number(b.serviceId) !== rf.service_id) {
      if (실적수 > 0)
        return bad(
          `제공실적이 ${실적수}건 찍혀 있어 **서비스 종류**는 바꿀 수 없습니다. ` +
          `이미 찍힌 실적이 엉뚱한 서비스에 붙습니다. 기간·주기·비고는 고칠 수 있습니다.`
        );
      const sv = db.query<any, [number]>("SELECT id FROM service WHERE id = ?").get(Number(b.serviceId));
      if (!sv) return bad("그 서비스를 찾지 못했습니다.", 404);
      serviceId = Number(b.serviceId);
    }

    // 적어 보내지 않은 칸은 건드리지 않습니다.
    const from = b.from === undefined ? rf.period_from : (String(b.from).trim() || null);
    const to   = b.to   === undefined ? rf.period_to   : (String(b.to).trim() || null);
    if (!from) return bad("시작일을 넣어 주세요.");
    if (to && to < from) return bad("끝나는 날이 시작일보다 앞섭니다.");

    const unit = b.cycleUnit === undefined ? rf.cycle_unit
      : (["week", "month", "lifetime"].includes(String(b.cycleUnit)) ? String(b.cycleUnit) : rf.cycle_unit);
    const count = b.cycleCount === undefined ? rf.cycle_count
      : Math.max(1, Math.min(99, Number(b.cycleCount) || 1));
    const cycleText = unit === "week" ? `주 ${count}회`
                    : unit === "month" ? `월 ${count}회`
                    : `생애 ${count}회`;

    let months: number | null = null;
    if (from && to) {
      const [y1, m1] = from.split("-").map(Number);
      const [y2, m2] = to.split("-").map(Number);
      months = (y2 - y1) * 12 + (m2 - m1) + 1;
      if (!Number.isFinite(months) || months < 1) months = null;
    }

    // 고친 뒤에도 **자기 자신 말고** 겹치는 것이 없어야 합니다.
    const 겹침 = db.query<any, [string, number, number, string, string]>(
      `SELECT id, period_from, period_to FROM referral
        WHERE recipient_id = ? AND service_id = ? AND id <> ?
          AND COALESCE(period_from,'0000-00-00') <= ?
          AND COALESCE(period_to,'9999-99-99') >= ?`
    ).get(rf.recipient_id, serviceId, rfId, to ?? "9999-99-99", from);
    if (겹침)
      return bad(
        `이미 ${겹침.period_from ?? "?"} ~ ${겹침.period_to ?? "계속"} 로 ` +
        `같은 서비스가 들어 있습니다. 기간이 겹치면 청구가 두 번 잡힙니다.`
      );

    const note = b.note === undefined ? rf.note : (String(b.note).trim() || null);
    db.run(
      `UPDATE referral SET service_id = ?, period_from = ?, period_to = ?, period_months = ?,
              cycle_unit = ?, cycle_count = ?, cycle_text = ?, note = ?
        WHERE id = ?`,
      [serviceId, from, to, months, unit, count, cycleText, note, rfId]
    );
    return json({ ok: true, 실적수 });
  }

  /*
   * 받는 서비스 한 줄 지우기.
   *
   * 처음에는 **지자체 의뢰는 못 지우게** 막아 두었습니다. `referral` 표가
   * 「무엇이 왔었는지」의 유일한 기록이라(엑셀 원본은 따로 안 남습니다),
   * 지우면 알 길이 없어지기 때문입니다.
   *
   * 그런데 현장에서 **잘못 들어온 줄을 치울 길이 없으면** 화면이 계속
   * 틀린 채로 남습니다. 그래서 열었습니다(2026-09-04 무무 요청).
   * 대신 화면이 지우기 전에 **무엇이 사라지는지** 알려 주고,
   * 안 하게 된 것뿐이면 **「중단」**을 권합니다.
   *
   * **실적이 이미 찍혔으면 여전히 막습니다** — 실적은 남고 근거만
   * 사라지면 정산을 설명할 수 없습니다.
   */
  /*
   * ── 의뢰 중단 · 되돌리기 ────────────────────────────────────
   *
   * 「신청은 했는데 자부담이 부담되어 취소」 같은 경우입니다.
   * **지우지 않습니다.** 무엇이 왔었는지는 근거로 남아야 하고,
   * 나중에 군이 「이건 왜 안 했느냐」고 물으면 사유가 있어야 합니다.
   *
   * 대신 **기간을 그날로 닫습니다.** 그러면 기간을 보는 열 군데
   * (정산·서식·배정·마감·홈 화면…)가 저절로 따라옵니다.
   */
  const mCancel = path.match(/^\/api\/referral\/(\d+)\/(cancel|uncancel)$/);
  if (mCancel && method === "POST") {
    if (!can(me, "recipient.edit"))
      return bad("의뢰 중단은 관리자와 사무직원만 할 수 있습니다.", 403);
    const rfId = Number(mCancel[1]);
    const rf = db.query<any, [number]>("SELECT * FROM referral WHERE id = ?").get(rfId);
    if (!rf) return bad("그 서비스를 찾지 못했습니다.", 404);
    const b = await req.json().catch(() => ({} as any));

    if (mCancel[2] === "uncancel") {
      if (!rf.cancelled_at) return bad("중단된 것이 아닙니다.");
      db.run(
        `UPDATE referral SET period_to = ?, cancelled_at = NULL,
                             cancel_reason = NULL, to_before = NULL WHERE id = ?`,
        [rf.to_before ?? null, rfId]);
      우편함맞추기();          // 다시 다녀야 하니 현장앱에 되살아나야 합니다
      return json({ ok: true });
    }

    if (rf.cancelled_at) return bad("이미 중단된 의뢰입니다.");
    const 사유 = String(b.reason ?? "").trim();
    if (!사유)
      return bad("중단 사유를 적어 주세요. 나중에 「왜 안 했느냐」에 답할 근거입니다.");

    /*
     * 닫는 날. 아직 시작도 안 한 의뢰면 **시작일**로 닫습니다 —
     * 오늘로 닫으면 기간 끝이 시작보다 앞서는 이상한 줄이 됩니다.
     */
    const 오늘 = today();
    const 닫는날 =
      rf.period_from && rf.period_from > 오늘 ? rf.period_from : 오늘;

    db.run(
      `UPDATE referral SET to_before = period_to, period_to = ?,
                           cancelled_at = ?, cancel_reason = ? WHERE id = ?`,
      [닫는날, 오늘, 사유, rfId]);

    /*
     * 배정도 같이 닫습니다. 안 그러면 「오늘 갈 곳」에 계속 뜹니다.
     * 이미 찍힌 실적은 **건드리지 않습니다** — 실제로 다녀온 것은 사실이고,
     * 정산에서 빠지면 그것대로 설명이 안 됩니다.
     */
    db.run(
      `UPDATE assignment SET period_to = ?
        WHERE recipient_id = ? AND service_id = ?
          AND (period_to IS NULL OR period_to > ?)`,
      [닫는날, rf.recipient_id, rf.service_id, 닫는날]);

    우편함맞추기();            // 멈춘 집이 현장앱에서 바로 빠져야 합니다
    return json({ ok: true, 닫는날 });
  }

  const mDelSvc = path.match(/^\/api\/referral\/(\d+)$/);
  if (mDelSvc && method === "DELETE") {
    const rfId = Number(mDelSvc[1]);
    const rf = db.query<any, [number]>("SELECT * FROM referral WHERE id = ?").get(rfId);
    if (!rf) return bad("그 서비스를 찾지 못했습니다.", 404);
    const 실적 = db.query<{ c: number }, [string, number]>(
      `SELECT COUNT(*) AS c FROM delivery d
         JOIN assignment a ON a.id = d.assignment_id
        WHERE a.recipient_id = ? AND a.service_id = ?`
    ).get(rf.recipient_id, rf.service_id);
    if ((실적?.c ?? 0) > 0)
      return bad(
        `이미 제공실적이 ${실적!.c}건 찍혀 있어 지울 수 없습니다. ` +
        `안 하게 된 것이라면 「중단」으로 닫아 주세요 — 찍힌 실적은 그대로 남습니다.`);

    db.run("DELETE FROM referral WHERE id = ?", [rfId]);
    우편함맞추기();
    return json({ ok: true });
  }

  // 상태 변경
  const mStatus = path.match(/^\/api\/recipients\/([0-9a-f-]{36})\/status$/i);
  if (mStatus && method === "POST") {
    const id = mStatus[1];
    const b = await req.json().catch(() => ({} as any));
    const to = String(b.status ?? "");
    if (!STATUSES.includes(to as any)) return bad("알 수 없는 상태입니다.");

    const cur = db
      .query<{ status: string }, [string]>("SELECT status FROM recipient WHERE id = ?")
      .get(id);
    if (!cur) return bad("대상자를 찾을 수 없습니다.", 404);

    const changedOn = (b.changedOn ?? today()).slice(0, 10);
    // 「중단」이 되면 90일 뒤가 종결 검토 기한이 됩니다.
    const deadline = to === "중단" ? addDays(changedOn, SUSPEND_DAYS) : null;

    db.run(
      `UPDATE recipient SET status = ?, status_since = ?, status_reason = ?,
              suspend_deadline = ?, updated_at = ?
         WHERE id = ?`,
      [to, changedOn, b.reason ?? "", deadline, new Date().toISOString(), id]
    );
    db.run(
      `INSERT INTO status_change (recipient_id, from_status, to_status, changed_on, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, cur.status, to, changedOn, b.reason ?? "", new Date().toISOString()]
    );

    // 끝난 사람의 배정은 자동으로 닫습니다.
    // 안 닫으면 제공인력 화면에 계속 남아 「오늘 가야 하는 집」으로 보입니다.
    // 지우는 게 아니라 닫는 것이라 누가 언제까지 다녔는지는 이력에 남습니다.
    const closed = DONE_STATUS.includes(to)
      ? closeAssignments(id, changedOn).closed
      : 0;

    /*
     * ★ 「중단」도 여기서 잡힙니다.
     *   중단은 배정을 닫지 않습니다(잠시 멈춘 것이라 되살릴 것이니까).
     *   대신 그날갈곳 이 「이용」인 분만 골라 냅니다. 그러니 우편함을
     *   맞춰 주지 않으면 **아침에 올라간 줄이 그대로 남아** 제공인력이
     *   멈춘 집에 찾아갑니다.
     */
    우편함맞추기();
    return json({ ok: true, suspendDeadline: deadline, closedAssignments: closed });
  }

  // ── 인력 (관리자·사무직원·제공인력·외부업체) ──────────────
  if (path === "/api/staff" && method === "GET") {
    // 명단 전체를 볼 수 없는 사람에게는 **자기 한 줄만** 보냅니다.
    // 화면에서 감추는 것으로는 부족합니다. 주소창을 치면 그만이니까요.
    const all = listStaff({
      q: url.searchParams.get("q") ?? "",
      role: url.searchParams.get("role") ?? "",
      includeResigned: url.searchParams.get("resigned") === "1",
    });
    /*
     * 지금 관리자가 누구인지 함께 보냅니다. 화면이 「관리자」 단추를
     * 눌러 보고 나서야 「한 명뿐입니다」를 듣는 것보다, **누르기 전에**
     * 아는 편이 낫습니다.
     */
    const 지금관리자 = 관리자들()[0] ?? null;
    return json({
      지금관리자,
      items: can(me, "staff.list") ? all : all.filter((s) => s.id === me.id),
      roles: ROLES.map((r) => ({ key: r, label: ROLE_KO[r] })),
      me: { id: me.id, roles: parseRoles((me as any).roles) },
      perms: permsOf(me),
    });
  }

  if (path === "/api/staff" && method === "POST") {
    if (!can(me, "staff.create")) return bad("종사자 등록은 관리자만 할 수 있습니다.", 403);
    const b = await req.json().catch(() => ({} as any));
    try { return json({ id: await createStaff(b) }); }
    catch (e: any) { return bad(e.message); }
  }

  const mStaff = path.match(/^\/api\/staff\/(\d+)(\/[a-z]+)?$/);
  if (mStaff) {
    const sid = Number(mStaff[1]);
    const tail = mStaff[2] ?? "";
    const self = sid === me.id;

    if (!tail && method === "GET") {
      if (!self && !can(me, "staff.list"))
        return bad("본인 정보만 볼 수 있습니다.", 403);
      try { return json({ ...getStaff(sid), perms: permsOf(me), self }); }
      catch (e: any) { return bad(e.message, 404); }
    }
    const b = await req.json().catch(() => ({} as any));
    try {
      if (!tail && method === "PATCH") {
        // 남의 정보는 관리자만. 본인 정보는 누구나 — 다만 연락처·주소까지입니다.
        if (!self && !can(me, "staff.editOther"))
          return bad("남의 정보는 관리자만 고칠 수 있습니다.", 403);
        const r = await updateStaff(sid, b, { limited: !can(me, "staff.account") });
        return json({ ok: true, ...(r ?? {}) });
      }
      if (tail === "/password" && method === "POST") {
        // 자기 비밀번호는 스스로 바꿀 수 있어야 합니다. 남의 것은 관리자만.
        if (!self && !can(me, "staff.account"))
          return bad("남의 비밀번호는 관리자만 바꿀 수 있습니다.", 403);
        await resetPassword(sid, String(b.password ?? ""));
        return json({ ok: true });
      }
      if (!can(me, "staff.account"))
        return bad("휴직·계약종료 처리는 관리자만 할 수 있습니다.", 403);
      /*
       * 기기 등록 — 제공인력 휴대폰을 우편함에 잇습니다.
       * 관리자 화면에서 하되, **비밀번호는 본인이 그 자리에서** 칩니다.
       * 확인은 해시를 가진 이쪽(기관 PC)에서 합니다.
       */
      if (tail === "/enroll" && method === "POST") {
        try {
          return json(await 기기등록시작(sid));
        } catch (e: any) { return bad(e.message); }
      }
      /*
       * 등록이 어디까지 갔나 — 화면이 몇 초마다 물어봅니다.
       * 물어보는 김에 **열쇠도 건넵니다** (기기등록.ts 의 등록어디까지 참고).
       */
      if (tail === "/enrollstate" && method === "POST") {
        try { return json(await 등록어디까지(sid)); }
        catch (e: any) { return bad(e.message); }
      }
      if (tail === "/resign" && method === "POST") {
        const r = resign(sid, b.on);
        // 계약이 끝나면 그 폰이 바로 아무것도 못 보게 합니다.
        기기끄기(sid).catch((e) =>
          console.error("우편함: 인력 끄기 실패 —", (e as Error).message));
        return json(r);
      }
      if (tail === "/restore" && method === "POST") { restore(sid); return json({ ok: true }); }
      /*
       * ── 관리자 넘기기 ────────────────────────────────────
       *
       * 지금 관리자만 부를 수 있고, 부른 사람은 **그 자리에서 관리자가
       * 아니게 됩니다.** 그래서 남이 대신 눌러 줄 수 없습니다 —
       * 자리를 내놓는 것은 본인이 하는 일입니다.
       */
      if (tail === "/admin" && method === "POST") {
        try {
          const r = 관리자넘기기(me.id, sid);
          return json({ ok: true, ...r });
        } catch (e: any) { return bad(e.message); }
      }
      // 휴직 — 퇴직과 같은 권한으로 다룹니다. 사람의 신분이 바뀌는 일입니다.
      if (tail === "/leave" && method === "POST")
        return json(startLeave(sid, { from: b.from, to: b.to, reason: b.reason }));
      if (tail === "/return" && method === "POST") return json(endLeave(sid));
    } catch (e: any) { return bad(e.message); }
  }

  // ── 기록지 (매달 지자체에 내는 서식) ─────────────────────
  if (path.startsWith("/api/recordbook")) {
    if (!can(me, "recipient.viewAll"))
      return bad("기록지는 관리자와 사무직원만 볼 수 있습니다.", 403);
    if (method !== "GET" && !can(me, "recipient.edit"))
      return bad("기록지는 관리자와 사무직원만 다룰 수 있습니다.", 403);
  }

  if (path === "/api/recordbook" && method === "GET") {
    const m = url.searchParams.get("month") ?? today().slice(0, 7);
    try {
      return json({ month: m, items: listFor(m), states: 상태값, me: me.name });
    } catch (e: any) { return bad(e.message); }
  }

  const mBook = path.match(/^\/api\/recordbook\/([0-9a-f-]{36})$/i);
  if (mBook && method === "GET") {
    try { return json(gather(mBook[1], url.searchParams.get("month") ?? today().slice(0, 7))); }
    catch (e: any) { return bad(e.message, 404); }
  }
  if (mBook && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try { return json(saveNote(mBook[1], String(b.month ?? ""), b)); }
    catch (e: any) { return bad(e.message); }
  }

  // 한 사람 내려받기 — 여러 장이면 zip 으로 묶입니다.
  const mDl = path.match(/^\/api\/recordbook\/([0-9a-f-]{36})\/file$/i);
  if (mDl && method === "GET") {
    const m = url.searchParams.get("month") ?? today().slice(0, 7);
    try {
      const files = buildBook(mDl[1], m, me.name);
      if (files.length === 1) return download(files[0].name, files[0].data,
        "application/hwp+zip");
      const { zipFiles } = await import("./zip");
      return download(`${m}_기록지_${files.length}장.zip`, zipFiles(files), "application/zip");
    } catch (e: any) { return bad(e.message); }
  }

  /*
   * ── 제공기록지 = **편람 서식3 · 4 · 5** ─────────────────────
   *
   * 제공인력이 집에 돌아와 기억으로 적던 종이입니다. 이제 현장앱이
   * 그 자리에서 찍은 것과 사무실이 창에서 적은 것이 다 모여 있으니,
   * **모인 값을 서식에 꽂기만** 하면 됩니다.
   *
   * 서비스 갈래에 따라 서식이 갈립니다 —
   *   가사 → 서식3 (한 장 6일) · 식사 → 서식4 (한 장 16회차)
   *   동행·이미용 → 서식5 (한 장 5회차)
   * 넘치면 장을 나눠 여러 파일이 되고, 그때는 zip 으로 묶입니다.
   */
  const m기록지 = path.match(/^\/api\/records\/(\d+)\/sheet$/);
  if (m기록지 && method === "GET") {
    if (!can(me, "recipient.viewAll"))
      return bad("제공기록지는 관리자와 사무직원만 뽑습니다.", 403);
    const 달 = url.searchParams.get("month") ?? today().slice(0, 7);
    try {
      const files = 기록지만들기(Number(m기록지[1]), 달);
      if (files.length === 1)
        return download(files[0].name, files[0].data, "application/hwp+zip");
      const { zipFiles } = await import("./zip");
      return download(`${달}_제공기록지_${files.length}장.zip`,
        zipFiles(files), "application/zip");
    } catch (e: any) { return bad(e.message); }
  }

  /*
   * ── 본인부담금 영수증 = **편람 서식7** (B-1) ────────────────
   *
   * `receipt.ts` 가 HTML 로 직접 그리던 것을 **편람 원본을 채우는** 것으로
   * 바꿨습니다. 제출 서류는 **서식이 완전히 같아야 하고 확장자만 달라야**
   * 합니다. 옛 HTML 미리보기(`/api/print/receipt`)는 화면으로 훑어보는
   * 용도로 당분간 남겨 둡니다 — 지자체에 내는 것은 이쪽입니다.
   */
  const m영수증 = path.match(/^\/api\/receipt\/(\d+)\/file$/);
  if (m영수증 && method === "GET") {
    try {
      const v = 영수증모으기(Number(m영수증[1]));
      return download(영수증파일이름(v), 영수증만들기(v), "application/hwp+zip");
    } catch (e: any) { return bad(e.message); }
  }

  /*
   * ── 개인별 서비스 비용총괄 = **편람 서식8** (B-3) ────────────
   *
   * 한 사람의 한 청구 구간치 실적을 **한 줄씩** 적어 군에 냅니다.
   * 담당자·시설장은 화면에서 넘겨받습니다 — 자료함에 없는 값이라
   * 우리가 지어낼 수 없습니다.
   *
   * 실적이 다섯 줄을 넘으면 **표의 칸을 늘립니다.** 전액 자부담인 분은
   * 이 종이를 안 내므로 `모으기` 가 그 자리에서 터집니다.
   */
  const m비용총괄 = path.match(/^\/api\/billing\/(\d+)\/summary-hwpx$/);
  if (m비용총괄 && method === "GET") {
    try {
      const q = url.searchParams;
      /*
       * 담당자는 **지금 뽑는 사람**이 기본입니다 — 군이 연락할 자리라
       * 비워 두면 종이가 반쪽입니다. 시설장은 기관 정보의 대표자
       * (`모으기` 가 그렇게 잡습니다). 화면에서 넘기면 그것이 앞섭니다.
       */
      const v = 비용총괄모으기(Number(m비용총괄[1]), {
        담당자: q.get("staff") || 서류담당자(me).이름,
        시설장: q.get("head") || undefined,
      });
      return download(비용총괄파일이름(v), 비용총괄만들기(v), "application/hwp+zip");
    } catch (e: any) { return bad(e.message); }
  }

  /** 한글이 깔린 PC 에서는 PDF 로도 내려받습니다. */
  const m비용총괄pdf = path.match(/^\/api\/billing\/(\d+)\/summary-pdf$/);
  if (m비용총괄pdf && method === "GET") {
    try {
      const q = url.searchParams;
      const v = 비용총괄모으기(Number(m비용총괄pdf[1]), {
        담당자: q.get("staff") || 서류담당자(me).이름,
        시설장: q.get("head") || undefined,
      });
      const { 변환, 한파일로 } = await import("./hwp2pdf");
      const 이름 = 비용총괄파일이름(v).replace(/\.hwpx$/i, ".pdf");
      const pdfs = await 변환([{ name: 비용총괄파일이름(v), data: 비용총괄만들기(v) }]);
      return download(이름, await 한파일로(pdfs), "application/pdf");
    } catch (e: any) { return bad(e.message); }
  }

  /*
   * ── 서비스 제공·이용 계약서 = **편람 서식2** (B-2) ───────────
   *
   * `contract.ts` 가 PDF 로 직접 그리던 것을 **편람 원본을 채우는** 것으로
   * 바꿨습니다. 담당자·제공인력·계약일은 화면에서 넘겨받습니다 —
   * 자료함에 없는 값이라 우리가 지어낼 수 없습니다.
   */
  const m계약서 = path.match(/^\/api\/contract\/([^/]+)\/hwpx$/);
  if (m계약서 && method === "GET") {
    try {
      const q = url.searchParams;
      /*
       * 담당자는 **지금 뽑는 사람**이 기본입니다 — 어르신이 연락할 자리라
       * 비워 두면 종이가 반쪽입니다. 제공인력은 `모으기` 가 배정에서
       * 꺼내 옵니다(여럿이면 비웁니다). 화면에서 넘기면 그것이 앞섭니다.
       */
      const 담 = 서류담당자(me);
      const v = 계약서모으기(decodeURIComponent(m계약서[1]), {
        계약일: q.get("on") || undefined,
        담당자: q.get("staff") || 담.이름,
        담당자연락처: q.get("staffPhone") || 담.연락처,
        제공인력: q.get("worker") || undefined,
      });
      return download(계약서파일이름(v), 계약서만들기(v), "application/hwp+zip");
    } catch (e: any) { return bad(e.message); }
  }

  /** 한글이 깔린 PC 에서는 PDF 로도 내려받습니다. */
  const m계약서pdf = path.match(/^\/api\/contract\/([^/]+)\/hwpx-pdf$/);
  if (m계약서pdf && method === "GET") {
    try {
      const q = url.searchParams;
      /*
       * 담당자는 **지금 뽑는 사람**이 기본입니다 — 어르신이 연락할 자리라
       * 비워 두면 종이가 반쪽입니다. 제공인력은 `모으기` 가 배정에서
       * 꺼내 옵니다(여럿이면 비웁니다). 화면에서 넘기면 그것이 앞섭니다.
       */
      const 담 = 서류담당자(me);
      const v = 계약서모으기(decodeURIComponent(m계약서pdf[1]), {
        계약일: q.get("on") || undefined,
        담당자: q.get("staff") || 담.이름,
        담당자연락처: q.get("staffPhone") || 담.연락처,
        제공인력: q.get("worker") || undefined,
      });
      const { 변환, 한파일로 } = await import("./hwp2pdf");
      const 이름 = 계약서파일이름(v).replace(/\.hwpx$/i, ".pdf");
      const pdfs = await 변환([{ name: 계약서파일이름(v), data: 계약서만들기(v) }]);
      return download(이름, await 한파일로(pdfs), "application/pdf");
    } catch (e: any) { return bad(e.message); }
  }

  /** 한글이 깔린 PC 에서는 PDF 로도 내려받습니다. */
  const m영수증pdf = path.match(/^\/api\/receipt\/(\d+)\/pdf$/);
  if (m영수증pdf && method === "GET") {
    try {
      const v = 영수증모으기(Number(m영수증pdf[1]));
      const { 변환, 한파일로 } = await import("./hwp2pdf");
      const 이름 = 영수증파일이름(v).replace(/\.hwpx$/i, ".pdf");
      const pdfs = await 변환([{ name: 영수증파일이름(v), data: 영수증만들기(v) }]);
      return download(이름, await 한파일로(pdfs), "application/pdf");
    } catch (e: any) { return bad(e.message); }
  }

  // 그 달 전체 — 지자체에 메일로 보낼 묶음.
  if (path === "/api/recordbook/all" && method === "GET") {
    const m = url.searchParams.get("month") ?? today().slice(0, 7);
    try {
      const r = buildAll(m, me.name);
      return download(r.name, r.zip, "application/zip");
    } catch (e: any) { return bad(e.message); }
  }

  /*
   * 기록지 PDF — **우리가 그리지 않습니다.**
   *
   * 지자체에 내는 서류는 서식이 완전히 같아야 하고 확장자만 달라야 합니다.
   * 그래서 채운 hwpx 를 **한글에게 시켜** PDF 로 바꿉니다.
   * 나오는 파일은 한글에서 「파일 → PDF로 저장」 을 누른 것과 같습니다.
   *
   * 한글이 없는 PC 에서는 못 합니다 — 그때는 hwpx 를 받아 직접 저장하시면 됩니다.
   */
  if (path === "/api/recordbook/pdf-ok" && method === "GET") {
    const { 쓸수있나 } = await import("./hwp2pdf");
    return json(쓸수있나());
  }

  const mBookPdf = path.match(/^\/api\/recordbook\/([0-9a-f-]{36})\/pdf$/i);
  if (mBookPdf && method === "GET") {
    const m = url.searchParams.get("month") ?? today().slice(0, 7);
    try {
      const { 변환, 한파일로 } = await import("./hwp2pdf");
      const 장들 = buildBook(mBookPdf[1], m, me.name);
      const pdfs = await 변환(장들);
      const 이름 = 장들[0].name.replace(/(_\d+)?\.hwpx$/i, ".pdf");
      return download(이름, await 한파일로(pdfs), "application/pdf");
    } catch (e: any) { return bad(e.message); }
  }

  // 그 달 전체를 한 PDF 로 — 메일로 보내고 인쇄를 한 번에 겁니다.
  if (path === "/api/recordbook/all/pdf" && method === "GET") {
    const m = url.searchParams.get("month") ?? today().slice(0, 7);
    try {
      const { 변환, 한파일로 } = await import("./hwp2pdf");
      const r = buildAll(m, me.name);
      const pdfs = await 변환(r.files);
      return download(`${m}_기록지_${pdfs.length}건.pdf`,
                      await 한파일로(pdfs), "application/pdf");
    } catch (e: any) { return bad(e.message); }
  }

  // ── 본인부담금 청구서 (PDF) ────────────────────────────────
  // 어르신께 드리는 종이입니다. 금액이 적히므로 정산과 같은 권한으로 잠급니다.
  if (path.startsWith("/api/invoice")) {
    if (!can(me, "recipient.viewAll"))
      return bad("청구서는 관리자와 사무직원만 뽑을 수 있습니다.", 403);
  }

  const mInv = path.match(/^\/api\/invoice\/([0-9a-f-]{36})\/file$/i);
  if (mInv && method === "GET") {
    const m = url.searchParams.get("month") ?? today().slice(0, 7);
    try {
      const inv = await import("./invoice");
      const r = await inv.build(mInv[1], m);
      return download(r.name, r.pdf, "application/pdf");
    } catch (e: any) { return bad(e.message); }
  }

  // 그 달 전체를 **한 PDF** 로. zip 이 아닙니다 — 인쇄를 한 번에 걸 수 있게.
  if (path === "/api/invoice/all" && method === "GET") {
    const m = url.searchParams.get("month") ?? today().slice(0, 7);
    try {
      const inv = await import("./invoice");
      const r = await inv.buildAll(m);
      return download(r.name, r.pdf, "application/pdf");
    } catch (e: any) { return bad(e.message); }
  }

  // ── 서비스 제공·이용 계약서 (PDF) ──────────────────────────
  if (path.startsWith("/api/contract")) {
    if (!can(me, "recipient.viewAll"))
      return bad("계약서는 관리자와 사무직원만 뽑을 수 있습니다.", 403);
  }

  const mCt = path.match(/^\/api\/contract\/([0-9a-f-]{36})\/file$/i);
  if (mCt && method === "GET") {
    try {
      const ct = await import("./contract");
      const r = await ct.build(mCt[1], {
        계약일: url.searchParams.get("on") ?? undefined,
        담당자: url.searchParams.get("staff") ?? me.name,
        담당자연락처: url.searchParams.get("tel") ?? undefined,
      });
      return download(r.name, r.pdf, "application/pdf");
    } catch (e: any) { return bad(e.message); }
  }

  // 여러 명 한꺼번에 — 「ids=a,b,c」.
  if (path === "/api/contract/all" && method === "GET") {
    const ids = (url.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    try {
      const ct = await import("./contract");
      const r = await ct.buildAll(ids, { 담당자: me.name });
      return download(r.name, r.pdf, "application/pdf");
    } catch (e: any) { return bad(e.message); }
  }

  // ── 정산 ─────────────────────────────────────────────────
  // 돈이 걸린 화면이라 관리자·사무직원만 봅니다.
  if (path.startsWith("/api/billing")) {
    if (!can(me, "recipient.viewAll"))
      return bad("정산은 관리자와 사무직원만 볼 수 있습니다.", 403);
    if (method !== "GET" && !can(me, "recipient.edit"))
      return bad("정산은 관리자와 사무직원만 할 수 있습니다.", 403);
  }

  /*
   * ── 통계 ─────────────────────────────────────────────────
   *
   * 지자체가 묻는 말은 정해져 있습니다 — 계획 대비 실적, 못 간 사유,
   * 사람별 건수, 생애한도. 화면마다 흩어져 있으면 물어볼 때마다 세 곳을
   * 뒤져야 해서 **한 자리에 모읍니다.** 그대로 인쇄해 들고 갑니다.
   */
  if (path === "/api/stats" && method === "GET") {
    if (!can(me, "recipient.viewAll"))
      return bad("통계는 관리자와 사무직원만 볼 수 있습니다.", 403);
    try {
      const 해 = Number(url.searchParams.get("year") ?? today().slice(0, 4));
      const 월원본 = url.searchParams.get("month") ?? "";
      const 월 = 월원본 ? Number(월원본) : null;
      if (!Number.isFinite(해) || 해 < 2000 || 해 > 2100) return bad("해가 잘못되었습니다.");
      if (월 !== null && (!Number.isFinite(월) || 월 < 1 || 월 > 12))
        return bad("월이 잘못되었습니다.");
      return json({ ...해통계(해, 월), 생애한도: 생애한도현황() });
    } catch (e: any) { return bad(e.message); }
  }

  if (path === "/api/billing" && method === "GET") {
    try {
      return json(billMonth(url.searchParams.get("month") ?? today().slice(0, 7), {
        q: url.searchParams.get("q") ?? "",
        dong: url.searchParams.get("dong") ?? "",
        state: url.searchParams.get("state") ?? "",
      }));
    } catch (e: any) { return bad(e.message); }
  }

  const mBillOne = path.match(/^\/api\/billing\/([0-9a-f-]{36})$/i);
  if (mBillOne && method === "GET") {
    try { return json(billOne(mBillOne[1], url.searchParams.get("month") ?? today().slice(0, 7))); }
    catch (e: any) { return bad(e.message, 404); }
  }

  if (path === "/api/billing/issue" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try {
      return json(b.all
        ? issueAll(String(b.month ?? ""), me.name)
        // 시점이 갈린 기관에서는 어느 몫인지까지 받아야 합니다.
        : issue(String(b.recipientId ?? ""), String(b.month ?? ""), me.name, b.kind));
    } catch (e: any) { return bad(e.message); }
  }

  if (path === "/api/billing/pay" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try {
      return json(b.undo ? unpay(Number(b.billId)) : pay(Number(b.billId), b.on));
    } catch (e: any) { return bad(e.message); }
  }

  if (path === "/api/billing/cancel" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try { return json(cancel(Number(b.billId))); }
    catch (e: any) { return bad(e.message); }
  }

  // ── 제공실적 ─────────────────────────────────────────────
  if (path.startsWith("/api/records") && method !== "GET" && !can(me, "recipient.edit"))
    return bad("제공실적은 관리자와 사무직원만 적을 수 있습니다.", 403);

  /*
   * 「지금 받기」 — 우편함에 올라온 현장 보고를 그 자리에서 당겨 옵니다.
   * 저절로 20초마다 도는 것과 같은 일을, 사람이 기다릴 때 앞당기는 것뿐입니다.
   */
  if (path === "/api/records/pull" && method === "POST") {
    try {
      const r = await 지금받기();
      return json({
        ok: true,
        넣은수: r.넣은수, 메모붙인수: r.메모붙인수, 사진수: r.사진수,
      });
    } catch (e: any) {
      return bad(`우편함에서 못 받아 왔습니다 — ${e.message}`);
    }
  }

  if (path === "/api/records" && method === "GET") {
    try {
      const d = recordMonth(url.searchParams.get("month") ?? today().slice(0, 7), {
        q: url.searchParams.get("q") ?? "",
        dong: url.searchParams.get("dong") ?? "",
        workerId: url.searchParams.get("worker") ?? "",
      });
      // 제공인력은 자기에게 배정된 것만 봅니다.
      const items = visibleIds
        ? d.items.filter((x) => visibleIds.has(x.recipientId))
        : d.items;
      return json({
        ...d, items, reasons: REASONS,
        /*
         * 못 간 날의 갈래 (A-3 · 7-아). 화면이 골라 보이게 함께 보냅니다.
         * **어느 사유가 어느 갈래인지도 서버가 정해서 보냅니다** —
         * 화면이 따로 알고 있으면 둘이 어긋나는 날이 옵니다.
         */
        갈래들, 갈래설명,
        사유별갈래: Object.fromEntries(REASONS.map((r) => [r, 기본갈래(r)])),
        today: today(),
      });
    } catch (e: any) { return bad(e.message); }
  }

  if (path === "/api/records/cell" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try {
      const r = setCell(b) as any;
      /*
       * 현장에서 올라온 건을 「계획」으로 되돌렸으면, 그 사실을 폰에
       * **곧장** 알려야 합니다. 10분을 기다리면 그 사이 제공인력이
       * 「전송 완료」인 줄 알고 다음 집으로 갑니다.
       */
      if (r?.현장되돌림) 우편함맞추기();
      return json(r);
    }
    catch (e: any) { return bad(e.message); }
  }

  /*
   * ── 사무실이 **현장 몫을 직접 적습니다** ─────────────────
   *
   * 폰이 고장 났거나, 아직 폰을 안 쓰는 인력이거나, 종이로 적어 온 것을
   * 옮겨야 할 때. 못 적으면 그 달 서식을 통째로 손으로 쓰게 됩니다.
   * 손댄 칸은 「관리자 수정함」으로 남습니다 — 자세한 까닭은 record.ts 에.
   */
  if (path === "/api/records/field" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try {
      const r = 현장적기({
        assignId: Number(b.assignId), on: String(b.on),
        값: b.값 ?? {}, 누가: me?.name,
      });
      return json(r);
    } catch (e: any) { return bad(e.message); }
  }

  /*
   * 사무실 컴퓨터에서 고른 사진을 받습니다.
   *
   * 현장에서 온 것과 **같은 자리**에 둡니다 —
   *   data\사진\<달>\사무실-<배정>-<날>\<번호>.jpg
   * 서식 뒷장에 붙일 때 어디서 왔는지는 상관없고 순서만 맞으면 됩니다.
   */
  if (path === "/api/records/photo" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try {
      const 날 = String(b.on ?? "");
      const 배정 = Number(b.assignId);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(날)) return bad("날짜가 잘못되었습니다.");
      if (!배정) return bad("어느 배정인지가 없습니다.");
      const 그림들: string[] = Array.isArray(b.그림들) ? b.그림들 : [];
      if (그림들.length > 8) return bad("사진은 한 번에 여덟 장까지입니다.");

      const 방 = `사무실-${배정}-${날}`;
      const 둘곳 = join(사진뿌리, 날.slice(0, 7), 방);
      mkdirSync(둘곳, { recursive: true });

      const 자리들: string[] = [];
      그림들.forEach((data, i) => {
        /*
         * ★ 우리가 아는 모양만 받습니다. 아무 글이나 파일로 쓰면
         *   이 PC 에 무엇이든 떨어뜨릴 수 있습니다.
         */
        const m = String(data).match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
        if (!m) throw new Error("사진 모양이 아닙니다.");
        const 바이트 = Buffer.from(m[2], "base64");
        if (바이트.length > 8 * 1024 * 1024)
          throw new Error("사진 한 장이 8MB 를 넘습니다.");
        const 이름 = `${i}.${m[1] === "png" ? "png" : m[1] === "webp" ? "webp" : "jpg"}`;
        writeFileSync(join(둘곳, 이름), 바이트);
        자리들.push(`${날.slice(0, 7)}/${방}/${이름}`);
      });

      const r = 현장적기({
        assignId: 배정, on: 날, 값: { 사진자리: 자리들 }, 누가: me?.name,
      });
      return json({ ...r, 자리들 });
    } catch (e: any) { return bad(e.message); }
  }

  if (path === "/api/records/fill" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try { return json(fillMonth(String(b.month ?? ""), b.assignIds)); }
    catch (e: any) { return bad(e.message); }
  }

  // ── 홈 ───────────────────────────────────────────────────
  if (path === "/api/home" && method === "GET") {
    if (!can(me, "recipient.viewAll"))
      return bad("홈 화면은 관리자와 사무직원만 볼 수 있습니다.", 403);
    // 포스트잇은 화면이 따로 불러옵니다(/api/sticky).
    // 홈은 「오늘 손댈 것」만 셉니다 — 두 곳에서 같은 것을 세면 어긋납니다.
    return json(home());
  }

  // ── 포스트잇 ─────────────────────────────────────────────
  /*
   * 메모장은 **지금은 관리자만**입니다.
   *
   * 메모에는 표에 안 들어가는 말이 오갑니다. 누가 볼 수 있는지 정해 두지 않은 채
   * 열어 두면 적어서는 안 될 것이 적힙니다. 좁게 열었다 넓히기는 쉽고,
   * 넓게 열었다 좁히기는 어렵습니다.
   *
   * 누구에게 열지는 **perm.ts 의 "memo.use" 한 줄**에서 정합니다.
   * 현장앱을 만들 때 권한을 다시 손보기로 했습니다.
   */
  if (path.startsWith("/api/sticky") && !can(me, "memo.use"))
    return bad("메모장은 관리자만 쓸 수 있습니다.", 403);

  if (path === "/api/sticky" && method === "GET") {
    /*
     * 보드는 여러 장입니다.
     *   board 없음      기관 보드 (대상자에 안 매인 것)
     *   board=<uuid>    그 대상자의 보드
     * 섞어 보내면 김순자 어르신 화면에 남의 쪽지가 스무 장 뜹니다.
     */
    const board = url.searchParams.get("board") ?? "";
    if (board && board !== "__all" && visibleIds && !visibleIds.has(board))
      return bad("배정된 대상자만 볼 수 있습니다.", 403);
    const 보드이름 = board && board !== "__all"
      ? JSON.parse((db.query<{ payload: string }, [string]>(
          "SELECT payload FROM recipient WHERE id = ?"
        ).get(board)?.payload) || "{}").name ?? ""
      : "";
    return json({
      board, boardName: 보드이름,
      items: listStickies({ done: url.searchParams.get("done") === "1", board }),
      counts: stickyCounts(board),
      // 기관 보드만 보는 사람에게 「대상자 쪽지가 있다」는 사실은 보여야 합니다.
      // 안 그러면 붙여 놓고 잊습니다 — 그러면 종이만도 못합니다.
      byRecipient: 대상자보드요약(),
      colors: COLORS,
      // 보드가 지키는 규칙(최소·최대 크기, 눈금, 틈)을 화면에도 같은 값으로 보냅니다.
      // 두 곳에 따로 적어 두면 반드시 어긋나는 날이 옵니다.
      rules: 자리규칙,
      // 뗀 메모가 며칠 뒤에 스스로 사라지는가. 화면 안내문에 씁니다 —
      // 「30일」을 화면에 손으로 적어 두면 서버에서 바꿔도 안내문이 안 따라옵니다.
      보관일수,
      // 화면이 「지움」 단추를 보일지 정하는 데 씁니다.
      // 감추는 것은 막는 것이 아닙니다 — 진짜 잠금은 sticky.ts 안에 있습니다.
      me: { id: me.id, name: me.name, isAdmin: can(me, "staff.account") },
    });
  }
  if (path === "/api/sticky" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    /*
     * ★ `저절로` 는 **프로그램이 스스로 붙일 때만** 씁니다 (메모지를
     *   글에 맞게 크게 만드는 표). 화면에서 온 것은 손으로 적은 것이라
     *   여기서 떼어 냅니다 — 안 떼면 화면이 아무 크기나 정할 수 있고,
     *   그러면 「내가 정한 크기」와 「프로그램이 정한 크기」가 섞입니다.
     */
    delete (b as any).저절로;
    try { return json(addSticky(b, me)); }
    catch (e: any) { return bad(e.message); }
  }
  const mSticky = path.match(/^\/api\/sticky\/(\d+)(\/done|\/place)?$/);
  if (mSticky) {
    const id = Number(mSticky[1]);
    const b = await req.json().catch(() => ({} as any));
    try {
      if (mSticky[2] === "/done" && method === "POST") return json(setDone(id, !!b.done, me));
      // 자리 옮기기는 누구나 — 벽에 붙은 종이를 옆으로 옮기는 데 주인 허락을 받지는 않습니다.
      if (mSticky[2] === "/place" && method === "POST") return json(placeSticky(id, b, me));
      if (method === "PATCH") return json(updateSticky(id, b, me));
      if (method === "DELETE") return json(removeSticky(id, me));
    } catch (e: any) { return bad(e.message); }
  }

  const mExtend = path.match(/^\/api\/recipients\/([0-9a-f-]{36})\/extend$/i);
  if (mExtend && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try {
      return json(extend(mExtend[1], String(b.until ?? ""), String(b.reason ?? ""), me.name));
    } catch (e: any) { return bad(e.message); }
  }

  // ── 배정 · 주간계획 ──────────────────────────────────────
  if (path === "/api/assign" && method === "GET") {
    const items = listAssign({
      q: url.searchParams.get("q") ?? "",
      state: url.searchParams.get("state") ?? "",
      dong: url.searchParams.get("dong") ?? "",
      service: url.searchParams.get("service") ?? "",
      workerId: url.searchParams.get("worker") ?? "",
    });
    const all = listAssign({ state: "__all" });
    return json({
      items: visibleIds ? items.filter((x) => visibleIds.has(x.recipientId)) : items,
      dongs: [...new Set(all.map((x) => x.dong).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "ko")),
      services: [...new Map(all.map((x) => [x.serviceId, x.service])).entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, "ko")),
      workers: workerOptions(),
      // 받는 서비스가 없어 이 목록에 아예 못 뜨는 대상자 수.
      // 빈 화면에서 「대상자는 있는데 서비스가 없다」를 구분해 말하려고 셉니다.
      서비스없는대상자: 서비스없는대상자수(),
      // 화면 맨 위에 "아직 n건 남았습니다"를 띄우기 위한 셈입니다.
      tally: Object.fromEntries([
        ["all", all.length],
        ...["미배정", "계획없음", "확인필요", "배정됨", "지난의뢰", "종결자", "중단중"]
          .map((s) => [s, all.filter((x) => x.state === s).length]),
      ]),
    });
  }

  const mAssign = path.match(/^\/api\/assign\/([0-9a-f-]{36})\/(\d+)$/i);
  if (mAssign && method === "GET") {
    if (visibleIds && !visibleIds.has(mAssign[1]))
      return bad("배정된 대상자만 볼 수 있습니다.", 403);
    try { return json(assignDetail(mAssign[1], Number(mAssign[2]))); }
    catch (e: any) { return bad(e.message, 404); }
  }

  if (path === "/api/assign" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try { return json(saveAssign(b)); }
    catch (e: any) { return bad(e.message); }
  }

  /*
   * ── 계획을 **저장하기 전에** 재 봅니다 ─────────────────────
   *
   * (2026-09-07 무무 — 계획 수립 시 100%가 넘어가는 계획이 수립되면
   *  경고창을 띄우자)
   *
   * **아무것도 바꾸지 않습니다.** 재기만 합니다. 화면이 요일이나
   * 시간을 건드릴 때마다 부르므로, 자료함에 손대는 일이 있으면 안 됩니다.
   */
  if (path === "/api/assign/preview" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try {
      return json(계획재기(
        String(b.recipientId ?? ""), Number(b.serviceId ?? 0),
        Array.isArray(b.slots) ? b.slots : [],
        { 배정번호: b.assignId ?? null, from: b.from ?? null, to: b.to ?? null,
          달몇번: Number(b.달몇번 ?? 0) || 0 }
      ));
    } catch (e: any) { return bad(e.message); }
  }

  // 이 담당이 요일마다 이미 몇 곳을 도는지. 고르는 중에 보여 줍니다.
  if (path === "/api/assign/load" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    return json(workerDayLoad(
      Number(b.userId), b.from ?? null, b.to ?? null, b.exceptId ?? null
    ));
  }

  const mDel = path.match(/^\/api\/assign\/(\d+)$/);
  if (mDel && method === "DELETE") {
    try { return json(removeAssign(Number(mDel[1]))); }
    catch (e: any) { return bad(e.message); }
  }

  // ── 의뢰 인박스 ──────────────────────────────────────────
  if (path === "/api/referrals/preview" && method === "POST") {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return bad("엑셀 파일을 골라 주세요.");
    if (file.size > 20_000_000) return bad("파일이 너무 큽니다 (20MB 넘음).");

    const buf = Buffer.from(await file.arrayBuffer());
    const password = String(form?.get("password") ?? "") || undefined;

    try {
      return json(preview(buf, password));
    } catch (e: any) {
      if (e instanceof WrongPassword) return bad(e.message, 401);
      return bad(e.message ?? "파일을 읽지 못했습니다.");
    }
  }

  if (path === "/api/referrals/fix" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try {
      return json(fixReferral(String(b.token ?? ""), Number(b.row), String(b.sheet ?? ""), b));
    } catch (e: any) {
      return bad(e.message ?? "고치지 못했습니다.");
    }
  }

  if (path === "/api/referrals/apply" && method === "POST") {
    const b = await req.json().catch(() => ({} as any));
    try {
      return json(applyReferrals(String(b.token ?? ""), b.skip ?? [], me.name));
    } catch (e: any) {
      return bad(e.message ?? "반영하지 못했습니다.");
    }
  }

  if (path === "/api/referrals/batches" && method === "GET") {
    const rows = db.query(
      `SELECT batch_label AS label, COUNT(*) AS lines,
              COUNT(DISTINCT recipient_id) AS people, MIN(created_at) AS at
         FROM referral GROUP BY batch_label ORDER BY MIN(created_at) DESC`
    ).all();
    return json({ batches: rows });
  }

  // ── 영수증 (브라우저에서 열어 인쇄·PDF 저장) ─────────────
  /*
   * ── 방문표 인쇄 (C-2-d ①) ─────────────────────────────────
   *
   *   /api/print/visit?ids=<uuid>,<uuid>    고른 사람만
   *   /api/print/visit?all=1                「이용」 중인 분 전부
   *
   * 새 창에 뜨는 **종이 화면**입니다. 그래서 JSON 이 아니라 HTML 로
   * 나갑니다 — 관리자가 브라우저 인쇄를 바로 걸 수 있어야 합니다.
   *
   * ★ 볼 수 있는 사람만. 제공인력은 자기가 맡은 분만 보이는데,
   *   그 규칙이 여기서 새면 남의 담당 어르신 이름이 종이로 나갑니다.
   */
  /*
   * ── 현장에서 온 사진 한 장 ─────────────────────────────────
   *
   *   /api/photo/2026-09/<보고번호>/<사진번호>.jpg
   *
   * 제공실적 창에서 그림으로 띄웁니다.
   *
   * ★ 자리를 그대로 파일 경로로 쓰지 않습니다.
   *   `../../` 같은 것을 섞어 보내면 이 PC 의 아무 파일이나 내보내게
   *   됩니다. 그래서 **자료함에 적혀 있는 자리와 똑같은 것만** 내보냅니다 —
   *   글자를 거르는 대신 **아는 것만 내보내는** 쪽이 확실합니다.
   */
  if (path.startsWith("/api/photo/") && method === "GET") {
    const 찾는자리 = decodeURIComponent(path.slice("/api/photo/".length));
    const 있나 = db.query<{ payload: string }, [string]>(
      `SELECT payload FROM delivery WHERE payload LIKE ? LIMIT 1`,
    ).get(`%${찾는자리}%`);
    if (!있나) return bad("그런 사진이 없습니다.", 404);

    // LIKE 로 찾은 것이라 한 번 더 정확히 맞춰 봅니다.
    let 맞나 = false;
    try {
      for (const x of (JSON.parse(있나.payload)?.현장?.사진 ?? []))
        if (x?.자리 === 찾는자리) 맞나 = true;
    } catch { }
    if (!맞나) return bad("그런 사진이 없습니다.", 404);

    const 파일 = join(사진뿌리, 찾는자리);
    if (!existsSync(파일)) return bad("사진 파일이 없습니다.", 404);
    return new Response(readFileSync(파일), {
      headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=3600" },
    });
  }

  if (path === "/api/print/visit" && method === "GET") {
    const 볼수있는것 = visibleRecipientIds(me);
    const 고른것 = (url.searchParams.get("ids") || "")
      .split(",").map((x) => x.trim()).filter(Boolean);
    const 뽑을것 = url.searchParams.get("all") === "1" ? 이용중인분들() : 고른것;

    // null = 다 볼 수 있는 사람(관리자). 그 밖에는 걸러 냅니다.
    const 걸른것 = 볼수있는것 === null
      ? 뽑을것
      : 뽑을것.filter((id) => 볼수있는것.has(id));

    // 기관 전화를 같이 찍습니다 — 어르신이나 가족이 「이게 뭐냐」고
    // 물어볼 데가 종이 위에 있어야 떼지 않으십니다.
    const org = db.query<{ name: string; phone: string | null }, []>(
      "SELECT name, phone FROM organization WHERE id = 1").get();
    const 화면 = 방문표화면(await 방문표여럿(걸른것), org?.name ?? "", org?.phone ?? "");
    return new Response(화면, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  if (path === "/api/print/receipt" && method === "GET") {
    const org = db.query("SELECT * FROM organization WHERE id = 1").get() as any;
    const profile = db
      .query("SELECT * FROM region_profile WHERE id = ?")
      .get(org?.profile_id) as any;
    const rounding = {
      unit: profile?.rounding_unit ?? 10,
      mode: (profile?.rounding_mode ?? "round") as "round" | "ceil" | "floor",
    };

    // 대상자를 지정하지 않으면 이용 중인 첫 사람으로 보여줍니다.
    // 미리보기에 '○○○' 대신 실제 이름이 나와야 확인이 됩니다.
    const id = url.searchParams.get("recipient");
    const pick = `SELECT r.*, t.label AS copay_label, t.rate AS copay_rate
                    FROM recipient r LEFT JOIN copay_tier t ON t.id = r.copay_tier_id`;
    const row = (id
      ? db.query(`${pick} WHERE r.id = ?`).get(id)
      : db.query(`${pick} WHERE r.status = '이용' ORDER BY r.created_at LIMIT 1`).get()
    ) as any;
    const p = row ? JSON.parse(row.payload || "{}") : {};

    // 아직 정산 화면이 없으므로 금액은 견본입니다(단계 4에서 실제 실적으로 바뀝니다).
    const svc = db
      .query<{ name: string; unit_price: number }, [number]>(
        "SELECT name, unit_price FROM service WHERE profile_id = ? ORDER BY sort_order"
      )
      .all(profile?.id);
    const meal = svc.find((s) => s.name === "식사지원");
    const hair = svc.find((s) => s.name === "이미용서비스");

    const html = receiptHtml({
      org,
      no: `${today().slice(0, 4)}-0001`,
      issuedOn: korDate(today()),
      method: "계좌이체",
      recipient: { name: p.name ?? "○○○", birth: p.birth ?? "" },
      copayLabel: row?.copay_label ?? "본인부담금 20%",
      copayRate: row?.copay_rate ?? 0.2,
      lines: [
        { name: meal?.name ?? "식사지원", from: "2026. 7. 1.", to: "7. 31.",
          count: 16, unitPrice: meal?.unit_price ?? 11000 },
        { name: hair?.name ?? "이미용서비스", from: "2026. 7. 24.",
          count: 1, unitPrice: hair?.unit_price ?? 24000 },
      ],
      rounding,
      sample: true,
    });

    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  /*
   * ── 연속 비대면 배달 다시 세기 (계약서 5-2조) ─────────────
   *
   * **손으로 세는 칸이 아닙니다.** 2026-09-01 이전에는 이 자리에서
   * 「미수령 기록」 단추로 숫자를 직접 올렸는데, 두 가지가 틀렸습니다 —
   *
   *   ① 세던 것이 **미제공 연속**이었습니다. 편람이 세는 것은
   *      **비대면 배달 연속**입니다. 안 간 것과 놓고 온 것은 다른 일입니다.
   *   ② 손으로 올린 숫자를 다음 식사 실적이 들어올 때
   *      `syncMeal()` 이 **말없이 덮어썼습니다.**
   *
   * 이제 숫자는 **실적에서만** 나옵니다. 실적 달력의 식사지원 칸에서
   * 「비대면」으로 찍으면 여기 셈이 따라옵니다. 이 주소는 그 셈을
   * **다시 돌리는** 것뿐입니다 (자료를 밖에서 손댔을 때 쓰라고 남겨 둡니다).
   */
  const mNoShow = path.match(/^\/api\/recipients\/([0-9a-f-]{36})\/noshow$/i);
  if (mNoShow && method === "POST") {
    const id = mNoShow[1];
    const 있나 = db.query<{ id: string }, [string]>(
      "SELECT id FROM recipient WHERE id = ?").get(id);
    if (!있나) return bad("대상자를 찾을 수 없습니다.", 404);

    const x = 비대면다시셈(id);
    return json({
      ok: true,
      noShowStreak: x.연속,
      lastNoShowOn: x.마지막,
      limit: x.한계,
      warn: x.경고,
      reached: x.닿음,
      // 세는 것은 둘 다 내보냅니다. 판단만 설정한 방식으로 합니다 (v33).
      mode: x.방식,
      counted: x.볼값,
      cumulative: x.누적,
      message: x.닿음
        ? `${x.방식} ${x.볼값}회 비대면 배달입니다. 계약서 5-2조에 따라 통합돌봄 서비스 전체가 중지 대상입니다. 지자체와 협의가 필요합니다.`
        : x.경고
        ? `${x.방식} ${x.볼값}회 비대면 배달입니다. 한 번 더면 서비스 전체가 중지됩니다. 지금 연락하세요.`
        : x.볼값 > 0
        ? `${x.방식} ${x.볼값}회 비대면 배달입니다.`
        : `${x.방식} 비대면 배달이 없습니다. 실적을 다시 세었습니다.`,
    });
  }

  return bad("없는 주소입니다.", 404);
}
