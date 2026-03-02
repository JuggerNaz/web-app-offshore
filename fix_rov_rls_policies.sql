-- Fix RLS policies for ROV inspection tables
-- This ensures users can insert and select data

-- Enable RLS if not already enabled
ALTER TABLE insp_rov_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to insert ROV jobs" ON insp_rov_jobs;
DROP POLICY IF EXISTS "Allow authenticated users to select ROV jobs" ON insp_rov_jobs;
DROP POLICY IF EXISTS "Allow authenticated users to update ROV jobs" ON insp_rov_jobs;

-- Create permissive policies for authenticated users
CREATE POLICY "Allow authenticated users to insert ROV jobs"
ON insp_rov_jobs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to select ROV jobs"
ON insp_rov_jobs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to update ROV jobs"
ON insp_rov_jobs FOR UPDATE
TO authenticated
USING (true);

-- Grant necessary permissions
GRANT ALL ON insp_rov_jobs TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
