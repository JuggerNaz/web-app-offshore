
-- Enable Realtime for Inspection Module Tables
-- Run this in your Supabase SQL Editor

BEGIN;

-- Add tables to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE insp_records;
ALTER PUBLICATION supabase_realtime ADD TABLE insp_video_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE insp_video_tapes;
ALTER PUBLICATION supabase_realtime ADD TABLE insp_anomalies;

COMMIT;
