# Diving and ROV Movement Types - Complete Guide

## 📋 Overview

This document explains the different dive types (Air and Bell) and ROV deployment methods, including their movement sequences and workflows.

---

## 🤿 **DIVING OPERATIONS**

### **Dive Types**

The system supports two primary diving methods:

| Dive Type | Code | Description | Personnel Required | Typical Use |
|-----------|------|-------------|-------------------|-------------|
| **Air Dive** | `AIR` | Surface-supplied air diving | Diver, Supervisor, Coordinator | Shallow water (<50m), short duration |
| **Bell Dive** | `BELL` | Saturation diving with diving bell | Diver, Standby Diver, Supervisor, Coordinator, Bell Operator, Life Support Tech | Deep water (>50m), extended operations |

---

### **1. AIR DIVE - Movement Sequence**

**Typical Workflow:**

```
1. LEAVING_SURFACE       → Diver descends from surface
2. AT_WORKSITE          → Diver arrives at inspection location
3. LEAVING_WORKSITE     → Diver finishes and departs worksite
4. BACK_TO_SURFACE      → Diver returns to surface
```

**Example Timeline:**

| Time | Movement | Depth | Remarks |
|------|----------|-------|---------|
| 09:00 | LEAVING_SURFACE | 0m | Diver entering water |
| 09:05 | AT_WORKSITE | 25m | Arrived at LEG-A-001 |
| 10:30 | LEAVING_WORKSITE | 25m | Inspection completed |
| 10:40 | BACK_TO_SURFACE | 0m | Diver on surface |

**Personnel Example:**
```typescript
{
  dive_type: "AIR",
  diver_name: "John Doe",
  dive_supervisor: "Mike Smith",
  report_coordinator: "Sarah Johnson"
}
```

---

### **2. BELL DIVE - Movement Sequence**

**Typical Workflow:**

```
1. BELL_LAUNCHED           → Bell deployed from vessel
2. BELL_DESCENDING         → Bell descending to depth
3. BELL_AT_DEPTH          → Bell at target depth
4. DIVER_EXITING_BELL     → Diver exits bell to swim
5. DIVER_AT_WORKSITE      → Diver at inspection location
6. DIVER_LEAVING_WORKSITE → Diver finishes work
7. DIVER_RETURNING_TO_BELL → Diver swimming back to bell
8. DIVER_IN_BELL          → Diver inside bell
9. BELL_ASCENDING         → Bell ascending to surface
10. BELL_AT_SURFACE       → Bell at surface
11. BELL_MATED_TO_CHAMBER → Bell connected to chamber
12. DIVERS_IN_CHAMBER     → Divers in decompression chamber
```

**Example Timeline:**

| Time | Movement | Depth | Bell Depth | Pressure (bar) | Remarks |
|------|----------|-------|------------|----------------|---------|
| 08:00 | BELL_LAUNCHED | 0m | 0m | 1.0 | Bell deployed from DSV |
| 08:15 | BELL_DESCENDING | 50m | 50m | 6.0 | Descending at 20m/min |
| 08:30 | BELL_AT_DEPTH | 120m | 120m | 13.0 | Bell at working depth |
| 08:45 | DIVER_EXITING_BELL | 120m | 120m | 13.0 | Diver 1 exiting bell |
| 09:00 | DIVER_AT_WORKSITE | 125m | 120m | 13.5 | Arrived at riser inspection |
| 11:00 | DIVER_LEAVING_WORKSITE | 125m | 120m | 13.5 | Inspection completed |
| 11:15 | DIVER_RETURNING_TO_BELL | 123m | 120m | 13.3 | Diver swimming back |
| 11:20 | DIVER_IN_BELL | 120m | 120m | 13.0 | Diver secured in bell |
| 11:30 | BELL_ASCENDING | 80m | 80m | 9.0 | Ascending at 15m/min |
| 11:45 | BELL_AT_SURFACE | 0m | 0m | 1.0 | Bell on surface |
| 11:50 | BELL_MATED_TO_CHAMBER | 0m | 0m | 13.0 | Bell mated to sat system |
| 12:00 | DIVERS_IN_CHAMBER | 0m | 0m | 13.0 | Divers in chamber for rest |

