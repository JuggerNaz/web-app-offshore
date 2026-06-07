-- =========================================================================
-- MULTI-TENANT MIGRATION: Add company_id to all business tables
-- Strategy: Each tenant row gets a company_id FK. RLS policies enforce isolation.
-- Super admins can see all data. Regular users only see their company's data.
-- =========================================================================

-- =========================================================================
-- 0. ENSURE companies TABLE EXISTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure at least one default company exists
INSERT INTO public.companies (name, slug)
SELECT 'Default Organization', 'default-org'
WHERE NOT EXISTS (SELECT 1 FROM public.companies)
ON CONFLICT (slug) DO NOTHING;

-- =========================================================================
-- 1. ADD company_id COLUMN TO BUSINESS TABLES
-- =========================================================================
-- Uses a helper to safely add company_id only when both table exists AND column doesn't.

CREATE OR REPLACE FUNCTION public.__mt_add_company_id(_tbl TEXT, _fk_tbl TEXT, _fk_col TEXT)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_tbl) THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=_tbl AND column_name='company_id') THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN company_id UUID REFERENCES public.%I(%I)', _tbl, _fk_tbl, _fk_col);
      RAISE NOTICE 'Added company_id to %', _tbl;
    END IF;
  ELSE
    RAISE NOTICE 'Table % does not exist, skipping', _tbl;
  END IF;
END;
$$ LANGUAGE plpgsql;

SELECT public.__mt_add_company_id(t, 'companies', 'id') FROM unnest(ARRAY[
  'jobpack', 'structure', 'structure_components', 'platform', 'u_pipeline',
  'pipe_geo', 'str_elv', 'str_faces', 'str_level',
  'u_lib_mast', 'u_lib_list', 'u_lib_combo',
  'insp_records', 'insp_anomalies', 'insp_media',
  'insp_dive_jobs', 'insp_dive_movements', 'insp_rov_jobs', 'insp_rov_movements',
  'insp_video_tapes', 'insp_video_logs',
  'u_sow', 'u_sow_items',
  'defect_criteria_procedures', 'defect_criteria_rules', 'defect_criteria_custom_params',
  'planning2', 'inspection_planning', 'inspection_program',
  'attachment', 'comment', 'notes', 'mgi_profiles', 'company_settings',
  'exec_summary_templates', 'taskstr',
  'rov_data_acquisition_config', 'rov_video_grab_config',
  'insp_ai_image_analysis', 'insp_ai_training_data', 'insp_ai_model_metrics',
  'insp_ai_prompt_templates', 'insp_ai_analysis_queue'
]) AS t;

DROP FUNCTION public.__mt_add_company_id(TEXT, TEXT, TEXT);

-- =========================================================================
-- 2. BACKFILL: Assign all existing rows to the first (default) company
-- =========================================================================
DO $$
DECLARE
  default_company_id UUID;
  tbl TEXT;
  col_exists BOOLEAN;
BEGIN
  SELECT id INTO default_company_id FROM public.companies ORDER BY created_at LIMIT 1;

  IF default_company_id IS NULL THEN
    RAISE NOTICE 'No company found, skipping backfill';
    RETURN;
  END IF;

  FOREACH tbl IN ARRAY ARRAY[
    'jobpack', 'structure', 'structure_components', 'platform', 'u_pipeline',
    'pipe_geo', 'str_elv', 'str_faces', 'str_level',
    'u_lib_mast', 'u_lib_list', 'u_lib_combo',
    'insp_records', 'insp_anomalies', 'insp_media',
    'insp_dive_jobs', 'insp_dive_movements', 'insp_rov_jobs', 'insp_rov_movements',
    'insp_video_tapes', 'insp_video_logs',
    'u_sow', 'u_sow_items',
    'defect_criteria_procedures', 'defect_criteria_rules', 'defect_criteria_custom_params',
    'planning2', 'inspection_planning', 'inspection_program',
    'attachment', 'comment', 'notes', 'mgi_profiles', 'company_settings',
    'exec_summary_templates', 'taskstr',
    'rov_data_acquisition_config', 'rov_video_grab_config',
    'insp_ai_image_analysis', 'insp_ai_training_data', 'insp_ai_model_metrics',
    'insp_ai_prompt_templates', 'insp_ai_analysis_queue'
  ]
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = %L AND column_name = ''company_id'')', tbl) INTO col_exists;
    IF col_exists THEN
      EXECUTE format('UPDATE public.%I SET company_id = %L WHERE company_id IS NULL', tbl, default_company_id);
      RAISE NOTICE 'Backfilled company_id for %', tbl;
    END IF;
  END LOOP;
