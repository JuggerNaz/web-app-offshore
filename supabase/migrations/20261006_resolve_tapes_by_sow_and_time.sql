-- ==============================================================================
-- Match & Link insp_records to insp_video_tapes by:
--   - rov_job_id (or dive_job_id)
--   - structure_id, jobpack_id, sow_report_no
--   - inspection_date, inspection_time, tape_count_no
-- ==============================================================================

-- ==============================================================================
-- PART 1: DIAGNOSTIC & PREVIEW QUERY (Run this first to see the exact matches)
-- ==============================================================================
WITH tape_windows AS (
    SELECT 
        t.tape_id,
        t.tape_no,
        COALESCE(NULLIF(TRIM(t.chapter_no), ''), '1') AS chapter_no,
        t.rov_job_id,
        t.dive_job_id,
        -- Video log start timestamp and counter
        COALESCE(MIN(l.event_time), t.cr_date, '1970-01-01 00:00:00'::timestamp) AS start_time,
        COALESCE(MAX(l.event_time), t.cr_date + INTERVAL '12 hour', '2099-12-31 23:59:59'::timestamp) AS end_time,
        COALESCE(MIN(l.tape_counter_start), 0) AS min_counter,
        COALESCE(MAX(l.tape_counter_start), 999999) AS max_counter
    FROM public.insp_video_tapes t
    LEFT JOIN public.insp_video_logs l ON t.tape_id = l.tape_id
    GROUP BY t.tape_id, t.tape_no, t.chapter_no, t.rov_job_id, t.dive_job_id, t.cr_date
),
ranked_matches AS (
    SELECT 
        r.insp_id,
        r.rov_job_id,
        r.structure_id,
        r.jobpack_id,
        r.sow_report_no,
        r.inspection_date,
        r.inspection_time,
        r.tape_count_no,
        w.tape_id AS matched_tape_id,
        w.tape_no AS matched_tape_no,
        w.chapter_no AS matched_chapter_no,
        w.start_time AS tape_start_time,
        w.end_time AS tape_end_time,
        (r.inspection_date + r.inspection_time)::timestamp AS insp_datetime,
        ROW_NUMBER() OVER (
            PARTITION BY r.insp_id
            ORDER BY
                -- 1. Exact match where inspection timestamp is inside the tape's log window
                CASE WHEN (r.inspection_date + r.inspection_time)::timestamp BETWEEN w.start_time AND w.end_time THEN 0 ELSE 1 END,
                -- 2. Match by counter if numeric
                CASE WHEN (r.tape_count_no ~ '^\d+$' AND r.tape_count_no::int4 BETWEEN w.min_counter AND w.max_counter) THEN 0 ELSE 1 END,
                -- 3. Closest time difference to tape start
                ABS(EXTRACT(EPOCH FROM ((r.inspection_date + r.inspection_time)::timestamp - w.start_time))) ASC
        ) AS rank_order
    FROM public.insp_records r
    JOIN tape_windows w ON r.rov_job_id = w.rov_job_id OR r.dive_job_id = w.dive_job_id
    WHERE r.tape_id IS NULL
      AND (r.sow_report_no = 'AM26-016-01' OR r.structure_id = 225)
)
SELECT 
    insp_id,
    rov_job_id,
    sow_report_no,
    inspection_date,
    inspection_time,
    tape_count_no,
    matched_tape_id,
    matched_tape_no,
    matched_chapter_no,
    insp_datetime,
    tape_start_time,
    tape_end_time
FROM ranked_matches
WHERE rank_order = 1
ORDER BY inspection_date, inspection_time;


-- ==============================================================================
-- PART 2: EXECUTION UPDATE SCRIPT (Run this to update insp_records & insp_video_logs)
-- ==============================================================================
BEGIN;

WITH tape_windows AS (
    SELECT 
        t.tape_id,
        t.tape_no,
        COALESCE(NULLIF(TRIM(t.chapter_no), ''), '1') AS chapter_no,
        t.rov_job_id,
        t.dive_job_id,
        COALESCE(MIN(l.event_time), t.cr_date, '1970-01-01 00:00:00'::timestamp) AS start_time,
        COALESCE(MAX(l.event_time), t.cr_date + INTERVAL '12 hour', '2099-12-31 23:59:59'::timestamp) AS end_time,
        COALESCE(MIN(l.tape_counter_start), 0) AS min_counter,
        COALESCE(MAX(l.tape_counter_start), 999999) AS max_counter
    FROM public.insp_video_tapes t
    LEFT JOIN public.insp_video_logs l ON t.tape_id = l.tape_id
    GROUP BY t.tape_id, t.tape_no, t.chapter_no, t.rov_job_id, t.dive_job_id, t.cr_date
),
best_matches AS (
    SELECT 
        r.insp_id,
        w.tape_id AS resolved_tape_id,
        w.tape_no AS resolved_tape_no,
        w.chapter_no AS resolved_chapter_no,
        ROW_NUMBER() OVER (
            PARTITION BY r.insp_id
            ORDER BY
                CASE WHEN (r.inspection_date + r.inspection_time)::timestamp BETWEEN w.start_time AND w.end_time THEN 0 ELSE 1 END,
                CASE WHEN (r.tape_count_no ~ '^\d+$' AND r.tape_count_no::int4 BETWEEN w.min_counter AND w.max_counter) THEN 0 ELSE 1 END,
                ABS(EXTRACT(EPOCH FROM ((r.inspection_date + r.inspection_time)::timestamp - w.start_time))) ASC
        ) AS rank_order
    FROM public.insp_records r
    JOIN tape_windows w ON r.rov_job_id = w.rov_job_id OR r.dive_job_id = w.dive_job_id
    WHERE (r.tape_id IS NULL OR r.tape_id = 0)
)
-- 1. Update insp_records.tape_id and injection into inspection_data JSON
UPDATE public.insp_records r
SET 
    tape_id = b.resolved_tape_id,
    inspection_data = jsonb_set(
        jsonb_set(
            r.inspection_data,
            '{tape_no}',
            to_jsonb(b.resolved_tape_no)
        ),
        '{chapter_no}',
        to_jsonb(b.resolved_chapter_no)
    )
FROM best_matches b
WHERE r.insp_id = b.insp_id
  AND b.rank_order = 1;

-- 2. Link insp_video_logs to the resolved tape_id
UPDATE public.insp_video_logs l
SET tape_id = r.tape_id
FROM public.insp_records r
WHERE l.inspection_id = r.insp_id
  AND r.tape_id IS NOT NULL
  AND (l.tape_id IS NULL OR l.tape_id = 0);

COMMIT;
