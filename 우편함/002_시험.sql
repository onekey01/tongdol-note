-- ============================================================
--  우편함 시험 — 진짜 Postgres 에 넣고 확인합니다.
--
--    1. 사람 정보를 담는 칸이 하나도 없나
--    2. 남의 기관 것이 보이나  ← 여기가 생명줄
--    3. 남의 인력 할 일이 보이나
--    4. 퇴사시키면 바로 막히나
--    5. 등록표는 딱 한 번만 쓰이나
--    6. 기한 지난 것이 쓸려 나가나
-- ============================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

create or replace function 확인(무엇 text, 실제 anyelement, 바람 anyelement)
returns void language plpgsql as $$
begin
  if 실제 is not distinct from 바람 then
    raise notice '  통과  %  (%)', 무엇, 실제;
  else
    raise exception 'X 실패  %  — 나온 것 % / 바란 것 %', 무엇, 실제, 바람;
  end if;
end $$;

-- ── 시험 마당 ──────────────────────────────────────────────
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),   -- 가 기관 PC
  ('22222222-2222-2222-2222-222222222222'),   -- 나 기관 PC
  ('33333333-3333-3333-3333-333333333333'),   -- 가 기관 인력의 폰
  ('44444444-4444-4444-4444-444444444444')    -- 가 기관 다른 인력의 폰
on conflict do nothing;

insert into public.org (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '가 복지관'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '나 복지관');

insert into public.org_member (user_id, org_id) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001'),
  ('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000002');

insert into public.worker (id, org_id) values
  ('a0000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-00000000000c','bbbbbbbb-0000-0000-0000-000000000002');

insert into public.worker_device (user_id, worker_id, org_id) values
  ('33333333-3333-3333-3333-333333333333','a0000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001'),
  ('44444444-4444-4444-4444-444444444444','a0000000-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001');

insert into public.job (id, org_id, worker_id, served_on, payload_enc) values
  ('c0000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a', current_date, 'ENC-가1'),
  ('c0000000-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000b', current_date, 'ENC-가2'),
  ('c0000000-0000-0000-0000-00000000000c','bbbbbbbb-0000-0000-0000-000000000002','b0000000-0000-0000-0000-00000000000c', current_date, 'ENC-나1');

-- ── 1. 사람 정보 칸이 있나 ─────────────────────────────────
do $$
declare 샌칸 text;
begin
  select string_agg(table_name || '.' || column_name, ', ')
    into 샌칸
    from information_schema.columns
   where table_schema = 'public'
     and table_name in ('worker','worker_device','job','report','photo','enroll_token')
     and (column_name ~* '(name|addr|phone|birth|resident|ssn|tel|email)');
  perform 확인('사람 정보를 담는 칸', coalesce(샌칸, '없음'), '없음');
end $$;

-- ── 1-2. 권한이 제대로 잠겼나 ──────────────────────────────
--
--  ★ 이 확인은 **여기서** 해야 합니다 ★
--  Supabase 에 개발 열쇠(service_role)로 물어보면 권한을 다 무시하고
--  모든 표를 보여 줍니다. 그러니 「감춰졌나」는 밖에서 물을 수 없습니다.
--  규칙이 사는 자리인 데이터베이스에서 직접 봅니다.
--
do $$
declare 샌것 text;
begin
  -- enroll_token 은 아무에게도 주지 않았어야 합니다 (함수만 만집니다)
  select string_agg(distinct grantee, ', ')
    into 샌것
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'enroll_token'
     and grantee in ('anon','authenticated');
  perform 확인('enroll_token 을 만질 수 있는 사람', coalesce(샌것,'없음'), '없음');

  -- 로그인 안 한 손님(anon)은 어느 표도 못 만져야 합니다
  select string_agg(distinct table_name, ', ')
    into 샌것
    from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon';
  perform 확인('anon 이 만질 수 있는 표', coalesce(샌것,'없음'), '없음');

  -- 나머지 일곱 개는 로그인한 사람에게 열려 있어야 합니다
  perform 확인('authenticated 에게 열린 표 수',
    (select count(distinct table_name) from information_schema.role_table_grants
      where table_schema='public' and grantee='authenticated'), 7::bigint);

  /*
   * 개발 열쇠(service_role)에게도 일곱 개가 열려 있어야 합니다.
   * service_role 은 RLS 만 건너뛰고 GRANT 는 안 건너뜁니다 —
   * 이걸 몰라서 「기관 만들기」가 403 으로 막혔습니다.
   */
  perform 확인('service_role 에게 열린 표 수',
    (select count(distinct table_name) from information_schema.role_table_grants
      where table_schema='public' and grantee='service_role'), 7::bigint);

  /*
   * enroll_token 은 개발 열쇠에게도 안 열려 있어야 합니다.
   * 표 주인(postgres)은 제 표에 권한이 있는 게 당연하므로 빼고 봅니다 —
   * 밖에서 들어오는 역할 셋만이 관심사입니다.
   */
  select string_agg(distinct grantee, ', ') into 샌것
    from information_schema.role_table_grants
   where table_schema='public' and table_name='enroll_token'
     and grantee in ('anon','authenticated','service_role');
  perform 확인('enroll_token 을 만질 수 있는 역할', coalesce(샌것,'없음'), '없음');
