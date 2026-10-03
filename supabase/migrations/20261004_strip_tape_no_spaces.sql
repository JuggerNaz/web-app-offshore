-- ==============================================================================
-- Migration: Strip spaces from all existing Tape Numbers (insp_video_tapes)
-- Purpose: Ensures all tape numbers/names have no spaces between characters (e.g. 'AM26-016-01/BEP-A/V001R')
-- ==============================================================================

-- 1. Remove spaces from all existing tape records in insp_video_tapes
UPDATE public.insp_video_tapes
SET tape_no = REPLACE(tape_no, ' ', '')
WHERE tape_no LIKE '% %';

-- 2. Optional safety check for any string-based tape_no values stored inside insp_records inspection_data metadata
UPDATE public.insp_records
SET inspection_data = jsonb_set(
  inspection_data::jsonb,
  '{tape_no}',
  to_jsonb(REPLACE(inspection_data->>'tape_no', ' ', ''))
)
WHERE inspection_data ? 'tape_no'
  AND inspection_data->>'tape_no' LIKE '% %';
