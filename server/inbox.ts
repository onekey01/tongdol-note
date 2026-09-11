import { db } from "./db";
import { 집표 } from "./방문표";
import {
  readSheets, findHeader, mapColumns, parseLines, personKey, normBirth,
  type Line, type Field,
} from "./referral";

/**
 * 의뢰 접수 — 지자체 엑셀을 우리 자료와 맞춰 봅니다.
 *
 * ── 무엇을 기준으로 삼는가 ────────────────────────────────
 *
 * 파일이 아니라 **사람**이 기준입니다.
 *
 * 지자체마다 명단을 보내는 방식이 다릅니다. 어떤 곳은 그 차수에 새로
 * 의뢰된 것만 보내고, 어떤 곳은 전체 명단을 매번 보냅니다.
 * 우리는 그걸 알 필요가 없게 만들었습니다.
 *   - 파일에 있는 **모든 시트를 한 번에** 읽습니다.
 *   - 줄마다 사람을 찾아 그 사람 밑에 **쌓습니다.**
 *   - '지금 유효한 의뢰'는 쌓인 것 중에서 **기간으로** 고릅니다.
 *
 * 그래서 차수를 거꾸로 올려도 자료가 되돌아가지 않습니다.
 * 올린 순서가 아니라 서비스기간이 판단 기준이기 때문입니다.
 *
 * ── 판정 ──────────────────────────────────────────────────
 *   신규       처음 보는 사람
 *   추가       아는 사람인데 이 서비스는 처음
 *   변경       같은 사람·같은 서비스인데 기간이나 횟수가 달라짐
 *   재개       종결·중단됐던 사람이 다시 의뢰됨
 *   유지       이미 갖고 있는 것과 똑같음
 *   지난차수   지금 갖고 있는 것보다 이전 기간 — 이미 지나간 의뢰
 *   확인필요   서비스명·부담구간을 못 찾음 (관리자가 손봐야 함)
 *   동명이인   성명·생년월일이 같은 사람이 이미 있는데 주소·연락처가 다름
 *
 * 명단에서 사라진 사람을 종결로 보지 않습니다.
 * 전체 명단인지 새 의뢰만인지 알 수 없으므로, 없어졌다고 끊으면 사고가 납니다.
 * 종결은 기간이 끝난 것을 홈 화면에서 알려주고 사람이 확인해 처리합니다.
 */

export type State =
  | "신규" | "추가" | "변경" | "재개" | "유지" | "지난차수" | "확인필요" | "동명이인";

/** 반영해도 되는 판정 */
const APPLY_OK: State[] = ["신규", "추가", "변경", "재개"];

export type DiffLine = {
  sheet: string;
  row: number;
  dupOf: number | null;
  name: string;
  birth: string;
  dong: string;
  gender: string;
  address: string;
  phone: string;
  service: string;
  serviceId: number | null;
  periodFrom: string | null;
  periodTo: string | null;
  periodMonths: number | null;
  cycleText: string;
  cycleUnit: string | null;
  cycleCount: number | null;
  copay: string;
  copayTierId: number | null;
  note: string;
  state: State;
  recipientId: string | null;
  changes: { field: string; before: string; after: string }[];
  problems: string[];
  /** 동명이인일 때 후보들 */
  candidates: { id: string; name: string; birth: string; address: string; phone: string }[];
  /**
   * 이미 있는 의뢰와 **기간이 겹치는** 것들 — 「재의뢰」.
   * 둘 다 유효하므로 아무것도 안 고칩니다. 반영 전에 보이기만 합니다.
   */
  overlaps: { batch: string; from: string; to: string; cycle: string }[];
  /** 관리자가 손으로 고른 값 (확인필요·동명이인 줄) */
  fixServiceId?: number | null;
  fixRecipientId?: string | null;
};

type Stash = { at: number; lines: DiffLine[] };
const STASH = new Map<string, Stash>();
const STASH_MINUTES = 60;

function purgeStash() {
  const dead = Date.now() - STASH_MINUTES * 60_000;
  for (const [k, v] of STASH) if (v.at < dead) STASH.delete(k);
}

// ── 우리 자료 쪽 준비 ──────────────────────────────────────
function serviceIndex(profileId: number) {
  const rows = db
    .query<{ id: number; name: string; cat_m: string; cat_s: string }, [number]>(
      "SELECT id, name, cat_m, cat_s FROM service WHERE profile_id = ?"
    )
    .all(profileId);
  const byName = new Map<string, number>();
  for (const s of rows) {
    for (const key of [s.name, s.cat_m, s.cat_s]) {
      if (key) byName.set(key.replace(/\s+/g, ""), s.id);
    }
  }
  return byName;
}

