import { db } from "./db";
import { today } from "./util";
import { month as recordMonth, REASONS } from "./record";
import { 갈래들, 갈래읽기, 돈드는실적SQL } from "./미제공";

/**
 * 통계 — **한 해를 한 화면에서.**
 *
 * ── 무엇을 위해 있는가 ─────────────────────────────────────
 *
 * 지자체가 묻는 말은 정해져 있습니다.
 *
 *   「주 2회인데 왜 여섯 번뿐입니까」   → 계획 대비 실적 · 못 간 사유
 *   「이 어르신 안전생활환경개선 얼마 남았습니까」 → 생애한도
 *   「제공인력별로 몇 건씩 나갔습니까」 → 사람별 표
 *
 * 화면마다 흩어져 있으면 물어볼 때마다 세 곳을 뒤져야 합니다.
 * **한 자리에 모아 두고, 그대로 인쇄해서 들고 갑니다.**
 *
 * ── 왜 「시간」 축이 없는가 ────────────────────────────────
 *
 * 「횟수와 시간 두 축으로」 이야기했었는데, **시간은 지금 셀 수 없습니다.**
 * 지침에 서비스별 소요시간이 없고, 그래서 주간계획에도 시각을 안 넣기로
 * 정했습니다. 없는 값을 만들어 채우면 그 숫자가 지자체 서류로 나갑니다.
 * 시간은 **현장앱**이 붙어 방문 시작·종료가 찍히면 그때 생깁니다.
 *
 * ── 왜 돈을 여기서 안 세는가 ───────────────────────────────
 *
 * 돈은 **정산 화면 하나가** 셈합니다. 통계에서 또 셈하면
 * 두 화면이 서로 다른 금액을 말하는 날이 반드시 옵니다.
 * 생애한도만 예외로 가져오는데, 그것도 `billing.ts` 가 셈한 것을 빌려 씁니다.
 */

const p2 = (n: number) => String(n).padStart(2, "0");

export type 줄 = {
  key: string;
  이름: string;
  곁말: string;      // 읍면동 · 서비스 같은 딸린 설명
  계획: number;
  제공: number;
  미제공: number;
  남음: number;
  달성률: number | null;   // 계획이 0이면 잴 수 없습니다
  /**
   * 계획보다 **더** 처리한 건수. 없으면 0.
   *
   * 달성률을 100% 에서 끊는 대신 넘친 만큼을 여기 담습니다 —
   * 아래 `마무리()` 주석에 까닭을 적어 두었습니다.
   */
  초과: number;
};

function 빈줄(key: string, 이름: string, 곁말 = ""): 줄 {
  return { key, 이름, 곁말, 계획: 0, 제공: 0, 미제공: 0, 남음: 0, 달성률: null, 초과: 0 };
}

/**
 * 달성률 = (제공 + 미제공) ÷ 계획.
 *
 * **못 간 것도 「처리한 것」에 넣습니다.** 사유를 적어 두었으면 그건 일을 한
 * 것입니다 — 지자체에 답할 수 있으니까요. 안 적힌 칸만 「아직」입니다.
 * 제공만 세면, 부재가 많은 어르신을 맡은 제공인력이 일을 안 한 것처럼 보입니다.
 */
/*
 * ── ★ 2026-09-07 바로잡음 — **100% 를 넘는 처리율** ★ ──────
 *
 * 시범자료에서 동행지원이 **125%** 로 떴습니다.
 *
 * 까닭은 셈이 틀려서가 아닙니다. 「월 2회」처럼 **요일이 없는 서비스**는
 * 계획이 그 달 2회인데, 실제로는 네 번 다녀올 수 있습니다. 그러면
 * 4 ÷ 2 = 200% 가 나옵니다.
 *
 * 숫자로는 맞지만 **지자체에 내는 종이에 100% 넘는 값이 있으면 안 됩니다.**
 * 보는 사람은 셈이 틀렸다고 읽지, 「계획보다 더 갔구나」로 안 읽습니다.
 *
 * 그래서 **비율은 100 에서 끊고, 넘친 건수를 따로 적습니다.**
 * 「100% (2건 더)」 — 사실은 그대로 남고, 종이는 멀쩡합니다.
 * 넘친 것은 월 한도 쪽에서 따로 짚습니다(제공실적 화면의 「4/2회 넘음」).
 */
function 마무리(x: 줄): 줄 {
  if (x.계획 <= 0) { x.달성률 = null; x.초과 = 0; return x; }
  const 처리 = x.제공 + x.미제공;
  x.달성률 = Math.min(100, Math.round((처리 / x.계획) * 100));
  x.초과 = Math.max(0, 처리 - x.계획);
  return x;
}

/**
 * 한 해 통계.
 *
 * `월` 을 주면 그 달만, 안 주면 **그 해 전체**를 셉니다.
 * 계획·제공·미제공은 `record.month()` 가 이미 셈하고 있으므로 **그것을 빌려 씁니다.**
 * 여기서 다시 셈하면 제공실적 화면과 숫자가 어긋나는 날이 옵니다.
 */
