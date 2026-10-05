-- ==============================================================================
-- Migration: Jobpack Performance Optimization, Indexes & Fast Retrieval RPC
-- ==============================================================================

-- 1. Optimized Indexes on jobpack table
CREATE INDEX IF NOT EXISTS idx_jobpack_company_id_id ON public.jobpack(company_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_jobpack_name ON public.jobpack(name);
CREATE INDEX IF NOT EXISTS idx_jobpack_status ON public.jobpack(status);
CREATE INDEX IF NOT EXISTS idx_jobpack_metadata_gin ON public.jobpack USING gin(metadata);

-- 2. Optimized Indexes on related inspection & SOW tables for ultra-fast filtering
CREATE INDEX IF NOT EXISTS idx_insp_records_company_jp 
  ON public.insp_records(company_id, jobpack_id) 
  WHERE jobpack_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_insp_records_struct_jp 
  ON public.insp_records(structure_id, jobpack_id) 
  WHERE jobpack_id IS NOT NULL;

-- Composite indexes on (structure_id, jobpack_id, sow_report_no)
CREATE INDEX IF NOT EXISTS idx_insp_records_struct_jp_sow 
  ON public.insp_records(structure_id, jobpack_id, sow_report_no);

CREATE INDEX IF NOT EXISTS idx_insp_records_jp_struct_sow 
  ON public.insp_records(jobpack_id, structure_id, sow_report_no);

CREATE INDEX IF NOT EXISTS idx_insp_records_sow_report_no 
  ON public.insp_records(sow_report_no);

CREATE INDEX IF NOT EXISTS idx_insp_dive_jobs_struct_jp_sow 
  ON public.insp_dive_jobs(structure_id, jobpack_id, sow_report_no);

CREATE INDEX IF NOT EXISTS idx_insp_dive_jobs_company_jp 
  ON public.insp_dive_jobs(company_id, jobpack_id) 
  WHERE jobpack_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_insp_rov_jobs_struct_jp_sow 
  ON public.insp_rov_jobs(structure_id, jobpack_id, sow_report_no);

CREATE INDEX IF NOT EXISTS idx_insp_rov_jobs_company_jp 
  ON public.insp_rov_jobs(company_id, jobpack_id) 
  WHERE jobpack_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_u_sow_company_jp_struct 
  ON public.u_sow(company_id, jobpack_id, structure_id);

CREATE INDEX IF NOT EXISTS idx_u_sow_struct_title 
  ON public.u_sow(structure_title);

-- 3. Stored procedure for sub-millisecond retrieval of all unique jobpack IDs having inspections
CREATE OR REPLACE FUNCTION public.get_inspection_jobpack_ids(target_company_id UUID DEFAULT NULL)
RETURNS TABLE (jobpack_id BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT j_id FROM (
    SELECT r.jobpack_id AS j_id 
    FROM public.insp_records r 
    WHERE r.jobpack_id IS NOT NULL 
      AND (target_company_id IS NULL OR r.company_id = target_company_id)
    UNION
    SELECT d.jobpack_id AS j_id 
    FROM public.insp_dive_jobs d 
    WHERE d.jobpack_id IS NOT NULL 
      AND (target_company_id IS NULL OR d.company_id = target_company_id)
    UNION
    SELECT v.jobpack_id AS j_id 
    FROM public.insp_rov_jobs v 
    WHERE v.jobpack_id IS NOT NULL 
      AND (target_company_id IS NULL OR v.company_id = target_company_id)
  ) sub;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.get_inspection_jobpack_ids(UUID) TO authenticated, anon, service_role;
