-- Add Rectification columns and sequence tracking
ALTER TABLE insp_anomalies
ADD COLUMN IF NOT EXISTS is_rectified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rectified_remarks TEXT,
ADD COLUMN IF NOT EXISTS rectified_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS rectified_by VARCHAR(100),
ADD COLUMN IF NOT EXISTS sequence_no INTEGER;

-- Ensure we can track amendments (optional, but good for the 'A' postfix)
-- We can use md_date != cr_date to detect amendments, or a specific version column.
-- For now, we'll rely on the update logic in the UI or backend.