**Personnel Example:**
```typescript
{
  dive_type: "BELL",
  diver_name: "John Doe",
  standby_diver: "Tom Wilson",
  dive_supervisor: "Mike Smith",
  bell_operator: "David Brown",
  life_support_technician: "Jenny Lee",
  report_coordinator: "Sarah Johnson"
}
```

**Additional Fields for Bell Dive:**
- `pressure_bar`: Chamber/bell pressure in bars
- `bell_depth_meters`: Depth of the bell (may differ from diver depth)

---

## 🤖 **ROV OPERATIONS**

### **ROV Deployment Methods**

| Method | Description | Typical Use |
|--------|-------------|-------------|
| **TMS (Tether Management System)** | ROV deployed via TMS cage with active tether management | Deep water (>300m), complex operations |
| **Cage Deployment** | ROV in passive cage without TMS | Moderate depth (100-300m) |
| **Direct Deployment** | ROV deployed directly from vessel | Shallow water (<100m) |

---

### **1. TMS DEPLOYMENT - Movement Sequence**

**Complete TMS Workflow:**

```
DEPLOYMENT PHASE:
1. ROV_IN_TMS              → ROV placed in TMS cage on deck
2. TMS_LAUNCHED            → TMS deployed from vessel
3. TMS_DESCENDING          → TMS descending to depth
4. TMS_AT_DEPTH           → TMS at target depth
5. ROV_EXITING_TMS        → ROV leaving TMS cage

OPERATION PHASE:
6. ROV_DEPLOYED            → ROV free swimming
7. ROV_TRANSITING         → ROV moving to worksite
8. ROV_AT_WORKSITE        → ROV at inspection location
9. ROV_WORKING            → ROV performing inspection/task
10. ROV_LEAVING_WORKSITE  → ROV departing worksite

RECOVERY PHASE:
11. ROV_RETURNING_TO_TMS  → ROV heading back to TMS
12. ROV_ENTERING_TMS      → ROV entering TMS cage
13. ROV_IN_TMS_SECURED    → ROV secured in TMS cage
14. TMS_ASCENDING         → TMS ascending to surface
15. TMS_AT_SURFACE        → TMS at surface
16. ROV_RECOVERED         → ROV back on vessel
```

**Example Timeline:**

| Time | Movement | Depth | Altitude | Heading | Lat/Long | Remarks |
|------|----------|-------|----------|---------|----------|---------|
| 10:00 | ROV_IN_TMS | 0m | - | - | - | ROV secured in TMS |
| 10:15 | TMS_LAUNCHED | 0m | - | - | - | TMS overboard |
| 10:30 | TMS_DESCENDING | 200m | - | - | - | Descending at 30m/min |
| 11:00 | TMS_AT_DEPTH | 500m | 10m | - | - | TMS at working depth |
| 11:10 | ROV_EXITING_TMS | 500m | 10m | 045° | 4.1234, 103.5678 | ROV leaving cage |
| 11:15 | ROV_DEPLOYED | 495m | 5m | 045° | 4.1235, 103.5679 | ROV free swimming |
| 11:25 | ROV_TRANSITING | 503m | 3m | 090° | 4.1236, 103.5680 | Transit to platform |
| 11:35 | ROV_AT_WORKSITE | 508m | 2m | 180° | 4.1237, 103.5681 | At riser base |
| 11:40 | ROV_WORKING | 508m | 2m | 180° | 4.1237, 103.5681 | Inspecting riser |
| 13:00 | ROV_LEAVING_WORKSITE | 508m | 3m | 270° | 4.1237, 103.5681 | Inspection complete |
| 13:10 | ROV_RETURNING_TO_TMS | 502m | 5m | 270° | 4.1236, 103.5680 | Returning to TMS |
| 13:20 | ROV_ENTERING_TMS | 498m | 8m | 270° | 4.1235, 103.5679 | Entering cage |
| 13:25 | ROV_IN_TMS_SECURED | 500m | 10m | - | 4.1234, 103.5678 | ROV latched in TMS |
| 13:30 | TMS_ASCENDING | 400m | - | - | - | Ascending at 25m/min |
| 14:00 | TMS_AT_SURFACE | 0m | - | - | - | TMS on surface |
| 14:10 | ROV_RECOVERED | 0m | - | - | - | ROV on deck |

