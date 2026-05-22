-- =========================================================================
-- 1. SECURITY DEFINER HELPER FUNCTIONS (BYPASS RLS RECURSION)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.check_user_is_super_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = user_uuid
    AND role = 'super_admin'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_user_is_company_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = user_uuid
    AND role IN ('super_admin', 'company_admin')
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_user_is_admin_of_company(user_uuid UUID, company_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = user_uuid
    AND company_id = company_uuid
    AND role IN ('super_admin', 'company_admin')
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_user_is_member_of_company(user_uuid UUID, company_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = user_uuid
    AND company_id = company_uuid
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================================================================
-- 2. DROP AND RE-APPLY SECURE RLS POLICIES
-- =========================================================================

-- A. On public.companies
DROP POLICY IF EXISTS "Members can view their companies" ON public.companies;
CREATE POLICY "Members can view their companies"
  ON public.companies FOR SELECT
  USING (public.check_user_is_member_of_company(auth.uid(), id));

DROP POLICY IF EXISTS "Super admins can manage companies" ON public.companies;
CREATE POLICY "Super admins can manage companies"
  ON public.companies FOR ALL
  USING (public.check_user_is_super_admin(auth.uid()));

-- B. On public.profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.check_user_is_company_admin(auth.uid()));

-- C. On public.company_memberships
DROP POLICY IF EXISTS "Admins can view company memberships" ON public.company_memberships;
CREATE POLICY "Admins can view company memberships"
  ON public.company_memberships FOR SELECT
  USING (public.check_user_is_admin_of_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Admins can invite to company" ON public.company_memberships;
CREATE POLICY "Admins can invite to company"
  ON public.company_memberships FOR INSERT
  WITH CHECK (public.check_user_is_admin_of_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Admins can update company memberships" ON public.company_memberships;
CREATE POLICY "Admins can update company memberships"
  ON public.company_memberships FOR UPDATE
  USING (public.check_user_is_admin_of_company(auth.uid(), company_id));

-- =========================================================================
-- 3. BOOTSTRAP DEFAULT COMPANY AND SYNC DATABASE USERS
-- =========================================================================

-- Ensure a default company exists if the table is currently empty
INSERT INTO public.companies (name, slug)
SELECT 'Nasquest Offshore', 'nasquest-offshore'
WHERE NOT EXISTS (SELECT 1 FROM public.companies)
ON CONFLICT (slug) DO NOTHING;

-- Sync all users in auth.users to public.profiles
INSERT INTO public.profiles (id, email, full_name, is_active)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  true
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Connect all profiles to default company membership (locked / inactive by default)
INSERT INTO public.company_memberships (user_id, company_id, role, is_active)
SELECT
  p.id,
  c.id,
  'viewer'::public.user_role,
  false -- Locked / disabled by default
FROM public.profiles p
CROSS JOIN (SELECT id FROM public.companies ORDER BY created_at LIMIT 1) c
LEFT JOIN public.company_memberships cm ON cm.user_id = p.id AND cm.company_id = c.id
WHERE cm.id IS NULL
ON CONFLICT (user_id, company_id) DO NOTHING;

-- Explicitly deactivate company memberships for everyone EXCEPT jitesh@nasquest.com (case-insensitive)
UPDATE public.company_memberships
SET is_active = false
WHERE user_id NOT IN (
  SELECT id FROM public.profiles WHERE LOWER(TRIM(email)) = 'jitesh@nasquest.com'
);

-- =========================================================================
-- 4. PROMOTE JITESH TO SUPER ADMIN WITH FULL SYSTEM MODULE CONTROL
-- =========================================================================

-- Ensure Jitesh's profile is active and clean
UPDATE public.profiles
SET is_active = true
WHERE LOWER(TRIM(email)) = 'jitesh@nasquest.com';

-- Set Jitesh's company membership role to super_admin and set active
UPDATE public.company_memberships
SET role = 'super_admin',
    is_active = true
WHERE user_id = (SELECT id FROM public.profiles WHERE LOWER(TRIM(email)) = 'jitesh@nasquest.com');

-- Grant Jitesh Admin permissions with full module access in user_roles (System B)
INSERT INTO public.user_roles (user_id, role, modules)
VALUES (
  (SELECT id::text FROM auth.users WHERE LOWER(TRIM(email)) = 'jitesh@nasquest.com'),
  'Admin',
  '["Field Assets", "Work Packages", "Planning", "Inspection", "Reports", "Library", "User Data", "Settings", "ROV", "Diving"]'::jsonb
)
ON CONFLICT (user_id) DO UPDATE
SET role = 'Admin',
    modules = '["Field Assets", "Work Packages", "Planning", "Inspection", "Reports", "Library", "User Data", "Settings", "ROV", "Diving"]'::jsonb;
