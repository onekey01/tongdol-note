/**
 * ── 서식을 안 바꿨는지 검사합니다 ────────────────────────────────
 *
 * 지자체에 내는 서류의 서식은 우리가 바꿀 수 있는 것이 아닙니다.
 *
 * 한때 PDF 를 **직접 그렸습니다.** 서식 파일에서 글자와 칸 너비를 읽어 왔는데도
 * 글꼴·선 굵기·여백·용지가 전부 우리가 정한 값이라 **같은 서식이 될 수 없었습니다.**
 * 지금은 그리지 않습니다 — 채운 hwpx 를 **한글에게 시켜** PDF 로 바꿉니다.
 *
 * 그래서 검사할 것은 하나로 좁아졌습니다:
 *   **우리가 hwpx 에 손댄 것이 「칸 채우기」 하나뿐인가.**
 *
 *   1. 서식 파일 자체가 그대로인가
 *   2. 채운 문서에서 **이름표가 한 글자도 안 바뀌었는가**
 *   3. 표의 생김새(줄·칸·너비·붙임)가 서식과 **완전히 같은가**
 *   4. 용지·여백을 손대지 않았는가
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "./server/db";
import { Hwpx } from "./server/hwpx";
import { find, attr } from "./server/xml";
import { build as buildHwpx, listFor } from "./server/recordbook";

const 서식이름 = "모니터링 기록지(서식9).hwpx";
const 서식경로 = [join("서식", 서식이름), join(import.meta.dir, "서식", 서식이름)]
  .find((p) => existsSync(p))!;

let 실패 = 0;
const 확인 = (이름: string, 참인가: boolean, 덧붙임 = "") => {
  console.log(`  ${참인가 ? "★" : "✕"} ${이름}${덧붙임 ? " — " + 덧붙임 : ""}`);
  if (!참인가) 실패 += 1;
};

/** 표 하나의 생김새를 글자로 — 줄마다 칸의 너비·가로·세로. */
function 생김새(d: Hwpx, ti: number): string {
  const t = d.tables()[ti];
  return d.rows(t).map((r) =>
    d.cells(r).map((c) => {
      const sz = find(c, "cellSz")[0], sp = find(c, "cellSpan")[0];
      return `${attr(sz, "width")}/${attr(sp, "colSpan")}/${attr(sp, "rowSpan")}`;
    }).join(" ")
  ).join(" | ");
}
/** 표의 모든 칸 글자. */
function 글자들(d: Hwpx, ti: number): string[] {
  const t = d.tables()[ti];
  return d.rows(t).flatMap((r) => d.cells(r).map((c) => d.cellText(c)));
}

console.log("\n■ 1. 서식 파일 자체");
{
  const 원본 = readFileSync(서식경로);
  const 다시 = new Hwpx(원본).save();
  확인("읽고 아무것도 안 고치고 저장하면 그대로",
       Buffer.compare(원본, 다시) === 0, `${원본.length} → ${다시.length} 바이트`);
}

/* ── 시험용: 서비스 전부(4줄을 넘겨 장이 나뉘는 경우) ───────── */
const svcs = db.query<any, []>("SELECT id FROM service WHERE profile_id=2 ORDER BY id").all();
const 시험id = randomUUID();
db.run(`INSERT INTO recipient (id,payload,dong,status,copay_tier_id,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?)`,
  [시험id, JSON.stringify({ name: "서식지킴시험", birth: "1939-09-09", gender: "여",
    address: "전남 해남군 해남읍 1-1" }), "해남읍", "이용중", 5, "2026-08-01", "2026-08-01"]);
for (const s of svcs)
  for (const day of ["2026-07-30", "2026-08-05"])
    db.run(`INSERT INTO delivery (recipient_id,service_id,served_on,outcome,created_at)
            VALUES (?,?,?,?,?)`, [시험id, s.id, day, "제공", "2026-08-20"]);
db.run(`INSERT INTO record_note (recipient_id,month,status_change,detail,remark,staff_name,updated_at)
        VALUES (?,?,?,?,?,?,?)`,
  [시험id, "2026-08", "개선", "상태가 나아지심.", "특이사항 없음.", "박병섭", "2026-08-24"]);

