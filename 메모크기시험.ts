/**
 * 저절로 붙는 메모지 크기 —  bun 메모크기시험.ts
 *
 * ═══════════════════════════════════════════════════════════
 *  왜 이 시험이 있나
 * ═══════════════════════════════════════════════════════════
 *
 * (2026-09-07 무무 — 「시스템이 자동으로 메모를 추가한 경우 **스크롤바가
 *  생기지 않도록** 메모지의 크기를 키워서 생성되도록 해줘」)
 *
 * 현장 특이사항은 저절로 대상자 메모지로 넘어옵니다. 머리말만
 * 「[2026-09-05 · 가사지원 · 김영희] 」로 두 줄을 먹는데, 기본 크기
 * (220×150)에는 넉 줄밖에 안 들어갑니다. 그래서 **거의 모든 자동 메모에
 * 스크롤바가 생겼습니다.**
 *
 * 손으로 적는 메모는 그래도 됩니다 — 적은 사람이 바로 보고 늘리면
 * 되니까요. 저절로 붙는 것은 **아무도 그 자리에 없습니다.** 사무실이
 * 기록지를 쓰려고 열었을 때 스무 장이 다 잘려 있으면 안 봅니다.
 *
 * ── ★ 왜 진짜 브라우저에서 재는가 ★ ────────────────────────
 *
 * 크기를 셈하는 자리(server/sticky.ts)는 글자 폭을 **어림**합니다.
 * 그런데 진짜로 줄을 접는 것은 브라우저이고, `word-break: break-word` 는
 * **낱말 가운데를 안 자르려고** 줄을 일찍 끝냅니다. 그래서 셈한 줄 수보다
 * 실제 줄 수가 많아질 수 있습니다.
 *
 * 숫자로만 견주면 「맞게 셈했다」가 통과하고, 정작 화면에는 스크롤바가
 * 그대로 있습니다. 그래서 **진짜 화면을 열어 `scrollHeight` 를 잽니다** —
 * 규칙이 사는 자리에서 재는 것입니다.
 */
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { db, initDb } from "./server/db";
initDb();
import { 시험관리자 } from "./도구/시험관리자";
import { 글에맞는크기, addSticky, 자리규칙, 옛메모지키우기 } from "./server/sticky";
import { metaGet, metaSet } from "./server/db";

