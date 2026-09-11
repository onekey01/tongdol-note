/**
 * ═══════════════════════════════════════════════════════════
 *  최초 설정 마법사 — **확인하지 않으면 홈이 안 열립니다**
 * ═══════════════════════════════════════════════════════════
 *
 * (2026-09-01 무무 안 · `할일.md` 7-하)
 *
 *   기관 정보  →  관리자 등록  →  ★ 필수 설정  →  홈
 *
 * ── 왜 필요한가 ────────────────────────────────────────────
 *
 * 지금까지는 기관명과 관리자만 넣으면 **곧장 홈**이었습니다. 그래서
 * 단가·한도·부담률이 **손도 안 댄 채로** 쓰이기 시작합니다.
 * 설명서에 적어도 안 읽힙니다 — **순서로 막습니다.**
 *
 * ★★ 이것이 가상의 걱정이 아니라는 증거 (2026-09-08 확인) —
 *   이 개발 자료함에는 8월 31일에 편람 값으로 고친 단가가
 *   **하나도 안 들어가 있었습니다.** 식사 10,100(편람 11,000) ·
 *   동행 17,000(편람 27,000) · 안전생활환경 생애 200만(편람 100만) ·
 *   빠졌어야 할 방문목욕이 그대로.
 *
 *   까닭은 단순합니다 — `seed.ts` 는 **자료함을 처음 만들 때만** 씁니다.
 *   이미 만들어진 자료함은 프로그램을 갱신해도 안 바뀝니다. 파일럿 PC 도
 *   같은 처지일 수 있습니다. **마법사는 정확히 이것을 잡습니다.**
 *
 * ── ★ 새로 적는 화면이 아니라 「확인하는 화면」입니다 ★ ──────
 *
 * 편람 기본값이 **이미 다 채워져 있습니다.** 맞으면 「이대로 시작」을
 * 누르면 되고, 다른 지자체면 그 자리에서 고칩니다. **1분**입니다.
 *
 * ── 건너뛰기를 두지 않습니다 ────────────────────────────────
 * 값이 다 채워져 있어 누를 것이 확인뿐입니다. 빠져나갈 구멍을 두면
 * 반드시 그리로 갑니다.
 *
 * ── 셈을 여기서 새로 하지 않습니다 ──────────────────────────
 * 저장은 **설정 화면이 쓰는 그 표에 그대로** 씁니다. 마법사만 아는
 * 값이 따로 생기면, 마법사에서 고친 것과 설정에서 고친 것이 언젠가
 * 어긋납니다.
 */
import { db } from "./db";

export type 첫설정서비스 = {
  id: number;
  name: string;
  unit: string;            // hour | meal | time
  단가: number;
  월한도분: number;
  월한도횟수: number;
  /** 1회 서비스 시간(분). 0 이면 안 정한 것 — 60분으로 봅니다 (v36). */
  한번분: number;
  생애한도: number | null;
  /** 이 서비스가 연간 한도 **바깥**인가 (안전생활환경개선). */
  연간바깥: boolean;
};

export type 첫설정구간 = { id: number; label: string; rate: number };

export type 첫설정 = {
  마쳤나: boolean;
  기관: string;
  규칙번호: number;
  규칙이름: string;
  연간한도: number;
  주거한도: number;
  비대면한도: number;
  비대면세는법: "연속" | "누적";
  서비스들: 첫설정서비스[];
  구간들: 첫설정구간[];
  올해공휴일: number;
  해: number;
};

/** 지금 이 기관이 쓰고 있는 값을 그대로 읽어 옵니다. */
export function 첫설정읽기(): 첫설정 {
  const org = db.query<any, []>("SELECT * FROM organization WHERE id = 1").get();
  if (!org) throw new Error("기관이 아직 없습니다.");
  const p = db.query<any, [number]>(
    "SELECT * FROM region_profile WHERE id = ?").get(Number(org.profile_id));
  if (!p) throw new Error("규칙을 찾을 수 없습니다.");

  const 해 = new Date().getFullYear();
  const 공휴 = db.query<{ c: number }, [string]>(
    "SELECT COUNT(*) AS c FROM holiday WHERE substr(on_date,1,4) = ?").get(String(해));

  return {
    마쳤나: !!org.setup_done_at,
    기관: String(org.name ?? ""),
    규칙번호: Number(p.id),
    규칙이름: String(p.name ?? ""),
    연간한도: Number(p.annual_cap ?? 0),
    주거한도: Number(p.housing_cap ?? 0),
    비대면한도: Number(p.f2f_limit ?? 3),
    비대면세는법: String(p.f2f_mode ?? "연속") === "누적" ? "누적" : "연속",
    서비스들: db.query<any, [number]>(
      `SELECT id, name, unit, unit_price, monthly_cap_minutes, monthly_cap_count,
              once_minutes, lifetime_cap, outside_annual_cap
         FROM service WHERE profile_id = ? AND active = 1 ORDER BY sort_order, id`
    ).all(p.id).map((s: any) => ({
      id: Number(s.id), name: String(s.name), unit: String(s.unit),
      단가: Number(s.unit_price ?? 0),
      월한도분: Number(s.monthly_cap_minutes ?? 0),
      월한도횟수: Number(s.monthly_cap_count ?? 0),
      // 1회 서비스 시간 (v36). 0 이면 안 정한 것 — 화면이 60을 보여 줍니다.
      한번분: Number(s.once_minutes ?? 0),
      생애한도: s.lifetime_cap == null ? null : Number(s.lifetime_cap),
      연간바깥: Number(s.outside_annual_cap ?? 0) === 1,
    })),
    구간들: db.query<any, [number]>(
      "SELECT id, label, rate FROM copay_tier WHERE profile_id = ? ORDER BY sort_order, id"
    ).all(p.id).map((t: any) => ({
      id: Number(t.id), label: String(t.label ?? ""), rate: Number(t.rate ?? 0),
    })),
    올해공휴일: Number(공휴?.c ?? 0),
    해,
  };
}

