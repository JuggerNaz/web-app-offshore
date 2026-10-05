-- ==============================================================================
-- Migration: Auto-Populate & Enforce Multi-Tenant company_id on insp_video_tapes & insp_video_logs
-- Target Tenant Default: a13fb356-6131-4b78-8fe1-e7c8bcc31ab2
-- ==============================================================================

-- 1. Ensure company_id column and indexes exist on insp_video_tapes and insp_video_logs
DO $$
BEGIN
  -- insp_video_tapes
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_video_tapes') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'insp_video_tapes' AND column_name = 'company_id') THEN
      ALTER TABLE public.insp_video_tapes ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_insp_video_tapes_company_id ON public.insp_video_tapes(company_id);
  END IF;

  -- insp_video_logs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_video_logs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'insp_video_logs' AND column_name = 'company_id') THEN
      ALTER TABLE public.insp_video_logs ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_insp_video_logs_company_id ON public.insp_video_logs(company_id);
  END IF;
END$$;

-- 2. Direct Update: Immediately set company_id to target company for all existing NULL records
UPDATE public.insp_video_tapes
SET company_id = 'a13fb356-6131-4b78-8fe1-e7c8bcc31ab2'::uuid
WHERE company_id IS NULL;

UPDATE public.insp_video_logs
SET company_id = 'a13fb356-6131-4b78-8fe1-e7c8bcc31ab2'::uuid
WHERE company_id IS NULL;

-- Also update related movement and counter tables if company_id is null
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_video_counters') THEN
    UPDATE public.insp_video_counters SET company_id = 'a13fb356-6131-4b78-8fe1-e7c8bcc31ab2'::uuid WHERE company_id IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_rov_movements') THEN
    UPDATE public.insp_rov_movements SET company_id = 'a13fb356-6131-4b78-8fe1-e7c8bcc31ab2'::uuid WHERE company_id IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'insp_dive_movements') THEN
    UPDATE public.insp_dive_movements SET company_id = 'a13fb356-6131-4b78-8fe1-e7c8bcc31ab2'::uuid WHERE company_id IS NULL;
  END IF;
END$$;

-- 3. Trigger Function: Auto-populate company_id for insp_video_tapes
CREATE OR REPLACE FUNCTION public.trg_fn_set_insp_video_tapes_company_id()
RETURNS TRIGGER AS $$
DECLARE
  resolved_company_id UUID := NEW.company_id;
  target_default UUID := 'a13fb356-6131-4b78-8fe1-e7c8bcc31ab2'::uuid;
BEGIN
  -- If company_id already provided, keep it
  IF resolved_company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Try resolving from ROV Job
  IF NEW.rov_job_id IS NOT NULL THEN
    SELECT company_id INTO resolved_company_id
    FROM public.insp_rov_jobs
    WHERE rov_job_id = NEW.rov_job_id AND company_id IS NOT NULL
    LIMIT 1;
  END IF;

  -- 2. Try resolving from Dive Job
  IF resolved_company_id IS NULL AND NEW.dive_job_id IS NOT NULL THEN
    SELECT company_id INTO resolved_company_id
    FROM public.insp_dive_jobs
    WHERE dive_job_id = NEW.dive_job_id AND company_id IS NOT NULL
    LIMIT 1;
  END IF;

  -- 3. Try resolving from active user session / active company function
  IF resolved_company_id IS NULL AND auth.uid() IS NOT NULL THEN
    BEGIN
      resolved_company_id := public.get_user_active_company_id(auth.uid());
    EXCEPTION WHEN OTHERS THEN
      resolved_company_id := NULL;
    END;
  END IF;

  -- 4. Try resolving from users table
  IF resolved_company_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT company_id INTO resolved_company_id
    FROM public.users
    WHERE id = auth.uid() AND company_id IS NOT NULL
    LIMIT 1;
  END IF;

  -- 5. Fallback to target tenant company_id
  IF resolved_company_id IS NULL THEN
    resolved_company_id := target_default;
  END IF;

  NEW.company_id := resolved_company_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop and recreate trigger on insp_video_tapes
DROP TRIGGER IF EXISTS trg_set_insp_video_tapes_company_id ON public.insp_video_tapes;
CREATE TRIGGER trg_set_insp_video_tapes_company_id
  BEFORE INSERT ON public.insp_video_tapes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_set_insp_video_tapes_company_id();


