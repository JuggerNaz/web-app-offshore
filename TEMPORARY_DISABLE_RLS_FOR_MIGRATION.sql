-- =========================================================================
-- TEMPORARY SQL SCRIPT TO DISABLE RLS FOR THE MIGRATION RUN
-- Run this in your Supabase Dashboard SQL Editor if you do not have
-- SUPABASE_SERVICE_ROLE_KEY set up in your .env.local file.
-- =========================================================================

-- ---------------------------------------------------------
-- STEP 1: Temporarily DISABLE Row-Level Security (RLS)
-- ---------------------------------------------------------
ALTER TABLE public.insp_rov_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.insp_dive_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.insp_rov_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.insp_dive_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.insp_video_tapes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.insp_video_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.insp_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.insp_anomalies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachment DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_type DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.structure_components DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment DISABLE ROW LEVEL SECURITY;

-- Grant all permissions to both anon and authenticated roles for safety during migration
GRANT ALL ON public.insp_rov_jobs TO anon, authenticated;
GRANT ALL ON public.insp_dive_jobs TO anon, authenticated;
GRANT ALL ON public.insp_rov_movements TO anon, authenticated;
GRANT ALL ON public.insp_dive_movements TO anon, authenticated;
GRANT ALL ON public.insp_video_tapes TO anon, authenticated;
GRANT ALL ON public.insp_video_logs TO anon, authenticated;
GRANT ALL ON public.insp_records TO anon, authenticated;
GRANT ALL ON public.insp_anomalies TO anon, authenticated;
GRANT ALL ON public.attachment TO anon, authenticated;
GRANT ALL ON public.inspection_type TO anon, authenticated;
GRANT ALL ON public.structure_components TO anon, authenticated;
GRANT ALL ON public.comment TO anon, authenticated;

-- Ensure sequences can be accessed by anon
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- =========================================================================
-- STEP 2: RUN THE MIGRATION NOW
-- (Run node scratch_trigger_migration.js or trigger it from your dev UI)
-- =========================================================================

/*
-- ---------------------------------------------------------
-- STEP 3: RE-ENABLE Row-Level Security (RLS) AFTER MIGRATION
-- (Uncomment and run these commands once migration is complete)
-- ---------------------------------------------------------

ALTER TABLE public.insp_rov_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insp_dive_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insp_rov_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insp_dive_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insp_video_tapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insp_video_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insp_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structure_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment ENABLE ROW LEVEL SECURITY;
*/
