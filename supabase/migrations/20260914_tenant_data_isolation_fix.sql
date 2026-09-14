-- ==============================================================================
-- Migration: Multi-Tenant Data Isolation & Library Provisioning Scoping
-- ==============================================================================

-- 1. Ensure company_id columns and indexes exist on all tenant asset & inspection tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'jobpack', 'structure', 'structure_components', 'platform', 'u_pipeline',
    'pipe_geo', 'str_elv', 'str_faces', 'str_level',
    'u_lib_mast', 'u_lib_list', 'u_lib_combo',
    'insp_records', 'insp_anomalies', 'insp_media',
    'insp_dive_jobs', 'insp_dive_movements', 'insp_rov_jobs', 'insp_rov_movements',
    'insp_video_tapes', 'insp_video_logs',
    'u_sow', 'u_sow_items',
    'defect_criteria_procedures', 'defect_criteria_rules', 'defect_criteria_custom_params',
    'mgi_profiles', 'company_settings', 'exec_summary_templates'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'company_id') THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE', tbl);
      END IF;
      -- Add index on company_id if not exists
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_company_id ON public.%I(company_id)', tbl, tbl);
    END IF;
  END LOOP;
END$$;

-- 2. Update provision_tenant_template_data function:
--    - Clones standard lookup libraries (u_lib_mast, u_lib_list, u_lib_combo) exclusive for target_company_id
--    - EXCLUDES OILFIELD entries (oil fields are individual tenant assets and must not be copied across tenants)
--    - Does NOT copy any platforms, pipelines, structures, components, jobpacks, sows, or inspection data

