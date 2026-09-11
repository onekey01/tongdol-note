/**
 * 제공기록지 — 편람 **서식3 · 서식4 · 서식5**.
 *
 * ═══════════════════════════════════════════════════════════
 *  이것이 「손으로 쓰던 것」의 마지막 덩어리입니다
 * ═══════════════════════════════════════════════════════════
 *
 * 지금까지 제공인력이 집에 돌아와 **기억으로** 적던 종이입니다.
 * 열한 가지 중 무엇을 했는지, 식단이 무엇이었는지, 몇 시에 시작해
 * 몇 시에 끝냈는지를 며칠 뒤에 떠올려 적습니다.
 *
 * 이제 그 값이 다 모여 있습니다 —
 *   · 현장앱이 그 자리에서 찍은 것 (진행시간·확인사항·식단·서명·사진)
 *   · 사무실이 창에서 적은 것 (폰이 막혔을 때)
 *
 * 여기서 하는 일은 **모인 값을 서식에 꽂는 것**뿐입니다.
 *
 * ═══════════════════════════════════════════════════════════
 *  ★ 서식은 한 글자도 안 고칩니다 ★
 * ═══════════════════════════════════════════════════════════
 *
 * (무무 — 「세상에 지자체에 제출하는 서류의 서식을 마음대로 수정하는
 *  경우는 없어」 / 「서식이 완전히 같아야 하고 확장자만 달라야 해」)
 *
 * 그래서 —
 *   · **행을 늘리거나 지우지 않습니다.** 한글이 행 개수를 건드리면
 *     파일을 안 엽니다. 넘치면 **장을 나눠** 파일을 여럿 만듭니다.
 *   · 용지 설정(pagePr)은 손대지 않습니다. 한글이 알아서 합니다.
 *   · 이름표 칸은 읽기만 하고, **값 칸만** 채웁니다.
 *
 * ── 한 장에 몇 개가 들어가나 ────────────────────────────────
 *
 *   서식3 가사      한 장에 **6일**   (제공일자 기둥이 여섯)
 *   서식5 동행·이미용 한 장에 **5회차**
 *   서식4 식사      한 장에 **12회차** — 두 회차가 한 칸에 들어갑니다
 *
 * 한 달치 가사지원이면 6일씩 끊겨 다섯 장이 나옵니다. 기록지(서식9)와
 * 같은 방식입니다 — 파일 이름 뒤에 `_1`, `_2` 가 붙습니다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "./db";
import { Hwpx } from "./hwpx";
import { 서식폴더 } from "./서식자리";
import { 서식갈래, type 갈래 } from "./서식갈래";
import { 서식몫나누기, 기타한줄 } from "./확인사항";
import { zipFiles } from "./zip";

/* ══════════════════════════════════════════════════════════════
 *  값 모으기
 * ══════════════════════════════════════════════════════════════ */

/** 하루치(또는 한 회차) — 서식 한 기둥에 들어갈 것. */
export type 한번 = {
  날: string;                    // YYYY-MM-DD
  시작: string;                  // "09:00" · 없으면 빈 글자
  종료: string;
  한것: string[];                // 그날 고른 확인사항 (기관이 더한 것도 섞여 있습니다)
  기타: string;
  제공형태: string;              // 서식4 — 대면배달 · 비대면배달
  장소: string;
  주식: string;
  반찬: string;
  내용: string;                  // 서식5 — 여러 줄
  특이사항: string;
  서명: string | null;           // data:image/png;base64,… (지금은 「(서명)」으로만 적습니다)
};

export type 모은것 = {
  대상자: { 이름: string; 생년월일: string };
  기관: string;
  인력: string;
  서비스: string;
  갈래: 갈래;
  달: string;
  것들: 한번[];
};

