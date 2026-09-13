-- ==============================================================================
-- Universal Fix: Ensure ALL users have Active Profiles & Company Memberships
-- ==============================================================================
-- Run this in Supabase SQL Editor to automatically link and activate every user.

DO $$
DECLARE
  default_company_id UUID;
BEGIN
  -- 1. Ensure a default company exists
  SELECT id INTO default_company_id FROM public.companies ORDER BY created_at ASC LIMIT 1;

  IF default_company_id IS NULL THEN
    INSERT INTO public.companies (name, slug)
    VALUES ('Default Organization', 'default-org')
    RETURNING id INTO default_company_id;
  END IF;

  -- 2. Create/Activate profiles for all auth.users
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    designation,
    is_active,
    must_change_password,
    created_at,
    updated_at
  )
  SELECT 
    au.id,
    au.email,
    coalesce(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    coalesce(au.raw_user_meta_data->>'designation', 'Offshore Staff'),
    true, -- is_active = true
    coalesce((au.raw_user_meta_data->>'must_change_password')::boolean, false),
    coalesce(au.created_at, now()),
    now()
  FROM auth.users au
  ON CONFLICT (id) DO UPDATE
  SET is_active = true, updated_at = now();

  -- 3. Create active company membership for any user missing one
  INSERT INTO public.company_memberships (
    user_id,
    company_id,
    role,
    is_active,
    created_at,
    updated_at
  )
  SELECT 
    p.id,
    default_company_id,
    'inspector',
    true,
    now(),
    now()
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.company_memberships cm 
    WHERE cm.user_id = p.id AND cm.is_active = true
  )
  ON CONFLICT (user_id, company_id) DO UPDATE
  SET is_active = true, updated_at = now();

  -- 4. Create default user_roles for any user missing roles
  INSERT INTO public.user_roles (
    user_id,
    role,
    modules,
    updated_at
  )
  SELECT 
    p.id::text,
    'Operator',
    '["Field Assets", "Planning", "Inspection", "Work Packages", "Reports", "Platform 3D", "Smart Query"]'::jsonb,
    now()
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = p.id::text
  )
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE 'SUCCESS: All user profiles, company memberships, and roles are now active and synced!';
END $$;
