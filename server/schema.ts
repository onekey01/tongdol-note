import type { Database } from "bun:sqlite";

/**
 * 자료함의 표 구조입니다.
 *
 * 원칙
 * - 민감한 개인정보는 payload 칸 하나에 몰아 담습니다.
 *   나중에 이 칸만 암호문으로 바꾸면 전환이 끝납니다.
 * - 검색·필터에 쓰는 값은 payload 밖에 따로 둡니다.
 *   암호화하면 검색이 안 되기 때문입니다.
 * - 지금 화면을 만들지 않는 표도 미리 만들어 둡니다.
 *   표를 나중에 '추가'하는 건 쉽지만 '바꾸는' 건 화면을 다 뜯어야 합니다.
 */
export const SCHEMA_VERSION = 36;

/**
 * 이미 만들어진 표에 칸을 덧붙입니다.
 *
 * 이미 쓰고 있는 기관의 자료함을 건드리는 일이라 원칙이 하나 있습니다.
 * **칸은 더하기만 합니다. 바꾸거나 지우지 않습니다.**
 * 그래야 무슨 일이 생겨도 이미 들어 있는 자료가 살아 있습니다.
 */
function addColumns(db: Database, table: string, cols: Record<string, string>) {
  const have = new Set(
    db.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all().map((r) => r.name)
  );
  for (const [name, decl] of Object.entries(cols)) {
    if (!have.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${decl}`);
  }
}

/** 옛 자료함을 지금 구조에 맞춥니다. 새 자료함이면 그냥 통과합니다. */
export function migrate(db: Database) {
  addColumns(db, "organization", {
    unique_no: "TEXT",   // 고유번호 — 사업자등록번호와 다른 번호입니다
    stamp_png: "TEXT",   // 기관 직인 이미지(data URL). 자료함 안에 함께 둡니다.
    // 상세 주소(층·호)를 따로 둡니다. 주소를 다시 고를 때 지워지지 않게.
    address_detail: "TEXT",
  });
  // 대상자에게 생긴 변화를 날짜와 함께 남깁니다.
  // 본인부담 구간이 바뀌면 그 전후로 청구 금액이 달라지므로,
  // "언제부터 바뀐 것인지"가 남아 있어야 나중에 다툼이 없습니다.
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipient_change (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_id TEXT NOT NULL REFERENCES recipient(id) ON DELETE CASCADE,
      field        TEXT NOT NULL,
      before_val   TEXT,
      after_val    TEXT,
      changed_on   TEXT NOT NULL,
      who          TEXT,
      created_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rchange ON recipient_change(recipient_id);
  `);

  // 한 사람이 역할을 여럿 가질 수 있습니다.
  // 관리자가 제공인력을 겸하는 경우가 실제로 있는데,
  // 따로 관리하면 같은 사람이 두 곳에 등록되어 정산이 어긋납니다.
  // → 사람은 하나(app_user), 역할만 여러 개.
  addColumns(db, "app_user", { roles: "TEXT" });
  db.run("UPDATE app_user SET roles = '[\"' || role || '\"]' WHERE roles IS NULL");

  // 배상책임보험은 사람마다 드는 것이 아니라
  // **기관이 인원수를 정해 한 번에 가입**합니다.
  // 그래서 기관 정보에 둡니다. 가입 인원보다 제공인력이 많으면 알려줍니다.
  addColumns(db, "organization", {
    liability_insurer: "TEXT",     // 보험사
    liability_policy_no: "TEXT",   // 증권번호
    liability_from: "TEXT",
    liability_to: "TEXT",
    liability_headcount: "INTEGER", // 가입 인원수
  });

  addColumns(db, "worker", {
    // 이미 채용된 직원이 이 사업을 거드는 경우가 있습니다.
    // 그 사람 인건비를 이 사업으로 계산하면 정산이 틀어집니다.
    // 다만 제공 실적과 일지는 그대로 쌓아야 합니다. 기록지에 구멍이 나면 안 됩니다.
    payroll_excluded: "INTEGER NOT NULL DEFAULT 0",
    exclude_reason: "TEXT",
    note: "TEXT",
    dong: "TEXT",   // 거주지 읍면동 — 가까운 곳에 배정하려면 필요합니다
  });

  addColumns(db, "recipient", {
    // 계약서 5-2조: 식사지원을 3회 '연속' 대면 수령하지 않으면
    // 통합돌봄 서비스 전체가 중지됩니다. 누적이 아니라 연속을 세야 합니다.
    no_show_streak: "INTEGER NOT NULL DEFAULT 0",
    last_no_show_on: "TEXT",
  });

  // ── v7 ────────────────────────────────────────────────────
  // 생년월일·주소·입사일은 제공인력만의 것이 아닙니다.
  // 관리자도 사무직원도 사람이고 근로계약이 있습니다.
  // 그런데 지금까지는 worker 표에만 있어서, 제공인력이 아닌 사람의
  // 주소를 넣어도 조용히 버려졌습니다. → 사람 정보는 app_user 로 옮깁니다.
  //
  // worker 표의 칸은 그대로 둡니다(더하기만 한다는 원칙).
  // 읽는 곳만 app_user 로 바꾸고, 옛 값은 아래에서 한 번 옮겨 옵니다.
  addColumns(db, "app_user", {
    payload: "TEXT NOT NULL DEFAULT '{}'",  // 생년월일·주소 (대상자와 같은 방식)
    dong: "TEXT",          // 주소에서 뽑은 읍면동. 검색·배정 거리 판단용
    hired_on: "TEXT",      // 입사일
    contract_on: "TEXT",   // 근로계약 체결일
  });
  db.run(
    `UPDATE app_user SET
       payload  = COALESCE((SELECT w.payload  FROM worker w WHERE w.user_id = app_user.id), '{}'),
       dong     =          (SELECT w.dong     FROM worker w WHERE w.user_id = app_user.id),
       hired_on =          (SELECT w.hired_on FROM worker w WHERE w.user_id = app_user.id)
     WHERE (payload IS NULL OR payload = '{}')
       AND EXISTS (SELECT 1 FROM worker w WHERE w.user_id = app_user.id)`
  );

  // ── v8 ────────────────────────────────────────────────────
  // 제공실적. 「갔다」만으로는 부족합니다.
  // **못 간 날도 남아야** 계획 대비 실적이 나오고, 왜 못 갔는지가 있어야
  // 지자체가 물었을 때 답할 수 있습니다.
  addColumns(db, "delivery", {
    // 제공 | 미제공. 줄이 있다는 것 자체가 "그날을 처리했다"는 뜻입니다.
    outcome: "TEXT NOT NULL DEFAULT '제공'",
    reason: "TEXT",              // 미제공 사유 — 부재·거부·입원·기관사정…
    // 계획에 없던 날에 간 것인지. 실적이 계획보다 많은 이유를 설명해야 합니다.
    planned: "INTEGER NOT NULL DEFAULT 1",
    // 배정은 담당이 바뀌면 줄이 새로 생깁니다. 그때 실적이 어느 대상자·서비스
    // 것이었는지 잃지 않도록 여기 함께 적어 둡니다.
    recipient_id: "TEXT",
    service_id: "INTEGER",
    note: "TEXT",
  });
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_delivery_on   ON delivery(served_on);
    CREATE INDEX IF NOT EXISTS idx_delivery_asg  ON delivery(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_delivery_recp ON delivery(recipient_id, served_on);
  `);

  // ── v9 ────────────────────────────────────────────────────
  // 기록지에 사람이 직접 쓰는 글.
  //
  // 「대상자 상태변화 상세내용」과 「비고」는 실적에서 뽑아낼 수 없습니다.
  // 그 달에 무엇을 보고 어떻게 판단했는지는 사람만 아는 것이라
  // 대상자마다 · 달마다 한 칸씩 따로 둡니다.
  db.exec(`
    CREATE TABLE IF NOT EXISTS record_note (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_id  TEXT NOT NULL REFERENCES recipient(id) ON DELETE CASCADE,
      month         TEXT NOT NULL,          -- YYYY-MM
      status_change TEXT,                   -- 증상악화 | 개선 | 변화없음
      detail        TEXT,                   -- 상태변화 상세내용 (줄바꿈으로 여러 항목)
      remark        TEXT,                   -- 비고
      staff_name    TEXT,                   -- 기록지에 찍을 담당자 성명
      updated_at    TEXT NOT NULL,
      UNIQUE(recipient_id, month)
    );
  `);

  // ── v10 ───────────────────────────────────────────────────
  // 서비스를 화면에서 새로 만들고 단가를 고칠 수 있게 되면서 붙인 칸들.
  addColumns(db, "service", {
    /*
     * 서비스는 **지우지 않습니다.**
     *
     * 이미 실적·의뢰·배정이 그 서비스를 가리키고 있기 때문입니다.
     * 지우면 지난 기록지와 청구서가 「이름 없는 서비스」가 됩니다.
     * 그래서 안 쓰게 된 것은 `active = 0` 으로 **접어 둡니다** —
     * 새로 고를 때는 안 보이고, 지난 기록에는 그대로 남습니다.
     */
    active: "INTEGER NOT NULL DEFAULT 1",
    // 「지침에 없어 기관이 직접 만든 것」인지. 나중에 지침이 바뀌면 이것부터 봅니다.
    custom: "INTEGER NOT NULL DEFAULT 0",
    note: "TEXT",                    // 이 서비스에 대한 기관 메모
    updated_at: "TEXT",
  });

  // ── v11 ───────────────────────────────────────────────────
  /*
   * 포스트잇.
   *
   * 사무실 벽과 모니터 가장자리에 붙어 있는 그 종이입니다.
   * 「김순자 어르신 목요일 병원, 그날 방문 빼기」 같은 것들 —
   * 어느 표에도 안 들어가는데 사라지면 사고가 나는 말들입니다.
   *
   * 지금은 그것이 사람 머릿속과 종이에만 있습니다. 붙인 사람이 쉬면 같이 쉽니다.
   * 그래서 프로그램 안에 붙일 자리를 둡니다. **떼기 전까지 홈에 남습니다.**
   *
   * 지운 것과 뗀 것은 다릅니다. 뗀 것(done_at)은 남겨 둡니다 —
   * "그때 왜 안 갔지"를 나중에 되짚을 수 있어야 하기 때문입니다.
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS sticky (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      text         TEXT NOT NULL,
      color        TEXT NOT NULL DEFAULT 'yellow',
      author_id    INTEGER REFERENCES app_user(id) ON DELETE SET NULL,
      author       TEXT,                  -- 이름도 함께. 계정이 없어져도 누가 붙였는지 남습니다.
      recipient_id TEXT REFERENCES recipient(id) ON DELETE CASCADE,  -- 특정 대상자에 관한 것이면
      pinned       INTEGER NOT NULL DEFAULT 0,
      due_on       TEXT,                  -- 언제까지 (없어도 됩니다)
      done_at      TEXT,                  -- 뗀 시각. 비어 있으면 아직 붙어 있는 것입니다.
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sticky_done ON sticky(done_at);
    CREATE INDEX IF NOT EXISTS idx_sticky_recp ON sticky(recipient_id);
  `);

  /*
   * 휴직.
   *
   * 지금까지는 재직 아니면 퇴직뿐이었습니다. 그런데 현장에는 그 사이가 있습니다 —
   * 병가·출산·개인 사정으로 **몇 달 쉬었다 돌아오는** 사람입니다.
   *
   * 이 사람을 퇴직 처리하면 배정에서 사라지는 것은 맞지만,
   * 돌아왔을 때 자격·교육·입사일이 새로 시작한 것처럼 보입니다. 그건 거짓입니다.
   * 그렇다고 재직으로 두면 **쉬는 사람에게 배정이 붙습니다.**
   *
   * → 상태를 하나 더 둡니다. `status = 'leave'`.
   *   명단에는 「휴직」으로 남고, 새 배정에서는 빠지고, 지난 실적·일지는 그대로입니다.
   */
  addColumns(db, "app_user", {
    leave_from:   "TEXT",   // 휴직 시작일
    leave_to:     "TEXT",   // 돌아올 예정일 (모르면 비워 둡니다)
    leave_reason: "TEXT",
  });

  // ── v12 ───────────────────────────────────────────────────
  /*
   * 메모지가 화이트보드 **어디에** 붙어 있는지.
   *
   * 종이를 벽에 붙일 때 사람은 아무 데나 붙이지 않습니다.
   * 급한 것은 눈높이에, 관련된 것끼리 옆에, 오래된 것은 구석에 붙입니다.
   * **그 자리 자체가 정보입니다.** 프로그램이 순서를 정해 줄로 세우면
   * 그 정보가 사라집니다.
   *
   * 그래서 붙인 자리와 크기를 그대로 기억합니다.
   * 자리는 **기관이 함께 보는 것**이라 이 PC 한 곳(자료함)에 둡니다 —
   * 브라우저에 넣어 두면 사람마다 다른 보드를 보게 됩니다.
   */
  addColumns(db, "sticky", {
    x: "INTEGER",   // 보드 왼쪽에서
    y: "INTEGER",   // 보드 위에서
    w: "INTEGER",   // 너비
    h: "INTEGER",   // 높이
  });

  // ── v13 ───────────────────────────────────────────────────
  /*
   * 언제 청구하는가 — **지자체 몫과 이용자 몫을 따로 정합니다.**
   *
   * 후불제에서 기관마다 다릅니다. 셋 중 하나를 고릅니다.
   *
   *   monthly       **달마다** — 달력 달로 자릅니다. 8월분은 8.1~8.31
   *   anniversary   **시작일부터 한 달씩** — 5.11 에 시작했으면
   *                 5.11~6.10 이 1회차, 6.11~7.10 이 2회차
   *   on_end        **일괄** — 의뢰 기간이 끝나면 그동안 것을 한 장으로
   *
   * 그리고 **둘이 서로 다를 수 있습니다.**
   * 지자체에는 매달 올리면서 어르신께는 기간 끝나고 한 번에 받는 곳이 있습니다.
   * 그래서 한 칸이 아니라 **두 칸**입니다. 한 칸으로 두면 언젠가
   * 「우리는 그렇게 안 하는데」가 나오고, 그때는 이미 늦습니다.
   *
   * 기본값은 둘 다 「달마다」입니다 — 지금까지 하던 대로입니다.
   */
  addColumns(db, "region_profile", {
    // monthly | anniversary | on_end
    claim_timing: "TEXT NOT NULL DEFAULT 'monthly'",   // 지자체 청구
    copay_timing: "TEXT NOT NULL DEFAULT 'monthly'",   // 본인부담금
  });

  /*
   * 이 청구서가 **무엇에 대한 것인가.**
   *
   * 두 시점이 같으면 종이 한 장에 둘 다 담깁니다(both) — 지금까지와 같습니다.
   * 다르면 **갈라집니다** — 지자체 몫 한 장(claim), 이용자 몫 한 장(copay).
   *
   * 옛 자료에는 이 칸이 없으니 both 로 채웁니다. 실제로 그랬습니다.
   */
  addColumns(db, "billing", {
    kind: "TEXT NOT NULL DEFAULT 'both'",   // both | claim | copay
  });
  db.run("UPDATE billing SET kind = 'both' WHERE kind IS NULL OR kind = ''");

  // ── v14 ───────────────────────────────────────────────────
  /*
   * 공휴일 — **기관이 적어 넣습니다. 프로그램이 알고 있지 않습니다.**
   *
   * 토·일은 셈으로 나오지만 나머지는 해마다 다릅니다.
   * 설날과 추석은 음력이라 양력 날짜가 매년 옮겨 다니고, 대체공휴일은
   * 그해 규정에 따라 붙었다 말았다 합니다. **프로그램에 박아 두면 반드시 틀립니다.**
   * 틀린 채로 두면 휴일 할증이 어긋나고, 그건 돈이 어긋나는 일입니다.
   *
   * 그래서 표를 비워 두고 **설정에서 쌓아 갑니다.**
   * 해마다 관공서 달력이 나오면 그때 넣으면 됩니다. 한 번 넣은 것은 남습니다.
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS holiday (
      on_date    TEXT PRIMARY KEY,     -- YYYY-MM-DD
      name       TEXT NOT NULL,        -- 설날 · 추석 · 대체공휴일 …
      created_at TEXT NOT NULL
    );
  `);

  /*
   * 한동안 주소 찾기를 **행정안전부 개방 API** 로 했고, 그때는 기관마다
   * 승인키를 설정에 넣어야 했습니다. 지금은 포털에서 쓰시던 그 검색창
   * (카카오 우편번호 서비스)을 화면이 바로 띄우므로 **키가 없습니다.**
   *
   * **안 쓰는 열쇠는 두지 않습니다.** 쓰지도 않는 승인키가 자료함에
   * 남아 있으면, 백업이 USB 로 오갈 때 그것도 같이 오갑니다.
   * (표는 안 건드립니다 — 줄 하나만 지웁니다.)
   */
  db.run("DELETE FROM meta WHERE key = 'juso_key'");

  // ── v16 ───────────────────────────────────────────────────
  /*
   * ── 연간 지원한도 ─────────────────────────────────────────
   *
   * 편람: **1인당 연간 150만원** 안에서 서비스를 짭니다.
   * **안전생활환경개선은 이 한도 바깥**이고, 따로 **생애 100만원**입니다.
   *
   * 계약서(서식2) 4조가 어르신께 이렇게 약속합니다 —
   *   「… 비용이 지출되며, **1인당 연간 지원한도액에서 차감됩니다.**」
   * 그 종이를 내보내면서 우리 안에 한도가 없으면, 얼마나 남았는지 물었을 때
   * 답할 데가 없습니다.
   *
   * **왜 설정값인가** — 지역마다 다를 수 있습니다. 코드에 박으면
   * 광주에 갈 때 exe 를 새로 뿌려야 합니다.
   */
  addColumns(db, "region_profile", {
    annual_cap:  "INTEGER NOT NULL DEFAULT 1500000",   // 1인 연간 (편람 150만)
    housing_cap: "INTEGER NOT NULL DEFAULT 1000000",   // 안전생활환경 생애 (편람 100만)
  });
  /*
   * ── 「복지부 지침 표준」에는 이 숫자를 넣지 않습니다 ──────────
   *
   * 150만원은 **해남군 업무편람**에 적힌 값이고, 2026년 의료·요양 통합돌봄
   * 사업안내에는 없습니다. 지침에 없는 것을 지침이라고 적어 두면
   * **기준이 통째로 무너집니다** — 청구 시점·절삭 방식에서 이미 한 번
   * 그랬다가 바로잡았습니다(v13 주석).
   *
   * 그래서 기준선은 **0(= 한도를 안 봅니다)** 으로 두고,
   * 편람 값은 **「우리 지자체 규칙」**에 둡니다.
   */
  db.run("UPDATE region_profile SET annual_cap = 0, housing_cap = 0 WHERE is_builtin = 1");

  /*
   * **어느 서비스가 연간 한도 바깥인가.**
   *
   * 「생애 한도가 붙은 것 = 연간 한도 바깥」이 지금은 맞습니다만,
   * 그 둘은 **다른 이야기**라 한 칸으로 겸하면 언젠가 어긋납니다.
   * 그래서 **따로 적어 둡니다.** 기관이 설정에서 켜고 끕니다.
   *
   * 옛 자료함에는 이 칸이 없으니 **생애 한도가 붙어 있던 것**을
   * 바깥으로 봅니다 — 지금까지 그 뜻으로 쓰던 것과 같습니다.
   */
  addColumns(db, "service", {
    outside_annual_cap: "INTEGER NOT NULL DEFAULT 0",
  });
  db.run(
    "UPDATE service SET outside_annual_cap = 1 " +
    " WHERE lifetime_cap IS NOT NULL AND outside_annual_cap = 0"
  );

  // ── v17 ───────────────────────────────────────────────────
  /*
   * ── 실제로 몇 분 있었나 (30분 환산 · A-1) ─────────────────
   *
   * 편람: 15분 미만 미산정 · 15~45분 30분 · 45분 이상 1시간.
   * 지금까지 우리는 「갔다/안 갔다」만 알고 **한 번 = 한 시간**으로 셌습니다.
   * 그래서 **40분 다녀온 것을 1시간으로 청구**하고 있었습니다.
   *
   * ── 비어 있으면 지금까지와 똑같이 셉니다 ──────────────────
   * 옛 실적에는 분이 없습니다. 그것을 **지어내지 않습니다.**
   * 비어 있으면 예전처럼 「한 번 = 한 시간」으로 두고, 분을 적은 것부터
   * 새 규칙으로 셉니다. 그래야 **지난 청구서가 안 흔들립니다.**
   *
   * `start_at`·`end_at` 은 이미 있지만 그동안 아무도 안 채웠고,
   * 현장앱이 붙으면 그 둘로 여기를 자동으로 채웁니다.
   */
  addColumns(db, "delivery", {
    minutes: "INTEGER",   // 실제 제공 분. 비어 있으면 「한 번 = 한 시간」
  });

  // ── v18 ───────────────────────────────────────────────────
  /*
   * ── 서비스별 **월 한도** (A-2 · 7-사) ─────────────────────
   *
   * 편람: 가사 월 12시간 · 식사 월 8회 · 동행 월 6시간과 2회 · 이미용 월 1회.
   *
   * **칸이 둘인 이유** — 동행지원은 **시간과 횟수에 둘 다** 걸립니다.
   * 6시간을 안 넘겨도 세 번째 방문은 안 됩니다. 한 칸으로 겸할 수가 없습니다.
   *
   * **0 은 「한도를 안 봅니다」**입니다 — 연간 한도와 같은 규칙입니다.
   * 그래서 「복지부 지침 표준」에는 안 넣습니다. 이 숫자들은 **편람 값**이고
   * 지침에는 없습니다. 편람 값은 **「우리 지자체 규칙」**에만 들어갑니다.
   */
  addColumns(db, "service", {
    monthly_cap_minutes: "INTEGER NOT NULL DEFAULT 0",  // 시간제 — 분 (720 = 12시간)
    monthly_cap_count:   "INTEGER NOT NULL DEFAULT 0",  // 횟수제 — 회
  });

  /*
   * 옛 자료함에는 이 칸이 없었습니다. **우리 지자체 규칙에만** 편람 값을
   * 한 번 채워 넣습니다 — 아직 아무도 안 건드린(둘 다 0) 줄에만.
   * 기관이 일부러 0(= 안 봄)으로 둔 경우와 구별할 수 없지만,
   * 이 칸이 오늘 처음 생기므로 지금은 「아무도 안 건드린 것」이 맞습니다.
   */
  for (const [code, 분, 회] of [
    ["DL-HOUSE", 720, 0],   // 가사지원   월 12시간
    ["DL-MEAL",    0, 8],   // 식사지원   월 8회
    ["DL-MOVE",  360, 2],   // 동행지원   월 6시간 **그리고** 월 2회
    ["DL-HAIR",    0, 1],   // 이미용     월 1회
  ] as [string, number, number][]) {
    db.run(
      `UPDATE service SET monthly_cap_minutes = ?, monthly_cap_count = ?
        WHERE code = ? AND monthly_cap_minutes = 0 AND monthly_cap_count = 0
          AND profile_id IN (SELECT id FROM region_profile WHERE is_builtin = 0)`,
      [분, 회, code]
    );
  }

  // ── v19 ───────────────────────────────────────────────────
  /*
   * ── 못 간 날의 **갈래** (A-3 · 7-아) ──────────────────────
   *
   * 계약서(서식2) 4조 —
   *   「이용자가 **사전 취소 없이** … 이용하지 않으셨더라도 비용이
   *    지출되며, 1인당 연간 지원한도액에서 차감됩니다.」
   *
   * 지금까지 「미제공」은 갈래가 하나뿐이라, 아무 말 없이 문이 잠겨 있어
   * 헛걸음한 것과 어르신이 이틀 전에 알려 오신 것을 **똑같이** 셌습니다.
   * 그 둘은 돈과 한도가 정반대입니다.
   *
   *   노쇼 · 사전취소 · 기관사정 · 기타
   *
   * ── 옛 자료는 안 건드립니다 ──────────────────────────────
   * 이 칸이 오늘 처음 생기므로 지난 미제공에는 값이 없습니다.
   * **비어 있으면 「기타」**로 읽어 지금까지와 똑같이 셉니다 —
   * 지어내면 지난 청구서에 없던 돈이 생깁니다.
   * (그래서 여기에는 UPDATE 가 없습니다.)
   */
  addColumns(db, "delivery", {
    miss_kind:   "TEXT",   // 노쇼 | 사전취소 | 기관사정 | 기타. 비면 기타
    notified_on: "TEXT",   // 이용자가 취소를 알려 온 날 (사전취소일 때)
  });

  // ── v20 ───────────────────────────────────────────────────
  /*
   * ── 식사지원 **대면 / 비대면** (A-4) ──────────────────────
   *
   * 편람 「<대면> 배달 원칙 준수 · **비대면 배달이 3회 연속**이면 서비스 중단」.
   * 계약서 5-2조도 같은 말입니다 — 3회 연속이면 **통합돌봄 전체가 중지**됩니다.
   *
   * **우리가 세던 것이 틀렸습니다.** `syncMeal()` 이 **미제공 연속**을 세었는데,
   * 편람이 세는 것은 **비대면 배달 연속**입니다.
   *
   *   미제공      아예 안 갔다 → 음식이 안 나갔으니 **돈도 안 나갑니다**
   *   비대면 배달 갔고 놓고 왔다 → 음식이 이미 만들어졌으니 **돈이 나갑니다**
   *
   * **비어 있으면 대면**으로 읽습니다 — 원칙이 대면이고 비대면은 일부러 적는
   * 것입니다. 그래야 옛 실적으로 **없던 중지 경고가 안 뜹니다.**
   * (그래서 여기에도 UPDATE 가 없습니다.)
   */
  addColumns(db, "delivery", {
    face_to_face: "INTEGER",   // 1 대면 · 0 비대면 · 비면 대면(원칙)
  });

  /*
   * ── 노쇼를 비용으로 잡나 (A-3 을 이어서 바로잡음) ─────────
   *
   * 계약서 4조에 「사전 취소 없이 … 비용이 지출되며 한도에서 차감됩니다」가
   * 적혀 있고 그 종이는 **어르신께 그대로 인쇄되어 나갑니다**(서식2).
   * 그래서 기능을 없애지는 않습니다 — 뽑는 종이와 프로그램이 어긋나면 안 됩니다.
   *
   * 다만 **해남 현장은 안 씁니다** (2026-09-01 무무 님). 가사·동행·이미용은
   * 이용자 사정이면 **일정을 사전 조율**해 다시 잡고, 식사는 위의 대면/비대면이
   * 그 자리를 대신합니다. 그래서 **기본은 꺼짐**이고, 꺼져 있으면 실적 화면에
   * 갈래를 아예 안 묻습니다. 다른 지자체가 켜서 쓸 수 있습니다.
   */
  addColumns(db, "service", {
    noshow_billable: "INTEGER NOT NULL DEFAULT 0",
  });

  // ── v21 ───────────────────────────────────────────────────
  /*
   * ── 연속 비대면 배달 **몇 번**이면 중지인가 ────────────────
   *
   * 편람과 계약서 5-2조는 **3회**입니다. 그런데 지침은 개정됩니다 —
   * 그때마다 프로그램을 새로 짜 드릴 수는 없으니 **설정값**으로 둡니다.
   * **0 은 「안 봅니다」**입니다 (연간·월 한도와 같은 규칙).
   *
   * ── 왜 「지침 표준」에도 3 을 넣나 ────────────────────────
   * 150만원·월 12시간은 **편람 값**이라 기준선에 0 으로 두었습니다.
   * 이건 다릅니다 —
   *   ① **계약서(서식2) 5-2조**에 있고, 그 계약서는 **어느 기관이나
   *      어르신과 맺습니다.**
   *   ② 돈이 아니라 **어르신 서비스가 통째로 끊기는 경고**입니다.
   *      꺼 두면 끊길 때까지 아무도 모릅니다.
   * 그래서 **두 규칙 다 3 으로** 심고, 안 쓸 기관은 0 으로 끕니다.
   */
  addColumns(db, "region_profile", {
    f2f_limit: "INTEGER NOT NULL DEFAULT 3",
  });

  // ── v22 ───────────────────────────────────────────────────
  /*
   * ── 서식에 인쇄된 **묵은 해**를 실제 해로 고칠 것인가 ──────
   *
   * 계약서(서식2)의 계약기간 칸이 이렇게 인쇄돼 있습니다 —
   *
   *     2025.   .     . ~ 2025.   .     .
   *
   * **2026년 편람인데 이 줄만 2025** 입니다. 맨 아래 서명란은
   * 「2026년 월 일」로 제대로 돼 있으니 군의 오타로 보입니다.
   * 그대로 두면 2026년에 맺은 계약서에 2025 가 찍혀 나갑니다.
   *
   * ── 왜 설정값으로 두나 ────────────────────────────────────
   * 이것은 **제출 서식에 인쇄된 글자를 우리가 고치는 것**이라
   * 「서식은 손대지 않는다」는 원칙과 정면으로 부딪칩니다.
   * 그러니 우리가 몰래 정하지 않고 **기관이 정하게** 둡니다.
   * 군이 서식을 고쳐 내려보내면 이 설정을 끄면 그만입니다.
   *
   * 기본은 **켬**입니다 — 날짜가 틀린 계약서가 어르신께 가는 것보다
   * 낫다고 보았습니다. 끄면 서식에 인쇄된 해가 그대로 나갑니다.
   */
  addColumns(db, "region_profile", {
    form_fix_year: "INTEGER NOT NULL DEFAULT 1",
  });

  // ── v23 ───────────────────────────────────────────────────
  /*
   * ── **하루 최대 서비스 시간** — 편람 「1일 최대 3시간」 ─────
   *
   * 편람이 서비스마다 이렇게 적어 두었습니다 —
   *
   *   가사지원  「○ (제 공 기 준) **1일 최대 3시간**(평일 오전 9시 ~오후 6시)」
   *   동행지원  「○ (제공기준) **1일 최대 3시간**(평일 오전9시 ~ 오후 6시)」
   *
   * ── 왜 필요한가 ───────────────────────────────────────────
   * 지금까지 우리 셈은 **잰 시간만큼 다 쳤습니다.** 실수로 다섯 시간이
   * 찍히면 다섯 시간을 청구합니다. 그 선을 **셈하는 자리에** 둡니다 —
   * 화면에서만 막으면 엑셀로 들어온 자료·옛 자료를 못 막습니다.
   *
   * ── 어디에 두나 ───────────────────────────────────────────
   * 편람은 가사도 동행도 3시간이라 **지역 규칙**(region_profile) 한 칸으로
   * 넉넉합니다. 지침이 개정되면 여기서 고칩니다.
   * **0 이면 안 봅니다** — 연간·월 한도와 같은 규칙입니다.
   *
   * 사람마다 다른 경우는 **배정의 주간 계획**에 적습니다 —
   * 「서비스 제공계획에 시간이 별도로 명시되어 있다면 일 최대 서비스시간을
   *  이에 맞춤」(2026-09-03 무무 님 지시). `assignment.weekly_plan` 의
   * 요일마다 `minutes` 가 그것이고, 있으면 그 값이 앞섭니다.
   */
  addColumns(db, "region_profile", {
    daily_cap_minutes: "INTEGER NOT NULL DEFAULT 180",
  });

  /*
   * v24 — 우편함(현장앱)에서 쓰는 제공인력 번호.
   *
   * 왜 따로 두나 —
   *   기관 PC 의 app_user.id 는 1, 2, 3… 입니다. 그대로 우편함에 올리면
   *   **다른 기관의 1번과 부딪히고**, 무엇보다 「이 기관에 몇 명 있나」가
   *   번호만 보고도 드러납니다. 그래서 뜻 없는 UUID 를 따로 붙입니다.
   *   기기 등록할 때 처음 한 번 생기고, 그 뒤로는 바뀌지 않습니다.
   */
  addColumns(db, "app_user", { mailbox_worker_id: "TEXT" });

  /*
   * v25 — 의뢰 중단.
   *
   * 「지자체에 신청은 했는데 자부담이 부담되어 취소」 — 현장에서 자주 나옵니다.
   * 그런데 지금까지는 적을 데가 없었습니다. 지자체 의뢰는 **지울 수 없고**
   * (무엇이 왔었는지가 근거입니다), 고칠 수도 없게 막아 두었기 때문입니다.
   *
   * 지우지 않고 **닫습니다.** 중단하면 `period_to` 를 그날로 닫아
   * 기간을 보는 열 군데(정산·서식·배정·마감…)가 **저절로** 따라옵니다.
   * 칸을 새로 만들어 열 군데를 다 고치면, 하나만 빠뜨려도 중단한 것이
   * 어딘가에 살아남습니다.
   *
   * 아래 세 칸은 **표시와 되돌리기**에만 씁니다.
   */
  addColumns(db, "referral", {
    cancelled_at:  "TEXT",   // 중단한 날 (이 값이 있으면 「끝남」이 아니라 「중단」)
    cancel_reason: "TEXT",   // 왜 — 「자부담 부담」처럼 사람이 적습니다
    to_before:     "TEXT",   // 중단 전의 기간 끝. 되돌릴 때 이 값으로 돌립니다
  });

  /*
   * v26 — 방문표(어르신 댁 문에 붙이는 QR).
   *
   * 무엇인가 —
   *   제공인력이 어르신 댁에 **실제로 갔다**는 것을 남기려면
   *   그 집에서만 찍을 수 있는 것이 있어야 합니다. 그것이 이 값입니다.
   *   종이에 인쇄해 문 안쪽에 붙이고, 현장앱 카메라로 읽습니다.
   *
   * 왜 recipient.id(UUID) 를 그냥 안 쓰나 —
   *   그 번호는 관리자 화면 주소줄에 그대로 나옵니다. 문에 붙은 종이는
   *   **아무나 봅니다.** 두 자리에 같은 번호가 있으면, 종이 한 장을
   *   찍은 사람이 기관 화면의 번호를 알게 됩니다. 따로 둡니다.
   *
   * 왜 열쇠로 만들어 내지 않고 자료함에 두나 —
   *   기관 열쇠는 언젠가 새로 발급합니다(실제로 한 번 했습니다).
   *   열쇠에서 만들어 내면 그때 **붙여 둔 종이가 전부 헛것**이 됩니다.
   *   집집마다 다시 찾아가 떼고 붙일 수는 없습니다. 그래서 한 번 만들고
   *   두고두고 씁니다.
   *
   * 비어 있어도 됩니다 — 인쇄할 때 그 자리에서 만들어 채웁니다.
   */
  addColumns(db, "recipient", { visit_code: "TEXT" });

  /*
   * v27 — 현장 기록 되돌리기.
   *
   * 사무실이 제공실적에서 **「제공」을 「계획」으로 되돌리면** 그 건은
   * 다시 해야 하는 일입니다. 그런데 제공인력 폰은 **자기 안에 적어 둔
   * 기록**을 보고 「전송 완료」로 두고 있습니다. 사무실과 현장이 서로
   * 다른 것을 보게 됩니다. (2026-09-05 무무)
   *
   * 그래서 되돌린 사실을 여기 한 줄 남기고, 그날 갈 곳을 올릴 때 짐에
   * 같이 실어 보냅니다. 폰은 자기가 들고 있는 표와 다르면 그 건의
   * 기록을 **처음으로 되돌립니다.**
   *
   * 왜 delivery 를 지우는 것만으로 안 되나 — 지우고 나면 **되돌렸다는
   * 사실 자체가 없어집니다.** 폰에게 알려 줄 근거가 남지 않습니다.
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS field_reset (
      assignment_id INTEGER NOT NULL,
      served_on     TEXT    NOT NULL,
      token         TEXT    NOT NULL,   -- 되돌릴 때마다 새로 나오는 표
      reset_at      TEXT    NOT NULL,
      PRIMARY KEY (assignment_id, served_on)
    )
  `);

  // ── v28 ───────────────────────────────────────────────────
  /*
   * ── 시간을 **몇 분 단위로** 셈하나 (서비스마다) ────────────
   *
   * (2026-09-06 무무 — 「30분 규칙에서 계산 구간 선택하되 30분 1시간
   *  이렇게만 구성하면 되고 반올림 구간(15분)은 선택할 수 있도록 해서
   *  선택하지 않은 경우 선택한 구간에 미달 시 버림, 반올림 구간을
   *  선택하면 반올림 할 수 있도록」)
   *
   * 지금까지 「30분 단위 · 15분부터 올림」이 **코드에 박혀** 있었습니다.
   * 해남 편람 값입니다 — 「15분 미만 미산정 · 15~45분 30분 · 45분 이상
   * 1시간」. 그런데 이 규칙은 **지자체마다 다를 수 있고, 해가 바뀌면
   * 고쳐질 수도 있습니다.** 박아 두면 그때 프로그램을 고치러 가야 합니다.
   *
   * ── 왜 서비스마다인가 ────────────────────────────────────
   *
   * 「가사는 30분 단위인데 동행은 시간 단위」인 지자체가 있을 수 있습니다
   * (2026-09-06 무무 판단). 서비스 표 안에 두면 **새 서비스를 만들어도
   * 저절로 따라오고**, 「가사·동행」이라고 이름을 못박지 않아도 됩니다.
   *
   *   round_unit   30 또는 60. **분 단위**입니다.
   *   round_half   1 이면 절반부터 올림, 0 이면 미달은 버림.
   *
   * 옛 자료함에는 **지금까지 돌던 값**을 넣습니다 (30 · 올림).
   * 그래야 이 버전으로 올려도 **지난 청구서가 안 흔들립니다.**
   */
  addColumns(db, "service", {
    round_unit: "INTEGER NOT NULL DEFAULT 30",
    round_half: "INTEGER NOT NULL DEFAULT 1",
  });

  /*
   * ── v29 · 확인사항 항목 (2026-09-06 무무) ──────────────────
   *
   * 「가사지원 확인사항은 기관의 입맛에 변경하여 사용할 수 있도록
   *  설정에서 항목을 추가/삭제 할 수 있는 기능을 넣자.」
   *
   * 서식3 의 열한 가지(① 목욕보조 … ⑪ 말벗)는 편람이 정한 것입니다.
   * 그런데 기관마다 실제로 하는 일이 조금씩 다릅니다 — 「약 챙겨 드리기」
   * 처럼 자주 하는데 목록에 없는 것이 있고, 반대로 이 기관은 한 번도
   * 안 하는 항목이 칸만 차지하기도 합니다.
   *
   * ── ★ 서식은 안 건드립니다 ★ ────────────────────────────
   *
   * (무무 — 「세상에 지자체에 제출하는 서류의 서식을 마음대로 수정하는
   *  경우는 없어」) 서식3 의 열한 줄은 **그대로**입니다. 기관이 더한
   * 항목은 서식의 **「기타」 칸에 모아서** 찍힙니다.
   *
   * ── ★ 왜 표를 새로 두고 「얼리나」 ★ ──────────────────────
   *
   * (무무 — 「확인사항 항목이 바뀔 경우 **실행 시의 목록**으로 서식을
   *  뽑아. 변경된 항목으로 뽑을 경우 **일을 한 기록이 표시되지 않는
   *  문제**가 발생 되.」)
   *
   * 목록을 그냥 고쳐 버리면, 3월에 「말벗」을 눌러 둔 기록이 6월에
   * 「말벗」을 지우는 순간 **아무 데도 안 남습니다.** 다녀온 사실이
   * 목록을 고쳤다는 이유로 사라지는 것입니다.
   *
   * 그래서 **고칠 때마다 새 줄을 만듭니다.** 옛 줄은 그대로 두고,
   * 그때 적은 실적은 그 줄을 계속 가리킵니다. 지운 항목도 옛 기록에는
   * 그대로 보입니다.
   *
   *   check_set        고칠 때마다 한 줄. 가장 새 줄이 「지금 쓰는 것」.
   *   delivery.check_set_id   그 실적이 어느 목록으로 적혔나.
   *                           비어 있으면 편람 열한 가지입니다.
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS check_set (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER,
      made_at    TEXT NOT NULL,
      who        TEXT,
      items      TEXT NOT NULL,   -- JSON 배열. 순서가 그대로 화면 순서.
      note       TEXT
    );
  `);
  addColumns(db, "delivery", {
    check_set_id: "INTEGER",
  });

  /*
   * ── v30 · 연간 한도를 무엇으로 재나 (2026-09-07 무무) ───────
   *
   * 「총 서비스 비용으로 재고 설정에서 바꿀 수 있도록 하자.」
   *
   * 편람은 「1인 연간 지원한도 150만원」이라고만 적어 두었습니다.
   * 그런데 그 150만원이 **총 서비스 비용**인지, 본인부담금을 뺀
   * **군 부담액**인지가 안 적혀 있습니다. 지자체마다 다르게 볼 수 있고,
   * 이 답에 따라 「한도를 넘었다」가 갈립니다 — 본인부담 20% 구간이면
   * 두 셈이 25% 차이가 납니다.
   *
   * 군에 물어보는 중이라(2026-09-07 기준) **총 서비스 비용**을 기본으로
   * 두고, 답이 오면 설정에서 바꿀 수 있게 합니다. 코드에 박으면
   * 그때 프로그램을 고치러 가야 합니다.
   *
   *   cap_basis  'total' 총 서비스 비용 (기본) | 'claim' 군 부담액
   */
  addColumns(db, "region_profile", {
    cap_basis: "TEXT NOT NULL DEFAULT 'total'",
  });

  /*
   * ── v31 · 서비스 제공 기간 상한 (2026-09-07 무무) ───────────
   *
   * 해남군 편람 —
   *   가사지원  월 12시간, **개시일부터 2개월**
   *   식사지원  월 8회,    **개시일부터 2개월**
   *   동행지원  월 6시간 · 월 2회, **개시일부터 2개월**
   *   이미용    월 1회,    **개시일부터 2개월**
   *
   * 이 「2개월」을 계획을 미리 잴 때 안 보고 있었습니다. 배정 기간의
   * 끝날(대개 연말)까지 다 간다고 보고 셌더니 **넉 달치가 잡혀** 연간
   * 한도를 넘는다고 했습니다 — 편람대로면 두 달이 최대입니다.
   *
   * 서비스마다 두는 까닭은 단가·월 한도와 같습니다. 지자체마다 다를 수
   * 있고 해가 바뀌면 고쳐질 수 있어, 프로그램에 박으면 그때 고치러
   * 가야 합니다.
   *
   *   period_cap_months  개시일부터 몇 개월. **0 이면 안 봅니다.**
   */
  addColumns(db, "service", {
    period_cap_months: "INTEGER NOT NULL DEFAULT 2",
  });

  /*
   * ── v33 · 비대면 배달을 **연속으로 세나 누적으로 세나** ─────
   *
   * (2026-09-08 무무 — 「비대면 식사배달 3회 누적이 아님 → **연속**임.
   *  편람에서의 유의사항이고, **다른 지자체에선 적용을 다르게 할 수도
   *  있으므로** 누적/연속 선택할 수 있도록 설정에서 반영.」)
   *
   * 해남 편람과 계약서 5-2조는 **「3회 연속」**입니다. 그래서 기본은
   * **연속**입니다. 다만 이건 **어르신 서비스가 통째로 끊기는 기준**이라,
   * 다른 군이 누적으로 읽는데 우리가 연속만 세면 **끊길 사람을 안 끊고**
   * 넘어갑니다. 그 반대도 마찬가지로 나쁩니다.
   *
   * ★ **세는 것은 둘 다 그대로 셉니다.** 화면에도 둘 다 나옵니다.
   *   이 칸이 정하는 것은 **「어느 쪽으로 경고하고 끊나」** 하나뿐입니다.
   *
   *   f2f_mode  '연속' (기본) | '누적'
   */
  addColumns(db, "region_profile", {
    f2f_mode: "TEXT NOT NULL DEFAULT '연속'",
  });

  /*
   * ── v34 · 배정에 **「한 달에 몇 번」** (2026-09-08 무무) ─────
   *
   * 한도를 넘는 계획을 **막기**로 정하고 켜 봤더니, **동행지원(월 2회)과
   * 이미용(월 1회)은 배정 자체가 안 됐습니다.** 배정을 **주간 계획**으로만
   * 짜기 때문입니다 — 한 주에 한 번이 제일 적은데 그것만도 한 달 4~5번입니다.
   *
   * (무무 — 「가!로 하자」 = 배정에 주기 칸을 만들 것)
   *
   * ── 왜 「격주」가 아닌가 ────────────────────────────────────
   * 편람이 정한 것은 **「월 2회」**지 격주가 아닙니다. 격주는 **다섯 주짜리
   * 달에 3번**이 되어 그 달만 한도를 넘깁니다. 막는 것을 만들어 놓고 다시
   * 넘기는 계획을 짜게 됩니다.
   *
   *   monthly_times  0 = **매주** (지금까지 그대로) · 1~4 = 그 달에 그만큼만
   *
   * **0 이 기본입니다.** 이미 쓰고 있는 배정은 하나도 안 바뀝니다.
   * 「이 날에 가나」를 답하는 곳은 `server/가는날.ts` **하나**입니다.
   */
  addColumns(db, "assignment", {
    monthly_times: "INTEGER NOT NULL DEFAULT 0",
  });

  /*
   * ── v35 · 최초 설정을 **마쳤나** (2026-09-08) ────────────────
   *
   * (2026-09-01 무무 안 · `할일.md` 7-하 —
   *  「기관 정보 → 관리자 등록 → **★ 필수 설정** → 홈」)
   *
   * 지금은 기관명과 관리자만 넣으면 곧장 홈으로 갑니다. 그래서
   * **단가·한도·부담률이 손도 안 댄 채로** 쓰이기 시작합니다.
   * 설명서에 적어도 안 읽힙니다 — **순서로 막습니다.**
   *
   * ★ 이 칸이 비어 있으면 **어느 주소로 들어와도** 그 화면으로 보냅니다.
   *
   * ★★ **이미 쓰고 있는 기관도 한 번은 뜹니다.** 그게 맞습니다 —
   *   확인한 적이 없는 기관이니까요. 실제로 이 개발 자료함은 8월 31일에
   *   고친 편람 단가(식사 11,000 · 동행 27,000 · 생애 100만원)가
   *   **안 들어가 있었습니다.** `seed.ts` 는 자료함을 **처음 만들 때만**
   *   쓰이기 때문입니다. 마법사는 바로 그것을 잡습니다.
   *
   *   setup_done_at  ISO 시각. 비어 있으면 **아직 안 마친 것**
   */
  addColumns(db, "organization", {
    setup_done_at: "TEXT",
  });

  /*
   * ── v36 · 서비스마다 **1회 서비스 시간** (2026-09-11) ────────
   *
   * (무무 — 「1회 서비스를 60분으로 한도 내에서 사용할 수도 있는데
   *  설정에서 이를 반영하지 못한다」 / 「서비스별로 시간*횟수 가 한도를
   *  넘지 않는다면 입력할 수 있어야 해」)
   *
   * ── 왜 필요한가 ────────────────────────────────────────────
   *
   * 시간에 관해 설정에 있던 칸은 **「하루 최대 서비스 시간」 하나뿐**이었습니다.
   * 그건 **천장**입니다 — 넘지 말라는 값이지 「보통 이만큼 한다」가 아닙니다.
   * 그 둘을 같은 값으로 쓰다가 2026-09-09 에 **주 2회 배정이 통째로
   * 막혔습니다** (9번 × 3시간 = 27시간 / 한도 12시간).
   *
   * 그래서 「안 적었으면 1시간」으로 정하고 코드에 `기본계획분 = 60` 을
   * 박아 두었는데, **기관이 그 값을 보지도 바꾸지도 못했습니다.**
   * 「우리는 1회 60분으로 한다」를 적을 자리가 없어 관리자가 배정마다
   * 손으로 60을 쳐야 했습니다. 대상자가 40명이면 40번입니다.
   *
   * ── 어떻게 쓰이나 ──────────────────────────────────────────
   *
   *   배정의 주간계획에 그 요일 분이 적혀 있으면   → 그 값
   *   없으면 **이 칸**(서비스별 1회 서비스 시간)   → 그 값
   *   그것도 0 이면                                → 60분 (마지막 기본값)
   *
   * 한도와의 관계는 무무 님이 못 박으신 그대로입니다 —
   * **한도 안에 들면 어떻게 나누든 상관없습니다.** 나눠 쓰든 하루 최대까지
   * 꽉 채워 한 번에 쓰든, `1회 시간 × 그 달 횟수 ≤ 월 한도` 이고
   * `1회 시간 ≤ 하루 최대` 이면 프로그램은 막지 않습니다.
   *
   * 0 = 「안 정했음」입니다. 편람 값은 아래에서 한 번 채웁니다.
   */
  addColumns(db, "service", {
    once_minutes: "INTEGER NOT NULL DEFAULT 0",
  });

  /*
   * **시간제 서비스에만** 편람 기준으로 한 번 채웁니다.
   * 가사지원 월 12시간을 주 2회(한 달 9번쯤)로 나누면 한 번에 80분,
   * 주 1회면 3시간까지 됩니다. 어느 쪽도 맞으므로 **한가운데인 60분**을
   * 시작값으로 둡니다 — 기관이 설정에서 바꿉니다.
   * 아직 아무도 안 건드린(0) 줄에만 넣습니다.
   */
  db.run(
    `UPDATE service SET once_minutes = 60
      WHERE once_minutes = 0 AND unit = 'hour'
        AND profile_id IN (SELECT id FROM region_profile WHERE is_builtin = 0)`);

  /*
   * ── v32 · **빠진 색인** (2026-09-08 운용 시험에서 찾음) ──────
   *
   * 기관 한 곳이 2년 쓴 만큼(대상자 300명 · 실적 14만 줄 · 청구 1만 4천 줄)
   * 넣어 놓고 화면을 재어 봤더니 —
   *
   *     홈        1,220ms
   *     통계       1,092ms
   *     정산         539ms
   *
   * 까닭은 하나였습니다. **`assignment` 과 `billing` 에 색인이 한 개도
   * 없었습니다.** 홈은 대상자를 한 명씩 돌면서 그 두 표를 봅니다.
   * 300명 × (배정 600줄 + 청구 1만 4천 줄)을 매번 통째로 훑은 것입니다.
   *
   * 자료가 적을 때는 아무도 못 느낍니다. **파일럿 기관이 반년쯤 쓰면
   * 그때 느려지는데, 그때는 자료가 들어 있어 고치기가 어렵습니다.**
   * 그래서 지금 넣습니다.
   *
   * 색인은 자료를 **안 바꿉니다.** 찾는 길만 하나 더 놓는 것이라
   * 이미 쓰고 있는 기관에 넣어도 잃을 것이 없습니다. 자료함이
   * 조금 커지고(실적 14만 줄에 몇 MB), 적을 때 아주 조금 느려집니다.
   */
  db.exec(`
    -- 홈·대상자 상세가 사람마다 봅니다
    CREATE INDEX IF NOT EXISTS idx_assignment_recp    ON assignment(recipient_id);
    -- 종사자 화면이 「이 사람이 맡은 것」을 봅니다
    CREATE INDEX IF NOT EXISTS idx_assignment_worker  ON assignment(worker_id);
    CREATE INDEX IF NOT EXISTS idx_assignment_service ON assignment(service_id);

    -- 정산·홈이 사람마다, 달마다 봅니다
    CREATE INDEX IF NOT EXISTS idx_billing_recp   ON billing(recipient_id, period_from);
    CREATE INDEX IF NOT EXISTS idx_billing_period ON billing(period_from);

    -- 통계가 서비스별로 셉니다
    CREATE INDEX IF NOT EXISTS idx_delivery_svc ON delivery(service_id, served_on);

    -- 대상자 상세가 사람마다 봅니다
    CREATE INDEX IF NOT EXISTS idx_consent_recp ON consent(recipient_id);
    CREATE INDEX IF NOT EXISTS idx_note_recp    ON record_note(recipient_id);

    -- 계약이 끝난 사람의 로그인 흔적을 지울 때
    CREATE INDEX IF NOT EXISTS idx_session_user ON session(user_id);
    CREATE INDEX IF NOT EXISTS idx_worker_user  ON worker(user_id);

    -- 현장에서 되돌린 것
    CREATE INDEX IF NOT EXISTS idx_field_reset ON field_reset(assignment_id, served_on);
  `);

  /*
   * 아이디는 **겹치면 안 됩니다** — 겹치면 누구로 들어가는지가 자료함
   * 차례에 달리게 됩니다. 프로그램이 이미 막고 있지만, 자료함 자체가
   * 막아 주는 편이 낫습니다.
   *
   * 다만 **이미 겹쳐 있는 자료함**에서는 이 색인이 안 만들어집니다.
   * 그때 켜지지 않으면 기관이 통째로 멈추므로, 안 되면 겹침 없는
   * 보통 색인으로 물러납니다. 겹친 것은 사람이 풀어야 합니다.
   */
  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_login ON app_user(login_id)");
  } catch {
    db.exec("CREATE INDEX IF NOT EXISTS idx_user_login ON app_user(login_id)");
    console.log("  자료함   같은 아이디가 둘 이상 있습니다. 종사자 화면에서 풀어 주세요.");
  }

  /*
   * 색인을 새로 놓았으니 **어느 길이 빠른지 다시 재게** 합니다.
   * 이것을 안 하면 SQLite 가 옛 짐작으로 엉뚱한 색인을 고를 수 있습니다.
   */
  try { db.exec("ANALYZE"); } catch { }
}