export function 해통계(해: number, 월?: number | null) {
  const 올해 = Number(today().slice(0, 4));
  const 이번월 = Number(today().slice(5, 7));
  const 월들 = 월 ? [월] : Array.from({ length: 12 }, (_, i) => i + 1);

  /*
   * 월별 흐름 — **언제나 열두 칸.**
   *
   * 처음에는 한 달을 고르면 그 달만 담았습니다. 그랬더니 화면의
   * **월 고르개에서 나머지 열한 달이 사라져서**, 다른 달로 넘어가려면
   * 「한 해」로 되돌아갔다가 다시 골라야 했습니다.
   * 고르개는 늘 열두 칸이 있어야 합니다. `셈함` 이 실제로 센 달을 가립니다.
   */
  const 월별: {
    월: number; 계획: number; 제공: number; 미제공: number;
    남음: number; 옴: boolean; 셈함: boolean;
  }[] = [];

  const 사람별 = new Map<string, 줄>();     // 제공인력
  const 대상자별 = new Map<string, 줄>();
  const 서비스별 = new Map<string, 줄>();
  const 행정동별 = new Map<string, 줄>();
  const 사유별 = new Map<string, number>();
  /*
   * 못 간 날의 **갈래별** 셈 (A-3 · 7-아).
   *
   * 사유(부재·입원…)와 다른 축입니다. 사유는 「무슨 일이 있었나」이고,
   * 갈래는 **「돈이 나갔나」**입니다. 지자체가 「미제공이 30건인데
   * 왜 청구가 들어옵니까」라고 물으면 이 표가 답입니다.
   */
  const 갈래별 = new Map<string, number>();
  let 전체 = 빈줄("전체", "전체");

  for (const mm of Array.from({ length: 12 }, (_, i) => i + 1)) {
    const 옴 = 해 < 올해 || (해 === 올해 && mm <= 이번월);
    const 셀까 = 월들.includes(mm) && 옴;
    if (!셀까) {
      월별.push({ 월: mm, 계획: 0, 제공: 0, 미제공: 0, 남음: 0, 옴, 셈함: false });
      continue;
    }

    const d = recordMonth(`${해}-${p2(mm)}`);
    월별.push({ 월: mm, ...d.tally, 옴, 셈함: true });

    for (const it of d.items as any[]) {
      const 넣기 = (m: Map<string, 줄>, key: string, 이름: string, 곁말: string) => {
        const r = m.get(key) ?? 빈줄(key, 이름, 곁말);
        r.계획 += it.계획; r.제공 += it.제공; r.미제공 += it.미제공;
        r.남음 += it.남음;
        m.set(key, r);
      };

      // 담당이 없는 배정은 「(담당 없음)」으로 한 줄에 모읍니다.
      // 지우면 합계가 안 맞고, 사람마다 흩으면 그것대로 안 보입니다.
      넣기(사람별, String(it.workerUserId ?? "없음"),
           it.worker || "(담당 없음)", "");
      넣기(대상자별, it.recipientId, it.recipient, it.dong ?? "");
      넣기(서비스별, String(it.serviceId), it.service, "");
      // 읍면동이 안 적힌 분은 「(읍면동 없음)」으로 모읍니다.
      // 지우면 합계가 안 맞고, 그대로 두면 어디를 채워야 하는지 보입니다.
      넣기(행정동별, it.dong || "(읍면동 없음)", it.dong || "(읍면동 없음)", "");

      전체.계획 += it.계획; 전체.제공 += it.제공;
      전체.미제공 += it.미제공; 전체.남음 += it.남음;

      for (const c of it.cells as any[]) {
        if (c.state !== "미제공") continue;
        const 사유 = String(c.reason ?? "").trim() || "(사유 없음)";
        사유별.set(사유, (사유별.get(사유) ?? 0) + 1);
        const g = 갈래읽기(c.missKind);
        갈래별.set(g, (갈래별.get(g) ?? 0) + 1);
      }
    }
  }

  const 정렬 = (m: Map<string, 줄>) =>
    [...m.values()].map(마무리).sort(
      (a, b) => b.계획 - a.계획 || a.이름.localeCompare(b.이름, "ko"));

  /*
   * 사유는 **우리가 정한 차례**로 늘어놓습니다(부재 · 거부 · 입원 …).
   * 많은 것부터 늘어놓으면 월마다 차례가 바뀌어, 지난 월 것과 견주기 어렵습니다.
   */
  const 사유차례 = [...REASONS, "(사유 없음)"];
  const 사유 = [...사유별.entries()]
    .sort((a, b) => {
      const i = 사유차례.indexOf(a[0]), j = 사유차례.indexOf(b[0]);
      return (i < 0 ? 99 : i) - (j < 0 ? 99 : j);
    })
    .map(([이름, 수]) => ({ 이름, 수 }));

  /* 갈래도 **우리가 정한 차례**로. 노쇼가 맨 앞입니다 — 돈이 걸린 것이니까요. */
  const 갈래 = 갈래들
    .map((이름) => ({ 이름, 수: 갈래별.get(이름) ?? 0 }))
    .filter((x) => x.수 > 0);

  return {
    해, 월: 월 ?? null,
    월별,
    전체: 마무리(전체),
    사람별: 정렬(사람별),
    대상자별: 정렬(대상자별),
    서비스별: 정렬(서비스별),
    행정동별: 정렬(행정동별),
    사유,
    갈래,
    // 그중 돈이 나간 것 — 노쇼. 지자체에 답할 때 이 숫자가 필요합니다.
    노쇼합: 갈래별.get("노쇼") ?? 0,
    미제공합: 사유.reduce((s, x) => s + x.수, 0),
  };
}

