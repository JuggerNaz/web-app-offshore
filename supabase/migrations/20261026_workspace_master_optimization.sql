-- ==============================================================================
-- MASTER MIGRATION: Inspection Workspace Full Performance Suite
-- File: supabase/migrations/20261026_workspace_master_optimization.sql
-- ==============================================================================
-- Comprehensive backend optimization for:
--   1. Captured Events & Inspection Records (Filters, Sorting, Search, Truncation fix)
--   2. Component List Panel (SOW vs Non-SOW, Framing Members, Dynamic Statuses)
--   3. Dive / ROV Deployment Panel (Deployments, Movements, Time-in-Water)
--   4. Video Panel (Tapes, Chapters, Counters, Recording States)
-- All statements are safe, idempotent (IF NOT EXISTS / OR REPLACE), and non-destructive.
-- ==============================================================================

-- ==============================================================================
-- SECTION 1: PERFORMANCE INDEXES
-- ==============================================================================

-- 1.1 Inspection Records Indexes
CREATE INDEX IF NOT EXISTS idx_insp_records_workspace_lookup
  ON public.insp_records(jobpack_id, structure_id, sow_report_no, inspection_date DESC, inspection_time DESC, insp_id DESC);

CREATE INDEX IF NOT EXISTS idx_insp_records_type_code
  ON public.insp_records(inspection_type_code)
  WHERE inspection_type_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_insp_records_status_has_anomaly
  ON public.insp_records(status, has_anomaly);

CREATE INDEX IF NOT EXISTS idx_insp_records_comp_task_lookup
  ON public.insp_records(structure_id, jobpack_id, component_id, inspection_type_code);

CREATE INDEX IF NOT EXISTS idx_insp_records_inspection_data_gin
  ON public.insp_records USING gin (inspection_data jsonb_path_ops);

-- 1.2 Anomalies & Findings Indexes
CREATE INDEX IF NOT EXISTS idx_insp_anomalies_insp_cat_status
  ON public.insp_anomalies(inspection_id, record_category, status);

CREATE INDEX IF NOT EXISTS idx_insp_anomalies_ref_no
  ON public.insp_anomalies(anomaly_ref_no);

CREATE INDEX IF NOT EXISTS idx_insp_anomalies_insp_priority
  ON public.insp_anomalies(inspection_id, priority_code);

-- 1.3 Attachments & Media Indexes
CREATE INDEX IF NOT EXISTS idx_attachment_source_id_type
  ON public.attachment(source_id, source_type);

CREATE INDEX IF NOT EXISTS idx_insp_media_inspection_id
  ON public.insp_media(inspection_id);

-- 1.4 Structure Components Indexes
CREATE INDEX IF NOT EXISTS idx_structure_components_active_lookup
  ON public.structure_components(structure_id, id)
  WHERE is_deleted IS NOT TRUE;

CREATE INDEX IF NOT EXISTS idx_structure_components_qid_active
  ON public.structure_components(structure_id, q_id)
  WHERE is_deleted IS NOT TRUE;

-- 1.5 SOW & SOW Items Indexes
CREATE INDEX IF NOT EXISTS idx_u_sow_jp_str_unique
  ON public.u_sow(jobpack_id, structure_id);

CREATE INDEX IF NOT EXISTS idx_u_sow_items_sow_comp_lookup
  ON public.u_sow_items(sow_id, component_id);

CREATE INDEX IF NOT EXISTS idx_u_sow_items_sow_qid_lookup
  ON public.u_sow_items(sow_id, component_qid);

CREATE INDEX IF NOT EXISTS idx_u_sow_items_report_lookup
  ON public.u_sow_items(sow_id, report_number);

-- 1.6 Dive & ROV Jobs and Movements Indexes
CREATE INDEX IF NOT EXISTS idx_insp_dive_jobs_jp_str
  ON public.insp_dive_jobs(jobpack_id, structure_id, dive_job_id DESC);

