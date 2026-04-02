-- 1. Add last_seen_at to public.user_roles if it doesn't exist
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_roles' and column_name = 'last_seen_at') then
    alter table public.user_roles add column last_seen_at timestamptz default now();
  end if;
end $$;

-- 2. Create a heartbeat RPC function
create or replace function update_user_heartbeat()
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
begin
  -- Ensure user_roles exists for this user, if not create a default one
  insert into public.user_roles (user_id, role, modules, last_seen_at, updated_at)
  values (auth.uid()::text, 'User', '[]'::jsonb, now(), now())
  on conflict (user_id) do update
  set last_seen_at = now(), updated_at = now();

  return jsonb_build_object('success', true, 'last_seen_at', now());
end;
$$;

-- Grant execution to authenticated users
grant execute on function update_user_heartbeat() to authenticated;

-- 3. Update get_all_users() to include last_seen_at
create or replace function get_all_users()
returns table (
  id varchar,
  email varchar(255),
  last_sign_in_at timestamptz,
  created_at timestamptz,
  role varchar(50),
  modules jsonb,
  last_seen_at timestamptz,
  full_name varchar,
  designation varchar,
  avatar_url varchar
)
security definer
set search_path = public
language plpgsql
as $$
begin
  return query
  select
    au.id::varchar,
    au.email,
    au.last_sign_in_at,
    au.created_at,
    coalesce(ur.role, 'User'::varchar(50)) as role,
    coalesce(ur.modules, '[]'::jsonb) as modules,
    ur.last_seen_at,
    (au.raw_user_meta_data->>'full_name')::varchar,
    (au.raw_user_meta_data->>'designation')::varchar,
    (au.raw_user_meta_data->>'avatar_url')::varchar
  from auth.users au
  left join public.user_roles ur on au.id::text = ur.user_id
  order by coalesce(ur.last_seen_at, au.last_sign_in_at) desc nulls last;
end;
$$;

grant execute on function get_all_users() to authenticated;