/**
 * 생애한도 — **넘기면 기관이 떠안습니다.**
 *
 * 안전생활환경개선처럼 「생애 200만원」 한도가 붙는 서비스가 있습니다.
 * 이번 달 것만 보면 넘겼는지 알 수 없어서 **처음부터 전부** 셉니다.
 *
 * 「임박」은 **80%부터**입니다. 다 쓴 뒤에 알려 주면 이미 늦습니다 —
 * 공사를 잡기 전에 알아야 취소할 수 있습니다.
 */
export const 임박선 = 0.8;

export function 생애한도현황() {
  /*
   * **지금 쓰는 규칙의 서비스만** 봅니다.
   * 자료함에는 쓰지 않는 지자체 프로필의 서비스도 함께 들어 있어서,
   * 그냥 뽑으면 「안전생활환경개선」이 셋씩 늘어섭니다.
   */
  const 한도서비스 = db.query<any, []>(
    `SELECT sv.id, sv.name, sv.lifetime_cap FROM service sv
      WHERE sv.lifetime_cap IS NOT NULL
        AND sv.profile_id = (SELECT profile_id FROM organization WHERE id = 1)`).all();
  if (한도서비스.length === 0) return { 한도있음: false, 줄들: [] as any[] };

  /*
   * ── ★ 어느 실적을 볼지 **먼저 좁힙니다** (2026-09-08 운용 시험) ──
   *
   * 전에는 실적을 **통째로** 훑으면서 「생애한도가 있는 서비스인가」를
   * 줄마다 물었습니다. 생애한도가 붙은 것은 **안전생활환경 하나뿐**인데,
   * 그것을 가리려고 가사·식사·동행 실적 십수만 줄을 다 읽은 것입니다.
   *
   * 대상자 300명 · 2년치(14만 줄)로 재어 보니 통계 화면이 **1.1초**였고,
   * 그 대부분이 이 줄이었습니다.
   *
   * 이제 **서비스 번호로 먼저 좁혀서** 색인(idx_delivery_svc)이 일하게
   * 합니다. 세는 방법은 한 글자도 안 바뀝니다 — 어차피 버릴 줄을
   * 안 읽어 올 뿐입니다.
   */
  const 볼서비스 = 한도서비스.map((s: any) => Number(s.id));
  const 자리 = 볼서비스.map(() => "?").join(",");
  const rows = db.query<any, number[]>(
    `SELECT d.recipient_id, d.service_id, sv.name AS service, sv.lifetime_cap AS cap,
            r.payload, r.dong, r.status,
            SUM(sv.unit_price) AS 쓴돈, COUNT(*) AS 횟수, MAX(d.served_on) AS 마지막
       FROM delivery d
       JOIN service sv   ON sv.id = d.service_id
       JOIN recipient r  ON r.id  = d.recipient_id
      WHERE d.service_id IN (${자리}) AND ${돈드는실적SQL} AND sv.lifetime_cap IS NOT NULL
      GROUP BY d.recipient_id, d.service_id`
  ).all(...볼서비스);

  const 줄들 = rows.map((x: any) => {
    const info = JSON.parse(x.payload || "{}");
    const 남은돈 = x.cap - x.쓴돈;
    return {
      recipientId: x.recipient_id,
      이름: info.name ?? "",
      dong: x.dong ?? "",
      status: x.status,
      service: x.service,
      한도: x.cap,
      쓴돈: x.쓴돈,
      남은돈,
      비율: x.cap > 0 ? x.쓴돈 / x.cap : 0,
      횟수: x.횟수,
      마지막: x.마지막,
      넘음: 남은돈 < 0,
      임박: 남은돈 >= 0 && x.cap > 0 && x.쓴돈 / x.cap >= 임박선,
    };
  }).sort((a, b) => b.비율 - a.비율 || a.이름.localeCompare(b.이름, "ko"));

  return {
    한도있음: true,
    임박선,
    서비스들: 한도서비스.map((s: any) => ({ 이름: s.name, 한도: s.lifetime_cap })),
    줄들,
    넘음: 줄들.filter((x) => x.넘음).length,
    임박: 줄들.filter((x) => x.임박).length,
  };
}