end $$;

-- ── 2. 남의 기관 것이 보이나 ───────────────────────────────
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- 가 기관 PC
do $$ begin
  perform 확인('가 기관 PC 가 보는 할 일 수', (select count(*) from public.job), 2::bigint);
  perform 확인('가 기관 PC 가 보는 기관 수', (select count(*) from public.org), 1::bigint);
  perform 확인('가 기관 PC 가 보는 인력 수', (select count(*) from public.worker), 2::bigint);
end $$;

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';   -- 나 기관 PC
do $$ begin
  perform 확인('나 기관 PC 가 보는 할 일 수', (select count(*) from public.job), 1::bigint);
  perform 확인('나 기관 PC 에 가 기관 것이 보이나',
               (select count(*) from public.job where payload_enc like 'ENC-가%'), 0::bigint);
end $$;

-- ── 3. 남의 인력 할 일이 보이나 ────────────────────────────
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';   -- 가 기관 인력1 폰
do $$ begin
  perform 확인('폰이 보는 할 일 수', (select count(*) from public.job), 1::bigint);
  perform 확인('폰이 보는 것이 제 것인가',
               (select payload_enc from public.job), 'ENC-가1');
  perform 확인('같은 기관 동료 것이 보이나',
               (select count(*) from public.job where payload_enc = 'ENC-가2'), 0::bigint);
  perform 확인('폰이 기관 표를 볼 수 있나', (select count(*) from public.org), 0::bigint);
end $$;

-- 폰이 남의 이름으로 보고를 올릴 수 있나 (막혀야 합니다)
do $$
declare 막혔나 boolean := false;
begin
  begin
    insert into public.report (id, job_id, org_id, worker_id, payload_enc)
    values (gen_random_uuid(),'c0000000-0000-0000-0000-00000000000b',
            'aaaaaaaa-0000-0000-0000-000000000001',
            'a0000000-0000-0000-0000-00000000000b','몰래');
  exception when others then 막혔나 := true;
  end;
  perform 확인('남의 이름으로 보고 올리기', 막혔나, true);
end $$;

-- 제 보고는 올라가야 합니다
do $$ begin
  insert into public.report (id, job_id, org_id, worker_id, started_at, ended_at, qr_ok, payload_enc)
  values ('d0000000-0000-0000-0000-00000000000a','c0000000-0000-0000-0000-00000000000a',
          'aaaaaaaa-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a',
          now() - interval '1 hour', now(), true, 'ENC-보고1');
  perform 확인('제 보고 올리기', true, true);
end $$;

-- ── 4. 퇴사시키면 바로 막히나 ──────────────────────────────
reset role;
update public.worker set active = false where id = 'a0000000-0000-0000-0000-00000000000a';
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$ begin
  perform 확인('퇴사한 인력이 보는 할 일 수', (select count(*) from public.job), 0::bigint);
end $$;
reset role;
update public.worker set active = true where id = 'a0000000-0000-0000-0000-00000000000a';

-- ── 5. 등록표는 한 번만 ────────────────────────────────────
insert into auth.users (id) values ('55555555-5555-5555-5555-555555555555') on conflict do nothing;
insert into public.enroll_token (token_hash, org_id, worker_id, expires_at)
values (encode(extensions.digest('표-1234','sha256'),'hex'),
        'aaaaaaaa-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-00000000000a', now() + interval '1 hour');

set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$ begin
  perform 확인('등록표 한 번째',
    public.register_device('표-1234', repeat('P', 88)),
    'a0000000-0000-0000-0000-00000000000a'::uuid);
end $$;
do $$
declare 막혔나 boolean := false;
begin
  begin perform public.register_device('표-1234', repeat('P', 88));
  exception when others then 막혔나 := true; end;
  perform 확인('등록표 두 번째는 막힘', 막혔나, true);
end $$;
do $$
declare 막혔나 boolean := false;
begin
  begin perform public.register_device('아무거나', repeat('P', 88));
  exception when others then 막혔나 := true; end;
  perform 확인('없는 등록표는 막힘', 막혔나, true);

  -- 공개쪽 없이 등록하면 막아야 합니다 — 열쇠를 건넬 길이 없으니까요
  막혔나 := false;
  begin perform public.register_device('표-1234', '');
  exception when others then 막혔나 := true; end;
  perform 확인('공개쪽 없이 등록은 막힘', 막혔나, true);
end $$;

