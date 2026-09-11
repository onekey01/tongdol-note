/**
 * 설명서에 적힌 **숫자가 프로그램과 같은지** 봅니다.
 *
 *   bun 설명서시험.ts
 *
 * ── 왜 이런 시험이 있나 ────────────────────────────────────
 *
 * 설명서는 **한 번 쓰고 안 고칩니다.** 그런데 단가나 한도는 바뀝니다.
 * 그러면 설명서와 프로그램이 다른 말을 하고, 기관은 **설명서를 믿습니다.**
 * 종이에 적힌 것이 더 그럴듯해 보이기 때문입니다.
 *
 * 그래서 설명서의 숫자를 **자료함에서 꺼내 맞대어 봅니다.** 어긋나면
 * 여기서 걸립니다 — 기관이 잘못된 금액으로 청구하기 전에.
 *
 * ★ **빈 자료함에서 봅니다.** 개발 자료함에는 시험이 만든 서비스가
 *   섞여 있고, 단가도 옛 값이 남아 있습니다(2026-09-08 에 확인).
 *   기관이 새로 받았을 때의 값을 봐야 합니다.
 */
import { readFileSync, existsSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "bun:sqlite";

let 통과수 = 0, 실패수 = 0;
function 통과해야(무엇: string, 참: unknown, 덧말 = "") {
  if (참) { 통과수++; console.log(`  통과  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
  else { 실패수++; console.log(`✗ 실패  ${무엇}${덧말 ? "   — " + 덧말 : ""}`); }
}

const 뿌리 = import.meta.dir;
const 글 = readFileSync(join(뿌리, "사용설명서.html"), "utf8");
const 안내 = readFileSync(join(뿌리, "설치 안내.html"), "utf8");
/** 「1,500,000」·「24,000」 같은 것을 찾기 좋게 쉼표를 지운 벌도 만들어 둡니다. */
const 글숫자 = 글.replace(/,/g, "");

/* 빈 자료함을 하나 만들어 **기관이 새로 받았을 때의 값**을 꺼냅니다. */
const 터 = mkdtempSync(join(tmpdir(), "설명서시험-"));
try {
  const p = Bun.spawnSync({
    cmd: ["bun", "-e", `
      process.chdir(${JSON.stringify(터)});
      const { db, initDb } = await import(${JSON.stringify(join(뿌리, "server/db.ts"))});
      initDb();
      const rp = db.query("SELECT * FROM region_profile WHERE is_builtin = 0 ORDER BY id LIMIT 1").get();
      const sv = db.query("SELECT name, unit_price, monthly_cap_minutes m, monthly_cap_count c, lifetime_cap l, period_cap_months pm FROM service WHERE profile_id = ? AND active = 1").all(rp.id);
      const tier = db.query("SELECT rate FROM copay_tier WHERE profile_id = ? ORDER BY sort_order").all(rp.id);
      console.log("<<<" + JSON.stringify({ rp, sv, tier }) + ">>>");
    `],
    cwd: 터, stdout: "pipe", stderr: "pipe",
  });
  const 밖 = new TextDecoder().decode(p.stdout) + new TextDecoder().decode(p.stderr);
  const m = /<<<([\s\S]*?)>>>/.exec(밖);
  if (!m) throw new Error("빈 자료함에서 값을 못 꺼냈습니다 —\n" + 밖.slice(-600));
  const { rp, sv, tier } = JSON.parse(m[1]);
  const 서 = (n: string) => sv.find((s: any) => s.name === n);
  const 쉼표 = (n: number) => Number(n).toLocaleString("ko-KR");

  // ── 1. 한도 ───────────────────────────────────────────────
  console.log("\n── 1. 한도가 프로그램과 같은가 ─────────────────────────\n");
  통과해야("연간 지원한도", 글.includes(쉼표(rp.annual_cap)), 쉼표(rp.annual_cap) + "원");
  통과해야("안전생활환경 생애한도", 글.includes(쉼표(rp.housing_cap)), 쉼표(rp.housing_cap) + "원");
  통과해야("하루 최대 서비스 시간",
    글.includes(`${Math.round(rp.daily_cap_minutes / 60)}시간`),
    `${rp.daily_cap_minutes}분`);
  통과해야("비대면 배달 한도", 글.includes(`${rp.f2f_limit}회 연속`), `${rp.f2f_limit}회`);
  통과해야("세는 법 기본값", 글.includes(rp.f2f_mode), rp.f2f_mode);

  // ── 2. 단가 ★ 제일 중요 ──────────────────────────────────
  console.log("\n── 2. ★ 단가가 프로그램과 같은가 ★ ────────────────────\n");
  for (const s of sv) {
    통과해야(`${s.name} 단가`, 글.includes(쉼표(s.unit_price)) || Number(s.unit_price) === 0,
      쉼표(s.unit_price) + "원");
  }
  /*
   * ★ 안내문에는 단가를 **안 적습니다** (2026-09-08).
   *   설치 안내는 「받아서 켜기까지」이고, 값 확인은 마법사가 눈앞에서
   *   보여 줍니다. 같은 숫자를 두 곳에 적으면 한쪽만 낡습니다.
   */
  통과해야("★ 안내문에는 단가를 적지 않는다 (한쪽만 낡습니다)",
    !["가사지원", "식사지원", "동행지원"].some((n) => 안내.includes(쉼표(서(n).unit_price))),
    "값 확인은 마법사가 눈앞에서 보여 줍니다");

  // ── 3. 월 한도 ───────────────────────────────────────────
  console.log("\n── 3. 월 한도 ──────────────────────────────────────────\n");
  통과해야("가사 월 시간", 글.includes(`월 ${서("가사지원").m / 60}시간`),
    `${서("가사지원").m}분`);
  통과해야("식사 월 횟수", 글.includes(`월 ${서("식사지원").c}회`));
  통과해야("동행은 시간과 횟수 둘 다",
    글.includes(`월 ${서("동행지원").m / 60}시간`) && 글.includes(`${서("동행지원").c}회`),
    `${서("동행지원").m / 60}시간 · ${서("동행지원").c}회`);
  통과해야("이미용 월 횟수", 글.includes(`월 ${서("이미용서비스").c}회`));
  통과해야("제공 기간(개시일부터 몇 개월)",
    글.includes(`${서("가사지원").pm}개월`), `${서("가사지원").pm}개월`);

  // ── 4. 없어야 하는 것 ────────────────────────────────────
  console.log("\n── 4. 없는 서비스를 적어 두지 않았나 ───────────────────\n");
  통과해야("★ 방문목욕은 프로그램에도 없다", !서("방문목욕"));
  통과해야("설명서도 「없습니다」라고 적는다", /방문목욕은 없습니다/.test(글));

  // ── 5. 본인부담 ──────────────────────────────────────────
  console.log("\n── 5. 본인부담 구간 ────────────────────────────────────\n");
  const 비율 = tier.map((t: any) => Math.round(t.rate * 100));
  통과해야("구간이 셋", 비율.length === 3, 비율.join("% · ") + "%");
  통과해야("설명서에 그 셋이 그대로",
    글.includes(비율.map((r: number) => `${r}%`).join(" · ")),
    비율.map((r: number) => `${r}%`).join(" · "));

  // ── 6. 30분 환산 표 ──────────────────────────────────────
  console.log("\n── 6. 시간 인정 표가 맞나 ──────────────────────────────\n");
  const { 인정분 } = await import(join(뿌리, "server/money.ts"));
  const 볼것: [number, number][] = [[14, 0], [15, 30], [44, 30], [45, 60], [75, 90]];
  for (const [든, 나올] of 볼것) {
    통과해야(`${든}분 → ${나올 === 0 ? "0원" : 나올 + "분"}`, 인정분(든) === 나올,
      `${인정분(든)}분`);
  }
  통과해야("설명서가 「14분 → 0원」이라 적는다", /14분[\s\S]{0,120}0원/.test(글));
  통과해야("설명서가 「15분 ~ 44분 → 30분」이라 적는다", /15분 ~ 44분/.test(글));

  // ── 7. 안내문과 설명서가 서로 어긋나지 않나 ──────────────
  console.log("\n── 7. 안내문과 설명서가 같은 말을 하나 ─────────────────\n");
  통과해야("둘 다 설치 파일 이름을 같게 적는다",
    안내.includes("통돌Note 설치.bat") && 글.includes("통돌Note 설치.bat"));
  통과해야("둘 다 자료함 자리를 같게 적는다",
    안내.includes("C:\\통돌Note") && 글.includes("C:\\통돌Note"));
  /*
   * ★ PDF 뽑는 법은 **설명서 쪽**입니다. 설치 안내는 「받아서 켜기까지」라
   *   짧아야 하고, 같은 것을 두 곳에 적으면 한쪽만 낡습니다.
   *   대신 설치 안내가 **설명서를 가리켜야** 합니다 — 안 가리키면
   *   기관은 설명서가 있는 줄도 모릅니다.
   */
  통과해야("★ 설명서가 「PDF로 저장」을 쓰지 말라고 한다",
    /PDF로 저장.{0,30}쓰지 마세요/s.test(글));
  통과해야("설명서가 Microsoft Print to PDF 를 가리킨다",
    글.includes("Microsoft Print to PDF"));
  통과해야("★ 설치 안내가 사용설명서를 가리킨다", 안내.includes("사용설명서"),
    "안 가리키면 기관은 설명서가 있는 줄도 모릅니다");
  통과해야("사용설명서가 설치 안내를 가리킨다", 글.includes("설치 안내"));

  // ── 8. 설명서가 다뤄야 할 것을 다 다뤘나 ─────────────────
  console.log("\n── 8. 넣기로 한 것을 다 넣었나 ─────────────────────────\n");
  const 넣기로한것: [string, RegExp][] = [
    ["설정부터 (1장)", /설정부터 봅니다/],
    ["월말 순서 한 장", /월말 순서/],
    ["청구 시점 세 가지", /청구 시점 세 가지/],
    ["USB 로 오가며 일하기", /USB 로 오가며 일하기/],
    ["★ 가장 안전한 쓰는 법을 맨 앞에", /집에 들고 나간 날은 사무실 PC 를 건드리지 않는다/],
    ["★ 「이 컴퓨터에만」이 0 이 아니면 사라진다", /가져올 때 그만큼 사라집니다/],
    ["★ 되돌릴 수 있다", /되돌릴 수 있습니다/],
    ["★ 껐다 켜야 바뀐다", /껐다 켜/],
    ["하면 안 되는 것", /하면 안 되는 것/],
    ["화면에 뜨는 말을 그대로 옮김", /USB 의 자료함이 더 새 버전입니다/],
    ["백업과 되돌리기", /백업과 되돌리기/],
    ["★ 백업은 열어 보기 전까지 백업이 아니다", /열어 보기 전까지 백업이 아닙니다/],
    ["한글·PDF 경고창", /경고창이 뜨면/],
    ["새 버전", /새 버전/],
    ["가는 주기 (v34)", /가는 주기/],
    ["한도를 넘으면 저장이 안 된다 (v35)", /저장되지 않습니다/],
    ["최초 설정 마법사 (v35)", /이 값들이 맞는지만 봐 주세요/],
    ["사무실 열기", /옆 컴퓨터에서 열기/],
    ["안 될 때", /안 될 때/],
  ];
  for (const [무엇, 무늬] of 넣기로한것) 통과해야(무엇, 무늬.test(글));

  // ── 9. 별표가 글로 새어 나오지 않나 ──────────────────────
  console.log("\n── 9. 설치 안내문은 메모장이 읽습니다 ──────────────────\n");
  for (const [이름, 글자] of [["설치 안내", 안내], ["사용설명서", 글]] as const) {
    /*
     * ★ **눈에 보이는 글**만 봅니다. 모양(style)과 주석 안의 별표는
     *   기관이 볼 일이 없습니다. 파일 전체를 보면 그것까지 걸려서,
     *   시험을 통과시키려고 주석을 지우게 됩니다 — 거꾸로 된 일입니다.
     */
    const 보이는글 = 글자
      .replace(/<style[\s\S]*?<\/style>/g, "")
      .replace(/<!--[\s\S]*?-->/g, "");
    통과해야(`${이름} — 마크다운 찌꺼기(**)가 없다`, !보이는글.includes("**"),
      (보이는글.split("\n").find((l) => l.includes("**")) ?? "").trim().slice(0, 50));
    통과해야(`${이름} — 글꼴을 바깥에서 안 받아온다`,
      !/fonts\.googleapis|fonts\.gstatic|@import\s+url/.test(글자),
      "인터넷이 없는 PC 에서 글자가 무너집니다");
    통과해야(`${이름} — 바깥 파일에 기대지 않는다 (한 파일)`,
      !/<link[^>]+rel=["']stylesheet|<script[^>]+src=/.test(글자));
    통과해야(`${이름} — 그림이 파일 안에 들어 있다`, /src="data:image\//.test(글자));
    통과해야(`${이름} — 인쇄용 모양이 있다`, /@media print/.test(글자));
    통과해야(`${이름} — 버전 자리가 있다`, 글자.includes("{버전}"),
      "만들기.bat 이 여기에 버전 번호를 찍습니다");
    통과해야(`${이름} — 열리는 태그가 다 닫혀 있다`,
      (글자.match(/<div/g) ?? []).length === (글자.match(/<\/div>/g) ?? []).length,
      `div ${(글자.match(/<div/g) ?? []).length}개`);
  }
} catch (e: any) {
  실패수++;
  console.log(`\n✗ 시험 도중 터졌습니다 — ${e?.message ?? e}`);
  if (e?.stack) console.log(String(e.stack).split("\n").slice(1, 4).join("\n"));
} finally {
  rmSync(터, { recursive: true, force: true });
  console.log("\n── 10. 배포본에 실릴 문서가 **지금 것**인가 ─────────────\n");
  /*
   * ★ 1.21.36 이 여기서 샜습니다 (2026-09-11).
   *
   *   화면 그림을 넣어 새로 지은 설명서가 `문서짓기\` 에만 쌓였고,
   *   build.ps1 은 **프로젝트 뿌리**에서 집어 갑니다. 그래서 꾸러미에는
   *   9월 8일자 옛 문서가 실려 나갔습니다 — 「그림이 들어갔습니다」라고
   *   적힌 바뀐것 줄과 달리, 열어 보면 그림이 없었습니다.
   *
   *   문서는 **열어 봐야** 아는 물건이라 아무도 안 알아챕니다. 그래서 셉니다.
   */
  for (const [이름, 글자, 적어도] of [["설치 안내", 안내, 5], ["사용설명서", 글, 10]] as const) {
    const 그림수 = (글자.match(/data:image\/png;base64/g) ?? []).length;
    통과해야(`★★ ${이름}.html 에 화면 그림이 들어 있다`, 그림수 >= 적어도,
      `${그림수}장 (적어도 ${적어도}장)`);
  }
  {
    /* 문서짓기\ 에 옛 판이 남아 헷갈리지 않는지도 봅니다. */
    const 옛길 = join(뿌리, "문서짓기", "사용설명서.html");
    const 옛것 = existsSync(옛길) ? readFileSync(옛길, "utf8") : "";
    통과해야("문서짓기\\ 에 옛 판이 남아 있지 않다",
      !옛것 || (옛것.match(/data:image\/png;base64/g) ?? []).length >= 10,
      옛것 ? "남아 있다면 지금 것이라야 합니다" : "없음");
  }

  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`);
  process.exit(실패수 ? 1 : 0);
}
