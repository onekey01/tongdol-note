-- ============================================================
--  통돌 Note — 우편함 008 : 계정으로 들어가기
--
--  무엇을 고치는 것인가 —
--
--    지금까지 등록은 **브라우저**에 묶여 있었습니다. 같은 폰이라도
--    크롬에서 등록하고 삼성인터넷으로 열면 아무것도 없습니다.
--    브라우저에게 둘은 남남입니다. 아이폰 사파리는 한동안 안 쓴
--    사이트의 저장소를 **스스로 지우기까지** 합니다.
--
--    그래서 제공인력은 사무실에 다시 찾아와 QR 을 또 찍어야 했습니다.
--    (2026-09-05 무무 — 「종사자당 휴대폰 기기 1대로 제한해야 하고,
--     그 기기 안에선 어떤 브라우저로 접속하더라도 문제없이 실행되어야
--     해. 아이폰의 경우엔 어쩌려고 설계를 이렇게 한거야???」)
--
--    웹 페이지는 **다른 브라우저의 저장소를 못 보고, 기기 고유번호도
--    못 읽습니다.** 그러니 「기기를 기억」으로는 만들 수가 없습니다.
--    되는 길은 **사람을 기억하는 것** — 계정으로 들어가는 것입니다.
--
--  ── 어떻게 도나 ────────────────────────────────────────────
--
--    ① 폰이 기관을 고릅니다 (기관명은 개인정보가 아닙니다 — 001 참고)
--    ② 아이디·비밀번호를 받아, **기관 공개열쇠로 싸서** 올립니다
--    ③ 사무실 PC 가 그것을 풀어 아이디·비밀번호를 확인합니다
--    ④ 맞으면 기관 열쇠를 **그 폰의 공개쪽으로 싸서** 내려 줍니다
--    ⑤ 그 인력의 **앞 기기는 끊깁니다** (한 사람당 한 대)
--
--  ★ 우편함은 여전히 아무것도 못 봅니다 ★
--    비밀번호도 기관 열쇠도 **잠긴 채로** 이 서버를 지나갑니다.
--    푸는 열쇠는 기관 PC 에만 있습니다. 우편함을 통째로 털려도
--    비밀번호를 맞혀 볼 거리조차 없습니다.
--
--  ── 대가 하나 ──────────────────────────────────────────────
--    로그인하는 그 순간 **사무실 PC 가 켜져 있어야** 합니다.
--    꺼져 있으면 요청이 여기서 기다렸다가 PC 를 켜는 순간 끝납니다.
--
--  007 까지 실행하셨다면 이 파일만 더 붙여넣으시면 됩니다.
--  여러 번 실행해도 안전합니다.
-- ============================================================

-- ── 1. 기관 공개열쇠 ───────────────────────────────────────
--
--  폰이 아이디·비밀번호를 쌀 때 쓰는 열쇠입니다. **공개쪽**이라
--  누가 봐도 괜찮습니다 — 이것으로는 싸기만 되고 풀지는 못합니다.
--  푸는 쪽(개인키)은 기관 PC 의 .env 에만 있고 백업도 거기로 갑니다.
alter table public.org add column if not exists pub_key text;

-- ── 2. 로그인 요청 ─────────────────────────────────────────
--
--  ★ 이 표에도 **사람에 관한 칸이 하나도 없습니다.**
--    아이디도 비밀번호도 `asked_enc` 한 칸에 잠겨서 들어옵니다.
create table if not exists public.device_request (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.org(id) on delete cascade,

  -- 이 요청을 낸 폰(익명 로그인)의 번호. 답을 이 폰에게만 보여 줍니다.
  device_user_id uuid not null references auth.users(id) on delete cascade,

  -- {아이디, 비밀번호, 폰 공개쪽} 을 기관 공개열쇠로 싼 것
  asked_enc   text not null,

  -- 기관 PC 가 채웁니다 — 기관 열쇠를 폰 공개쪽으로 싼 것
  answer_enc  text,
  worker_id   uuid references public.worker(id) on delete cascade,

  --  기다림 · 됨 · 거절
  status      text not null default '기다림'
              check (status in ('기다림','됨','거절')),
  -- 왜 거절인가 — 「아이디나 비밀번호가 맞지 않습니다」 같은 짧은 말.
  -- 여기에 **어느 쪽이 틀렸는지 자세히 쓰면 안 됩니다** (맞혀 보는 사람에게
  -- 단서가 됩니다). 기관 PC 가 그 원칙대로 씁니다.
  reason      text,

  created_at  timestamptz not null default now(),
  --  15분. 오래 두면 안 됩니다 — 잠긴 것이라 해도 비밀번호가 든 덩어리입니다.
  expires_at  timestamptz not null default (now() + interval '15 minutes')
);
create index if not exists device_request_org_idx
  on public.device_request(org_id, status);
