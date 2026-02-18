# FIXING DIVING INSPECTION ERRORS - Quick Guide

## Problem
The diving inspection page shows errors because the required database tables don't exist yet.

## Solution

### **Step 1: Create Database Tables**

You need to run the SQL migration to create the diving inspection tables.

**Option A: Via Supabase Dashboard** (Recommended)

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Open this file: `supabase/migrations/20260212_diving_inspection_schema.sql`
5. **Copy ALL the contents** (Ctrl+A, Ctrl+C)
6. **Paste** into the SQL Editor
7. Click **Run** (or press Ctrl+Enter)
8. Wait for "Success" message ✅

**What this creates:**
- `insp_dive_jobs` table (dive deployments)
- `insp_dive_data` table (inspection records)
- `insp_dive_movements` table (movement log)
- RLS policies for all tables
- Proper permissions and indexes

---

### **Step 2: Refresh Your Browser**

After running the SQL:

1. **Close** the browser DevTools (if open)
2. **Hard refresh** the page:
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

---

### **Step 3: Test Diving Inspection**

1. Go to `/dashboard/inspection`
2. Select a **Job Pack**
3. Select a **Structure**
4. Select an **SOW Report**
5. Click **Start Inspection** → Select **DIVING**
6. Fill in the dive deployment form:
   - Deployment Number: (auto-generated, e.g., `DIVE-202602-705`)
   - Dive Type: Select from dropdown (Air Dive, Bell Dive, etc.)
   - Primary Diver: Enter name (e.g., `di`)
   - Standby Diver: Enter name (e.g., `rr`)
   - Dive Supervisor: Enter name (e.g., `ss`)
   - Report Coordinator: Enter name (e.g., `rc`)
   - Deployment Date: Select date
   - Dive Start Time: Select time
   - Maximum Depth: Optional (e.g., `50.0`)
   - Planned Duration: Optional (e.g., `45`)
7. Click **"Create Dive Deployment"**

**Expected Result:**
- ✅ Green success toast: "Dive deployment created successfully!"
- ✅ Page switches to "Inspection" tab
- ✅ Live Data, Video Log, and Inspection Form panels appear
- ✅ NO errors in console

---

## Error Messages and Fixes

### ❌ Error: "relation 'insp_dive_jobs' does not exist"
**Fix:** Run the migration SQL (`20260212_diving_inspection_schema.sql`)

### ❌ Error: "new row violates row-level security policy"
**Fix:** The migration SQL includes RLS policies. Make sure you ran the ENTIRE script.

### ❌ Error: "permission denied for table insp_dive_jobs"
**Fix:** The migration SQL includes GRANT statements. Make sure you ran the ENTIRE script.

### ❌ Error: "null value in column 'diver_name' violates not-null constraint"
**Fix:** Fill in all required fields marked with `*` before submitting

---

## Verification

After running the SQL, you can verify the tables were created:

```sql
-- Run this in Supabase SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'insp_dive%'
ORDER BY table_name;
```

**Expected Output:**
- `insp_dive_data`
- `insp_dive_jobs`
- `insp_dive_movements`

---

## Also Run (If Not Already Done)

If you're also getting errors on the **ROV inspection** page, make sure you've run:

```
fix_inspection_rls_policies.sql
```

This fixes RLS policies for **both ROV and Diving** inspection modules.

---

## Quick Troubleshooting Checklist

- [ ] I ran `20260212_diving_inspection_schema.sql` in Supabase SQL Editor
- [ ] I saw "Success. No rows returned" (this is normal!)
- [ ] I verified the 3 tables were created (insp_dive_jobs, insp_dive_data, insp_dive_movements)
- [ ] I refreshed the browser (hard refresh: Ctrl+Shift+R)
- [ ] I'm logged in to the application
- [ ] I selected Job Pack, Structure, and SOW before clicking "Start Inspection"
- [ ] The URL contains `?jobpack=X&structure=Y&sow=Z` parameters
- [ ] I filled in all required fields (marked with *)
- [ ] I clicked "Create Dive Deployment" only once

---

## Still Having Issues?

1. Open browser **DevTools** (F12)
2. Go to **Console** tab
3. Look for the exact error message
4. Check **Network** tab to see which API call is failing
5. Share the specific error details

**Most Common Causes:**
1. ❌ SQL migration not run → Tables don't exist
2. ❌ Browser cache → Hard refresh needed
3. ❌ Not logged in → Sign in again
4. ❌ Missing required fields → Fill in all `*` fields

---

**Last Updated:** February 12, 2026  
**Migration File:** `supabase/migrations/20260212_diving_inspection_schema.sql`  
**Purpose:** Create diving inspection database tables
