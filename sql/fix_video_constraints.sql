-- Drop existing constraint
ALTER TABLE insp_video_logs DROP CONSTRAINT IF EXISTS chk_video_event_type;

-- Update with ALL used event types
ALTER TABLE insp_video_logs ADD CONSTRAINT chk_video_event_type CHECK (event_type IN (
    'NEW_LOG_START', 
    'INTRODUCTION', 
    'PRE_INSPECTION', 
    'POST_INSPECTION', 
    'INSPECTION', 
    'ANOMALY',
    'START_TASK', 
    'STOP_TASK', 
    'PAUSE_TASK', 
    'RESUME_TASK', 
    'PAUSE', 
    'RESUME', 
    'END', 
    'NOTE', 
    'CUSTOM', 
    'SNAPSHOT'
));