-- ── 5-2. 등록표 만들기 함수 ────────────────────────────────
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- 가 기관 PC
do $$
declare 막혔나 boolean;
begin
  -- 제 기관 인력에게는 만들 수 있어야 합니다
  perform public.make_enroll_token('a0000000-0000-0000-0000-00000000000b',
            repeat('a', 64), 15);
  perform 확인('제 기관 인력에게 표 만들기', true, true);

  -- 남의 기관 인력에게는 못 만들어야 합니다  ← 여기가 핵심
  막혔나 := false;
  begin
    perform public.make_enroll_token('b0000000-0000-0000-0000-00000000000c',
              repeat('b', 64), 15);
  exception when others then 막혔나 := true; end;
  perform 확인('남의 기관 인력에게 표 만들기', 막혔나, true);

  -- 해시 모양이 아니면 막아야 합니다
  막혔나 := false;
  begin
    perform public.make_enroll_token('a0000000-0000-0000-0000-00000000000b', '짧다', 15);
  exception when others then 막혔나 := true; end;
  perform 확인('엉뚱한 해시는 막힘', 막혔나, true);
end $$;

-- 기관 PC 라도 enroll_token 을 직접은 못 봐야 합니다
do $$
declare 막혔나 boolean := false;
begin
  begin perform count(*) from public.enroll_token;
  exception when others then 막혔나 := true; end;
  perform 확인('기관 PC 도 등록표를 직접은 못 봄', 막혔나, true);
end $$;
reset role;

-- ── 5-3. 열쇠 싸서 건네기 (005) ────────────────────────────
reset role;
-- 새 폰 하나가 등록했다고 칩니다
insert into auth.users (id) values ('66666666-6666-6666-6666-666666666666')
  on conflict do nothing;
insert into public.enroll_token (token_hash, org_id, worker_id, expires_at)
values (encode(extensions.digest('표-싸기','sha256'),'hex'),
        'aaaaaaaa-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-00000000000b', now() + interval '1 hour');

set role authenticated;
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';   -- 새 폰
do $$ begin
  perform public.register_device('표-싸기', repeat('Q', 88));
  perform 확인('새 폰이 공개쪽과 함께 등록', true, true);
end $$;

-- 기관 PC 가 「아직 못 건넨 기기」를 봅니다
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';   -- 가 기관 PC
do $$
declare 있나 boolean;
begin
  /*
   * 세는 대신 **누가 대기 중인가**를 봅니다.
   * 앞 절에서 등록한 폰도 아직 대기라 「몇 개」로는 뜻이 흐려집니다.
   */
  select exists (select 1 from public.pending_devices()
                  where worker_id = 'a0000000-0000-0000-0000-00000000000b')
    into 있나;
  perform 확인('새 폰이 대기 목록에 있음', 있나, true);

  -- 공개쪽도 같이 나와야 기관 PC 가 쌀 수 있습니다
  select exists (select 1 from public.pending_devices()
                  where worker_id = 'a0000000-0000-0000-0000-00000000000b'
                    and pub_key = repeat('Q', 88))
    into 있나;
  perform 확인('대기 목록에 공개쪽이 실려 나옴', 있나, true);

  -- 싼 열쇠를 넣습니다
  update public.worker_device
     set wrapped_key = 'w1.가짜.가짜.가짜', wrapped_at = now()
   where worker_id = 'a0000000-0000-0000-0000-00000000000b';

  select exists (select 1 from public.pending_devices()
                  where worker_id = 'a0000000-0000-0000-0000-00000000000b')
    into 있나;
  perform 확인('건네고 나면 대기에서 빠짐', 있나, false);
end $$;

-- 남의 기관 PC 는 이 대기 기기를 못 봐야 합니다
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';   -- 나 기관 PC
do $$
declare n bigint;
begin
  select count(*) into n from public.pending_devices();
  perform 확인('남의 기관 PC 가 보는 대기 기기 수', n, 0::bigint);
end $$;

-- 폰은 제 싼 열쇠만 봅니다
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
do $$
declare n bigint; k text;
begin
  select count(*) into n from public.worker_device;
  perform 확인('폰이 보는 기기 줄 수', n, 1::bigint);
  select wrapped_key into k from public.worker_device;
  perform 확인('제 싼 열쇠를 읽음', k, 'w1.가짜.가짜.가짜');
end $$;

-- 다른 폰은 남의 싼 열쇠를 못 봐야 합니다  ★
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
declare k text;
begin
  select wrapped_key into k from public.worker_device
   where worker_id = 'a0000000-0000-0000-0000-00000000000b';
  perform 확인('남의 싼 열쇠가 보이나', coalesce(k, '안 보임'), '안 보임');
end $$;
reset role;

-- ── 6. 기한 지난 것 쓸어내기 ───────────────────────────────
reset role;
update public.job    set expires_at = now() - interval '1 day' where id = 'c0000000-0000-0000-0000-00000000000b';
update public.report set expires_at = now() - interval '1 day';
do $$
declare 남은job bigint; 남은rep bigint;
begin
  perform public.sweep_expired();
  select count(*) into 남은job from public.job;
  select count(*) into 남은rep from public.report;
  perform 확인('기한 지난 할 일이 쓸렸나', 남은job, 2::bigint);
  perform 확인('기한 지난 보고가 쓸렸나', 남은rep, 0::bigint);
end $$;

do $$ begin raise notice ''; raise notice '  === 우편함 시험 전부 통과 ==='; end $$;