---

### **2. CAGE DEPLOYMENT - Movement Sequence**

**Cage Deployment Workflow:**

```
DEPLOYMENT:
1. ROV_IN_CAGE            → ROV in deployment cage
2. CAGE_LAUNCHED          → Cage deployed from vessel
3. CAGE_AT_DEPTH         → Cage at target depth
4. ROV_EXITING_CAGE      → ROV leaving cage

OPERATION:
5. ROV_DEPLOYED           → ROV free swimming
6. ROV_TRANSITING        → ROV moving to worksite
7. ROV_AT_WORKSITE       → ROV at inspection location
8. ROV_WORKING           → ROV performing task
9. ROV_LEAVING_WORKSITE  → ROV departing worksite

RECOVERY:
10. ROV_RETURNING_TO_CAGE → ROV heading back to cage
11. ROV_IN_CAGE_SECURED  → ROV secured in cage
12. CAGE_RECOVERED       → Cage back on vessel
```

---

### **3. EMERGENCY/SPECIAL MOVEMENTS**

These movements can occur at any time during operations:

| Movement | Code | When Used |
|----------|------|-----------|
| **Emergency Recovery** | `ROV_EMERGENCY_RECOVERY` | Equipment failure, weather, safety |
| **Holding Position** | `ROV_HOLDING_POSITION` | Waiting for approval, avoiding obstacles |
| **Abort Operation** | `ROV_ABORT_OPERATION` | Mission cancelled, conditions unsuitable |

---

## 📊 **Database Schema**

### **Dive Jobs Table**

```sql
CREATE TABLE insp_dive_jobs (
    dive_job_id BIGINT PRIMARY KEY,
    dive_no VARCHAR(50) NOT NULL,
    dive_type VARCHAR(50) NOT NULL DEFAULT 'AIR', -- AIR or BELL
    
    -- Personnel (All dives)
    diver_name VARCHAR(200) NOT NULL,
    dive_supervisor VARCHAR(200) NOT NULL,
    report_coordinator VARCHAR(200) NOT NULL,
    
    -- Additional Personnel (Bell dive only)
    standby_diver VARCHAR(200),
    bell_operator VARCHAR(200),
    life_support_technician VARCHAR(200),
    
    -- ... other fields
);
```

### **Dive Movements Table**

```sql
CREATE TABLE insp_dive_movements (
    movement_id BIGINT PRIMARY KEY,
    dive_job_id BIGINT REFERENCES insp_dive_jobs,
    movement_type VARCHAR(50) NOT NULL,
    movement_time TIMESTAMP NOT NULL,
    
    -- Depth tracking
    depth_meters NUMERIC(10,2),
    
    -- Bell dive specific
    pressure_bar NUMERIC(10,2),
    bell_depth_meters NUMERIC(10,2),
    
    remarks TEXT
);
```

### **ROV Movements Table**

```sql
CREATE TABLE insp_rov_movements (
    movement_id BIGINT PRIMARY KEY,
    rov_job_id BIGINT REFERENCES insp_rov_jobs,
    movement_type VARCHAR(50) NOT NULL,
    movement_time TIMESTAMP NOT NULL,
    
    -- Position tracking
    depth_meters NUMERIC(10,2),
    altitude_meters NUMERIC(10,2),  -- Height above seabed
    latitude NUMERIC(12,9),
    longitude NUMERIC(12,9),
    heading_degrees NUMERIC(5,2),
    
    -- Telemetry
    telemetry_data JSONB,
    
    remarks TEXT
);
```

---

## 🎯 **Movement Type Enums**

### **Air Dive Movements**
```typescript
type AirDiveMovement = 
  | 'LEAVING_SURFACE'
  | 'AT_WORKSITE'
  | 'LEAVING_WORKSITE'
  | 'BACK_TO_SURFACE';
```

### **Bell Dive Movements**
```typescript
type BellDiveMovement = 
  | 'BELL_LAUNCHED'
  | 'BELL_DESCENDING'
  | 'BELL_AT_DEPTH'
  | 'DIVER_EXITING_BELL'
  | 'DIVER_AT_WORKSITE'
  | 'DIVER_LEAVING_WORKSITE'
  | 'DIVER_RETURNING_TO_BELL'
  | 'DIVER_IN_BELL'
  | 'BELL_ASCENDING'
  | 'BELL_AT_SURFACE'
  | 'BELL_MATED_TO_CHAMBER'
  | 'DIVERS_IN_CHAMBER';
```

