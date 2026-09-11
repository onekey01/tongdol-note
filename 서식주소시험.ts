/**
 * 서식에 **동·호수가 실리는지** 봅니다.
 *
 * 주소를 두 칸(도로명 · 상세)으로 나눈 뒤 **합치는 것을 한 곳이라도 빠뜨리면**,
 * 어르신 댁 동·호수가 빠진 계약서와 기록지가 나가고 제공인력이 헛걸음합니다.
 * 계약서는 PDF, 기록지는 한글로만 나가서 화면으로는 확인할 수가 없습니다.
 * 그래서 **자료를 모으는 자리**를 직접 불러 봅니다.
 */
import { db } from "./server/db";
import { 주소한줄 } from "./server/util";
import { gather } from "./server/contract";
import { gather as 기록지모으기 } from "./server/recordbook";

const 결과: { n: string; ok: boolean; d?: string }[] = [];
const 통과 = (n: string, ok: boolean, d = "") => 결과.push({ n, ok: !!ok, d });

const 도로 = "전라남도 해남군 해남읍 중앙1로 330 (해남군청)";
const 상세 = "101동 502호";

// ── 함수 자체 ────────────────────────────────────────────────
통과("도로명만 있으면 그대로", 주소한줄({ address: 도로 }) === 도로, 주소한줄({ address: 도로 }));
통과("**둘 다 있으면 사이에 한 칸**",
  주소한줄({ address: 도로, addressDetail: 상세 }) === `${도로} ${상세}`,
  주소한줄({ address: 도로, addressDetail: 상세 }));
통과("상세만 있으면 상세만 (앞에 빈칸 안 붙음)",
  주소한줄({ addressDetail: 상세 }) === 상세, JSON.stringify(주소한줄({ addressDetail: 상세 })));
통과("둘 다 없으면 빈 글", 주소한줄({}) === "", JSON.stringify(주소한줄({})));
통과("앞뒤 빈칸은 털어 냅니다",
  주소한줄({ address: `  ${도로} `, addressDetail: ` ${상세}  ` }) === `${도로} ${상세}`);

// ── 실제 서식이 그 함수를 쓰는가 ─────────────────────────────
const 시험id = crypto.randomUUID();
try {
  db.run(
    `INSERT INTO recipient (id, payload, search_text, dong, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, '이용', datetime('now'), datetime('now'))`,
    [시험id,
     JSON.stringify({ name: "서식주소시험", birth: "1940-03-02", address: 도로, addressDetail: 상세 }),
     "서식주소시험", "해남읍"]
  );

  const c = gather(시험id);
  통과("**계약서에 동·호수가 실린다**",
    c.recipient.address === `${도로} ${상세}`, c.recipient.address);

  const 이번달 = new Date().toISOString().slice(0, 7);
  const r = 기록지모으기(시험id, 이번달);
  통과("**기록지에도 동·호수가 실린다**",
    r.recipient.address === `${도로} ${상세}`, r.recipient.address);
} finally {
  db.run("DELETE FROM recipient WHERE id = ?", [시험id]);
  const 남음 = db.query<{ c: number }, [string]>(
    "SELECT COUNT(*) AS c FROM recipient WHERE id = ?").get(시험id);
  통과("시험이 넣은 대상자를 치웠다", (남음?.c ?? 1) === 0);
}

let 실패 = 0;
for (const r of 결과) {
  if (!r.ok) 실패++;
  console.log(`${r.ok ? "  통과" : "✗ 실패"}  ${r.n}${r.d ? "   — " + r.d : ""}`);
}
console.log(`\n${결과.length}가지 중 ${결과.length - 실패}가지 통과, ${실패}가지 실패`);
process.exit(실패 ? 1 : 0);
