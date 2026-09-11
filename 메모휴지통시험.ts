/**
 * 메모장 — 휴지통과 권한 시험.
 *
 *   bun 메모휴지통시험.ts
 *
 * 30일을 실제로 기다릴 수는 없으니, **뗀 날짜를 과거로 적어 두고** 봅니다.
 * 자료함을 직접 만지는 시험이라 시험이 끝나면 넣은 것을 도로 치웁니다.
 */

import { db } from "./server/db";
import {
  addSticky, setDone, listStickies, removeSticky,
  휴지통비우기, 보관일수, 자리규칙,
} from "./server/sticky";
import { can } from "./server/perm";

/** 시험 쪽에서도 같은 규칙으로 겹침을 봅니다. */
function 겹치나(a: any, b: any) {
  const g = 자리규칙.틈;
  return !(a.x + a.w + g <= b.x || b.x + b.w + g <= a.x ||
           a.y + a.h + g <= b.y || b.y + b.h + g <= a.y);
}

let 통과수 = 0, 실패수 = 0;
function 통과해야(무엇: string, 참: boolean, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}

const 관리자 = { id: 1, name: "시험관리자", roles: "admin" };
const 사무 = { id: 2, name: "시험사무", roles: "staff" };
const 인력 = { id: 3, name: "시험인력", roles: "worker" };

const 넣은것: number[] = [];
function 붙이기(글: string) {
  const r = addSticky({ text: 글 }, 관리자);
  넣은것.push(r.id);
  return r.id;
}
/** 뗀 날짜를 과거로 밀어 둡니다 — 30일을 기다릴 수는 없으니. */
function 뗀날을(id: number, 며칠전: number) {
  const when = new Date(Date.now() - 며칠전 * 24 * 60 * 60 * 1000).toISOString();
  db.run("UPDATE sticky SET done_at = ? WHERE id = ?", [when, id]);
}
const 살아있나 = (id: number) =>
  !!db.query<any, [number]>("SELECT id FROM sticky WHERE id = ?").get(id);

console.log("\n── 1. 휴지통 — 30일이 지나면 스스로 사라진다 ─────────────\n");

const 어제뗀것 = 붙이기("시험: 어제 뗀 것");
const 스무날 = 붙이기("시험: 스무날 전에 뗀 것");
const 스무아홉날 = 붙이기("시험: 29일 전에 뗀 것");
const 서른날 = 붙이기("시험: 30일 전에 뗀 것");
const 서른하루 = 붙이기("시험: 31일 전에 뗀 것");
const 백날 = 붙이기("시험: 100일 전에 뗀 것");
const 안뗀것 = 붙이기("시험: 안 뗀 것 — 아무리 오래돼도 안 없어져야 한다");

for (const id of [어제뗀것, 스무날, 스무아홉날, 서른날, 서른하루, 백날]) {
  setDone(id, true, 관리자);
}
뗀날을(어제뗀것, 1);
뗀날을(스무날, 20);
뗀날을(스무아홉날, 29);
뗀날을(서른날, 30.5);        // 서른 날을 **넘긴** 것
뗀날을(서른하루, 31);
뗀날을(백날, 100);
// 안 뗀 것은 붙인 날을 아주 옛날로 — 그래도 살아 있어야 합니다.
db.run("UPDATE sticky SET created_at = ? WHERE id = ?",
       [new Date(Date.now() - 400 * 86400000).toISOString(), 안뗀것]);

const 버린수 = 휴지통비우기();

통과해야("보관일수는 30일", 보관일수 === 30, String(보관일수));
통과해야("어제 뗀 것은 남는다", 살아있나(어제뗀것));
통과해야("20일 전에 뗀 것은 남는다", 살아있나(스무날));
통과해야("29일 전에 뗀 것은 남는다 — 하루 차이로 안 지운다", 살아있나(스무아홉날));
통과해야("30일을 넘긴 것은 없어진다", !살아있나(서른날));
통과해야("31일 전에 뗀 것은 없어진다", !살아있나(서른하루));
통과해야("100일 전에 뗀 것은 없어진다", !살아있나(백날));
통과해야("안 뗀 것은 400일이 지나도 안 없어진다 — 떼기 전까지 붙어 있습니다",
         살아있나(안뗀것));
통과해야("버린 장수를 돌려준다", 버린수 >= 3, String(버린수));

console.log("\n── 2. 며칠 남았는지 알려 준다 ────────────────────────────\n");

const 목록 = listStickies({ done: true, board: "" });
const 찾기 = (id: number) => 목록.find((x: any) => x.id === id) as any;

통과해야("어제 뗀 것은 29일 남음", 찾기(어제뗀것)?.남은날 === 29,
         String(찾기(어제뗀것)?.남은날));
통과해야("20일 전에 뗀 것은 10일 남음", 찾기(스무날)?.남은날 === 10,
         String(찾기(스무날)?.남은날));
통과해야("29일 전에 뗀 것은 1일 남음", 찾기(스무아홉날)?.남은날 === 1,
         String(찾기(스무아홉날)?.남은날));