export function createTables(db: Database) {
  db.exec(`
    -- ── 기관 (한 줄만 있습니다. 이 PC = 이 기관) ──────────────
    CREATE TABLE IF NOT EXISTS organization (
      id            INTEGER PRIMARY KEY CHECK (id = 1),
      name          TEXT NOT NULL,
      biz_no        TEXT,
      phone         TEXT,
      address       TEXT,
      ceo_name      TEXT,
      bank_name     TEXT,
      bank_account  TEXT,
      bank_holder   TEXT,
      profile_id    INTEGER,
      created_at    TEXT NOT NULL
    );

    -- ── 지자체 프로필 ────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS region_profile (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      name              TEXT NOT NULL,
      billing_mode      TEXT NOT NULL DEFAULT 'postpaid',  -- prepaid | postpaid
      -- 언제 청구하는가. 지자체 몫과 이용자 몫을 **따로** 정합니다 (v13 주석 참고)
      -- monthly(달마다) | anniversary(시작일부터 한 달씩) | on_end(일괄)
      claim_timing      TEXT NOT NULL DEFAULT 'monthly',
      copay_timing      TEXT NOT NULL DEFAULT 'monthly',
      holiday_enabled   INTEGER NOT NULL DEFAULT 0,        -- 휴일 할증 사용 여부
      holiday_surcharge REAL NOT NULL DEFAULT 1.5,
      rounding_unit     INTEGER NOT NULL DEFAULT 10,       -- 1 | 10 | 100 (원)
      rounding_mode     TEXT NOT NULL DEFAULT 'round',     -- round | ceil | floor
      report_cycle_days INTEGER NOT NULL DEFAULT 30,
      -- 1인 연간 지원한도 (편람 150만) · 안전생활환경 생애 한도 (편람 100만)
      annual_cap        INTEGER NOT NULL DEFAULT 1500000,
      housing_cap       INTEGER NOT NULL DEFAULT 1000000,
      is_builtin        INTEGER NOT NULL DEFAULT 0,        -- 1이면 수정 잠금
      created_at        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id    INTEGER NOT NULL REFERENCES region_profile(id) ON DELETE CASCADE,
      code          TEXT NOT NULL,
      cat_l         TEXT,        -- 대분류
      cat_m         TEXT,        -- 중분류
      cat_s         TEXT,        -- 소분류
      name          TEXT NOT NULL,
      unit          TEXT NOT NULL,   -- hour | meal | time
      unit_price    INTEGER NOT NULL DEFAULT 0,
      holiday_price INTEGER,
      record_type   TEXT NOT NULL DEFAULT 'time',  -- time(시간형) | work(공사형) | meal(식사형)
      lifetime_cap  INTEGER,
      -- 1이면 **연간 지원한도 바깥**입니다 (안전생활환경개선).
      -- 생애 한도(lifetime_cap)와는 다른 이야기라 칸을 따로 둡니다.
      outside_annual_cap INTEGER NOT NULL DEFAULT 0,
      -- 월 한도. 0 이면 안 봅니다. 동행지원은 **둘 다** 걸립니다.
      monthly_cap_minutes INTEGER NOT NULL DEFAULT 0,
      monthly_cap_count   INTEGER NOT NULL DEFAULT 0,
      sort_order    INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_service_profile ON service(profile_id);

    CREATE TABLE IF NOT EXISTS copay_tier (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL REFERENCES region_profile(id) ON DELETE CASCADE,
      label      TEXT NOT NULL,
      rate       REAL NOT NULL,        -- 0 = 면제, 0.2 = 20%, 1 = 전액
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_copay_profile ON copay_tier(profile_id);

    -- ── 계정 ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS app_user (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      login_id    TEXT NOT NULL UNIQUE,
      pw_hash     TEXT NOT NULL,
      name        TEXT NOT NULL,
      phone       TEXT,
      role        TEXT NOT NULL DEFAULT 'admin',   -- admin | staff | worker | vendor
      roles       TEXT,                            -- JSON 배열. 한 사람이 여럿 겸할 수 있습니다
      payload     TEXT NOT NULL DEFAULT '{}',      -- 생년월일·주소 (나중에 이 칸만 암호화)
      dong        TEXT,                            -- 주소에서 뽑은 읍면동
      hired_on    TEXT,
      contract_on TEXT,                            -- 근로계약 체결일
      status      TEXT NOT NULL DEFAULT 'active',  -- active | resigned
      resigned_at TEXT,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    -- ── 대상자 ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS recipient (
      id               TEXT PRIMARY KEY,          -- uuid
      payload          TEXT NOT NULL,             -- JSON: 성명·생년월일·성별·연락처·주소·좌표
      search_text      TEXT NOT NULL DEFAULT '',  -- 검색용. 암호화 시 blind index 로 교체
      dong             TEXT,                      -- 읍면동 (필터용)
      status           TEXT NOT NULL DEFAULT '이용',
      status_since     TEXT,
      status_reason    TEXT,
      suspend_deadline TEXT,                      -- 중단 시작 + 90일
      copay_tier_id    INTEGER REFERENCES copay_tier(id),
      no_show_count    INTEGER NOT NULL DEFAULT 0,
      memo             TEXT,                      -- 출력에 안 나가는 내부 메모
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_recipient_status ON recipient(status);
    CREATE INDEX IF NOT EXISTS idx_recipient_dong   ON recipient(dong);
    CREATE INDEX IF NOT EXISTS idx_recipient_search ON recipient(search_text);

    CREATE TABLE IF NOT EXISTS status_change (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_id TEXT NOT NULL REFERENCES recipient(id) ON DELETE CASCADE,
      from_status  TEXT,
      to_status    TEXT NOT NULL,
      changed_on   TEXT NOT NULL,
      reason       TEXT,
      created_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_status_recipient ON status_change(recipient_id);

    CREATE TABLE IF NOT EXISTS consent (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_id    TEXT NOT NULL REFERENCES recipient(id) ON DELETE CASCADE,
      agreed_on       TEXT NOT NULL,
      retention_until TEXT,        -- 종결일 + 5년
      note            TEXT
    );

    -- ── 아래는 다음 단계에서 화면이 붙습니다 ──────────────────

    CREATE TABLE IF NOT EXISTS referral (          -- 지자체 의뢰 (엑셀 1행)
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_label  TEXT NOT NULL,
      recipient_id TEXT NOT NULL REFERENCES recipient(id) ON DELETE CASCADE,
      service_id   INTEGER REFERENCES service(id),
      period_from  TEXT,
      period_to    TEXT,
      period_months INTEGER,
      cycle_unit   TEXT,           -- week | month | lifetime
      cycle_count  INTEGER,
      cycle_text   TEXT,           -- "주 2회" 원문
      copay_type   TEXT,
      note         TEXT,
      diff_state   TEXT,           -- 신규 | 유지 | 변경 | 삭제
      created_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_referral_recipient ON referral(recipient_id);
    CREATE INDEX IF NOT EXISTS idx_referral_batch     ON referral(batch_label);

    CREATE TABLE IF NOT EXISTS worker (            -- 제공인력
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER REFERENCES app_user(id) ON DELETE SET NULL,
      payload         TEXT NOT NULL DEFAULT '{}',  -- 성명·연락처 등
      emp_no          TEXT,
      hired_on        TEXT,
      qualifications  TEXT,        -- JSON 배열
      trainings       TEXT,        -- JSON 배열
      insurance_until TEXT,        -- 배상책임보험 만료일
      geo_consent     INTEGER NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'active',
      created_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assignment (        -- 배정
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_id    TEXT NOT NULL REFERENCES recipient(id) ON DELETE CASCADE,
      worker_id       INTEGER REFERENCES worker(id),
      service_id      INTEGER REFERENCES service(id),
      period_from     TEXT,
      period_to       TEXT,
      -- JSON: [{dow, minutes}] — minutes 는 그 요일 **1회 서비스 시간**(계획).
      -- 비어 있으면 지역 규칙의 「하루 최대 서비스 시간」을 씁니다.
      weekly_plan     TEXT,
      planned_count   INTEGER,
      planned_minutes INTEGER,
      created_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS delivery (          -- 제공실적
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id    INTEGER REFERENCES assignment(id) ON DELETE CASCADE,
      served_on        TEXT NOT NULL,
      actor_type       TEXT,       -- 제공인력 | 사무직원 | 외부업체 | 택배
      actor_id         INTEGER,
      start_at         TEXT,
      end_at           TEXT,
      qty              REAL,
      is_holiday       INTEGER NOT NULL DEFAULT 0,
      payload          TEXT DEFAULT '{}',   -- 일지·사진·서명
      scan_lat         REAL,
      scan_lng         REAL,
      accuracy_m       REAL,
      home_distance_m  REAL,
      verdict          TEXT,       -- 일치 | 확인필요 | 원거리
      status_change    TEXT,       -- 증상악화 | 개선 | 변화없음
      created_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS billing (           -- 청구
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_id   TEXT NOT NULL REFERENCES recipient(id) ON DELETE CASCADE,
      period_from    TEXT,
      period_to      TEXT,
      service_amount INTEGER,
      copay_rate     REAL,
      copay_amount   INTEGER,
      claim_amount   INTEGER,
      -- 무엇에 대한 청구인가. both = 한 장에 둘 다 (두 시점이 같을 때)
      -- claim = 지자체 몫만, copay = 이용자 몫만 (두 시점이 다를 때 갈라집니다)
      kind           TEXT NOT NULL DEFAULT 'both',
      calc_snapshot  TEXT,         -- 계산에 쓴 단가·비율·반올림을 통째로 보관
      issued_on      TEXT,
      paid_on        TEXT,
      receipt_no     TEXT,
      refund_due     INTEGER,
      refunded_on    TEXT,
      created_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rule_change_log (   -- 계산규칙 변경 이력
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      changed_at TEXT NOT NULL,
      who        TEXT,
      field      TEXT,
      before_val TEXT,
      after_val  TEXT,
      reason     TEXT
    );

    CREATE TABLE IF NOT EXISTS form_output (       -- 출력 이력
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      kind         TEXT NOT NULL,
      target_id    TEXT,
      generated_at TEXT NOT NULL,
      file_path    TEXT
    );
  `);
}