export type 첫설정보냄 = {
  규칙이름?: string;
  연간한도?: number;
  주거한도?: number;
  비대면한도?: number;
  비대면세는법?: string;
  서비스들?: { id: number; name?: string; 단가: number; 월한도분: number;
              월한도횟수: number; 한번분?: number; 생애한도: number | null }[];
  구간들?: { id: number; label: string; rate: number }[];
};

/**
 * 마법사가 보낸 숫자 하나.
 *
 * ── ★ 빈칸은 거절합니다 ★ (2026-09-09 파일럿 예행에서 찾음) ──
 *
 * 이 화면에서 **0 은 뜻이 있는 값**입니다 — 「이 한도는 안 봅니다」.
 * 그래서 빈칸을 0 으로 받아 주면 **칸을 비우고 마친 기관이 「한도 없음」
 * 으로 조용히 저장**되고, 한 달 뒤 청구가 통째로 틀립니다.
 *
 * 빈칸과 0 은 다른 것입니다. 빈칸이면 되돌려 보내고, 0 을 정말 넣고
 * 싶으면 0 을 치게 합니다.
 */
const 돈 = (v: unknown, 이름: string, 최대 = 100_000_000,
            영꼬리 = "한도를 안 보시려면 0 을 넣으세요.") => {
  if (v === null || v === undefined || String(v).trim() === "")
    throw new Error(`${이름}을(를) 적어 주세요. ${영꼬리}`);
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0) throw new Error(`${이름}은(는) 0 이상의 숫자여야 합니다.`);
  if (n > 최대) throw new Error(`${이름}이(가) 너무 큽니다.`);
  return n;
};

/**
 * 마법사가 보낸 값을 **한 번에** 씁니다.
 *
 * ★ `db.transaction` 으로 묶습니다. 가운데서 멈추면 **단가는 새 값인데
 *   한도는 옛 값**인 자료함이 남고, 그건 아무도 못 알아챕니다.
 */
