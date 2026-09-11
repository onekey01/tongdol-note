-- ============================================================
--  통돌 Note — 우편함 005 : 열쇠를 QR 에서 빼고 싸서 건네기
--
--  무엇이 문제였나 —
--    처음에는 기관 열쇠를 등록 QR 에 그대로 실었습니다. 그런데 QR 은
--    **아무 앱이나 갖다 대면 안이 맨눈에 읽힙니다.** 어깨너머로 찍히거나
--    사진첩에 남으면 그 기관의 모든 덩어리가 열립니다. 게다가 기관 열쇠는
--    바꾸면 그 전에 잠근 것을 못 엽니다 — 되돌리기가 아주 비쌉니다.
--
--  어떻게 바꾸나 —
--    1. 휴대폰이 자물쇠 한 쌍을 만들어 **공개쪽만** 등록할 때 올립니다
--    2. 기관 PC 가 그 공개쪽으로 **기관 열쇠를 싸서** 여기에 둡니다
--    3. 그 폰의 개인쪽으로만 풀립니다 — 우편함은 싼 덩어리만 보고 못 엽니다
--
--    이제 QR 에는 **15분짜리 일회용 표 하나**뿐입니다.
--
--  001~004 를 이미 실행하셨다면 이 파일만 더 붙여넣으시면 됩니다.
-- ============================================================

alter table public.worker_device
  add column if not exists pub_key    text,          -- 폰의 공개쪽 (새도 됩니다)
  add column if not exists wrapped_key text,         -- 기관 열쇠를 그 폰만 열게 싼 것
  add column if not exists wrapped_at timestamptz;

-- 아직 싸지 못한 기기를 기관 PC 가 빨리 찾도록
create index if not exists worker_device_대기_idx
  on public.worker_device (org_id) where wrapped_key is null;

-- ── 기기 등록 (공개쪽을 같이 받습니다) ────────────────────
--
--  옛 함수는 지웁니다. 공개쪽 없이 등록되면 열쇠를 건넬 길이 없습니다.
drop function if exists public.register_device(text);

create or replace function public.register_device(token text, p_pub_key text)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  h text := encode(digest(token, 'sha256'), 'hex');
  t public.enroll_token%rowtype;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;
  if p_pub_key is null or length(p_pub_key) < 40 then
    raise exception '기기 공개쪽이 없습니다';
  end if;

  select * into t from public.enroll_token
   where token_hash = h and used_at is null and expires_at > now()
   for update;

  if not found then
    raise exception '등록표가 없거나 이미 썼거나 기한이 지났습니다';
  end if;

  insert into public.worker_device (user_id, worker_id, org_id, pub_key)
       values (auth.uid(), t.worker_id, t.org_id, p_pub_key)
  on conflict (user_id) do update
       set worker_id = excluded.worker_id,
           org_id    = excluded.org_id,
           pub_key   = excluded.pub_key,
           -- 기기를 다시 등록하면 옛 싼 열쇠는 버립니다.
           -- 새 쌍으로는 옛것을 못 풀기 때문입니다.
           wrapped_key = null,
           wrapped_at  = null,
           registered_at = now();

  update public.enroll_token set used_at = now() where token_hash = h;
  return t.worker_id;
end $$;

grant execute on function public.register_device(text, text) to authenticated;

-- ── 휴대폰은 제 줄만 읽습니다 (싼 열쇠도 여기 들어 있습니다) ──
--  001 에서 만든 정책이 그대로 쓰입니다: worker_device_폰 (user_id = auth.uid()).
--  남의 줄은 안 보이니 남의 싼 열쇠도 안 보입니다.

-- ── 기관 PC 가 「아직 못 건넨 기기」를 봅니다 ──────────────
create or replace function public.pending_devices()
returns table (worker_id uuid, pub_key text, registered_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select d.worker_id, d.pub_key, d.registered_at
    from public.worker_device d
   where d.org_id = public.my_org()
     and d.pub_key is not null
     and d.wrapped_key is null
   order by d.registered_at
$$;

grant execute on function public.pending_devices() to authenticated, service_role;
