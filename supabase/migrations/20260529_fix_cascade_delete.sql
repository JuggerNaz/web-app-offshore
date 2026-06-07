-- ============================================================================
-- SQL Migration: Enforce Full Cascade Delete on Structure Deletion
-- ============================================================================

-- 1. Platforms and Pipelines Child-to-Parent Cascade Links
ALTER TABLE public.platform DROP CONSTRAINT IF EXISTS platform_plat_id_fkey;
ALTER TABLE public.platform ADD CONSTRAINT platform_plat_id_fkey 
  FOREIGN KEY (plat_id) REFERENCES public.structure(str_id) ON DELETE CASCADE;

ALTER TABLE public.u_pipeline DROP CONSTRAINT IF EXISTS u_pipeline_pipe_id_fkey;
ALTER TABLE public.u_pipeline ADD CONSTRAINT u_pipeline_pipe_id_fkey 
  FOREIGN KEY (pipe_id) REFERENCES public.structure(str_id) ON DELETE CASCADE;

-- 2. Structure Components Cascade
ALTER TABLE public.structure_components DROP CONSTRAINT IF EXISTS structure_components_structure_id_fkey;
ALTER TABLE public.structure_components DROP CONSTRAINT IF EXISTS fk_structure_components_structure;
ALTER TABLE public.structure_components ADD CONSTRAINT fk_structure_components_structure 
  FOREIGN KEY (structure_id) REFERENCES public.structure(str_id) ON DELETE CASCADE;

-- 3. SOW (Scope of Work) Table Cascade
ALTER TABLE public.u_sow DROP CONSTRAINT IF EXISTS fk_u_sow_structure;
ALTER TABLE public.u_sow ADD CONSTRAINT fk_u_sow_structure 
  FOREIGN KEY (structure_id) REFERENCES public.structure(str_id) ON DELETE CASCADE;

-- 4. Inspection Jobs Cascade (ROV and Diving)
ALTER TABLE public.insp_rov_jobs DROP CONSTRAINT IF EXISTS insp_rov_jobs_structure_id_fkey;
ALTER TABLE public.insp_rov_jobs ADD CONSTRAINT insp_rov_jobs_structure_id_fkey 
  FOREIGN KEY (structure_id) REFERENCES public.structure(str_id) ON DELETE CASCADE;

ALTER TABLE public.insp_dive_jobs DROP CONSTRAINT IF EXISTS insp_dive_jobs_structure_id_fkey;
ALTER TABLE public.insp_dive_jobs ADD CONSTRAINT insp_dive_jobs_structure_id_fkey 
  FOREIGN KEY (structure_id) REFERENCES public.structure(str_id) ON DELETE CASCADE;

-- 5. Primary Inspection Records Cascade
ALTER TABLE public.insp_records DROP CONSTRAINT IF EXISTS fk_insp_records_structure;
ALTER TABLE public.insp_records ADD CONSTRAINT fk_insp_records_structure 
  FOREIGN KEY (structure_id) REFERENCES public.structure(str_id) ON DELETE CASCADE;

-- 6. Trigger to Cascade Polymorphic Attachments when Inspection Records are deleted
CREATE OR REPLACE FUNCTION public.fn_clean_orphaned_attachments()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.attachment
    WHERE source_id = OLD.insp_id AND source_type = 'INSPECTION';
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clean_orphaned_attachments ON public.insp_records;
CREATE TRIGGER trg_clean_orphaned_attachments
AFTER DELETE ON public.insp_records
FOR EACH ROW
EXECUTE FUNCTION public.fn_clean_orphaned_attachments();

-- 7. Trigger to Clean Parent Structure when a Platform is deleted directly
CREATE OR REPLACE FUNCTION public.fn_clean_parent_structure_on_platform_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.structure WHERE str_id = OLD.plat_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clean_parent_structure_on_platform_delete ON public.platform;
CREATE TRIGGER trg_clean_parent_structure_on_platform_delete
AFTER DELETE ON public.platform
FOR EACH ROW
EXECUTE FUNCTION public.fn_clean_parent_structure_on_platform_delete();

-- 8. Trigger to Clean Parent Structure when a Pipeline is deleted directly
CREATE OR REPLACE FUNCTION public.fn_clean_parent_structure_on_pipeline_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.structure WHERE str_id = OLD.pipe_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clean_parent_structure_on_pipeline_delete ON public.u_pipeline;
CREATE TRIGGER trg_clean_parent_structure_on_pipeline_delete
AFTER DELETE ON public.u_pipeline
FOR EACH ROW
EXECUTE FUNCTION public.fn_clean_parent_structure_on_pipeline_delete();

-- 9. Comment Table Cascade
ALTER TABLE public.comment DROP CONSTRAINT IF EXISTS fk_comment_structure;
ALTER TABLE public.comment ADD CONSTRAINT fk_comment_structure 
  FOREIGN KEY (structure_id) REFERENCES public.structure(str_id) ON DELETE CASCADE;

