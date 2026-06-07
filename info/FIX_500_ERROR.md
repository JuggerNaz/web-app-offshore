# Fix "500 Internal Server Error"

It appears the error is due to **database permissions**. Even though you are logged in, the database is blocking the "Update" operation because the permissions (RLS policies) weren't fully applied.

## Solution

Please run the permission fix script in Supabase:

1.  **Open Supabase SQL Editor**
2.  **Run this file content:**
    `supabase/migrations/20260125_fix_rls_policies.sql`

    (Copy the content from the file I created, or copy the SQL below)

```sql
-- Enable RLS logic
ALTER TABLE defect_criteria_procedures ENABLE ROW LEVEL SECURITY;

-- Reset policies
DROP POLICY IF EXISTS "Allow authenticated users to read procedures" ON defect_criteria_procedures;
DROP POLICY IF EXISTS "Allow authenticated users to insert procedures" ON defect_criteria_procedures;
DROP POLICY IF EXISTS "Allow authenticated users to update procedures" ON defect_criteria_procedures;
DROP POLICY IF EXISTS "Allow authenticated users to delete procedures" ON defect_criteria_procedures;

-- Re-create permissive policies
CREATE POLICY "Allow authenticated users to read procedures" ON defect_criteria_procedures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert procedures" ON defect_criteria_procedures FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update procedures" ON defect_criteria_procedures FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete procedures" ON defect_criteria_procedures FOR DELETE TO authenticated USING (true);

-- Fix table permissions
GRANT ALL ON defect_criteria_procedures TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE defect_criteria_procedures_id_seq TO authenticated;
```

3.  **Refresh and Try Again**
    After running the SQL, refresh your app and try updating. It should work instantly.