### **ROV TMS Movements**
```typescript
type ROVTMSMovement = 
  // Deployment
  | 'ROV_IN_TMS'
  | 'TMS_LAUNCHED'
  | 'TMS_DESCENDING'
  | 'TMS_AT_DEPTH'
  | 'ROV_EXITING_TMS'
  | 'ROV_DEPLOYED'
  
  // Operation
  | 'ROV_TRANSITING'
  | 'ROV_AT_WORKSITE'
  | 'ROV_WORKING'
  | 'ROV_LEAVING_WORKSITE'
  
  // Recovery
  | 'ROV_RETURNING_TO_TMS'
  | 'ROV_ENTERING_TMS'
  | 'ROV_IN_TMS_SECURED'
  | 'TMS_ASCENDING'
  | 'TMS_AT_SURFACE'
  | 'ROV_RECOVERED';
```

### **ROV Cage Movements**
```typescript
type ROVCageMovement = 
  | 'ROV_IN_CAGE'
  | 'CAGE_LAUNCHED'
  | 'CAGE_AT_DEPTH'
  | 'ROV_EXITING_CAGE'
  | 'ROV_RETURNING_TO_CAGE'
  | 'ROV_IN_CAGE_SECURED'
  | 'CAGE_RECOVERED';
```

### **ROV Emergency Movements**
```typescript
type ROVEmergencyMovement = 
  | 'ROV_EMERGENCY_RECOVERY'
  | 'ROV_HOLDING_POSITION'
  | 'ROV_ABORT_OPERATION';
```

---

## 💡 **UI Implementation Examples**

### **Example 1: Movement Type Selector Based on Job Type**

```typescript
// Get available movements based on dive type
function getAvailableMovements(diveType: 'AIR' | 'BELL') {
  if (diveType === 'AIR') {
    return [
      { value: 'LEAVING_SURFACE', label: 'Leaving Surface' },
      { value: 'AT_WORKSITE', label: 'At Worksite' },
      { value: 'LEAVING_WORKSITE', label: 'Leaving Worksite' },
      { value: 'BACK_TO_SURFACE', label: 'Back to Surface' }
    ];
  } else {
    return [
      { value: 'BELL_LAUNCHED', label: 'Bell Launched' },
      { value: 'BELL_DESCENDING', label: 'Bell Descending' },
      { value: 'BELL_AT_DEPTH', label: 'Bell at Depth' },
      { value: 'DIVER_EXITING_BELL', label: 'Diver Exiting Bell' },
      { value: 'DIVER_AT_WORKSITE', label: 'Diver at Worksite' },
      { value: 'DIVER_LEAVING_WORKSITE', label: 'Diver Leaving Worksite' },
      { value: 'DIVER_RETURNING_TO_BELL', label: 'Diver Returning to Bell' },
      { value: 'DIVER_IN_BELL', label: 'Diver in Bell' },
      { value: 'BELL_ASCENDING', label: 'Bell Ascending' },
      { value: 'BELL_AT_SURFACE', label: 'Bell at Surface' },
      { value: 'BELL_MATED_TO_CHAMBER', label: 'Bell Mated to Chamber' },
      { value: 'DIVERS_IN_CHAMBER', label: 'Divers in Chamber' }
    ];
  }
}
```

### **Example 2: Conditional Personnel Fields**

```tsx
<FormField>
  <Label>Dive Type</Label>
  <Select value={diveType} onChange={setDiveType}>
    <option value="AIR">Air Dive</option>
    <option value="BELL">Bell Dive</option>
  </Select>
</FormField>

{/* Standard Personnel */}
<FormField>
  <Label>Diver Name *</Label>
  <Input value={diverName} onChange={setDiverName} required />
</FormField>

<FormField>
  <Label>Dive Supervisor *</Label>
  <Input value={supervisor} onChange={setSupervisor} required />
</FormField>

<FormField>
  <Label>Report Coordinator *</Label>
  <Input value={coordinator} onChange={setCoordinator} required />
</FormField>

{/* Additional Personnel for Bell Dive */}
{diveType === 'BELL' && (
  <>
    <FormField>
      <Label>Standby Diver</Label>
      <Input value={standbyDiver} onChange={setStandbyDiver} />
    </FormField>
    
    <FormField>
      <Label>Bell Operator</Label>
      <Input value={bellOperator} onChange={setBellOperator} />
    </FormField>
    
    <FormField>
      <Label>Life Support Technician</Label>
      <Input value={lifeSupportTech} onChange={setLifeSupportTech} />
    </FormField>
  </>
)}
```