function tierIndex(profileId: number) {
  const rows = db
    .query<{ id: number; label: string; rate: number }, [number]>(
      "SELECT id, label, rate FROM copay_tier WHERE profile_id = ?"
    )
    .all(profileId);
  return (text: string): number | null => {
    const t = text.replace(/\s+/g, "");
    if (!t) return null;
    for (const r of rows) {
      const l = r.label.replace(/\s+/g, "");
      if (l === t || l.startsWith(t) || t.startsWith(l)) return r.id;
    }
    const pct = t.match(/(\d+)%/);
    if (pct) {
      const want = Number(pct[1]) / 100;
      const hit = rows.find((r) => Math.abs(r.rate - want) < 0.001);
      if (hit) return hit.id;
    }
    return null;
  };
}

type Known = {
  id: string; name: string; birth: string; address: string; phone: string; status: string;
};

/** 성명+생년월일이 같은 사람들을 모아 둡니다. 동명이인이면 여럿입니다. */
function recipientIndex(): Map<string, Known[]> {
  const rows = db.query<{ id: string; payload: string; status: string }, []>(
    "SELECT id, payload, status FROM recipient"
  ).all();
  const m = new Map<string, Known[]>();
  for (const r of rows) {
    const p = JSON.parse(r.payload || "{}");
    const k = personKey(p.name ?? "", p.birth ?? "");
    const one: Known = {
      id: r.id, name: p.name ?? "", birth: p.birth ?? "",
      address: p.address ?? "", phone: p.phone ?? "", status: r.status,
    };
    (m.get(k) ?? m.set(k, []).get(k)!).push(one);
  }
  return m;
}

const digits = (s: string) => String(s ?? "").replace(/\D/g, "");
const squash = (s: string) => String(s ?? "").replace(/\s+/g, "");

/**
 * 같은 사람인가?
 * 성명·생년월일이 같아도 주소와 연락처가 둘 다 뚜렷이 다르면 다른 사람일 수 있습니다.
 * 다만 이사·번호 변경도 흔하므로 **자동으로 가르지 않고 사람에게 묻습니다.**
 */
function samePerson(a: Known, addr: string, phone: string): boolean | null {
  const pa = digits(a.phone), pb = digits(phone);
  if (pa && pb && pa === pb) return true;

  const aa = squash(a.address), ab = squash(addr);
  if (aa && ab && (aa.includes(ab) || ab.includes(aa))) return true;

  // 비교할 거리가 없으면 같은 사람으로 봅니다 (성명+생년월일이 이미 같음)
  if ((!pa || !pb) && (!aa || !ab)) return true;

  // 둘 다 있는데 둘 다 다르면 판단 보류
  if (pa && pb && pa !== pb && aa && ab) return null;
  return true;
}

/** 그 사람·그 서비스의 '지금 유효한' 의뢰 — 기간이 가장 늦은 것 */
function currentReferral(recipientId: string, serviceId: number) {
  return db
    .query<any, [string, number]>(
      `SELECT * FROM referral
        WHERE recipient_id = ? AND service_id = ?
        ORDER BY COALESCE(period_from, '') DESC, id DESC LIMIT 1`
    )
    .get(recipientId, serviceId);
}

/**
 * ── 기간이 겹치는 의뢰 — 「재의뢰」 ─────────────────────────
 *
 * 4.21~6.30 의뢰가 있는데 5.11~7.17 이 새로 오면 **6월이 겹칩니다.**
 *
 * 지자체에 확인한 답은 **둘 다 유효**입니다. 나중 것이 앞의 것을 덮지 않습니다.
 * 그래서 프로그램은 **아무것도 지우거나 고치지 않습니다.**
 *
 * 다만 **지자체가 못 걸러서 온 것일 수도 있습니다.** 그러면 그대로 반영했다가
 * 나중에 청구가 두 번 잡히거나, 없는 기간을 서비스한 것이 됩니다.
 * 그래서 **반영하기 전에 눈에 띄게** 합니다 — 판단은 사람이 합니다.
 *
 * 열린 끝(null)은 「아직 안 끝남」입니다. 무한대로 봅니다 —
 * 끝을 모르는 것과 끝이 없는 것은 다르지만, 겹침을 볼 때는 같게 다뤄야
 * 「모르니까 안 겹친다」는 위험한 판단을 안 합니다.
 */
