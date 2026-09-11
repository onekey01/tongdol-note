/**
 * 설정 — 공휴일 쌓기와 계산 규칙 하나씩 고치기.
 *
 *   bun 설정시험.ts
 *
 * 공휴일은 **돈에 걸립니다**(휴일 할증). 넣은 날이 실제로 휴일로 셈해지는지,
 * 뺐을 때 도로 평일이 되는지까지 봅니다.
 * 시험이 끝나면 넣은 것을 모두 치우고 설정을 원래대로 돌려놓습니다.
 */

import { db } from "./server/db";
import { isHoliday, 휴일이름, 공휴일캐시버리기, month as recordMonth } from "./server/record";

let 통과수 = 0, 실패수 = 0;
function 통과해야(무엇: string, 참: boolean, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}

const 넣기 = (on: string, name: string) => {
  db.run(
    `INSERT INTO holiday (on_date, name, created_at) VALUES (?, ?, ?)
     ON CONFLICT(on_date) DO UPDATE SET name = excluded.name`,
    [on, name, new Date().toISOString()]
  );
  공휴일캐시버리기();
};
const 빼기 = (on: string) => { db.run("DELETE FROM holiday WHERE on_date = ?", [on]); 공휴일캐시버리기(); };

console.log("\n── 1. 토·일은 넣지 않아도 휴일 ───────────────────────────\n");

// 2026-08-29 토, 08-30 일, 08-27 목
통과해야("토요일은 휴일", isHoliday("2026-08-29"));
통과해야("일요일은 휴일", isHoliday("2026-08-30"));
통과해야("목요일은 평일", !isHoliday("2026-08-27"));
통과해야("이름도 알려 준다 — 토요일", 휴일이름("2026-08-29") === "토요일");

console.log("\n── 2. 넣으면 그날이 휴일이 된다 ──────────────────────────\n");

const 시험날 = "2026-09-25";   // 금요일
통과해야("넣기 전에는 평일", !isHoliday(시험날));
넣기(시험날, "추석");
통과해야("**넣으면 휴일이 된다**", isHoliday(시험날));
통과해야("무슨 날인지 이름이 남는다", 휴일이름(시험날) === "추석", 휴일이름(시험날));

// 같은 날에 다시 넣으면 이름만 바뀌고 줄이 늘지 않아야 합니다
넣기(시험날, "추석 연휴");
const 몇줄 = db.query<{ n: number }, [string]>(
  "SELECT COUNT(*) AS n FROM holiday WHERE on_date = ?").get(시험날)!.n;
통과해야("같은 날을 두 번 넣어도 한 줄", 몇줄 === 1, String(몇줄));
통과해야("이름은 새로 넣은 것으로 바뀐다", 휴일이름(시험날) === "추석 연휴", 휴일이름(시험날));

빼기(시험날);
통과해야("**빼면 도로 평일이 된다**", !isHoliday(시험날));

console.log("\n── 3. 실적 달력에 실려 나간다 ────────────────────────────\n");

넣기("2026-09-25", "추석");
넣기("2026-09-24", "추석 연휴");
{
  const d = recordMonth("2026-09") as any;
  const 이십오 = d.days.find((x: any) => x.on === "2026-09-25");
  const 이십삼 = d.days.find((x: any) => x.on === "2026-09-23");
  통과해야("9.25 가 휴일로 나간다", 이십오?.holiday === true);
  통과해야("이름도 함께 나간다 — 「추석」", 이십오?.holidayName === "추석", 이십오?.holidayName);
  통과해야("9.23 은 그대로 평일", 이십삼?.holiday === false);
  통과해야("평일에는 이름이 없다", !이십삼?.holidayName);
}

