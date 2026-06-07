-- ============================================================
-- BOOTSTRAP USERS AND COMPANIES
-- ============================================================

-- 1. Create default company
INSERT INTO public.companies (name, slug)
VALUES ('Offshore Data Management', 'offshore-data-mgmt')
ON CONFLICT (slug) DO NOTHING;

-- 2. Create profiles for all existing users
INSERT INTO public.profiles (id, email, full_name)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', '')
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- 3. Create memberships for all existing users (default: viewer)
INSERT INTO public.company_memberships (user_id, company_id, role)
SELECT
  p.id,
  c.id,
  'viewer'::public.user_role
FROM public.profiles p
CROSS JOIN (SELECT id FROM public.companies ORDER BY created_at LIMIT 1) c
LEFT JOIN public.company_memberships cm ON cm.user_id = p.id AND cm.company_id = c.id
WHERE cm.id IS NULL;

-- 4. Promote your account to super_admin
UPDATE public.company_memberships
SET role = 'super_admin'
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'jitesh@nasquest.com');
