-- Drop the overly strict unique constraint on tape_no
ALTER TABLE public.insp_video_tapes
DROP CONSTRAINT IF EXISTS uk_tape_no;

ALTER TABLE public.insp_video_tapes
DROP CONSTRAINT IF EXISTS insp_video_tapes_tape_no_key;

-- Add a new composite constraint so that a specific Chapter on a specific Tape is unique
ALTER TABLE public.insp_video_tapes
ADD CONSTRAINT uk_tape_chapter UNIQUE (tape_no, chapter_no);
