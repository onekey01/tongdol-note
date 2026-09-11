/**
 * 권한 시험 —  bun 권한시험.ts     (통돌 Note 가 켜져 있어야 합니다)
 *
 * ═══════════════════════════════════════════════════════════
 *  왜 이 시험이 있나
 * ═══════════════════════════════════════════════════════════
 *
 * 개인정보보호법이 말하는 **「접근권한의 차등 부여」**가 이것입니다.
 * 지자체 점검에서 묻는 항목이기도 합니다.
 *
 * 그런데 「표에 적어 두었다」와 「실제로 막힌다」는 다른 일입니다.
 * 오늘(2026-09-05) 계정 로그인을 만들면서 **권한 검사를 빠뜨린 자리**를
 * 두 군데 찾았습니다 — 침입 알림을 아무나 읽고 지울 수 있었습니다.
 * 코드를 눈으로 훑어서는 못 찾았고, 따로 읽어 보고서야 나왔습니다.
 *
 * 그래서 **진짜 서버를 두드립니다.** 계정을 만들고, 로그인하고,
 * 막혀야 하는 길을 하나씩 눌러 봅니다.
 *
 * ── 여기서 보는 것 ─────────────────────────────────────────
 *
 *   1. ★ 제공인력이 **남의 대상자를 못 보는가** (목록·상세·실적)
 *   2. 제공인력이 **자기 역할을 관리자로 못 바꾸는가**
 *   3. 제공인력이 종사자 명단·설정·의뢰를 못 보는가
 *   4. 사무직원이 계정과 설정을 못 건드리는가
 *   5. ★ **외부업체가 배정된 건만 보는가** (일회용 링크 대신 쓰는 길)
 *   6. ★ **계약이 끝나면 로그인이 막히는가**
 *   7. 오늘 만든 것 — 기기 끊기·침입 알림·제공기록지
 */
import { randomUUID } from "node:crypto";
import { db, initDb } from "./server/db";
import { hashPassword } from "./server/auth";
initDb();

const 주소 = "http://127.0.0.1:5757";
let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: unknown, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}

const 지울사람: number[] = [];
const 지울대상자: string[] = [];
const 지울배정: number[] = [];
const 지울서비스: number[] = [];
const 지울인력: number[] = [];

/** 계정 하나 만들기. */
async function 계정(이름: string, 역할: string[], 상태 = "active") {
  const login = `perm-${randomUUID().slice(0, 8)}`;
  const r = db.run(
    `INSERT INTO app_user (name, login_id, pw_hash, role, roles, status, payload, created_at)
     VALUES (?,?,?,?,?,?,'{}',?)`,
    [이름, login, await hashPassword("시험1234"), 역할[0], JSON.stringify(역할),
     상태, new Date().toISOString()]);
  const id = Number(r.lastInsertRowid);
  지울사람.push(id);
  return { id, login, 비번: "시험1234", 이름 };
}

