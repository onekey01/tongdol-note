/**
 * ── 서식8 을 **진짜 자료함으로** 한 장 뽑아 봅니다 ───────────
 *
 * 시험(`비용총괄시험.ts`)은 값을 손으로 지어 넣습니다. 그것만으로는
 * **자료함에서 값을 제대로 꺼내는지**를 못 봅니다. 그래서 여기서
 * 대상자·의뢰·실적을 실제로 넣고, 청구를 확정하고, 그 청구로 서식8 을 뽑습니다.
 *
 *   bun 도구/비용총괄맛보기.ts
 *
 * 나온 파일은 `산출/서식8/` 에 둡니다. 한글로 열어 확인하시면 됩니다.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { db, initDb } from "../server/db";
import { issue } from "../server/billing";
import { 모으기, build, 파일이름 } from "../server/비용총괄";

/*
 * ★ 자료함을 손보기 전에 **칸을 맞춰 둡니다** (2026-09-11).
 *
 *   갱신(migrate)은 `initDb()` 안에서 돕니다. 그런데 그것을 부르는 것은
 *   프로그램 본체(server/index.ts)뿐이라, 이 도구를 곧장 `bun` 으로 돌리면
 *   **옛 자료함을 그대로 열어** 새로 생긴 칸을 못 찾습니다 —
 *
 *       SQLiteError: no such column: a.monthly_times
 *
 *   실제로 2026-09-11 에 이것으로 멈췄습니다. 한 줄이면 끝날 일입니다.
 */
initDb();


const 낼곳 = join(import.meta.dir, "..", "산출", "서식8");
mkdirSync(낼곳, { recursive: true });

const now = new Date().toISOString();
const 달 = "2026-08";

/* ── 대상자 한 사람 ──────────────────────────────────────── */
const rid = "맛보기-김순자";
db.run("DELETE FROM delivery WHERE recipient_id = ?", [rid]);
db.run("DELETE FROM billing WHERE recipient_id = ?", [rid]);
db.run("DELETE FROM referral WHERE recipient_id = ?", [rid]);
db.run("DELETE FROM recipient WHERE id = ?", [rid]);

const tier = db.query<any, []>(
  "SELECT id, rate FROM copay_tier ORDER BY rate LIMIT 1").get();

db.run(
  `INSERT INTO recipient (id, payload, dong, status, copay_tier_id,
                          created_at, updated_at)
   VALUES (?, ?, ?, 'active', ?, ?, ?)`,
  [rid, JSON.stringify({
    name: "김순자", birth: "1943-04-11", gender: "여",
    address: "전남 해남군 해남읍 중앙1로 1", phone: "010-0000-0000",
  }), "해남읍", tier?.id ?? null, now, now]);

/* ── 서비스 두 가지 ──────────────────────────────────────── */
const 가사 = db.query<any, []>(
  "SELECT * FROM service WHERE unit = 'hour' ORDER BY sort_order LIMIT 1").get();
const 식사 = db.query<any, []>(
  "SELECT * FROM service WHERE unit = 'meal' ORDER BY sort_order LIMIT 1").get();
if (!가사 || !식사) throw new Error("설정에 서비스가 없습니다.");

for (const sv of [가사, 식사])
  db.run(
    `INSERT INTO referral (recipient_id, service_id, period_from, period_to,
                           batch_label, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [rid, sv.id, "2026-08-01", "2026-12-31", "맛보기", now]);

/* ── 실적 여덟 줄 — 서식이 준 다섯 줄을 넘깁니다 ─────────── */
const 실적: [string, any, number | null][] = [
  ["2026-08-03", 가사, 60],
  ["2026-08-05", 식사, null],
  ["2026-08-07", 가사, 40],   // 45분 미만 → 30분
  ["2026-08-10", 가사, 90],
  ["2026-08-12", 식사, null],
  ["2026-08-14", 가사, 10],   // 15분 미만 → 미산정(0원)
  ["2026-08-17", 가사, 120],
  ["2026-08-19", 식사, null],
];
for (const [날, sv, 분] of 실적)
  db.run(
    `INSERT INTO delivery (served_on, recipient_id, service_id, outcome,
                           minutes, is_holiday, planned, created_at)
     VALUES (?, ?, ?, '제공', ?, 0, 1, ?)`,
    [날, rid, sv.id, 분, now]);

/* ── 청구 확정 → 그 청구로 서식8 ─────────────────────────── */
const bill = issue(rid, 달, "맛보기");
const billId = Number((bill as any)?.id ?? (bill as any)?.billId ?? 0)
  || Number(db.query<any, [string]>(
       "SELECT id FROM billing WHERE recipient_id = ? ORDER BY id DESC LIMIT 1")
       .get(rid)?.id);

const v = 모으기(billId, { 담당자: "박병섭", 시설장: "박대표" });
console.log("── 모은 값 ──");
console.log("  기관 :", v.기관);
console.log("  이용자:", v.이용자);
console.log("  주요내용:", v.주요내용);
console.log("  보고 :", v.보고, " 시설장:", v.시설장);
console.table(v.줄들.map((x, i) => ({
  연번: i + 1, 일자: x.일자, 요일: x.요일,
  제공분: x.제공분, 단가: x.단가말,
  이용금액: x.이용금액, 인원: x.투입인원, 총금액: x.총금액,
})));
console.log("  총액 :", v.총액.toLocaleString("ko-KR"), "원");

/*
 * ── 청구서와 **같은 금액**이어야 합니다 ─────────────────────
 * 서식8 의 총액과 청구서의 서비스 총액이 다르면 군이 두 종이를 나란히
 * 놓고 되돌려 보냅니다. 여기서 그 자리에 걸리게 합니다.
 */
const 청구액 = Number(db.query<any, [number]>(
  "SELECT service_amount FROM billing WHERE id = ?").get(billId)?.service_amount ?? -1);
console.log(`  청구서 서비스 총액 : ${청구액.toLocaleString("ko-KR")} 원  →  ` +
  (청구액 === v.총액 ? "같습니다" : "★ 다릅니다 ★"));
if (청구액 !== v.총액) process.exit(1);

const 만든것 = build(v);
const 길 = join(낼곳, 파일이름(v));
writeFileSync(길, 만든것);
console.log(`\n만들었습니다 — ${파일이름(v)} (${만든것.length.toLocaleString()} 바이트)`);
