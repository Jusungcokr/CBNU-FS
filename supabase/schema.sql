-- =========================================================
-- CBNU FS — Supabase 스키마 (테이블 · RLS · 관리자 판별 함수)
-- Supabase 대시보드 → SQL Editor 에서 실행합니다.
-- (이미 실행된 프로젝트: cbnu-fs / qpszatipyvbxxharuysm)
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.site_data (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  major text,
  student_id text,
  phone text not null,
  position text,
  experience text,
  motivation text,
  status text not null default '접수',
  created_at timestamptz not null default now()
);

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  content text not null,
  is_anonymous boolean not null default true,
  author_name text,
  status text not null default '접수',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.admin_emails a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant usage on schema public to anon, authenticated;
grant select on public.site_data to anon, authenticated;
grant insert, update, delete on public.site_data to authenticated;
grant insert on public.applications to anon, authenticated;
grant insert on public.suggestions to anon, authenticated;
grant select, update, delete on public.applications to authenticated;
grant select, update, delete on public.suggestions to authenticated;
grant select, insert, update, delete on public.admin_emails to authenticated;

alter table public.admin_emails enable row level security;
alter table public.site_data enable row level security;
alter table public.applications enable row level security;
alter table public.suggestions enable row level security;

drop policy if exists admin_emails_read on public.admin_emails;
create policy admin_emails_read on public.admin_emails
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) or public.is_admin());

drop policy if exists admin_emails_write on public.admin_emails;
create policy admin_emails_write on public.admin_emails
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists site_data_read on public.site_data;
create policy site_data_read on public.site_data
  for select to anon, authenticated using (true);

drop policy if exists site_data_write on public.site_data;
create policy site_data_write on public.site_data
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists applications_insert on public.applications;
create policy applications_insert on public.applications
  for insert to anon, authenticated with check (true);

drop policy if exists applications_admin_read on public.applications;
create policy applications_admin_read on public.applications
  for select to authenticated using (public.is_admin());

drop policy if exists applications_admin_update on public.applications;
create policy applications_admin_update on public.applications
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists applications_admin_delete on public.applications;
create policy applications_admin_delete on public.applications
  for delete to authenticated using (public.is_admin());

drop policy if exists suggestions_insert on public.suggestions;
create policy suggestions_insert on public.suggestions
  for insert to anon, authenticated with check (true);

drop policy if exists suggestions_admin_read on public.suggestions;
create policy suggestions_admin_read on public.suggestions
  for select to authenticated using (public.is_admin());

drop policy if exists suggestions_admin_update on public.suggestions;
create policy suggestions_admin_update on public.suggestions
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists suggestions_admin_delete on public.suggestions;
create policy suggestions_admin_delete on public.suggestions
  for delete to authenticated using (public.is_admin());

insert into public.admin_emails (email)
values ('kimjusung1113@gmail.com')
on conflict (email) do nothing;