export function 기간겹치나(
  aFrom: string | null, aTo: string | null,
  bFrom: string | null, bTo: string | null
): boolean {
  const a1 = aFrom || "0000-00-00", a2 = aTo || "9999-99-99";
  const b1 = bFrom || "0000-00-00", b2 = bTo || "9999-99-99";
  return a1 <= b2 && b1 <= a2;
}

/** 자료함에 이미 있는 의뢰 중, 같은 서비스이면서 기간이 겹치는 것들. */
function 겹치는의뢰(
  recipientId: string, serviceId: number,
  from: string | null, to: string | null
) {
  const rows = db.query<any, [string, number]>(
    `SELECT batch_label, period_from, period_to, cycle_text
       FROM referral
      WHERE recipient_id = ? AND service_id = ?
      ORDER BY COALESCE(period_from, '') DESC, id DESC`
  ).all(recipientId, serviceId);

  return rows
    .filter((r) => 기간겹치나(from, to, r.period_from, r.period_to))
    .map((r) => ({
      batch: r.batch_label as string,
      from: (r.period_from ?? "") as string,
      to: (r.period_to ?? "") as string,
      cycle: (r.cycle_text ?? "") as string,
    }));
}

// ── 대사 ───────────────────────────────────────────────────
type Sourced = Line & { sheet: string };