CREATE INDEX IF NOT EXISTS idx_insp_rov_jobs_jp_str
  ON public.insp_rov_jobs(jobpack_id, structure_id, rov_job_id DESC);

CREATE INDEX IF NOT EXISTS idx_insp_dive_movements_job_time
  ON public.insp_dive_movements(dive_job_id, movement_time ASC);

CREATE INDEX IF NOT EXISTS idx_insp_rov_movements_job_time
  ON public.insp_rov_movements(rov_job_id, movement_time ASC);

-- 1.7 Video Tapes & Video Logs Indexes
CREATE INDEX IF NOT EXISTS idx_insp_video_tapes_dive_job
  ON public.insp_video_tapes(dive_job_id, tape_id DESC);

CREATE INDEX IF NOT EXISTS idx_insp_video_tapes_rov_job
  ON public.insp_video_tapes(rov_job_id, tape_id DESC);

CREATE INDEX IF NOT EXISTS idx_insp_video_tapes_no_chapter
  ON public.insp_video_tapes(tape_no, chapter_no);

CREATE INDEX IF NOT EXISTS idx_insp_video_logs_tape_time
  ON public.insp_video_logs(tape_id, event_time DESC, video_log_id DESC);

CREATE INDEX IF NOT EXISTS idx_insp_video_logs_state_filter
  ON public.insp_video_logs(tape_id, event_time DESC)
  WHERE event_type IN ('NEW_LOG_START', 'RESUME', 'PAUSE', 'END');


-- ==============================================================================
-- SECTION 2: VIEW - v_inspection_workspace_records (Captured Events Panel)
-- ==============================================================================

