# Fix Defect Criteria Issues

## Issue 1: Invalid Date Error ✅ FIXED

**Error:** `RangeError: Invalid time value`

**Cause:** The `effective_date` field in the database is NULL or invalid.

**Solution:** Run this SQL in Supabase SQL Editor:

```sql
-- Update any NULL or invalid effective dates to current date
UPDATE defect_criteria_procedures
SET effective_date = NOW()
WHERE effective_date IS NULL;
```

**Code Fix Applied:** Added null check in the frontend code to prevent crashes.

---

## Issue 2: Library Items Not Showing

**Problem:** Dropdown fields for Priority Type, Defect Code, and Defect Type are empty.

**Cause:** Library items haven't been populated in the database yet.

**Solution:** Run the library items migration in Supabase SQL Editor.

### **Step-by-Step:**

1. **Open Supabase SQL Editor**
   - Go to your Supabase Dashboard
   - Click **SQL Editor** in the left sidebar
   - Click **New Query**

2. **Run the Library Items Migration**
   
   Copy and paste the **entire contents** of this file:
   ```
   supabase/migrations/20260125_populate_defect_library_items.sql
   ```

3. **Click Run** (or press `Ctrl+Enter`)

4. **Verify the Data**
   
   Run this query to confirm:
   ```sql
   SELECT 
       lib_code,
       COUNT(*) as item_count
   FROM u_lib_list
   WHERE lib_code IN ('AMLY_TYP', 'AMLY_COD', 'AMLY_FND')
       AND lib_delete = '0'
   GROUP BY lib_code
   ORDER BY lib_code;
   ```

   **Expected output:**
   ```
   AMLY_COD    14
   AMLY_FND    23
   AMLY_TYP    5
   ```

5. **Refresh Your Application**
   
   Go back to the defect criteria page and refresh (`F5`).

---

## What the Library Migration Adds

### **AMLY_TYP** - Priority Types (5 items)
- Critical
- High
- Medium
- Low
- Informational

### **AMLY_COD** - Defect Codes (14 items)
- Corrosion
- Pitting
- General Corrosion
- Crack
- Dent
- Deformation
- Buckling
- Coating Damage
- Anode Depletion
- Loose Connection
- Missing Component
- Marine Growth
- Biofouling
- Other

### **AMLY_FND** - Defect Findings (23 items)
- Surface Corrosion
- Deep Pitting
- Shallow Pitting
- Uniform Corrosion
- Localized Corrosion
- Hairline Crack
- Structural Crack
- Weld Crack
- Minor Dent
- Major Dent
- Coating Disbondment
- Coating Blistering
- Coating Peeling
- Anode Depleted >75%
- Anode Depleted 50-75%
- Anode Depleted <50%
- Light Marine Growth
- Moderate Marine Growth
- Heavy Marine Growth
- Minor Deformation
- Severe Deformation
- Visual Observation
- Requires Further Investigation

---

## After Running Both Fixes

### **Test the Edit Function:**
1. Select a procedure from the dropdown
2. Click the **"Edit"** button
3. The dialog should open with all fields populated
4. Update any field (e.g., change status from "draft" to "active")
5. Click **"Update Procedure"**
6. Changes should save successfully

### **Test Adding Rules:**
1. Click **"Add New Rule"** button
2. All dropdowns should now be populated:
   - ✅ Priority Type: 5 options
   - ✅ Defect Code: 14 options
   - ✅ Defect Type: Populates based on selected Defect Code
3. Fill in the form and save

---

## Quick Fix Commands

### **Fix Invalid Dates:**
```sql
UPDATE defect_criteria_procedures
SET effective_date = NOW()
WHERE effective_date IS NULL;
```

### **Verify Library Items:**
```sql
SELECT lib_code, lib_desc 
FROM u_lib_list 
WHERE lib_code = 'AMLY_TYP' 
  AND lib_delete = '0'
ORDER BY lib_desc;
```

### **Check Procedure Data:**
```sql
SELECT * FROM defect_criteria_procedures;
```

---

## Files Reference

| File | Purpose |
|------|---------|
| [`FIX_INVALID_DATES.sql`](file:///c:/Users/nq352/Documents/GitHub/web-app-offshore/supabase/FIX_INVALID_DATES.sql) | Fix NULL effective dates |
| [`20260125_populate_defect_library_items.sql`](file:///c:/Users/nq352/Documents/GitHub/web-app-offshore/supabase/migrations/20260125_populate_defect_library_items.sql) | Populate library items |

---

## Summary

✅ **Date Error:** Fixed in code + SQL to update NULL dates  
⏳ **Library Items:** Need to run migration SQL  
✅ **Edit Function:** Working after date fix  
✅ **RLS Policies:** Already configured  

Run both SQL fixes and refresh your page!
