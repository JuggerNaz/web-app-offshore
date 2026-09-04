-- Migration: Allow same dive_no and deployment_no across different jobpacks and SOW report numbers
-- Description: Drops legacy single-column table-wide UNIQUE constraints so dive_no and deployment_no can be shared across different jobpacks/SOW report numbers without conflict.

DO $$
BEGIN
    -- 1. Drop global unique constraint on insp_dive_jobs(dive_no)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'uk_dive_no' AND table_name = 'insp_dive_jobs'
    ) THEN
        ALTER TABLE public.insp_dive_jobs DROP CONSTRAINT uk_dive_no;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'insp_dive_jobs_dive_no_key' AND table_name = 'insp_dive_jobs'
    ) THEN
        ALTER TABLE public.insp_dive_jobs DROP CONSTRAINT insp_dive_jobs_dive_no_key;
    END IF;

    -- 2. Drop global unique constraint on insp_rov_jobs(deployment_no)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'uk_deployment_no' AND table_name = 'insp_rov_jobs'
    ) THEN
        ALTER TABLE public.insp_rov_jobs DROP CONSTRAINT uk_deployment_no;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'insp_rov_jobs_deployment_no_key' AND table_name = 'insp_rov_jobs'
    ) THEN
        ALTER TABLE public.insp_rov_jobs DROP CONSTRAINT insp_rov_jobs_deployment_no_key;
    END IF;
END $$;

-- 3. Composite indexes for high-speed scoped query matching by structure, jobpack, SOW report, and dive/deployment no
CREATE INDEX IF NOT EXISTS idx_dive_jobs_struct_jp_sow_no ON public.insp_dive_jobs(structure_id, jobpack_id, sow_report_no, dive_no);
CREATE INDEX IF NOT EXISTS idx_rov_jobs_struct_jp_sow_no ON public.insp_rov_jobs(structure_id, jobpack_id, sow_report_no, deployment_no);
