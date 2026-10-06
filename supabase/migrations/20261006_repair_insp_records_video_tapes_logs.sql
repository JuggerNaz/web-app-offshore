-- ==============================================================================
-- Backend Data Repair Script for:
--   1. insp_records     (insp_id, tape_id, dive_job_id, rov_job_id, inspection_data, company_id, ...)
--   2. insp_video_tapes (tape_id, tape_no, chapter_no, dive_job_id, rov_job_id, company_id, ...)
--   3. insp_video_logs  (video_log_id, tape_id, inspection_id, company_id, ...)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- STEP 1: Create missing parent tapes in insp_video_tapes from insp_records JSON
--         Extracts tape_no and chapter_no from insp_records.inspection_data
-- ------------------------------------------------------------------------------
INSERT INTO public.insp_video_tapes (
    tape_no,
    chapter_no,
    dive_job_id,
    rov_job_id,
    tape_type,
    status,
    workunit,
    company_id,
    cr_user,
    cr_date
)
SELECT DISTINCT
    TRIM(r.inspection_data->>'tape_no') AS tape_no,
    COALESCE(
        NULLIF(TRIM(r.inspection_data->>'chapter_no'), ''),
        NULLIF(TRIM(r.inspection_data->>'chapter'), ''),
        '1'
    ) AS chapter_no,
    r.dive_job_id,
    r.rov_job_id,
    'DIGITAL - PRIMARY' AS tape_type,
    'ACTIVE' AS status,
    '000' AS workunit,
    r.company_id,
    COALESCE(r.cr_user, 'system') AS cr_user,
    NOW() AS cr_date
FROM public.insp_records r
WHERE r.inspection_data->>'tape_no' IS NOT NULL 
  AND TRIM(r.inspection_data->>'tape_no') <> ''
  AND NOT EXISTS (
      SELECT 1 
      FROM public.insp_video_tapes t 
      WHERE TRIM(UPPER(t.tape_no)) = TRIM(UPPER(r.inspection_data->>'tape_no'))
        AND COALESCE(TRIM(t.chapter_no), '1') = COALESCE(NULLIF(TRIM(r.inspection_data->>'chapter_no'), ''), NULLIF(TRIM(r.inspection_data->>'chapter'), ''), '1')
  );

-- Ensure a base tape entry exists for any tape_no missing from insp_video_tapes
INSERT INTO public.insp_video_tapes (
    tape_no,
    chapter_no,
    dive_job_id,
    rov_job_id,
    tape_type,
    status,
    workunit,
    company_id,
    cr_user,
    cr_date
)
SELECT DISTINCT
    TRIM(r.inspection_data->>'tape_no') AS tape_no,
    '1' AS chapter_no,
    r.dive_job_id,
    r.rov_job_id,
    'DIGITAL - PRIMARY' AS tape_type,
    'ACTIVE' AS status,
    '000' AS workunit,
    r.company_id,
    COALESCE(r.cr_user, 'system') AS cr_user,
    NOW() AS cr_date
FROM public.insp_records r
WHERE r.inspection_data->>'tape_no' IS NOT NULL 
  AND TRIM(r.inspection_data->>'tape_no') <> ''
  AND NOT EXISTS (
      SELECT 1 
      FROM public.insp_video_tapes t 
      WHERE TRIM(UPPER(t.tape_no)) = TRIM(UPPER(r.inspection_data->>'tape_no'))
  );

-- ------------------------------------------------------------------------------
-- STEP 2: Backfill missing tape_id in insp_records
-- ------------------------------------------------------------------------------
-- 2A. By matching inspection_data->>'tape_no' AND chapter_no
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
WHERE (r.tape_id IS NULL OR r.tape_id = 0)
  AND r.inspection_data->>'tape_no' IS NOT NULL
  AND TRIM(UPPER(r.inspection_data->>'tape_no')) = t.clean_tape_no
  AND COALESCE(NULLIF(TRIM(r.inspection_data->>'chapter_no'), ''), NULLIF(TRIM(r.inspection_data->>'chapter'), ''), '1') = t.clean_chapter_no;

-- 2B. By matching inspection_data->>'tape_no' only (fallback)
UPDATE public.insp_records r
SET tape_id = t.tape_id
FROM (
    SELECT DISTINCT ON (TRIM(UPPER(tape_no)))
        tape_id,
        TRIM(UPPER(tape_no)) AS clean_tape_no
    FROM public.insp_video_tapes
    ORDER BY TRIM(UPPER(tape_no)), tape_id ASC
) t
WHERE (r.tape_id IS NULL OR r.tape_id = 0)
  AND r.inspection_data->>'tape_no' IS NOT NULL
  AND TRIM(UPPER(r.inspection_data->>'tape_no')) = t.clean_tape_no;

