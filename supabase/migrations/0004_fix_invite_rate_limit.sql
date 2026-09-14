-- Баг: redeem_invite писал неудачную попытку в join_attempts, а затем
-- бросал RAISE EXCEPTION в том же вызове. Postgres откатывает ВЕСЬ RPC-вызов
-- при необработанном исключении — значит откатывалась и сама запись о
-- попытке, и rate-limit по факту никогда не срабатывал (счётчик неудач
-- оставался нулевым). Обнаружено прямым тестом на реальном проекте через
-- SQL-имперсонацию пользователей — 9 заведомо неверных кодов не привели к
-- блокировке.
--
-- Исправление: функция больше не бросает исключение на ожидаемых отказах
-- (неверный код, истёк срок, превышен rate-limit) — она возвращает jsonb
-- {ok, error, project}, поэтому лог попытки коммитится как часть обычной
-- успешной транзакции. Клиент сам выбрасывает JS-ошибку при ok = false.

drop function redeem_invite(text, text);

create function redeem_invite(p_code text, p_display_name text)
returns jsonb
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
    return jsonb_build_object('ok', false, 'error', 'Слишком много попыток. Подождите несколько минут и попробуйте снова.');
  end if;

  select * into v_invite from invites where code = v_norm_code;

  if v_invite.id is null
     or v_invite.revoked_at is not null
     or v_invite.expires_at <= now()
     or (v_invite.max_uses > 0 and v_invite.uses_count >= v_invite.max_uses)
  then
    insert into join_attempts (user_id, attempted_code, success) values (auth.uid(), v_norm_code, false);
    return jsonb_build_object('ok', false, 'error', 'Код недействителен или срок его действия истёк');
  end if;

  select * into v_project from projects where id = v_invite.project_id;

  insert into project_members (project_id, user_id, role, display_name)
  values (v_invite.project_id, auth.uid(), v_invite.role, coalesce(nullif(trim(p_display_name), ''), 'Пользователь'))
  on conflict (project_id, user_id) do update set status = 'active';

  update invites set uses_count = uses_count + 1 where id = v_invite.id;
  insert into join_attempts (user_id, attempted_code, success) values (auth.uid(), v_norm_code, true);

  return jsonb_build_object('ok', true, 'error', null, 'project', to_jsonb(v_project));
end;
$$;

revoke execute on function redeem_invite(text, text) from public, anon;
grant execute on function redeem_invite(text, text) to authenticated;
