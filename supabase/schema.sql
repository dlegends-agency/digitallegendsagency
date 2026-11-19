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

-- Roles: 'super_admin' (can see Log and Users, and grant access) or 'admin' (everything else).
alter table public.admins add column if not exists role text not null default 'admin';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'admins_role_check') then
    alter table public.admins add constraint admins_role_check check (role in ('admin', 'super_admin'));
  end if;
end $$;

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

-- Time log: who spent how long on what.
create table if not exists public.time_entries (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  entry_date       date not null default current_date,
  minutes          int not null check (minutes between 1 and 1440),
  category         text not null check (char_length(category) between 1 and 60),
  note             text check (char_length(note) <= 500),
  created_by_email text default (auth.jwt() ->> 'email')
);
create index if not exists time_entries_date_idx on public.time_entries (entry_date desc);

-- Activity log: filled automatically by triggers below. Nobody writes to it directly.
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  actor_email text,
  action      text not null,
  entity      text not null,
  summary     text not null
);
create index if not exists activity_created_idx on public.activity_log (created_at desc);

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
grant select, insert, update, delete on public.time_entries     to authenticated;
grant select                         on public.activity_log     to authenticated;

-- ============================================================
-- Row-level security
-- ============================================================
alter table public.leads            enable row level security;
alter table public.site_content     enable row level security;
alter table public.admins           enable row level security;
alter table public.projects         enable row level security;
alter table public.tasks            enable row level security;
alter table public.analytics_events enable row level security;
alter table public.time_entries     enable row level security;
alter table public.activity_log     enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and role = 'super_admin');
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

-- time log: super admin only.
drop policy if exists "admins manage time" on public.time_entries;
drop policy if exists "super admin manages time" on public.time_entries;
create policy "super admin manages time" on public.time_entries
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- activity log: super admin can read. Rows are written only by the trigger function below.
drop policy if exists "admins read activity" on public.activity_log;
drop policy if exists "super admin reads activity" on public.activity_log;
create policy "super admin reads activity" on public.activity_log
  for select to authenticated using (public.is_super_admin());

-- ============================================================
-- Activity log triggers: record who created, moved, edited or deleted what.
-- ============================================================
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who text := coalesce(auth.jwt() ->> 'email', 'website visitor');
  ent text := tg_argv[0];
  act text;
  msg text;
begin
  if ent = 'project' then
    if tg_op = 'INSERT' then act := 'created'; msg := 'Created project "' || new.name || '"';
    elsif tg_op = 'UPDATE' then act := 'updated'; msg := 'Updated project "' || new.name || '"';
    else act := 'deleted'; msg := 'Deleted project "' || old.name || '"'; end if;
  elsif ent = 'task' then
    if tg_op = 'INSERT' then act := 'created'; msg := 'Created task "' || new.title || '"';
    elsif tg_op = 'UPDATE' then
      if old.status is distinct from new.status then
        act := 'moved';
        msg := 'Moved task "' || new.title || '" from ' || replace(old.status, '_', ' ') || ' to ' || replace(new.status, '_', ' ');
      else act := 'updated'; msg := 'Updated task "' || new.title || '"'; end if;
    else act := 'deleted'; msg := 'Deleted task "' || old.title || '"'; end if;
  elsif ent = 'enquiry' then
    if tg_op = 'INSERT' then act := 'created'; msg := 'New enquiry from ' || new.name;
    elsif tg_op = 'UPDATE' then
      if old.status is distinct from new.status then act := 'updated'; msg := 'Marked enquiry from ' || new.name || ' as ' || new.status;
      elsif old.note is distinct from new.note then act := 'updated'; msg := 'Edited the note on the enquiry from ' || new.name;
      else return null; end if;
    else act := 'deleted'; msg := 'Deleted enquiry from ' || old.name; end if;
  elsif ent = 'content' then
    if tg_op = 'DELETE' then act := 'deleted'; msg := 'Reset site content "' || old.key || '" to the default';
    else act := 'updated'; msg := 'Edited site content "' || new.key || '"'; end if;
  else
    return null;
  end if;
  insert into public.activity_log (actor_email, action, entity, summary) values (who, act, ent, msg);
  return null;
end;
$$;

drop trigger if exists log_projects on public.projects;
create trigger log_projects after insert or update or delete on public.projects
  for each row execute function public.log_activity('project');

drop trigger if exists log_tasks on public.tasks;
create trigger log_tasks after insert or update or delete on public.tasks
  for each row execute function public.log_activity('task');

drop trigger if exists log_leads on public.leads;
create trigger log_leads after insert or update or delete on public.leads
  for each row execute function public.log_activity('enquiry');

drop trigger if exists log_content on public.site_content;
create trigger log_content after insert or update or delete on public.site_content
  for each row execute function public.log_activity('content');

-- ============================================================
-- User management (super admin only). These run with elevated rights but check
-- is_super_admin() first, so nobody else can use them.
-- ============================================================
create or replace function public.list_users()
returns table (user_id uuid, email text, full_name text, role text, created_at timestamptz, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select u.id,
         u.email::text,
         coalesce(u.raw_user_meta_data ->> 'full_name', ''),
         coalesce(a.role, 'none'),
         u.created_at,
         u.last_sign_in_at
  from auth.users u
  left join public.admins a on a.user_id = u.id
  where public.is_super_admin()
  order by u.created_at;
$$;

create or replace function public.set_user_role(target uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
begin
  if not public.is_super_admin() then
    raise exception 'Only the super admin can change access';
  end if;
  if new_role not in ('admin', 'none') then
    raise exception 'Invalid role';
  end if;
  if exists (select 1 from public.admins where user_id = target and role = 'super_admin') then
    raise exception 'The super admin cannot be changed here';
  end if;
  select email into target_email from auth.users where id = target;
  if target_email is null then
    raise exception 'User not found';
  end if;
  if new_role = 'none' then
    delete from public.admins where user_id = target;
  else
    insert into public.admins (user_id, role) values (target, 'admin')
    on conflict (user_id) do update set role = 'admin';
  end if;
  insert into public.activity_log (actor_email, action, entity, summary)
  values (auth.jwt() ->> 'email', 'updated', 'user',
          case when new_role = 'admin' then 'Gave admin access to ' else 'Removed admin access from ' end || target_email);
end;
$$;

revoke all on function public.list_users() from public, anon;
revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.list_users() to authenticated;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------
-- Set up who can sign in to /admin (the people must already exist under
-- Authentication > Users). Replace the emails and run this separately:
--
-- insert into public.admins (user_id, role)
-- select id, case when email = 'SUPER_ADMIN_EMAIL' then 'super_admin' else 'admin' end
-- from auth.users
-- where email in ('SUPER_ADMIN_EMAIL', 'ADMIN_EMAIL_1', 'ADMIN_EMAIL_2')
-- on conflict (user_id) do update set role = excluded.role;
-- ---------------------------------------------------------------
