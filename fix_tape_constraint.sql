-- Fix unique constraint conflict on tape_no
-- This allows multiple chapters to share the same tape_no string

ALTER TABLE public.insp_video_tapes 
DROP CONSTRAINT IF EXISTS insp_video_tapes_tape_no_key;

ALTER TABLE public.insp_video_tapes 
DROP CONSTRAINT IF EXISTS unique_tape_no;

-- Ensure an index still exists for performance (Optional, but good practice)
CREATE INDEX IF NOT EXISTS idx_insp_video_tapes_tape_no ON public.insp_video_tapes(tape_no);

-- End of File