export function diffAll(lines: Sourced[], profileId: number): DiffLine[] {
  const svc = serviceIndex(profileId);
  const tier = tierIndex(profileId);
  const known = recipientIndex();

  // 파일 안에서 새로 만들어질 사람 / 이번 파일에서 이미 본 의뢰
  const madeHere = new Map<string, true>();
  const seenHere = new Map<string, { from: string | null; cycle: string; copay: string; row: number }>();
  const seenDup = new Map<string, number>();

  // 기간이 이른 것부터 처리합니다. 올린 순서·시트 순서와 무관하게
  // 언제나 같은 결과가 나오게 하려는 것입니다.
  const ordered = [...lines].sort((a, b) =>
    String(a.period.from ?? "9999").localeCompare(String(b.period.from ?? "9999")) ||
    a.row - b.row
  );

  const out: DiffLine[] = ordered.map((l): DiffLine => {
    const problems = [...l.problems];
    const serviceId = svc.get(squash(l.service)) ?? null;
    if (l.service && !serviceId) problems.push(`「${l.service}」는 서비스 목록에 없습니다`);

    const copayTierId = tier(l.copay);
    if (l.copay && !copayTierId) problems.push(`「${l.copay}」는 본인부담 구간에 없습니다`);

    const key = personKey(l.name, l.birth);
    const pool = known.get(key) ?? [];

    let recipientId: string | null = null;
    let candidates: DiffLine["candidates"] = [];
    let 보류 = false;

    if (pool.length === 1) {
      const verdict = samePerson(pool[0], l.address, l.phone);
      if (verdict) recipientId = pool[0].id;
      else { 보류 = true; candidates = pool.map(strip); }
    } else if (pool.length > 1) {
      const hit = pool.filter((k) => samePerson(k, l.address, l.phone) === true);
      if (hit.length === 1) recipientId = hit[0].id;
      else { 보류 = true; candidates = pool.map(strip); }
    }

    const 이전상태 = recipientId ? pool.find((k) => k.id === recipientId)?.status : undefined;

    const changes: { field: string; before: string; after: string }[] = [];
    let state: State;

    // 같은 사람·같은 서비스가 '같은 시트 안에' 두 번 있으면 중복입니다.
    // 다른 차수에 또 나오는 건 정상(연장·변경)이므로 시트까지 열쇠에 넣습니다.
    const dupKey = `${l.sheet}|${key}|${l.service}`;
    const dupOf = seenDup.get(dupKey) ?? null;
    if (dupOf === null) seenDup.set(dupKey, l.row);

    // 비교 기준은 사람 단위로 누적합니다 (시트와 무관).
    const lineKey = `${key}|${l.service}`;
    const before = seenHere.get(lineKey);

    if (problems.length) {
      state = "확인필요";
    } else if (보류) {
      state = "동명이인";
    } else if (!recipientId && !madeHere.has(key)) {
      state = "신규";
      madeHere.set(key, true);
    } else if (!recipientId) {
      state = before ? cmpInFile(before, l, changes) : "추가";
    } else {
      const prev = serviceId ? currentReferral(recipientId, serviceId) : null;
      // 파일 안에서 본 것과 자료함에 있는 것 중 **기간이 늦은 쪽**을 기준으로 삼습니다.
      // 올린 순서가 아니라 기간이 판단 기준이어야 되돌아가는 일이 없습니다.
      const fromFile = before
        ? { from: before.from, cycle: before.cycle, copay: before.copay } : null;
      const fromDb = prev
        ? { from: prev.period_from, cycle: prev.cycle_text, copay: prev.copay_type } : null;
      const base = !fromFile ? fromDb : !fromDb ? fromFile
        : String(fromDb.from ?? "") > String(fromFile.from ?? "") ? fromDb : fromFile;

      if (!base) {
        state = 이전상태 && 이전상태 !== "이용" ? "재개" : "추가";
      } else {
        const inFrom = String(l.period.from ?? ""), haveFrom = String(base.from ?? "");
        if (inFrom && haveFrom && inFrom < haveFrom) {
          state = "지난차수";
        } else {
          push(changes, "기간 시작", base.from, l.period.from);
          push(changes, "주기", base.cycle, l.cycle.text);
          push(changes, "본인부담", base.copay, l.copay);
          state = changes.length
            ? (이전상태 && 이전상태 !== "이용" ? "재개" : "변경")
            : "유지";
        }
      }
    }

    // 이 사람·이 서비스에 대해 '가장 늦은 기간'만 기억해 둡니다.
    if (!before || String(l.period.from ?? "") >= String(before.from ?? "")) {
      seenHere.set(lineKey, {
        from: l.period.from, cycle: l.cycle.text, copay: l.copay, row: l.row,
      });
    }

    /*
     * 이미 있는 의뢰와 기간이 겹치는가.
     * 이미 있는 사람·이미 있는 서비스일 때만 볼 수 있습니다 —
     * 새로 만들어질 사람에게는 견줄 것이 없습니다.
     */
    const overlaps = recipientId && serviceId
      ? 겹치는의뢰(recipientId, serviceId, l.period.from, l.period.to)
      : [];

    return {
      sheet: l.sheet, row: l.row, dupOf,
      name: l.name, birth: l.birth, dong: l.dong, gender: l.gender,
      address: l.address, phone: l.phone,
      service: l.service, serviceId,
      periodFrom: l.period.from, periodTo: l.period.to, periodMonths: l.period.months,
      cycleText: l.cycle.text, cycleUnit: l.cycle.unit, cycleCount: l.cycle.count,
      copay: l.copay, copayTierId,
      note: l.note,
      state, recipientId, changes, problems, candidates, overlaps,
    };
  });

  // 보기 좋게 시트·줄 순서로 되돌립니다
  return out.sort((a, b) => a.sheet.localeCompare(b.sheet) || a.row - b.row);
}

const strip = (k: Known) => ({
  id: k.id, name: k.name, birth: k.birth, address: k.address, phone: k.phone,
});

function push(list: any[], field: string, a: any, b: any) {
  const before = String(a ?? ""), after = String(b ?? "");
  if (before !== after) list.push({ field, before, after });
}

function cmpInFile(
  before: { from: string | null; cycle: string; copay: string },
  l: Sourced, changes: any[]
): State {
  const inFrom = String(l.period.from ?? ""), haveFrom = String(before.from ?? "");
  if (inFrom && haveFrom && inFrom < haveFrom) return "지난차수";
  push(changes, "기간 시작", before.from, l.period.from);
  push(changes, "주기", before.cycle, l.cycle.text);
  push(changes, "본인부담", before.copay, l.copay);
  return changes.length ? "변경" : "유지";
}

