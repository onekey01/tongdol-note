/**
 * 우편함 — 기관 PC 쪽 주고받기.
 *
 * 왜 라이브러리를 안 쓰나 —
 *   supabase-js 는 편하지만 헤더를 제 마음대로 붙입니다. 새 열쇠
 *   (sb_publishable_)를 Authorization 에도 실어서 401 을 맞은 적이 있어
 *   여기서는 fetch 로 직접 다룹니다. 붙일 것이 하나도 없다는 뜻이기도 합니다.
 *
 * 규칙 —
 *   · 개발 열쇠(sb_secret_)는 **여기서 절대 안 씁니다.** 기관에 나가는
 *     프로그램에 들어가면 남의 기관 자료까지 열리기 때문입니다.
 *     기관 PC 는 제 계정으로 로그인하고, RLS 가 제 기관만 보게 막습니다.
 *   · 사람에 관한 것은 전부 payload_enc 로 잠가서 보냅니다.
 */
import { 짐싸기, 짐풀기, 덩이풀기, 새등록표, 표해시, 싸기 } from "./우편함자물쇠";

export type 우편함설정 = {
  주소: string;
  열쇠: string;        // sb_publishable_… (공개되어도 되는 것)
  이메일: string;      // 기관 계정
  비밀번호: string;
  기관열쇠: string;    // 잠그고 푸는 열쇠 — 이 PC 밖으로 안 나갑니다
  앱주소?: string;     // 현장앱을 올려 둔 https 주소
};

export type 할일 = {
  id: string;
  worker_id: string;
  served_on: string;          // YYYY-MM-DD
  짐: unknown;                // 이름·주소·연락처·서비스명 → 잠겨서 나갑니다
};

export type 받은보고 = {
  id: string;
  job_id: string;
  worker_id: string;
  started_at: string | null;
  ended_at: string | null;
  qr_ok: boolean;
  짐: unknown;                // 일지·서명 — 풀어서 돌려 드립니다
};

const 버전 = "v1";

export class 우편함 {
  private 토큰: string | null = null;
  private 만료 = 0;

  constructor(private 설정: 우편함설정) {}

  /** .env 가 채워졌는지. 안 채워졌으면 현장앱 없이 그냥 돌아갑니다. */
  static 설정읽기(): 우편함설정 | null {
    const e = process.env;
    const 주소 = e.TONGDOL_SUPABASE_URL?.trim();
    const 열쇠 = e.TONGDOL_SUPABASE_PUBLISHABLE_KEY?.trim();
    const 이메일 = e.TONGDOL_ORG_EMAIL?.trim();
    const 비밀번호 = e.TONGDOL_ORG_PASSWORD?.trim();
    const 기관열쇠 = e.TONGDOL_ORG_KEY?.trim();
    const 앱주소 = e.TONGDOL_APP_URL?.trim().replace(/\/+$/, "");
    if (!주소 || !열쇠 || !이메일 || !비밀번호 || !기관열쇠) return null;
    if (주소.includes("/rest/") || 주소.includes("/auth/"))
      throw new Error("TONGDOL_SUPABASE_URL 뒤에 경로가 붙어 있습니다 — 주소만 남기세요");
    return { 주소, 열쇠, 이메일, 비밀번호, 기관열쇠, 앱주소 };
  }

