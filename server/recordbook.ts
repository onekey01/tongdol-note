import { 주소한줄 } from "./util";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "./db";
import { today } from "./util";
import { daysOf } from "./record";
import { Hwpx } from "./hwpx";
import { find, attr } from "./xml";
import { zipFiles } from "./zip";

/**
 * 서비스 제공기관 기록지 — **매달 지자체에 내는 단 하나의 서식.**
 *
 * ── 서식은 편람의 `<서식9>` 입니다 (2026-08-31 바꿔 끼움) ──────
 * 그 전까지는 어디선가 받은 **가로 7칸짜리**를 채우고 있었습니다.
 * 「2026년 해남군 통합돌봄 서비스 제공기관 업무편람」을 받아 대 보니
 * 군에 내는 것은 **세로 6칸**짜리 `<서식9>` 였습니다.
 *
 *   지금 것 : 세로 · 대분류 · 중분류 · **서비스 내용(상세)** · 주기 · 최초일 · 제공일
 *   옛 것   : 가로 · 대분류 · 중분류 · 소분류 · **서비스명** · 주기 · 최초일 · 제공일
 *
 * 「서비스명」 칸이 없어졌습니다. 편람이 그렇게 생겼으므로 **우리가 칸을
 * 더하지 않습니다.** 서비스명은 중분류에 이미 들어 있습니다(가사지원 = 가사지원).
 *
 * 서식 파일은 **편람에서 오려낸 것**입니다 — 한 칸도 다시 그리지 않았습니다.
 * `편람 hwpx로 바꾸기.bat` → 한글이 .hwp 를 .hwpx 로 → 서식9 문단만 떼어냄.
 * 옛 서식은 `서식/이전/` 에 남겨 두었습니다.
 *
 * ── 서식 행을 손대지 않습니다 ──────────────────────────────
 * 서식에 딸린 서비스 줄 **4개**에 실제 자료를 덮어쓰고, 남는 줄은 비웁니다.
 * 행을 늘리거나 지우면 한글이 파일을 열지 않습니다(행 번호·행 개수를 다시
 * 맞춰도 마찬가지였습니다). 서비스가 4종을 넘으면 **장을 나눠** 파일을 여럿 만듭니다.
 * (세로가 되며 5줄 → 4줄로 줄었습니다. 우리 기본 서비스가 5종이라
 *  다 받는 어르신은 이제 두 장이 나옵니다. 서식이 정한 것입니다.)
 *
 * ── 회차는 누적입니다 ──────────────────────────────────────
 * 매달 1부터 다시 세지 않습니다. 최초 제공일부터 이어서 셉니다.
 * 작성예시의 7월 기록지에 5월 28일이 「1회차」로 적혀 있는 것이 그 뜻입니다.
 * 그래서 이 칸은 달이 갈수록 길어집니다 —
 * **손으로 쓰면 가장 고통스럽고, 프로그램이 대신하면 가장 크게 줄어드는 칸**입니다.
 */

const ROWS_PER_SHEET = 4;          // 서식9 가 가진 서비스 줄 수
const R_NAME = 1, R_ORG = 2, R_SVC = 5, R_STATE = 10, R_NOTE = 11;
const 상태값 = ["증상악화", "개선", "변화없음"];

/** 서식 파일 — 프로그램 폴더에 함께 둡니다. */
const 서식이름 = "모니터링 기록지(서식9).hwpx";
function templatePath(): string {
  for (const p of [
    join(process.cwd(), "서식", 서식이름),
    join(import.meta.dir, "..", "서식", 서식이름),
  ]) if (existsSync(p)) return p;
  throw new Error(
    "기록지 서식 파일을 못 찾았습니다. 프로그램 폴더의 「서식」 안에 " +
    `「${서식이름}」가 있어야 합니다.`
  );
}

/** "2026-08-13" → "8. 13" (서식이 쓰는 표기) */
const md = (ymd: string) => `${Number(ymd.slice(5, 7))}. ${Number(ymd.slice(8, 10))}`;

/**
 * ── 서식에 박힌 글자를 **그대로 읽어 옵니다** ────────────────────
 *
 * 지자체에 내는 서류의 서식은 **우리가 바꿀 수 있는 것이 아닙니다.**
 * 그래서 제목·칸 이름·고르기 문구를 코드에 옮겨 적지 않고
 * 서식 파일에서 그때그때 꺼내 씁니다.
 *
 * 이렇게 해야 두 가지가 지켜집니다.
 *   1. 옮겨 적다가 글자가 달라지는 일이 **아예 생기지 않습니다.**
 *   2. 지자체가 서식을 새로 내려주면 파일만 갈아 끼우면 됩니다.
 *
 * 한글본(.hwpx)과 PDF 본이 **같은 이름표**를 쓰는 것도 여기서 나옵니다.
 */
