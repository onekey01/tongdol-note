-- ============================================================
--  통돌 Note — 우편함 006 : 사진을 둘 자리
--
--  무엇을 하는 것인가 —
--    편람은 서비스 제공 뒤 **사진을 서식 뒷장에 붙이라**고 합니다.
--    식사지원의 전달사진이 대표입니다. 지금까지는 제공인력이 카카오톡으로
--    보내고 사무실이 손으로 내려받아 붙였습니다.
--
--    사진은 글보다 훨씬 큽니다. 그래서 표(row) 안에 넣지 않고
--    **Storage** 에 파일로 둡니다. 표에는 「어디에 있는가」만 적습니다
--    (public.photo — 001 에서 이미 만들어 두었습니다).
--
--  ★ 사진도 잠겨서 올라갑니다 ★
--    올리는 것은 사진 파일이 아니라 **AES 로 잠근 덩어리**입니다.
--    Supabase 도, 그 서버를 만지는 누구도 어르신 댁 안을 못 봅니다.
--    기관 PC 의 열쇠로만 풀립니다. 우리 스스로도 못 보는 것이 맞습니다.
--
--  ── 왜 원본을 안 보내나 ────────────────────────────────────
--    요즘 폰 사진은 한 장에 3~6MB 입니다. 하루 스무 건이면 100MB,
--    한 달이면 3GB 입니다. 무료 등급 저장공간(1GB)을 한 주에 채웁니다.
--    그리고 제공인력의 **데이터 요금**으로 올라갑니다.
--    앱이 긴 쪽 1600픽셀로 줄여서 보냅니다 — 원본은 폰 갤러리에 남습니다.
--
--  005 까지 실행하셨다면 이 파일만 더 붙여넣으시면 됩니다.
-- ============================================================

-- ── 1. 사진을 담을 통 ────────────────────────────────────────
-- public = false : 주소를 알아도 로그인 없이는 못 받습니다.
insert into storage.buckets (id, name, public, file_size_limit)
values ('사진', '사진', false, 8388608)          -- 한 장 8MB 까지
on conflict (id) do update
   set public = false, file_size_limit = 8388608;

-- ── 2. 길 모양 ───────────────────────────────────────────────
--   <기관번호>/<보고번호>/<사진번호>
--
-- 맨 앞이 기관번호인 까닭 — 아래 규칙이 **첫 칸만 보고** 남의 기관 것을
-- 막을 수 있습니다. 길에 사람 이름이나 날짜를 넣지 않습니다.
-- 주소는 로그에 남고, 로그는 우리가 못 지웁니다.

-- ── 3. 누가 무엇을 할 수 있나 ────────────────────────────────
drop policy if exists 사진_폰올리기 on storage.objects;
drop policy if exists 사진_기관읽기 on storage.objects;
drop policy if exists 사진_기관지우기 on storage.objects;

/*
 * 휴대폰 — **올리기만** 합니다.
 *
 * 읽기를 안 주는 까닭: 폰이 남의 사진을 받아 볼 이유가 없습니다.
 * 자기가 방금 올린 것도 다시 받을 일이 없습니다 — 원본은 갤러리에 있습니다.
 *
 * 첫 칸(기관번호)이 **그 폰이 속한 기관**과 같아야 합니다.
 */
create policy 사진_폰올리기 on storage.objects
  for insert to authenticated
  with check (
    bucket_id = '사진'
    and (storage.foldername(name))[1] = (
      select d.org_id::text from public.worker_device d
       where d.user_id = auth.uid()
    )
  );

/*
 * 기관 PC — 읽고 지웁니다.
 *
 * 받아서 자료함에 넣은 뒤에는 **반드시 지웁니다.**
 * 남의 서버에 어르신 댁 사진을 오래 두지 않는다는 것이 이 물건의 약속입니다.
 */
create policy 사진_기관읽기 on storage.objects
  for select to authenticated
  using (
    bucket_id = '사진'
    and (storage.foldername(name))[1] = public.my_org()::text
  );

create policy 사진_기관지우기 on storage.objects
  for delete to authenticated
  using (
    bucket_id = '사진'
    and (storage.foldername(name))[1] = public.my_org()::text
  );

-- ── 4. 기한 지난 것 쓸어내기에 사진도 넣습니다 ───────────────
/*
 * 001 의 sweep_expired 는 표만 치웠습니다. 표를 지우면 photo 줄은
 * 따라 사라지지만 **Storage 의 파일은 남습니다.** 그것이 쌓이면
 * 무료 등급이 어느 날 갑자기 막힙니다.
 *
 * 그래서 표를 지우기 **전에** 파일부터 지웁니다.
 */
-- 001 의 것과 **돌려주는 모양이 같아야** 바꿔 낄 수 있습니다.
-- (returns table 을 바꾸려면 먼저 지워야 한다고 Postgres 가 막습니다.
--  그래서 모양은 그대로 두고 사진 지우는 줄만 앞에 넣습니다.)
create or replace function public.sweep_expired()
returns table (지운표 text, 개수 bigint)
language plpgsql security definer set search_path = public, extensions, storage as $$
declare n bigint;
begin
  -- ① 기한 지난 사진 **파일**부터.
  --    표를 먼저 지우면 파일이 어디 있었는지 알 수 없게 됩니다.
  delete from storage.objects
   where bucket_id = '사진'
     and name in (select path from public.photo where expires_at < now());
  get diagnostics n = row_count;
  지운표 := '사진파일'; 개수 := n; return next;

  -- ② 그다음 표들
  delete from public.photo  where expires_at < now(); get diagnostics n = row_count;
  지운표 := 'photo';  개수 := n; return next;
  delete from public.report where expires_at < now(); get diagnostics n = row_count;
  지운표 := 'report'; 개수 := n; return next;
  delete from public.job    where expires_at < now(); get diagnostics n = row_count;
  지운표 := 'job';    개수 := n; return next;
  delete from public.enroll_token where expires_at < now(); get diagnostics n = row_count;
  지운표 := 'enroll_token'; 개수 := n; return next;
end $$;

grant execute on function public.sweep_expired() to authenticated, service_role;

-- ── 5. 확인 ─────────────────────────────────────────────────
do $$
declare 통 int; 규칙 int;
begin
  select count(*) into 통 from storage.buckets where id = '사진' and public = false;
  select count(*) into 규칙 from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('사진_폰올리기','사진_기관읽기','사진_기관지우기');

  if 통 <> 1 then raise exception '사진 통이 안 만들어졌습니다'; end if;
  if 규칙 <> 3 then raise exception '사진 규칙이 3개여야 하는데 %개입니다', 규칙; end if;

  raise notice '';
  raise notice '  통돌 Note 006 — 사진 자리를 만들었습니다.';
  raise notice '    통      사진 (비공개, 한 장 8MB 까지)';
  raise notice '    규칙    폰은 올리기만 · 기관은 읽고 지우기';
  raise notice '    길      <기관번호>/<보고번호>/<사진번호>';
  raise notice '    ★ 파일 자체가 잠겨서 올라갑니다. 서버는 못 엽니다.';
  raise notice '';
end $$;
