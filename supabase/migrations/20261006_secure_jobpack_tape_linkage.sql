-- ==============================================================================
-- Secure Jobpack-Scoped Multi-Level Tape Linkage Script
-- Strictly enforces:
--   1. jobpack_id (exact match to prevent cross-jobpack pollution)
--   2. structure_id & sow_report_no
--   3. rov_job_id / dive_job_id
--   4. Inspection Date & Time Proximity and Tape Counter Range
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- LEVEL 1: Peer Proximity Match (STRICTLY within same jobpack_id, structure_id, sow_report_no)
-- ------------------------------------------------------------------------------
WITH populated_peers AS (
    SELECT 
        insp_id,
        rov_job_id,
        dive_job_id,
        structure_id,
        jobpack_id,
        sow_report_no,
        inspection_date,
        inspection_time,
        tape_count_no,
        tape_id,
        (inspection_date + inspection_time)::timestamp AS peer_datetime
    FROM public.insp_records
    WHERE tape_id IS NOT NULL 
      AND tape_id > 0
      AND jobpack_id IS NOT NULL
),
unassigned_records AS (
    SELECT 
        r.insp_id,
        r.rov_job_id,
        r.dive_job_id,
        r.structure_id,
        r.jobpack_id,
        r.sow_report_no,
        r.inspection_date,
        r.inspection_time,
        r.tape_count_no,
        (r.inspection_date + r.inspection_time)::timestamp AS insp_datetime
    FROM public.insp_records r
    WHERE (r.tape_id IS NULL OR r.tape_id = 0)
),
matched_from_peers AS (
    SELECT 
        u.insp_id,
        p.tape_id,
        ROW_NUMBER() OVER (
            PARTITION BY u.insp_id
            ORDER BY 
                -- 1. Must match same SOW report
                CASE WHEN u.sow_report_no = p.sow_report_no THEN 0 ELSE 1 END,
                -- 2. Must match same inspection date
                CASE WHEN u.inspection_date = p.inspection_date THEN 0 ELSE 1 END,
                -- 3. Closest time proximity
                ABS(EXTRACT(EPOCH FROM (u.insp_datetime - p.peer_datetime))) ASC
        ) AS rn
    FROM unassigned_records u
    JOIN populated_peers p 
      ON u.jobpack_id = p.jobpack_id          -- STRICT JOBPACK MATCH
     AND u.structure_id = p.structure_id      -- STRICT STRUCTURE MATCH
     AND (
         (u.rov_job_id IS NOT NULL AND u.rov_job_id = p.rov_job_id) OR
         (u.dive_job_id IS NOT NULL AND u.dive_job_id = p.dive_job_id) OR
         (u.sow_report_no IS NOT NULL AND u.sow_report_no = p.sow_report_no)
     )
)
UPDATE public.insp_records r
SET tape_id = m.tape_id
FROM matched_from_peers m
WHERE r.insp_id = m.insp_id
  AND m.rn = 1
  AND (r.tape_id IS NULL OR r.tape_id = 0);


-- ------------------------------------------------------------------------------
-- LEVEL 2: Video Logs Match (Strictly within same jobpack_id & structure_id via Job IDs)
-- ------------------------------------------------------------------------------
WITH log_candidates AS (
    SELECT 
        l.tape_id,
        l.event_time,
        t.rov_job_id,
        t.dive_job_id,
        COALESCE(j_rov.jobpack_id, j_dive.jobpack_id) AS jobpack_id,
        COALESCE(j_rov.structure_id, j_dive.structure_id) AS structure_id,
        t.tape_no
    FROM public.insp_video_logs l
    JOIN public.insp_video_tapes t ON l.tape_id = t.tape_id
    LEFT JOIN public.insp_rov_jobs j_rov ON t.rov_job_id = j_rov.rov_job_id
    LEFT JOIN public.insp_dive_jobs j_dive ON t.dive_job_id = j_dive.dive_job_id
    WHERE l.tape_id IS NOT NULL AND l.tape_id > 0
),
matched_from_logs AS (
    SELECT 
        r.insp_id,
        c.tape_id,
        ROW_NUMBER() OVER (
            PARTITION BY r.insp_id
            ORDER BY 
                CASE WHEN r.rov_job_id = c.rov_job_id THEN 0 ELSE 1 END,
                ABS(EXTRACT(EPOCH FROM ((r.inspection_date + r.inspection_time)::timestamp - c.event_time))) ASC
        ) AS rn
    FROM public.insp_records r
    JOIN log_candidates c 
      ON r.jobpack_id = c.jobpack_id          -- STRICT JOBPACK MATCH
     AND r.structure_id = c.structure_id      -- STRICT STRUCTURE MATCH
     AND (r.rov_job_id = c.rov_job_id OR r.dive_job_id = c.dive_job_id)
    WHERE (r.tape_id IS NULL OR r.tape_id = 0)
)
UPDATE public.insp_records r
SET tape_id = m.tape_id
FROM matched_from_logs m
WHERE r.insp_id = m.insp_id
  AND m.rn = 1
  AND (r.tape_id IS NULL OR r.tape_id = 0);