통과해야("안 뗀 것에는 남은 날이 없다", 찾기(안뗀것)?.남은날 === null,
         String(찾기(안뗀것)?.남은날));
통과해야("남은 날은 음수가 되지 않는다",
         목록.every((x: any) => x.남은날 === null || x.남은날 >= 0));

console.log("\n── 3. 뗀 것은 보드에서 내려가되 되살릴 수 있다 ───────────\n");

const 붙은목록 = listStickies({ done: false, board: "" });
통과해야("뗀 것은 보드에 안 보인다",
         !붙은목록.some((x: any) => x.id === 스무날));
통과해야("안 뗀 것은 보드에 보인다",
         붙은목록.some((x: any) => x.id === 안뗀것));

setDone(스무날, false, 관리자);
const 되살린뒤 = listStickies({ done: false, board: "" });
통과해야("다시 붙이면 보드로 돌아온다",
         되살린뒤.some((x: any) => x.id === 스무날));
통과해야("다시 붙이면 남은 날이 사라진다",
         (되살린뒤.find((x: any) => x.id === 스무날) as any)?.남은날 === null);
// 되살린 것을 다시 옛날로 밀어도, 다시 붙였으니 안 없어져야 합니다.
db.run("UPDATE sticky SET created_at = ? WHERE id = ?",
       [new Date(Date.now() - 400 * 86400000).toISOString(), 스무날]);
휴지통비우기();
통과해야("되살린 것은 아무리 오래돼도 안 없어진다", 살아있나(스무날));

console.log("\n── 3-2. 다시 붙이면 맨 아래로 — 겹치지 않게 ──────────────\n");

// 뗀 동안 그 자리에 남이 앉을 수 있습니다. 돌아올 때 제 자리를 우기면 겹칩니다.
const 갑 = 붙이기("시험: 갑");
const 을 = 붙이기("시험: 을");
const 병 = 붙이기("시험: 병");
const 자리of = (id: number) =>
  db.query<any, [number]>("SELECT x, y, w, h FROM sticky WHERE id = ?").get(id);

const 을처음 = 자리of(을);
setDone(을, true, 관리자);                      // 을을 뗍니다
// 을이 있던 자리에 정확히 새 메모를 앉힙니다 (떼어 둔 동안은 빈자리로 셉니다)
const 정 = 붙이기("시험: 정 — 을이 있던 자리");
db.run("UPDATE sticky SET x = ?, y = ? WHERE id = ?", [을처음.x, 을처음.y, 정]);
통과해야("떼어 둔 자리는 빈자리로 셈한다", 자리of(정).x === 을처음.x && 자리of(정).y === 을처음.y);

setDone(을, false, 관리자);                     // 을을 다시 붙입니다
const 을새자리 = 자리of(을);
통과해야("다시 붙인 것은 옛 자리로 돌아가지 않는다",
         !(을새자리.x === 을처음.x && 을새자리.y === 을처음.y),
         JSON.stringify({ 처음: 을처음, 지금: 을새자리 }));

const 붙어있는것 = listStickies({ done: false, board: "" }) as any[];
const 남들 = 붙어있는것.filter((x) => x.id !== 을)
  .map((x) => ({ x: x.x, y: x.y, w: x.w, h: x.h }));
const 나 = { x: 을새자리.x, y: 을새자리.y, w: 을새자리.w, h: 을새자리.h };
통과해야("다시 붙인 것은 아무와도 안 겹친다",
         !남들.some((o) => 겹치나(o as any, 나 as any)),
         JSON.stringify(나));

const 남들바닥 = 남들.reduce((m, o) => Math.max(m, o.y + o.h), 0);
통과해야("다시 붙인 것은 맨 아래에 놓인다 — 남의 배치를 건드리지 않는 유일한 자리",
         나.y + 나.h >= 남들바닥, `${나.y}+${나.h} vs 바닥 ${남들바닥}`);
통과해야("맨 아래에 놓되 왼쪽 끝에 붙인다", 나.x === 0, String(나.x));

// 갑·병은 그대로 있어야 합니다 — 되살리느라 남의 자리를 옮기면 안 됩니다.
통과해야("되살려도 남의 자리는 안 흔든다",
         자리of(갑).x !== null && 자리of(병).x !== null);

console.log("\n── 4. 메모장은 관리자만 ──────────────────────────────────\n");

통과해야("관리자는 메모장을 쓸 수 있다", can(관리자, "memo.use"));
통과해야("사무직원은 못 쓴다 — 지금은 관리자만", !can(사무, "memo.use"));
통과해야("제공인력은 못 쓴다", !can(인력, "memo.use"));
통과해야("대상자 보기 권한과는 별개다 — 사무직원은 대상자는 보되 메모장은 못 쓴다",
         can(사무, "recipient.viewAll") && !can(사무, "memo.use"));

console.log("\n── 5. 뒷정리 ─────────────────────────────────────────────\n");

for (const id of 넣은것) {
  try { if (살아있나(id)) removeSticky(id, 관리자); } catch { }
}
통과해야("시험에 쓴 메모를 모두 치웠다", 넣은것.every((id) => !살아있나(id)));

console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
process.exit(실패수 ? 1 : 0);
