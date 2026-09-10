-- ==============================================================================
-- SQL Fix: Activate User Profile and Assign Company Membership
-- ==============================================================================
-- Run this in your Supabase SQL Editor to link and activate the user.

DO $$
DECLARE
  target_user_email TEXT := 'user@example.com'; -- <--- CHANGE THIS to the user's email
  target_user_id UUID;
  default_company_id UUID;
BEGIN
  -- 1. Find the user ID
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE lower(email) = lower(target_user_email);

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User "%" not found in auth.users table.', target_user_email;
  END IF;

  -- 2. Find the active company ID (or pick the first available company)
  SELECT id INTO default_company_id
  FROM public.companies
  ORDER BY created_at ASC
  LIMIT 1;

  -- If no company exists at all, create a default company
  IF default_company_id IS NULL THEN
    INSERT INTO public.companies (name, slug)
    VALUES ('Default Organization', 'default-org')
    RETURNING id INTO default_company_id;
  END IF;

  -- 3. Ensure profile exists and is ACTIVE
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    designation,
    is_active,
    must_change_password,
    created_at,
    updated_at
  ) VALUES (
    target_user_id,
    target_user_email,
    coalesce((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = target_user_id), 'Staff User'),
    coalesce((SELECT raw_user_meta_data->>'designation' FROM auth.users WHERE id = target_user_id), 'Offshore Staff'),
    true,  -- is_active
    true,  -- must_change_password
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    is_active = true,
    email = EXCLUDED.email,
    updated_at = now();

  -- 4. Ensure Company Membership exists and is ACTIVE
  INSERT INTO public.company_memberships (
    user_id,
    company_id,
    role, -- 'super_admin', 'company_admin', 'manager', 'inspector', or 'viewer'
    is_active,
    created_at,
    updated_at
  ) VALUES (
    target_user_id,
    default_company_id,
    'inspector', -- Assign default role
    true,        -- Active membership
    now(),
    now()
  )
  ON CONFLICT (user_id, company_id) DO UPDATE
  SET 
    is_active = true,
    role = CASE WHEN company_memberships.role IS NULL THEN 'inspector' ELSE company_memberships.role END,
    updated_at = now();

  -- 5. Ensure user_roles has module access
  INSERT INTO public.user_roles (
    user_id,
    role,
    modules,
    updated_at
  ) VALUES (
    target_user_id::text,
    'Operator',
    '["Field Assets", "Planning", "Inspection", "Work Packages", "Reports", "Platform 3D", "Smart Query"]'::jsonb,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET updated_at = now();

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'SUCCESS: User % activated with Company Membership!', target_user_email;
  RAISE NOTICE 'User ID: %', target_user_id;
  RAISE NOTICE 'Company ID: %', default_company_id;
  RAISE NOTICE 'Profile Status: ACTIVE';
  RAISE NOTICE 'Membership Status: ACTIVE';
  RAISE NOTICE '=======================================================';
END $$;
