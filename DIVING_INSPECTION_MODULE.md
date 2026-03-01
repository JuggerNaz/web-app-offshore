# Diving Inspection Module - Implementation Summary

## Overview
A comprehensive diving inspection interface designed for offshore platform inspections, complementing the ROV inspection system with dive-specific features.

---

## 🎯 Key Features

### **1. Dive Job Setup**
- **Deployment Information**
  - Auto-generated deployment numbers (`DIVE-202602-XXX`)
  - Dive type selection (Air Dive, Bell Dive, Saturation Dive, SCUBA)
  - Deployment date and start time

- **Dive Team Management**
  - Primary Diver
  - Standby Diver
  - Dive Supervisor
  - Report Coordinator

- **Dive Parameters**
  - Maximum depth (meters)
  - Planned duration (minutes)
  
- **Safety Information Banner**
  - Displays safety protocols reminder
  - Emphasizes standby diver readiness

### **2. Live Dive Data Tracking**
Real-time monitoring of dive parameters:
- **Current Depth** (meters) - Primary display with blue highlight
- **Dive Duration** (HH:MM format) - Auto-updating timer
- **Water Temperature** (°C)
- **Visibility** (meters)
- **Current Speed** (knots)
- **Diver Status** (OK/Alert badge)

**Controls:**
- Start Tracking button (green)
- Stop button (red)
- Live status indicator with "ACTIVE" badge

### **3. Video & Photo Logging**
- **Live Video Feed**
  - Camera stream with real-time display
  - Overlay showing:
    - Deployment number
    - Diver name
    - Date and time
  - Full HD support (1920x1080)

- **Photo Capture**
  - Instant photo capture from video feed
  - Optional photo notes
  - Captured photos counter
  - JPEG format (90% quality)

- **Recording Indicator**
  - Red "RECORDING" badge when streaming
  - Animated recording dot

### **4. Inspection Form**
Structured data collection for each component:
- **Component Selection** (from tree or manual entry)
- **Inspection Type**
  - Visual
  - CCTV
  - Flooded Member Detection
  - Cathodic Protection
  - Ultrasonic Thickness

- **Condition Assessment**
  - Good
  - Fair
  - Poor
  - Critical

- **Documentation**
  - Defects found
  - Detailed observations (multi-line)
  - Recommendations (multi-line)
  - Photos taken count

- **Validation**
  - Warning if no component selected
  - Auto-timestamp on save

### **5. Dive Movement Log**
Two-panel layout for movement tracking:

**Left Panel - Add Movement:**
- Location input (e.g., Leg A1, Column B2)
- Activity description
- Notes field
- Quick "Add Movement" button

**Right Panel - Movement History:**
- Chronological list (newest first)
- Each entry shows:
  - Timestamp (time + date)
  - Location
  - Activity
  - Notes (if provided)
- Entry count badge
- Auto-scrolling list

---

## 🎨 Design Highlights

### **Color Scheme**
- **Primary**: Blue gradient (`from-blue-600 to-blue-800`)
- **Success**: Green (`green-600`)
- **Danger**: Red (`red-600`)
- **Neutral**: Slate tones

### **Visual Elements**
- **Icons**: Lucide React icons throughout
  - Anchor (main icon)
  - Waves (inspection tab)
  - Clock (dive log tab)
  - Camera, Video, Gauge, Thermometer, Wind

- **Cards**: Elevated with shadows and subtle borders
- **Badges**: Animated pulse for active states
- **Buttons**: Gradient backgrounds with hover effects

### **Layout**
- **3-Column Grid** (Inspection Tab)
  - Left: 3 cols - Live Data + Component Tree
  - Center: 6 cols - Video Feed
  - Right: 3 cols - Inspection Form

- **2-Column Grid** (Dive Log Tab)
  - Left: Add Movement Form
  - Right: Movement History

- **Responsive**: Full HD support (max-width: 1920px)

---

## 📊 Database Integration

### **Tables Used**

**1. insp_dive_jobs**
```sql
- dive_job_id (PK)
- deployment_no
- structure_id (FK)
- jobpack_id (FK)
- sow_report_no
- diver_name
- standby_diver
- dive_supervisor
- report_coordinator
- dive_type
- deployment_date
- dive_start_time
- max_depth
- planned_duration
- status
```

**2. insp_dive_data**
```sql
- id (PK)
- dive_job_id (FK)
- component_qid
- inspection_type
- condition
- defects_found
- observations
- recommendations
- photos_taken
- inspection_time
```

