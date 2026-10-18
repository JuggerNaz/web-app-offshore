-- Migration: Add 'LIKE' operator support to defect_criteria_rules
-- Updates the check constraint on threshold_operator to include 'LIKE'

ALTER TABLE defect_criteria_rules DROP CONSTRAINT IF EXISTS defect_criteria_rules_threshold_operator_check;

ALTER TABLE defect_criteria_rules ADD CONSTRAINT defect_criteria_rules_threshold_operator_check 
  CHECK (threshold_operator IN ('>', '<', '>=', '<=', '==', '!=', 'LIKE'));

COMMENT ON COLUMN defect_criteria_rules.threshold_operator IS 'Comparison operator: >, <, >=, <=, ==, !=, LIKE';