CREATE OR REPLACE VIEW public.v_inspection_workspace_records AS
SELECT
  -- Core Record Columns
  r.insp_id,
  r.company_id,
  r.jobpack_id,
  r.structure_id,
  COALESCE(
    NULLIF(TRIM(r.sow_report_no), ''),
    NULLIF(TRIM(r.inspection_data->>'sow_report_no'), ''),
    NULLIF(TRIM(r.inspection_data->>'sowReportNo'), ''),
    'N/A'
  ) AS sow_report_no,
  r.component_id,
  r.component_type,
  r.inspection_type_id,
  COALESCE(r.inspection_type_code, it.code, '') AS inspection_type_code,
  r.inspection_date,
  r.inspection_time,
  r.tape_id,
  r.tape_count_no,
  r.elevation,
  r.fp_kp,
  COALESCE(r.description, r.inspection_data->>'event_description', r.inspection_data->>'description', '') AS description,
  r.status,
  r.has_anomaly,
  r.inspection_data,
  r.dive_job_id,
  r.rov_job_id,
  r.cr_date,
  r.md_date,
  r.reviewed_by,
  r.reviewed_date,
  r.approved_by,
  r.approved_date,
  -- Incomplete Details & Reasons
  COALESCE(
    NULLIF(TRIM(r.incomplete_reason), ''),
    NULLIF(TRIM(r.inspection_data->>'incomplete_reason'), ''),
    NULLIF(TRIM(r.inspection_data->>'reason'), ''),
    ''
  ) AS incomplete_reason,
  COALESCE(
    NULLIF(TRIM(r.inspection_data->>'incomplete_details'), ''),
    NULLIF(TRIM(r.inspection_data->>'incomplete_notes'), ''),
    ''
  ) AS incomplete_details,
  -- Structure Component Details
  sc.q_id AS component_qid,
  COALESCE(sc.id_no, sc.q_id, '') AS component_name,
  COALESCE(sc.code, r.component_type, '') AS component_code,
  sc.metadata AS component_metadata,
  -- Inspection Type Details
  it.name AS inspection_type_name,
  it.category AS inspection_type_category,
  -- Dive & ROV Job Details
  dj.dive_no,
  dj.diver_name,
  rj.deployment_no,
  rj.rov_operator,
  COALESCE(dj.dive_no, rj.deployment_no, '') AS job_no,
  COALESCE(dj.diver_name, rj.rov_operator, '') AS operator_name,
  -- Video Tape Details
  COALESCE(vt.tape_no, r.inspection_data->>'tape_no', '') AS tape_no,
  COALESCE(vt.chapter_no::text, r.inspection_data->>'chapter_no', '') AS chapter_no,
  -- Computed Attachment & Media Count
  (
    COALESCE(
      (
        SELECT COUNT(*)::int
        FROM public.attachment att
        WHERE att.source_id = r.insp_id
          AND LOWER(att.source_type) IN ('inspection', 'insp_record', 'anomaly', 'defect')
      ), 0
    ) +
    COALESCE(
      (
        SELECT COUNT(*)::int
        FROM public.insp_media m
        WHERE m.inspection_id = r.insp_id
      ), 0
    ) +
    COALESCE(
      jsonb_array_length(
        CASE 
          WHEN jsonb_typeof(r.inspection_data->'attachments') = 'array' 
          THEN r.inspection_data->'attachments' 
          ELSE '[]'::jsonb 
        END
      )::int, 0
    )
  ) AS attachment_count,
  -- Primary Anomaly / Finding Details
  pa.anomaly_id AS primary_anomaly_id,
  pa.anomaly_ref_no AS primary_anomaly_ref_no,
  COALESCE(
    pa.record_category,
    CASE 
      WHEN pa.anomaly_ref_no ILIKE 'F-%' OR pa.anomaly_ref_no ILIKE 'FIND-%' THEN 'FINDING'
      WHEN pa.anomaly_ref_no IS NOT NULL THEN 'ANOMALY'
      ELSE NULL
    END
  ) AS primary_record_category,
  pa.status AS primary_anomaly_status,
  pa.priority_code AS primary_priority_code,
  pa.defect_type_code AS primary_defect_type_code,
  pa.defect_category_code AS primary_defect_category_code,
  pa.defect_description AS primary_defect_description,
  pa.recommended_action AS primary_recommended_action,
  pa.follow_up_required AS primary_follow_up_required,
  pa.follow_up_notes AS primary_follow_up_notes,
  pa.is_rectified AS primary_is_rectified,
  pa.rectified_remarks AS primary_rectified_remarks,
  pa.rectified_date AS primary_rectified_date,
  pa.rectified_by AS primary_rectified_by,
  -- Full JSON array of all associated anomalies and findings
  (
    SELECT json_agg(
      json_build_object(
        'anomaly_id', a.anomaly_id,
        'anomaly_ref_no', a.anomaly_ref_no,
        'record_category', COALESCE(a.record_category, CASE WHEN a.anomaly_ref_no ILIKE 'F-%' OR a.anomaly_ref_no ILIKE 'FIND-%' THEN 'FINDING' ELSE 'ANOMALY' END),
        'status', a.status,
        'priority_code', a.priority_code,
        'defect_type_code', a.defect_type_code,
        'defect_category_code', a.defect_category_code,
        'defect_description', a.defect_description,
        'recommended_action', a.recommended_action,
        'follow_up_required', a.follow_up_required,
        'follow_up_notes', a.follow_up_notes,
        'is_rectified', a.is_rectified,
        'rectified_remarks', a.rectified_remarks,
        'rectified_date', a.rectified_date,
        'rectified_by', a.rectified_by,
        'is_amended', a.is_amended
      ) ORDER BY a.anomaly_id ASC
    )
    FROM public.insp_anomalies a
    WHERE a.inspection_id = r.insp_id
  ) AS anomalies_json,
  -- Normalized Record Classification
  CASE
    WHEN r.has_anomaly IS TRUE OR (pa.anomaly_ref_no IS NOT NULL AND (pa.record_category = 'ANOMALY' OR pa.anomaly_ref_no ILIKE 'A-%' OR (pa.record_category IS NULL AND pa.anomaly_ref_no NOT ILIKE 'F-%')))
      THEN 'ANOMALY'
    WHEN pa.anomaly_ref_no IS NOT NULL AND (pa.record_category = 'FINDING' OR pa.anomaly_ref_no ILIKE 'F-%')
      THEN 'FINDING'
    WHEN r.status = 'INCOMPLETE'
      THEN 'INCOMPLETE'
    WHEN r.status = 'COMPLETED'
      THEN 'COMPLETED'
    ELSE 'OTHER'
  END AS record_classification,
  -- Deterministic Status Priority Weight
  CASE
    WHEN r.has_anomaly IS TRUE OR (pa.anomaly_ref_no IS NOT NULL AND (pa.record_category = 'ANOMALY' OR pa.anomaly_ref_no ILIKE 'A-%' OR (pa.record_category IS NULL AND pa.anomaly_ref_no NOT ILIKE 'F-%')))
      THEN 4
    WHEN pa.anomaly_ref_no IS NOT NULL AND (pa.record_category = 'FINDING' OR pa.anomaly_ref_no ILIKE 'F-%')
      THEN 3
    WHEN r.status = 'INCOMPLETE'
      THEN 2
    WHEN r.status = 'COMPLETED'
      THEN 1
    ELSE 0
  END AS status_weight,
  -- Lowercase search vector for fast ILIKE queries
  LOWER(
    CONCAT_WS(' ',
      r.sow_report_no,
      COALESCE(r.description, r.inspection_data->>'event_description', r.inspection_data->>'description', ''),
      COALESCE(r.incomplete_reason, r.inspection_data->>'incomplete_reason', ''),
      r.elevation::text,
      r.fp_kp::text,
      r.inspection_type_code,
      it.name,
      sc.q_id,
      sc.code,
      sc.id_no,
      COALESCE(sc.metadata->>'start_leg', sc.metadata->>'s_leg', ''),
      COALESCE(sc.metadata->>'end_leg', sc.metadata->>'f_leg', ''),
      COALESCE(sc.metadata->>'start_node', sc.metadata->>'s_node', ''),
      COALESCE(sc.metadata->>'end_node', sc.metadata->>'f_node', ''),
      COALESCE(sc.metadata->>'level', ''),
      COALESCE(sc.metadata->>'face', ''),
      r.inspection_data->>'event_name',
      r.inspection_data->>'event_type',
      r.inspection_data->>'event_position',
      r.inspection_data->>'event_description',
      r.inspection_data->>'findings',
      r.inspection_data->>'scour_location',
      r.inspection_data->>'cp_rdg',
      r.inspection_data->>'cp_reading_mv',
      r.inspection_data->>'cp',
      vt.tape_no,
      dj.dive_no,
      rj.deployment_no,
      pa.anomaly_ref_no,
      pa.defect_type_code,
      pa.defect_description,
      pa.status,
      pa.priority_code
    )
  ) AS search_text