**3. insp_dive_movements**
```sql
- id (PK)
- dive_job_id (FK)
- timestamp
- location
- activity
- notes
```

---

## 🔄 User Workflow

### **Step 1: Setup** (Tab 1)
1. Navigate to `/dashboard/inspection`
2. Select Job Pack → Structure → SOW Report → **DIVING**
3. Fill in deployment form:
   - Deployment number (auto-generated)
   - Select dive type
   - Enter dive team members
   - Set deployment date/time
   - Enter dive parameters
4. Click "Create Dive Deployment"
5. → Auto switches to Inspection tab

### **Step 2: Inspection** (Tab 2)
1. **Start Live Data Tracking**
   - Click "Start Tracking" in Live Data panel
   - Monitor depth, duration, temperature, etc.

2. **Start Video Feed**
   - Click "Start Video" in Video panel
   - Video stream appears with overlay

3. **Navigate Component Tree**
   - Select component to inspect
   - Component auto-populates in form

4. **Record Inspection**
   - Fill in inspection form
   - Select inspection type and condition
   - Add observations and recommendations
   - Click "Save Inspection Record"

5. **Capture Photos** (as needed)
   - Add photo note (optional)
   - Click "Capture Photo"
   - Photos are counted and stored

### **Step 3: Dive Log** (Tab 3)
1. Log movements as dive progresses
2. Enter location and activity
3. Add notes if needed
4. Click "Add Movement"
5. View chronological history on right

---

## 🚀 Technical Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI Components**: shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Icons**: Lucide React
- **Toast Notifications**: Sonner
- **Media API**: WebRTC (getUserMedia)

---

## 🔐 Security

- **RLS Policies**: Required for all inspection tables
- **Authentication**: Supabase Auth
- **Permissions**: Authenticated users only

**Required SQL:**
```sql
-- Run fix_inspection_rls_policies.sql to enable:
- INSERT on insp_dive_jobs
- SELECT on insp_dive_jobs
- UPDATE on insp_dive_jobs
- INSERT on insp_dive_data
- INSERT on insp_dive_movements
```

---

## 📁 File Structure

```
app/dashboard/inspection/dive/
├── page.tsx                          # Main dive inspection page
└── components/
    ├── DiveJobSetup.tsx             # Deployment setup form
    ├── DiveLiveData.tsx             # Live dive parameters
    ├── DiveVideoLog.tsx             # Video feed & photos
    ├── DiveInspectionForm.tsx       # Inspection recording
    └── DiveMovementLog.tsx          # Movement tracking
```

---

## ✅ Features Comparison: ROV vs Diving

| Feature | ROV | Diving |
|---------|-----|--------|
| Deployment Setup | ✅ | ✅ |
| Live Data Tracking | ✅ Serial/Network | ✅ Manual/Timer |
| Video Feed | ✅ Camera | ✅ Camera |
| Photo Capture | ✅ | ✅ |
| Component Tree | ✅ | ✅ (shared) |
| Inspection Form | ✅ | ✅ |
| Movement Log | ✅ | ✅ |
| Team Info | Operator/Supervisor | Diver/Standby/Supervisor |
| Safety Banner | ℹ️ Settings | ⚠️ Safety Protocols |

---

## 🎯 Next Steps

### **Enhancements** (Future)
1. **Real-time Depth Sensor Integration**
   - Connect to actual dive computers
   - Serial/Bluetooth data feed

2. **Automatic Photo Tagging**
   - GPS coordinates
   - Depth at capture
   - Component association

3. **Dive Profile Chart**
   - Depth vs time graph
   - Decompression tracking

4. **Export Dive Log**
   - PDF generation
   - Include photos and movements

5. **Offline Mode**
   - Local storage fallback
   - Sync when connection restored

---

## 📝 Usage Notes

### **Camera Permissions**
- Browser will request camera access on video start
- Ensure HTTPS connection (required for getUserMedia)
- Supported browsers: Chrome, Edge, Opera

### **Data Persistence**
- All inspections saved to database immediately
- Movements logged with precise timestamps
- Photos stored as base64 (consider moving to Supabase Storage)

### **Performance**
- Video resolution: 1920x1080 (ideal)
- Photo quality: 90% JPEG
- Auto-scrolling lists for movement history

---

**Created:** February 12, 2026  
**Status:** ✅ Fully Implemented  
**Ready for Testing:** Yes  

**Test URL:** `/dashboard/inspection/dive?jobpack=X&structure=Y&sow=Z`