-- ------------------------------------------------------------------------------
-- LEVEL 3: SOW & Time/Counter Cluster Match (Strictly scoped to Jobpack & Structure)
-- ------------------------------------------------------------------------------
WITH jobpack_tapes AS (
    SELECT 
        t.tape_id,
        t.tape_no,
        COALESCE(NULLIF(TRIM(t.chapter_no), ''), '1') AS chapter_no,
        t.rov_job_id,
        t.dive_job_id,
        COALESCE(j_rov.jobpack_id, j_dive.jobpack_id) AS jobpack_id,
        COALESCE(j_rov.structure_id, j_dive.structure_id) AS structure_id
    FROM public.insp_video_tapes t
    LEFT JOIN public.insp_rov_jobs j_rov ON t.rov_job_id = j_rov.rov_job_id
    LEFT JOIN public.insp_dive_jobs j_dive ON t.dive_job_id = j_dive.dive_job_id
),
matched_clusters AS (
    SELECT 
        r.insp_id,
        r.jobpack_id,
        r.structure_id,
        -- Cluster 1: Time < 02:30 or counter >= 60000 -> Earliest tape of this jobpack
        -- Cluster 2: Time >= 02:30 or counter < 60000 -> Subsequent tape of this jobpack
        CASE 
            WHEN r.inspection_time < '02:30:00'::time OR (r.tape_count_no ~ '^\d+$' AND r.tape_count_no::int4 >= 60000) THEN (
                SELECT tape_id 
                FROM jobpack_tapes jt 
                WHERE jt.jobpack_id = r.jobpack_id 
                  AND jt.structure_id = r.structure_id
                  AND (jt.rov_job_id = r.rov_job_id OR jt.dive_job_id = r.dive_job_id OR jt.tape_no ILIKE '%' || r.sow_report_no || '%')
                ORDER BY jt.tape_id ASC 
                LIMIT 1
            )
            ELSE (
                SELECT tape_id 
                FROM jobpack_tapes jt 
                WHERE jt.jobpack_id = r.jobpack_id 
                  AND jt.structure_id = r.structure_id
                  AND (jt.rov_job_id = r.rov_job_id OR jt.dive_job_id = r.dive_job_id OR jt.tape_no ILIKE '%' || r.sow_report_no || '%')
                ORDER BY jt.tape_id DESC 
                LIMIT 1
            )
        END AS target_tape_id
    FROM public.insp_records r
    WHERE (r.tape_id IS NULL OR r.tape_id = 0)
)
UPDATE public.insp_records r
SET tape_id = mc.target_tape_id
FROM matched_clusters mc
WHERE r.insp_id = mc.insp_id
  AND mc.target_tape_id IS NOT NULL
  AND (r.tape_id IS NULL OR r.tape_id = 0);


-- ------------------------------------------------------------------------------
-- STEP 4: Synchronize inspection_data JSON (tape_no and chapter_no)
-- ------------------------------------------------------------------------------
UPDATE public.insp_records r
SET inspection_data = jsonb_set(
    jsonb_set(
        r.inspection_data,
        '{tape_no}',
        to_jsonb(t.tape_no)
    ),
    '{chapter_no}',
    to_jsonb(COALESCE(NULLIF(TRIM(t.chapter_no), ''), '1'))
)
FROM public.insp_video_tapes t
WHERE r.tape_id = t.tape_id
  AND (
      r.inspection_data->>'tape_no' IS NULL 
      OR TRIM(r.inspection_data->>'tape_no') = '' 
      OR r.inspection_data->>'tape_no' <> t.tape_no
      OR r.inspection_data->>'chapter_no' IS NULL
  );


-- ------------------------------------------------------------------------------
-- STEP 5: Synchronize insp_video_logs with the newly resolved tape_id
-- ------------------------------------------------------------------------------
UPDATE public.insp_video_logs l
SET tape_id = r.tape_id
FROM public.insp_records r
WHERE l.inspection_id = r.insp_id
  AND r.tape_id IS NOT NULL
  AND (l.tape_id IS NULL OR l.tape_id = 0);

COMMIT;

-- ------------------------------------------------------------------------------
-- VERIFICATION REPORT (Specifically check Jobpack 622 & Structure 225)
-- ------------------------------------------------------------------------------
SELECT 
    COUNT(*) AS remaining_null_records_for_jobpack_622
FROM public.insp_records
WHERE jobpack_id = 622
  AND structure_id = 225
  AND sow_report_no = 'AM26-016-01'
  AND tape_id IS NULL;

-- View all records with their secured tape linkages
SELECT 
    r.insp_id,
    r.jobpack_id,
    r.structure_id,
    r.sow_report_no,
    r.rov_job_id,
    r.inspection_date,
    r.inspection_time,
    r.tape_count_no,
    r.tape_id,
    t.tape_no,
    t.chapter_no
FROM public.insp_records r
JOIN public.insp_video_tapes t ON r.tape_id = t.tape_id
WHERE r.jobpack_id = 622
  AND r.structure_id = 225
  AND r.sow_report_no = 'AM26-016-01'
ORDER BY r.inspection_date, r.inspection_time;