const 주소 = "http://127.0.0.1:5757";
let 통과수 = 0, 실패수 = 0;
function 본다(무엇: string, ok: unknown, 덧말 = "") {
  if (ok) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "  — " + 덧말 : ""}`); }
}

const 올해 = new Date().getFullYear();
const 사람 = randomUUID();
let 관: any = null;
const 붙인것: number[] = [];

/*
 * ★ **현장에서 실제로 올라오는 모양**으로 만듭니다.
 *   짧은 것 · 보통 것 · 긴 것 · 아주 긴 것 · 줄바꿈이 든 것 ·
 *   영어가 섞인 것 · 긴 낱말이 든 것(줄을 일찍 끝내게 만드는 것).
 */
const 머리 = `[${올해}-09-05 · 가사지원 · 김영희]`;
const 글감 = [
  { 이름: "짧은 것", 글: `${머리} 잘 계셨습니다.` },
  { 이름: "보통 것", 글: `${머리} 무릎이 아프시다고 하셔서 외출은 다음으로 미뤘습니다.` },
  { 이름: "긴 것", 글: `${머리} 어르신께서 오늘은 입맛이 없다고 하셔서 죽을 조금만 드셨습니다. ` +
      `약은 아침에 드신 것을 확인했고, 저녁 약은 머리맡에 두고 왔습니다. 며느님께 전화드려 말씀드렸습니다.` },
  { 이름: "아주 긴 것", 글: `${머리} ` + "어르신 댁 상황을 자세히 적습니다. ".repeat(12) },
  { 이름: "줄바꿈이 든 것", 글: `${머리}\n청소 마쳤습니다.\n세탁기 돌려 두었습니다.\n다음 주 화요일에 병원 가신다고 합니다.` },
  { 이름: "영어가 섞인 것", 글: `${머리} 보호자분 연락처가 010-1234-5678 로 바뀌었다고 하십니다. email 은 family@example.com` },
  { 이름: "긴 낱말이 든 것", 글: `${머리} ${"가나다라마바사아자차카타파하".repeat(6)}` },
  { 이름: "최대치(500자)", 글: (머리 + " " + "어르신 말씀을 그대로 옮깁니다. ".repeat(40)).slice(0, 500) },
];

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const 쪽 = await b.newPage({ viewport: { width: 1500, height: 1100 } });

try {
  관 = await 시험관리자("메모시험관리자");

  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at)
          VALUES (?,?,?,?,?,?)`,
    [사람, JSON.stringify({ name: "메모크기시험" }), "해남읍", "이용", `${올해}-01-01`, "x"]);

  // ══════════════════════════════════════════════════════════
  //  ① 셈하는 자리 — 테두리
  // ══════════════════════════════════════════════════════════
  console.log("\n── ① 크기를 재는 규칙 ★ ──────────────────────\n");
  {
    본다("★ 짧은 글은 기본 크기 그대로다",
      글에맞는크기("짧은 말").w === 자리규칙.기본너비 &&
      글에맞는크기("짧은 말").h === 자리규칙.기본높이,
      JSON.stringify(글에맞는크기("짧은 말")));

    const 긴것 = 글에맞는크기("가".repeat(400));
    본다("★★ 긴 글은 커진다",
      긴것.h > 자리규칙.기본높이, JSON.stringify(긴것));
    /*
     * ★ **높이는 사람이 끄는 한도(420)보다 높아도 됩니다.**
     *   420 은 손잡이를 끌 때의 한도입니다. 저절로 붙는 것은 아무도
     *   늘려 주지 않으므로, 500자짜리 특이사항이 들어가려면 더 커야
     *   합니다. 세로로 긴 종이는 보드가 아래로 늘어날 뿐이지만,
     *   잘린 종이는 **읽을 수가 없습니다.**
     *
     *   너비는 다릅니다 — 서랍보다 넓으면 옆으로 밀려 나가 더 나쁩니다.
     */
    본다("★ 너비는 한도를 안 넘는다",
      긴것.w <= 자리규칙.최대너비,
      `${긴것.w}px — 서랍보다 넓으면 옆으로 밀려 나갑니다`);
    본다("★ 높이도 끝없이 늘지는 않는다", 긴것.h <= 640,
      `${긴것.h}px — 메모지가 보드를 통째로 덮으면 그것도 못 씁니다`);
    본다("★ 최소치보다 작아지지 않는다",
      글에맞는크기("").w >= 자리규칙.최소너비 &&
      글에맞는크기("").h >= 자리규칙.최소높이);

    본다("★ 글이 길수록 커진다 (줄어들지 않는다)",
      (() => {
        let 앞 = 0;
        for (const n of [10, 50, 100, 200, 300, 400]) {
          const { w, h } = 글에맞는크기("가".repeat(n));
          const 넓이 = w * h;
          if (넓이 < 앞) return false;
          앞 = 넓이;
        }
        return true;
      })());

    본다("줄바꿈도 줄로 센다",
      글에맞는크기("가\n나\n다\n라\n마\n바\n사\n아").h > 자리규칙.기본높이,
      "한 줄에 한 자씩이어도 여덟 줄이면 기본 크기에 안 들어갑니다");
  }

  // ══════════════════════════════════════════════════════════
  //  ② 저절로 붙는 것만 커진다
  // ══════════════════════════════════════════════════════════
  console.log("\n── ② **저절로 붙는 것만** 커진다 ★ ────────────\n");
  const 긴글 = 글감[3].글;
  {
    const 손 = addSticky(
      { text: 긴글, color: "yellow", recipientId: 사람 },
      { id: null, name: "시험", role: "admin" });
    붙인것.push(손.id);
    본다("★ 손으로 적은 것은 기본 크기다",
      손.w === 자리규칙.기본너비 && 손.h === 자리규칙.기본높이,
      `${손.w}×${손.h} — 적은 사람이 바로 보고 늘리면 됩니다. 프로그램이 정해 버리면 일부러 작게 붙여 둔 쪽지도 커집니다`);

    const 절 = addSticky(
      { text: 긴글, color: "blue", recipientId: 사람, 저절로: true },
      { id: null, name: "시험", role: "admin" });
    붙인것.push(절.id);
    본다("★★ 저절로 붙는 것은 커진다", 절.h > 손.h, `${절.w}×${절.h} vs ${손.w}×${손.h}`);
    본다("★ 서로 안 겹친다",
      !(절.x < 손.x + 손.w && 손.x < 절.x + 절.w &&
        절.y < 손.y + 손.h && 손.y < 절.y + 절.h),
      "커진 크기로 빈자리를 찾아야 합니다 — 기본 크기로 찾으면 옆의 것을 덮습니다");

    /*
     * ★★ **여러 장을 잇달아 붙여도 안 겹쳐야 합니다.**
     *
     *   빈자리를 **커진 크기로** 찾아야 합니다. 기본 크기(220×150)로
     *   자리를 잡고 나서 크기만 키우면, 종이는 커진 채로 옆·아래의
     *   것을 덮습니다. 한 장만 보면 우연히 안 겹칠 수 있어서
     *   **여러 장**을 붙여 봐야 걸립니다 (2026-09-07 에 한 장짜리
     *   시험이 이 손질을 못 잡았습니다).
     */
    for (let i = 0; i < 6; i++) {
      const x = addSticky(
        { text: `${머리} ` + "겹침 시험용으로 길게 적습니다. ".repeat(3 + i),
          color: "blue", recipientId: 사람, 저절로: true },
        { id: null, name: "시험", role: "admin" });
      붙인것.push(x.id);
    }
    const 버전: any[] = db.query(
      "SELECT id, x, y, w, h FROM sticky WHERE recipient_id = ? AND done_at IS NULL"
    ).all(사람) as any[];
    const 겹친쌍: string[] = [];
    for (let i = 0; i < 버전.length; i++)
      for (let j = i + 1; j < 버전.length; j++) {
        const a = 버전[i], c = 버전[j];
        if (a.x < c.x + c.w && c.x < a.x + a.w &&
            a.y < c.y + c.h && c.y < a.y + a.h)
          겹친쌍.push(`${a.id}(${a.w}×${a.h})↔${c.id}(${c.w}×${c.h})`);
      }
    본다("★★ 여러 장을 붙여도 한 쌍도 안 겹친다", 겹친쌍.length === 0,
      겹친쌍.length ? 겹친쌍.slice(0, 3).join(" / ") : `${버전.length}장 모두 따로 앉음`);
  }

  // ══════════════════════════════════════════════════════════
  //  ③ ★★★ 진짜 화면에서 스크롤바가 없는가 ★★★
  // ══════════════════════════════════════════════════════════
  console.log("\n── ③ **진짜 화면에서 안 잘리는가** ★★★ ────────\n");
  {
    for (const g of 글감) {
      const s = addSticky(
        { text: g.글, color: "blue", recipientId: 사람, 저절로: true },
        { id: null, name: "시험", role: "admin" });
      붙인것.push(s.id);
    }

    await 쪽.goto(주소 + "/", { waitUntil: "networkidle" });
    await 관.들어가기(쪽);
    await 쪽.goto(`${주소}/recipients/${사람}`, { waitUntil: "networkidle" });
    await 쪽.waitForTimeout(1500);

    // 메모장 서랍 펼치기
    const 탭 = 쪽.locator(".memo-tab");
    if (await 탭.count()) { await 탭.click(); await 쪽.waitForTimeout(1200); }
    본다("대상자 메모장이 열렸다", await 쪽.locator(".memo-note").count() > 0,
      `${await 쪽.locator(".memo-note").count()}장`);
    /*
     * ★ **파랑(저절로 붙은 것)만 잽니다.** 노랑은 손으로 적은 것이라
     *   기본 크기이고, 길면 잘리는 것이 맞습니다 — 적은 사람이 늘리면
     *   됩니다. 섞어 재면 옳게 도는데도 시험이 실패합니다.
     */
    본다("저절로 붙은 것(파랑)을 골라 잰다",
      await 쪽.locator(".memo-note.blue").count() >= 글감.length,
      `파랑 ${await 쪽.locator(".memo-note.blue").count()}장 / 모두 ${await 쪽.locator(".memo-note").count()}장`);

    /*
     * ★ **브라우저에게 직접 묻습니다.**
     *   `scrollHeight > clientHeight` 이면 그 칸에 스크롤바가 생긴 것입니다.
     *   셈이 맞았는지가 아니라 **화면이 잘렸는지**를 봅니다.
     */
    const 잰것: any[] = await 쪽.evaluate(() =>
      [...document.querySelectorAll(".memo-note.blue")].map((n) => {
        const 몸 = n.querySelector(".body") as HTMLElement;
        return {
          글: (몸?.textContent ?? "").slice(0, 26),
          길이: (몸?.textContent ?? "").length,
          잘림: 몸 ? 몸.scrollHeight - 몸.clientHeight : 0,
          쟀나: !!몸,
        };
      }));

    본다("메모지의 글 칸을 다 쟀다", 잰것.every((x) => x.쟀나), `${잰것.length}장`);

    const 잘린것 = 잰것.filter((x) => x.잘림 > 1);
    본다("★★★ 저절로 붙은 메모지가 **한 장도 안 잘렸다**",
      잘린것.length === 0,
      잘린것.length
        ? 잘린것.map((x) => `「${x.글}…」 ${x.잘림}px 넘침 (${x.길이}자)`).join(" / ")
        : `${잰것.length}장 모두 스크롤바 없음`);

    /*
     * ★ 반대쪽도 봅니다 — **쓸데없이 크지는 않은가.**
     *   글보다 훨씬 큰 종이를 붙이면 보드가 금세 꽉 차서, 스무 장이
     *   붙은 대상자는 스크롤을 한참 내려야 합니다. 잘리지 않는 것과
     *   작게 두는 것은 서로 반대라 둘 다 봐야 합니다.
     */
    const 남는것: any[] = await 쪽.evaluate(() =>
      [...document.querySelectorAll(".memo-note.blue")].map((n) => {
        const 몸 = n.querySelector(".body") as HTMLElement;
        return { 남음: 몸 ? 몸.clientHeight - 몸.scrollHeight : 0,
                 높이: (n as HTMLElement).offsetHeight };
      }));
    const 헐렁 = 남는것.filter((x) => x.남음 > 90 && x.높이 > 150);
    본다("★ 쓸데없이 큰 메모지는 없다", 헐렁.length === 0,
      헐렁.length ? 헐렁.map((x) => `${x.높이}px 인데 ${x.남음}px 남음`).join(" / ")
                 : "빈 자리 90px 안쪽");
  }

  // ══════════════════════════════════════════════════════════
  //  ④ 화면이 「저절로」를 흉내 내지 못한다
  // ══════════════════════════════════════════════════════════
  console.log("\n── ④ 화면이 크기를 정하지 못한다 ★ ────────────\n");
  {
    const 쿠키 = await 관.쿠키받기(주소);
    const r = await fetch(`${주소}/api/sticky`, {
      method: "POST",
      headers: { cookie: 쿠키, "content-type": "application/json" },
      body: JSON.stringify({ text: 긴글, color: "yellow", recipientId: 사람, 저절로: true }),
    });
    const 몸: any = await r.json().catch(() => ({}));
    if (몸?.id) 붙인것.push(Number(몸.id));
    본다("★★ 화면에서 「저절로」를 보내도 안 먹는다",
      r.status === 200 && 몸.w === 자리규칙.기본너비 && 몸.h === 자리규칙.기본높이,
      `${몸.w}×${몸.h} — 손으로 적은 것과 프로그램이 붙인 것의 크기가 섞이면 안 됩니다`);
  }

  // ══════════════════════════════════════════════════════════
  //  ⑤ ★★★ 이미 붙어 있던 것도 키우는가
  // ══════════════════════════════════════════════════════════
  console.log("\n── ⑤ **이미 붙어 있던 것도 키운다** ★★★ ───────\n");
  {
    /*
     * (2026-09-07 무무 — 「스크롤바가 보이지 않도록 키워서 넣어달라고
     *  했는데 **반영되지 않았어**」)
     *
     * 크기를 재는 것은 고쳤는데 **이미 보드에 붙어 있던 것들은 그대로**
     * 였습니다. 새로 오는 것만 커지니, 화면을 여신 분에게는 「안 고쳐진
     * 것」으로 보입니다 — 눈에 보이는 스무 장이 다 잘려 있으니까요.
     */
    const 옛표 = metaGet("sticky_grow_v1") ?? "";
    metaSet("sticky_grow_v1", "");

    /* 옛 버전이 만들었을 법한 작은 파랑 메모지 — 손으로 넣습니다. */
    const 긴글2 = `${머리} ` + "옛 버전이 붙여 둔 긴 특이사항입니다. ".repeat(8);
    const 작은것 = Number(db.run(
      `INSERT INTO sticky (text, color, author_id, author, recipient_id, pinned,
                           due_on, created_at, updated_at, x, y, w, h)
       VALUES (?,'blue',NULL,'옛버전',?,0,NULL,?,?,900,900,240,150)`,
      [긴글2, 사람, new Date().toISOString(), new Date().toISOString()]).lastInsertRowid);
    붙인것.push(작은것);
    /* 노랑(사람이 적은 것)은 건드리면 안 됩니다 */
    const 노랑 = Number(db.run(
      `INSERT INTO sticky (text, color, author_id, author, recipient_id, pinned,
                           due_on, created_at, updated_at, x, y, w, h)
       VALUES (?,'yellow',NULL,'사람',?,0,NULL,?,?,1400,900,240,150)`,
      [긴글2, 사람, new Date().toISOString(), new Date().toISOString()]).lastInsertRowid);
    붙인것.push(노랑);

    const 키운수 = 옛메모지키우기();
    본다("★★ 키운 장수를 알려 준다", 키운수 > 0, `${키운수}장`);

    const 뒤 = (id: number): any =>
      db.query("SELECT w, h, x, y FROM sticky WHERE id = ?").get(id);
    const 파 = 뒤(작은것), 노 = 뒤(노랑);
    본다("★★★ 이미 붙어 있던 **파랑이 커진다**",
      파.h > 150, `240×150 → ${파.w}×${파.h}`);
    본다("★★★ **노랑(사람이 적은 것)은 그대로다**",
      노.w === 240 && 노.h === 150,
      "일부러 작게 붙여 둔 쪽지를 프로그램이 키우면 안 됩니다");
    본다("★★ 커진 크기가 글에 맞는다",
      파.h >= 글에맞는크기(긴글2).h, `${파.h} ≥ ${글에맞는크기(긴글2).h}`);

    /*
     * ★★★ **두 번째부터는 지나가야 합니다.**
     *
     *   그냥 한 번 더 불러서 0 이 나오는지만 보면 안 됩니다 — 이미 다
     *   커져 있으니 표시가 없어도 0 이 나옵니다 (2026-09-07 확인).
     *   **손으로 줄여 놓고** 다시 불러야 표시가 도는지 알 수 있습니다.
     */
    db.run("UPDATE sticky SET w = 240, h = 150 WHERE id = ?", [작은것]);
    const 또 = 옛메모지키우기();
    const 줄인뒤 = 뒤(작은것);
    본다("★★★ **손으로 줄여 둔 것이 도로 안 커진다**",
      또 === 0 && 줄인뒤.w === 240 && 줄인뒤.h === 150,
      `${줄인뒤.w}×${줄인뒤.h} · 키운 장수 ${또} — 표시를 안 남기면 켤 때마다 도로 커집니다`);
    /* 다음 검사를 위해 되돌려 둡니다 */
    db.run("UPDATE sticky SET w = ?, h = ? WHERE id = ?", [파.w, 파.h, 작은것]);

    /* 겹치지 않아야 합니다 */
    const 버전: any[] = db.query(
      "SELECT id,x,y,w,h FROM sticky WHERE recipient_id = ? AND done_at IS NULL"
    ).all(사람) as any[];
    let 겹침 = 0;
    for (let i = 0; i < 버전.length; i++)
      for (let j = i + 1; j < 버전.length; j++) {
        const a = 버전[i], c = 버전[j];
        if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) 겹침++;
      }
    본다("★★ 키운 뒤에도 겹치지 않는다", 겹침 === 0,
      `${버전.length}장 · 겹친 쌍 ${겹침}`);

    metaSet("sticky_grow_v1", 옛표);
  }

} catch (e: any) {
  실패수++;
  console.log(`\n✗ 실패  시험 도중 터짐 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 5).join("\n"));
} finally {
  await b.close();
  for (const id of 붙인것) { try { db.run("DELETE FROM sticky WHERE id = ?", [id]); } catch { } }
  db.run("DELETE FROM sticky WHERE recipient_id = ?", [사람]);
  db.run("DELETE FROM recipient WHERE id = ?", [사람]);
  관?.치우기();
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
