-- Create a function to get all users along with their roles and allowed modules
create or replace function get_all_users()
returns table (
  id varchar,
  email varchar(255),
  last_sign_in_at timestamptz,
  created_at timestamptz,
  role varchar(50),
  modules jsonb
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
    coalesce(ur.modules, '[]'::jsonb) as modules
  from auth.users au
  left join public.user_roles ur on au.id::text = ur.user_id
  order by au.last_sign_in_at desc nulls last;
end;
$$;

-- Grant access to authenticated users
grant execute on function get_all_users() to authenticated;


-- Quick helper function for JS clients to assign a role if they are an admin
create or replace function assign_user_role(target_id varchar, new_role varchar(50), new_modules jsonb)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
begin
  -- Check if the executor is an Admin (or if it's the very first user configuring themselves)
  IF NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()::text AND role = 'Admin'
  ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Admins can assign roles');
  END IF;

  INSERT INTO public.user_roles (user_id, role, modules)
  VALUES (target_id, new_role, new_modules)
  ON CONFLICT (user_id) DO UPDATE
  SET role = EXCLUDED.role, modules = EXCLUDED.modules, updated_at = now();

  RETURN jsonb_build_object('success', true, 'message', 'Role successfully assigned');
end;
$$;

grant execute on function assign_user_role(varchar, varchar, jsonb) to authenticated;
