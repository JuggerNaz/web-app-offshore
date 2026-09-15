-- ==============================================================================
-- Migration: Automated Tenant Template Provisioning & Strict Isolation (Fixed company_settings)
-- ==============================================================================

-- 1. Ensure company_id columns exist on template/library tables
ALTER TABLE IF EXISTS public.u_lib_mast ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.u_lib_list ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.u_lib_combo ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.defect_criteria_procedures ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.defect_criteria_rules ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.defect_criteria_custom_params ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.mgi_profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.exec_summary_templates ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.company_settings ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. Drop all legacy global unique constraints and scope to (procedure_number, version, company_id)
ALTER TABLE IF EXISTS public.defect_criteria_procedures DROP CONSTRAINT IF EXISTS unique_procedure_version CASCADE;
ALTER TABLE IF EXISTS public.defect_criteria_procedures DROP CONSTRAINT IF EXISTS defect_criteria_procedures_procedure_number_key CASCADE;
ALTER TABLE IF EXISTS public.defect_criteria_procedures DROP CONSTRAINT IF EXISTS defect_criteria_procedures_procedure_number_company_id_key CASCADE;
ALTER TABLE IF EXISTS public.defect_criteria_procedures DROP CONSTRAINT IF EXISTS defect_criteria_procedures_proc_ver_comp_key CASCADE;

ALTER TABLE IF EXISTS public.defect_criteria_procedures ADD CONSTRAINT defect_criteria_procedures_proc_ver_comp_key UNIQUE (procedure_number, version, company_id);

-- 3. Tenant Provisioning Function
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

  -- Resolve source template company
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

  -- A. Clone u_lib_mast (lib_code, lib_name, comment, hidden_item, company_id)
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

  -- B. Clone u_lib_list
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'u_lib_list') THEN
    IF src_id IS NOT NULL THEN
      INSERT INTO public.u_lib_list (
        lib_code, lib_id, lib_desc, workunit, cr_user, cr_date, lib_delete, lib_com, hidden_item, company_id
      )
      SELECT 
        lib_code, lib_id, lib_desc, workunit, cr_user, cr_date, COALESCE(lib_delete, 0), lib_com, COALESCE(hidden_item, 'N'), target_company_id
      FROM public.u_lib_list
      WHERE company_id = src_id
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.u_lib_list (
        lib_code, lib_id, lib_desc, workunit, cr_user, cr_date, lib_delete, lib_com, hidden_item, company_id
      )
      SELECT DISTINCT ON (lib_code, lib_id)
        lib_code, lib_id, lib_desc, workunit, cr_user, cr_date, COALESCE(lib_delete, 0), lib_com, COALESCE(hidden_item, 'N'), target_company_id
      FROM public.u_lib_list
      WHERE company_id IS NULL
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- C. Clone u_lib_combo
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

  -- D. Clone Defect Criteria Procedures & Rules
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

  -- E. Clone MGI Profiles (name, description, thresholds, is_active, is_archived, is_job_specific, company_id)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mgi_profiles') THEN
    IF src_id IS NOT NULL THEN
      INSERT INTO public.mgi_profiles (name, description, thresholds, is_active, is_archived, is_job_specific, company_id)
      SELECT name, description, thresholds, COALESCE(is_active, true), COALESCE(is_archived, false), COALESCE(is_job_specific, false), target_company_id
      FROM public.mgi_profiles
      WHERE company_id = src_id
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- F. Clone Executive Summary Templates (template_name, section_id, content, client_name, metadata, company_id)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exec_summary_templates') THEN
    IF src_id IS NOT NULL THEN
      INSERT INTO public.exec_summary_templates (template_name, section_id, content, client_name, metadata, company_id)
      SELECT template_name, section_id, content, client_name, metadata, target_company_id
      FROM public.exec_summary_templates
      WHERE company_id = src_id
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- G. Initialize Company Settings (company_name, department_name, def_unit, storage_provider, storage_config, company_id)
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

-- 4. Automatic Trigger on Company Creation
CREATE OR REPLACE FUNCTION public.handle_new_company_provisioning()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.provision_tenant_template_data(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_auto_provision_company ON public.companies;
CREATE TRIGGER trg_auto_provision_company
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_company_provisioning();

-- 5. Provision Existing Tenant Companies that do not yet have library data
DO $$
DECLARE
  comp RECORD;
BEGIN
  FOR comp IN SELECT id FROM public.companies LOOP
    IF NOT EXISTS (SELECT 1 FROM public.u_lib_list WHERE company_id = comp.id) THEN
      PERFORM public.provision_tenant_template_data(comp.id);
    END IF;
  END LOOP;
END$$;
