-- ==============================================================================
-- Backend Data Repair Script for insp_video_tapes & insp_video_logs
-- Based on exact table schemas:
--   1. insp_video_tapes (tape_id, tape_no, dive_job_id, rov_job_id, chapter_no, company_id, ...)
--   2. insp_video_logs  (video_log_id, tape_id, event_type, event_time, inspection_id, company_id, ...)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- STEP 1: Insert missing parent records into insp_video_tapes
--         Pulls any tape_no and chapter_no referenced in insp_records that
--         does not yet exist in insp_video_tapes.
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
    TRIM(r.tape_no) AS tape_no,
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
WHERE r.tape_no IS NOT NULL 
  AND TRIM(r.tape_no) <> ''
  AND NOT EXISTS (
      SELECT 1 
      FROM public.insp_video_tapes t 
      WHERE TRIM(UPPER(t.tape_no)) = TRIM(UPPER(r.tape_no))
        AND COALESCE(TRIM(t.chapter_no), '1') = COALESCE(NULLIF(TRIM(r.inspection_data->>'chapter_no'), ''), NULLIF(TRIM(r.inspection_data->>'chapter'), ''), '1')
  );

-- Also ensure a base entry exists for any tape_no missing entirely from insp_video_tapes
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
    TRIM(r.tape_no) AS tape_no,
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
WHERE r.tape_no IS NOT NULL 
  AND TRIM(r.tape_no) <> ''
  AND NOT EXISTS (
      SELECT 1 
      FROM public.insp_video_tapes t 
      WHERE TRIM(UPPER(t.tape_no)) = TRIM(UPPER(r.tape_no))
  );

-- ------------------------------------------------------------------------------
-- STEP 2: Backfill missing tape_id in insp_records
-- ------------------------------------------------------------------------------
-- 2A. Match on exact tape_no AND chapter_no
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
  AND r.tape_no IS NOT NULL
  AND TRIM(UPPER(r.tape_no)) = t.clean_tape_no
  AND COALESCE(NULLIF(TRIM(r.inspection_data->>'chapter_no'), ''), NULLIF(TRIM(r.inspection_data->>'chapter'), ''), '1') = t.clean_chapter_no;

-- 2B. Match on tape_no only (fallback)
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
  AND r.tape_no IS NOT NULL
  AND TRIM(UPPER(r.tape_no)) = t.clean_tape_no;

-- ------------------------------------------------------------------------------
-- STEP 3: Repair & Backfill tape_id in insp_video_logs
-- ------------------------------------------------------------------------------
-- 3A. For logs linked to an inspection_id, copy the tape_id from insp_records
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

-- 3B. For any orphaned logs with an invalid tape_id (no parent in insp_video_tapes),
--     link them to the nearest valid tape belonging to the same company
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

-- 3C. Global fallback for any remaining orphaned logs without a valid parent tape:
--     Create a default "LEGACY_LOGS" parent tape record if needed
DO $$
DECLARE
    fallback_tape_id int8;
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.insp_video_logs l
        WHERE l.tape_id IS NULL 
           OR NOT EXISTS (SELECT 1 FROM public.insp_video_tapes t WHERE t.tape_id = l.tape_id)
    ) THEN
        -- Check or create fallback tape
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
                'Auto-created default tape for orphaned historical log events',
                'system',
                NOW()
            ) RETURNING tape_id INTO fallback_tape_id;
        END IF;

        -- Update remaining orphaned logs
        UPDATE public.insp_video_logs
        SET tape_id = fallback_tape_id
        WHERE tape_id IS NULL 
           OR NOT EXISTS (SELECT 1 FROM public.insp_video_tapes t WHERE t.tape_id = insp_video_logs.tape_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 4: Synchronize company_id across both tables
-- ------------------------------------------------------------------------------
-- 4A. Backfill company_id in insp_video_tapes from dive/rov jobs
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

-- 4B. Backfill company_id in insp_video_logs from parent insp_video_tapes
UPDATE public.insp_video_logs l
SET company_id = t.company_id
FROM public.insp_video_tapes t
WHERE l.company_id IS NULL
  AND l.tape_id = t.tape_id
  AND t.company_id IS NOT NULL;

COMMIT;

-- ------------------------------------------------------------------------------
-- VERIFICATION REPORT: Check for any remaining orphans or missing links
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
  AND r.tape_no IS NOT NULL AND TRIM(r.tape_no) <> ''

UNION ALL

SELECT 
    'insp_video_logs with missing company_id' AS check_name,
    COUNT(*) AS issue_count
FROM public.insp_video_logs
WHERE company_id IS NULL;
