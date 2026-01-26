-- Enable RLS logic
ALTER TABLE defect_criteria_procedures ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Allow authenticated users to read procedures" ON defect_criteria_procedures;
DROP POLICY IF EXISTS "Allow authenticated users to insert procedures" ON defect_criteria_procedures;
DROP POLICY IF EXISTS "Allow authenticated users to update procedures" ON defect_criteria_procedures;
DROP POLICY IF EXISTS "Allow authenticated users to delete procedures" ON defect_criteria_procedures;

-- Create permissive policies for authenticated users
CREATE POLICY "Allow authenticated users to read procedures"
ON defect_criteria_procedures FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert procedures"
ON defect_criteria_procedures FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update procedures"
ON defect_criteria_procedures FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete procedures"
ON defect_criteria_procedures FOR DELETE
TO authenticated
USING (true);

-- Also fix schema permissions just in case
GRANT ALL ON defect_criteria_procedures TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE defect_criteria_procedures_id_seq TO authenticated;
