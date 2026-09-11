-- ============================================================
--  통돌 Note — 우편함 004 : 개발 열쇠에게 권한 주기
--
--  왜 필요한가 —
--    「Automatically expose new tables」를 껐기 때문에 새 표에는
--    아무 권한도 안 붙습니다. **service_role 도 마찬가지입니다.**
--
--    service_role 이 건너뛰는 것은 RLS(줄 단위 규칙)뿐이고,
--    표 권한(GRANT)은 건너뛰지 않습니다. 이걸 저는 반대로 알고 있었고,
--    「기관 만들기」가 403 으로 막히면서 드러났습니다.
--
--  누가 이 열쇠를 쓰나 —
--    무무의 도구뿐입니다 (기관 만들기 · 왕복 시험).
--    기관에 나가는 프로그램에는 이 열쇠가 들어가지 않습니다.
--
--  enroll_token 은 **여기서도 안 열어 줍니다.** 등록표는 함수로만 만듭니다.
-- ============================================================

grant usage on schema public to service_role;

grant select, insert, update, delete
  on public.org, public.org_member, public.worker, public.worker_device,
     public.job, public.report, public.photo
  to service_role;

revoke all on public.enroll_token from service_role;

grant execute on function public.my_org()                          to service_role;
grant execute on function public.my_worker()                       to service_role;
grant execute on function public.sweep_expired()                   to service_role;
grant execute on function public.make_enroll_token(uuid, text, int) to service_role;
