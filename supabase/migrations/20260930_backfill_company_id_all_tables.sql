-- ==============================================================================
-- Migration: Complete Multi-Tenant company_id Backfill & Safeguard for All Tables
-- ==============================================================================

DO $$
DECLARE
  default_company_id UUID;
  tbl TEXT;
  target_tables TEXT[] := ARRAY[
    'jobpack', 'structure', 'structure_components', 'platform', 'u_pipeline',
    'pipe_geo', 'str_elv', 'str_faces', 'str_level',
    'u_lib_mast', 'u_lib_list', 'u_lib_combo',
    'insp_records', 'insp_anomalies', 'insp_media',
    'insp_dive_jobs', 'insp_dive_data', 'insp_dive_movements',
    'insp_rov_jobs', 'insp_rov_movements',
    'insp_video_tapes', 'insp_video_logs', 'insp_video_counters',
    'u_sow', 'u_sow_items',
    'defect_criteria_procedures', 'defect_criteria_rules', 'defect_criteria_custom_params',
    'inspection_defect_flags', 'defect_override_audit_log',
    'mgi_profiles', 'company_settings', 'exec_summary_templates',
    'platform_3d_scenes', 'rov_data_acquisition_config', 'rov_video_grab_config',
    'insp_ai_image_analysis', 'insp_ai_training_data', 'insp_ai_model_metrics',
    'insp_ai_prompt_templates', 'insp_ai_analysis_queue',
    'insp_numbering_patterns', 'insp_personnel_history', 'insp_text_patterns'
  ];
BEGIN
  -- 1. Resolve default/active company_id
  SELECT id INTO default_company_id 
  FROM public.companies 
  WHERE is_active = true 
  ORDER BY created_at ASC 
  LIMIT 1;

  IF default_company_id IS NULL THEN
    SELECT id INTO default_company_id 
    FROM public.companies 
    ORDER BY created_at ASC 
    LIMIT 1;
  END IF;

  -- 2. Ensure company_id column and index exists on every table
  FOREACH tbl IN ARRAY target_tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'company_id') THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE', tbl);
      END IF;
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_company_id ON public.%I(company_id)', tbl, tbl);
    END IF;
  END LOOP;

  -- 3. Smart Hierarchical Backfill from Parent Entities

  -- A. Video Logs <- Video Tapes
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_video_logs') 
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_video_tapes') THEN
    UPDATE public.insp_video_logs l
    SET company_id = t.company_id
    FROM public.insp_video_tapes t
    WHERE l.tape_id = t.tape_id 
      AND l.company_id IS NULL 
      AND t.company_id IS NOT NULL;
  END IF;

  -- B. Video Tapes <- ROV Jobs & Dive Jobs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_video_tapes') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_rov_jobs') THEN
      UPDATE public.insp_video_tapes t
      SET company_id = r.company_id
      FROM public.insp_rov_jobs r
      WHERE t.rov_job_id = r.rov_job_id 
        AND t.company_id IS NULL 
        AND r.company_id IS NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_dive_jobs') THEN
      UPDATE public.insp_video_tapes t
      SET company_id = d.company_id
      FROM public.insp_dive_jobs d
      WHERE t.dive_job_id = d.dive_job_id 
        AND t.company_id IS NULL 
        AND d.company_id IS NOT NULL;
    END IF;
  END IF;

  -- C. Video Counters <- Video Tapes
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_video_counters') 
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_video_tapes') THEN
    UPDATE public.insp_video_counters c
    SET company_id = t.company_id
    FROM public.insp_video_tapes t
    WHERE c.tape_id = t.tape_id 
      AND c.company_id IS NULL 
      AND t.company_id IS NOT NULL;
  END IF;

  -- D. Inspection Records <- Platform, Pipeline, Jobpack
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_records') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform') THEN
      UPDATE public.insp_records r
      SET company_id = p.company_id
      FROM public.platform p
      WHERE r.structure_id = p.plat_id 
        AND r.company_id IS NULL 
        AND p.company_id IS NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'u_pipeline') THEN
      UPDATE public.insp_records r
      SET company_id = pl.company_id
      FROM public.u_pipeline pl
      WHERE r.structure_id = pl.pipe_id 
        AND r.company_id IS NULL 
        AND pl.company_id IS NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobpack') THEN
      UPDATE public.insp_records r
      SET company_id = j.company_id
      FROM public.jobpack j
      WHERE r.jobpack_id = j.jobpack_id 
        AND r.company_id IS NULL 
        AND j.company_id IS NOT NULL;
    END IF;
  END IF;

  -- E. Inspection Anomalies & Media <- Inspection Records
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_anomalies') 
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_records') THEN
    UPDATE public.insp_anomalies a
    SET company_id = r.company_id
    FROM public.insp_records r
    WHERE a.insp_id = r.insp_id 
      AND a.company_id IS NULL 
      AND r.company_id IS NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_media') 
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_records') THEN
    UPDATE public.insp_media m
    SET company_id = r.company_id
    FROM public.insp_records r
    WHERE m.insp_id = r.insp_id 
      AND m.company_id IS NULL 
      AND r.company_id IS NOT NULL;
  END IF;

  -- F. Structure Components <- Platform, Pipeline
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'structure_components') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform') THEN
      UPDATE public.structure_components sc
      SET company_id = p.company_id
      FROM public.platform p
      WHERE sc.str_id = p.plat_id 
        AND sc.company_id IS NULL 
        AND p.company_id IS NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'u_pipeline') THEN
      UPDATE public.structure_components sc
      SET company_id = pl.company_id
      FROM public.u_pipeline pl
      WHERE sc.str_id = pl.pipe_id 
        AND sc.company_id IS NULL 
        AND pl.company_id IS NOT NULL;
    END IF;
  END IF;

  -- G. SOW Items <- SOW
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'u_sow_items') 
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'u_sow') THEN
    UPDATE public.u_sow_items si
    SET company_id = s.company_id
    FROM public.u_sow s
    WHERE si.sow_id = s.id 
      AND si.company_id IS NULL 
      AND s.company_id IS NOT NULL;
  END IF;

  -- H. Defect Criteria Rules & Custom Params <- Procedures
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'defect_criteria_rules') 
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'defect_criteria_procedures') THEN
    UPDATE public.defect_criteria_rules dr
    SET company_id = dp.company_id
    FROM public.defect_criteria_procedures dp
    WHERE dr.procedure_id = dp.id 
      AND dr.company_id IS NULL 
      AND dp.company_id IS NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'defect_criteria_custom_params') 
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'defect_criteria_procedures') THEN
    UPDATE public.defect_criteria_custom_params cp
    SET company_id = dp.company_id
    FROM public.defect_criteria_procedures dp
    WHERE cp.procedure_id = dp.id 
      AND cp.company_id IS NULL 
      AND dp.company_id IS NOT NULL;
  END IF;

  -- 4. Global Backfill: Fill any remaining NULL company_id in ALL tables with default_company_id
  IF default_company_id IS NOT NULL THEN
    FOREACH tbl IN ARRAY target_tables
    LOOP
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'company_id') THEN
          EXECUTE format('UPDATE public.%I SET company_id = %L WHERE company_id IS NULL', tbl, default_company_id);
        END IF;
      END IF;
    END LOOP;
  END IF;

END $$;