try {
  const 서식 = new Hwpx(readFileSync(서식경로));
  const 서식글자 = 글자들(서식, 0);
  const 서식생김 = [생김새(서식, 0)];
  const 서식제목 = 서식.머리문단글();

  /*
   * 서식에 값이 들어가는 칸(줄,칸번호). 여기 말고 다른 칸의 글자가 달라졌다면
   * 우리가 서식을 건드린 것입니다.
   */
  const 값칸 = new Set([
    "1,1", "1,3", "1,5",        // 성명·생년월일·주소
    "2,1", "2,3",               // 제공기관·담당자
    "5,0","5,1","5,2","5,3","5,4","5,5",   // 서비스 4줄 × 6칸
    "6,0","6,1","6,2","6,3","6,4","6,5",
    "7,0","7,1","7,2","7,3","7,4","7,5",
    "8,0","8,1","8,2","8,3","8,4","8,5",
    "10,1", "10,3", "11,1",     // 상태변화·상세내용·비고
  ]);

  /*
   * 서식9 는 세로입니다. 표 폭이 글 영역 안에 들어가야 칸이 안 밀립니다.
   * (옛 가로 서식에서 이걸 잘못 만져 마지막 칸이 통째로 사라진 적이 있습니다.)
   */
  console.log("\n■ 1-나. 서식9 는 A4 세로다");
  {
    const pp = find(서식.doc.root, "pagePr")[0];
    const w = Number(attr(pp, "width")), h = Number(attr(pp, "height"));
    확인("용지가 세로다 (가로가 세로보다 짧다)", w < h,
         `${(w / 7200 * 25.4).toFixed(0)}×${(h / 7200 * 25.4).toFixed(0)}mm`);
    const 폭 = 서식.rows(서식.tables()[0])
      .map((r) => 서식.cells(r).reduce((a, c) =>
        a + Number(attr(find(c, "cellSz")[0], "width") ?? 0), 0));
    const 표폭 = Math.max(...폭);
    const 글영역 = find(서식.doc.root, "lineseg")
      .map((x) => Number(attr(x, "horzsize") ?? 0)).reduce((a, b) => Math.max(a, b), 0);
    확인("표가 글 영역 안에 들어간다", 표폭 <= 글영역,
         `표 ${(표폭 / 7200 * 25.4).toFixed(0)}mm ≤ 글영역 ${(글영역 / 7200 * 25.4).toFixed(0)}mm`);
    확인("서비스 줄은 4개다", 서식.rows(서식.tables()[0]).length === 12, "표 12줄");
  }

  console.log("\n■ 2~4. 채운 문서 (서비스 5종 → 2장)");
  const 장들 = buildHwpx(시험id, "2026-08", "박병섭");
  확인("장수", 장들.length === 2, `${장들.length}장`);

  장들.forEach((f, si) => {
    const d = new Hwpx(f.data);
    const 장 = `${si + 1}장`;

    // 2. 이름표가 그대로인가 — 값 칸이 아닌 곳은 서식 글자와 같아야 합니다.
    const 지금 = 글자들(d, 0);
    const t = d.tables()[0];
    let 어긋난것: string[] = [];
    let ci = 0;
    d.rows(t).forEach((r, ri) => {
      d.cells(r).forEach((_c, cj) => {
        const 값자리 = 값칸.has(`${ri},${cj}`);
        if (!값자리 && 지금[ci] !== 서식글자[ci])
          어긋난것.push(`r${ri}c${cj}「${서식글자[ci]}」→「${지금[ci]}」`);
        ci += 1;
      });
    });
    확인(`${장} 이름표가 서식 글자 그대로`, 어긋난것.length === 0,
         어긋난것.length ? 어긋난것.slice(0, 3).join(", ") : `값 칸 말고는 한 글자도 안 바뀜`);

    // 3. 표 생김새가 그대로인가 (줄·칸·너비·가로세로 붙임)
    확인(`${장} 표 생김새가 서식과 같음`,
         생김새(d, 0) === 서식생김[0]);

    // 제목은 표가 아니라 문단입니다. 이것도 서식이 정한 글자입니다.
    확인(`${장} 제목 문단이 서식 그대로`, d.머리문단글() === 서식제목,
         `「${d.머리문단글()}」`);

    /*
     * 4. 용지 — **한 글자도 손대면 안 됩니다.**
     *
     * 한때 「표가 용지보다 넓다」고 가로·세로를 맞바꿨다가
     * 한글에서 **표의 마지막 칸이 통째로 사라졌습니다.**
     * 서식9 는 편람에서 그대로 가져온 A4 세로입니다. 손댈 이유가 없습니다.
     */
    const pp = find(d.doc.root, "pagePr")[0];
    const 원pp = find(서식.doc.root, "pagePr")[0];
    확인(`${장} 용지 설정을 손대지 않음`,
         ["width", "height", "landscape", "gutterType"]
           .every((k) => attr(pp, k) === attr(원pp, k)),
         `${attr(pp, "width")}×${attr(pp, "height")} ${attr(pp, "landscape")}`);
    const 여백 = find(d.doc.root, "margin")[0], 원여백 = find(서식.doc.root, "margin")[0];
    확인(`${장} 여백도 손대지 않음`,
         ["left", "right", "top", "bottom", "header", "footer"]
           .every((k) => attr(여백, k) === attr(원여백, k)));

    확인(`${장} 저장 전 자체 점검`, d.audit().length === 0, d.audit().join(", "));
  });

  // 고르기 줄 — 문구는 그대로, 표시만 옮겼는가
  const 마지막 = new Hwpx(장들[장들.length - 1].data);
  const 고른줄 = 마지막.cellText(마지막.cell(마지막.tables()[0], 10, 1));
  const 원줄 = 서식.cellText(서식.cell(서식.tables()[0], 10, 1));
  확인("고르기 문구는 그대로, 표시만 ☑ 로",
       고른줄.replace("☑", "○") === 원줄, `「${고른줄}」`);
} finally {
  db.run("DELETE FROM delivery WHERE recipient_id=?", [시험id]);
  db.run("DELETE FROM record_note WHERE recipient_id=?", [시험id]);
  db.run("DELETE FROM recipient WHERE id=?", [시험id]);
}

console.log(실패 === 0
  ? "\n★ 서식을 바꾸지 않았습니다. (손댄 것: 값 칸 채우기, 그것뿐입니다)\n"
  : `\n✕ ${실패}가지가 어긋납니다.\n`);
process.exit(실패 === 0 ? 0 : 1);
