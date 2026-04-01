-- ============================================================================
-- Add field_name column to defect_criteria_rules
-- This tells the validation engine WHICH inspection form field to evaluate
-- ============================================================================
-- 
-- PROBLEM SOLVED:
-- Previously the validation engine guessed which field to evaluate.
-- Now each rule explicitly declares the target field name.
--
-- USAGE:
-- Set field_name to the inspection form field name/label you want to monitor.
-- Examples:
--   'CP RDG (MV)'           -- matches the "CP RDG (MV)" field in inspection form
--   'Measured Thickness'    -- matches the measured thickness field
--   'Marine Growth'         -- matches marine growth field
--   'Debris'                -- matches the debris field
--   '*'                     -- (wildcard) evaluate all numeric fields
--
-- SQL to run in Supabase SQL Editor:
-- ============================================================================

ALTER TABLE defect_criteria_rules
ADD COLUMN IF NOT EXISTS field_name VARCHAR(255);

COMMENT ON COLUMN defect_criteria_rules.field_name IS 
'The inspection form field name/label to evaluate against the threshold. 
Matches the field label/name in inspection_type.default_properties. 
Leave blank or set to * to evaluate any numeric value in the form.';

-- Update the index to make field_name lookups fast
CREATE INDEX IF NOT EXISTS idx_rules_field_name 
ON defect_criteria_rules(field_name);
