# Inspection Module Design Specification

## Overview
The Inspection Module supports two primary inspection methods:
1. **Diving Job** - Manual underwater inspection by certified divers
2. **ROV Job** - Remote Operated Vehicle inspection

Both methods share similar inspection types but differ in data capture methodologies and operational procedures.

---

## 1. Diving Job Specifications

### 1.1 Pre-Inspection Setup
**Required Information:**
- Dive Number (Sequential)
- Diver Name
- Dive Supervisor Name
- Report Coordinator Name

**Dive Movement Logging:**
- Leaving the Surface (timestamp)
- At Worksite (timestamp)
- Leaving Worksite (timestamp)
- Back to Surface (timestamp)

**UI Component:** Small collapsible card showing latest dive movement with timestamp

### 1.2 Video Recording Management
**Video Log Details:**
- Unique Tape Number (auto-generated sequence)
- New Video Log Started (timestamp)
- Introduction Log (timestamp)
- Pre-Inspection Video Log (date/time before each inspection)
- Post-Inspection Video Log (date/time after each inspection)

**UI Component:** Compact card displaying latest video action with expand/collapse functionality

### 1.3 Dynamic Inspection Data Entry
**Data Entry Requirements:**
- Component-based field rendering
- Inspection type-specific fields
- Component type-specific fields
- Real-time validation
- Auto-save functionality

### 1.4 Anomaly/Defect Registration
**Anomaly Details:**
- Unique Anomaly Reference Number (auto-generated)
- Defect Type (from library)
- Priority Type (from library)
- Type of Defect (from library)
- Flag inspection record as anomaly
- Link to inspection record

**Media Attachments:**
- Live video snapshot capability
- Short video clip recording
- Attachment to inspection records

**Live Video Integration:**
- Camera connection setup
- Live preview card
- Snapshot action button
- Video clip recording button

### 1.5 Component Selection & Management
**Features:**
- Component list for selected structure
- View component specifications
- Modify component specs (if authorized)
- Search functionality
- AI-powered next component suggestion:
  - Prioritize nearest non-inspected components
  - Filter by SOW inclusion
  - Display distance/proximity
- Future: 3D structure visualization card

### 1.6 Common Data Fields
**Mandatory Fields:**
- Structure ID
- Job Pack ID / Inspection Number
- SOW Report Number
- Inspection Type Code
- Component ID
- Component Type/Code
- Inspection Date
- Inspection Time
- Tape Count Number
- Tape Number
- Dive Number
- Elevation / FP / KP (for pipeline)

**Data Storage:**
- Core metadata in standard columns
- Inspection-specific data in JSON field
- Migration compatibility keys in JSON: `inspno`, `str_id`, `comp_id`, `insp_id`

### 1.7 Inspection ID Generation
- Use database sequence
- Format: `INSP-{SEQUENCE_NUMBER}` or custom format
- Sequence ensures uniqueness and ordering

### 1.8 UI Layout Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DIVING INSPECTION INTERFACE                      │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌──────────────────┐ ┌─────────────────────┐ │
│ │ Dive Movement    │ │ Video Recording  │ │ Live Video Preview  │ │
│ │ [Collapsed]      │ │ [Collapsed]      │ │ [When Connected]    │ │
│ │ Latest: At Work  │ │ Latest: Tape-001 │ │                     │ │
│ │ 10:35:22         │ │ Intro Done       │ │  [Camera Feed]      │ │
│ │ [Expand ▼]       │ │ [Expand ▼]       │ │  [📷 Snap] [🎥 Rec] │ │
│ └──────────────────┘ └──────────────────┘ └─────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │           MAIN INSPECTION CARD (Large)                        │  │
│ │                                                                │  │
│ │  Component: LEG-A-001                                         │  │
│ │  Type: PRIMARY LEG                                            │  │
│ │  Inspection Type: GENERAL VISUAL INSPECTION (GVI)             │  │
│ │                                                                │  │
│ │  ┌─────────────────────────────────────────────────────────┐ │  │
│ │  │ Dynamic Inspection Fields (Based on Type)               │ │  │
│ │  │                                                          │ │  │
│ │  │  Overall Condition: [Dropdown ▼]                        │ │  │
│ │  │  Marine Growth:     [Input Field] %                     │ │  │
│ │  │  Corrosion Level:   [Dropdown ▼]                        │ │  │
│ │  │  Coating Condition: [Dropdown ▼]                        │ │  │
│ │  │  Anode Condition:   [Dropdown ▼]                        │ │  │
│ │  │  Remarks:           [Text Area]                         │ │  │
│ │  │                                                          │ │  │
│ │  │  [🚨 Register Anomaly] [💾 Save] [➡️ Next Component]   │ │  │
│ │  └─────────────────────────────────────────────────────────┘ │  │
│ │                                                                │  │
│ │  AI Suggestion: LEG-A-002 (5m away, not inspected) [Select]  │  │
│ │                                                                │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. ROV Job Specifications

### 2.1 Pre-Inspection Setup
**Required Information:**
- ROV Serial Number
- ROV Operator Name
- ROV Supervisor Name
- Report Coordinator Name
- Deployment Number

**ROV Movement Logging:**
- ROV Deployed (timestamp)
- At Worksite (timestamp)
- Leaving Worksite (timestamp)
- ROV Recovered (timestamp)

