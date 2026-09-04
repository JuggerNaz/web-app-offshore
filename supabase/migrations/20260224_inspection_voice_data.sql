-- Migration: Add Voice Recognition & AI Extraction Support to Inspection Records
-- Created: 2026-02-24

ALTER TABLE insp_records 
ADD COLUMN IF NOT EXISTS raw_voice_transcript TEXT,
ADD COLUMN IF NOT EXISTS ai_voice_processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_confidence_score NUMERIC(4,2),
ADD COLUMN IF NOT EXISTS voice_audio_url TEXT;

-- Create index for filtering records captured or audited via voice
CREATE INDEX IF NOT EXISTS idx_insp_records_voice_processed ON insp_records(ai_voice_processed_at) 
WHERE ai_voice_processed_at IS NOT NULL;
