-- СМЕНА: core schema
-- Entities are split into dedicated tables (no single growing project JSON blob),
-- so each concern (members, invites, contacts, shifts, scenes, timesheet,
-- board events, chat) can be synced, cached and access-controlled independently.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- enums
-- ---------------------------------------------------------------------------
create type project_role as enum ('owner', 'coordinator', 'member');
create type project_status as enum ('active', 'archived');
create type contact_category as enum ('crew', 'actor', 'transport');
create type shift_status as enum ('подготовка', 'мотор', 'обед', 'стоп');
create type member_status as enum ('not_seen', 'seen', 'on_way', 'on_site');
create type board_event_type as enum ('note', 'change', 'lunch', 'weather');
create type channel_type as enum ('general', 'department', 'scene');
create type kpp_day_type as enum ('съёмка', 'снято', 'выходной', 'отсыпной');

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Пользователь',
  created_at timestamptz not null default now()
);

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'Пользователь'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- projects & membership
-- ---------------------------------------------------------------------------
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  first_shift_date date,
  location_name text,
  status project_status not null default 'active',
  settings jsonb not null default '{"overtimeBasis":"work_stop","breakMinutes":60,"breakDeductible":true}'::jsonb,
  current_shift_id uuid,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role project_role not null default 'member',
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'removed')),
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  code text not null unique,
  role project_role not null default 'member',
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  max_uses int not null default 0,
  uses_count int not null default 0,
  created_at timestamptz not null default now()
);

create table join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_code text not null,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index join_attempts_user_time_idx on join_attempts(user_id, created_at);

-- ---------------------------------------------------------------------------
-- locations & contacts
-- ---------------------------------------------------------------------------
create table locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  group_name text,
  address text,
  directions text,
  parking text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  category contact_category not null,
  full_name text not null,
  department text,
  phone text,
  linked_user_id uuid references auth.users(id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- shifts
-- ---------------------------------------------------------------------------
create table shifts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  shift_number int not null,
  shift_date date not null,
  timezone text not null default 'Europe/Moscow',
  location_id uuid references locations(id) on delete set null,
  call_time timestamptz,
  lunch_time timestamptz,
  planned_wrap timestamptz,
  status shift_status not null default 'подготовка',
  status_changed_at timestamptz not null default now(),
  status_changed_by uuid references auth.users(id),
  notes text,
  overtime_basis text not null default 'work_stop' check (overtime_basis in ('work_stop', 'departure')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, shift_number)
);

alter table projects
  add constraint fk_projects_current_shift foreign key (current_shift_id)
  references shifts(id) on delete set null;

create table shift_status_log (
  id bigint generated always as identity primary key,
  shift_id uuid not null references shifts(id) on delete cascade,
  status shift_status not null,
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now()
);

create table member_shift_status (
  shift_id uuid not null references shifts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status member_status not null default 'not_seen',
  updated_at timestamptz not null default now(),
  primary key (shift_id, user_id)
);

-- ---------------------------------------------------------------------------
-- scenes (script)
-- ---------------------------------------------------------------------------
create table scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  episode text,
  scene_number text not null,
  stable_key text not null,
  int_ext text,
  day_night text,
  location_text text,
  location_id uuid references locations(id) on delete set null,
  synopsis text,
  full_text text,
  characters text[] not null default '{}',
  source text not null default 'manual' check (source in ('manual', 'import')),
  shift_id uuid references shifts(id) on delete set null,
  scheduled_time timestamptz,
  shot boolean not null default false,
  shot_at timestamptz,
  order_hint int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, stable_key)
);
create index scenes_project_shift_idx on scenes(project_id, shift_id);

-- ---------------------------------------------------------------------------
-- assignments (call sheet + timesheet, one row per contact per shift)
-- ---------------------------------------------------------------------------
create table assignments (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shifts(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  call_time timestamptz,
  planned_wrap timestamptz,
  actual_arrival timestamptz,
  actual_work_stop timestamptz,
  actual_departure timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_id, contact_id)
);

create table time_edit_log (
  id bigint generated always as identity primary key,
  assignment_id uuid not null references assignments(id) on delete cascade,
  field text not null,
  old_value timestamptz,
  new_value timestamptz,
  reason text,
  edited_by uuid not null references auth.users(id),
  edited_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- board of the day
-- ---------------------------------------------------------------------------
create table board_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  shift_id uuid not null references shifts(id) on delete cascade,
  type board_event_type not null,
  text text not null,
  payload jsonb not null default '{}'::jsonb,
  author_id uuid not null references auth.users(id),
  client_op_id uuid,
  created_at timestamptz not null default now()
);
create unique index board_events_client_op_uq on board_events(shift_id, client_op_id) where client_op_id is not null;
create index board_events_shift_created_idx on board_events(shift_id, created_at);

-- ---------------------------------------------------------------------------
-- chat
-- ---------------------------------------------------------------------------
create table channels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type channel_type not null,
  department text,
  scene_id uuid references scenes(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create unique index channels_general_uq on channels(project_id) where type = 'general';
create unique index channels_department_uq on channels(project_id, department) where type = 'department';
create unique index channels_scene_uq on channels(project_id, scene_id) where type = 'scene';

create table messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  text text not null,
  reply_to_id uuid references messages(id) on delete set null,
  client_op_id uuid not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  unique (channel_id, client_op_id)
);
create index messages_channel_created_idx on messages(channel_id, created_at);

-- ---------------------------------------------------------------------------
-- КПП calendar
-- ---------------------------------------------------------------------------
create table kpp_days (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  date date not null,
  type kpp_day_type not null,
  location_id uuid references locations(id) on delete set null,
  shift_id uuid references shifts(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, date)
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_projects_updated before update on projects for each row execute function set_updated_at();
create trigger trg_locations_updated before update on locations for each row execute function set_updated_at();
create trigger trg_contacts_updated before update on contacts for each row execute function set_updated_at();
create trigger trg_shifts_updated before update on shifts for each row execute function set_updated_at();
create trigger trg_scenes_updated before update on scenes for each row execute function set_updated_at();
create trigger trg_assignments_updated before update on assignments for each row execute function set_updated_at();
create trigger trg_kpp_days_updated before update on kpp_days for each row execute function set_updated_at();
