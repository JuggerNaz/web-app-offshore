-- ==============================================================================
-- Migration: Enhance Companies Table & Fix RLS Recursion for Tenant Creation
-- ==============================================================================

-- 1. Add all extended company details columns to public.companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS serial_no TEXT,
ADD COLUMN IF NOT EXISTS registration_no TEXT,
ADD COLUMN IF NOT EXISTS tax_id TEXT,
ADD COLUMN IF NOT EXISTS company_email TEXT,
ADD COLUMN IF NOT EXISTS contact_person TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. SECURITY DEFINER HELPER FUNCTIONS (Bypasses RLS recursion completely)
CREATE OR REPLACE FUNCTION public.check_user_is_super_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF user_uuid IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = user_uuid
    AND role = 'super_admin'
    AND is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid::text
    AND role = 'Admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_user_is_member_of_company(user_uuid UUID, company_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF user_uuid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Super admin / Admin can access all companies
  IF public.check_user_is_super_admin(user_uuid) THEN
    RETURN TRUE;
  END IF;

  -- Otherwise check specific company membership
  RETURN EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = user_uuid
    AND company_id = company_uuid
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_user_is_admin_of_company(user_uuid UUID, company_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF user_uuid IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.check_user_is_super_admin(user_uuid) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = user_uuid
    AND company_id = company_uuid
    AND role IN ('super_admin', 'company_admin')
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. DROP ALL EXISTING POLICIES ON public.companies TO PREVENT CONFLICTS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their companies" ON public.companies;
DROP POLICY IF EXISTS "Super admins can manage companies" ON public.companies;
DROP POLICY IF EXISTS "Super admins can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Super admins can update companies" ON public.companies;
DROP POLICY IF EXISTS "Super admins can delete companies" ON public.companies;
DROP POLICY IF EXISTS "Allow view companies" ON public.companies;
DROP POLICY IF EXISTS "Allow insert companies" ON public.companies;
DROP POLICY IF EXISTS "Allow update companies" ON public.companies;
DROP POLICY IF EXISTS "Allow delete companies" ON public.companies;

-- 4. RECREATE CLEAN, NON-RECURSIVE RLS POLICIES ON public.companies
CREATE POLICY "Allow view companies"
  ON public.companies FOR SELECT
  USING (public.check_user_is_member_of_company(auth.uid(), id));

CREATE POLICY "Allow insert companies"
  ON public.companies FOR INSERT
  WITH CHECK (public.check_user_is_super_admin(auth.uid()));

CREATE POLICY "Allow update companies"
  ON public.companies FOR UPDATE
  USING (public.check_user_is_super_admin(auth.uid()));

CREATE POLICY "Allow delete companies"
  ON public.companies FOR DELETE
  USING (public.check_user_is_super_admin(auth.uid()));

-- 5. RECREATE CLEAN, NON-RECURSIVE RLS POLICIES ON public.company_memberships
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view company memberships" ON public.company_memberships;
DROP POLICY IF EXISTS "Admins can invite to company" ON public.company_memberships;
DROP POLICY IF EXISTS "Admins can update company memberships" ON public.company_memberships;
DROP POLICY IF EXISTS "Users can view own membership" ON public.company_memberships;

CREATE POLICY "Users can view own membership"
  ON public.company_memberships FOR SELECT
  USING (user_id = auth.uid() OR public.check_user_is_admin_of_company(auth.uid(), company_id));

CREATE POLICY "Admins can invite to company"
  ON public.company_memberships FOR INSERT
  WITH CHECK (public.check_user_is_admin_of_company(auth.uid(), company_id));

CREATE POLICY "Admins can update company memberships"
  ON public.company_memberships FOR UPDATE
  USING (public.check_user_is_admin_of_company(auth.uid(), company_id));
