-- СМЕНА: lock down function search_path and remove unintended public RPC exposure.
-- Helper/trigger functions are implementation details of RLS policies and
-- triggers; they must not be independently callable as public REST endpoints.

alter function set_updated_at() set search_path = public;
alter function role_rank(project_role) set search_path = public;
alter function generate_invite_code() set search_path = public;

revoke execute on function set_updated_at() from public, anon, authenticated;
revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function role_rank(project_role) from public, anon, authenticated;
revoke execute on function generate_invite_code() from public, anon, authenticated;
revoke execute on function is_project_member(uuid, project_role) from public, anon;
revoke execute on function shift_project(uuid) from public, anon;
revoke execute on function assignment_shift(uuid) from public, anon;
revoke execute on function channel_project(uuid) from public, anon;

grant execute on function is_project_member(uuid, project_role) to authenticated;
grant execute on function shift_project(uuid) to authenticated;
grant execute on function assignment_shift(uuid) to authenticated;
grant execute on function channel_project(uuid) to authenticated;

revoke execute on function create_project(text, date, text, text) from public, anon;
revoke execute on function create_invite(uuid, project_role, int, int) from public, anon;
revoke execute on function revoke_invite(uuid) from public, anon;
revoke execute on function redeem_invite(text, text) from public, anon;
revoke execute on function set_member_role(uuid, uuid, project_role) from public, anon;
revoke execute on function remove_member(uuid, uuid) from public, anon;
revoke execute on function set_shift_status(uuid, shift_status) from public, anon;
revoke execute on function set_my_shift_status(uuid, member_status) from public, anon;
revoke execute on function set_assignment_time(uuid, text, timestamptz, text) from public, anon;

grant execute on function create_project(text, date, text, text) to authenticated;
grant execute on function create_invite(uuid, project_role, int, int) to authenticated;
grant execute on function revoke_invite(uuid) to authenticated;
grant execute on function redeem_invite(text, text) to authenticated;
grant execute on function set_member_role(uuid, uuid, project_role) to authenticated;
grant execute on function remove_member(uuid, uuid) to authenticated;
grant execute on function set_shift_status(uuid, shift_status) to authenticated;
grant execute on function set_my_shift_status(uuid, member_status) to authenticated;
grant execute on function set_assignment_time(uuid, text, timestamptz, text) to authenticated;