FROM public.insp_records r
LEFT JOIN public.structure_components sc ON sc.id = r.component_id
LEFT JOIN public.inspection_type it ON it.id = r.inspection_type_id
LEFT JOIN public.insp_dive_jobs dj ON dj.dive_job_id = r.dive_job_id
LEFT JOIN public.insp_rov_jobs rj ON rj.rov_job_id = r.rov_job_id
LEFT JOIN public.insp_video_tapes vt ON vt.tape_id = r.tape_id
LEFT JOIN LATERAL (
  SELECT a.*
  FROM public.insp_anomalies a
  WHERE a.inspection_id = r.insp_id
  ORDER BY 
    CASE 
      WHEN a.priority_code LIKE '%1%' THEN 1
      WHEN a.priority_code LIKE '%2%' THEN 2
      WHEN a.priority_code LIKE '%3%' THEN 3
      ELSE 4
    END,
    a.anomaly_id ASC
  LIMIT 1
) pa ON true;


-- ==============================================================================
-- SECTION 3: VIEW - v_workspace_component_sow_status (Component List Panel)
-- ==============================================================================

CREATE OR REPLACE VIEW public.v_workspace_component_sow_status AS
SELECT
  sc.id AS component_id,
  sc.structure_id,
  sc.company_id,
  s.jobpack_id,
  s.id AS sow_id,
  si.report_number AS sow_report_no,
  sc.q_id,
  COALESCE(sc.id_no, sc.q_id, '') AS name,
  COALESCE(sc.code, 'UNK') AS code,
  sc.metadata,
  -- Pre-extracted structural framing member attributes
  COALESCE(sc.metadata->>'start_node', sc.metadata->>'f_node', sc.metadata->>'Node_1', '-') AS start_node,
  COALESCE(sc.metadata->>'end_node', sc.metadata->>'s_node', sc.metadata->>'Node_2', '-') AS end_node,
  COALESCE(sc.metadata->>'f_leg', sc.metadata->>'start_leg', sc.metadata->>'s_leg', sc.metadata->>'leg_1', sc.metadata->>'StartLeg', '-') AS start_leg,
  COALESCE(sc.metadata->>'s_leg', sc.metadata->>'end_leg', sc.metadata->>'f_leg', sc.metadata->>'leg_2', sc.metadata->>'EndLeg', '-') AS end_leg,
  COALESCE(sc.metadata->>'start_elevation', sc.metadata->>'elv_1', '-') AS start_elevation,
  COALESCE(sc.metadata->>'end_elevation', sc.metadata->>'elv_2', '-') AS end_elevation,
  COALESCE(sc.metadata->>'nominal_thickness', sc.metadata->>'NominalThickness', sc.metadata->>'nominal_thk', sc.metadata->>'wall_thk', '-') AS nominal_thickness,
  COALESCE(sc.metadata->>'face', sc.metadata->>'face_name', sc.metadata->>'face_code', '') AS face,
  COALESCE(sc.metadata->>'water_depth', sc.metadata->>'depth', '-0.0m') AS water_depth,
  -- SOW Assignment
  si.id AS sow_item_id,
  si.inspection_code,
  si.inspection_name,
  si.status AS sow_status,
  CASE WHEN si.id IS NOT NULL THEN true ELSE false END AS is_assigned