-- 2C. By matching dive_job_id or rov_job_id if tape_no was empty in inspection_data
UPDATE public.insp_records r
SET tape_id = t.tape_id
FROM (
    SELECT DISTINCT ON (dive_job_id)
        tape_id,
        dive_job_id
    FROM public.insp_video_tapes
    WHERE dive_job_id IS NOT NULL
    ORDER BY dive_job_id, tape_id ASC
) t
WHERE (r.tape_id IS NULL OR r.tape_id = 0)
  AND r.dive_job_id IS NOT NULL
  AND r.dive_job_id = t.dive_job_id;

UPDATE public.insp_records r
SET tape_id = t.tape_id
FROM (
    SELECT DISTINCT ON (rov_job_id)
        tape_id,
        rov_job_id
    FROM public.insp_video_tapes
    WHERE rov_job_id IS NOT NULL
    ORDER BY rov_job_id, tape_id ASC
) t
WHERE (r.tape_id IS NULL OR r.tape_id = 0)
  AND r.rov_job_id IS NOT NULL
  AND r.rov_job_id = t.rov_job_id;

-- ------------------------------------------------------------------------------
-- STEP 3: Synchronize tape_no and chapter_no inside insp_records.inspection_data
--         from the linked insp_video_tapes record
-- ------------------------------------------------------------------------------
UPDATE public.insp_records r
SET inspection_data = jsonb_set(
    jsonb_set(
        r.inspection_data,
        '{tape_no}',
        to_jsonb(t.tape_no)
    ),
    '{chapter_no}',
    to_jsonb(COALESCE(t.chapter_no, '1'))
)
FROM public.insp_video_tapes t
WHERE r.tape_id = t.tape_id
  AND (
      r.inspection_data->>'tape_no' IS NULL 
      OR TRIM(r.inspection_data->>'tape_no') = ''
      OR r.inspection_data->>'chapter_no' IS NULL
  );

-- ------------------------------------------------------------------------------
-- STEP 4: Repair & Backfill tape_id in insp_video_logs
-- ------------------------------------------------------------------------------
-- 4A. For logs linked to an inspection_id, sync tape_id from insp_records
UPDATE public.insp_video_logs l
SET tape_id = r.tape_id
FROM public.insp_records r
WHERE l.inspection_id = r.insp_id
  AND r.tape_id IS NOT NULL
  AND (
      l.tape_id IS NULL 
      OR l.tape_id = 0 
      OR NOT EXISTS (SELECT 1 FROM public.insp_video_tapes t WHERE t.tape_id = l.tape_id)
  );

-- 4B. For orphaned logs, link to the first valid tape for that company
UPDATE public.insp_video_logs l
SET tape_id = t.tape_id
FROM (
    SELECT DISTINCT ON (company_id)
        tape_id,
        company_id
    FROM public.insp_video_tapes
    ORDER BY company_id, tape_id ASC
) t
WHERE NOT EXISTS (SELECT 1 FROM public.insp_video_tapes vt WHERE vt.tape_id = l.tape_id)
  AND l.company_id IS NOT NULL
  AND l.company_id = t.company_id;

-- 4C. Default tape safety net: ensure all remaining logs have a valid parent
DO $$
DECLARE
    fallback_tape_id int8;
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.insp_video_logs l
        WHERE l.tape_id IS NULL 
           OR NOT EXISTS (SELECT 1 FROM public.insp_video_tapes t WHERE t.tape_id = l.tape_id)
    ) THEN
        SELECT tape_id INTO fallback_tape_id 
        FROM public.insp_video_tapes 
        WHERE tape_no = 'DEFAULT-TAPE-001' 
        LIMIT 1;

        IF fallback_tape_id IS NULL THEN
            INSERT INTO public.insp_video_tapes (
                tape_no,
                chapter_no,
                tape_type,
                status,
                remarks,
                cr_user,
                cr_date
            ) VALUES (
                'DEFAULT-TAPE-001',
                '1',
                'DIGITAL - PRIMARY',
                'ACTIVE',
                'Auto-created default tape for legacy log events',
                'system',
                NOW()
            ) RETURNING tape_id INTO fallback_tape_id;
        END IF;

        UPDATE public.insp_video_logs
        SET tape_id = fallback_tape_id
        WHERE tape_id IS NULL 
           OR NOT EXISTS (SELECT 1 FROM public.insp_video_tapes t WHERE t.tape_id = insp_video_logs.tape_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 5: Synchronize company_id across all tables
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- VERIFICATION REPORT
-- ------------------------------------------------------------------------------
SELECT 
    'Orphaned insp_video_logs (missing parent tape)' AS check_name,
    COUNT(*) AS issue_count
FROM public.insp_video_logs l
WHERE NOT EXISTS (SELECT 1 FROM public.insp_video_tapes t WHERE t.tape_id = l.tape_id)

UNION ALL

SELECT 
    'insp_records with missing tape_id' AS check_name,
    COUNT(*) AS issue_count
FROM public.insp_records r
WHERE (r.tape_id IS NULL OR r.tape_id = 0)

UNION ALL

SELECT 
    'insp_records with missing tape_no in JSON' AS check_name,
    COUNT(*) AS issue_count
FROM public.insp_records r
WHERE r.inspection_data->>'tape_no' IS NULL OR TRIM(r.inspection_data->>'tape_no') = '';
