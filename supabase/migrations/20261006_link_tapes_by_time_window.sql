-- ==============================================================================
-- Link Tapes to Inspection Records Based on:
--   1. Matching rov_job_id / dive_job_id
--   2. Inspection Date & Time falling within the Tape's Video Log Time Window (Start & End Time)
--   3. Synchronizing Tape No, Chapter No, and Tape ID
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- STEP 1: Compute the Video Log Time Boundaries (Start & End) for Each Tape
-- ------------------------------------------------------------------------------
WITH tape_time_windows AS (
    SELECT 
        t.tape_id,
        t.tape_no,
        COALESCE(NULLIF(TRIM(t.chapter_no), ''), '1') AS chapter_no,
        t.rov_job_id,
        t.dive_job_id,
        -- Window Start: Earliest log event_time or tape cr_date
        COALESCE(
            MIN(l.event_time),
            t.cr_date,
            '1970-01-01 00:00:00'::timestamp
        ) AS window_start,
        -- Window End: Latest log event_time or tape cr_date + duration
        COALESCE(
            MAX(l.event_time),
            t.cr_date + (COALESCE(t.total_duration_minutes, 180) * INTERVAL '1 minute'),
            '2099-12-31 23:59:59'::timestamp
        ) + INTERVAL '5 minute' AS window_end -- Added 5-minute buffer for timestamp tolerances
    FROM public.insp_video_tapes t
    LEFT JOIN public.insp_video_logs l ON t.tape_id = l.tape_id
    GROUP BY t.tape_id, t.tape_no, t.chapter_no, t.rov_job_id, t.dive_job_id, t.cr_date, t.total_duration_minutes
),

-- ------------------------------------------------------------------------------
-- STEP 2: Match Unassigned Inspection Records with the Tape whose Window contains the Inspection Date & Time
-- ------------------------------------------------------------------------------
matched_inspections AS (
    SELECT 
        r.insp_id,
        w.tape_id,
        w.tape_no,
        w.chapter_no,
        (r.inspection_date + r.inspection_time)::timestamp AS insp_timestamp,
        w.window_start,
        w.window_end,
        ROW_NUMBER() OVER (
            PARTITION BY r.insp_id 
            ORDER BY 
                -- Prioritize exact containment, then closest start time
                CASE WHEN (r.inspection_date + r.inspection_time)::timestamp BETWEEN w.window_start AND w.window_end THEN 0 ELSE 1 END,
                ABS(EXTRACT(EPOCH FROM ((r.inspection_date + r.inspection_time)::timestamp - w.window_start))) ASC
        ) AS rank_match
    FROM public.insp_records r
    JOIN tape_time_windows w 
      ON (r.rov_job_id IS NOT NULL AND r.rov_job_id = w.rov_job_id)
      OR (r.dive_job_id IS NOT NULL AND r.dive_job_id = w.dive_job_id)
    WHERE (r.tape_id IS NULL OR r.tape_id = 0 OR r.inspection_data->>'chapter_no' IS NULL)
)

-- ------------------------------------------------------------------------------
-- STEP 3: Apply the Matched Tape ID, Tape No, and Chapter No to insp_records
-- ------------------------------------------------------------------------------
UPDATE public.insp_records r
SET 
    tape_id = m.tape_id,
    inspection_data = jsonb_set(
        jsonb_set(
            r.inspection_data,
            '{tape_no}',
            to_jsonb(m.tape_no)
        ),
        '{chapter_no}',
        to_jsonb(m.chapter_no)
    )
FROM matched_inspections m
WHERE r.insp_id = m.insp_id
  AND m.rank_match = 1;

-- ------------------------------------------------------------------------------
-- STEP 4: Link insp_video_logs to the newly assigned tape_id
-- ------------------------------------------------------------------------------
UPDATE public.insp_video_logs l
SET tape_id = r.tape_id
FROM public.insp_records r
WHERE l.inspection_id = r.insp_id
  AND r.tape_id IS NOT NULL
  AND (l.tape_id IS NULL OR l.tape_id = 0);

COMMIT;

-- ------------------------------------------------------------------------------
-- VERIFICATION REPORT: View matched records with inspection time vs tape window
-- ------------------------------------------------------------------------------
WITH tape_time_windows AS (
    SELECT 
        t.tape_id,
        t.tape_no,
        COALESCE(NULLIF(TRIM(t.chapter_no), ''), '1') AS chapter_no,
        MIN(l.event_time) AS tape_start,
        MAX(l.event_time) AS tape_end
    FROM public.insp_video_tapes t
    LEFT JOIN public.insp_video_logs l ON t.tape_id = l.tape_id
    GROUP BY t.tape_id, t.tape_no, t.chapter_no
)
SELECT 
    a.insp_id,
    a.rov_job_id,
    c.deployment_no,
    (a.inspection_date + a.inspection_time) AS insp_datetime,
    t.tape_id,
    t.tape_no,
    t.chapter_no,
    w.tape_start,
    w.tape_end,
    b.q_id,
    a.inspection_type_code
FROM public.insp_records a
JOIN public.structure_components b ON a.component_id = b.id
LEFT JOIN public.insp_rov_jobs c ON a.rov_job_id = c.rov_job_id
LEFT JOIN public.insp_video_tapes t ON a.tape_id = t.tape_id
LEFT JOIN tape_time_windows w ON a.tape_id = w.tape_id
WHERE a.structure_id = 225 
  AND a.jobpack_id = 622
ORDER BY a.rov_job_id, (a.inspection_date + a.inspection_time) ASC;
