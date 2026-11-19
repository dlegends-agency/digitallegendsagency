-- Digital Legends Agency: admin backend schema
-- Run in Supabase: Dashboard > SQL Editor > New query > paste everything > Run.
-- It is safe to run again whenever this file changes.

-- ============================================================
-- Tables
-- ============================================================
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

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 200),
  description text check (char_length(description) <= 5000),
  category    text check (char_length(category) <= 60),
  due_date    date
);

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  project_id   uuid references public.projects (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 300),
  description  text check (char_length(description) <= 5000),
  status       text not null default 'open' check (status in ('open', 'in_progress', 'blocked', 'done')),
  priority     text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date     date,
  tags         text[] not null default '{}',
  completed_at timestamptz
);
create index if not exists tasks_project_idx on public.tasks (project_id);

-- Who created each project and task. Filled automatically from the signed-in user's email.
alter table public.projects add column if not exists created_by_email text default (auth.jwt() ->> 'email');
alter table public.tasks    add column if not exists created_by_email text default (auth.jwt() ->> 'email');

-- Privacy-friendly analytics: no cookies, no IP addresses, no personal data.
create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  session_id  text not null check (char_length(session_id) <= 64),
  type        text not null check (type in ('pageview', 'section', 'cta_click', 'click_out', 'form_submit')),
  path        text check (char_length(path) <= 300),
  label       text check (char_length(label) <= 200),
  referrer    text check (char_length(referrer) <= 200),
  device      text check (device in ('desktop', 'tablet', 'mobile')),
  utm_source   text check (char_length(utm_source) <= 100),
  utm_medium   text check (char_length(utm_medium) <= 100),
  utm_campaign text check (char_length(utm_campaign) <= 100)
);
create index if not exists analytics_created_idx on public.analytics_events (created_at desc);

-- ============================================================
-- Table privileges (new Supabase projects do not grant these automatically).
-- Row-level security below decides which rows each role can touch.
-- ============================================================
grant usage on schema public to anon, authenticated;
grant insert                         on public.leads            to anon;
grant select, insert, update, delete on public.leads            to authenticated;
grant select                         on public.site_content     to anon;
grant select, insert, update, delete on public.site_content     to authenticated;
grant select                         on public.admins           to authenticated;
grant select, insert, update, delete on public.projects         to authenticated;
grant select, insert, update, delete on public.tasks            to authenticated;
grant insert                         on public.analytics_events to anon, authenticated;
grant select, delete                 on public.analytics_events to authenticated;

-- ============================================================
-- Row-level security
-- ============================================================
alter table public.leads            enable row level security;
alter table public.site_content     enable row level security;
alter table public.admins           enable row level security;
alter table public.projects         enable row level security;
alter table public.tasks            enable row level security;
alter table public.analytics_events enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- leads: the public site may only INSERT a new lead. Only admins read or change them.
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

-- site_content: everyone reads (the site needs it). Only admins write.
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

-- admins: a signed-in user sees only their own row. Rows are added in the SQL editor only.
drop policy if exists "read own admin row" on public.admins;
create policy "read own admin row" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- projects and tasks: admins only.
drop policy if exists "admins manage projects" on public.projects;
create policy "admins manage projects" on public.projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage tasks" on public.tasks;
create policy "admins manage tasks" on public.tasks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- analytics: the public site may only INSERT events. Only admins read or delete them.
drop policy if exists "public can record events" on public.analytics_events;
create policy "public can record events" on public.analytics_events
  for insert to anon, authenticated with check (true);

drop policy if exists "admins read events" on public.analytics_events;
create policy "admins read events" on public.analytics_events
  for select to authenticated using (public.is_admin());

drop policy if exists "admins delete events" on public.analytics_events;
create policy "admins delete events" on public.analytics_events
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------
-- Make a user an admin (after creating them in Authentication > Users).
-- Replace the email and run this separately:
--
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'YOUR_ADMIN_EMAIL'
-- on conflict do nothing;
-- ---------------------------------------------------------------
