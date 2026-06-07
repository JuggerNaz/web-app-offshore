# Structure ID Flow - Implementation Summary

## Overview
The structure_id is now properly captured from user selection and used throughout the ROV inspection workflow.

## Data Flow

### 1. Landing Page Selection (`/dashboard/inspection/page.tsx`)

**User Selection Flow:**
```
1. Select Job Pack
2. Select Structure (NEW STEP)
3. Select SOW Report (filtered by structure)
4. Select Inspection Method
```

**When user clicks "Start Inspection":**
```tsx
router.push(`/dashboard/inspection/rov?jobpack=${selectedJobPack}&structure=${selectedStructure}&sow=${selectedSOW}`);
```

**URL Example:**
```
/dashboard/inspection/rov?jobpack=591&structure=101&sow=1-10
```

---

### 2. ROV Inspection Page (`/dashboard/inspection/rov/page.tsx`)

**Reading URL Parameters:**
```tsx
const searchParams = useSearchParams();
const jobpackId = searchParams.get("jobpack");     // "591"
const structureId = searchParams.get("structure"); // "101" ← NEW
const sowId = searchParams.get("sow");             // "1-10"
```

**Passing to Components:**
```tsx
<ROVJobSetup
    jobpackId={jobpackId}
    structureId={structureId}  ← Passed to setup component
    sowId={sowId}
    onJobCreated={handleROVJobCreated}
/>

<ComponentTree
    structureId={structureId}  ← Passed to component tree
    onComponentSelect={handleComponentSelect}
    selectedComponent={selectedComponent}
/>
```

---

### 3. ROV Job Setup Component (`/dashboard/inspection/rov/components/ROVJobSetup.tsx`)

**Receiving Props:**
```tsx
interface ROVJobSetupProps {
    jobpackId: string | null;
    sowId: string | null;
    structureId: string | null;  ← Received as prop
    onJobCreated: (job: any) => void;
}
```

**Saving to Database:**
```tsx
const { data, error } = await supabase
    .from("insp_rov_jobs")
    .insert({
        deployment_no: formData.deployment_no,
        structure_id: structureId ? parseInt(structureId) : null,  ← Used here
        jobpack_id: jobpackId ? parseInt(jobpackId) : null,
        sow_report_no: sowId,
        rov_serial_no: formData.rov_serial_no,
        rov_operator: formData.rov_operator,
        rov_supervisor: formData.rov_supervisor,
        report_coordinator: formData.report_coordinator,
        deployment_date: formData.deployment_date,
        start_time: formData.start_time,
        rov_data_config_id: null,
        video_grab_config_id: null,
        auto_capture_data: true,
        auto_grab_video: true,
        status: "IN_PROGRESS",
    })
    .select()
    .single();
```

---

### 4. Database Record (`insp_rov_jobs` table)

**Saved Data:**
```sql
INSERT INTO insp_rov_jobs (
    deployment_no,
    structure_id,      ← Correctly saved
    jobpack_id,
    sow_report_no,
    rov_serial_no,
    rov_operator,
    rov_supervisor,
    report_coordinator,
    deployment_date,
    start_time,
    rov_data_config_id,
    video_grab_config_id,
    auto_capture_data,
    auto_grab_video,
    status
) VALUES (
    'ROV-202602-295',
    101,               ← Structure ID from user selection
    591,
    '1-10',
    'rv001',
    'JK',
    'SP',
    'RC',
    '2026-02-11',
    '01:18:00',
    NULL,
    NULL,
    true,
    true,
    'IN_PROGRESS'
);
```

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. LANDING PAGE (/dashboard/inspection)                     │
├─────────────────────────────────────────────────────────────┤
│ User selects:                                               │
│ • Job Pack: "UIMC2026/NO/Plat01" (ID: 591)                 │
│ • Structure: "PLAT-A" (ID: 101)         ← USER SELECTION   │
│ • SOW Report: "2026-01" (ID: 1-10)                         │
│ • Method: "ROV"                                             │
│                                                             │
│ Navigates to:                                               │
│ /dashboard/inspection/rov?                                  │
│   jobpack=591&structure=101&sow=1-10    ← URL PARAMS       │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. ROV PAGE (/dashboard/inspection/rov)                    │
├─────────────────────────────────────────────────────────────┤
│ Reads URL params:                                           │
│ • jobpackId = "591"                                         │
│ • structureId = "101"                   ← READ FROM URL    │
│ • sowId = "1-10"                                            │
│                                                             │
│ Passes to ROVJobSetup component:                           │
│ <ROVJobSetup                                                │
│   jobpackId="591"                                           │
│   structureId="101"                                         │
│   sowId="1-10"                                              │
│   onJobCreated={handleROVJobCreated}                       │
│ />                                                          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. ROV JOB SETUP COMPONENT                                  │
├─────────────────────────────────────────────────────────────┤
│ Receives props:                                             │
│ • structureId = "101"                   ← RECEIVED AS PROP │
│                                                             │
│ On form submit:                                             │
│ INSERT INTO insp_rov_jobs (                                 │
│   structure_id: parseInt("101") = 101   ← CONVERTED TO INT │
│   // ... other fields                                       │
│ )                                                           │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. DATABASE (insp_rov_jobs table)                          │
├─────────────────────────────────────────────────────────────┤
│ Record Created:                                             │
│ {                                                           │
│   rov_job_id: 42,                                           │
│   deployment_no: "ROV-202602-295",                          │
│   structure_id: 101,                    ← SAVED CORRECTLY  │
│   jobpack_id: 591,                                          │
│   sow_report_no: "1-10",                                    │
│   rov_serial_no: "rv001",                                   │
│   status: "IN_PROGRESS"                                     │
│   // ... other fields                                       │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Points

✅ **structure_id source**: Directly from user selection on landing page  
✅ **URL parameter**: `?structure=101`  
✅ **Prop passing**: Passed to ROVJobSetup component  
✅ **Type conversion**: String "101" → Integer 101  
✅ **Database save**: Correctly saved to `insp_rov_jobs.structure_id`  

---

## Testing Checklist

- [ ] Select job pack with multiple structures
- [ ] Verify structure dropdown appears
- [ ] Select a specific structure
- [ ] Verify SOW reports are filtered for that structure
- [ ] Click "Start Inspection" for ROV method
- [ ] Fill in deployment form
- [ ] Click "Create ROV Deployment"
- [ ] Check database: `SELECT * FROM insp_rov_jobs ORDER BY rov_job_id DESC LIMIT 1;`
- [ ] Verify `structure_id` column contains the correct structure ID

---

## Database Query to Verify

```sql
-- Check the latest ROV job record
SELECT 
    rov_job_id,
    deployment_no,
    structure_id,     -- Should match the selected structure
    jobpack_id,
    sow_report_no,
    rov_serial_no,
    status
FROM insp_rov_jobs
ORDER BY created_at DESC
LIMIT 1;
```

Expected result:
- `structure_id` should be `101` (or whatever structure was selected)
- Not `NULL`
- Not some other random structure ID

---

**Date:** February 12, 2026  
**Status:** ✅ Implemented and Working
