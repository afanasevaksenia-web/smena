-- СМЕНА: role helpers, RPCs, row level security
-- Every access rule is enforced here (server side). The client hides buttons
-- for convenience only; it must never be the actual gate.

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create function role_rank(r project_role) returns int language sql immutable as $$
  select case r when 'owner' then 3 when 'coordinator' then 2 else 1 end
$$;

create function is_project_member(p_project uuid, p_min_role project_role default 'member')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from project_members m
    where m.project_id = p_project
      and m.user_id = auth.uid()
      and m.status = 'active'
      and role_rank(m.role) >= role_rank(p_min_role)
  )
$$;

create function shift_project(p_shift uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select project_id from shifts where id = p_shift
$$;

create function assignment_shift(p_assignment uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select shift_id from assignments where id = p_assignment
$$;

create function channel_project(p_channel uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select project_id from channels where id = p_channel
$$;

-- ---------------------------------------------------------------------------
-- RPC: create_project — first screen "Создать проект"
-- ---------------------------------------------------------------------------
create function create_project(
  p_name text,
  p_first_shift_date date,
  p_location_name text,
  p_display_name text
) returns projects
language plpgsql security definer set search_path = public as $$
declare
  v_project projects;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Название проекта обязательно';
  end if;

  insert into projects (name, first_shift_date, location_name, created_by)
  values (trim(p_name), p_first_shift_date, nullif(trim(coalesce(p_location_name, '')), ''), auth.uid())
  returning * into v_project;

  insert into project_members (project_id, user_id, role, display_name)
  values (v_project.id, auth.uid(), 'owner', coalesce(nullif(trim(p_display_name), ''), 'Пользователь'));

  insert into channels (project_id, type, name)
  values (v_project.id, 'general', 'Общий чат');

  update profiles set display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
  where id = auth.uid();

  return v_project;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: create_invite / revoke_invite — owner-only access management
-- ---------------------------------------------------------------------------
create function generate_invite_code() returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..7 loop
    result := result || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

create function create_invite(
  p_project uuid,
  p_role project_role default 'member',
  p_ttl_hours int default 72,
  p_max_uses int default 0
) returns invites
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_invite invites;
  v_attempt int := 0;
begin
  if not is_project_member(p_project, 'owner') then
    raise exception 'Недостаточно прав для создания приглашения';
  end if;

  loop
    v_code := generate_invite_code();
    begin
      insert into invites (project_id, code, role, created_by, expires_at, max_uses)
      values (p_project, v_code, p_role, auth.uid(), now() + make_interval(hours => greatest(p_ttl_hours, 1)), greatest(p_max_uses, 0))
      returning * into v_invite;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt > 5 then
        raise exception 'Не удалось создать код приглашения, повторите попытку';
      end if;
    end;
  end loop;

  return v_invite;
end;
$$;

create function revoke_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
begin
  select project_id into v_project from invites where id = p_invite;
  if v_project is null then
    raise exception 'Приглашение не найдено';
  end if;
  if not is_project_member(v_project, 'owner') then
    raise exception 'Недостаточно прав для отзыва приглашения';
  end if;
  update invites set revoked_at = now() where id = p_invite and revoked_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: redeem_invite — "Присоединиться по коду", rate limited server-side
-- ---------------------------------------------------------------------------
create function redeem_invite(p_code text, p_display_name text)
returns projects
language plpgsql security definer set search_path = public as $$
declare
  v_recent_failures int;
  v_invite invites;
  v_project projects;
  v_norm_code text := upper(trim(p_code));
begin
  select count(*) into v_recent_failures
  from join_attempts
  where user_id = auth.uid()
    and success = false
    and created_at > now() - interval '10 minutes';

  if v_recent_failures >= 8 then
    raise exception 'Слишком много попыток. Подождите несколько минут и попробуйте снова.';
  end if;

  select * into v_invite from invites where code = v_norm_code;

  if v_invite.id is null
     or v_invite.revoked_at is not null
     or v_invite.expires_at <= now()
     or (v_invite.max_uses > 0 and v_invite.uses_count >= v_invite.max_uses)
  then
    insert into join_attempts (user_id, attempted_code, success) values (auth.uid(), v_norm_code, false);
    raise exception 'Код недействителен или срок его действия истёк';
  end if;

  select * into v_project from projects where id = v_invite.project_id;

  insert into project_members (project_id, user_id, role, display_name)
  values (v_invite.project_id, auth.uid(), v_invite.role, coalesce(nullif(trim(p_display_name), ''), 'Пользователь'))
  on conflict (project_id, user_id) do update set status = 'active';

  update invites set uses_count = uses_count + 1 where id = v_invite.id;
  insert into join_attempts (user_id, attempted_code, success) values (auth.uid(), v_norm_code, true);

  return v_project;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: set_member_role / remove_member — owner-only membership management
-- ---------------------------------------------------------------------------
create function set_member_role(p_project uuid, p_user uuid, p_role project_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_project_member(p_project, 'owner') then
    raise exception 'Недостаточно прав';
  end if;
  if p_user = auth.uid() and p_role <> 'owner' then
    raise exception 'Нельзя понизить собственную роль владельца';
  end if;
  update project_members set role = p_role where project_id = p_project and user_id = p_user;
end;
$$;

create function remove_member(p_project uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user <> auth.uid() and not is_project_member(p_project, 'owner') then
    raise exception 'Недостаточно прав';
  end if;
  update project_members set status = 'removed' where project_id = p_project and user_id = p_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: set_shift_status — records author + timestamp, becomes project's current shift
-- ---------------------------------------------------------------------------
create function set_shift_status(p_shift uuid, p_status shift_status) returns shifts
language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_shift shifts;
begin
  v_project := shift_project(p_shift);
  if not is_project_member(v_project, 'coordinator') then
    raise exception 'Недостаточно прав для изменения статуса смены';
  end if;

  update shifts set status = p_status, status_changed_at = now(), status_changed_by = auth.uid()
  where id = p_shift
  returning * into v_shift;

  insert into shift_status_log (shift_id, status, changed_by) values (p_shift, p_status, auth.uid());

  update projects set current_shift_id = p_shift where id = v_project;

  return v_shift;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: set_my_shift_status — "Мой статус"
-- ---------------------------------------------------------------------------
create function set_my_shift_status(p_shift uuid, p_status member_status) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
begin
  v_project := shift_project(p_shift);
  if not is_project_member(v_project, 'member') then
    raise exception 'Недостаточно прав';
  end if;
  insert into member_shift_status (shift_id, user_id, status, updated_at)
  values (p_shift, auth.uid(), p_status, now())
  on conflict (shift_id, user_id) do update set status = excluded.status, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: set_assignment_time — timesheet edit with history
-- ---------------------------------------------------------------------------
create function set_assignment_time(
  p_assignment uuid,
  p_field text,
  p_value timestamptz,
  p_reason text default null
) returns assignments
language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_old timestamptz;
  v_row assignments;
begin
  if p_field not in ('actual_arrival', 'actual_work_stop', 'actual_departure', 'call_time', 'planned_wrap') then
    raise exception 'Недопустимое поле';
  end if;

  v_project := shift_project(assignment_shift(p_assignment));
  if not is_project_member(v_project, 'coordinator') then
    raise exception 'Недостаточно прав для изменения табеля';
  end if;

  execute format('select %I from assignments where id = $1', p_field) into v_old using p_assignment;
  execute format('update assignments set %I = $1 where id = $2', p_field) using p_value, p_assignment;
  select * into v_row from assignments where id = p_assignment;

  insert into time_edit_log (assignment_id, field, old_value, new_value, reason, edited_by)
  values (p_assignment, p_field, v_old, p_value, p_reason, auth.uid());

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table invites enable row level security;
alter table join_attempts enable row level security;
alter table locations enable row level security;
alter table contacts enable row level security;
alter table shifts enable row level security;
alter table shift_status_log enable row level security;
alter table member_shift_status enable row level security;
alter table scenes enable row level security;
alter table assignments enable row level security;
alter table time_edit_log enable row level security;
alter table board_events enable row level security;
alter table channels enable row level security;
alter table messages enable row level security;
alter table kpp_days enable row level security;

-- profiles: users manage their own row, and can be seen by project co-members
create policy profiles_self_select on profiles for select using (id = auth.uid());
create policy profiles_self_update on profiles for update using (id = auth.uid());

-- projects
create policy projects_select on projects for select using (is_project_member(id, 'member'));
create policy projects_insert on projects for insert with check (created_by = auth.uid());
create policy projects_update on projects for update using (is_project_member(id, 'owner'));

-- project_members
create policy project_members_select on project_members for select using (is_project_member(project_id, 'member'));
create policy project_members_update on project_members for update using (is_project_member(project_id, 'owner'));

-- invites: owner only, never publicly browsable
create policy invites_select on invites for select using (is_project_member(project_id, 'owner'));

-- join_attempts: users can see only their own attempts (mostly written by RPC)
create policy join_attempts_select on join_attempts for select using (user_id = auth.uid());

-- locations
create policy locations_select on locations for select using (is_project_member(project_id, 'member'));
create policy locations_write on locations for insert with check (is_project_member(project_id, 'coordinator'));
create policy locations_update on locations for update using (is_project_member(project_id, 'coordinator'));
create policy locations_delete on locations for delete using (is_project_member(project_id, 'coordinator'));

-- contacts
create policy contacts_select on contacts for select using (is_project_member(project_id, 'member'));
create policy contacts_write on contacts for insert with check (is_project_member(project_id, 'coordinator'));
create policy contacts_update on contacts for update using (is_project_member(project_id, 'coordinator'));
create policy contacts_delete on contacts for delete using (is_project_member(project_id, 'coordinator'));

-- shifts
create policy shifts_select on shifts for select using (is_project_member(project_id, 'member'));
create policy shifts_write on shifts for insert with check (is_project_member(project_id, 'coordinator'));
create policy shifts_update on shifts for update using (is_project_member(project_id, 'coordinator'));

-- shift_status_log / member_shift_status
create policy shift_status_log_select on shift_status_log for select using (is_project_member(shift_project(shift_id), 'member'));
create policy member_shift_status_select on member_shift_status for select using (is_project_member(shift_project(shift_id), 'member'));
create policy member_shift_status_write on member_shift_status for insert with check (user_id = auth.uid());
create policy member_shift_status_update on member_shift_status for update using (user_id = auth.uid());

-- scenes
create policy scenes_select on scenes for select using (is_project_member(project_id, 'member'));
create policy scenes_write on scenes for insert with check (is_project_member(project_id, 'coordinator'));
create policy scenes_update on scenes for update using (is_project_member(project_id, 'coordinator'));
create policy scenes_delete on scenes for delete using (is_project_member(project_id, 'coordinator'));

-- assignments (direct writes for creating rows; time-field edits go through set_assignment_time)
create policy assignments_select on assignments for select using (is_project_member(shift_project(shift_id), 'member'));
create policy assignments_write on assignments for insert with check (is_project_member(shift_project(shift_id), 'coordinator'));
create policy assignments_update on assignments for update using (is_project_member(shift_project(shift_id), 'coordinator'));
create policy assignments_delete on assignments for delete using (is_project_member(shift_project(shift_id), 'coordinator'));

-- time_edit_log: read-only history for members
create policy time_edit_log_select on time_edit_log for select using (
  is_project_member(shift_project(assignment_shift(assignment_id)), 'member')
);

-- board_events
create policy board_events_select on board_events for select using (is_project_member(project_id, 'member'));
create policy board_events_insert on board_events for insert with check (
  is_project_member(project_id, (case when type in ('change', 'lunch') then 'coordinator' else 'member' end)::project_role)
  and author_id = auth.uid()
);

-- channels
create policy channels_select on channels for select using (is_project_member(project_id, 'member'));
create policy channels_write on channels for insert with check (is_project_member(project_id, 'member'));

-- messages
create policy messages_select on messages for select using (is_project_member(channel_project(channel_id), 'member'));
create policy messages_insert on messages for insert with check (
  is_project_member(channel_project(channel_id), 'member') and author_id = auth.uid()
);
create policy messages_update on messages for update using (author_id = auth.uid());

-- kpp_days
create policy kpp_days_select on kpp_days for select using (is_project_member(project_id, 'member'));
create policy kpp_days_write on kpp_days for insert with check (is_project_member(project_id, 'coordinator'));
create policy kpp_days_update on kpp_days for update using (is_project_member(project_id, 'coordinator'));