create index if not exists device_request_expires_idx
  on public.device_request(expires_at);

-- ── 3. 누가 무엇을 볼 수 있나 ──────────────────────────────
alter table public.device_request enable row level security;

drop policy if exists device_request_기관 on public.device_request;
drop policy if exists device_request_폰   on public.device_request;
drop policy if exists org_고르기          on public.org;

-- 기관 PC — 자기 기관에 온 요청만, 전부
create policy device_request_기관 on public.device_request
  for all using (org_id = public.my_org())
  with check (org_id = public.my_org());

-- 폰 — **자기가 낸 요청만.** 남이 낸 것은 답도 못 봅니다.
create policy device_request_폰 on public.device_request
  for all using (device_user_id = auth.uid())
  with check (device_user_id = auth.uid());

/*
 * ── 기관 목록은 왜 열어 주나 ────────────────────────────────
 *
 * 새 브라우저로 들어온 폰은 **아무것도 모릅니다.** 자기가 어느 기관
 * 사람인지도 모릅니다(그건 등록해야 생기는 것이니까요). 그러니
 * 아이디·비밀번호를 **누구의 공개열쇠로 쌀지**를 고를 수가 없습니다.
 *
 * 그래서 기관 이름과 공개열쇠만 내놓습니다. 001 이 적어 둔 대로
 * **기관명은 개인정보가 아니고**, 공개열쇠는 이름 그대로 공개용입니다.
 * 이 둘로는 어르신에 관한 것을 한 글자도 알 수 없습니다.
 */
create policy org_고르기 on public.org
  for select to authenticated using (true);

-- ── 4. 쓸어내기에 하나 더 ──────────────────────────────────
--
--  기한이 지난 요청은 지웁니다. 비밀번호가 든 덩어리라 제일 먼저 지웁니다.
create or replace function public.sweep_expired()
returns table (지운표 text, 개수 bigint)
language plpgsql security definer set search_path = public, extensions as $$
declare n bigint;
begin
  -- ★ 사진 파일이 표보다 **먼저**입니다. 표를 먼저 지우면 자리를 잃습니다.
  delete from storage.objects o
   where o.bucket_id = '사진'
     and exists (select 1 from public.photo p
                  where p.path = o.name and p.expires_at < now());
  get diagnostics n = row_count;
  지운표 := 'storage'; 개수 := n; return next;

  delete from public.device_request where expires_at < now();
  get diagnostics n = row_count;
  지운표 := 'device_request'; 개수 := n; return next;

  delete from public.photo  where expires_at < now(); get diagnostics n = row_count;
  지운표 := 'photo';  개수 := n; return next;
  delete from public.report where expires_at < now(); get diagnostics n = row_count;
  지운표 := 'report'; 개수 := n; return next;
  delete from public.job    where expires_at < now(); get diagnostics n = row_count;
  지운표 := 'job';    개수 := n; return next;
  delete from public.enroll_token where expires_at < now(); get diagnostics n = row_count;
  지운표 := 'enroll_token'; 개수 := n; return next;
end $$;

-- ── 5. 표를 쓸 수 있게 열어 줍니다 ─────────────────────────
--  (프로젝트 설정에서 「새 표 자동 노출」을 꺼 두었기 때문입니다)
grant select, insert, update, delete on public.device_request to authenticated;
