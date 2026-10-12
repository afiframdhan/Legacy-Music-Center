-- Legacy Music Center - Release hardening
-- 1) Unique initial passwords + force-change flag
-- 2) Login rate-limit state
-- 3) Password change RPC

create extension if not exists pgcrypto with schema extensions;

alter table if exists public.auth_accounts
  add column if not exists must_change_password boolean not null default false;

create table if not exists public.login_attempt_guard (
  attempt_key text primary key,
  fail_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists login_attempt_guard_blocked_until_idx
  on public.login_attempt_guard (blocked_until);

drop function if exists public.verify_legacy_login(text,text,text);

create or replace function public.verify_legacy_login(
  p_role text,
  p_username text,
  p_password text
)
returns table(
  user_id text,
  role text,
  display_name text,
  active boolean,
  must_change_password boolean
)
language sql
security definer
set search_path = public, extensions
as $function$
  with candidate as materialized (
    select
      a.user_id,
      a.role,
      a.display_name,
      a.active,
      a.password_bcrypt,
      coalesce(a.must_change_password, false) as must_change_password
    from public.auth_accounts a
    where a.role = lower(trim(p_role))
      and a.active = true
      and a.password_bcrypt is not null
      and (
        lower(trim(a.user_id)) = lower(trim(p_username))
        or lower(trim(a.display_name)) = lower(trim(p_username))
      )
    limit 1
  )
  select
    c.user_id,
    c.role,
    c.display_name,
    c.active,
    c.must_change_password
  from candidate c
  where c.password_bcrypt = extensions.crypt(p_password, c.password_bcrypt);
$function$;

create or replace function public.legacy_set_account_password(
  p_user_id text,
  p_role text,
  p_password text,
  p_must_change boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_count integer;
begin
  if length(coalesce(p_password,'')) < 8 then
    raise exception 'Password minimal 8 karakter.';
  end if;

  update public.auth_accounts
     set password_bcrypt = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
         must_change_password = coalesce(p_must_change, true)
   where user_id = p_user_id
     and role = lower(trim(p_role));

  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'Akun login tidak ditemukan.'; end if;
  return jsonb_build_object('success', true);
end;
$function$;

create or replace function public.legacy_change_own_password(
  p_user_id text,
  p_role text,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_count integer;
begin
  if length(coalesce(p_new_password,'')) < 8 then
    raise exception 'Password minimal 8 karakter.';
  end if;
  if p_new_password !~ '[A-Za-z]' or p_new_password !~ '[0-9]' then
    raise exception 'Password harus mengandung huruf dan angka.';
  end if;

  update public.auth_accounts
     set password_bcrypt = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
         must_change_password = false
   where user_id = p_user_id
     and role = lower(trim(p_role))
     and active = true;

  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'Akun login tidak ditemukan.'; end if;
  return jsonb_build_object('success', true, 'message', 'Password berhasil diperbarui.');
end;
$function$;

create or replace function public.legacy_login_guard_status(p_key text)
returns table(allowed boolean, retry_after_seconds integer)
language sql
security definer
set search_path = public
as $function$
  select
    case when g.blocked_until is null or g.blocked_until <= now() then true else false end as allowed,
    case when g.blocked_until is null or g.blocked_until <= now() then 0 else greatest(1, ceil(extract(epoch from (g.blocked_until - now())))::integer) end as retry_after_seconds
  from (select 1) s
  left join public.login_attempt_guard g on g.attempt_key = p_key;
$function$;

create or replace function public.legacy_record_login_attempt(p_key text, p_success boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_now timestamptz := now();
  v_row public.login_attempt_guard%rowtype;
  v_count integer;
  v_block interval;
  v_existing boolean := false;
begin
  if coalesce(p_key,'') = '' then return jsonb_build_object('success', true); end if;

  if p_success then
    delete from public.login_attempt_guard where attempt_key = p_key;
    return jsonb_build_object('success', true, 'failCount', 0);
  end if;

  select * into v_row from public.login_attempt_guard where attempt_key = p_key for update;
  v_existing := found;
  if not v_existing or v_row.window_started_at < v_now - interval '30 minutes' then
    v_count := 1;
  else
    v_count := coalesce(v_row.fail_count,0) + 1;
  end if;

  v_block := case
    when v_count >= 10 then interval '15 minutes'
    when v_count >= 7 then interval '5 minutes'
    when v_count >= 5 then interval '1 minute'
    else interval '0 seconds'
  end;

  insert into public.login_attempt_guard(attempt_key,fail_count,window_started_at,blocked_until,updated_at)
  values(p_key,v_count,case when not v_existing then v_now else coalesce(v_row.window_started_at,v_now) end,
         case when v_block > interval '0 seconds' then v_now + v_block else null end,v_now)
  on conflict(attempt_key) do update set
    fail_count=excluded.fail_count,
    window_started_at=case when public.login_attempt_guard.window_started_at < v_now - interval '30 minutes' then v_now else public.login_attempt_guard.window_started_at end,
    blocked_until=excluded.blocked_until,
    updated_at=v_now;

  return jsonb_build_object('success', true, 'failCount', v_count, 'blockedSeconds', extract(epoch from v_block)::integer);
end;
$function$;

grant execute on function public.verify_legacy_login(text,text,text) to service_role;
grant execute on function public.legacy_set_account_password(text,text,text,boolean) to service_role;
grant execute on function public.legacy_change_own_password(text,text,text) to service_role;
grant execute on function public.legacy_login_guard_status(text) to service_role;
grant execute on function public.legacy_record_login_attempt(text,boolean) to service_role;

notify pgrst, 'reload schema';
