-- ======================================================================
-- PLATFORM SYNC TRIGGERS
-- ======================================================================

-- 1. Function to handle insertions from platform
CREATE OR REPLACE FUNCTION public.handle_platform_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.structure (str_id, str_type)
    VALUES (NEW.plat_id, 'PLATFORM')
    ON CONFLICT (str_id) 
    DO UPDATE SET str_type = EXCLUDED.str_type;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create INSERT trigger on the platform table
DROP TRIGGER IF EXISTS trg_platform_insert ON public.platform;
CREATE TRIGGER trg_platform_insert
AFTER INSERT ON public.platform
FOR EACH ROW
EXECUTE FUNCTION public.handle_platform_insert();


-- 2. Function to handle deletions from platform
CREATE OR REPLACE FUNCTION public.handle_platform_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.structure 
    WHERE str_id = OLD.plat_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create DELETE trigger on the platform table
DROP TRIGGER IF EXISTS trg_platform_delete ON public.platform;
CREATE TRIGGER trg_platform_delete
AFTER DELETE ON public.platform
FOR EACH ROW
EXECUTE FUNCTION public.handle_platform_delete();



-- ======================================================================
-- U_PIPELINE SYNC TRIGGERS
-- ======================================================================

-- 3. Function to handle insertions from u_pipeline
CREATE OR REPLACE FUNCTION public.handle_pipeline_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.structure (str_id, str_type)
    VALUES (NEW.pipe_id, 'PIPELINE')
    ON CONFLICT (str_id) 
    DO UPDATE SET str_type = EXCLUDED.str_type;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create INSERT trigger on the u_pipeline table
DROP TRIGGER IF EXISTS trg_pipeline_insert ON public.u_pipeline;
CREATE TRIGGER trg_pipeline_insert
AFTER INSERT ON public.u_pipeline
FOR EACH ROW
EXECUTE FUNCTION public.handle_pipeline_insert();


-- 4. Function to handle deletions from u_pipeline
CREATE OR REPLACE FUNCTION public.handle_pipeline_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.structure 
    WHERE str_id = OLD.pipe_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create DELETE trigger on the u_pipeline table
DROP TRIGGER IF EXISTS trg_pipeline_delete ON public.u_pipeline;
CREATE TRIGGER trg_pipeline_delete
AFTER DELETE ON public.u_pipeline
FOR EACH ROW
EXECUTE FUNCTION public.handle_pipeline_delete();