export type 서식이름표 = ReturnType<typeof 서식라벨>;
let 라벨캐시: any = null;
export function 서식라벨() {
  if (라벨캐시) return 라벨캐시;
  const d = new Hwpx(readFileSync(templatePath()));
  /*
   * 서식9 에는 표가 **하나뿐**입니다. 제목은 표가 아니라 표 위의 **문단**이라
   * 첫 문단에서 읽어 옵니다. (옛 서식은 「서식 1」 딱지가 표여서 tables()[0] 이었습니다.)
   */
  const t = d.tables()[0];
  const 칸 = (r: number, c: number) => d.cellText(d.cell(t, r, c));
  라벨캐시 = {
    제목: d.머리문단글(),
    기본사항: 칸(0, 0),
    성명: 칸(1, 0), 생년월일: 칸(1, 2), 주소지: 칸(1, 4),
    제공기관: 칸(2, 0), 담당자: 칸(2, 2),
    제공현황: 칸(3, 0),
    // 서비스 표의 머리글 6칸 — 「서비스 제공주기\n(주/월/기타)」처럼 줄바꿈까지 그대로.
    머리: [0, 1, 2, 3, 4, 5].map((c) => 칸(4, c)),
    제공결과: 칸(9, 0),
    상태변화: 칸(10, 0),
    상태값칸: 칸(10, 1),          // 「○ 증상악화  ○ 개선  ○ 변화없음」 원문
    상세내용: 칸(10, 2),
    비고: 칸(11, 0),
  };
  return 라벨캐시;
}

/**
 * ── 서식의 **표 생김새**를 그대로 읽어 옵니다 ──────────────────────
 *
 * 이름표만 옮겨서는 부족했습니다. 칸의 **너비와 붙임(가로·세로 병합)**도
 * 서식이 정해 놓은 것입니다. 그걸 눈대중으로 흉내 내면 서식이 달라집니다.
 * 실제로 「대상자 주소지」 칸은 두 줄에 걸친 **세로로 합쳐진 칸**인데
 * 처음에 그걸 모르고 다르게 그렸습니다.
 *
 * 그래서 표 전체를 파일에서 꺼냅니다 — 기둥 너비, 칸마다 가로·세로 몇 칸,
 * 그 안에 박힌 글자까지. PDF 는 이걸 그대로 그리고 값만 채웁니다.
 */
export type 서식칸 = { 가로: number; 세로: number; 너비: number; 글: string };
export type 서식줄 = { 칸: 서식칸[] };
let 구조캐시: any = null;
export function 서식구조() {
  if (구조캐시) return 구조캐시;
  const d = new Hwpx(readFileSync(templatePath()));
  const t = d.tables()[0];
  const 줄: 서식줄[] = d.rows(t).map((r) => ({
    칸: d.cells(r).map((c) => {
      const sz = find(c, "cellSz")[0];
      const sp = find(c, "cellSpan")[0];
      return {
        가로: Number(attr(sp, "colSpan") ?? 1),
        세로: Number(attr(sp, "rowSpan") ?? 1),
        너비: Number(attr(sz, "width") ?? 0),
        글: d.cellText(c),
      };
    }),
  }));

  /*
   * 기둥 나누기 —
   * 줄마다 칸 끝이 어디인지 모아 보면 표 전체의 기둥 자리가 나옵니다.
   * (세로로 합쳐진 칸 때문에 어떤 줄은 너비 합이 모자랍니다. 그런 줄은 건너뜁니다.)
   */
  const 총폭 = Math.max(...줄.map((r) => r.칸.reduce((a, c) => a + c.너비, 0)));
  const 경계 = new Set<number>([0, 총폭]);
  for (const r of 줄) {
    const 합 = r.칸.reduce((a, c) => a + c.너비, 0);
    if (합 !== 총폭) continue;              // 세로 병합이 낀 줄
    let x = 0;
    for (const c of r.칸) { x += c.너비; 경계.add(x); }
  }
  const 자리 = [...경계].sort((a, b) => a - b);
  const 기둥 = 자리.slice(1).map((v, i) => v - 자리[i]);

  구조캐시 = { 제목: 서식라벨().제목, 총폭, 기둥, 줄 };
  return 구조캐시;
}

