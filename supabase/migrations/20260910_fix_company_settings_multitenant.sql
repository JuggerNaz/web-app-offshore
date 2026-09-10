-- ==============================================================================
-- Fix: Company Settings Multi-Tenant Unlocking & RLS Permissions
-- ==============================================================================

-- 1. Ensure company_id column exists
ALTER TABLE IF EXISTS public.company_settings ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. Drop legacy single-row check constraint
ALTER TABLE IF EXISTS public.company_settings DROP CONSTRAINT IF EXISTS company_settings_single_row;

-- 3. Scope unique constraint to company_id
ALTER TABLE IF EXISTS public.company_settings DROP CONSTRAINT IF EXISTS company_settings_company_id_key;
ALTER TABLE IF EXISTS public.company_settings ADD CONSTRAINT company_settings_company_id_key UNIQUE (company_id);

-- 4. Enable RLS and grant full authenticated CRUD permissions
ALTER TABLE IF EXISTS public.company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read settings" ON public.company_settings;
DROP POLICY IF EXISTS "Allow authenticated users to update settings" ON public.company_settings;
DROP POLICY IF EXISTS "Allow authenticated users to insert settings" ON public.company_settings;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.company_settings;

CREATE POLICY "Allow all for authenticated users" ON public.company_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Backfill any existing company_settings rows with the default company_id if null
UPDATE public.company_settings
SET company_id = (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;
