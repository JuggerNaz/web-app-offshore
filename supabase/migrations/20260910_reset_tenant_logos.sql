-- ==============================================================================
-- Migration: Ensure Per-Tenant Logo Isolation & Optional Logo Reset
-- ==============================================================================

-- 1. Ensure public.companies has logo_url column
ALTER TABLE IF EXISTS public.companies ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Ensure public.company_settings has logo_path and company_id
ALTER TABLE IF EXISTS public.company_settings ADD COLUMN IF NOT EXISTS logo_path TEXT;
ALTER TABLE IF EXISTS public.company_settings ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 3. If any tenant other than Petronas (e.g. NasQuest or others) inherited the Petronas logo
--    from earlier legacy migrations, this statement clears the borrowed logo so each company
--    can independently upload its own distinctive branding logo:
-- (Uncomment or execute if you want to reset non-Petronas logos to blank)
-- UPDATE public.company_settings
-- SET logo_path = NULL
-- WHERE company_id IN (
--   SELECT id FROM public.companies WHERE slug != 'petronas' AND name NOT ILIKE '%petronas%'
-- );
--
-- UPDATE public.companies
-- SET logo_url = NULL
-- WHERE slug != 'petronas' AND name NOT ILIKE '%petronas%';
