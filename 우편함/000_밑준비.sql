-- Supabase 흉내: pgcrypto 는 extensions 스키마에 있습니다
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $fn$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$fn$;
do $do$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  -- 개발 열쇠가 되는 역할. 이게 없으면 403 을 여기서 못 잡습니다.
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $do$;

-- ── Supabase 의 Storage 흉내 ────────────────────────────────
-- 006 의 사진 규칙을 **진짜 Postgres 에서** 돌려 보려고 둡니다.
-- 실제 Supabase 에는 이미 있는 것들입니다.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null,
  public boolean not null default false, file_size_limit bigint
);
create table if not exists storage.objects (
  id uuid primary key default extensions.gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null, owner uuid, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
-- 길을 「/」로 자릅니다. 진짜와 같은 셈을 합니다.
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $fn$
  select string_to_array(regexp_replace(name, '/[^/]*$', ''), '/')
$fn$;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select, insert, update on storage.buckets to authenticated, service_role;