FROM public.structure_components sc
LEFT JOIN public.u_sow s ON s.structure_id = sc.structure_id
LEFT JOIN public.u_sow_items si 
  ON si.sow_id = s.id 
  AND (si.component_id = sc.id OR (si.component_qid IS NOT NULL AND si.component_qid = sc.q_id))
WHERE sc.is_deleted IS NOT TRUE
  AND (sc.metadata->>'del' IS NULL OR sc.metadata->>'del' != '1');


-- ==============================================================================
-- SECTION 4: VIEWS - v_workspace_dive_deployments & v_workspace_rov_deployments
-- ==============================================================================

CREATE OR REPLACE VIEW public.v_workspace_dive_deployments AS
SELECT
  d.dive_job_id,
  d.dive_job_id AS id,
  d.structure_id,
  d.jobpack_id,
  d.company_id,
  d.dive_no AS job_no,
  COALESCE(d.diver_name, 'Unnamed Diver') AS name,
  d.dive_date,
  d.start_time,
  d.end_time,
  d.status,
  COALESCE(d.dive_date::text, d.start_time::text, d.cr_date::text) AS created_at,
  -- Latest movement activity label
  COALESCE(
    (
      SELECT dm.movement_type
      FROM public.insp_dive_movements dm
      WHERE dm.dive_job_id = d.dive_job_id
      ORDER BY dm.movement_time DESC, dm.movement_id DESC
      LIMIT 1
    ),
    'Awaiting Deployment'
  ) AS current_movement,
  -- Movements count
  (
    SELECT COUNT(*)::int
    FROM public.insp_dive_movements dm
    WHERE dm.dive_job_id = d.dive_job_id
  ) AS movements_count,
  -- Total inspections under this dive
  (
    SELECT COUNT(*)::int
    FROM public.insp_records r
    WHERE r.dive_job_id = d.dive_job_id
  ) AS records_count
FROM public.insp_dive_jobs d;