export function 첫설정마치기(b: 첫설정보냄, 누가 = ""): 첫설정 {
  const org = db.query<any, []>("SELECT * FROM organization WHERE id = 1").get();
  if (!org) throw new Error("기관이 아직 없습니다.");
  const pid = Number(org.profile_id);
  const p = db.query<any, [number]>(
    "SELECT * FROM region_profile WHERE id = ?").get(pid);
  if (!p) throw new Error("규칙을 찾을 수 없습니다.");
  if (Number(p.is_builtin) === 1)
    throw new Error("「복지부 지침 표준」은 고칠 수 없습니다. 우리 지자체 규칙을 쓰세요.");

  const 이름 = String(b.규칙이름 ?? "").trim();
  if (!이름) throw new Error("우리 지자체 이름을 적어 주세요.");
  if (이름.length > 40) throw new Error("규칙 이름이 너무 깁니다.");

  const 연간 = 돈(b.연간한도 ?? 0, "연간 지원한도");
  const 주거 = 돈(b.주거한도 ?? 0, "안전생활환경 생애한도");
  /*
   * 비대면 한도도 **빈칸은 거절합니다.** 여기서 0 은 「비대면을 안 셉니다」
   * 라는 뜻이라, 빈칸을 0 으로 받으면 계약서 5-2 조(3회 연속이면 서비스
   * 전체 중지)를 아무도 안 지키는 자료함이 조용히 생깁니다.
   */
  if (b.비대면한도 === null || b.비대면한도 === undefined
      || String(b.비대면한도).trim() === "")
    throw new Error("비대면 배달 한도를 적어 주세요. 안 보시려면 0 을 넣으세요.");
  const 비대면 = Math.round(Number(b.비대면한도));
  if (!Number.isFinite(비대면) || 비대면 < 0 || 비대면 > 30)
    throw new Error("비대면 배달 한도는 0~30 사이여야 합니다.");
  const 세는법 = String(b.비대면세는법 ?? "연속") === "누적" ? "누적" : "연속";

  /* 서비스 — 우리 규칙의 것만 고칩니다. 남의 규칙 줄이 섞여 오면 버립니다. */
  const 내서비스 = new Set(db.query<any, [number]>(
    "SELECT id FROM service WHERE profile_id = ?").all(pid).map((s: any) => Number(s.id)));
  const 서비스들 = (b.서비스들 ?? []).filter((s) => 내서비스.has(Number(s.id)));

  const 내구간 = new Set(db.query<any, [number]>(
    "SELECT id FROM copay_tier WHERE profile_id = ?").all(pid).map((t: any) => Number(t.id)));
  const 구간들 = (b.구간들 ?? []).filter((t) => 내구간.has(Number(t.id)));
  for (const t of 구간들) {
    const r = Number(t.rate);
    if (!Number.isFinite(r) || r < 0 || r > 1)
      throw new Error("본인부담 비율은 0~100% 사이여야 합니다.");
    if (!String(t.label ?? "").trim())
      throw new Error("본인부담 구간의 이름을 적어 주세요.");
  }

  /* 자국을 남기려면 **바꾸기 전 값**이 있어야 합니다. */
  const 옛서비스 = new Map<number, any>(db.query<any, [number]>(
    "SELECT id, name, unit_price FROM service WHERE profile_id = ?"
  ).all(pid).map((s: any) => [Number(s.id), s]));

  const 지금 = new Date().toISOString();
  db.transaction(() => {
    db.run(
      `UPDATE region_profile
          SET name = ?, annual_cap = ?, housing_cap = ?, f2f_limit = ?, f2f_mode = ?
        WHERE id = ?`,
      [이름, 연간, 주거, 비대면, 세는법, pid]);

    for (const s of 서비스들) {
      db.run(
        `UPDATE service
            SET unit_price = ?, monthly_cap_minutes = ?, monthly_cap_count = ?,
                once_minutes = ?, lifetime_cap = ?, updated_at = ?
          WHERE id = ? AND profile_id = ?`,
        [돈(s.단가, `「${s.name ?? "서비스"}」 단가`, 10_000_000,
           "안 쓰는 서비스면 설정에서 꺼 두시면 됩니다."),
         돈(s.월한도분 ?? 0, "월 한도(분)", 100_000),
         돈(s.월한도횟수 ?? 0, "월 한도(횟수)", 1000),
         돈(s.한번분 ?? 0, "1회 서비스 시간(분)", 1440,
           "비워 두시면 60분으로 봅니다."),
         s.생애한도 == null || s.생애한도 === 0 ? null : 돈(s.생애한도, "생애한도"),
         지금, Number(s.id), pid]);
    }
    for (const t of 구간들) {
      db.run("UPDATE copay_tier SET label = ?, rate = ? WHERE id = ? AND profile_id = ?",
             [String(t.label).trim(), Number(t.rate), Number(t.id), pid]);
    }
    db.run("UPDATE organization SET setup_done_at = ? WHERE id = 1", [지금]);
  })();

  /*
   * 규칙을 바꾼 것은 **자국을 남깁니다.** 나중에 「단가가 언제 바뀌었나」를
   * 물을 사람이 있고, 그 답이 없으면 청구가 왜 달라졌는지 못 밝힙니다.
   */
  try {
    const 남기기 = (무엇: string, 옛값: string, 새값: string) => db.run(
      `INSERT INTO rule_change_log (changed_at, who, field, before_val, after_val, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [지금, 누가, 무엇, 옛값, 새값, "최초 설정에서 확인함"]);

    if (String(p.name) !== 이름) 남기기("규칙 이름", String(p.name), 이름);
    if (Number(p.annual_cap) !== 연간)
      남기기("연간 지원한도", String(p.annual_cap), String(연간));
    if (Number(p.housing_cap) !== 주거)
      남기기("안전생활환경 생애한도", String(p.housing_cap), String(주거));
    if (Number(p.f2f_limit) !== 비대면)
      남기기("비대면 배달 한도", String(p.f2f_limit), String(비대면));
    if (String(p.f2f_mode ?? "연속") !== 세는법)
      남기기("비대면 세는 법", String(p.f2f_mode ?? "연속"), 세는법);
    for (const s of 서비스들) {
      const 옛 = 옛서비스.get(Number(s.id));
      if (옛 && Number(옛.unit_price) !== 돈(s.단가, "단가", 10_000_000))
        남기기(`${옛.name} 단가`, String(옛.unit_price), String(Math.round(Number(s.단가))));
    }
  } catch { /* 자국 표가 없는 옛 자료함이면 넘어갑니다 */ }

  return 첫설정읽기();
}
