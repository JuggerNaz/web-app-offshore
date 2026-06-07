# ✅ State Restoration & SOW Report Display Fixes

## Overview
Fixed two critical issues with the Inspection Module landing page:
1. **State restoration not loading dependent data** (structures and SOW reports)
2. **SOW report dropdown showing duplicates per inspection code instead of distinct report numbers**

---

## 🔧 Issue #1: State Restoration Not Working Properly

### **Problem**
When navigating back from inspection page:
- ✅ Job Pack was selected (from sessionStorage)
- ❌ Structures dropdown showed "No structures available"
- ❌ SOW Reports dropdown showed "Select a structure first..."

### **Root Cause**
State was being restored **before** jobPacks data loaded from the database:

```typescript
// ❌ Old flow (broken)
1. Component mounts
2. Restore selectedJobPack from sessionStorage → "123"
3. Start loading jobPacks from database (async)
4. useEffect tries to load structures for jobPack "123"
5. But jobPacks array is still empty! → Can't find structures
6. Result: "No structures available"
```

### **Solution**
Wait for jobPacks to load, then restore state:

```typescript
// ✅ New flow (working)
1. Component mounts
2. Start loading jobPacks from database
3. jobPacks finishes loading → jobPacks array populated
4. useEffect detects jobPacks.length > 0
5. Restore selectedJobPack from sessionStorage → "123"
6. Triggers loadStructures() with valid jobPacks data
7. Structures load successfully!
8. Restore selectedStructure → Triggers loadSOWReports()
9. SOW reports load successfully!
```

### **Code Changes**

**Before:**
```typescript
useEffect(() => {
    const savedJobPack = sessionStorage.getItem("inspection_jobpack");
    const savedStructure = sessionStorage.getItem("inspection_structure");
    
    if (savedJobPack) setSelectedJobPack(savedJobPack); // Too early!
    if (savedStructure) setSelectedStructure(savedStructure); // Too early!
    
    loadJobPacks();
}, []);
```

**After:**
```typescript
// First effect: Just load data
useEffect(() => {
    loadJobPacks();
}, []);

// Second effect: Restore AFTER data loads
useEffect(() => {
    if (jobPacks.length > 0) {
        const savedJobPack = sessionStorage.getItem("inspection_jobpack");
        const savedStructure = sessionStorage.getItem("inspection_structure");
        
        if (savedJobPack && !selectedJobPack) {
            setSelectedJobPack(savedJobPack); // Triggers loadStructures
        }
        if (savedStructure && !selectedStructure) {
            setSelectedStructure(savedStructure); // Triggers loadSOWReports
        }
    }
}, [jobPacks]); // Triggers when jobPacks loads
```

---

## 🔧 Issue #2: SOW Report Dropdown Showing Duplicates

### **Problem**
If a SOW had multiple inspection items with the same report number:
```
Report RPT-001, Inspection: VI (Visual Inspection)
Report RPT-001, Inspection: UT (Ultrasonic Testing)  
Report RPT-001, Inspection: MPI (Magnetic Particle)
Report RPT-002, Inspection: VI
```

User would see RPT-001 listed 3 times - once for each inspection code.

### **Expected Behavior**
Show distinct report numbers only:
```
Report RPT-001
Report RPT-002
```

### **Solution**
Group by distinct report_number using a Set:

**Before:**
```typescript
// ❌ Creates one entry per inspection code
sowItems.forEach((item: any) => {
    if (item.inspection_code) {  // One per code
        formatted.push({
            report_number: item.report_number,
            inspection_method: item.inspection_code,
            ...
        });
    }
});
```

**After:**
```typescript
// ✅ Creates one entry per distinct report number
const reportNumbersSet = new Set<string>();

sowItems.forEach((item: any) => {
    const reportNum = item.report_number || `${sow.structure_title}-${item.id}`;
    const uniqueKey = `${sow.id}-${reportNum}`;
    
    if (!reportNumbersSet.has(uniqueKey)) {
        reportNumbersSet.add(uniqueKey);
        formatted.push({
            report_number: reportNum,
            scope_description: sow.structure_title,
            inspection_method: "",  // Not shown
            ...
        });
    }
});
```

---

## ✅ What's Fixed Now

### **State Restoration:**
1. Navigate to inspection page with Job Pack "JP-001", Structure "PLAT-A", Report "RPT-001"
2. Click browser back button
3. ✅ Job Pack dropdown shows "JP-001" (selected)
4. ✅ Structure dropdown shows available structures with "PLAT-A" selected
5. ✅ SOW Report dropdown shows reports with "RPT-001" selected
6. ✅ Inspection method (ROV/Diving) is restored

### **SOW Report List:**
1. Select Job Pack and Structure
2. SOW Report dropdown loads
3. ✅ Shows only distinct report numbers (no duplicates)
4. ✅ Clean, simple list format
5. ✅ No inspection codes shown in the dropdown

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  USER RETURNS TO INSPECTION LANDING PAGE               │
└─────────────────────────────────────────────────────────┘
                        ↓
        ┌───────────────────────────────┐
        │  1. Component Mounts           │
        │  2. Load Job Packs from DB     │
        └───────────────────────────────┘
                        ↓
        ┌───────────────────────────────┐
        │  3. Job Packs Loaded           │
        │     jobPacks.length > 0        │
        └───────────────────────────────┘
                        ↓
        ┌───────────────────────────────┐
        │  4. Restore from Storage       │
        │     - Get saved Job Pack ID    │
        │     - Get saved Structure ID   │
        │     - Get saved SOW ID         │
        │     - Get saved Mode           │
        └───────────────────────────────┘
                        ↓
        ┌───────────────────────────────┐
        │  5. Set Saved Job Pack         │
        │     setSelectedJobPack()       │
        └───────────────────────────────┘
                        ↓
        ┌───────────────────────────────┐
        │  6. useEffect Triggers         │
        │     loadStructures()           │
        └───────────────────────────────┘
                        ↓
        ┌───────────────────────────────┐
        │  7. Set Saved Structure        │
        │     setSelectedStructure()     │
        └───────────────────────────────┘
                        ↓
        ┌───────────────────────────────┐
        │  8. useEffect Triggers         │
        │     loadSOWReports()           │
        │     - Groups by distinct       │
        │       report numbers           │
        └───────────────────────────────┘
                        ↓
        ┌───────────────────────────────┐
        │  9. All Selections Restored!   │
        │     ✅ Job Pack Selected       │
        │     ✅ Structure Selected      │
        │     ✅ SOW Report Selected     │
        │     ✅ Method Selected         │
        └───────────────────────────────┘
```

---

## 🎯 Testing Checklist

- [x] Navigate back from ROV inspection → All selections restored
- [x] Navigate back from Dive inspection → All selections restored
- [x] SOW dropdown shows distinct report numbers only
- [x] No duplicate reports in dropdown
- [x] Structures load when job pack is restored
- [x] SOW reports load when structure is restored
- [x] Page refresh maintains selections (sessionStorage)
- [x] New tab loses selections (sessionStorage clears)

---

## 🔧 Modified Files

**app/dashboard/inspection/page.tsx:**
- Separated state restoration into two useEffects
- First loads jobPacks
- Second restores state after jobPacks loads
- Modified SOW loading to show distinct report numbers
- Added Set-based deduplication
- Removed inspection_method from display

---

**The inspection landing page now properly restores all selections and shows clean, distinct report numbers!** 🎉
