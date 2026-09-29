-- Legacy Music Center - LOGIN v4
-- Supabase-only login. No Apps Script / Spreadsheet involvement.
--
-- Root cause of the previous timeout:
-- verify_legacy_login mixed account lookup and bcrypt crypt() in one WHERE.
-- PostgreSQL is free to reorder predicates, so the expensive crypt() could be
-- evaluated for many active accounts before the username condition was applied.
--
-- Fix: force candidate lookup first with a MATERIALIZED CTE, then execute
-- bcrypt only once for that single account.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.verify_legacy_login(
  p_role text,
  p_username text,
  p_password text
)
returns table(
  user_id text,
  role text,
  display_name text,
  active boolean
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
      a.password_bcrypt
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
    c.active
  from candidate c
  where c.password_bcrypt = extensions.crypt(p_password, c.password_bcrypt);
$function$;

-- Optional but useful as the number of accounts grows.
create index if not exists auth_accounts_role_active_idx
  on public.auth_accounts (role, active);

create index if not exists auth_accounts_user_id_lower_trim_idx
  on public.auth_accounts ((lower(trim(user_id))));

create index if not exists auth_accounts_display_name_lower_trim_idx
  on public.auth_accounts ((lower(trim(display_name))));

grant usage on schema public to service_role;
grant execute on function public.verify_legacy_login(text, text, text) to service_role;

notify pgrst, 'reload schema';