### **Example 3: ROV Movement Timeline**

```tsx
<Timeline>
  <TimelineItem time="10:00" status="completed">
    <Badge>ROV_IN_TMS</Badge>
    <p>ROV secured in TMS cage</p>
    <small>Depth: 0m</small>
  </TimelineItem>
  
  <TimelineItem time="10:15" status="completed">
    <Badge>TMS_LAUNCHED</Badge>
    <p>TMS deployed from vessel</p>
  </TimelineItem>
  
  <TimelineItem time="11:00" status="completed">
    <Badge>TMS_AT_DEPTH</Badge>
    <p>TMS at working depth</p>
    <small>Depth: 500m | Altitude: 10m</small>
  </TimelineItem>
  
  <TimelineItem time="11:35" status="active">
    <Badge variant="primary">ROV_AT_WORKSITE</Badge>
    <p>ROV at inspection location</p>
    <small>Depth: 508m | Heading: 180° | Lat: 4.1237, Long: 103.5681</small>
  </TimelineItem>
</Timeline>
```

---

## 📋 **Best Practices**

### **For Diving Operations:**

1. **Always log movements sequentially** - Don't skip steps
2. **For bell dives, track both diver depth and bell depth** - They can differ
3. **Record pressure for bell dives** - Critical for saturation operations
4. **Document decompression stops** - Use remarks field

### **For ROV Operations:**

1. **Log TMS movements separately from ROV movements** - Track both cage and vehicle
2. **Always record altitude above seabed** - Critical for collision avoidance
3. **Log telemetry snapshots** - Store sensor data at key movements
4. **Document emergency procedures** - Use emergency movement types

### **General:**

1. **Use timestamps accurately** - Real-time logging preferred
2. **Add detailed remarks** - Context is important for safety review
3. **Track position data** - Lat/long for ROV, depth for all operations
4. **Follow industry standards** - IMCA, ADCI guidelines

---

## 🔍 **Example Queries**

### **Get all bell dive movements for a job:**
```sql
SELECT 
    dm.movement_time,
    dm.movement_type,
    dm.depth_meters,
    dm.bell_depth_meters,
    dm.pressure_bar,
    dm.remarks
FROM insp_dive_movements dm
JOIN insp_dive_jobs dj ON dm.dive_job_id = dj.dive_job_id
WHERE dj.dive_no = 'DIVE-2026-001'
  AND dj.dive_type = 'BELL'
ORDER BY dm.movement_time;
```

### **Get ROV TMS deployment sequence:**
```sql
SELECT 
    rm.movement_time,
    rm.movement_type,
    rm.depth_meters,
    rm.altitude_meters,
    rm.telemetry_data,
    rm.remarks
FROM insp_rov_movements rm
JOIN insp_rov_jobs rj ON rm.rov_job_id = rj.rov_job_id
WHERE rj.deployment_no = 'ROV-2026-001'
  AND rm.movement_type IN (
    'ROV_IN_TMS', 'TMS_LAUNCHED', 'TMS_DESCENDING', 
    'TMS_AT_DEPTH', 'ROV_EXITING_TMS'
  )
ORDER BY rm.movement_time;
```

---

## ✅ **Summary**

The Inspection Module now supports:

✅ **Two dive types:** Air and Bell diving with appropriate personnel  
✅ **16 dive movement types:** 4 for air, 12 for bell  
✅ **30 ROV movement types:** TMS, cage, and emergency operations  
✅ **Comprehensive tracking:** Depth, pressure, position, altitude, telemetry  
✅ **Flexible schema:** Supports all industry-standard diving and ROV operations  

This provides a complete operational logging system for all offshore inspection activities!