END$$;

-- =========================================================================
-- 3. HELPER FUNCTION: get_user_active_company_id
--    Returns the company_id for the current user's active membership.
--    If x-company-id header is used on the app side, the app resolves it.
--    This function resolves from memberships for RLS use.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_user_active_company_id(user_uuid UUID)
RETURNS UUID AS $$
DECLARE
  result UUID;
BEGIN
  SELECT cm.company_id INTO result
  FROM public.company_memberships cm
  WHERE cm.user_id = user_uuid
    AND cm.is_active = true
  ORDER BY cm.updated_at DESC
  LIMIT 1;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- =========================================================================
-- 4. RLS POLICIES ON BUSINESS TABLES
--    Pattern: super_admin sees everything, others see only their company's data.
-- =========================================================================

-- Helper to apply RLS to a table (skips if table doesn't exist)
CREATE OR REPLACE FUNCTION public.apply_tenant_rls(table_name TEXT) RETURNS VOID AS $$
DECLARE
  policy_name TEXT;
  tbl_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=table_name) INTO tbl_exists;
  IF NOT tbl_exists THEN
    RAISE NOTICE 'Table % does not exist, skipping RLS', table_name;
    RETURN;
  END IF;

  policy_name := 'Tenant isolation for ' || table_name;

  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);

  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR ALL USING (
      public.check_user_is_super_admin(auth.uid())
      OR company_id = public.get_user_active_company_id(auth.uid())
    ) WITH CHECK (
      public.check_user_is_super_admin(auth.uid())
      OR company_id = public.get_user_active_company_id(auth.uid())
    )',
    policy_name, table_name
  );
END;
$$ LANGUAGE plpgsql;

-- Apply to all business tables (safe: skips missing tables)
SELECT public.apply_tenant_rls(t) FROM unnest(ARRAY[
  'jobpack', 'structure', 'structure_components', 'platform', 'u_pipeline',
  'pipe_geo', 'str_elv', 'str_faces', 'str_level',
  'u_lib_mast', 'u_lib_list', 'u_lib_combo',
  'insp_records', 'insp_anomalies', 'insp_media',
  'insp_dive_jobs', 'insp_dive_movements', 'insp_rov_jobs', 'insp_rov_movements',
  'insp_video_tapes', 'insp_video_logs',
  'u_sow', 'u_sow_items',
  'defect_criteria_procedures', 'defect_criteria_rules', 'defect_criteria_custom_params',
  'planning2', 'inspection_planning', 'inspection_program',
  'attachment', 'comment', 'notes', 'mgi_profiles', 'company_settings',
  'exec_summary_templates', 'taskstr',
  'rov_data_acquisition_config', 'rov_video_grab_config'
]) AS t;

-- =========================================================================
-- 5. EXTEND companies TABLE for multi-tenant metadata
-- =========================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='description') THEN
    ALTER TABLE public.companies ADD COLUMN description TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='is_active') THEN
    ALTER TABLE public.companies ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='max_users') THEN
    ALTER TABLE public.companies ADD COLUMN max_users INTEGER DEFAULT 50;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='subscription_plan') THEN
    ALTER TABLE public.companies ADD COLUMN subscription_plan TEXT DEFAULT 'standard';
  END IF;
END$$;