CREATE OR REPLACE VIEW public.v_workspace_rov_deployments AS
SELECT
  r.rov_job_id,
  r.rov_job_id AS id,
  r.structure_id,
  r.jobpack_id,
  r.company_id,
  r.deployment_no AS job_no,
  COALESCE(r.rov_operator, r.rov_serial_no, 'Unnamed ROV') AS name,
  r.deployment_date,
  r.start_time,
  r.end_time,
  r.status,
  COALESCE(r.deployment_date::text, r.start_time::text, r.cr_date::text) AS created_at,
  -- Latest movement activity label
  COALESCE(
    (
      SELECT rm.movement_type
      FROM public.insp_rov_movements rm
      WHERE rm.rov_job_id = r.rov_job_id
      ORDER BY rm.movement_time DESC, rm.movement_id DESC
      LIMIT 1
    ),
    'Awaiting Deployment'
  ) AS current_movement,
  -- Movements count
  (
    SELECT COUNT(*)::int
    FROM public.insp_rov_movements rm
    WHERE rm.rov_job_id = r.rov_job_id
  ) AS movements_count,
  -- Total inspections under this deployment
  (
    SELECT COUNT(*)::int
    FROM public.insp_records rec
    WHERE rec.rov_job_id = r.rov_job_id
  ) AS records_count
FROM public.insp_rov_jobs r;


-- ==============================================================================
-- SECTION 5: VIEW - v_workspace_video_tapes (Video Panel)
-- ==============================================================================

CREATE OR REPLACE VIEW public.v_workspace_video_tapes AS
SELECT
  t.tape_id,
  t.tape_no,
  t.chapter_no,
  t.dive_job_id,
  t.rov_job_id,
  t.tape_type,
  t.status,
  t.company_id,
  t.cr_date,
  -- Pre-calculated log events count
  COALESCE((SELECT COUNT(*)::int FROM public.insp_video_logs vl WHERE vl.tape_id = t.tape_id), 0) AS logs_count,
  -- Pre-calculated inspections tagged to this tape
  COALESCE((SELECT COUNT(*)::int FROM public.insp_records rec WHERE rec.tape_id = t.tape_id), 0) AS records_count,
  -- Latest recording state: 'NEW_LOG_START' | 'RESUME' | 'PAUSE' | 'END'
  COALESCE(
    (
      SELECT vl.event_type
      FROM public.insp_video_logs vl
      WHERE vl.tape_id = t.tape_id
        AND vl.event_type IN ('NEW_LOG_START', 'RESUME', 'PAUSE', 'END')
      ORDER BY vl.event_time DESC, vl.video_log_id DESC
      LIMIT 1
    ),
    'END'
  ) AS latest_state,
  -- Latest tape counter / timecode
  COALESCE(
    (
      SELECT vl.tape_counter_start
      FROM public.insp_video_logs vl
      WHERE vl.tape_id = t.tape_id
      ORDER BY vl.event_time DESC, vl.video_log_id DESC
      LIMIT 1
    ),
    0
  ) AS latest_counter,
  -- Latest event time
  (
    SELECT vl.event_time
    FROM public.insp_video_logs vl
    WHERE vl.tape_id = t.tape_id
    ORDER BY vl.event_time DESC, vl.video_log_id DESC
    LIMIT 1
  ) AS latest_event_time
FROM public.insp_video_tapes t;


-- ==============================================================================
-- SECTION 6: PERMISSIONS (Grants access to authenticated, anon, and service_role)
-- ==============================================================================

GRANT SELECT ON public.v_inspection_workspace_records TO authenticated, anon, service_role;
GRANT SELECT ON public.v_workspace_component_sow_status TO authenticated, anon, service_role;
GRANT SELECT ON public.v_workspace_dive_deployments TO authenticated, anon, service_role;
GRANT SELECT ON public.v_workspace_rov_deployments TO authenticated, anon, service_role;
GRANT SELECT ON public.v_workspace_video_tapes TO authenticated, anon, service_role;

-- Reload Supabase PostgREST schema cache immediately so views are accessible via API
NOTIFY pgrst, 'reload schema';
