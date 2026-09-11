import * as XLSX from "xlsx";
import { openXlsx } from "./office-crypt";

/**
 * 지자체가 보내주는 「서비스 제공 의뢰 대상자 명단」 엑셀을 읽습니다.
 *
 * 한 줄 = 대상자 한 명의 서비스 하나입니다.
 * 같은 사람이 서비스 세 개를 받으면 세 줄로 옵니다.
 *
 * 지자체마다 열 이름이 조금씩 다를 수 있어서 이름을 '비슷하게' 찾습니다.
 * 못 찾으면 사람이 직접 짝을 지어 줄 수 있게 화면에서 고르게 합니다.
 */

export type Sheet = { name: string; rows: string[][] };

export function readSheets(buf: Buffer, password?: string): Sheet[] {
  const wb = XLSX.read(openXlsx(buf, password), { type: "buffer" });
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], {
      header: 1, raw: false, defval: "", blankrows: false,
    }),
  }));
}

// ── 열 찾기 ────────────────────────────────────────────────
export type Field =
  | "seq" | "dong" | "name" | "birth" | "gender" | "address" | "phone"
  | "service" | "period" | "cycle" | "copay" | "note";

const LABELS: Record<Field, string[]> = {
  seq: ["연번", "번호", "순번", "no"],
  dong: ["읍면", "읍면동", "행정동", "지역"],
  name: ["성명", "이름", "대상자명", "대상자"],
  birth: ["생년월일", "생년", "생일"],
  gender: ["성별"],
  address: ["주소", "주소지"],
  phone: ["연락처", "전화", "전화번호", "휴대전화"],
  service: ["서비스명", "서비스", "서비스내용"],
  period: ["서비스기간", "기간", "제공기간", "이용기간"],
  cycle: ["주기/횟수", "주기", "횟수", "제공주기"],
  copay: ["서비스 유형", "서비스유형", "본인부담", "부담률", "유형"],
  note: ["비고", "특이사항", "메모"],
};

const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, "").toLowerCase();

/** 머리글이 있는 줄을 찾습니다. 제목 줄이 위에 몇 개 있어도 넘어갑니다. */
export function findHeader(rows: string[][]): number {
  let best = -1, bestHit = 0;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cells = rows[i].map(norm);
    let hit = 0;
    for (const words of Object.values(LABELS)) {
      if (cells.some((c) => c && words.some((w) => c === norm(w)))) hit++;
    }
    if (hit > bestHit) { bestHit = hit; best = i; }
  }
  return bestHit >= 4 ? best : -1;
}

export function mapColumns(header: string[]): Partial<Record<Field, number>> {
  const cells = header.map(norm);
  const map: Partial<Record<Field, number>> = {};
  for (const [field, words] of Object.entries(LABELS) as [Field, string[]][]) {
    // 먼저 완전히 같은 이름, 없으면 포함하는 이름을 찾습니다.
    let at = cells.findIndex((c) => c && words.some((w) => c === norm(w)));
    if (at < 0) at = cells.findIndex((c) => c && words.some((w) => c.includes(norm(w))));
    if (at >= 0) map[field] = at;
  }
  return map;
}

// ── 값 읽기 ────────────────────────────────────────────────

