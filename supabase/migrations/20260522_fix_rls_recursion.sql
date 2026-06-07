-- =========================================================================
-- 1. SECURITY DEFINER HELPER FUNCTIONS
-- =========================================================================

-- Helper to check if a user is a super_admin in ANY active company membership
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

-- Helper to check if a user is a company_admin or super_admin in ANY active company membership
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

-- Helper to check if a user is an admin of a SPECIFIC company
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

-- Helper to check if a user is a member of a SPECIFIC company
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
-- 2. DROP RECURSIVE POLICIES AND CREATE SAFE ONES
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
-- 3. MODIFY TRIGGER TO INACTIVE-BY-DEFAULT ON SIGNUP
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_company_id UUID;
BEGIN
  -- Get the default company (first company, or create one)
  SELECT id INTO default_company_id
  FROM public.companies
  ORDER BY created_at ASC
  LIMIT 1;

  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url, designation)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'designation', '')
  );

  -- Create membership to default company as viewer and inactive (disabled/locked) by default
  IF default_company_id IS NOT NULL THEN
    INSERT INTO public.company_memberships (user_id, company_id, role, is_active)
    VALUES (NEW.id, default_company_id, 'viewer', false);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- 4. BOOTSTRAP EXISTING USERS (AS INACTIVE VIEWERS BY DEFAULT)
-- =========================================================================

-- Ensure all auth.users have a profile
INSERT INTO public.profiles (id, email, full_name)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', '')
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Ensure all profiles have a company membership (default to first company)
INSERT INTO public.company_memberships (user_id, company_id, role, is_active)
SELECT
  p.id,
  c.id,
  'viewer'::public.user_role,
  false -- default to inactive / disabled
FROM public.profiles p
CROSS JOIN (SELECT id FROM public.companies ORDER BY created_at LIMIT 1) c
LEFT JOIN public.company_memberships cm ON cm.user_id = p.id AND cm.company_id = c.id
WHERE cm.id IS NULL
ON CONFLICT (user_id, company_id) DO NOTHING;

-- Deactivate all company memberships EXCEPT jitesh@nasquest.com to ensure they are locked by default
UPDATE public.company_memberships
SET is_active = false
WHERE user_id NOT IN (SELECT id FROM public.profiles WHERE email = 'jitesh@nasquest.com');


-- =========================================================================
-- 5. PROMOTE JITESH AND SET ADMIN ROLES
-- =========================================================================

-- Promote Jitesh to super_admin in company_memberships (and ensure active)
UPDATE public.company_memberships
SET role = 'super_admin',
    is_active = true
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'jitesh@nasquest.com');

-- Set Jitesh to Admin with full module access in user_roles
INSERT INTO public.user_roles (user_id, role, modules)
VALUES (
  (SELECT id::text FROM auth.users WHERE email = 'jitesh@nasquest.com'),
  'Admin',
  '["Field Assets", "Work Packages", "Planning", "Inspection", "Reports", "Library", "User Data", "Settings", "ROV", "Diving"]'::jsonb
)
ON CONFLICT (user_id) DO UPDATE
SET role = 'Admin',
    modules = '["Field Assets", "Work Packages", "Planning", "Inspection", "Reports", "Library", "User Data", "Settings", "ROV", "Diving"]'::jsonb;
