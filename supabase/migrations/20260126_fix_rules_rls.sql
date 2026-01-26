-- Enable RLS for defect_criteria_rules
ALTER TABLE defect_criteria_rules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to read rules" ON defect_criteria_rules;
DROP POLICY IF EXISTS "Allow authenticated users to insert rules" ON defect_criteria_rules;
DROP POLICY IF EXISTS "Allow authenticated users to update rules" ON defect_criteria_rules;
DROP POLICY IF EXISTS "Allow authenticated users to delete rules" ON defect_criteria_rules;

-- Create policies
CREATE POLICY "Allow authenticated users to read rules"
ON defect_criteria_rules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert rules"
ON defect_criteria_rules FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update rules"
ON defect_criteria_rules FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete rules"
ON defect_criteria_rules FOR DELETE
TO authenticated
USING (true);

-- Grant permissions
GRANT ALL ON defect_criteria_rules TO authenticated;
GRANT ALL ON defect_criteria_rules TO service_role;