**UI Component:** Similar to diving, small collapsible card

### 2.2 Video & Data Recording
- Similar video logging as Diving Job
- Additional sensor data capture (depth, heading, position)
- Continuous data logging from ROV telemetry

### 2.3 Differences from Diving Job
- ROV-specific metadata fields
- Different movement terminology
- Automated depth/position logging
- Extended battery/mission time tracking

---

## 3. Shared Features

### 3.1 Inspection Type Library
**Common Inspection Types:**
- General Visual Inspection (GVI)
- Close Visual Inspection (CVI)
- Flooded Member Detection (FMD)
- Cathodic Protection (CP)
- Ultrasonic Thickness Measurement (UTM)
- Marine Growth Thickness
- Anode Depletion Assessment
- Structural Damage Assessment

### 3.2 Anomaly/Defect Library Integration
**Library Tables:**
- `U_LIB_LIST` - Master library table
- `U_LIB_COMBO` - Related combo values

**Defect Categories:**
- Corrosion (General, Pitting, Crevice)
- Structural (Crack, Deformation, Damage)
- Coating (Breakdown, Blistering, Peeling)
- Mechanical (Loosening, Missing, Damage)

**Priority Levels:**
- Critical (P1)
- High (P2)
- Medium (P3)
- Low (P4)
- Observation (P5)

### 3.3 Component Management
**Smart Component Selection:**
- Last inspected component memory
- Nearest non-inspected component algorithm
- SOW filter
- Structure-based filtering
- Search by component ID/name/type

---

## 4. Data Model

### 4.1 Core Tables Structure

**Main Tables:**
1. `insp_dive_jobs` - Dive job master records
2. `insp_rov_jobs` - ROV job master records
3. `insp_dive_movements` - Dive movement logs
4. `insp_rov_movements` - ROV movement logs
5. `insp_video_logs` - Video recording logs
6. `insp_records` - Main inspection records (common for both methods)
7. `insp_anomalies` - Anomaly/defect records
8. `insp_media` - Media attachments (photos, videos)

### 4.2 Sequences
- `seq_dive_job_id`
- `seq_rov_job_id`
- `seq_inspection_id`
- `seq_anomaly_id`
- `seq_video_tape_id`
- `seq_media_id`

---

## 5. Technical Implementation Notes

### 5.1 JSON Data Structure
```json
{
  "inspno": "INSP-00001",
  "str_id": "STR-001",
  "comp_id": "COMP-LEG-A-001",
  "insp_id": "12345",
  "inspection_data": {
    "overall_condition": "GOOD",
    "marine_growth_percentage": 15,
    "corrosion_level": "MINOR",
    "coating_condition": "FAIR",
    "anode_condition": "GOOD",
    "remarks": "Minor marine growth observed on upper section"
  }
}
```

### 5.2 Live Video Integration
**Requirements:**
- WebRTC or RTSP stream support
- Snapshot capture (Canvas API)
- Video clip recording (MediaRecorder API)
- Upload to Supabase Storage
- Link media to inspection records

### 5.3 AI Component Suggestion Algorithm
```typescript
function suggestNextComponent(
  currentComponentId: string,
  structureId: string,
  sowComponents: string[],
  inspectedComponents: string[]
) {
  // 1. Filter by structure
  // 2. Filter by SOW inclusion
  // 3. Exclude already inspected
  // 4. Calculate distance from current component
  // 5. Sort by distance (ascending)
  // 6. Return top 5 suggestions
}
```

### 5.4 Migration Compatibility
- Store legacy keys in JSON field
- Support both old and new data formats
- Provide migration scripts
- Maintain backward compatibility

---

## 6. Security & Permissions

### 6.1 Access Control
- View inspections: All authenticated users
- Create inspections: Inspector role
- Modify inspections: Inspector (own) + Supervisor
- Delete inspections: Admin only
- Register anomalies: Inspector role
- Approve anomalies: Supervisor role

### 6.2 Audit Trail
- All inspection operations logged
- User tracking for all changes
- Timestamp tracking
- Change history for critical fields

---

## 7. Performance Considerations

### 7.1 Optimization
- Index on structure_id, component_id, inspection_date
- Composite index for filtering
- JSON field indexing for common queries
- Lazy loading for media content
- Pagination for large datasets

### 7.2 Real-time Features
- WebSocket for live video
- Auto-save every 30 seconds
- Optimistic UI updates
- Offline support consideration

---

## 8. Future Enhancements

### 8.1 Phase 2 Features
- 3D structure visualization
- Augmented reality overlay
- Voice-to-text for remarks
- Automated defect detection (AI/ML)
- Integration with underwater positioning systems
- Real-time collaboration (multiple inspectors)

### 8.2 Reporting
- Inspection summary reports
- Anomaly trend analysis
- Inspector performance metrics
- Component history reports
- Compliance reports

---

## 9. Testing Strategy

### 9.1 Unit Tests
- Component selection algorithm
- Data validation logic
- Anomaly registration
- Media upload handling

### 9.2 Integration Tests
- End-to-end inspection flow
- Video streaming integration
- Database operations
- API endpoints

### 9.3 User Acceptance Tests
- Inspector workflow
- Supervisor review process
- Report generation
- Media attachment workflow
