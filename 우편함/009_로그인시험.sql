-- ============================================================
--  계정 로그인 시험 — 진짜 Postgres 에 넣고 확인합니다.
--
--    1. 새 폰이 **기관 목록**을 볼 수 있나 (골라야 하니까)
--    2. 그래도 **어르신에 관한 것은 한 줄도** 못 보나
--    3. 폰이 자기 로그인 요청을 **낼 수 있나**
--    4. ★ **남이 낸 요청은 못 보나**  ← 여기가 생명줄
--    5. ★ **남의 폰 이름으로는 못 내나**
--    6. 기관 PC 가 **자기 기관에 온 것만** 보나
--    7. ★ **남의 기관에 온 요청은 한 줄도 안 보이나**
--    8. 기한이 지난 요청이 쓸려 나가나
--
--  ── 왜 이렇게까지 하나 ────────────────────────────────────
--
--  이 표에는 **비밀번호가 든 덩어리**가 지나갑니다. 잠겨 있다고는 해도,
--  남이 그것을 가져갈 수 있으면 안 됩니다. 그리고 답(기관 열쇠를 싼 것)을
--  엉뚱한 폰이 집어 가면 **그 기관의 모든 어르신 자료가 열립니다.**
--
--  「규칙을 적어 두었다」로는 부족합니다. **규칙이 사는 자리에서**
--  실제로 막히는지 봐야 합니다.
--
--  돌리는 법 (개발 PC 에서, Supabase 가 아니라 맨 Postgres):
--    psql -f 000_밑준비.sql -f 001_기틀.sql -f 003 -f 004 -f 005
--         -f 006_사진칸.sql -f 008_계정로그인.sql -f 009_로그인시험.sql
-- ============================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

create or replace function 확인2(무엇 text, 실제 anyelement, 바람 anyelement)
returns void language plpgsql as $$
begin
  if 실제 is not distinct from 바람 then
    raise notice '  통과  %  (%)', 무엇, 실제;
  else
    raise exception 'X 실패  %  — 나온 것 % / 바란 것 %', 무엇, 실제, 바람;
  end if;
end $$;

-- ── 시험 마당 ──────────────────────────────────────────────
--
--  ★ 먼저 치웁니다. 앞 실행이 중간에 멎으면 요청 한 줄이 남고,
--    그러면 다음 실행이 「안 보여야 하는데 1이 보인다」로 **헛실패**합니다.
--    시험은 몇 번을 돌려도 같은 답이 나와야 합니다.
delete from public.device_request;

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),   -- 가 기관 PC
  ('22222222-2222-2222-2222-222222222222'),   -- 나 기관 PC
  ('44444444-4444-4444-4444-444444444444'),   -- 갑의 새 폰 (아직 등록 안 됨)
  ('55555555-5555-5555-5555-555555555555')    -- 아무 폰 (남)
on conflict do nothing;

insert into public.org (id, name, pub_key) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '가 복지관', 'PUBKEY-가'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '나 복지관', 'PUBKEY-나')
on conflict (id) do update set pub_key = excluded.pub_key;

insert into public.org_member (user_id, org_id) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001'),
  ('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000002')
on conflict do nothing;

insert into public.worker (id, org_id) values
  ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001')
on conflict do nothing;

-- 갑 인력의 **옛 폰** — 새 폰이 이기면 이것이 끊겨야 합니다.
insert into auth.users (id) values ('66666666-6666-6666-6666-666666666666')
on conflict do nothing;
insert into public.worker_device (user_id, worker_id, org_id) values
  ('66666666-6666-6666-6666-666666666666',
   'cccccccc-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001')
on conflict do nothing;

-- ══ 1·2. 새 폰이 기관을 고를 수 있나 ══════════════════════
do $$ begin raise notice ''; raise notice '── 1. 새 폰이 기관을 고릅니다 ──'; end $$;
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

  select 확인2('★ 기관 목록이 보임 (골라야 하니까)',
    (select count(*)::int from public.org), 2);
  select 확인2('★ 기관 공개열쇠도 보임 (이걸로 싸야 하니까)',
    (select pub_key from public.org where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
    'PUBKEY-가');

  /*
   * ★ 여기가 중요합니다 — 기관 목록을 열어 준 대가로 **다른 것까지
   *   열리면 안 됩니다.** 등록 안 된 폰은 my_worker() 가 비어 있어
   *   할 일도 보고도 한 줄도 안 보여야 합니다.
   */
  select 확인2('★ 그래도 할 일은 한 줄도 안 보임',
    (select count(*)::int from public.job), 0);
  select 확인2('★ 인력 목록도 안 보임',
    (select count(*)::int from public.worker), 0);
  select 확인2('★ 남의 기기 등록도 안 보임',
    (select count(*)::int from public.worker_device), 0);
commit;

-- ══ 3·4·5. 요청을 내고, 남의 것은 못 보고 ════════════════
do $$ begin raise notice ''; raise notice '── 2. 로그인 요청 ──'; end $$;
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

  insert into public.device_request (id, org_id, device_user_id, asked_enc)
  values ('dddddddd-0000-0000-0000-000000000001',
          'aaaaaaaa-0000-0000-0000-000000000001',
          '44444444-4444-4444-4444-444444444444',
          '잠긴-아이디와-비밀번호');
  select 확인2('★ 자기 요청을 낼 수 있음',
    (select count(*)::int from public.device_request), 1);
  select 확인2('처음에는 기다림', (select status from public.device_request
    where id = 'dddddddd-0000-0000-0000-000000000001'), '기다림');

  /*
   * ★ **남의 폰 이름으로는 못 냅니다.**
   *   이걸 막지 않으면, 남이 내 이름으로 요청을 내고 답(기관 열쇠를
   *   싼 것)을 가로챌 수 있습니다.
   */
  do $x$ begin
    insert into public.device_request (org_id, device_user_id, asked_enc)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            '55555555-5555-5555-5555-555555555555', '가짜');
    raise exception 'X 실패  ★ 남의 폰 이름으로 요청이 들어갔습니다';
  exception when insufficient_privilege then
    raise notice '  통과  ★ 남의 폰 이름으로는 못 냄';
  end $x$;
