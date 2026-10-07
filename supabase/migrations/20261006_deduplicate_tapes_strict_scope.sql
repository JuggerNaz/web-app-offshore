-- ==============================================================================
-- Master Tape Deduplication & High-Precision insp_records Migration Script
-- (Corrected with jsonb_build_object and || operator to handle any JSON structure safely)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- STEP 1: Build Canonical Mapping with Full Structure & Job Context
-- ------------------------------------------------------------------------------
CREATE TEMP TABLE tmp_tape_canonical_map AS
WITH tape_context AS (
    SELECT 
        t.tape_id,
        TRIM(UPPER(t.tape_no)) AS clean_tape_no,
        COALESCE(NULLIF(TRIM(t.chapter_no), ''), '1') AS clean_chapter_no,
        t.rov_job_id,
        t.dive_job_id,
        COALESCE(j_rov.structure_id, j_dive.structure_id) AS structure_id,
        COALESCE(j_rov.jobpack_id, j_dive.jobpack_id) AS jobpack_id,
        t.remarks,
        (SELECT COUNT(*) FROM public.insp_records r WHERE r.tape_id = t.tape_id) AS insp_count,
        (SELECT COUNT(*) FROM public.insp_video_logs l WHERE l.tape_id = t.tape_id) AS log_count,
        t.cr_date
    FROM public.insp_video_tapes t
    LEFT JOIN public.insp_rov_jobs j_rov ON t.rov_job_id = j_rov.rov_job_id
    LEFT JOIN public.insp_dive_jobs j_dive ON t.dive_job_id = j_dive.dive_job_id
),
canonical_selection AS (
    SELECT 
        tape_id,
        clean_tape_no,
        clean_chapter_no,
        rov_job_id,
        dive_job_id,
        structure_id,
        jobpack_id,
        FIRST_VALUE(tape_id) OVER (
            PARTITION BY clean_tape_no, clean_chapter_no
            ORDER BY 
                insp_count DESC, 
                log_count DESC, 
                CASE WHEN remarks IS NOT NULL AND remarks <> '' THEN 0 ELSE 1 END,
                CASE WHEN rov_job_id IS NOT NULL OR dive_job_id IS NOT NULL THEN 0 ELSE 1 END,
                tape_id ASC
        ) AS canonical_tape_id
    FROM tape_context
)
SELECT 
    tape_id AS duplicate_tape_id,
    canonical_tape_id,
    clean_tape_no,
    clean_chapter_no,
    rov_job_id,
    dive_job_id,
    structure_id,
    jobpack_id
FROM canonical_selection
WHERE tape_id <> canonical_tape_id;

-- ------------------------------------------------------------------------------
-- STEP 2: Migrate insp_records with Strict Verification
-- ------------------------------------------------------------------------------
UPDATE public.insp_records r
SET tape_id = m.canonical_tape_id
FROM tmp_tape_canonical_map m
WHERE r.tape_id = m.duplicate_tape_id
  AND (
      (m.structure_id IS NULL OR r.structure_id = m.structure_id)
      OR (m.jobpack_id IS NULL OR r.jobpack_id = m.jobpack_id)
      OR (m.rov_job_id IS NULL OR r.rov_job_id = m.rov_job_id)
      OR (m.dive_job_id IS NULL OR r.dive_job_id = m.dive_job_id)
  );

UPDATE public.insp_records r
SET tape_id = m.canonical_tape_id
FROM tmp_tape_canonical_map m
WHERE r.tape_id = m.duplicate_tape_id;

-- ------------------------------------------------------------------------------
-- STEP 3: Migrate all insp_video_logs to canonical_tape_id
-- ------------------------------------------------------------------------------
UPDATE public.insp_video_logs l
SET tape_id = m.canonical_tape_id
FROM tmp_tape_canonical_map m
WHERE l.tape_id = m.duplicate_tape_id;

-- ------------------------------------------------------------------------------
-- STEP 4: Merge Metadata Safely (Respecting chk_tape_job Constraint)
-- ------------------------------------------------------------------------------
UPDATE public.insp_video_tapes target
SET 
    remarks = COALESCE(target.remarks, dup.remarks),
    company_id = COALESCE(target.company_id, dup.company_id),
    dive_job_id = CASE 
        WHEN target.dive_job_id IS NOT NULL THEN target.dive_job_id
        WHEN target.rov_job_id IS NOT NULL THEN NULL
        ELSE dup.dive_job_id
    END,
    rov_job_id = CASE 
        WHEN target.rov_job_id IS NOT NULL THEN target.rov_job_id
        WHEN target.dive_job_id IS NOT NULL THEN NULL
        WHEN dup.dive_job_id IS NOT NULL THEN NULL
        ELSE dup.rov_job_id
    END
FROM tmp_tape_canonical_map m
JOIN public.insp_video_tapes dup ON m.duplicate_tape_id = dup.tape_id
WHERE target.tape_id = m.canonical_tape_id;

-- ------------------------------------------------------------------------------
-- STEP 5: Delete Redundant Duplicate Tape Rows
-- ------------------------------------------------------------------------------
DELETE FROM public.insp_video_tapes t
WHERE t.tape_id IN (SELECT duplicate_tape_id FROM tmp_tape_canonical_map);

-- ------------------------------------------------------------------------------
-- STEP 6: Precision Synchronize insp_records JSON using jsonb || operator (Safe & Robust)
-- ------------------------------------------------------------------------------
UPDATE public.insp_records r
SET inspection_data = 
    COALESCE(
        CASE WHEN jsonb_typeof(r.inspection_data) = 'object' THEN r.inspection_data ELSE '{}'::jsonb END, 
        '{}'::jsonb
    ) || jsonb_build_object(
        'tape_no', t.tape_no,
        'chapter_no', COALESCE(NULLIF(TRIM(t.chapter_no), ''), '1')
    )
FROM public.insp_video_tapes t
WHERE r.tape_id = t.tape_id;

-- ------------------------------------------------------------------------------
-- STEP 7: Permanent Protection - Add Unique Index on (tape_no, chapter_no)
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_insp_video_tapes_no_chapter 
ON public.insp_video_tapes (
    TRIM(UPPER(tape_no)), 
    COALESCE(NULLIF(TRIM(chapter_no), ''), '1')
);

COMMIT;

-- ------------------------------------------------------------------------------
-- VERIFICATION REPORT
-- ------------------------------------------------------------------------------
SELECT 
    r.insp_id,
    r.structure_id,
    r.jobpack_id,
    r.sow_report_no,
    r.rov_job_id,
    r.dive_job_id,
    r.tape_id,
    t.tape_no,
    t.chapter_no,
    r.inspection_data->>'tape_no' AS json_tape_no,
    r.inspection_data->>'chapter_no' AS json_chapter_no
FROM public.insp_records r
JOIN public.insp_video_tapes t ON r.tape_id = t.tape_id
WHERE r.sow_report_no = 'AM26-016-01' 
   OR r.structure_id = 225
ORDER BY r.rov_job_id, r.inspection_date, r.inspection_time;
