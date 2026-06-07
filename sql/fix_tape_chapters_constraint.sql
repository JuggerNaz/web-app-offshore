-- Drop the overly strict unique constraint on tape_no
ALTER TABLE public.insp_video_tapes
DROP CONSTRAINT IF EXISTS uk_tape_no;

ALTER TABLE public.insp_video_tapes
DROP CONSTRAINT IF EXISTS insp_video_tapes_tape_no_key;

-- Drop the overly strict unique constraint on (tape_no, chapter_no)
-- This allows users to manually reassign chapter numbers even if they conflict with existing drafts,
-- or to have multiple records for the same logical chapter.
ALTER TABLE public.insp_video_tapes
DROP CONSTRAINT IF EXISTS uk_tape_chapter;

-- Optional: Add a non-unique index to maintain performance for lookups
CREATE INDEX IF NOT EXISTS idx_tape_no_chapter ON public.insp_video_tapes (tape_no, chapter_no);