commit;

do $$ begin raise notice ''; raise notice '── 3. 남이 낸 요청은 못 봅니다 ──'; end $$;
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
  select 확인2('★ 남이 낸 요청은 한 줄도 안 보임',
    (select count(*)::int from public.device_request), 0);
commit;

-- ══ 6·7. 기관 PC 쪽 ══════════════════════════════════════
do $$ begin raise notice ''; raise notice '── 4. 기관 PC 는 자기 것만 ──'; end $$;
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
  select 확인2('★ 자기 기관에 온 요청이 보임',
    (select count(*)::int from public.device_request), 1);

  -- 답을 채웁니다 — 이것이 「열쇠를 내주는」 일입니다.
  update public.device_request
     set answer_enc = '폰공개쪽으로-싼-기관열쇠',
         worker_id  = 'cccccccc-0000-0000-0000-000000000001',
         status     = '됨'
   where id = 'dddddddd-0000-0000-0000-000000000001';
  select 확인2('답을 채울 수 있음',
    (select status from public.device_request
      where id = 'dddddddd-0000-0000-0000-000000000001'), '됨');
commit;

do $$ begin raise notice ''; raise notice '── 5. 남의 기관 PC 는 못 봅니다 ──'; end $$;
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
  select 확인2('★ 남의 기관에 온 요청은 한 줄도 안 보임',
    (select count(*)::int from public.device_request), 0);
commit;

do $$ begin raise notice ''; raise notice '── 6. 낸 폰만 답을 봅니다 ──'; end $$;
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
  select 확인2('★ 낸 폰은 답을 받아 감',
    (select answer_enc from public.device_request
      where id = 'dddddddd-0000-0000-0000-000000000001'),
    '폰공개쪽으로-싼-기관열쇠');
commit;

begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
  select 확인2('★ 남의 폰은 답을 못 가져감',
    (select count(*)::int from public.device_request
      where id = 'dddddddd-0000-0000-0000-000000000001'), 0);
commit;

-- ══ 8. 폰이 제 요청을 못 고치나 (010) ★ ═════════════════
do $$ begin raise notice ''; raise notice '── 8. 폰은 요청을 못 고칩니다 ★ ──'; end $$;
/*
 * ★ 008 은 폰 정책을 `for all` 로 두었습니다. 그래서 폰이 답이 달린
 *   줄을 다시 '기다림' 으로 되돌려 **줄 하나로 비밀번호를 무한히**
 *   맞춰 볼 수 있었습니다. 010 이 넣기·읽기로 쪼갰습니다.
 */
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

  -- 답이 달린 줄을 되돌리려 해 봅니다.
  update public.device_request
     set status = '기다림', asked_enc = '다시-맞춰보려는-것'
   where id = 'dddddddd-0000-0000-0000-000000000001';
  select 확인2('★ 폰은 제 요청을 못 고친다',
    (select status from public.device_request
      where id = 'dddddddd-0000-0000-0000-000000000001'), '됨');

  -- 지우지도 못합니다.
  delete from public.device_request
   where id = 'dddddddd-0000-0000-0000-000000000001';
  select 확인2('★ 폰은 제 요청을 못 지운다',
    (select count(*)::int from public.device_request
      where id = 'dddddddd-0000-0000-0000-000000000001'), 1);

  -- 넣을 때 사무실 칸을 미리 채우지도 못합니다.
  do $x$ begin
    insert into public.device_request (org_id, device_user_id, asked_enc, status, answer_enc)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            '44444444-4444-4444-4444-444444444444', '싼것', '됨', '내가-지은-답');
    raise exception 'X 실패  ★ 폰이 status/answer_enc 를 미리 채워 넣었습니다';
  exception when insufficient_privilege then
    raise notice '  통과  ★ 폰은 답 칸을 미리 못 채운다';
  end $x$;

  -- 기한을 멀리 잡아 비밀번호 덩어리를 눌러앉히지도 못합니다.
  do $x$ begin
    insert into public.device_request (org_id, device_user_id, asked_enc, expires_at)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            '44444444-4444-4444-4444-444444444444', '싼것', now() + interval '10 years');
    raise exception 'X 실패  ★ 폰이 기한을 10년으로 잡았습니다';
  exception when insufficient_privilege then
    raise notice '  통과  ★ 폰은 기한을 멀리 못 잡는다 (비밀번호 덩어리입니다)';
  end $x$;
commit;

-- ══ 9. 기한이 지나면 쓸려 나가나 ═════════════════════════
do $$ begin raise notice ''; raise notice '── 9. 기한이 지난 요청 ──'; end $$;
update public.device_request set expires_at = now() - interval '1 minute';
do $$
declare n bigint;
begin
  perform public.sweep_expired();
  select count(*) into n from public.device_request;
  perform 확인2('★ 기한이 지난 요청이 쓸려 나감 (비밀번호가 든 덩어리입니다)',
    n::int, 0);
end $$;

do $$ begin raise notice ''; raise notice '  다 통과했습니다.'; raise notice ''; end $$;
