-- Create a function to get all users' basic info
-- SECURITY WARNING: This allows ANY logged-in user to see ALL users' emails and sign-in activity.
create or replace function get_all_users()
returns table (
  id uuid,
  email varchar(255),
  last_sign_in_at timestamptz,
  created_at timestamptz
)
security definer -- Runs with the privileges of the creator (admin)
set search_path = public -- Secure search path
language plpgsql
as $$
begin
  return query
  select
    au.id,
    au.email,
    au.last_sign_in_at,
    au.created_at
  from auth.users au
  order by au.last_sign_in_at desc nulls last;
end;
$$;

-- Grant access to authenticated users
grant execute on function get_all_users() to authenticated;