/**
 * 고른 것 앞의 「○」만 「☑」로 바꿉니다.
 *
 * 문구를 새로 짜지 않고 **서식에 적힌 줄을 그대로 두고 표시만 옮깁니다.**
 * 종이에 손으로 동그라미 치는 것과 같은 일입니다.
 */
export function 상태표시(고른것: string, 원문 = 서식라벨().상태값칸): string {
  const 고름 = String(고른것 ?? "").trim();
  if (!고름) return 원문;
  const i = 원문.indexOf(고름);
  if (i < 0) return 원문;                       // 서식에 없는 값이면 손대지 않습니다
  const j = 원문.lastIndexOf("○", i);
  if (j < 0) return 원문;
  return 원문.slice(0, j) + "☑" + 원문.slice(j + 1);
}

export function noteOf(recipientId: string, month: string) {
  const r = db.query<any, [string, string]>(
    "SELECT * FROM record_note WHERE recipient_id = ? AND month = ?"
  ).get(recipientId, month);
  return {
    statusChange: r?.status_change ?? "변화없음",
    detail: r?.detail ?? "",
    remark: r?.remark ?? "",
    staffName: r?.staff_name ?? "",
  };
}

export function saveNote(recipientId: string, month: string, b: {
  statusChange?: string; detail?: string; remark?: string; staffName?: string;
}) {
  const cur = noteOf(recipientId, month);
  const next = {
    statusChange: b.statusChange ?? cur.statusChange,
    detail: b.detail ?? cur.detail,
    remark: b.remark ?? cur.remark,
    staffName: b.staffName ?? cur.staffName,
  };
  db.run(
    `INSERT INTO record_note
       (recipient_id, month, status_change, detail, remark, staff_name, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(recipient_id, month) DO UPDATE SET
       status_change = excluded.status_change, detail = excluded.detail,
       remark = excluded.remark, staff_name = excluded.staff_name,
       updated_at = excluded.updated_at`,
    [recipientId, month, next.statusChange, next.detail, next.remark,
     next.staffName, new Date().toISOString()]
  );
  return next;
}

/** 기록지에 들어갈 자료를 모읍니다. 화면 미리보기도 같은 것을 씁니다. */
export function gather(recipientId: string, month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("달을 YYYY-MM 으로 주세요.");
  const days = daysOf(month);
  const last = days[days.length - 1];

  const rec = db.query<any, [string]>("SELECT * FROM recipient WHERE id = ?").get(recipientId);
  if (!rec) throw new Error("대상자를 찾을 수 없습니다.");
  const p = JSON.parse(rec.payload || "{}");
  const org = db.query<any, []>("SELECT * FROM organization WHERE id = 1").get();

  /*
   * 서비스마다 **처음부터 그 달 말일까지의** 제공일 전부.
   * 회차가 누적이라 이렇게 모아야 번호가 맞습니다.
   * (미제공은 뺍니다 — 안 간 날에 회차를 붙이면 안 됩니다.)
   */
  const rows = db.query<any, [string, string]>(
    `SELECT d.service_id, d.served_on,
            sv.name, sv.cat_l, sv.cat_m, sv.cat_s, sv.sort_order
       FROM delivery d JOIN service sv ON sv.id = d.service_id
      WHERE d.recipient_id = ? AND d.outcome = '제공' AND d.served_on <= ?
      ORDER BY sv.sort_order, sv.name, d.served_on`
  ).all(recipientId, last);

  // 의뢰에서 주기를 가져옵니다 (서식의 「서비스 제공주기」 칸).
  const cycles = new Map<number, string>(
    db.query<{ service_id: number; cycle_text: string }, [string]>(
      `SELECT service_id, cycle_text FROM (
         SELECT rf.service_id, rf.cycle_text, ROW_NUMBER() OVER (
                  PARTITION BY rf.service_id
                  ORDER BY COALESCE(rf.period_from,'') DESC, rf.id DESC) AS rn
           FROM referral rf WHERE rf.recipient_id = ?
       ) WHERE rn = 1`
    ).all(recipientId).map((r) => [r.service_id, r.cycle_text ?? ""])
  );

  const bySvc = new Map<number, any>();
  for (const r of rows) {
    let s = bySvc.get(r.service_id);
    if (!s) {
      s = {
        serviceId: r.service_id, name: r.name,
        catL: r.cat_l ?? "", catM: r.cat_m ?? "", catS: r.cat_s ?? "",
        cycle: cycles.get(r.service_id) ?? "", dates: [] as string[],
      };
      bySvc.set(r.service_id, s);
    }
    s.dates.push(r.served_on);
  }

  const services = [...bySvc.values()].map((s) => ({
    ...s,
    first: s.dates[0] ?? "",
    // 회차 목록 — 처음부터 누적. 이 칸이 달마다 길어집니다.
    visits: s.dates.map((d: string, i: number) => `${md(d)}.(${i + 1}회차)`).join("\n"),
    thisMonth: s.dates.filter((d: string) => d.startsWith(month)).length,
    total: s.dates.length,
  }));

  return {
    month,
    recipient: {
      id: recipientId, name: p.name ?? "", birth: p.birth ?? "",
      address: 주소한줄(p), dong: rec.dong ?? "", status: rec.status,
    },
    org: { name: org?.name ?? "" },
    services,
    note: noteOf(recipientId, month),
    sheets: Math.max(1, Math.ceil(services.length / ROWS_PER_SHEET)),
  };
}