// ── 파일 → 미리보기 ────────────────────────────────────────
export function preview(buf: Buffer, password?: string) {
  const sheets = readSheets(buf, password);
  const all: Sourced[] = [];
  const read: { name: string; rows: number; headerRow: number; skipped?: string }[] = [];

  for (const sh of sheets) {
    const headerAt = findHeader(sh.rows);
    if (headerAt < 0) {
      read.push({ name: sh.name, rows: 0, headerRow: 0, skipped: "머리글 줄을 못 찾음" });
      continue;
    }
    const map = mapColumns(sh.rows[headerAt]);
    const missing = (["name", "service", "period", "cycle"] as Field[])
      .filter((f) => map[f] === undefined);
    if (missing.length) {
      const 한글: Record<string, string> = {
        name: "성명", service: "서비스명", period: "서비스기간", cycle: "주기/횟수",
      };
      read.push({
        name: sh.name, rows: 0, headerRow: headerAt + 1,
        skipped: `필요한 열 없음: ${missing.map((m) => 한글[m]).join(", ")}`,
      });
      continue;
    }
    const lines = parseLines(sh.rows, headerAt, map).map((l) => ({ ...l, sheet: sh.name }));
    all.push(...lines);
    read.push({ name: sh.name, rows: lines.length, headerRow: headerAt + 1 });
  }

  if (!all.length) {
    throw new Error(
      "읽을 수 있는 시트가 없습니다. 성명·서비스명·서비스기간·주기 열이 있는지 확인해 주세요."
    );
  }

  const org = db.query<{ profile_id: number }, []>(
    "SELECT profile_id FROM organization WHERE id = 1"
  ).get();

  const lines = diffAll(all, org?.profile_id ?? 1);

  purgeStash();
  const token = crypto.randomUUID();
  STASH.set(token, { at: Date.now(), lines });

  return { token, sheets: read, lines, summary: tally(lines) };
}

export function tally(lines: DiffLine[]) {
  const t: Record<string, number> = {
    신규: 0, 추가: 0, 변경: 0, 재개: 0, 유지: 0, 지난차수: 0, 확인필요: 0, 동명이인: 0,
  };
  for (const l of lines) t[l.state]++;
  const people = new Set(lines.map((l) => personKey(l.name, l.birth)));
  return {
    ...t, 줄수: lines.length, 사람수: people.size,
    반영대상: lines.filter(canApply).length,
    // 기간이 겹치는 줄 — 반영은 되지만 사람이 한 번 봐야 합니다.
    재의뢰: lines.filter((l) => l.overlaps?.length).length,
  };
}

const canApply = (l: DiffLine) =>
  APPLY_OK.includes(l.state) ||
  (l.state === "확인필요" && !!l.fixServiceId) ||
  (l.state === "동명이인" && !!l.fixRecipientId);

// ── 관리자가 손으로 고친 값 반영 ───────────────────────────
export function fix(token: string, row: number, sheet: string, patch: {
  serviceId?: number | null; recipientId?: string | null; newPerson?: boolean;
}) {
  purgeStash();
  const held = STASH.get(token);
  if (!held) throw new Error("미리보기가 만료되었습니다. 파일을 다시 올려 주세요.");
  const l = held.lines.find((x) => x.row === row && x.sheet === sheet);
  if (!l) throw new Error("그 줄을 찾지 못했습니다.");

  if (patch.serviceId !== undefined) {
    l.fixServiceId = patch.serviceId;
    l.serviceId = patch.serviceId;
    l.problems = l.problems.filter((p) => !p.includes("서비스 목록"));
  }
  if (patch.newPerson) {
    l.fixRecipientId = null;
    l.recipientId = null;
    l.state = "신규";
    l.candidates = [];
  } else if (patch.recipientId !== undefined) {
    l.fixRecipientId = patch.recipientId;
    l.recipientId = patch.recipientId;
    l.candidates = [];
    l.state = "추가";
  }
  if (l.state === "확인필요" && l.problems.length === 0 && l.serviceId) {
    l.state = l.recipientId ? "추가" : "신규";
  }
  return { line: l, summary: tally(held.lines) };
}