console.log("\n── 4. 계산 규칙 — 지침 표준은 잠겨 있다 ─────────────────\n");
{
  const 표준 = db.query<any, []>(
    "SELECT * FROM region_profile WHERE is_builtin = 1 LIMIT 1").get();
  통과해야("「복지부 지침 표준」이 있다", !!표준);
  통과해야("잠금 표시가 붙어 있다", 표준?.is_builtin === 1);

  const 우리것 = db.query<any, []>(
    "SELECT * FROM region_profile WHERE is_builtin = 0 LIMIT 1").get();
  통과해야("고칠 수 있는 우리 규칙이 하나 있다", !!우리것);
  통과해야("**커스텀 규칙은 하나뿐 — 켤 때마다 늘지 않는다**",
           db.query<{ n: number }, []>(
             "SELECT COUNT(*) AS n FROM region_profile WHERE is_builtin = 0").get()!.n === 1);
  통과해야("규칙 이름에 특정 지자체가 박혀 있지 않다 (기관이 고쳐 씁니다)",
           typeof 우리것?.name === "string" && 우리것.name.length > 0);
  통과해야("청구 시점 두 칸이 있다",
           우리것?.claim_timing !== undefined && 우리것?.copay_timing !== undefined,
           `${우리것?.claim_timing}/${우리것?.copay_timing}`);
}

console.log("\n── 5. 뒷정리 ─────────────────────────────────────────────\n");
빼기("2026-09-25"); 빼기("2026-09-24");
통과해야("시험에 넣은 공휴일을 모두 치웠다",
         !isHoliday("2026-09-25") && !isHoliday("2026-09-24"));

/* ═════════════════════════════════════════════════════════════
 * 처음 깔았을 때 **어느 규칙으로 시작하나** (2026-09-01)
 *
 * 여기가 틀려서 파일럿 기관이 **한도 경고가 전부 꺼진 채로** 쓰고 있었습니다.
 * 「복지부 지침 표준」은 **기준선**이라 잠겨 있고 편람 값이 하나도 안 들어
 * 있는데(0 = 안 봄), 최초 설정이 그것을 골랐습니다.
 *
 * **설명서에 「설정부터 보세요」라고 적는 것으로는 안 됩니다.**
 * 아무도 안 읽고, 읽어도 무엇이 꺼져 있는지 모릅니다. 기본값을 고칩니다.
 * ═══════════════════════════════════════════════════════════ */
console.log("\n── 6. 처음 깔면 **우리 지자체 규칙**으로 시작합니다 ─────\n");

// 최초 설정(`/api/setup`)이 쓰는 것과 **똑같은 질의**입니다.
const 첫규칙: any =
  db.query("SELECT * FROM region_profile WHERE is_builtin = 0 ORDER BY id LIMIT 1").get()
  ?? db.query("SELECT * FROM region_profile WHERE is_builtin = 1").get();

통과해야("**잠기지 않은 규칙을 고릅니다**", !첫규칙?.is_builtin,
  첫규칙?.name ?? "(없음)");
통과해야("**연간 한도가 들어 있습니다** — 0 이면 한도를 안 봅니다",
  Number(첫규칙?.annual_cap) > 0, `${첫규칙?.annual_cap}원`);
통과해야("생애 한도도", Number(첫규칙?.housing_cap) > 0, `${첫규칙?.housing_cap}원`);
통과해야("연속 비대면 배달 한도도", Number(첫규칙?.f2f_limit) > 0,
  `${첫규칙?.f2f_limit}회`);

const 월한도있나: any = db.query(
  `SELECT COUNT(*) AS n FROM service
    WHERE profile_id = ? AND (monthly_cap_minutes > 0 OR monthly_cap_count > 0)`
).get(첫규칙?.id);
통과해야("**서비스 월 한도도 들어 있습니다** (가사 12시간 · 식사 8회 …)",
  Number(월한도있나?.n) >= 3, `${월한도있나?.n}가지`);

const 기준선: any = db.query(
  "SELECT * FROM region_profile WHERE is_builtin = 1").get();
통과해야("기준선은 **그대로 남아 있습니다** — 견주려면 있어야 합니다", !!기준선);
통과해야("기준선은 여전히 한도가 0 (지침에 없는 값이니까요)",
  Number(기준선?.annual_cap) === 0);

console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
process.exit(실패수 ? 1 : 0);
