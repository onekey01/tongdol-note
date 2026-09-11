import { 주소한줄 } from "./util";
import { db } from "./db";
import { hashPassword } from "./auth";
import { today, daysUntil, calcAge, parseSlots, slotText } from "./util";

/**
 * 인력 — 기관에서 일하는 사람 전부.
 *
 * ── 왜 한 곳에서 관리하는가 ────────────────────────────────
 * 관리자가 제공인력을 겸하는 경우가 실제로 있습니다.
 * 관리자 명단과 제공인력 명단을 따로 두면 같은 사람이 두 번 등록되고,
 * 그러면 인건비가 두 번 잡히거나 실적이 갈라집니다.
 *
 * → **사람은 하나(app_user), 역할만 여러 개(roles).**
 *
 * 역할
 *   admin   관리자   — 전부 다룸
 *   staff   사무직원 — 배송·일지 작성 등
 *   worker  제공인력 — 현장에서 서비스를 제공
 *   vendor  외부업체 — 환경개선 등 위탁
 *
 * 제공인력에게만 필요한 것(자격·교육·보험·임금 제외 여부)은 worker 표에 둡니다.
 * roles 에 worker 가 있으면 worker 줄이 딸려 생깁니다.
 */

export const ROLES = ["admin", "staff", "worker", "vendor"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_KO: Record<Role, string> = {
  admin: "관리자",
  staff: "사무직원",
  worker: "제공인력",
  vendor: "외부업체",
};

export function parseRoles(v: unknown): Role[] {
  // 옛 자료함은 role 칸에 "admin" 한 글자만 들어 있습니다.
  // JSON 으로 읽으려다 실패하면 조용히 '사무직원'이 되어 버리므로
  // 홑 이름은 먼저 걸러 냅니다. 권한이 조용히 낮아지는 것이 제일 나쁩니다.
  if (typeof v === "string" && (ROLES as readonly string[]).includes(v))
    return [v as Role];
  try {
    const list = typeof v === "string" ? JSON.parse(v) : v;
    /*
     * ★ **JSON 으로 싸인 홑 이름도 알아봅니다** (2026-09-08 에 찾음).
     *
     *   `'"admin"'` 처럼 따옴표까지 저장된 줄이 실제로 있었습니다.
     *   여기서 그것을 못 알아보면 **조용히 사무직원으로 낮아지는데**,
     *   같은 줄을 SQL 의 `roles LIKE '%admin%'` 는 관리자로 셉니다.
     *   두 곳이 서로 다른 답을 내는 순간 「관리자가 한 명은 있어야
     *   합니다」가 뚫립니다 — 실제로 뚫렸습니다.
     */
    if (typeof list === "string" && (ROLES as readonly string[]).includes(list))
      return [list as Role];
    const ok = (Array.isArray(list) ? list : []).filter((r): r is Role =>
      (ROLES as readonly string[]).includes(r)
    );
    return ok.length ? [...new Set(ok)] : ["staff"];
  } catch {
    return ["staff"];
  }
}

export function hasRole(user: any, role: Role): boolean {
  return parseRoles(user?.roles).includes(role);
}

/**
 * 주소에서 읍·면·동을 뽑습니다.
 *
 * 읍면동을 따로 받지 않는 이유는 간단합니다 — **주소 안에 이미 있습니다.**
 * 두 칸에 나눠 받으면 한쪽만 고쳐 놓고 둘이 어긋나는 날이 옵니다.
 *
 *   "전남 해남군 해남읍 수성리 18"  → 해남읍
 *   "전남 해남군 문내면 ..."        → 문내면
 *   "광주 동구 지산동 12-3"         → 지산동
 *
 * 못 찾으면 빈 값입니다. 목록에서 「—」로 보이고 그뿐입니다.
 * 배정 거리를 따질 때 쓰는 값이라 없다고 일이 막히지는 않습니다.
 */
export function dongOf(address: string): string {
  const s = String(address ?? "").replace(/\s+/g, " ").trim();
  const m = s.match(/[가-힣]{1,6}(?:읍|면|동)(?:\s?\d+가)?/);
  return m ? m[0] : "";
}

// ── 목록 ───────────────────────────────────────────────────
export function listStaff(opts: { q?: string; role?: string; includeResigned?: boolean } = {}) {
  const rows = db.query(
    `SELECT u.id, u.login_id, u.name, u.phone, u.role, u.roles, u.status, u.resigned_at,
            u.leave_from, u.leave_to, u.leave_reason,
            u.created_at, u.payload, u.dong, u.hired_on, u.contract_on,
            w.id AS worker_id, w.emp_no,
            w.qualifications, w.trainings,
            w.geo_consent, w.payroll_excluded, w.exclude_reason, w.note,
            (SELECT COUNT(*) FROM assignment a
               JOIN recipient r2 ON r2.id = a.recipient_id
              WHERE a.worker_id = w.id
                AND r2.status NOT IN ('종결','취소','직권중단')
                AND (a.period_to IS NULL OR a.period_to >= date('now','localtime'))) AS match_now,
            (SELECT COUNT(*) FROM assignment a WHERE a.worker_id = w.id) AS match_all
       FROM app_user u
       LEFT JOIN worker w ON w.user_id = u.id
      ORDER BY u.name`
  ).all() as any[];

  const q = (opts.q ?? "").trim().toLowerCase();
  return rows
    .map(shapeStaff)
    // 휴직자는 **기본 목록에 남습니다.** 쉬고 있을 뿐 우리 사람입니다.
    // 나가신 분(resigned)만 감춥니다.
    .filter((s) => (opts.includeResigned ? true : s.status !== "resigned"))
    .filter((s) => (opts.role ? s.roles.includes(opts.role as Role) : true))
    .filter((s) =>
      !q ||
      [s.name, s.loginId, s.phone, s.empNo, s.dong, s.address]
        .some((v) => String(v ?? "").toLowerCase().includes(q))
    );
}

/**
 * 자격·교육은 줄 단위로 쌓입니다.
 *   자격  { name 자격명, no 번호, on 취득일 }
 *   교육  { name 교육명, on 이수일, hours 시간 }
 * 옛 자료가 문자열 배열이면 이름만 있는 줄로 바꿔 읽습니다.
 */
function objList(v: unknown): Record<string, string>[] {
  try {
    const list = typeof v === "string" ? JSON.parse(v) : v;
    if (!Array.isArray(list)) return [];
    return list
      .map((x) => (typeof x === "string" ? { name: x } : x))
      .filter((x) => x && typeof x === "object" && String(x.name ?? "").trim())
      .map((x) => ({
        name: String(x.name ?? "").trim(),
        no: String(x.no ?? "").trim(),
        on: String(x.on ?? "").trim(),
        hours: String(x.hours ?? "").trim(),
      }));
  } catch {
    return [];
  }
}

function jsonList(v: unknown): string[] {
  try {
    const list = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(list) ? list.map(String).filter(Boolean) : [];
  } catch {
    return String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }
}

export function shapeStaff(r: any) {
  const roles = parseRoles(r.roles ?? r.role);
  const p = JSON.parse(r.payload || "{}");
  return {
    id: r.id,
    loginId: r.login_id,
    name: r.name,
    phone: r.phone ?? "",
    roles,
    rolesKo: roles.map((x) => ROLE_KO[x]),
    status: r.status,
    statusKo: r.status === "resigned" ? "퇴직" : r.status === "leave" ? "휴직" : "재직",
    resignedAt: r.resigned_at ?? null,
    onLeave: r.status === "leave",
    leaveFrom: r.leave_from ?? "",
    leaveTo: r.leave_to ?? "",
    leaveReason: r.leave_reason ?? "",
    createdAt: r.created_at,

    isWorker: roles.includes("worker"),
    workerId: r.worker_id ?? null,
    empNo: r.emp_no ?? "",
    hiredOn: r.hired_on ?? "",
    contractOn: r.contract_on ?? "",

    // 제공인력의 개인정보도 대상자와 같은 방식으로 payload 한 칸에 모읍니다.
    // 나중에 이 칸만 암호문으로 바꾸면 전환이 끝납니다.
    birth: p.birth ?? "",
    age: calcAge(p.birth),
    /* 도로명 + 상세를 합친 것. 목록·명부에 나가는 값입니다. */
    address: 주소한줄(p),
    addressRoad: p.address ?? "",
    addressDetail: p.addressDetail ?? "",
    dong: r.dong ?? "",

    qualifications: objList(r.qualifications),
    trainings: objList(r.trainings),
    geoConsent: !!r.geo_consent,

    // 배정(매칭). 배정 화면이 붙기 전에는 0 입니다.
    matchNow: r.match_now ?? 0,
    matchAll: r.match_all ?? 0,

    // 이미 채용된 직원이 이 사업을 거드는 경우.
    // 실적과 일지는 그대로 쌓고 임금 계산에서만 뺍니다.
    payrollExcluded: !!r.payroll_excluded,
    excludeReason: r.exclude_reason ?? "",
    note: r.note ?? "",
  };
}

// ── 만들기 · 고치기 ────────────────────────────────────────
type Row = { name?: string; no?: string; on?: string; hours?: string };
type Input = {
  name?: string;
  loginId?: string;
  password?: string;
  phone?: string;
  roles?: string[];
  birth?: string;
  address?: string;
  addressDetail?: string;
  empNo?: string;
  hiredOn?: string;
  contractOn?: string;
  qualifications?: Row[];
  trainings?: Row[];
  payrollExcluded?: boolean;
  excludeReason?: string;
  note?: string;
};

/** 빈 줄은 버리고 저장합니다. 화면에서는 빈 줄을 하나 띄워 두기 때문입니다. */
function cleanRows(list: Row[] | undefined): Row[] {
  return (list ?? [])
    .map((x) => ({
      name: String(x?.name ?? "").trim(),
      no: String(x?.no ?? "").trim(),
      on: String(x?.on ?? "").trim(),
      hours: String(x?.hours ?? "").trim(),
    }))
    .filter((x) => x.name);
}

/*
 * ── 관리자는 **한 명뿐입니다** ─────────────────────────────
 *
 * (2026-09-08 무무 — 「관리자는 현재는 1명으로 제한 해야해. 추후에
 *  관리자를 추가하는 경우엔 **PC 백업 문제 등 얽히는 문제들**이 다수
 *  발생할 여지가 있어서 제한 하는게 맞을 것 같아.」)
 *
 * 왜 얽히는가 — 이 프로그램의 자료는 **그 PC 한 대**에 있습니다. 관리자가
 * 둘이면 백업을 각자 다른 곳에 뜨고, USB 를 각자 들고 다니고, 둘 다
 * 「내가 마지막에 적은 것이 맞다」고 여깁니다. 그 순간 **어느 자료함이
 * 진짜인지 아무도 모릅니다.** 자리를 하나로 묶어 두면 그 갈래가 아예
 * 안 생깁니다.
 *
 * 바닥(한 명은 있어야)은 이미 세 군데에 있었습니다 — 여기서 얹는 것은
 * **천장**입니다. 둘을 같이 두면 관리자 수는 늘 정확히 1 입니다.
 *
 * 대신 **넘기는 길**을 반드시 함께 둡니다 (`관리자넘기기`). 없으면
 * 관리자가 그만두는 날 기관이 통째로 잠깁니다 — 천장만 세우는 것이
 * 더 위험합니다.
 */
export function 관리자들(빼고?: number): { id: number; name: string }[] {
  return db.query<any, []>(
    `SELECT id, name, roles, role FROM app_user WHERE status = 'active'`).all()
    .filter((r) => parseRoles(r.roles ?? r.role).includes("admin"))
    .filter((r) => 빼고 === undefined || Number(r.id) !== Number(빼고))
    .map((r) => ({ id: Number(r.id), name: String(r.name ?? "") }));
}

/** 이 사람에게 관리자를 주면 둘이 되는가. 되면 던집니다. */
function 천장확인(새역할: Role[], 이사람?: number) {
  if (!새역할.includes("admin")) return;
  const 남은 = 관리자들(이사람);
  if (남은.length === 0) return;
  throw new Error(
    `관리자는 한 명뿐입니다 \u2014 지금은 ${남은[0].name} 님입니다.\n` +
    `자리를 넘기시려면 종사자 화면에서 「관리자 넘기기」를 쓰세요. ` +
    `앞사람은 그 자리에서 사무직원이 됩니다.`
  );
}

/**
 * ── 관리자 넘기기 ─────────────────────────────────────────
 *
 * **한 번에 넘깁니다.** 「내려놓기」와 「지정하기」를 따로 두면 그 사이에
 * 관리자가 0 명이거나 2 명인 순간이 생깁니다. 그 순간에 창이 닫히거나
 * 정전이 나면 기관이 잠깁니다.
 *
 * 넘긴 사람은 **사무직원**이 됩니다. 아예 역할을 비우면 그 사람이 화면에
 * 못 들어가고, 방금까지 관리자였던 사람이 갑자기 아무것도 못 하는 것은
 * 놀랄 일입니다.
 */
export function 관리자넘기기(주는이: number, 받는이: number): { 준이: string; 받은이: string } {
  if (Number(주는이) === Number(받는이)) throw new Error("자기 자신에게는 넘길 수 없습니다.");
  const 준 = db.query<any, [number]>("SELECT * FROM app_user WHERE id = ?").get(주는이);
  const 받 = db.query<any, [number]>("SELECT * FROM app_user WHERE id = ?").get(받는이);
  if (!준) throw new Error("넘기는 분을 찾을 수 없습니다.");
  if (!받) throw new Error("받을 분을 찾을 수 없습니다.");
  if (!parseRoles(준.roles ?? 준.role).includes("admin"))
    throw new Error("관리자만 자리를 넘길 수 있습니다.");
  if (받.status !== "active")
    throw new Error("지금 다니고 있는 분에게만 넘길 수 있습니다.");

  const 준역할 = parseRoles(준.roles ?? 준.role).filter((r) => r !== "admin");
  if (!준역할.includes("staff")) 준역할.push("staff");
  const 받역할 = parseRoles(받.roles ?? 받.role);
  if (!받역할.includes("admin")) 받역할.unshift("admin");

  /*
   * ★ **한 덩어리로 씁니다.** 가운데서 끊기면 관리자가 없거나 둘이 됩니다.
   */
  db.transaction(() => {
    db.run("UPDATE app_user SET role = ?, roles = ? WHERE id = ?",
      [준역할[0], JSON.stringify(준역할), 주는이]);
    db.run("UPDATE app_user SET role = ?, roles = ? WHERE id = ?",
      [받역할[0], JSON.stringify(받역할), 받는이]);
  })();

  const 남은 = 관리자들();
  if (남은.length !== 1)
    throw new Error(`넘긴 뒤 관리자가 ${남은.length}명이 되었습니다. 만든 사람에게 알려 주세요.`);
  return { 준이: String(준.name ?? ""), 받은이: String(받.name ?? "") };
}

export async function createStaff(b: Input) {
  const name = (b.name ?? "").trim();
  const loginId = (b.loginId ?? "").trim();
  if (!name) throw new Error("성명을 입력해 주세요.");
  if (!loginId) throw new Error("아이디를 입력해 주세요.");
  if (!b.password || String(b.password).length < 4)
    throw new Error("비밀번호는 4자 이상으로 정해 주세요.");

  const dup = db.query("SELECT id FROM app_user WHERE login_id = ?").get(loginId);
  if (dup) throw new Error("이미 쓰고 있는 아이디입니다.");

  const roles = parseRoles(b.roles);
  천장확인(roles);                    // 관리자는 한 명뿐입니다
  const now = new Date().toISOString();
  const hash = await hashPassword(String(b.password));

  const info = db.run(
    `INSERT INTO app_user
       (login_id, pw_hash, name, phone, role, roles,
        payload, dong, hired_on, contract_on, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [
      loginId, hash, name, b.phone ?? "", roles[0], JSON.stringify(roles),
      /*
       * 읍면동은 **도로명만** 보고 뽑습니다.
       * 상세주소는 주소 체계의 일부가 아니라 **사람이 자유롭게 적는 메모**입니다.
       * 무슨 글자가 들어올지 모르는 값을 자동 해석에 넣지 않습니다.
       */
      personPayload(b), dongOf(b.address ?? ""),
      b.hiredOn ?? "", b.contractOn ?? "", now,
    ]
  );
  const id = Number(info.lastInsertRowid);
  syncWorker(id, roles, b, now);
  return id;
}

/** 생년월일·주소는 한 칸(payload)에 모읍니다. 나중에 이 칸만 암호문으로 바꿉니다. */
function personPayload(b: Input) {
  return JSON.stringify({
    birth: (b.birth ?? "").trim(),
    address: (b.address ?? "").trim(),
    addressDetail: (b.addressDetail ?? "").trim(),
  });
}

/**
 * **적어 보내지 않은 칸은 건드리지 않습니다.**
 *
 * 화면은 늘 한 벌을 통째로 보내지만, 앞으로 붙을 현장앱이나 일괄 처리는
 * 「연락처만」 같이 일부만 보낼 수 있습니다. 그때 나머지가 빈칸으로 밀리면
 * 주소와 생년월일이 소리 없이 지워집니다. 사람 정보가 그렇게 사라지면
 * 언제 없어졌는지도 모릅니다.
 */
const keep = <T,>(sent: T | undefined, cur: T): T => (sent === undefined ? cur : sent);

/**
 * 고치기.
 *
 * limited = true 이면 **본인이 자기 정보를 고치는 경우**입니다.
 * 성명·연락처·생년월일·주소까지만 바뀌고, 아이디·비밀번호·역할은 손대지 못합니다.
 * 제공인력이 스스로 관리자가 되어 버리면 잠금장치가 없는 것과 같기 때문입니다.
 */
export async function updateStaff(id: number, b: Input, opts: { limited?: boolean } = {}) {
  const cur = db.query<any, [number]>("SELECT * FROM app_user WHERE id = ?").get(id);
  if (!cur) throw new Error("그 사람을 찾을 수 없습니다.");

  const name = keep(b.name, cur.name as string).trim();
  if (!name) throw new Error("성명을 입력해 주세요.");

  const curP = JSON.parse(cur.payload || "{}");
  const merged: Input = {
    birth: keep(b.birth, curP.birth ?? ""),
    address: keep(b.address, curP.address ?? ""),
    addressDetail: keep(b.addressDetail, curP.addressDetail ?? ""),
  };
  const phone = keep(b.phone, cur.phone ?? "");

  if (opts.limited) {
    /*
     * ── ★ 넘보면 **말해 줍니다** (2026-09-05 에 고침) ★ ─────────
     *
     * 여기는 본인이 자기 정보를 고치는 자리입니다. 역할·아이디·상태는
     * 관리자만 바꿉니다. 옛 코드는 그런 값이 와도 **조용히 무시하고
     * 200 을 돌려줬습니다.** 자료함은 안 바뀌니 뚫린 것은 아닙니다.
     *
     * 그래도 나쁩니다 —
     *   · 보낸 쪽은 「바뀌었다」고 믿습니다
     *   · 나중에 칸이 하나 늘면 그것도 **조용히** 무시됩니다.
     *     그때는 진짜로 뚫려도 아무도 모릅니다.
     *
     * ★ 다만 **값이 실제로 달라질 때만** 막습니다. 본인 정보 화면이
     *   폼을 통째로 보내면서 지금 역할을 그대로 실어 보내기 때문입니다.
     *   같은 값을 보낸 것까지 막으면 연락처도 못 고칩니다.
     */
    const 지금역할 = parseRoles(cur.roles ?? cur.role).slice().sort().join(",");
    const 넘본것: string[] = [];
    if (b.roles !== undefined &&
        parseRoles(b.roles).slice().sort().join(",") !== 지금역할) 넘본것.push("역할");
    if ((b as any).loginId !== undefined &&
        String((b as any).loginId) !== String(cur.login_id)) 넘본것.push("아이디");
    if ((b as any).status !== undefined &&
        String((b as any).status) !== String(cur.status)) 넘본것.push("상태");
    if (넘본것.length)
      throw new Error(`${넘본것.join("·")}은(는) 관리자만 바꿉니다.`);

    db.run(
      "UPDATE app_user SET name = ?, phone = ?, payload = ?, dong = ? WHERE id = ?",
      [name, phone, personPayload(merged), dongOf(merged.address ?? ""), id]
    );
    return;
  }

  const roles = b.roles === undefined
    ? parseRoles(cur.roles ?? cur.role)
    : parseRoles(b.roles);
  // 관리자가 한 명도 없어지면 아무도 못 들어옵니다.
  if (!roles.includes("admin")) {
    const 관리자수 = 관리자들().length;
    const wasAdmin = parseRoles(cur.roles ?? cur.role).includes("admin");
    if (wasAdmin && 관리자수 <= 1)
      throw new Error(
        "관리자가 한 명은 있어야 합니다.\n" +
        "자리를 넘기시려면 「관리자 넘기기」를 쓰세요 — 넘기는 것과 내려놓는 것이 한 번에 됩니다.");
  } else {
    천장확인(roles, id);              // 관리자는 한 명뿐입니다
  }

  // 아이디 바꾸기. 겹치면 안 됩니다 — 로그인이 갈라집니다.
  const loginId = (b.loginId ?? "").trim();
  let idChanged = false;
  if (loginId && loginId !== cur.login_id) {
    const dup = db.query("SELECT id FROM app_user WHERE login_id = ? AND id <> ?")
      .get(loginId, id);
    if (dup) throw new Error("이미 쓰고 있는 아이디입니다.");
    idChanged = true;
  }

  db.run(
    `UPDATE app_user SET name = ?, phone = ?, role = ?, roles = ?,
            login_id = ?, payload = ?, dong = ?, hired_on = ?, contract_on = ?
       WHERE id = ?`,
    [
      name, phone, roles[0], JSON.stringify(roles),
      loginId || cur.login_id, personPayload(merged), dongOf(merged.address ?? ""),
      keep(b.hiredOn, cur.hired_on ?? ""), keep(b.contractOn, cur.contract_on ?? ""), id,
    ]
  );

  // 비밀번호는 적었을 때만 바꿉니다. 빈 칸은 "그대로 두기"라는 뜻입니다.
  let pwChanged = false;
  if (b.password && String(b.password).trim()) {
    await resetPassword(id, String(b.password).trim());
    pwChanged = true;
  } else if (idChanged) {
    // 아이디가 바뀌면 쓰던 로그인은 끊습니다. 새 아이디로 다시 들어와야 합니다.
    db.run("DELETE FROM session WHERE user_id = ?", [id]);
  }

  syncWorker(id, roles, b, new Date().toISOString());
  return { idChanged, pwChanged };
}

/** roles 에 worker 가 있으면 worker 줄을 맞춰 둡니다. */
function syncWorker(userId: number, roles: Role[], b: Input, now: string) {
  const has = db.query<{ id: number }, [number]>(
    "SELECT id FROM worker WHERE user_id = ?"
  ).get(userId);

  if (!roles.includes("worker")) return;   // 제공인력이 아니면 그대로 둡니다

  // 생년월일·주소·입사일은 app_user 에 있습니다(v7).
  // 사람이면 누구나 가진 것이라 제공인력 표에 둘 이유가 없었습니다.
  // 여기 남는 것은 **제공인력에게만 있는 것**뿐입니다.
  const old = has
    ? db.query<any, [number]>("SELECT * FROM worker WHERE id = ?").get(has.id)
    : null;
  const vals = [
    keep(b.empNo, old?.emp_no ?? ""),
    b.qualifications === undefined
      ? (old?.qualifications ?? "[]")
      : JSON.stringify(cleanRows(b.qualifications)),
    b.trainings === undefined
      ? (old?.trainings ?? "[]")
      : JSON.stringify(cleanRows(b.trainings)),
    keep(b.payrollExcluded, !!old?.payroll_excluded) ? 1 : 0,
    keep(b.excludeReason, old?.exclude_reason ?? ""),
    keep(b.note, old?.note ?? ""),
  ];

  if (has) {
    db.run(
      `UPDATE worker SET emp_no = ?, qualifications = ?, trainings = ?,
              payroll_excluded = ?, exclude_reason = ?, note = ?
         WHERE id = ?`,
      [...vals, has.id]
    );
  } else {
    db.run(
      `INSERT INTO worker
         (user_id, payload, emp_no, qualifications, trainings,
          geo_consent, status, payroll_excluded, exclude_reason, note, created_at)
       VALUES (?, '{}', ?, ?, ?, 0, 'active', ?, ?, ?, ?)`,
      [userId, ...vals, now]
    );
  }
}

/** 한 사람 자세히 — 배정 현황과 이력까지. */
export function getStaff(id: number) {
  const row = db.query(
    `SELECT u.id, u.login_id, u.name, u.phone, u.role, u.roles, u.status, u.resigned_at,
            u.leave_from, u.leave_to, u.leave_reason,
            u.created_at, u.payload, u.dong, u.hired_on, u.contract_on,
            w.id AS worker_id, w.emp_no,
            w.qualifications, w.trainings,
            w.geo_consent, w.payroll_excluded, w.exclude_reason, w.note,
            (SELECT COUNT(*) FROM assignment a
               JOIN recipient r2 ON r2.id = a.recipient_id
              WHERE a.worker_id = w.id
                AND r2.status NOT IN ('종결','취소','직권중단')
                AND (a.period_to IS NULL OR a.period_to >= date('now','localtime'))) AS match_now,
            (SELECT COUNT(*) FROM assignment a WHERE a.worker_id = w.id) AS match_all
       FROM app_user u
       LEFT JOIN worker w ON w.user_id = u.id
      WHERE u.id = ?`
  ).get(id) as any;
  if (!row) throw new Error("그 사람을 찾을 수 없습니다.");

  const now = today();
  const assignments = row.worker_id
    ? (db.query(
        `SELECT a.id, a.period_from, a.period_to, a.planned_count, a.weekly_plan,
                sv.name AS service, r.payload AS rpayload, r.dong AS rdong, r.status AS rstatus
           FROM assignment a
           LEFT JOIN service sv ON sv.id = a.service_id
           LEFT JOIN recipient r ON r.id = a.recipient_id
          WHERE a.worker_id = ?
          ORDER BY COALESCE(a.period_from,'') DESC, a.id DESC`
      ).all(row.worker_id) as any[])
    : [];

  // 종결·취소된 대상자는 「맡고 있는」이 아니라 「지난 이력」입니다.
  // 종결한 그날은 배정 종료일이 오늘이라 날짜만으로는 진행중으로 보입니다.
  const DONE = ["종결", "취소", "직권중단"];

  const matches = assignments.map((a) => {
    const rp = JSON.parse(a.rpayload || "{}");
    return {
      id: a.id,
      recipient: rp.name ?? "",
      dong: a.rdong ?? "",
      recipientStatus: a.rstatus ?? "",
      service: a.service ?? "",
      slotText: slotText(parseSlots(a.weekly_plan)),
      from: a.period_from,
      to: a.period_to,
      ended: DONE.includes(a.rstatus) || (!!a.period_to && a.period_to < now),
    };
  });

  return {
    staff: shapeStaff(row),
    matches: matches.filter((m) => !m.ended),
    pastMatches: matches.filter((m) => m.ended),
  };
}

export async function resetPassword(id: number, password: string) {
  if (!password || password.length < 4) throw new Error("비밀번호는 4자 이상으로 정해 주세요.");
  const hash = await hashPassword(password);
  db.run("UPDATE app_user SET pw_hash = ? WHERE id = ?", [hash, id]);
  // 쓰던 로그인은 모두 끊습니다. 비밀번호를 바꾼 뜻이 그것입니다.
  db.run("DELETE FROM session WHERE user_id = ?", [id]);
}

/**
 * 계약종료 처리.
 *
 * 지운 것이 아니라 멈춘 것입니다. 그 사람이 남긴 실적·일지는 그대로 있어야
 * 나중에 지자체가 물었을 때 답할 수 있습니다.
 *
 * 위치정보 동의는 **자동으로 철회됩니다.** 계약이 끝난 사람의 위치를 계속 받을
 * 근거가 없습니다. 동의는 계약 단위로 받되 계약이 끝나면 끊는다는 원칙입니다.
 */
export function resign(id: number, on?: string) {
  const day = (on ?? today()).slice(0, 10);
  const 관리자수 = 관리자들().length;
  const cur = db.query<any, [number]>("SELECT * FROM app_user WHERE id = ?").get(id);
  if (!cur) throw new Error("그 사람을 찾을 수 없습니다.");
  if (parseRoles(cur.roles ?? cur.role).includes("admin") && 관리자수 <= 1)
    throw new Error(
      "관리자가 한 명은 있어야 합니다.\n" +
      "먼저 「관리자 넘기기」로 자리를 넘기신 뒤에 하세요.");

  const 남은것 = openAssignments(id);
  db.run(
    `UPDATE app_user SET status = 'resigned', resigned_at = ?,
            leave_from = NULL, leave_to = NULL, leave_reason = NULL
      WHERE id = ?`,
    [day, id]
  );
  db.run("UPDATE worker SET status = 'resigned', geo_consent = 0 WHERE user_id = ?", [id]);
  db.run("DELETE FROM session WHERE user_id = ?", [id]);
  // 맡고 있던 것이 몇 건인지 함께 돌려줍니다. 화면이 「4건을 옮기세요」라고 말할 수 있게.
  return { resignedAt: day, ...남은것 };
}

export function restore(id: number) {
  db.run("UPDATE app_user SET status = 'active', resigned_at = NULL WHERE id = ?", [id]);
  db.run("UPDATE worker SET status = 'active' WHERE user_id = ?", [id]);
}

/**
 * 휴직.
 *
 * ── 왜 퇴직으로 갈음하면 안 되는가 ─────────────────────────
 * 병가·출산·개인 사정으로 **몇 달 쉬었다 돌아오는** 사람이 있습니다.
 * 퇴직 처리하면 배정에서 빠지는 것은 맞지만, 돌아왔을 때
 * 입사일·자격·교육이 새로 시작한 것처럼 보입니다. 그건 사실이 아닙니다.
 * 근속을 따질 때도, 지자체가 인력 현황을 물을 때도 틀린 답이 나갑니다.
 *
 * 그렇다고 재직으로 두면 **쉬는 사람에게 새 배정이 붙습니다.**
 *
 * → 그 사이에 자리를 하나 둡니다.
 *   명단에는 「휴직」으로 남고, 새 배정에서는 빠지고,
 *   **지난 실적·일지는 하나도 건드리지 않습니다.**
 *
 * ── 지금 맡고 있는 대상자는 어떻게 되는가 ──────────────────
 * **자동으로 떼지 않습니다.** 대타를 누구로 할지는 기관이 정할 일이고,
 * 프로그램이 배정을 말없이 닫아 버리면 그 대상자가 「미배정」으로
 * 조용히 사라집니다. 대신 **몇 건이 남아 있는지 돌려줍니다** —
 * 화면이 「최돌봄 선생님이 맡고 있던 4건을 옮기세요」라고 말할 수 있게.
 */
export function startLeave(
  id: number, opts: { from?: string; to?: string; reason?: string } = {}
) {
  const cur = db.query<any, [number]>("SELECT * FROM app_user WHERE id = ?").get(id);
  if (!cur) throw new Error("그 사람을 찾을 수 없습니다.");
  if (cur.status === "resigned") throw new Error("이미 퇴직 처리된 분입니다. 먼저 복직시켜 주세요.");

  const from = (opts.from ?? today()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error("휴직 시작일을 날짜로 골라 주세요.");
  const to = String(opts.to ?? "").trim();
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error("돌아올 날짜를 날짜로 골라 주세요.");
  if (to && to < from) throw new Error("돌아올 날짜가 휴직 시작일보다 빠릅니다.");

  // 관리자가 한 명뿐인데 그 사람이 쉬면 아무도 계정을 못 만듭니다.
  // 퇴직과 같은 이유로 막습니다.
  if (parseRoles(cur.roles ?? cur.role).includes("admin")) {
    const 관리자수 = 관리자들().length;
    if (관리자수 <= 1)
      throw new Error(
      "관리자가 한 명은 있어야 합니다.\n" +
      "먼저 「관리자 넘기기」로 자리를 넘기신 뒤에 하세요.");
  }

  db.run(
    "UPDATE app_user SET status = 'leave', leave_from = ?, leave_to = ?, leave_reason = ? WHERE id = ?",
    [from, to || null, String(opts.reason ?? "").trim() || null, id]
  );
  db.run("UPDATE worker SET status = 'leave' WHERE user_id = ?", [id]);
  // 쉬는 동안 로그인은 끊습니다. 돌아오면 다시 들어옵니다.
  db.run("DELETE FROM session WHERE user_id = ?", [id]);

  return { leaveFrom: from, leaveTo: to || null, ...openAssignments(id) };
}

/** 복직. 휴직 기록은 지웁니다 — 지금 상태를 나타내는 칸이기 때문입니다. */
export function endLeave(id: number) {
  const cur = db.query<any, [number]>("SELECT status FROM app_user WHERE id = ?").get(id);
  if (!cur) throw new Error("그 사람을 찾을 수 없습니다.");
  if (cur.status !== "leave") throw new Error("휴직 중인 분이 아닙니다.");
  db.run(
    "UPDATE app_user SET status = 'active', leave_from = NULL, leave_to = NULL, leave_reason = NULL WHERE id = ?",
    [id]
  );
  db.run("UPDATE worker SET status = 'active' WHERE user_id = ?", [id]);
  return { ok: true };
}

/** 이 사람이 지금 맡고 있는 배정이 몇 건인가. 휴직·퇴직 때 화면이 알려 주려고 씁니다. */
export function openAssignments(userId: number) {
  const now = today();
  const rows = db.query<any, [number, string]>(
    `SELECT sv.name AS service, r.payload AS rpayload
       FROM assignment a
       JOIN worker w ON w.id = a.worker_id
       LEFT JOIN service   sv ON sv.id = a.service_id
       LEFT JOIN recipient r  ON r.id  = a.recipient_id
      WHERE w.user_id = ?
        AND (a.period_to IS NULL OR a.period_to >= ?)
        AND (r.status IS NULL OR r.status NOT IN ('종결','취소','직권중단'))`
  ).all(userId, now);
  return {
    openCount: rows.length,
    openList: rows.map((x) => ({
      recipient: JSON.parse(x.rpayload || "{}").name ?? "",
      service: x.service ?? "",
    })),
  };
}

/** 지금 쉬고 있는가. 배정을 막을 때 씁니다. */
export function isOnLeave(userId: number): boolean {
  const r = db.query<{ status: string }, [number]>(
    "SELECT status FROM app_user WHERE id = ?"
  ).get(userId);
  return r?.status === "leave";
}