/** "2026-09-05T09:00:00" → "09:00". 없으면 빈 글자. */
function 시분(iso?: string | null): string {
  if (!iso) return "";
  const m = String(iso).match(/T(\d{2}):(\d{2})/);
  if (m) return `${m[1]}:${m[2]}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function 현장읽기(payload: string | null | undefined): any {
  if (!payload) return {};
  try {
    const 것 = JSON.parse(payload)?.현장;
    return 것 && typeof 것 === "object" ? 것 : {};
  } catch { return {}; }
}

/**
 * 한 대상자의 한 서비스, 그 달치를 모읍니다.
 *
 * **제공한 것만** 담습니다. 미제공은 서식에 적을 것이 없습니다 —
 * 안 간 날의 진행시간과 식단을 지어낼 수는 없습니다.
 */
export function 모으기(assignId: number, 달: string): 모은것 {
  if (!/^\d{4}-\d{2}$/.test(달)) throw new Error("달을 YYYY-MM 으로 주세요.");

  const a = db.query<any, [number]>(
    `SELECT a.id, a.recipient_id, a.service_id,
            r.payload AS rpayload,
            sv.name AS service, sv.record_type, sv.cat_m, sv.cat_s,
            u.name AS worker
       FROM assignment a
       JOIN recipient r  ON r.id  = a.recipient_id
       JOIN service   sv ON sv.id = a.service_id
       LEFT JOIN worker  w ON w.id = a.worker_id
       LEFT JOIN app_user u ON u.id = w.user_id
      WHERE a.id = ?`).get(assignId);
  if (!a) throw new Error("그 배정을 찾을 수 없습니다.");

  let 사람: any = {};
  try { 사람 = JSON.parse(a.rpayload ?? "{}"); } catch { }

  const org = db.query<{ name: string }, []>(
    "SELECT name FROM organization ORDER BY id LIMIT 1").get();

  const 줄들 = db.query<any, [number, string]>(
    `SELECT served_on, start_at, end_at, payload, check_set_id
       FROM delivery
      WHERE assignment_id = ? AND substr(served_on, 1, 7) = ?
        AND outcome = '제공'
      ORDER BY served_on`).all(assignId, 달);

  const 것들: 한번[] = 줄들.map((r) => {
    const 현장 = 현장읽기(r.payload);
    const 적 = 현장.적은것 ?? {};
    return {
      날: r.served_on,
      시작: 시분(r.start_at),
      종료: 시분(r.end_at),
      한것: Array.isArray(적.한것) ? 적.한것 : [],
      기타: String(적.기타 ?? ""),
      제공형태: String(적.제공형태 ?? ""),
      장소: String(적.장소 ?? ""),
      주식: String(적.주식 ?? ""),
      반찬: String(적.반찬 ?? ""),
      내용: String(적.내용 ?? ""),
      특이사항: String(적.특이사항 ?? ""),
      서명: 현장.서명 ?? null,
    };
  });

  return {
    대상자: { 이름: 사람.name ?? "", 생년월일: 사람.birth ?? 사람.birthday ?? "" },
    기관: org?.name ?? "",
    인력: a.worker ?? "",
    서비스: a.service ?? "",
    갈래: 서식갈래({ record_type: a.record_type, cat_m: a.cat_m, cat_s: a.cat_s, name: a.service }),
    달,
    것들,
  };
}

/* ══════════════════════════════════════════════════════════════
 *  서식3 — 가사지원
 * ══════════════════════════════════════════════════════════════ */

const 서식3파일 = "가사지원 제공기록지(서식3).hwpx";

/**
 * 서식3 의 자리들.
 *
 * 표 하나에 21줄. 값이 들어가는 기둥은 **c1 ~ c6, 여섯 개**입니다.
 * (c1~c4 는 두 칸이 붙어 있고 c5·c6 은 한 칸짜리인데, 칸 번호로 세면
 *  똑같이 하나씩입니다.)
 */
const 서식3 = {
  하루수: 6,
  이용자: [0, 1], 생년월일: [0, 3], 서비스구분: [0, 5],
  제공인력: [1, 1], 제공기관: [1, 3], 제공일수: [1, 5],
  제공일자: 3, 시작: 4, 종료: 5,
  첫항목: 6,                    // r6 ① 목욕보조 … r16 ⑪ 말벗
  기타: 17, 특이사항: 18, 서명: 19,
} as const;

/** 서식3 이 세로로 늘어놓은 열한 가지. **서식에서 그대로 읽어 옵니다.** */
function 서식3항목들(d: Hwpx): string[] {
  const t = d.tables()[0];
  const 것들: string[] = [];
  for (let i = 0; i < 11; i++) {
    const 글 = d.cellText(d.cell(t, 서식3.첫항목 + i, 0));
    // 「① 목욕보조」 에서 번호를 떼면 우리가 아는 이름이 됩니다.
    것들.push(String(글).replace(/^[①-⑪]\s*/, "").trim());
  }
  return 것들;
}

/** "2026-09-05" → "9. 5." (서식이 「. . .」으로 비워 둔 자리) */
const 월일 = (ymd: string) => `${Number(ymd.slice(5, 7))}. ${Number(ymd.slice(8, 10))}.`;

function 서식3만들기(g: 모은것): { name: string; data: Buffer }[] {
  const tpl = readFileSync(join(서식폴더(), 서식3파일));
  const 묶음: 한번[][] = [];
  for (let i = 0; i < Math.max(g.것들.length, 1); i += 서식3.하루수)
    묶음.push(g.것들.slice(i, i + 서식3.하루수));

  const 나갈것: { name: string; data: Buffer }[] = [];

  묶음.forEach((묶, si) => {
    const d = new Hwpx(tpl);
    const t = d.tables()[0];
    const 칸 = (r: number, c: number) => d.cell(t, r, c);
    const 항목들 = 서식3항목들(d);

    d.setCell(칸(...서식3.이용자), g.대상자.이름);
    d.setCell(칸(...서식3.생년월일), g.대상자.생년월일);
    d.setCell(칸(...서식3.제공인력), g.인력);
    d.setCell(칸(...서식3.제공기관), g.기관);

    /*
     * ── 「□ 가사서비스」 같은 고르기 칸 ─────────────────────
     *
     * ★ 서식이 적어 둔 글자를 **지우지 않습니다.** 네모만 채웁니다.
     *   칸을 통째로 갈아 끼우면 그건 서식을 고치는 일입니다.
     *   기록지에서 「○ 를 ☑ 로만 바꾼」 것과 같은 생각입니다.
     */
    d.setCell(칸(...서식3.서비스구분),
      String(d.cellText(칸(...서식3.서비스구분))).replace("□", "■"), false);
    d.setCell(칸(...서식3.제공일수),
      String(d.cellText(칸(...서식3.제공일수))).replace("□", "■"), false);

    for (let i = 0; i < 서식3.하루수; i++) {
      const c = i + 1;                       // 값 기둥은 c1 부터
      const 하루 = 묶[i];

      d.setCell(칸(서식3.제공일자, c), 하루 ? 월일(하루.날) : "");
      d.setCell(칸(서식3.시작, c), 하루?.시작 ?? "");
      d.setCell(칸(서식3.종료, c), 하루?.종료 ?? "");

      /*
       * ★ 서식이 시키는 대로 **‘○’ 를 찍습니다.**
       *   맨 아래에 「* 당일 제공한 서비스 해당란에 ‘○’ 표시」라고
       *   적혀 있습니다. ☑ 나 V 가 아니라 ○ 입니다.
       */
      /*
       * ── ★ 서식에 없는 항목은 「기타」로 모읍니다 ★ ────────────
       *
       * (2026-09-06 무무 — 기관이 확인사항 항목을 더할 수 있게 하되,
       *  「세상에 지자체에 제출하는 서류의 서식을 마음대로 수정하는
       *   경우는 없어」)
       *
       * 서식3 의 열한 줄은 편람이 정한 것이라 **한 줄도 안 늘립니다.**
       * 기관이 더한 「약 챙김」 같은 항목은 찍을 자리가 없는데,
       * 그렇다고 버리면 **일을 하고도 종이에 안 남습니다.**
       * 그래서 아래 「기타」 칸에 모아서 적습니다.
       */
      const 몫 = 서식몫나누기(하루?.한것 ?? [], 항목들);
      항목들.forEach((이름, k) => {
        d.setCell(칸(서식3.첫항목 + k, c), 몫.서식줄.has(이름) ? "○" : "");
      });

      /*
       * ── 글이 들어가는 칸은 **줄바꿈을 우리가 안 넣습니다** ─────
       *
       * 이 기둥은 한 장을 여섯으로 나눈 좁은 칸입니다. 우리가 줄을
       * 넘기면 「무릎이 / 아프시다고 / 하셨습니다」처럼 **어절마다**
       * 끊깁니다. 어디서 넘길지는 한글이 정할 일입니다.
       * (기록지 서식9 의 상태변화 칸에서 똑같이 겪었습니다.)
       */
      d.setCell(칸(서식3.기타, c), 기타한줄(몫.기타몫, 하루?.기타 ?? ""), false);
      d.setCell(칸(서식3.특이사항, c), 하루?.특이사항 ?? "", false);
      /*
       * 서명 그림은 여기 안 넣습니다 — 표 칸에 그림을 얹으면 한글이
       * 자리를 제멋대로 잡습니다. **받았다는 사실만** 적고, 그림은
       * 사진과 함께 뒷장으로 갑니다.
       */
      d.setCell(칸(서식3.서명, c), 하루?.서명 ? "(서명 받음)" : "");
    }

    const 꼬리 = 묶음.length > 1 ? `_${si + 1}` : "";
    나갈것.push({
      name: `${g.달}_서식3_${g.대상자.이름}${꼬리}.hwpx`,
      data: d.save(),
    });
  });

  return 나갈것;
}

/* ══════════════════════════════════════════════════════════════
 *  서식5 — 병원동행 · 이미용
 * ══════════════════════════════════════════════════════════════ */

const 서식5파일 = "병원동행·이미용 제공기록지(서식5).hwpx";

/**
 * 서식5 의 자리들.
 *
 * ── 칸 수가 줄마다 다릅니다 ────────────────────────────────
 *
 * 서식이 「서비스 내용」 칸을 어떤 줄은 하나로, 어떤 줄은 둘로 갈라
 * 그려 놓았습니다(예시로 1.2.3.4. 를 적어 둔 자리라 그렇습니다).
 *
 *     r4  회차 · 장소 · 내용앞 · 내용뒤 · 서명    (5칸)
 *     r5  회차 · 장소 · 내용   · 서명            (4칸)
 *
 * 그래서 **칸 번호를 못 박으면 안 됩니다.** 「c1 은 장소」,
 * 「마지막 칸은 서명」, 「그 사이는 내용」으로 셉니다. 서식이 정한
 * 생김새를 우리가 고치지 않고 그대로 따라가는 길입니다.
 */
const 서식5 = {
  회차수: 5,
  기관줄: 1,
  이용자: [2, 1], 생년월일: [2, 3], 제공인력: [2, 5],
  첫회차: 4,                     // r4 ~ r8
  비고: [11, 0], 인력서명: [11, 1],
} as const;

/**
 * 회차 칸에 값을 **얹습니다.**
 *
 *   "1회차 ( / ) ( : ) ( : )"  →  "1회차 ( 7 / 5 ) ( 09:00 ) ( 11:00 )"
 *
 * ★ 칸을 통째로 갈아 끼우지 않습니다. 「1회차」와 괄호는 서식이 그린
 *   것이고, 우리가 채우는 것은 그 **안쪽**뿐입니다.
 */
function 회차칸(원문: string, 하루: 한번 | undefined): string {
  if (!하루) {
    // 안 쓴 회차는 서식이 그린 빈 모양 그대로 둡니다.
    return 원문;
  }
  const 월 = Number(하루.날.slice(5, 7));
  const 일 = Number(하루.날.slice(8, 10));

  let 나온것 = 원문.replace(/\(\s*\/\s*\)/, `( ${월} / ${일} )`);

  // 남은 「( : )」 두 개를 차례로 시작·종료로 채웁니다.
  let 몇번째 = 0;
  나온것 = 나온것.replace(/\(\s*:\s*\)/g, () => {
    몇번째++;
    const 값 = 몇번째 === 1 ? 하루.시작 : 하루.종료;
    return 값 ? `( ${값} )` : "( : )";
  });
  return 나온것;
}

/**
 * 서비스 내용을 **서식이 갈라 놓은 칸 수만큼** 나눠 담습니다.
 *
 * 칸이 하나면 통째로, 둘이면 앞뒤로 나눕니다. 줄 단위로 자르므로
 * 「1. 병원까지 동행」이 가운데서 끊기는 일은 없습니다.
 */
function 내용나누기(글: string, 칸수: number): string[] {
  const 줄들 = String(글 ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  if (칸수 <= 1) return [줄들.join("\n")];
  const 앞 = Math.ceil(줄들.length / 칸수);
  const 나온것: string[] = [];
  for (let i = 0; i < 칸수; i++) 나온것.push(줄들.slice(i * 앞, (i + 1) * 앞).join("\n"));
  return 나온것;
}

function 서식5만들기(g: 모은것): { name: string; data: Buffer }[] {
  const tpl = readFileSync(join(서식폴더(), 서식5파일));
  const 묶음: 한번[][] = [];
  for (let i = 0; i < Math.max(g.것들.length, 1); i += 서식5.회차수)
    묶음.push(g.것들.slice(i, i + 서식5.회차수));

  const 나갈것: { name: string; data: Buffer }[] = [];

  묶음.forEach((묶, si) => {
    const d = new Hwpx(tpl);
    const t = d.tables()[0];
    const 칸 = (r: number, c: number) => d.cell(t, r, c);

    d.setCell(칸(...서식5.이용자), g.대상자.이름);
    d.setCell(칸(...서식5.생년월일), g.대상자.생년월일);
    d.setCell(칸(...서식5.제공인력), g.인력);

    /*
     * 「제공기관명 : 」 은 이름표와 값이 **한 줄에** 있습니다.
     * 칸을 갈아 끼우면 이름표까지 지웁니다 — 뒤에 값만 얹습니다.
     */
    {
      const c = 칸(서식5.기관줄, 0);
      const 원문 = String(d.cellText(c));
      d.setCell(c, 원문.includes(":") ? `${원문.replace(/\s*$/, "")} ${g.기관}` : 원문, false);
    }

    묶.forEach((하루, i) => void 하루);   // 아래에서 줄 단위로 돕니다

    for (let i = 0; i < 서식5.회차수; i++) {
      const r = 서식5.첫회차 + i;
      const 하루 = 묶[i];
      const 칸들 = d.cells(d.rows(t)[r]);
      const 마지막 = 칸들.length - 1;

      // 회차 — 서식이 그린 모양에 값만 얹습니다.
      d.setCell(칸들[0], 회차칸(String(d.cellText(칸들[0])), 하루), false);

      // 제공 장소
      d.setCell(칸들[1], 하루?.장소 ?? "", false);

      /*
       * 서비스 내용 — 장소(c1)와 서명(마지막) 사이의 칸들입니다.
       * 줄마다 그 개수가 다르므로 세어서 나눕니다.
       */
      const 내용칸수 = 마지막 - 2;
      const 쪽들 = 내용나누기(하루?.내용 ?? "", 내용칸수);
      for (let k = 0; k < 내용칸수; k++)
        d.setCell(칸들[2 + k], 쪽들[k] ?? "", false);

      // 이용자 (서명)
      d.setCell(칸들[마지막], 하루?.서명 ? "(서명 받음)" : "", false);
    }

    /*
     * 비고(종합의견) — **마지막 장에만** 넣습니다.
     * 그 달의 특이사항을 날짜와 함께 모아 적습니다. 앞 장에 같은 말을
     * 되풀이하면 읽는 사람이 어느 것이 진짜인지 헷갈립니다.
     */
    const 마지막장 = si === 묶음.length - 1;
    const 모은말 = g.것들
      .filter((x) => x.특이사항.trim())
      .map((x) => `- (${월일(x.날)}) ${x.특이사항.trim()}`)
      .join("\n");
    d.setCell(칸(...서식5.비고), 마지막장 ? 모은말 : "", false);

    const 꼬리 = 묶음.length > 1 ? `_${si + 1}` : "";
    나갈것.push({
      name: `${g.달}_서식5_${g.대상자.이름}${꼬리}.hwpx`,
      data: d.save(),
    });
  });

  return 나갈것;
}

/* ══════════════════════════════════════════════════════════════
 *  서식4 — 식사 관리
 * ══════════════════════════════════════════════════════════════ */

const 서식4파일 = "식사 관리 제공기록지(서식4).hwpx";

/**
 * 서식4 는 셋 중 가장 까다롭습니다.
 *
 * ── ① 두 회차가 **한 칸**에 들어갑니다 ─────────────────────
 *
 *   1회차
 *   ( 11 / 4  )
 *   ( 09 : 10 )
 *   (빈 줄)
 *   2회차
 *   ( 11 / 4  )
 *   ( 09 : 10 )
 *
 * 줄 단위로 생겼습니다. 「1회차」와 괄호는 서식이 그린 것이고
 * **괄호 안쪽만** 우리가 채웁니다.
 *
 * ── ② 편람 **작성예시가 그대로 박혀 있습니다** ─────────────
 *
 *   「콩나물 무침, 미역줄기, 계란찜, 배추김치」
 *   「- 방법: 대면상담 - 주요내용: 저염 식단 요청」
 *   「11 / 4」, 「09 : 10」
 *
 * 이것들은 **값 칸**이라 덮어쓰면 지워집니다. 안 지우면 남의 집
 * 식단이 우리 어르신 기록지에 실려 나갑니다. 그래서 안 쓴 회차도
 * **빈 모양으로 되돌립니다.**
 *
 * ── ③ 한 묶음이 **네 줄**입니다 ────────────────────────────
 *
 *   회차줄  · 죽 · 반찬 · 특이사항
 *
 * 그리고 죽·반찬 줄은 c1 이 앞 회차, c2 가 뒤 회차입니다.
 */
const 서식4 = {
  회차수: 16,                    // 한 장에 8묶음 × 2회차
  묶음첫줄: [4, 8, 12, 16, 21, 25, 29, 33],
  기관: [1, 0], 유형: [1, 2], 기간: [1, 3],
  이용자: [2, 1], 생년월일: [2, 3], 제공인력: [2, 5],
  비고: [38, 0], 이용자서명: [38, 1], 인력서명: [38, 2],
} as const;

/**
 * 회차 칸을 채웁니다 — **줄 모양을 그대로 두고 괄호 안만.**
 *
 * 서식이 예시로 적어 둔 「11 / 4」·「09 : 10」을 우리 값으로 바꾸고,
 * 안 쓴 회차는 **빈 괄호로 되돌립니다.** 안 되돌리면 편람 예시의
 * 11월 4일이 우리 어르신 기록지에 남습니다.
 */
function 회차칸4(원문: string, 앞: 한번 | undefined, 뒤: 한번 | undefined): string {
  const 것들 = [앞, 뒤];
  let 날몇번째 = 0, 때몇번째 = 0;

  return String(원문)
    .split("\n")
    .map((줄) => {
      // 「( 11 / 4  )」 — 닫는 괄호가 없는 줄도 있어 느슨하게 봅니다.
      if (/\(\s*[\d\s]*\/[\d\s]*\)?\s*$/.test(줄) && 줄.includes("/")) {
        const 것 = 것들[날몇번째++];
        return 것
          ? `( ${Number(것.날.slice(5, 7))} / ${Number(것.날.slice(8, 10))} )`
          : "(    /    )";
      }
      // 「( 09 : 10 )」
      if (/\(\s*[\d\s]*:[\d\s]*\)?\s*$/.test(줄) && 줄.includes(":")) {
        const 것 = 것들[때몇번째++];
        const 값 = 것?.시작 ?? "";
        return 값 ? `( ${값.slice(0, 2)} : ${값.slice(3, 5)} )` : "(    :    )";
      }
      return 줄;                 // 「1회차」·빈 줄은 그대로
    })
    .join("\n");
}

/** 제공 형태 칸 — 두 회차가 한 칸을 씁니다. */
function 형태칸(앞: 한번 | undefined, 뒤: 한번 | undefined): string {
  const 한줄 = (x: 한번 | undefined) =>
    x ? [x.제공형태 || "", x.장소 ? `(${x.장소})` : ""].filter(Boolean).join("\n") : "";
  const a = 한줄(앞), b = 한줄(뒤);
  if (!a && !b) return "";
  if (!b) return a;
  if (!a) return b;
  // 둘이 같으면 한 번만 적습니다. 같은 말을 두 번 적으면 칸이 넘칩니다.
  if (a === b) return a;
  return `1) ${a.replace(/\n/g, " ")}\n2) ${b.replace(/\n/g, " ")}`;
}

function 서식4만들기(g: 모은것): { name: string; data: Buffer }[] {
  const tpl = readFileSync(join(서식폴더(), 서식4파일));
  const 묶음: 한번[][] = [];
  for (let i = 0; i < Math.max(g.것들.length, 1); i += 서식4.회차수)
    묶음.push(g.것들.slice(i, i + 서식4.회차수));

  const 나갈것: { name: string; data: Buffer }[] = [];

  묶음.forEach((묶, si) => {
    const d = new Hwpx(tpl);
    const t = d.tables()[0];
    const 칸 = (r: number, c: number) => d.cell(t, r, c);

    d.setCell(칸(...서식4.이용자), g.대상자.이름);
    d.setCell(칸(...서식4.생년월일), g.대상자.생년월일);
    d.setCell(칸(...서식4.제공인력), g.인력);
    {
      const c = 칸(...서식4.기관);
      const 원문 = String(d.cellText(c));
      d.setCell(c, 원문.includes(":") ? `${원문.replace(/\s*$/, "")} ${g.기관}` : 원문, false);
    }

    /*
     * 묶음마다 두 회차씩. 안 쓴 자리는 **빈 모양으로 되돌립니다** —
     * 편람 예시의 「콩나물 무침」이 남으면 안 됩니다.
     */
    서식4.묶음첫줄.forEach((첫줄, k) => {
      const 앞 = 묶[k * 2], 뒤 = 묶[k * 2 + 1];

      d.setCell(칸(첫줄, 0), 회차칸4(String(d.cellText(칸(첫줄, 0))), 앞, 뒤), false);
      d.setCell(칸(첫줄, 1), 형태칸(앞, 뒤), false);

      // 죽 줄 · 반찬 줄 — c1 이 앞 회차, c2 가 뒤 회차입니다.
      d.setCell(칸(첫줄 + 1, 1), 앞?.주식 ?? "", false);
      d.setCell(칸(첫줄 + 1, 2), 뒤?.주식 ?? "", false);
      d.setCell(칸(첫줄 + 2, 1), 앞?.반찬 ?? "", false);
      d.setCell(칸(첫줄 + 2, 2), 뒤?.반찬 ?? "", false);

      /*
       * 특이사항은 두 회차가 한 칸을 나눠 씁니다. 날짜를 앞에 붙여
       * 어느 날 이야기인지 알 수 있게 합니다.
       */
      const 말들 = [앞, 뒤]
        .filter((x) => x?.특이사항?.trim())
        .map((x) => `- (${월일(x!.날)}) ${x!.특이사항.trim()}`);
      d.setCell(칸(첫줄 + 3, 1), 말들.join("\n"), false);
    });

    /*
     * 비고(종합의견) — 마지막 장에만. 서명 칸은 종이에 받는 자리라
     * 우리가 채우지 않습니다.
     */
    const 마지막장 = si === 묶음.length - 1;
    const 받은서명수 = g.것들.filter((x) => x.서명).length;
    d.setCell(칸(...서식4.비고),
      마지막장 && 받은서명수
        ? `- 이용자 확인서명 ${받은서명수}회 받음 (현장 기록 보관)`
        : "", false);

    const 꼬리 = 묶음.length > 1 ? `_${si + 1}` : "";
    나갈것.push({
      name: `${g.달}_서식4_${g.대상자.이름}${꼬리}.hwpx`,
      data: d.save(),
    });
  });

  return 나갈것;
}

/* ══════════════════════════════════════════════════════════════
 *  바깥에서 부르는 것
 * ══════════════════════════════════════════════════════════════ */

/** 그 배정의 그 달치 제공기록지. 갈래에 맞는 서식으로 나갑니다. */
export function 만들기(assignId: number, 달: string) {
  const g = 모으기(assignId, 달);
  if (!g.것들.length)
    throw new Error(`${g.달} 에 ${g.대상자.이름} 님의 「${g.서비스}」 제공 실적이 없습니다.`);

  if (g.갈래 === "가사") return 서식3만들기(g);
  if (g.갈래 === "식사") return 서식4만들기(g);
  if (g.갈래 === "동행" || g.갈래 === "이미용") return 서식5만들기(g);

  /*
   * 「기타」는 서식이 없습니다 — 안전생활환경개선(공사형)은 서식6-1·6-2 로
   * 따로 나가고, 그건 외부 업체가 쓰는 것이라 이 자리가 아닙니다.
   */
  throw new Error(
    `「${g.서비스}」는 제공기록지 서식이 없는 서비스입니다 ` +
    `(가사·식사·동행·이미용만 서식3·4·5 로 나갑니다).`);
}

/** 그 달 전체를 묶음으로. */
export function 통째로(달: string, assignIds: number[]) {
  const files: { name: string; data: Buffer }[] = [];
  const 못한것: string[] = [];
  for (const id of assignIds) {
    try { files.push(...만들기(id, 달)); }
    catch (e: any) { 못한것.push(e.message); }
  }
  if (!files.length)
    throw new Error(못한것.length ? 못한것.join(" / ") : "낼 제공기록지가 없습니다.");
  return {
    files,
    zip: zipFiles(files),
    count: files.length,
    못한것,
    name: `${달}_제공기록지_${files.length}건.zip`,
  };
}
