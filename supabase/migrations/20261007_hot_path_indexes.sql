-- ==============================================================================
-- Migration: Hot-path indexes for navigation & data retrieval (perf pass 2)
-- ==============================================================================
-- Targets only query patterns NOT covered by earlier migrations:
--   * 20260211_inspection_module_schema(_corrected).sql already indexes
--     insp_records(rov_job_id/dive_job_id/structure_id/component_id/jobpack_id),
--     movements(job ids), video_tapes(job ids), video_logs(tape_id/inspection_id),
--     insp_anomalies(inspection_id), insp_media(inspection_id/anomaly_id).
--   * 20260930_jobpack_performance_indexes.sql already covers the
--     jobpack/structure/sow_report_no composites.
--   * 20260930_backfill_company_id_all_tables.sql already created
--     idx_<table>_company_id for all tenant tables (incl. company_settings,
--     structure, movements, tapes, logs, anomalies, media).
-- Gaps filled here: company_memberships (auth chain + RLS), attachment,
-- tape linkage, anomaly-by-component, and job+recency composites used by the
-- rov/dive live-data polls.
-- All statements are idempotent (IF NOT EXISTS) and safe to re-run.
-- ==============================================================================

-- 1. Auth chain: getUserMembership() + get_user_active_company_id() (used by
--    RLS on every tenant table) both filter company_memberships by user_id.
CREATE INDEX IF NOT EXISTS idx_company_memberships_user_active
  ON public.company_memberships(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_company_memberships_company
  ON public.company_memberships(company_id);

-- 2. Attachments: /api/attachment/[type]/[id] filters by source, tenant routes
--    filter by company_id. No indexes existed on this table.
CREATE INDEX IF NOT EXISTS idx_attachment_source
  ON public.attachment(source_id, source_type);

CREATE INDEX IF NOT EXISTS idx_attachment_company_id
  ON public.attachment(company_id);

-- 3. Tape linkage: records resolved/looked up by tape_id (tape-validation and
--    linkage migrations).
CREATE INDEX IF NOT EXISTS idx_insp_records_tape
  ON public.insp_records(tape_id)
  WHERE tape_id IS NOT NULL;

-- 4. Anomalies by component (component/structure attachment + anomaly routes
--    filter insp_anomalies by component_id).
CREATE INDEX IF NOT EXISTS idx_anomalies_component
  ON public.insp_anomalies(component_id)
  WHERE component_id IS NOT NULL;

-- 5. Live-data polls (rov/dive loadLatestData, every 5s while visible):
--    eq(job id) + order by recency limit 1 -> composite avoids a sort per tick.
CREATE INDEX IF NOT EXISTS idx_insp_records_rov_job_cr_date
  ON public.insp_records(rov_job_id, cr_date DESC)
  WHERE rov_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_insp_records_dive_job_cr_date
  ON public.insp_records(dive_job_id, cr_date DESC)
  WHERE dive_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rov_movements_job_time
  ON public.insp_rov_movements(rov_job_id, movement_time DESC);

CREATE INDEX IF NOT EXISTS idx_dive_movements_job_time
  ON public.insp_dive_movements(dive_job_id, movement_time DESC);
