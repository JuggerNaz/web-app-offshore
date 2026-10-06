-- ==============================================================================
-- Master Tape Deduplication & Child Record Migration Script (Fixed for chk_tape_job)
-- Consolidates all duplicate (tape_no, chapter_no) records into ONE canonical tape_id
-- Migrates all insp_records and insp_video_logs to the canonical tape_id
-- Deletes redundant tape records and prevents future duplicates
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- STEP 1: Build a Mapping of (Duplicate Tape ID -> Canonical Tape ID)
-- ------------------------------------------------------------------------------
CREATE TEMP TABLE tmp_tape_canonical_map AS
WITH tape_usage_ranked AS (
    SELECT 
        t.tape_id,
        TRIM(UPPER(t.tape_no)) AS clean_tape_no,
        COALESCE(NULLIF(TRIM(t.chapter_no), ''), '1') AS clean_chapter_no,
        t.rov_job_id,
        t.dive_job_id,
        t.remarks,
        (SELECT COUNT(*) FROM public.insp_records r WHERE r.tape_id = t.tape_id) AS insp_count,
        (SELECT COUNT(*) FROM public.insp_video_logs l WHERE l.tape_id = t.tape_id) AS log_count,
        t.cr_date
    FROM public.insp_video_tapes t
),
canonical_selection AS (
    SELECT 
        tape_id,
        clean_tape_no,
        clean_chapter_no,
        FIRST_VALUE(tape_id) OVER (
            PARTITION BY clean_tape_no, clean_chapter_no
            ORDER BY 
                insp_count DESC, 
                log_count DESC, 
                CASE WHEN remarks IS NOT NULL AND remarks <> '' THEN 0 ELSE 1 END,
                CASE WHEN rov_job_id IS NOT NULL OR dive_job_id IS NOT NULL THEN 0 ELSE 1 END,
                tape_id ASC
        ) AS canonical_tape_id
    FROM tape_usage_ranked
)
SELECT 
    tape_id AS duplicate_tape_id,
    canonical_tape_id
FROM canonical_selection
WHERE tape_id <> canonical_tape_id;

-- ------------------------------------------------------------------------------
-- STEP 2: Migrate all insp_records pointing to duplicate tapes -> canonical_tape_id
-- ------------------------------------------------------------------------------
UPDATE public.insp_records r
SET tape_id = m.canonical_tape_id
FROM tmp_tape_canonical_map m
WHERE r.tape_id = m.duplicate_tape_id;

-- ------------------------------------------------------------------------------
-- STEP 3: Migrate all insp_video_logs pointing to duplicate tapes -> canonical_tape_id
-- ------------------------------------------------------------------------------
UPDATE public.insp_video_logs l
SET tape_id = m.canonical_tape_id
FROM tmp_tape_canonical_map m
WHERE l.tape_id = m.duplicate_tape_id;

-- ------------------------------------------------------------------------------
-- STEP 4: Merge metadata safely without violating chk_tape_job constraint
--         (Ensures either dive_job_id OR rov_job_id is set, never both)
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
-- STEP 5: Delete the duplicate tape records from insp_video_tapes
-- ------------------------------------------------------------------------------
DELETE FROM public.insp_video_tapes t
WHERE t.tape_id IN (SELECT duplicate_tape_id FROM tmp_tape_canonical_map);

-- ------------------------------------------------------------------------------
-- STEP 6: Ensure insp_records.inspection_data JSON has clean tape_no & chapter_no
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
WHERE r.tape_id = t.tape_id;

-- ------------------------------------------------------------------------------
-- STEP 7: Add a Unique Index to prevent future duplicate tape/chapter entries
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_insp_video_tapes_no_chapter 
ON public.insp_video_tapes (
    TRIM(UPPER(tape_no)), 
    COALESCE(NULLIF(TRIM(chapter_no), ''), '1')
);

COMMIT;

-- ------------------------------------------------------------------------------
-- VERIFICATION REPORT: Display clean deduplicated tapes for AM26-016-02/BODP-A/V002R
-- ------------------------------------------------------------------------------
SELECT 
    t.tape_id,
    t.tape_no,
    t.chapter_no,
    t.rov_job_id,
    t.dive_job_id,
    t.status,
    t.remarks,
    (SELECT COUNT(*) FROM public.insp_records r WHERE r.tape_id = t.tape_id) AS total_insp_records,
    (SELECT COUNT(*) FROM public.insp_video_logs l WHERE l.tape_id = t.tape_id) AS total_video_logs
FROM public.insp_video_tapes t
WHERE t.tape_no = 'AM26-016-02/BODP-A/V002R'
ORDER BY COALESCE(NULLIF(TRIM(t.chapter_no), ''), '1')::int4 ASC;
