# Fix Library Dropdowns (Empty Lists)

The dropdowns are empty because the database is hiding the Library tables (`u_lib_list`, `u_lib_combo`) from your user account. This is another permissions (RLS) issue.

## Solution

1.  **Open Supabase SQL Editor**.
2.  **Run the following SQL:**

```sql
-- Fix permissions for Library tables
ALTER TABLE u_lib_list DISABLE ROW LEVEL SECURITY;
ALTER TABLE u_lib_combo DISABLE ROW LEVEL SECURITY;

GRANT SELECT ON u_lib_list TO authenticated;
GRANT SELECT ON u_lib_combo TO authenticated;
```

3.  **Refresh your browser**.
4.  Open the "Add Criteria Rule" dialog again. The lists should now appear.
