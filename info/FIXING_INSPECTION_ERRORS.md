# FIXING ROV INSPECTION ERRORS - Step by Step Guide

## Problem
You're seeing HTTP 406 "Bad Request" errors when trying to create ROV deployments. This is caused by missing or incorrect Row Level Security (RLS) policies in the database.

## Solution

### Step 1: Run the SQL Fix Script

**Option A: Via Supabase Dashboard** (Recommended)

1. Open your Supabase project dashboard
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Open the file: `fix_inspection_rls_policies.sql` (in your project root)
5. Copy ALL the contents
6. Paste into the SQL Editor
7. Click **Run** (or press Ctrl+Enter)
8. Wait for "Success" message

**Option B: Via psql Command Line**

```bash
# If you have direct database access
psql "your-database-connection-string" -f fix_inspection_rls_policies.sql
```

**Option C: Via Supabase CLI**

```bash
# If you have Supabase CLI installed
supabase db push
```

---

### Step 2: Verify the Fix

After running the SQL, verify policies are created:

```sql
-- Run this query in SQL Editor
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'insp_%'
ORDER BY tablename, policyname;
```

You should see policies like:
- `Allow authenticated users to insert ROV jobs`
- `Allow authenticated users to select ROV jobs`
- `Allow authenticated users to update ROV jobs`
- etc.

---

### Step 3: Refresh Your Browser

1. **Close** the browser DevTools (F12)
2. **Hard refresh** the page:
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`
3. Or **Clear cache** and reload

---

### Step 4: Test ROV Deployment Creation

1. Go to `/dashboard/inspection`
2. Select a **Job Pack**
3. Select a **Structure**
4. Select an **SOW Report**
5. Click **Start Inspection** → **ROV**
6. Fill in the deployment form:
   - Deployment Number: (auto-generated)
   - ROV Serial Number: `rv001`
   - ROV Operator: `JK`
   - ROV Supervisor: `SP`
   - Report Coordinator: `RC`
   - Deployment Date: Select today
   - Start Time: Select current time
7. Click **Create ROV Deployment**

**Expected Result:**
- ✅ Green success toast: "ROV deployment created successfully!"
- ✅ Page switches to "Inspection" tab
- ✅ Live Data and Video Feed panels appear
- ✅ NO red errors in console

---

## What the Fix Does

The SQL script:

1. **Enables RLS** on all inspection tables
2. **Creates policies** that allow authenticated users to:
   - INSERT (create new records)
   - SELECT (read records)
   - UPDATE (modify records)
   - DELETE (remove records)
3. **Grants permissions** on tables and sequences
4. **Applies to tables:**
   - `insp_rov_jobs`
   - `insp_rov_data`
   - `insp_rov_movements`
   - `insp_dive_jobs`
   - `insp_dive_data`

---

## If Still Having Issues

### Check Authentication

```sql
-- Run in SQL Editor to check your user
SELECT auth.uid();
SELECT auth.role();
```

Should return:
- A valid UUID for `auth.uid()`
- `'authenticated'` for `auth.role()`

If it returns `NULL` or `'anon'`, you're not logged in properly.

### Check Table Exists

```sql
-- Verify insp_rov_jobs table exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'insp_rov_jobs';
```

Should return all columns including:
- `rov_job_id`
- `deployment_no`
- `structure_id`
- `jobpack_id`
- etc.

### Check Browser Console

1. Press **F12** to open DevTools
2. Go to **Console** tab
3. Look for specific error messages
4. Share the exact error message if you still have issues

---

## Common Error Messages and Fixes

### Error: "new row violates row-level security policy"
**Fix:** Run the SQL script to create proper RLS policies

### Error: "permission denied for table insp_rov_jobs"
**Fix:** Run the SQL script to grant table permissions

### Error: "relation 'insp_rov_jobs' does not exist"
**Fix:** Run your migration script to create the table first

### Error: "null value in column 'structure_id' violates not-null constraint"
**Fix:** Make sure you're selecting a structure in the landing page

---

## Quick Troubleshooting Checklist

- [ ] I ran the `fix_inspection_rls_policies.sql` script
- [ ] I verified policies were created (Step 2)
- [ ] I refreshed the browser (hard refresh)
- [ ] I'm logged in to the application
- [ ] I selected Job Pack, Structure, and SOW before clicking "Start Inspection"
- [ ] The URL contains `?jobpack=X&structure=Y&sow=Z` parameters
- [ ] I filled in all required form fields (marked with *)
- [ ] I clicked "Create ROV Deployment" only once
- [ ] I checked the browser console for error messages

---

## Still Need Help?

If you're still getting errors after following all steps:

1. Check the **Console** tab in browser DevTools (F12)
2. Look for the **exact error message**
3. Check the **Network** tab to see which API call is failing
4. Share the specific error details

**Most Common Cause:** The SQL script hasn't been run yet!  
**Solution:** Go to Step 1 and run the SQL script in your Supabase dashboard.

---

**Last Updated:** February 12, 2026  
**File:** `fix_inspection_rls_policies.sql`  
**Purpose:** Fix RLS policies for inspection module