  // ── 로그인 ────────────────────────────────────────────────
  private async 들어가기(): Promise<string> {
    if (this.토큰 && Date.now() < this.만료 - 60_000) return this.토큰;
    const r = await fetch(`${this.설정.주소}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: this.설정.열쇠, "content-type": "application/json" },
      body: JSON.stringify({ email: this.설정.이메일, password: this.설정.비밀번호 }),
    });
    if (!r.ok) throw new Error(`우편함 로그인 실패 (${r.status}) ${await r.text()}`);
    const j = (await r.json()) as { access_token: string; expires_in: number };
    this.토큰 = j.access_token;
    this.만료 = Date.now() + (j.expires_in ?? 3600) * 1000;
    return this.토큰;
  }

  private async 부르기(길: string, 옵션: RequestInit = {}): Promise<Response> {
    const 토큰 = await this.들어가기();
    const r = await fetch(`${this.설정.주소}/rest/v1/${길}`, {
      ...옵션,
      headers: {
        apikey: this.설정.열쇠,
        Authorization: `Bearer ${토큰}`,   // 로그인 뒤에는 진짜 JWT 라 괜찮습니다
        "content-type": "application/json",
        ...(옵션.headers ?? {}),
      },
    });
    if (!r.ok) throw new Error(`우편함 ${길} 실패 (${r.status}) ${await r.text()}`);
    return r;
  }

  /** 잠들지 않게 하루 한 번 두드립니다 (무료 등급은 7일 조용하면 잡니다). */
  async 두드리기(): Promise<void> {
    await this.부르기("org?select=id&limit=1");
  }

  // ── 내보내기 ──────────────────────────────────────────────
  /** 오늘 갈 곳을 잠가서 올립니다. 같은 id 는 덮어씁니다. */
  async 할일올리기(줄들: 할일[]): Promise<number> {
    if (!줄들.length) return 0;
    const 기관 = await this.내기관();
    const 몸 = await Promise.all(
      줄들.map(async (j) => ({
        id: j.id,
        org_id: 기관,
        worker_id: j.worker_id,
        served_on: j.served_on,
        payload_enc: await 짐싸기(this.설정.기관열쇠, j.짐),
      })),
    );
    await this.부르기("job", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(몸),
    });
    return 몸.length;
  }

  /**
   * 올린 범위에서 **목록에 없는 줄을 치웁니다.**
   *
   * ── 왜 필요한가 (2026-09-05 에 찾은 구멍) ─────────────────
   *
   * `할일올리기` 는 덮어쓰기만 합니다(merge-duplicates). 그래서
   * **한 번 올라간 것은 스스로 안 없어집니다.**
   *
   *   아침에 김복순 님을 올렸다 → 낮에 「중단」으로 바꿨다
   *   → 그날갈곳 에서는 빠진다 → 그런데 **우편함에는 그대로 남아 있다**
   *   → 제공인력 폰에는 계속 뜬다 → 멈춘 집에 찾아간다
   *
   * 배정을 지워도, 요일을 바꿔도, 계약을 끝내도 똑같습니다.
   * 14일 뒤 스스로 사라지기를 기다릴 수는 없습니다.
   *
   * 올릴 것이 하나도 없어도 도는 것이 중요합니다 — 오히려 그때가
   * 「전부 치워야 하는」 때입니다.
   *
   * ★ 앞날치까지 올리게 되면서(주간·월간 일정) 날마다 왕복하면 스물몇
   *   번이 됩니다. 그래서 **범위를 한 번에** 가져와 비교합니다.
   */
  async 범위맞추기(첫날: string, 끝날: string, 남길ids: string[]): Promise<number> {
    const r = await this.부르기(
      `job?served_on=gte.${첫날}&served_on=lte.${끝날}&select=id`);
    const 있는것 = (await r.json()) as { id: string }[];
    const 남길 = new Set(남길ids);
    const 뺄것 = 있는것.filter((x) => !남길.has(x.id)).map((x) => x.id)
      .filter((id) => /^[0-9a-fA-F-]{36}$/.test(id));
    if (!뺄것.length) return 0;
    /*
     * PostgREST 의 `in.()` 은 주소줄에 실립니다. 한 번에 너무 많이 넣으면
     * 주소가 길어 막히므로 백 개씩 끊습니다.
     */
    for (let i = 0; i < 뺄것.length; i += 100)
      await this.부르기(`job?id=in.(${뺄것.slice(i, i + 100).join(",")})`,
        { method: "DELETE" });
    return 뺄것.length;
  }

  /**
   * 하루치만 맞춥니다. `범위맞추기` 가 생긴 뒤로는 **시험에서만** 씁니다 —
   * 「하루만 놓고 봐도 제대로 치우는가」를 보는 자리입니다.
   */
  async 할일맞추기(날: string, 남길ids: string[]): Promise<number> {
    const 있는것 = await this.그날올라간것(날);
    const 남길 = new Set(남길ids);
    const 뺄것 = 있는것.filter((r) => !남길.has(r.id)).map((r) => r.id);
    if (!뺄것.length) return 0;
    /*
     * id 는 우리가 만든 UUID 라 따옴표 없이 넣어도 됩니다.
     * 그래도 혹시 몰라 UUID 꼴인 것만 넘깁니다.
     */
    const 안전한것 = 뺄것.filter((id) => /^[0-9a-fA-F-]{36}$/.test(id));
    if (!안전한것.length) return 0;
    await this.부르기(`job?id=in.(${안전한것.join(",")})`, { method: "DELETE" });
    return 안전한것.length;
  }

  private 기관번호: string | null = null;
  /**
   * 내가 어느 기관인가.
   *
   * ★ `org` 를 보고 고르면 안 됩니다 (2026-09-05 에 막은 구멍) ★
   *
   *   008 부터 **기관 목록이 모두에게 열립니다.** 새 휴대폰이 「어느
   *   기관인가」를 골라야 하기 때문입니다(001 에 적힌 대로 기관명은
   *   개인정보가 아닙니다). 그런데 그러느라 기관 PC 에도 남의 기관 줄이
   *   보이게 되었습니다.
   *
   *   옛 코드는 `org?select=id&limit=1` 로 **아무 줄이나 첫 줄**을 집었습니다.
   *   기관이 하나뿐일 때는 맞았지만, 이제는 남의 기관을 집을 수 있습니다.
   *   그러면 할 일을 남의 기관 번호로 올리려다 막혀서 **전송이 통째로
   *   멎습니다.** 자료가 새는 것은 아니지만 현장은 「왜 안 되지」입니다.
   *
   *   그래서 `org_member` 를 봅니다. 이 표는 예나 지금이나
   *   **내 기관 줄만** 보입니다. 「내가 어느 기관인가」의 진짜 답이
   *   여기 있습니다.
   */
  async 내기관(): Promise<string> {
    if (this.기관번호) return this.기관번호;
    const r = await this.부르기("org_member?select=org_id&limit=1");
    const rows = (await r.json()) as { org_id: string }[];
    if (!rows.length) throw new Error("이 계정에 딸린 기관이 없습니다");
    return (this.기관번호 = rows[0].org_id);
  }

  /**
   * 그날 우편함에 **실제로 올라가 있는 것**을 그대로 봅니다.
   *
   * 고치는 데 쓰는 눈입니다 — 「폰에 안 뜬다」가 나왔을 때
   * 안 올라간 것인지, 올라갔는데 폰이 못 보는 것인지를 갈라야 합니다.
   * 푸는 것은 여기서 안 합니다. 부르는 쪽이 기관 열쇠로 풉니다.
   */
  async 그날올라간것(날: string): Promise<
    { id: string; worker_id: string; served_on: string; payload_enc: string; created_at: string }[]
  > {
    const r = await this.부르기(
      `job?served_on=eq.${encodeURIComponent(날)}` +
      `&select=id,worker_id,served_on,payload_enc,created_at&order=created_at`);
    return r.json() as any;
  }

  // ── 받아오기 ──────────────────────────────────────────────
  /** 아직 안 받아간 보고를 가져와 풉니다. */
  async 보고받아오기(): Promise<받은보고[]> {
    const r = await this.부르기(
      "report?select=id,job_id,worker_id,started_at,ended_at,qr_ok,payload_enc" +
      "&pulled_at=is.null&order=created_at.asc&limit=500",
    );
    const rows = (await r.json()) as any[];
    const 나온것: 받은보고[] = [];
    for (const row of rows) {
      try {
        나온것.push({
          id: row.id, job_id: row.job_id, worker_id: row.worker_id,
          started_at: row.started_at, ended_at: row.ended_at, qr_ok: !!row.qr_ok,
          짐: await 짐풀기(this.설정.기관열쇠, row.payload_enc),
        });
      } catch (e) {
        // 못 푸는 것은 건너뜁니다 — 열쇠를 바꾼 뒤의 옛 보고일 수 있습니다.
        console.error(`우편함: 보고 ${row.id} 를 열지 못했습니다 —`, (e as Error).message);
      }
    }
    return 나온것;
  }

  // ── 사진 ──────────────────────────────────────────────────
  /** 그 보고에 딸린 사진이 어디에 있는지. */
  async 사진목록(reportIds: string[]): Promise<{ id: string; report_id: string; path: string }[]> {
    if (!reportIds.length) return [];
    const r = await this.부르기(
      `photo?report_id=in.(${reportIds.join(",")})&select=id,report_id,path`);
    return r.json() as any;
  }

  /**
   * 사진 한 장을 받아서 **풉니다.**
   *
   * 올라간 것은 잠긴 덩어리라 그냥 받으면 못 봅니다.
   * 이 PC 의 기관 열쇠로만 풀립니다 — 그래서 이 함수가 여기 있습니다.
   */
  async 사진받기(path: string): Promise<Uint8Array> {
    const 토큰 = await this.들어가기();
    const r = await fetch(
      `${this.설정.주소}/storage/v1/object/${encodeURI("사진")}/${path}`,
      { headers: { apikey: this.설정.열쇠, Authorization: `Bearer ${토큰}` } });
    if (!r.ok) throw new Error(`사진 받기 실패 (${r.status})`);
    return 덩이풀기(this.설정.기관열쇠, new Uint8Array(await r.arrayBuffer()));
  }

  /**
   * 사진 파일을 우편함에서 지웁니다.
   *
   * ★ 이것을 안 부르면 무료 등급 저장공간(1GB)이 몇 주에 찹니다.
   *   그리고 무엇보다 **어르신 댁 사진을 남의 서버에 오래 두는 일**입니다.
   */
  async 사진지우기(paths: string[]): Promise<void> {
    if (!paths.length) return;
    const 토큰 = await this.들어가기();
    for (const path of paths) {
      try {
        await fetch(`${this.설정.주소}/storage/v1/object/${encodeURI("사진")}/${path}`, {
          method: "DELETE",
          headers: { apikey: this.설정.열쇠, Authorization: `Bearer ${토큰}` },
        });
      } catch { /* 한 장 못 지워도 나머지는 지웁니다 */ }
    }
  }

  /** 받아간 것을 우편함에서 지웁니다. ★ 사진 용량 때문에 반드시 불러야 합니다. */
  async 받은것지우기(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.부르기(`report?id=in.(${ids.join(",")})`, { method: "DELETE" });
  }

  /**
   * 기한 지난 것 쓸어내기.
   *
   * ★ 안전망이 아니라 **유일한 청소부**입니다 (2026-09-05 에 안 것) ★
   *   Postgres 는 `expires_at` 만으로 스스로 아무것도 안 지웁니다.
   *   이것을 안 부르면 로그인 요청(비밀번호가 든 덩어리)·다 받아간
   *   보고·다 내려받은 사진이 **영원히 남습니다.**
   *   보고받기 루프가 하루 한 번 부릅니다.
   */
  async 쓸어내기(): Promise<string> {
    const r = await this.부르기("rpc/sweep_expired", { method: "POST", body: "{}" });
    try {
      const rows = (await r.json()) as { 지운표: string; 개수: number }[];
      return rows.filter((x) => x.개수 > 0)
                 .map((x) => `${x.지운표} ${x.개수}`).join(" · ");
    } catch { return ""; }
  }

  /** 제공인력을 우편함에 올립니다 (이름은 안 올라갑니다 — 번호와 다니는지만). */
  async 인력올리기(workerId: string, 다니나 = true): Promise<void> {
    const 기관 = await this.내기관();
    await this.부르기("worker", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: workerId, org_id: 기관, active: 다니나 }),
    });
  }

  /** 퇴사·정지 — 이걸 부르면 그 폰은 바로 아무것도 못 봅니다. */
  async 인력끄기(workerId: string): Promise<void> {
    await this.부르기(`worker?id=eq.${workerId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ active: false }),
    });
  }

  // ── 열쇠 건네기 ───────────────────────────────────────────
  /**
   * 등록은 했는데 아직 열쇠를 못 받은 기기들.
   * 휴대폰이 올린 공개쪽이 같이 나옵니다.
   */
  async 못건넨기기(): Promise<{ worker_id: string; pub_key: string }[]> {
    const r = await this.부르기("rpc/pending_devices", { method: "POST", body: "{}" });
    return (await r.json()) as { worker_id: string; pub_key: string }[];
  }

  /**
   * 기관 열쇠를 **그 폰만 열 수 있게 싸서** 우편함에 둡니다.
   * 우편함은 싼 덩어리만 보고 못 엽니다.
   * 돌려주는 값 = 이번에 건넨 기기 수.
   */
  async 열쇠건네기(): Promise<number> {
    const 기다리는것 = await this.못건넨기기();
    let 건넨수 = 0;
    for (const d of 기다리는것) {
      try {
        const 싼것 = await 싸기(d.pub_key, this.설정.기관열쇠);
        await this.부르기(`worker_device?worker_id=eq.${d.worker_id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ wrapped_key: 싼것, wrapped_at: new Date().toISOString() }),
        });
        건넨수++;
      } catch (e) {
        // 공개쪽이 망가진 기기 하나 때문에 나머지가 막히면 안 됩니다.
        console.error(`우편함: ${d.worker_id} 에 열쇠를 못 건넸습니다 —`,
                      (e as Error).message);
      }
    }
    return 건넨수;
  }

  /** 그 인력의 기기가 열쇠까지 받았나. */
  async 기기상태(workerId: string): Promise<"없음" | "기다리는중" | "됨"> {
    const r = await this.부르기(
      `worker_device?worker_id=eq.${workerId}&select=pub_key,wrapped_key`);
    const rows = (await r.json()) as { pub_key: string | null; wrapped_key: string | null }[];
    if (!rows.length) return "없음";
    return rows[0].wrapped_key ? "됨" : "기다리는중";
  }

  // ══ 계정으로 들어오기 (v1.7.27) ═══════════════════════════
  //
  //  등록은 여태 **브라우저**에 묶여 있었습니다. 같은 폰이라도 크롬에서
  //  등록하고 삼성인터넷으로 열면 아무것도 없습니다. 브라우저에게 둘은
  //  남남이고, 웹 페이지는 다른 브라우저의 저장소도 기기 고유번호도
  //  못 읽습니다. 그래서 「기기를 기억」이 아니라 **사람을 기억**합니다.
  //
  //  (2026-09-05 무무 — 「종사자당 휴대폰 기기 1대로 제한해야 하고,
  //   그 기기 안에선 어떤 브라우저로 접속하더라도 문제없이 실행되어야 해.」)

  /** 기관 공개열쇠를 우편함에 올립니다. 폰이 이것으로 비밀번호를 쌉니다. */
  async 기관공개쪽올리기(공개: string): Promise<void> {
    const 기관 = await this.내기관();
    await this.부르기(`org?id=eq.${기관}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ pub_key: 공개 }),
    });
  }

  /** 지금 우편함에 올라가 있는 우리 기관 공개쪽. 없으면 null. */
  async 올라간공개쪽(): Promise<string | null> {
    const 기관 = await this.내기관();
    const r = await this.부르기(`org?id=eq.${기관}&select=pub_key`);
    const rows = (await r.json()) as { pub_key: string | null }[];
    return rows[0]?.pub_key ?? null;
  }

  /** 아직 답하지 않은 로그인 요청들. */
  async 기다리는요청(): Promise<
    { id: string; device_user_id: string; asked_enc: string; created_at: string }[]
  > {
    /*
     * ★ 기한이 지난 것은 안 가져옵니다. 15분이 지났으면 폰은 이미
     *   포기하고 화면을 닫았습니다. 그런 것에 답하느라 진짜 기다리는
     *   사람이 뒤로 밀리면 안 됩니다.
     */
    const 이제 = new Date().toISOString();
    const r = await this.부르기(
      "device_request?status=eq.기다림" +
      `&expires_at=gt.${encodeURIComponent(이제)}` +
      "&select=id,device_user_id,asked_enc,created_at&order=created_at.asc&limit=50");
    return r.json() as any;
  }

  /** 요청에 답을 답니다 — 됨이든 거절이든. */
  async 요청답하기(
    id: string,
    답: { status: "됨" | "거절"; answer_enc?: string; worker_id?: string; reason?: string },
  ): Promise<void> {
    await this.부르기(`device_request?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(답),
    });
  }

  /** 그 인력에 이미 딸린 기기들 (한 사람 한 대라 보통 0 개나 1 개). */
  async 그인력기기들(workerId: string): Promise<{ user_id: string }[]> {
    const r = await this.부르기(
      `worker_device?worker_id=eq.${workerId}&select=user_id`);
    return r.json() as any;
  }

  /**
   * **기기를 갈아 끼웁니다** — 새 폰이 이기고, 앞 폰은 끊깁니다.
   *
   * 왜 앞 폰을 끊나 —
   *   한 사람이 두 폰으로 다니면 같은 방문이 두 번 올라옵니다. 그리고
   *   잃어버린 폰이 계속 어르신 자료를 받습니다. **한 사람 한 대**가
   *   맞습니다. (2026-09-05 무무 — 「종사자 당 휴대폰 기기 1대로 제한」)
   *
   * 순서가 중요합니다 — **새 줄을 먼저 넣고 옛 줄을 지웁니다.**
   * 거꾸로 하면 중간에 끊겼을 때 그 인력에게 기기가 하나도 없습니다.
   */
  async 기기바꾸기(
    workerId: string, 새user: string, 공개쪽: string, 싼열쇠: string,
  ): Promise<{ 끊은수: number }> {
    const 기관 = await this.내기관();
    const 옛것 = (await this.그인력기기들(workerId))
      .map((d) => d.user_id).filter((u) => u !== 새user);

    await this.부르기("worker_device", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        user_id: 새user, worker_id: workerId, org_id: 기관,
        pub_key: 공개쪽, wrapped_key: 싼열쇠,
        wrapped_at: new Date().toISOString(),
        registered_at: new Date().toISOString(),
      }),
    });

    if (옛것.length) {
      const 안전한것 = 옛것.filter((u) => /^[0-9a-fA-F-]{36}$/.test(u));
      if (안전한것.length)
        await this.부르기(`worker_device?user_id=in.(${안전한것.join(",")})`,
          { method: "DELETE" });
      return { 끊은수: 안전한것.length };
    }
    return { 끊은수: 0 };
  }

  /**
   * 그 인력의 기기를 **전부** 끊습니다.
   *
   * 홈의 「이 기기 끊기」가 부릅니다. 인력끄기(active=false) 와 다릅니다 —
   * 그것은 퇴사라 그 사람 자체를 막습니다. 이것은 **기기만** 떼는 것이라,
   * 본인이 다시 로그인하면 그만입니다. 폰을 잃어버렸을 때 쓰는 것입니다.
   */
  async 그인력기기전부끊기(workerId: string): Promise<number> {
    const 있는것 = (await this.그인력기기들(workerId)).map((d) => d.user_id);
    const 안전한것 = 있는것.filter((u) => /^[0-9a-fA-F-]{36}$/.test(u));
    if (!안전한것.length) return 0;
    await this.부르기(`worker_device?user_id=in.(${안전한것.join(",")})`,
      { method: "DELETE" });
    return 안전한것.length;
  }

  // ── 기기 등록 ─────────────────────────────────────────────
  /**
   * 등록 QR 에 담을 것을 만듭니다.
   * 표는 여기서만 나가고, 우편함에는 **해시만** 들어갑니다.
   */
  async 등록표만들기(workerId: string, 몇분 = 15): Promise<string> {
    const 기관 = await this.내기관();
    const 표 = 새등록표();
    /*
     * enroll_token 표는 아무에게도 안 열려 있습니다 (기관 PC 도 못 넣습니다).
     * 이 함수만이 넣을 수 있고, 함수가 「내 기관의 다니는 인력인가」를 봅니다.
     */
    await this.부르기("rpc/make_enroll_token", {
      method: "POST",
      body: JSON.stringify({
        p_worker: workerId,
        p_token_hash: await 표해시(표),
        p_minutes: 몇분,
      }),
    });
    /*
     * ★ QR 에 기관 열쇠를 싣지 않습니다 ★
     *
     * QR 은 아무 앱이나 갖다 대면 안이 맨눈에 읽힙니다. 어깨너머로 찍히거나
     * 사진첩에 남으면 그 기관의 모든 덩어리가 열립니다. 게다가 기관 열쇠는
     * 바꾸면 그 전에 잠근 것을 못 엽니다 — 되돌리기가 아주 비쌉니다.
     *
     * 그래서 QR 에는 **15분짜리 일회용 표 하나**만 담습니다.
     * 기관 열쇠는 휴대폰이 등록하면서 올린 공개쪽으로 **싸서** 건넵니다
     * (아래 열쇠건네기). 찍혀도 잃을 것이 거의 없습니다.
     *
     * 주소·공개열쇠도 안 담습니다 — 현장앱에 박혀 나가는 값입니다.
     */
    void 기관;

    /*
     * 현장앱 주소를 알면 QR 을 **주소**로 만듭니다 —
     *   https://…/#표=xxxx
     * 휴대폰 기본 카메라로 한 번 찍으면 브라우저가 열리고 등록까지 갑니다.
     * 「앱을 먼저 여세요」가 사라집니다.
     *
     * '#' 뒤에 두는 이유: 그 부분은 **서버로 안 갑니다.** 올려 둔 곳의
     * 접속 기록에도 표가 남지 않습니다.
     *
     * 주소를 아직 안 정했으면 옛 모양(JSON)으로 돌려줍니다.
     */
    if (this.설정.앱주소)
      return `${this.설정.앱주소}/#표=${encodeURIComponent(표)}`;
    return JSON.stringify({ 버전, 표 });
  }
}
