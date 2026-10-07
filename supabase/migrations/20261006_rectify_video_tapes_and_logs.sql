-- ==============================================================================
-- Backend Rectification Script: Synchronize & Repair insp_video_tapes and insp_video_logs
-- Run this in Supabase SQL Editor to backfill missing tapes, chapters, and tape_ids
-- ==============================================================================

BEGIN;

-- 1. Ensure all distinct tape numbers from insp_records exist in insp_video_tapes
--    Populates missing tapes with their corresponding dive_job_id, rov_job_id, chapter_no, and company_id
INSERT INTO public.insp_video_tapes (
    tape_no,
    chapter_no,
    dive_job_id,
    rov_job_id,
    tape_type,
    status,
    company_id,
    cr_date,
    cr_user
)
SELECT DISTINCT
    r.tape_no,
    COALESCE(
        NULLIF(r.inspection_data->>'chapter_no', ''),
        NULLIF(r.inspection_data->>'chapter', ''),
        '1'
    ) AS chapter_no,
    r.dive_job_id,
    r.rov_job_id,
    'DIGITAL - PRIMARY' AS tape_type,
    'ACTIVE' AS status,
    r.company_id,
    NOW() AS cr_date,
    COALESCE(r.cr_user, 'system') AS cr_user
FROM public.insp_records r
WHERE r.tape_no IS NOT NULL 
  AND TRIM(r.tape_no) <> ''
  AND NOT EXISTS (
      SELECT 1 
      FROM public.insp_video_tapes t 
      WHERE TRIM(UPPER(t.tape_no)) = TRIM(UPPER(r.tape_no))
        AND COALESCE(TRIM(t.chapter_no), '1') = COALESCE(NULLIF(r.inspection_data->>'chapter_no', ''), NULLIF(r.inspection_data->>'chapter', ''), '1')
  );

-- 2. If tape exists with no chapter or different chapter, ensure at least the base tape_no exists
INSERT INTO public.insp_video_tapes (
    tape_no,
    chapter_no,
    dive_job_id,
    rov_job_id,
    tape_type,
    status,
    company_id,
    cr_date,
    cr_user
)
SELECT DISTINCT
    r.tape_no,
    '1' AS chapter_no,
    r.dive_job_id,
    r.rov_job_id,
    'DIGITAL - PRIMARY' AS tape_type,
    'ACTIVE' AS status,
    r.company_id,
    NOW() AS cr_date,
    COALESCE(r.cr_user, 'system') AS cr_user
FROM public.insp_records r
WHERE r.tape_no IS NOT NULL 
  AND TRIM(r.tape_no) <> ''
  AND NOT EXISTS (
      SELECT 1 
      FROM public.insp_video_tapes t 
      WHERE TRIM(UPPER(t.tape_no)) = TRIM(UPPER(r.tape_no))
  );

-- 3. Backfill missing tape_id in insp_records by matching tape_no and chapter_no
UPDATE public.insp_records r
SET tape_id = t.tape_id
FROM (
    SELECT DISTINCT ON (TRIM(UPPER(tape_no)), COALESCE(TRIM(chapter_no), '1'))
        tape_id,
        TRIM(UPPER(tape_no)) AS clean_tape_no,
        COALESCE(TRIM(chapter_no), '1') AS clean_chapter_no
    FROM public.insp_video_tapes
    ORDER BY TRIM(UPPER(tape_no)), COALESCE(TRIM(chapter_no), '1'), tape_id ASC
) t
WHERE r.tape_id IS NULL
  AND r.tape_no IS NOT NULL
  AND TRIM(UPPER(r.tape_no)) = t.clean_tape_no
  AND COALESCE(NULLIF(r.inspection_data->>'chapter_no', ''), NULLIF(r.inspection_data->>'chapter', ''), '1') = t.clean_chapter_no;

-- Fallback for any remaining insp_records where chapter didn't match exactly
UPDATE public.insp_records r
SET tape_id = t.tape_id
FROM (
    SELECT DISTINCT ON (TRIM(UPPER(tape_no)))
        tape_id,
        TRIM(UPPER(tape_no)) AS clean_tape_no
    FROM public.insp_video_tapes
    ORDER BY TRIM(UPPER(tape_no)), tape_id ASC
) t
WHERE r.tape_id IS NULL
  AND r.tape_no IS NOT NULL
  AND TRIM(UPPER(r.tape_no)) = t.clean_tape_no;

-- 4. Backfill missing tape_id in insp_video_logs from linked insp_records
UPDATE public.insp_video_logs l
SET tape_id = r.tape_id
FROM public.insp_records r
WHERE (l.tape_id IS NULL OR l.tape_id = 0)
  AND l.inspection_id = r.insp_id
  AND r.tape_id IS NOT NULL;

-- 5. Backfill company_id in insp_video_tapes and insp_video_logs if missing
UPDATE public.insp_video_tapes t
SET company_id = d.company_id
FROM public.insp_dive_jobs d
WHERE t.company_id IS NULL
  AND t.dive_job_id = d.dive_job_id
  AND d.company_id IS NOT NULL;

UPDATE public.insp_video_tapes t
SET company_id = r.company_id
FROM public.insp_rov_jobs r
WHERE t.company_id IS NULL
  AND t.rov_job_id = r.rov_job_id
  AND r.company_id IS NOT NULL;

UPDATE public.insp_video_logs l
SET company_id = t.company_id
FROM public.insp_video_tapes t
WHERE l.company_id IS NULL
  AND l.tape_id = t.tape_id
  AND t.company_id IS NOT NULL;

COMMIT;
