-- ============================================================================
-- ADD TAPE FIELDS (Chapter No, Remarks)
-- ============================================================================

-- Add new columns to insp_video_tapes if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'insp_video_tapes' AND column_name = 'chapter_no') THEN
        ALTER TABLE insp_video_tapes ADD COLUMN chapter_no VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'insp_video_tapes' AND column_name = 'remarks') THEN
        ALTER TABLE insp_video_tapes ADD COLUMN remarks TEXT;
    END IF;
END $$;

-- Update comments
COMMENT ON COLUMN insp_video_tapes.chapter_no IS 'Optional chapter number/identifier for the tape';
COMMENT ON COLUMN insp_video_tapes.remarks IS 'General remarks or notes for the tape';