/** 그 달에 기록지를 낼 사람들. 제공 실적이 하나라도 있어야 낼 것이 있습니다. */
export function listFor(month: string) {
  const days = daysOf(month);
  const first = days[0], last = days[days.length - 1];
  const rows = db.query<any, [string, string]>(
    `SELECT r.id, r.payload, r.dong, r.status,
            COUNT(*) AS n,
            SUM(CASE WHEN d.outcome = '미제공' THEN 1 ELSE 0 END) AS miss,
            COUNT(DISTINCT d.service_id) AS svc
       FROM recipient r JOIN delivery d ON d.recipient_id = r.id
      WHERE d.served_on >= ? AND d.served_on <= ?
      GROUP BY r.id
      ORDER BY r.id`
  ).all(first, last);

  const notes = new Map<string, any>();
  for (const n of db.query<any, [string]>(
    "SELECT * FROM record_note WHERE month = ?"
  ).all(month)) notes.set(n.recipient_id, n);

  return rows.map((r) => {
    const p = JSON.parse(r.payload || "{}");
    const n = notes.get(r.id);
    return {
      id: r.id, name: p.name ?? "", dong: r.dong ?? "", status: r.status,
      served: (r.n ?? 0) - (r.miss ?? 0), missed: r.miss ?? 0, services: r.svc ?? 0,
      sheets: Math.max(1, Math.ceil((r.svc ?? 0) / ROWS_PER_SHEET)),
      statusChange: n?.status_change ?? "변화없음",
      detail: n?.detail ?? "",
      remark: n?.remark ?? "",
      // 상세내용이 비어 있으면 알려 줍니다 — 사람만 쓸 수 있는 칸입니다.
      needsWriting: !String(n?.detail ?? "").trim(),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

/**
 * 기록지 파일을 만듭니다. 서비스가 5종을 넘으면 여러 장으로 나눕니다.
 * 돌려주는 것은 [{ name, data }] 입니다.
 */
export function build(recipientId: string, month: string, staffName: string) {
  const g = gather(recipientId, month);
  const tpl = readFileSync(templatePath());

  const chunks: any[][] = [];
  for (let i = 0; i < Math.max(g.services.length, 1); i += ROWS_PER_SHEET)
    chunks.push(g.services.slice(i, i + ROWS_PER_SHEET));

  const staff = g.note.staffName || staffName;
  const out: { name: string; data: Buffer }[] = [];

  chunks.forEach((chunk, si) => {
    const d = new Hwpx(tpl);
    const tbl = d.tables()[0];
    const cell = (r: number, c: number) => d.cell(tbl, r, c);

    d.setCell(cell(R_NAME, 1), g.recipient.name);
    d.setCell(cell(R_NAME, 3), g.recipient.birth);
    d.setCell(cell(R_NAME, 5), g.recipient.address);
    d.setCell(cell(R_ORG, 1), g.org.name);
    d.setCell(cell(R_ORG, 3), staff);

    /*
     * 서식이 가진 4줄에 덮어쓰고 남는 줄은 비웁니다 (행은 건드리지 않습니다).
     *
     * 서식9 의 기둥은 **여섯**입니다 —
     *   구분(대분류) · 구분(중분류) · **서비스 내용(상세)** ·
     *   서비스 제공주기 · 서비스 최초 제공일 · 직접 서비스 제공일
     *
     * 옛 서식에 있던 「서비스명」 칸이 없습니다. 서비스명은 **중분류에 이미
     * 들어 있으므로**(가사지원 = 가사지원) 우리 `name` 은 안 씁니다.
     * 편람에 없는 칸을 우리가 만들어 붙이지 않습니다.
     *
     * 서식의 5번째 줄에는 「보건의료 / 방문진료」가 예시로 박혀 있습니다.
     * 그 자리도 값 칸이라 그대로 덮어씁니다 — 서식을 고치는 것이 아닙니다.
     */
    for (let i = 0; i < ROWS_PER_SHEET; i++) {
      const s = chunk[i];
      const vals = s
        ? [s.catL, s.catM, s.catS, s.cycle, s.first ? `${md(s.first)}~` : "", s.visits]
        : ["", "", "", "", "", ""];
      vals.forEach((v, c) => d.setCell(cell(R_SVC + i, c), v));
    }

    /*
     * 서비스 제공 결과 — 마지막 장에만 넣습니다.
     *
     * 고르기 줄은 **서식에 적힌 문구를 그대로 두고 표시만 옮깁니다**
     * (「○ 증상악화  ○ 개선  ○ 변화없음」에서 고른 것 앞의 ○ 만 ☑ 로).
     * 앞 장에는 아무것도 안 씁니다 — 서식에 없는 말을 우리가 지어 넣지 않습니다.
     *
     * ── 이 칸만 **줄바꿈을 우리가 넣지 않습니다** (2026-08-31) ────────
     * 서식9 는 이 칸이 옛 서식보다 좁습니다. 우리 줄바꿈을 태웠더니
     * 「… ○\n변화없음」처럼 **서식의 문장이 우리 손에 끊겼습니다.**
     * 이 칸에 들어가는 것은 우리가 지은 글이 아니라 **서식이 적어 둔 그 줄**이라,
     * 어디서 줄이 넘어갈지는 한글이 정할 일입니다. 그래서 그대로 한 줄로 넣습니다.
     */
    const 마지막 = si === chunks.length - 1;
    d.setCell(cell(R_STATE, 1), 마지막 ? 상태표시(g.note.statusChange) : "", false);
    d.setCell(cell(R_STATE, 3), 마지막 ? lines(g.note.detail) : "");
    d.setCell(cell(R_NOTE, 1), 마지막 ? lines(g.note.remark) : "");

    /*
     * ── 용지(pagePr)는 **절대 손대지 않습니다** ──────────────────────
     *
     * 옛 가로 서식 때 「표가 용지보다 넓으니 돌리자」고 pagePr 을 맞바꿨다가
     * **마지막 칸이 통째로 사라졌습니다.** 한글은 자기 셈으로 용지를 잡습니다.
     *
     * 서식9 는 편람에서 그대로 가져왔고 **A4 세로**입니다 —
     * 표 폭 47,413 HWPUNIT(167mm)이 글 영역 48,188(170mm) 안에 들어갑니다.
     * 우리가 숫자를 건드릴 이유가 없습니다.
     *
     * 교훈: **서식의 용지 설정은 한글이 알아서 합니다. 우리는 칸만 채웁니다.**
     */

    const suffix = chunks.length > 1 ? `_${si + 1}` : "";
    out.push({
      name: `${month}_기록지_${g.recipient.name}${suffix}.hwpx`,
      data: d.save(),
    });
  });

  return out;
}

/** 여러 줄을 「- 」 목록으로. 이미 「- 」로 시작하면 그대로 둡니다. */
function lines(text: string): string {
  const ls = String(text ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  return ls.map((s) => (s.startsWith("- ") ? s : `- ${s}`)).join("\n");
}

/** 그 달 전체를 하나의 zip 으로. 지자체에 메일로 보낼 묶음입니다. */
export function buildAll(month: string, staffName: string, ids?: string[]) {
  const people = listFor(month).filter((x) => !ids?.length || ids.includes(x.id));
  const files: { name: string; data: Buffer }[] = [];
  const failed: string[] = [];
  for (const p of people) {
    try { files.push(...build(p.id, month, staffName)); }
    catch (e: any) { failed.push(`${p.name}: ${e.message}`); }
  }
  if (files.length === 0)
    throw new Error(failed.length ? failed.join(" / ") : "낼 기록지가 없습니다.");
  return {
    files,                                  // PDF 변환기가 이 원본을 그대로 씁니다
    zip: zipFiles(files),
    count: files.length, people: people.length, failed,
    name: `${month}_기록지_${files.length}건.zip`,
  };
}

export { ROWS_PER_SHEET, 상태값, today };
