-- ============================================================
-- 1. ENUM TYPE
-- ============================================================
CREATE TYPE public.user_role AS ENUM (
  'super_admin',
  'company_admin',
  'manager',
  'inspector',
  'viewer'
);

-- ============================================================
-- 2. COMPANIES TABLE
-- ============================================================
CREATE TABLE public.companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  logo_url    TEXT,
  settings    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. PROFILES TABLE (identity only — no role)
-- ============================================================
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT DEFAULT '',
  avatar_url  TEXT DEFAULT '',
  designation TEXT DEFAULT '',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  last_sign_in TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. COMPANY MEMBERSHIPS TABLE (user ↔ company ↔ role)
-- ============================================================
CREATE TABLE public.company_memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role        public.user_role NOT NULL DEFAULT 'viewer',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  invited_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES FOR COMPANIES
-- ============================================================

-- Any authenticated user can read companies they belong to
CREATE POLICY "Members can view their companies"
  ON public.companies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.company_id = companies.id
      AND cm.user_id = auth.uid()
      AND cm.is_active = true
    )
  );

-- Super admins can manage companies
CREATE POLICY "Super admins can manage companies"
  ON public.companies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.user_id = auth.uid()
      AND cm.role = 'super_admin'
      AND cm.is_active = true
    )
  );

-- ============================================================
-- RLS POLICIES FOR PROFILES
-- ============================================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all profiles (for user management panel)
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.user_id = auth.uid()
      AND cm.role IN ('super_admin', 'company_admin')
      AND cm.is_active = true
    )
  );

-- Users can update their own profile (name, avatar, designation)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- RLS POLICIES FOR COMPANY MEMBERSHIPS
-- ============================================================

-- Users can see their own memberships
CREATE POLICY "Users can view own memberships"
  ON public.company_memberships FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all memberships in their company
CREATE POLICY "Admins can view company memberships"
  ON public.company_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.user_id = auth.uid()
      AND cm.company_id = company_memberships.company_id
      AND cm.role IN ('super_admin', 'company_admin')
      AND cm.is_active = true
    )
  );

-- Admins can insert memberships (invite users to company)
CREATE POLICY "Admins can invite to company"
  ON public.company_memberships FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.user_id = auth.uid()
      AND cm.company_id = company_memberships.company_id
      AND cm.role IN ('super_admin', 'company_admin')
      AND cm.is_active = true
    )
  );

-- Admins can update memberships (change role, deactivate)
CREATE POLICY "Admins can update company memberships"
  ON public.company_memberships FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.user_id = auth.uid()
      AND cm.company_id = company_memberships.company_id
      AND cm.role IN ('super_admin', 'company_admin')
      AND cm.is_active = true
    )
  );

-- ============================================================
-- 5. INDEXES
-- ============================================================
CREATE INDEX idx_memberships_user ON public.company_memberships(user_id);
CREATE INDEX idx_memberships_company ON public.company_memberships(company_id);
CREATE INDEX idx_memberships_role ON public.company_memberships(role);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- ============================================================
-- 6. AUTO-CREATE PROFILE + DEFAULT MEMBERSHIP ON SIGN-UP
-- ============================================================
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

  -- Create membership to default company as viewer
  IF default_company_id IS NOT NULL THEN
    INSERT INTO public.company_memberships (user_id, company_id, role)
    VALUES (NEW.id, default_company_id, 'viewer');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 7. UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER memberships_updated_at
  BEFORE UPDATE ON public.company_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
