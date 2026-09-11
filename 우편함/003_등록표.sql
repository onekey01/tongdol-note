-- ============================================================
--  통돌 Note — 우편함 003 : 등록표 만들기
--
--  001 에서 enroll_token 을 **아무에게도 안 열어 뒀습니다.**
--  그래서 기관 PC 도 직접 못 넣습니다. 그게 맞습니다 —
--  대신 이 함수로만 넣게 합니다. 함수는 세 가지를 강제합니다.
--
--    1. 부른 사람이 **기관 계정**인가
--    2. 그 인력이 **내 기관** 인력인가   ← 남의 기관 인력에게 표를 못 만듭니다
--    3. 그 인력이 **아직 다니는가**
--
--  001 을 이미 실행하셨다면 이 파일만 더 붙여넣으시면 됩니다.
-- ============================================================

create or replace function public.make_enroll_token(
  p_worker     uuid,
  p_token_hash text,
  p_minutes    int default 15
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare o uuid := public.my_org();
begin
  if o is null then
    raise exception '기관 계정이 아닙니다';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception '등록표 해시 모양이 아닙니다';
  end if;
  if not exists (
    select 1 from public.worker
     where id = p_worker and org_id = o and active
  ) then
    raise exception '내 기관의 다니는 인력이 아닙니다';
  end if;

  -- 그 인력에게 아직 안 쓴 표가 있으면 지웁니다 (한 사람에 살아 있는 표 하나).
  delete from public.enroll_token
   where worker_id = p_worker and used_at is null;

  insert into public.enroll_token (token_hash, org_id, worker_id, expires_at)
  values (p_token_hash, o, p_worker,
          now() + make_interval(mins => greatest(1, least(p_minutes, 120))));
end $$;

grant execute on function public.make_enroll_token(uuid, text, int) to authenticated;