// ── 반영 ───────────────────────────────────────────────────
export function apply(token: string, skip: { sheet: string; row: number }[], who: string) {
  purgeStash();
  const held = STASH.get(token);
  if (!held) throw new Error("미리보기가 만료되었습니다. 파일을 다시 올려 주세요.");

  const off = new Set(skip.map((s) => `${s.sheet}|${s.row}`));
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  let 새사람 = 0, 새의뢰 = 0, 건너뜀 = 0, 재개 = 0, 부담변경 = 0;
  const batches = new Set<string>();

  const run = db.transaction(() => {
    const made = new Map<string, string>();

    // 기간이 이른 것부터 넣습니다.
    const ordered = [...held.lines].sort((a, b) =>
      String(a.periodFrom ?? "9999").localeCompare(String(b.periodFrom ?? "9999")) || a.row - b.row
    );

    for (const l of ordered) {
      if (off.has(`${l.sheet}|${l.row}`) || !canApply(l)) { 건너뜀++; continue; }

      const key = personKey(l.name, l.birth);
      let rid = l.recipientId ?? made.get(key) ?? null;

      if (!rid) {
        rid = crypto.randomUUID();
        const payload = JSON.stringify({
          name: l.name, birth: normBirth(l.birth), gender: l.gender,
          phone: l.phone, phoneHome: "", address: l.address,
          lat: null, lng: null, guardians: [],
          cctv: "", pet: "", caution: "", selfSign: true,
        });
        const search = [l.name, l.phone, l.dong, l.address, l.birth]
          .filter(Boolean).join(" ").toLowerCase();
        db.run(
          `INSERT INTO recipient
             (id, payload, search_text, dong, status, status_since,
              copay_tier_id, memo, created_at, updated_at)
           VALUES (?, ?, ?, ?, '이용', ?, ?, '', ?, ?)`,
          [rid, payload, search, l.dong, l.periodFrom ?? today, l.copayTierId, now, now]
        );
        logChange(rid, "등록", "", `${l.sheet} 의뢰`, l.periodFrom ?? today, who, now);
        db.run(
          `INSERT INTO status_change (recipient_id, from_status, to_status, changed_on, reason, created_at)
           VALUES (?, NULL, '이용', ?, ?, ?)`,
          [rid, l.periodFrom ?? today, `${l.sheet} 의뢰 반영`, now]
        );
        집표(rid);       // 지자체 의뢰로 들어온 분도 등록하는 자리에서 바로
        made.set(key, rid);
        새사람++;
      } else {
        // 본인부담 구간이 바뀌었으면 이력을 남기고 갱신합니다.
        if (l.copayTierId) {
          const cur = db
            .query<{ copay_tier_id: number | null; status: string }, [string]>(
              "SELECT copay_tier_id, status FROM recipient WHERE id = ?"
            ).get(rid);
          if (cur && cur.copay_tier_id !== l.copayTierId) {
            const nameOf = (id: number | null) => id
              ? (db.query<{ label: string }, [number]>(
                  "SELECT label FROM copay_tier WHERE id = ?").get(id)?.label ?? "")
              : "없음";
            logChange(rid, "본인부담", nameOf(cur.copay_tier_id), nameOf(l.copayTierId),
                      l.periodFrom ?? today, who, now);
            db.run("UPDATE recipient SET copay_tier_id = ?, updated_at = ? WHERE id = ?",
                   [l.copayTierId, now, rid]);
            부담변경++;
          }
          // 종결·중단이었다가 다시 의뢰가 오면 이용으로 되돌립니다.
          if (cur && cur.status !== "이용" && l.state === "재개") {
            db.run(
              "UPDATE recipient SET status = '이용', status_since = ?, status_reason = ?, suspend_deadline = NULL, updated_at = ? WHERE id = ?",
              [l.periodFrom ?? today, `${l.sheet} 재의뢰`, now, rid]
            );
            db.run(
              `INSERT INTO status_change (recipient_id, from_status, to_status, changed_on, reason, created_at)
               VALUES (?, ?, '이용', ?, ?, ?)`,
              [rid, cur.status, l.periodFrom ?? today, `${l.sheet} 재의뢰`, now]
            );
            재개++;
          }
        }
      }

      db.run(
        `INSERT INTO referral
           (batch_label, recipient_id, service_id, period_from, period_to, period_months,
            cycle_unit, cycle_count, cycle_text, copay_type, note, diff_state, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [l.sheet, rid, l.serviceId, l.periodFrom, l.periodTo, l.periodMonths,
         l.cycleUnit, l.cycleCount, l.cycleText, l.copay, l.note, l.state, now]
      );
      batches.add(l.sheet);
      새의뢰++;
    }
  });
  run();

  STASH.delete(token);
  return {
    batches: [...batches], 새사람, 새의뢰, 건너뜀, 재개, 부담변경,
  };
}

/** 대상자에게 생긴 변화를 날짜와 함께 남깁니다. */
function logChange(
  rid: string, field: string, before: string, after: string,
  on: string, who: string, now: string
) {
  db.run(
    `INSERT INTO recipient_change
       (recipient_id, field, before_val, after_val, changed_on, who, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [rid, field, before, after, on, who, now]
  );
}