/** "2026.4.21.~2026.6.30. (2개월)" → 시작·끝·개월수 */
export function parsePeriod(text: string) {
  const t = String(text ?? "");
  const dates = [...t.matchAll(/(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/g)].map(
    (m) => `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`
  );
  const months = t.match(/(\d+)\s*개월/);
  return {
    from: dates[0] ?? null,
    to: dates[1] ?? null,
    months: months ? Number(months[1]) : null,
    text: t.trim(),
  };
}

/** "주 2회" · "월 1회" · "생애 1회" → 단위와 횟수 */
export function parseCycle(text: string) {
  const t = String(text ?? "").trim();
  const n = t.match(/(\d+)\s*회/);
  const count = n ? Number(n[1]) : null;
  const unit = /생애|평생|1회성/.test(t) ? "lifetime"
    : /주/.test(t) ? "week"
    : /월|달/.test(t) ? "month"
    : null;
  return { unit, count, text: t };
}

export type Line = {
  row: number;              // 엑셀에서 몇 번째 줄인지 (문제 생기면 여기를 보라고)
  seq: string;
  dong: string;
  name: string;
  birth: string;
  gender: string;
  address: string;
  phone: string;
  service: string;
  period: ReturnType<typeof parsePeriod>;
  cycle: ReturnType<typeof parseCycle>;
  copay: string;
  note: string;
  problems: string[];       // 이 줄에서 이상한 점
};

/**
 * 생년월일을 YYYY-MM-DD 로 맞춥니다.
 *
 * 이게 왜 중요한가:
 * 사람을 알아보는 열쇠가 「성명 + 생년월일」입니다.
 * 같은 사람이 1차수에 `1938-04-11`, 3차수에 `1938.4.11` 로 적혀 오면
 * 맞춰주지 않는 한 **두 사람으로 갈라집니다.** 조용히 벌어지는 사고라
 * 나중에 발견하면 되돌리기가 아주 번거롭습니다.
 *
 * 그래서 숫자 개수만 보지 않고 구분자까지 읽습니다.
 *   1938-04-11 · 1938.4.11 · 1938/4/11 · 1938년 4월 11일 · 38.4.11 · 380411
 */
export function normBirth(v: string): string {
  const s = String(v ?? "").trim();
  if (!s) return "";

  const pad = (n: string) => n.padStart(2, "0");
  const fullYear = (y: string) => {
    if (y.length === 4) return y;
    // 두 자리 연도. 대상자가 어르신이라 30보다 크면 1900년대로 봅니다.
    const n = Number(y);
    return String(n > 30 ? 1900 + n : 2000 + n);
  };

  // 1) 구분자가 있는 형태
  const m = s.match(/(\d{2,4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (m) {
    const mo = Number(m[2]), d = Number(m[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${fullYear(m[1])}-${pad(m[2])}-${pad(m[3])}`;
    }
  }

  // 2) 숫자만 붙어 있는 형태
  const digits = s.replace(/\D/g, "");
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  if (digits.length === 6) {
    return `${fullYear(digits.slice(0, 2))}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
  }

  return s;   // 못 알아보면 원문 그대로 (화면에서 사람이 보고 판단)
}

export function parseLines(
  rows: string[][], headerAt: number, map: Partial<Record<Field, number>>
): Line[] {
  const at = (r: string[], f: Field) => {
    const i = map[f];
    return i === undefined ? "" : String(r[i] ?? "").trim();
  };

  const out: Line[] = [];
  for (let i = headerAt + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = at(r, "name");
    const service = at(r, "service");
    // 이름도 서비스도 없으면 빈 줄이거나 합계 줄입니다.
    if (!name && !service) continue;

    const period = parsePeriod(at(r, "period"));
    const cycle = parseCycle(at(r, "cycle"));
    const problems: string[] = [];
    if (!name) problems.push("성명이 없습니다");
    if (!service) problems.push("서비스명이 없습니다");
    if (!period.from) problems.push("서비스기간을 읽지 못했습니다");
    if (!cycle.unit || !cycle.count) problems.push("주기/횟수를 읽지 못했습니다");

    out.push({
      row: i + 1,
      seq: at(r, "seq"),
      dong: at(r, "dong"),
      name,
      birth: normBirth(at(r, "birth")),
      gender: at(r, "gender"),
      address: at(r, "address"),
      phone: at(r, "phone"),
      service,
      period,
      cycle,
      copay: at(r, "copay"),
      note: at(r, "note"),
      problems,
    });
  }
  return out;
}

/**
 * 사람을 알아보는 열쇠. 성명 + 생년월일입니다.
 * 들어오는 값이 어떤 모양이든 여기서 한 번 더 맞춰 놓습니다.
 * (자료함에 이미 들어간 값과 새로 올린 값의 모양이 다를 수 있습니다)
 */
export function personKey(name: string, birth: string): string {
  return `${String(name ?? "").replace(/\s+/g, "")}|${normBirth(birth).replace(/\D/g, "")}`;
}
