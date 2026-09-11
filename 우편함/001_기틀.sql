-- ============================================================
--  통돌 Note — 우편함 기틀
--  8차 「보관 구조」 문서를 그대로 옮긴 것입니다.
--
--  ★ 이 파일의 가장 중요한 성질 ★
--    성명 · 생년월일 · 주소 · 연락처를 담는 칸이 **하나도 없습니다.**
--    지울 수 있는 칸이 아니라, 처음부터 만들지 않습니다.
--    사람에 관한 것은 전부 payload_enc 한 칸에 잠겨서 들어옵니다.
--    우편함은 그 덩어리를 보관만 하고 열지 못합니다.
--
--  Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 실행하세요.
--  여러 번 실행해도 안전합니다.
-- ============================================================

-- ── 0. 준비 ────────────────────────────────────────────────
-- Supabase 는 pgcrypto 를 extensions 스키마에 미리 깔아 둡니다.
-- 없는 곳(맨 Postgres)에서만 만들어집니다.
create extension if not exists pgcrypto;

-- ── 1. 기관 ────────────────────────────────────────────────
create table if not exists public.org (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                    -- 기관명은 개인정보가 아닙니다
  created_at  timestamptz not null default now()
);

-- 기관 PC 로그인 ↔ 기관
create table if not exists public.org_member (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references public.org(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists org_member_org_idx on public.org_member(org_id);

-- ── 2. 제공인력 — 이름이 없습니다 ──────────────────────────
create table if not exists public.worker (
  id          uuid primary key,                 -- 기관 PC 의 app_user 와 짝지은 번호
  org_id      uuid not null references public.org(id) on delete cascade,
  active      boolean not null default true,    -- 퇴사하면 false → 아무것도 못 봅니다
  created_at  timestamptz not null default now()
);
create index if not exists worker_org_idx on public.worker(org_id);

-- 등록된 휴대폰 ↔ 제공인력
create table if not exists public.worker_device (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  worker_id     uuid not null references public.worker(id) on delete cascade,
  org_id        uuid not null references public.org(id) on delete cascade,
  registered_at timestamptz not null default now()
);
create index if not exists worker_device_worker_idx on public.worker_device(worker_id);

-- 일회용 등록표 — 표 자체는 저장하지 않고 해시만 둡니다
create table if not exists public.enroll_token (
  token_hash  text primary key,
  org_id      uuid not null references public.org(id) on delete cascade,
  worker_id   uuid not null references public.worker(id) on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ── 3. 할 일 (기관 PC → 휴대폰) ────────────────────────────
create table if not exists public.job (
  id          uuid primary key,
  org_id      uuid not null references public.org(id) on delete cascade,
  worker_id   uuid not null references public.worker(id) on delete cascade,
  served_on   date not null,
  payload_enc text not null,          -- 이름·주소·연락처·서비스명이 여기 잠겨 있습니다
  expires_at  timestamptz not null default (now() + interval '14 days'),
  created_at  timestamptz not null default now()
);
create index if not exists job_worker_day_idx on public.job(worker_id, served_on);
create index if not exists job_expires_idx    on public.job(expires_at);

-- ── 4. 보고 (휴대폰 → 기관 PC) ─────────────────────────────
create table if not exists public.report (
  id          uuid primary key,
  job_id      uuid not null references public.job(id) on delete cascade,
  org_id      uuid not null references public.org(id) on delete cascade,
  worker_id   uuid not null references public.worker(id) on delete cascade,
  started_at  timestamptz,            -- QR 첫 번째 → 서식8 「진행시간」 앞
  ended_at    timestamptz,            -- QR 두 번째 → 서식8 「진행시간」 뒤
  qr_ok       boolean not null default false,
  payload_enc text not null,          -- 일지 · 서명이 여기 잠겨 있습니다
  pulled_at   timestamptz,            -- 기관 PC 가 받아간 시각 (받아가면 지웁니다)
  expires_at  timestamptz not null default (now() + interval '14 days'),
  created_at  timestamptz not null default now()
);
create index if not exists report_org_pull_idx on public.report(org_id, pulled_at);
create index if not exists report_expires_idx  on public.report(expires_at);

-- ── 5. 사진 ────────────────────────────────────────────────
create table if not exists public.photo (
  id          uuid primary key,
  report_id   uuid not null references public.report(id) on delete cascade,
  org_id      uuid not null references public.org(id) on delete cascade,
  path        text not null,          -- Storage 안의 자리. 파일 자체도 잠겨 있습니다
  expires_at  timestamptz not null default (now() + interval '14 days'),
  created_at  timestamptz not null default now()
);
create index if not exists photo_report_idx  on public.photo(report_id);
create index if not exists photo_expires_idx on public.photo(expires_at);

-- ============================================================
--  6. 누가 무엇을 볼 수 있나 (RLS)
--     이것이 「남의 기관 것을 못 본다」를 데이터베이스가 강제하는 자리입니다.
-- ============================================================

alter table public.org           enable row level security;
alter table public.org_member    enable row level security;
alter table public.worker        enable row level security;
alter table public.worker_device enable row level security;
alter table public.enroll_token  enable row level security;
alter table public.job           enable row level security;
alter table public.report        enable row level security;
alter table public.photo         enable row level security;

-- 나는 어느 기관 사람인가 (기관 PC 쪽)
create or replace function public.my_org() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select org_id from public.org_member where user_id = auth.uid()
$$;

-- 나는 어느 인력인가 (휴대폰 쪽). 퇴사했으면 아무것도 안 나옵니다.
create or replace function public.my_worker() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select d.worker_id from public.worker_device d
    join public.worker w on w.id = d.worker_id
   where d.user_id = auth.uid() and w.active
$$;

do $$
declare t text;
begin
  foreach t in array array['org','org_member','worker','worker_device',
                           'enroll_token','job','report','photo']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_기관', t);
    execute format('drop policy if exists %I on public.%I', t || '_폰',   t);
  end loop;
end $$;

-- 기관 PC — 자기 기관 것만, 전부
create policy org_기관 on public.org
  for all using (id = public.my_org()) with check (id = public.my_org());

create policy org_member_기관 on public.org_member
  for select using (org_id = public.my_org());

create policy worker_기관 on public.worker
  for all using (org_id = public.my_org()) with check (org_id = public.my_org());

create policy worker_device_기관 on public.worker_device
  for all using (org_id = public.my_org()) with check (org_id = public.my_org());

create policy job_기관 on public.job
  for all using (org_id = public.my_org()) with check (org_id = public.my_org());

create policy report_기관 on public.report
  for all using (org_id = public.my_org()) with check (org_id = public.my_org());

create policy photo_기관 on public.photo
  for all using (org_id = public.my_org()) with check (org_id = public.my_org());

-- 휴대폰 — 자기 할 일만 읽고, 자기 보고만 올립니다
create policy job_폰 on public.job
  for select using (worker_id = public.my_worker());

create policy report_폰 on public.report
  for insert with check (worker_id = public.my_worker());

create policy photo_폰 on public.photo
  for insert with check (
    exists (select 1 from public.report r
             where r.id = report_id and r.worker_id = public.my_worker()));

create policy worker_device_폰 on public.worker_device
  for select using (user_id = auth.uid());

-- enroll_token 은 어느 누구도 직접 못 읽습니다. 아래 함수로만 씁니다.

-- ============================================================
--  7. 기기 등록 — 일회용 표를 내면 그 폰이 그 인력이 됩니다
-- ============================================================
create or replace function public.register_device(token text)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  h text := encode(digest(token, 'sha256'), 'hex');
  t public.enroll_token%rowtype;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  select * into t from public.enroll_token
   where token_hash = h and used_at is null and expires_at > now()
   for update;

  if not found then
    raise exception '등록표가 없거나 이미 썼거나 기한이 지났습니다';
  end if;

  insert into public.worker_device (user_id, worker_id, org_id)
       values (auth.uid(), t.worker_id, t.org_id)
  on conflict (user_id) do update
       set worker_id = excluded.worker_id,
           org_id    = excluded.org_id,
           registered_at = now();

  update public.enroll_token set used_at = now() where token_hash = h;
  return t.worker_id;
end $$;

-- ============================================================
--  8. 기한 지난 것 쓸어내기 — 기관 PC 가 매일 한 번 부릅니다
-- ============================================================
create or replace function public.sweep_expired()
returns table (지운표 text, 개수 bigint)
language plpgsql security definer set search_path = public, extensions as $$
declare n bigint;
begin
  delete from public.photo  where expires_at < now(); get diagnostics n = row_count;
  지운표 := 'photo';  개수 := n; return next;
  delete from public.report where expires_at < now(); get diagnostics n = row_count;
  지운표 := 'report'; 개수 := n; return next;
  delete from public.job    where expires_at < now(); get diagnostics n = row_count;
  지운표 := 'job';    개수 := n; return next;
  delete from public.enroll_token where expires_at < now(); get diagnostics n = row_count;
  지운표 := 'enroll_token'; 개수 := n; return next;
end $$;

-- ============================================================
--  9. 문 열어 주기
--     프로젝트를 만들 때 「Automatically expose new tables」를 껐으므로
--     여기서 필요한 것만 하나씩 열어 줍니다.
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
  on public.org, public.org_member, public.worker, public.worker_device,
     public.job, public.report, public.photo
  to authenticated;

-- enroll_token 은 아무에게도 주지 않습니다 (함수만 만집니다)
revoke all on public.enroll_token from anon, authenticated;

grant execute on function public.register_device(text) to authenticated;
grant execute on function public.sweep_expired()       to authenticated;
grant execute on function public.my_org()              to authenticated;
grant execute on function public.my_worker()           to authenticated;

-- 익명(anon)에게는 아무 표도 주지 않습니다.
-- 휴대폰도 로그인(authenticated) 뒤에야 무엇이든 만집니다.