CREATE OR REPLACE FUNCTION public.provision_tenant_template_data(target_company_id UUID, source_company_id UUID DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  src_id UUID;
  target_name TEXT;
  old_proc RECORD;
  new_proc_id BIGINT;
BEGIN
  IF target_company_id IS NULL THEN
    RETURN;
  END IF;

  SELECT name INTO target_name FROM public.companies WHERE id = target_company_id;

  -- Resolve source template company (first registered company with library data)
  src_id := source_company_id;
  IF src_id IS NULL THEN
    SELECT company_id INTO src_id 
    FROM public.u_lib_list 
    WHERE company_id IS NOT NULL AND company_id != target_company_id 
    LIMIT 1;
  END IF;

  IF src_id IS NULL THEN
    SELECT id INTO src_id 
    FROM public.companies 
    WHERE id != target_company_id 
    ORDER BY created_at ASC 
    LIMIT 1;
  END IF;

  -- A. Clone u_lib_mast (master library categories) exclusive for target tenant
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'u_lib_mast') THEN
    IF src_id IS NOT NULL THEN
      INSERT INTO public.u_lib_mast (lib_code, lib_name, comment, hidden_item, company_id)
      SELECT lib_code, lib_name, comment, COALESCE(hidden_item, 'N'), target_company_id
      FROM public.u_lib_mast
      WHERE company_id = src_id
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.u_lib_mast (lib_code, lib_name, comment, hidden_item, company_id)
      SELECT DISTINCT lib_code, lib_name, comment, COALESCE(hidden_item, 'N'), target_company_id
      FROM public.u_lib_mast
      WHERE company_id IS NULL
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- B. Clone u_lib_list (standard reference values) exclusive for target tenant
  --    CRITICAL: Exclude 'OILFIELD' so new organizations start with clean, unpolluted field assets!
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'u_lib_list') THEN
    IF src_id IS NOT NULL THEN
      INSERT INTO public.u_lib_list (
        lib_code, lib_id, lib_desc, workunit, cr_user, cr_date, lib_delete, lib_com, hidden_item, company_id
      )
      SELECT 
        lib_code, lib_id, lib_desc, workunit, cr_user, cr_date, COALESCE(lib_delete, 0), lib_com, COALESCE(hidden_item, 'N'), target_company_id
      FROM public.u_lib_list
      WHERE company_id = src_id
        AND UPPER(lib_code) != 'OILFIELD'
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.u_lib_list (
        lib_code, lib_id, lib_desc, workunit, cr_user, cr_date, lib_delete, lib_com, hidden_item, company_id
      )
      SELECT DISTINCT ON (lib_code, lib_id)
        lib_code, lib_id, lib_desc, workunit, cr_user, cr_date, COALESCE(lib_delete, 0), lib_com, COALESCE(hidden_item, 'N'), target_company_id
      FROM public.u_lib_list
      WHERE company_id IS NULL
        AND UPPER(lib_code) != 'OILFIELD'
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- C. Clone u_lib_combo exclusive for target tenant
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'u_lib_combo') THEN
    IF src_id IS NOT NULL THEN
      INSERT INTO public.u_lib_combo (
        lib_code, code_1, code_2, workunit, cr_user, cr_date, lib_delete, lib_com, hidden_item, company_id
      )
      SELECT 
        lib_code, code_1, code_2, workunit, cr_user, cr_date, COALESCE(lib_delete, 0), lib_com, COALESCE(hidden_item, 'N'), target_company_id
      FROM public.u_lib_combo
      WHERE company_id = src_id
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- D. Clone Defect Criteria Procedures & Rules exclusive for target tenant
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'defect_criteria_procedures') THEN
    FOR old_proc IN 
      SELECT * FROM public.defect_criteria_procedures 
      WHERE (src_id IS NOT NULL AND company_id = src_id) OR (src_id IS NULL AND (company_id IS NULL OR company_id = target_company_id))
    LOOP
      SELECT id INTO new_proc_id 
      FROM public.defect_criteria_procedures 
      WHERE procedure_number = old_proc.procedure_number 
        AND COALESCE(version, 1) = COALESCE(old_proc.version, 1)
        AND company_id = target_company_id 
      LIMIT 1;

      IF new_proc_id IS NULL THEN
        INSERT INTO public.defect_criteria_procedures (
          procedure_name, procedure_number, version, effective_date, status, notes, company_id
        ) VALUES (
          old_proc.procedure_name, old_proc.procedure_number, COALESCE(old_proc.version, 1), old_proc.effective_date, old_proc.status, old_proc.notes, target_company_id
        ) RETURNING id INTO new_proc_id;

        -- Clone associated defect_criteria_rules
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'defect_criteria_rules') THEN
          INSERT INTO public.defect_criteria_rules (
            procedure_id, structure_group, defect_type_id, defect_code_id, priority_id, 
            threshold_operator, threshold_value, threshold_text, alert_message, auto_flag, 
            evaluation_priority, rule_order, nominal_thickness, elevation_min, elevation_max, 
            field_name, custom_parameters, jobpack_type, company_id
          )
          SELECT 
            new_proc_id, structure_group, defect_type_id, defect_code_id, priority_id, 
            threshold_operator, threshold_value, threshold_text, alert_message, auto_flag, 
            evaluation_priority, rule_order, nominal_thickness, elevation_min, elevation_max, 
            field_name, custom_parameters, jobpack_type, target_company_id
          FROM public.defect_criteria_rules
          WHERE procedure_id = old_proc.id;
        END IF;

        -- Clone associated custom_params
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'defect_criteria_custom_params') THEN
          INSERT INTO public.defect_criteria_custom_params (
            procedure_id, parameter_name, parameter_label, parameter_type, parameter_unit, description, validation_rules, is_active, company_id
          )
          SELECT 
            new_proc_id, parameter_name, parameter_label, parameter_type, parameter_unit, description, validation_rules, is_active, target_company_id
          FROM public.defect_criteria_custom_params
          WHERE procedure_id = old_proc.id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- E. Clone MGI Profiles exclusive for target tenant
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mgi_profiles') THEN
    IF src_id IS NOT NULL THEN
      INSERT INTO public.mgi_profiles (name, description, thresholds, is_active, is_archived, is_job_specific, company_id)
      SELECT name, description, thresholds, COALESCE(is_active, true), COALESCE(is_archived, false), COALESCE(is_job_specific, false), target_company_id
      FROM public.mgi_profiles
      WHERE company_id = src_id
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- F. Clone Executive Summary Templates exclusive for target tenant
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exec_summary_templates') THEN
    IF src_id IS NOT NULL THEN
      INSERT INTO public.exec_summary_templates (template_name, section_id, content, client_name, metadata, company_id)
      SELECT template_name, section_id, content, client_name, metadata, target_company_id
      FROM public.exec_summary_templates
      WHERE company_id = src_id
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- G. Initialize Company Settings exclusive for target tenant
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_settings') THEN
    IF src_id IS NOT NULL THEN
      INSERT INTO public.company_settings (company_name, department_name, def_unit, storage_provider, storage_config, company_id)
      SELECT 
        COALESCE(target_name, company_name), 
        department_name, 
        COALESCE(def_unit, 'M'), 
        COALESCE(storage_provider, 'supabase'), 
        COALESCE(storage_config, '{}'::jsonb), 
        target_company_id
      FROM public.company_settings
      WHERE company_id = src_id
      LIMIT 1
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.company_settings (company_name, def_unit, storage_provider, storage_config, company_id)
      VALUES (COALESCE(target_name, 'Company'), 'M', 'supabase', '{}'::jsonb, target_company_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
