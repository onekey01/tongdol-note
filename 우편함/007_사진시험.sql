-- ============================================================
--  사진 자리 시험 — 진짜 Postgres 에 넣고 확인합니다.
--
--    1. 사진 통이 **비공개**인가 (주소만 알아도 못 받는가)
--    2. 폰이 **자기 기관 자리에만** 올릴 수 있나
--    3. ★ 폰이 **남의 기관 자리에** 못 올리나  ← 여기가 생명줄
--    4. 기관 PC 가 **자기 것만** 보나
--    5. ★ 남의 기관 사진이 **한 장도 안 보이나**
--    6. 폰은 사진을 **못 읽나** (올리기만)
--    7. 기한이 지나면 **파일까지** 쓸려 나가나
--
--  ── 왜 이렇게까지 하나 ────────────────────────────────────
--
--  사진에는 어르신 댁 안이 찍힙니다. 밥상, 방, 때로는 얼굴이.
--  이것이 남의 기관에 한 장이라도 새면 그것으로 끝입니다.
--  「규칙을 적어 두었다」로는 부족하고, **규칙이 사는 자리에서**
--  실제로 막히는지 봐야 합니다.
--
--  돌리는 법 (개발 PC 에서, Supabase 가 아니라 맨 Postgres):
--    psql -f 000_밑준비.sql -f 001_기틀.sql -f 003 -f 004 -f 005
--         -f 006_사진칸.sql -f 007_사진시험.sql
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
  ('33333333-3333-3333-3333-333333333333')    -- 가 기관 인력의 폰
on conflict do nothing;

insert into public.org (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '가 복지관'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '나 복지관')
on conflict do nothing;

insert into public.org_member (user_id, org_id) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001'),
  ('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000002')
on conflict do nothing;

insert into public.worker (id, org_id) values
  ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001')
on conflict do nothing;

insert into public.worker_device (user_id, worker_id, org_id) values
  ('33333333-3333-3333-3333-333333333333',
   'cccccccc-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001')
on conflict do nothing;

/*
 * 보고를 걸 할 일 한 줄.
 *
 * ★ 이것이 없으면 7번(쓸어내기)이 **조용히 건너뜁니다.**
 *   건너뛴 시험은 통과가 아닙니다 — 처음 돌렸을 때 실제로 건너뛰었고,
 *   그대로 두었으면 「사진 파일이 안 지워지는 것」을 못 봤을 것입니다.
 */
insert into public.job (id, org_id, worker_id, served_on, payload_enc)
values ('99999999-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000001',
        current_date, 'x')
on conflict do nothing;

-- 나 복지관에도 사진이 한 장 있습니다 (남의 것이 안 보이는지 보려고)
insert into storage.objects (bucket_id, name)
values ('사진', 'bbbbbbbb-0000-0000-0000-000000000002/보고1/사진1');

-- ============================================================
do $$
declare n bigint; b boolean; 막혔나 boolean;
begin
raise notice '';
raise notice '── 1. 통이 비공개인가 ──────────────────────────────';
select public into b from storage.buckets where id = '사진';
perform 확인('사진 통이 비공개', b, false);

raise notice '';
raise notice '── 2·3. 폰이 어디에 올릴 수 있나 ───────────────────';
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

-- 자기 기관 자리 — 되어야 합니다
insert into storage.objects (bucket_id, name)
values ('사진', 'aaaaaaaa-0000-0000-0000-000000000001/보고9/사진9');
perform 확인('폰이 자기 기관 자리에 올림', true, true);

-- ★ 남의 기관 자리 — 막혀야 합니다
막혔나 := false;
begin
  insert into storage.objects (bucket_id, name)
  values ('사진', 'bbbbbbbb-0000-0000-0000-000000000002/몰래/사진');
exception when insufficient_privilege or others then
  막혔나 := true;
end;
perform 확인('★ 폰이 남의 기관 자리에 못 올림', 막혔나, true);

raise notice '';
raise notice '── 6. 폰은 사진을 못 읽는가 ────────────────────────';
select count(*) into n from storage.objects where bucket_id = '사진';
perform 확인('폰에게 보이는 사진 (읽기 권한 없음)', n, 0::bigint);

reset role;
reset request.jwt.claim.sub;

raise notice '';
raise notice '── 4·5. 기관 PC 가 무엇을 보는가 ───────────────────';
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) into n from storage.objects where bucket_id = '사진';
perform 확인('가 복지관에게 보이는 사진', n, 1::bigint);

select count(*) into n from storage.objects
 where bucket_id = '사진'
   and name like 'bbbbbbbb-0000-0000-0000-000000000002/%';
perform 확인('★ 남의 기관 사진이 보이나', n, 0::bigint);
reset role;
reset request.jwt.claim.sub;

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) into n from storage.objects where bucket_id = '사진';
perform 확인('나 복지관에게 보이는 사진', n, 1::bigint);
reset role;
reset request.jwt.claim.sub;

raise notice '';
raise notice '── 7. 기한이 지나면 파일까지 쓸려 나가나 ───────────';
insert into public.report (id, job_id, org_id, worker_id, payload_enc, expires_at)
select 'dddddddd-0000-0000-0000-000000000001',
       j.id, 'aaaaaaaa-0000-0000-0000-000000000001',
       'cccccccc-0000-0000-0000-000000000001', 'x', now() - interval '1 day'
  from (select id from public.job limit 1) j
 where exists (select 1 from public.job);

if exists (select 1 from public.report
            where id = 'dddddddd-0000-0000-0000-000000000001') then
  insert into public.photo (id, report_id, org_id, path, expires_at)
  values ('eeeeeeee-0000-0000-0000-000000000001',
          'dddddddd-0000-0000-0000-000000000001',
          'aaaaaaaa-0000-0000-0000-000000000001',
          'aaaaaaaa-0000-0000-0000-000000000001/보고9/사진9',
          now() - interval '1 day');

  perform public.sweep_expired();

  select count(*) into n from storage.objects
   where name = 'aaaaaaaa-0000-0000-0000-000000000001/보고9/사진9';
  perform 확인('★ 기한 지난 사진 파일이 지워짐', n, 0::bigint);

  select count(*) into n from public.photo
   where id = 'eeeeeeee-0000-0000-0000-000000000001';
  perform 확인('사진 표도 지워짐', n, 0::bigint);
else
  raise exception 'X 실패  쓸어내기 시험을 못 돌렸습니다 (보고가 안 만들어짐)';
end if;

raise notice '';
raise notice '  ────────────────────────────────────────────';
raise notice '  사진 시험 전부 통과';
raise notice '';
end $$;
