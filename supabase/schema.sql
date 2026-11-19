-- Digital Legends Agency: admin backend schema
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null check (char_length(name) between 1 and 200),
  email      text not null check (char_length(email) between 3 and 320),
  message    text check (char_length(message) <= 5000),
  status     text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  note       text check (char_length(note) <= 5000)
);

create table if not exists public.site_content (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.leads        enable row level security;
alter table public.site_content enable row level security;
alter table public.admins       enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- leads: the public website may only INSERT a new lead. Only admins can read or change them.
drop policy if exists "public can submit leads" on public.leads;
create policy "public can submit leads" on public.leads
  for insert to anon, authenticated
  with check (status = 'new' and note is null);

drop policy if exists "admins read leads" on public.leads;
create policy "admins read leads" on public.leads
  for select to authenticated using (public.is_admin());

drop policy if exists "admins update leads" on public.leads;
create policy "admins update leads" on public.leads
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete leads" on public.leads;
create policy "admins delete leads" on public.leads
  for delete to authenticated using (public.is_admin());

-- site_content: everyone can read (the website needs it). Only admins can write.
drop policy if exists "public read content" on public.site_content;
create policy "public read content" on public.site_content
  for select to anon, authenticated using (true);

drop policy if exists "admins insert content" on public.site_content;
create policy "admins insert content" on public.site_content
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admins update content" on public.site_content;
create policy "admins update content" on public.site_content
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete content" on public.site_content;
create policy "admins delete content" on public.site_content
  for delete to authenticated using (public.is_admin());

-- admins: a signed-in user can see only their own row. Rows are added here in the SQL editor, never from the website.
drop policy if exists "read own admin row" on public.admins;
create policy "read own admin row" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------
-- STEP 2 (after creating your admin user in Authentication > Users):
-- replace the email below with the admin's email and run it.
--
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'YOUR_ADMIN_EMAIL';
-- ---------------------------------------------------------------
