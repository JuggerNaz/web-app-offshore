-- Add column for text-based threshold values
ALTER TABLE defect_criteria_rules 
ADD COLUMN IF NOT EXISTS threshold_text TEXT;

-- Comment to explain usage
COMMENT ON COLUMN defect_criteria_rules.threshold_text IS 'Stores string/text value for comparison when rule is not numeric';