/** 로그인해서 쿠키를 얻습니다. 못 들어가면 null. */
async function 들어가기(login: string, 비번: string): Promise<string | null> {
  const r = await fetch(`${주소}/api/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ loginId: login, password: 비번 }),
  });
  if (!r.ok) return null;
  return r.headers.get("set-cookie")?.split(";")[0] ?? null;
}

/** 그 사람으로 어딘가를 두드립니다. */
async function 두드리기(쿠키: string, 길: string, 옵션: RequestInit = {}) {
  const r = await fetch(주소 + 길, {
    ...옵션,
    headers: { cookie: 쿠키, "content-type": "application/json", ...(옵션.headers ?? {}) },
  });
  let 몸: any = null;
  try { 몸 = await r.json(); } catch { }
  return { 상태: r.status, 몸 };
}

const 막혔나 = (x: { 상태: number }) => x.상태 === 403 || x.상태 === 401;

try {
  const 프로필: any = db.query(
    `SELECT rp.* FROM region_profile rp JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`).get();
  if (!프로필) throw new Error("기관이 없습니다. 통돌 Note 를 한 번 켜 주세요.");

  // ── 마당 차리기 ──
  const 관리자 = await 계정("권한시험관리자", ["admin"]);
  const 사무 = await 계정("권한시험사무", ["staff"]);
  const 인력 = await 계정("권한시험인력", ["worker"]);
  const 업체 = await 계정("권한시험업체", ["vendor"]);
  const 퇴사 = await 계정("권한시험퇴사", ["worker"], "resigned");

  function 인력줄(userId: number) {
    const r = db.run(
      `INSERT INTO worker (user_id, payload, geo_consent, status, created_at)
       VALUES (?, '{}', 0, 'active', ?)`, [userId, new Date().toISOString()]);
    const id = Number(r.lastInsertRowid); 지울인력.push(id); return id;
  }
  const 인력w = 인력줄(인력.id);
  const 업체w = 인력줄(업체.id);

  const 서비스 = (() => {
    const r = db.run(
      `INSERT INTO service (profile_id, code, cat_l, cat_m, cat_s, name, unit, unit_price,
                            holiday_price, record_type, lifetime_cap, outside_annual_cap,
                            monthly_cap_minutes, monthly_cap_count, noshow_billable,
                            sort_order, active, custom)
       VALUES (?,?,'일상생활돌봄','가사지원','가사지원','권한시험서비스','hour',24000,NULL,'time',NULL,0,0,0,0,905,1,1)`,
      [프로필.id, `UPRM-${randomUUID().slice(0, 6)}`]);
    const id = Number(r.lastInsertRowid); 지울서비스.push(id); return id;
  })();

  /** 대상자 둘 — 하나는 그 인력에게 배정, 하나는 **남의 것**. */
  function 대상자(이름: string) {
    const id = randomUUID();
    db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at)
            VALUES (?,?,?,?,?,?)`,
      [id, JSON.stringify({ name: 이름 }), "해남읍", "이용", "2026-09-01", "x"]);
    지울대상자.push(id); return id;
  }
  const 내대상자 = 대상자("권한시험_내분");
  const 남의대상자 = 대상자("권한시험_남의분");
  const 업체대상자 = 대상자("권한시험_업체분");

  function 배정하기(rid: string, wid: number) {
    const r = db.run(
      `INSERT INTO assignment (recipient_id, service_id, worker_id, weekly_plan, period_from, created_at)
       VALUES (?,?,?,?,?,'x')`,
      [rid, 서비스, wid, JSON.stringify([{ dow: 1 }]), "2026-09-01"]);
    const id = Number(r.lastInsertRowid); 지울배정.push(id); return id;
  }
  const 내배정 = 배정하기(내대상자, 인력w);
  배정하기(업체대상자, 업체w);
  // 남의대상자는 아무에게도 안 붙입니다.

  // ══════════════════════════════════════════════════════════
  console.log("\n── 1. 들어가지는가 ─────────────────────────────────\n");
  const 관쿠 = await 들어가기(관리자.login, 관리자.비번);
  const 사쿠 = await 들어가기(사무.login, 사무.비번);
  const 인쿠 = await 들어가기(인력.login, 인력.비번);
  const 업쿠 = await 들어가기(업체.login, 업체.비번);
  본다("관리자가 들어간다", !!관쿠);
  본다("사무직원이 들어간다", !!사쿠);
  본다("제공인력이 들어간다", !!인쿠);
  본다("외부업체가 들어간다", !!업쿠);

  /*
   * ★ 계약이 끝난 사람은 **비밀번호가 맞아도** 못 들어갑니다.
   *   외부업체를 계정으로 쓰는 길의 핵심이 여기입니다 —
   *   공사가 끝나면 계약 종료 한 번으로 손이 끊깁니다.
   */
  const 퇴쿠 = await 들어가기(퇴사.login, 퇴사.비번);
  본다("★ 계약이 끝난 사람은 못 들어간다", !퇴쿠,
    "외부업체를 계정으로 쓰는 길의 핵심입니다");

  if (!관쿠 || !사쿠 || !인쿠 || !업쿠) throw new Error("로그인이 안 되어 더 못 봅니다.");

  // ══════════════════════════════════════════════════════════
  console.log("\n── 2. 제공인력이 남의 대상자를 보는가 ★ ────────────\n");
  {
    const 목록 = await 두드리기(인쿠, "/api/recipients");
    const 글 = JSON.stringify(목록.몸 ?? {});
    본다("★ 남의 대상자가 목록에 안 나온다", !글.includes("권한시험_남의분"));
    본다("자기 대상자는 나온다", 글.includes("권한시험_내분"));

    const 남 = await 두드리기(인쿠, `/api/recipients/${남의대상자}`);
    본다("★ 남의 대상자 상세를 못 연다", 막혔나(남) || 남.상태 === 404, `${남.상태}`);

    const 내 = await 두드리기(인쿠, `/api/recipients/${내대상자}`);
    본다("자기 대상자 상세는 열린다", 내.상태 === 200, `${내.상태}`);
  }

  console.log("\n── 3. 제공인력이 못 하는 것들 ──────────────────────\n");
  {
    /*
     * ★ 명단은 **막지 않고 걸러 줍니다.** 본인 한 줄은 봐야 하니까요
     *   (연락처를 스스로 고치는 자리가 있습니다). 그래서 200 이 오되
     *   남의 줄이 한 줄도 없어야 맞습니다 — 화면에서 감추는 것으로는
     *   부족합니다. 주소창을 치면 그만이니까요.
     */
    {
      const 명단 = await 두드리기(인쿠, "/api/staff");
      const 글 = JSON.stringify(명단.몸?.items ?? []);
      본다("★ 종사자 명단에 남이 안 보인다",
        명단.상태 === 200 && !글.includes("권한시험사무") && !글.includes("권한시험관리자"),
        `${(명단.몸?.items ?? []).length}줄`);
      본다("자기 한 줄은 보인다", 글.includes("권한시험인력"));
      본다("남의 상세는 못 연다", 막혔나(await 두드리기(인쿠, `/api/staff/${사무.id}`)));
    }
    본다("설정을 못 본다", 막혔나(await 두드리기(인쿠, "/api/settings")));
    본다("의뢰 접수를 못 본다", 막혔나(await 두드리기(인쿠, "/api/referrals")));
    본다("기록지를 못 본다", 막혔나(await 두드리기(인쿠, "/api/recordbook?month=2026-09")));

    /*
     * ★★ 자기 역할을 관리자로 바꾸려는 시도 ★★
     *   이것이 뚫리면 잠금장치가 통째로 없는 것과 같습니다.
     */
    const 역할바꾸기 = await 두드리기(인쿠, `/api/staff/${인력.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "권한시험인력", roles: ["admin"], role: "admin" }),
    });

    /*
     * ★ 그러면서도 **자기 연락처는 고쳐져야** 합니다. 본인 정보 화면이
     *   폼을 통째로 보내면서 지금 역할을 그대로 실어 보내기 때문에,
     *   같은 값까지 막으면 연락처도 못 고칩니다.
     */
    const 내정보 = await 두드리기(인쿠, `/api/staff/${인력.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "권한시험인력", phone: "010-1111-2222",
                             roles: ["worker"] }),
    });
    본다("★ 자기 연락처는 고쳐진다 (같은 역할을 실어 보내도)",
      내정보.상태 === 200, `${내정보.상태} ${내정보.몸?.error ?? ""}`);
    본다("★★ 자기 역할을 관리자로 못 바꾼다",
      역할바꾸기.상태 >= 400, `${역할바꾸기.상태} ${역할바꾸기.몸?.error ?? ""}`);
    /*
     * ★ **조용히 무시하지 않는가.** 옛 코드는 자료함을 안 바꾸면서도
     *   200 을 돌려줬습니다. 뚫린 것은 아니지만, 나중에 칸이 하나 늘면
     *   그것도 조용히 무시되고 그때는 진짜로 뚫려도 아무도 모릅니다.
     */
    본다("★ 무엇이 안 되는지 말해 준다",
      String(역할바꾸기.몸?.error ?? "").includes("관리자만"),
      역할바꾸기.몸?.error ?? "(아무 말 없음)");

    const 뒤 = db.query<{ roles: string }, [number]>(
      "SELECT roles FROM app_user WHERE id = ?").get(인력.id);
    본다("★★ 자료함에서도 안 바뀌었다", !String(뒤?.roles).includes("admin"),
      String(뒤?.roles));
  }

  console.log("\n── 4. 오늘 만든 것들의 권한 ★ ──────────────────────\n");
  {
    /*
     * ★ 2026-09-05 에 여기서 구멍을 찾았습니다. 침입 알림을 아무나
     *   읽고 지울 수 있었습니다 — 남의 계정으로 들어온 사람이 제일
     *   먼저 할 일이 「내 흔적 지우기」인데 그 두 가지가 열려 있었습니다.
     */
    본다("★ 침입 알림을 제공인력이 못 읽는다",
      막혔나(await 두드리기(인쿠, "/api/devices/changes")));
    본다("★ 침입 알림을 제공인력이 못 지운다",
      막혔나(await 두드리기(인쿠, "/api/devices/changes",
        { method: "DELETE", body: "{}" })));
    본다("들어온 기록을 제공인력이 못 본다",
      막혔나(await 두드리기(인쿠, "/api/devices/log")));
    본다("기기 끊기를 제공인력이 못 한다",
      막혔나(await 두드리기(인쿠, "/api/devices/cut",
        { method: "POST", body: JSON.stringify({ 인력번호: "x" }) })));
    본다("제공기록지를 제공인력이 못 뽑는다",
      막혔나(await 두드리기(인쿠, `/api/records/${내배정}/sheet?month=2026-09`)),
      "자기 건이어도 서식은 사무실이 냅니다");
  }

  console.log("\n── 5. 사무직원의 울타리 ────────────────────────────\n");
  {
    본다("종사자 명단은 본다", (await 두드리기(사쿠, "/api/staff")).상태 === 200);
    본다("대상자를 다 본다", (await 두드리기(사쿠, `/api/recipients/${남의대상자}`)).상태 === 200);
    본다("설정을 본다", (await 두드리기(사쿠, "/api/settings")).상태 === 200);

    본다("★ 설정을 못 고친다",
      막혔나(await 두드리기(사쿠, "/api/settings/hours",
        { method: "PATCH", body: JSON.stringify({ autoStart: true }) })));
    본다("★ 남의 계정을 못 건드린다",
      막혔나(await 두드리기(사쿠, `/api/staff/${인력.id}`,
        { method: "PATCH", body: JSON.stringify({ roles: ["admin"] }) })));
    본다("★ 침입 알림을 못 지운다",
      막혔나(await 두드리기(사쿠, "/api/devices/changes",
        { method: "DELETE", body: "{}" })),
      "설정 고치기와 같은 등급입니다");
    본다("제공기록지는 뽑는다",
      (await 두드리기(사쿠, `/api/records/${내배정}/sheet?month=2026-09`)).상태 !== 403,
      "매달 군에 내는 일이라 사무직원도 합니다");
  }

  console.log("\n── 6. 외부업체 ★ (일회용 링크 대신 쓰는 길) ────────\n");
  {
    /*
     * ★ 무무가 짚은 것 — 「종사자 목록에서 외부업체로 등록하여 계정을
     *   만들 수 있게 되어있거든? 그냥 이것 활용하면 되는 것 아니야?」
     *
     *   맞습니다. 다만 **실제로 막히는지**를 봐야 그 말을 믿을 수 있습니다.
     */
    const 목록 = await 두드리기(업쿠, "/api/recipients");
    const 글 = JSON.stringify(목록.몸 ?? {});
    본다("★ 배정된 대상자는 본다", 글.includes("권한시험_업체분"));
    본다("★ 남의 대상자는 한 줄도 안 보인다",
      !글.includes("권한시험_남의분") && !글.includes("권한시험_내분"),
      "배정된 건만 — 링크를 새로 만들 까닭이 없습니다");

    {
      const 명단 = await 두드리기(업쿠, "/api/staff");
      const 글 = JSON.stringify(명단.몸?.items ?? []);
      본다("★ 종사자 명단에 남이 안 보인다",
        !글.includes("권한시험인력") && !글.includes("권한시험관리자"),
        `${(명단.몸?.items ?? []).length}줄`);
    }
    본다("설정을 못 본다", 막혔나(await 두드리기(업쿠, "/api/settings")));
    본다("★ 침입 알림도 못 본다", 막혔나(await 두드리기(업쿠, "/api/devices/changes")));

    /*
     * ★ 계약이 끝나면 그 자리에서 끊깁니다.
     *   공사가 끝나면 종사자 화면에서 「계약 종료」 한 번이면 됩니다.
     */
    db.run("UPDATE app_user SET status = 'resigned' WHERE id = ?", [업체.id]);
    const 끝난뒤 = await 두드리기(업쿠, "/api/recipients");
    본다("★★ 계약을 끝내면 있던 쿠키로도 못 본다",
      막혔나(끝난뒤), `${끝난뒤.상태}`);
    본다("★★ 다시 들어가지도 못한다",
      !(await 들어가기(업체.login, 업체.비번)));
    db.run("UPDATE app_user SET status = 'active' WHERE id = ?", [업체.id]);
  }

  console.log("\n── 7. 관리자는 다 되는가 ───────────────────────────\n");
  {
    본다("종사자 명단", (await 두드리기(관쿠, "/api/staff")).상태 === 200);
    본다("설정", (await 두드리기(관쿠, "/api/settings")).상태 === 200);
    본다("침입 알림", (await 두드리기(관쿠, "/api/devices/changes")).상태 === 200);
    본다("들어온 기록", (await 두드리기(관쿠, "/api/devices/log")).상태 === 200);
    본다("대상자 전부", (await 두드리기(관쿠, `/api/recipients/${남의대상자}`)).상태 === 200);
  }

  console.log("\n── 8. 로그인 안 하고는 ─────────────────────────────\n");
  {
    const 맨몸 = async (길: string) => {
      const r = await fetch(주소 + 길);
      return r.status;
    };
    본다("★ 대상자 목록", await 맨몸("/api/recipients") === 401);
    본다("★ 종사자 명단", await 맨몸("/api/staff") === 401);
    본다("★ 침입 알림", await 맨몸("/api/devices/changes") === 401);
    본다("★ 제공기록지", await 맨몸(`/api/records/${내배정}/sheet?month=2026-09`) === 401);
  }

} catch (e: any) {
  실패수++;
  console.log(`\n✗ 실패  시험 도중 터짐 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 4).join("\n"));
} finally {
  for (const id of 지울배정) db.run("DELETE FROM assignment WHERE id = ?", [id]);
  for (const id of 지울대상자) {
    db.run("DELETE FROM delivery WHERE recipient_id = ?", [id]);
    db.run("DELETE FROM recipient WHERE id = ?", [id]);
  }
  for (const id of 지울서비스) db.run("DELETE FROM service WHERE id = ?", [id]);
  for (const id of 지울인력) db.run("DELETE FROM worker WHERE id = ?", [id]);
  for (const id of 지울사람) {
    db.run("DELETE FROM session WHERE user_id = ?", [id]);
    db.run("DELETE FROM app_user WHERE id = ?", [id]);
  }
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
