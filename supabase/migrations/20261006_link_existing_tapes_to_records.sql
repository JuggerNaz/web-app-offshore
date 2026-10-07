-- ==============================================================================
-- Link Existing Registered Tapes to insp_records & insp_video_logs
-- Purely looks up the existing tape registered in insp_video_tapes for each dive/ROV job
-- (No dummy/new tape creation)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- STEP 1: Link insp_records.tape_id using the existing tape registered in
--         insp_video_tapes for that specific rov_job_id (or dive_job_id)
-- ------------------------------------------------------------------------------
-- 1A. If inspection record has a chapter in JSON, match by rov_job_id AND chapter_no
UPDATE public.insp_records r
SET tape_id = t.tape_id
FROM (
    SELECT DISTINCT ON (rov_job_id, COALESCE(TRIM(chapter_no), '1'))
        tape_id,
        rov_job_id,
        tape_no,
        COALESCE(TRIM(chapter_no), '1') AS chapter_no
    FROM public.insp_video_tapes
    WHERE rov_job_id IS NOT NULL
    ORDER BY rov_job_id, COALESCE(TRIM(chapter_no), '1'), tape_id ASC
) t
WHERE (r.tape_id IS NULL OR r.tape_id = 0)
  AND r.rov_job_id = t.rov_job_id
  AND COALESCE(NULLIF(TRIM(r.inspection_data->>'chapter_no'), ''), NULLIF(TRIM(r.inspection_data->>'chapter'), ''), '1') = t.chapter_no;

-- 1B. Fallback: match by rov_job_id to the registered tape for that deployment
UPDATE public.insp_records r
SET tape_id = t.tape_id
FROM (
    SELECT DISTINCT ON (rov_job_id)
        tape_id,
        rov_job_id,
        tape_no,
        COALESCE(TRIM(chapter_no), '1') AS chapter_no
    FROM public.insp_video_tapes
    WHERE rov_job_id IS NOT NULL
    ORDER BY rov_job_id, tape_id ASC
) t
WHERE (r.tape_id IS NULL OR r.tape_id = 0)
  AND r.rov_job_id = t.rov_job_id;

-- 1C. Same for DIVING jobs (dive_job_id)
UPDATE public.insp_records r
SET tape_id = t.tape_id
FROM (
    SELECT DISTINCT ON (dive_job_id, COALESCE(TRIM(chapter_no), '1'))
        tape_id,
        dive_job_id,
        tape_no,
        COALESCE(TRIM(chapter_no), '1') AS chapter_no
    FROM public.insp_video_tapes
    WHERE dive_job_id IS NOT NULL
    ORDER BY dive_job_id, COALESCE(TRIM(chapter_no), '1'), tape_id ASC
) t
WHERE (r.tape_id IS NULL OR r.tape_id = 0)
  AND r.dive_job_id = t.dive_job_id
  AND COALESCE(NULLIF(TRIM(r.inspection_data->>'chapter_no'), ''), NULLIF(TRIM(r.inspection_data->>'chapter'), ''), '1') = t.chapter_no;

UPDATE public.insp_records r
SET tape_id = t.tape_id
FROM (
    SELECT DISTINCT ON (dive_job_id)
        tape_id,
        dive_job_id,
        tape_no,
        COALESCE(TRIM(chapter_no), '1') AS chapter_no
    FROM public.insp_video_tapes
    WHERE dive_job_id IS NOT NULL
    ORDER BY dive_job_id, tape_id ASC
) t
WHERE (r.tape_id IS NULL OR r.tape_id = 0)
  AND r.dive_job_id = t.dive_job_id;

-- ------------------------------------------------------------------------------
-- STEP 2: Synchronize the actual registered tape_no & chapter_no
--         into insp_records.inspection_data JSON
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
      OR r.inspection_data->>'tape_no' <> t.tape_no
      OR r.inspection_data->>'chapter_no' IS NULL
  );

-- ------------------------------------------------------------------------------
-- STEP 3: Link insp_video_logs to the resolved tape_id
-- ------------------------------------------------------------------------------
UPDATE public.insp_video_logs l
SET tape_id = r.tape_id
FROM public.insp_records r
WHERE l.inspection_id = r.insp_id
  AND r.tape_id IS NOT NULL
  AND (l.tape_id IS NULL OR l.tape_id = 0);

COMMIT;

-- ------------------------------------------------------------------------------
-- VERIFICATION QUERY: View the linked inspection records with their actual tape numbers
-- ------------------------------------------------------------------------------
SELECT 
    a.insp_id,
    a.rov_job_id,
    c.deployment_no,
    t.tape_id,
    t.tape_no AS actual_registered_tape_no,
    t.chapter_no AS actual_chapter_no,
    a.inspection_data->>'tape_no' AS json_tape_no,
    a.inspection_type_code,
    b.q_id
FROM public.insp_records a
JOIN public.structure_components b ON a.component_id = b.id
LEFT JOIN public.insp_rov_jobs c ON a.rov_job_id = c.rov_job_id
LEFT JOIN public.insp_video_tapes t ON a.tape_id = t.tape_id
WHERE a.structure_id = 225 
  AND a.jobpack_id = 622
ORDER BY a.rov_job_id, a.insp_id;