-- 4. Trigger Function: Auto-populate company_id for insp_video_logs
CREATE OR REPLACE FUNCTION public.trg_fn_set_insp_video_logs_company_id()
RETURNS TRIGGER AS $$
DECLARE
  resolved_company_id UUID := NEW.company_id;
  target_default UUID := 'a13fb356-6131-4b78-8fe1-e7c8bcc31ab2'::uuid;
BEGIN
  -- If company_id already provided, keep it
  IF resolved_company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Try resolving from parent Video Tape
  IF NEW.tape_id IS NOT NULL THEN
    SELECT company_id INTO resolved_company_id
    FROM public.insp_video_tapes
    WHERE tape_id = NEW.tape_id AND company_id IS NOT NULL
    LIMIT 1;
  END IF;

  -- 2. Try resolving from linked Inspection Record
  IF resolved_company_id IS NULL AND NEW.inspection_id IS NOT NULL THEN
    SELECT company_id INTO resolved_company_id
    FROM public.insp_records
    WHERE insp_id = NEW.inspection_id AND company_id IS NOT NULL
    LIMIT 1;
  END IF;

  -- 3. Try resolving from active user session / active company function
  IF resolved_company_id IS NULL AND auth.uid() IS NOT NULL THEN
    BEGIN
      resolved_company_id := public.get_user_active_company_id(auth.uid());
    EXCEPTION WHEN OTHERS THEN
      resolved_company_id := NULL;
    END;
  END IF;

  -- 4. Try resolving from users table
  IF resolved_company_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT company_id INTO resolved_company_id
    FROM public.users
    WHERE id = auth.uid() AND company_id IS NOT NULL
    LIMIT 1;
  END IF;

  -- 5. Fallback to target tenant company_id
  IF resolved_company_id IS NULL THEN
    resolved_company_id := target_default;
  END IF;

  NEW.company_id := resolved_company_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop and recreate trigger on insp_video_logs
DROP TRIGGER IF EXISTS trg_set_insp_video_logs_company_id ON public.insp_video_logs;
CREATE TRIGGER trg_set_insp_video_logs_company_id
  BEFORE INSERT ON public.insp_video_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_set_insp_video_logs_company_id();


-- 5. Smart Backfill & Final Direct Update
DO $$
DECLARE
  target_default UUID := 'a13fb356-6131-4b78-8fe1-e7c8bcc31ab2'::uuid;
BEGIN
  -- A. Backfill insp_video_tapes from insp_rov_jobs
  UPDATE public.insp_video_tapes t
  SET company_id = r.company_id
  FROM public.insp_rov_jobs r
  WHERE t.rov_job_id = r.rov_job_id 
    AND t.company_id IS NULL 
    AND r.company_id IS NOT NULL;

  -- B. Backfill insp_video_tapes from insp_dive_jobs
  UPDATE public.insp_video_tapes t
  SET company_id = d.company_id
  FROM public.insp_dive_jobs d
  WHERE t.dive_job_id = d.dive_job_id 
    AND t.company_id IS NULL 
    AND d.company_id IS NOT NULL;

  -- C. Backfill any remaining insp_video_tapes to target company
  UPDATE public.insp_video_tapes
  SET company_id = target_default
  WHERE company_id IS NULL;

  -- D. Backfill insp_video_logs from insp_video_tapes
  UPDATE public.insp_video_logs l
  SET company_id = t.company_id
  FROM public.insp_video_tapes t
  WHERE l.tape_id = t.tape_id 
    AND l.company_id IS NULL 
    AND t.company_id IS NOT NULL;

  -- E. Backfill insp_video_logs from insp_records
  UPDATE public.insp_video_logs l
  SET company_id = r.company_id
  FROM public.insp_records r
  WHERE l.inspection_id = r.insp_id 
    AND l.company_id IS NULL 
    AND r.company_id IS NOT NULL;

  -- F. Backfill any remaining insp_video_logs to target company
  UPDATE public.insp_video_logs
  SET company_id = target_default
  WHERE company_id IS NULL;
END$$;

-- 6. Apply multi-tenant RLS policies if apply_tenant_rls exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'apply_tenant_rls') THEN
    PERFORM public.apply_tenant_rls('insp_video_tapes');
    PERFORM public.apply_tenant_rls('insp_video_logs');
  END IF;
END$$;
