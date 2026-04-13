-- 1. Add archived_specs column to insp_records
ALTER TABLE insp_records 
ADD COLUMN IF NOT EXISTS archived_data JSONB DEFAULT '{}'::jsonb;

-- Comment on column
COMMENT ON COLUMN insp_records.archived_data IS 'Stores inspection specification fields that have been orphaned during a Component / Task Type re-classification to prevent data loss.';
