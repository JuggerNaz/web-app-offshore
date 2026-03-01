# Inspection Module API Routes Documentation

## Overview
This document outlines the API route structure for the Inspection Module.

---

## Base Path
All inspection module routes should be under:
```
/api/inspection
```

---

## 1. Dive Job Routes

### 1.1 Create Dive Job
**POST** `/api/inspection/dive-jobs`

**Request Body:**
```json
{
  "dive_no": "DIVE-2026-001",
  "structure_id": 1,
  "jobpack_id": 5,
  "sow_report_no": "SOW-2026-001",
  "diver_name": "John Doe",
  "dive_supervisor": "Mike Smith",
  "report_coordinator": "Sarah Johnson",
  "dive_date": "2026-02-11",
  "start_time": "09:00:00"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dive_job_id": 1,
    "dive_no": "DIVE-2026-001",
    ...
  }
}
```

### 1.2 Get Dive Jobs
**GET** `/api/inspection/dive-jobs?structure_id=1&status=IN_PROGRESS`

**Query Parameters:**
- `structure_id` (optional)
- `jobpack_id` (optional)
- `status` (optional)
- `page` (optional, default: 1)
- `pageSize` (optional, default: 20)

### 1.3 Get Dive Job by ID
**GET** `/api/inspection/dive-jobs/[id]`

### 1.4 Update Dive Job
**PATCH** `/api/inspection/dive-jobs/[id]`

### 1.5 Complete Dive Job
**POST** `/api/inspection/dive-jobs/[id]/complete`

---

## 2. Dive Movement Routes

### 2.1 Log Dive Movement
**POST** `/api/inspection/dive-movements`

**Request Body:**
```json
{
  "dive_job_id": 1,
  "movement_type": "AT_WORKSITE",
  "depth_meters": 25.5,
  "remarks": "Arrived at platform leg A"
}
```

### 2.2 Get Dive Movements
**GET** `/api/inspection/dive-movements?dive_job_id=1`

### 2.3 Get Latest Dive Movement
**GET** `/api/inspection/dive-movements/latest?dive_job_id=1`

---

## 3. ROV Job Routes

### 3.1 Create ROV Job
**POST** `/api/inspection/rov-jobs`

**Request Body:**
```json
{
  "deployment_no": "ROV-2026-001",
  "structure_id": 1,
  "jobpack_id": 5,
  "sow_report_no": "SOW-2026-001",
  "rov_serial_no": "ROV-SN-12345",
  "rov_operator": "Jane Operator",
  "rov_supervisor": "Tom Supervisor",
  "report_coordinator": "Sarah Johnson",
  "deployment_date": "2026-02-11",
  "start_time": "10:00:00"
}
```

### 3.2 Get ROV Jobs
**GET** `/api/inspection/rov-jobs?structure_id=1&status=IN_PROGRESS`

### 3.3 Get ROV Job by ID
**GET** `/api/inspection/rov-jobs/[id]`

### 3.4 Update ROV Job
**PATCH** `/api/inspection/rov-jobs/[id]`

### 3.5 Complete ROV Job
**POST** `/api/inspection/rov-jobs/[id]/complete`

---

## 4. ROV Movement Routes

### 4.1 Log ROV Movement
**POST** `/api/inspection/rov-movements`

**Request Body:**
```json
{
  "rov_job_id": 1,
  "movement_type": "AT_WORKSITE",
  "depth_meters": 30.2,
  "latitude": 4.5678,
  "longitude": 103.1234,
  "heading_degrees": 45.5,
  "telemetry_data": {
    "battery_level": 85,
    "temperature": 22.5
  },
  "remarks": "Positioned at component LEG-A-001"
}
```

### 4.2 Get ROV Movements
**GET** `/api/inspection/rov-movements?rov_job_id=1`

### 4.3 Get Latest ROV Movement
**GET** `/api/inspection/rov-movements/latest?rov_job_id=1`

---

## 5. Video Recording Routes

### 5.1 Create Video Tape
**POST** `/api/inspection/video-tapes`

**Request Body:**
```json
{
  "tape_no": "TAPE-2026-001",
  "dive_job_id": 1,
  "tape_type": "DIGITAL"
}
```

### 5.2 Get Video Tapes
**GET** `/api/inspection/video-tapes?dive_job_id=1`

### 5.3 Log Video Event
**POST** `/api/inspection/video-logs`

**Request Body:**
```json
{
  "tape_id": 1,
  "event_type": "PRE_INSPECTION",
  "timecode_start": "00:10:30",
  "inspection_id": 5,
  "remarks": "Starting GVI inspection of LEG-A-001"
}
```

### 5.4 Get Video Logs
**GET** `/api/inspection/video-logs?tape_id=1`

### 5.5 Get Latest Video Log
**GET** `/api/inspection/video-logs/latest?tape_id=1`

---

## 6. Inspection Record Routes

### 6.1 Create Inspection
**POST** `/api/inspection/records`

**Request Body:**
```json
{
  "dive_job_id": 1,
  "structure_id": 1,
  "component_id": 25,
  "component_type": "PRIMARY_LEG",
  "jobpack_id": 5,
  "sow_report_no": "SOW-2026-001",
  "inspection_type_code": "GVI",
  "inspection_date": "2026-02-11",
  "inspection_time": "10:30:00",
  "tape_id": 1,
  "elevation": 25.5,
  "inspection_data": {
    "overall_condition": "GOOD",
    "marine_growth_percentage": 15,
    "corrosion_level": "MINOR",
    "coating_condition": "FAIR",
    "anode_condition": "GOOD",
    "remarks": "Minor marine growth observed"
  }
}
```

### 6.2 Get Inspections
**GET** `/api/inspection/records?structure_id=1&component_id=25`

**Query Parameters:**
- `structure_id` (optional)
- `component_id` (optional)
- `jobpack_id` (optional)
- `dive_job_id` (optional)
- `rov_job_id` (optional)
- `inspection_type_code` (optional)
- `has_anomaly` (optional)
- `status` (optional)
- `date_from` (optional)
- `date_to` (optional)
- `page` (optional)
- `pageSize` (optional)

### 6.3 Get Inspection by ID
**GET** `/api/inspection/records/[id]`

### 6.4 Update Inspection
**PATCH** `/api/inspection/records/[id]`

**Request Body:**
```json
{
  "inspection_data": {
    "overall_condition": "FAIR",
    "marine_growth_percentage": 20,
    "remarks": "Updated: Increased marine growth"
  },
  "status": "COMPLETED"
}
```

### 6.5 Auto-save Inspection (Draft)
**POST** `/api/inspection/records/[id]/autosave`

**Request Body:**
```json
{
  "inspection_data": {
    "overall_condition": "GOOD",
    "marine_growth_percentage": 15
  }
}
```

### 6.6 Complete Inspection
**POST** `/api/inspection/records/[id]/complete`

### 6.7 Review Inspection
**POST** `/api/inspection/records/[id]/review`

**Request Body:**
```json
{
  "reviewed_by": "supervisor@example.com",
  "status": "REVIEWED"
}
```

### 6.8 Approve Inspection
**POST** `/api/inspection/records/[id]/approve`

**Request Body:**
```json
{
  "approved_by": "manager@example.com",
  "status": "APPROVED"
}
```

---

## 7. Anomaly Routes

### 7.1 Create Anomaly
**POST** `/api/inspection/anomalies`

**Request Body:**
```json
{
  "inspection_id": 5,
  "defect_type_code": "COR-PIT",
  "priority_code": "P2",
  "defect_category_code": "CORROSION",
  "defect_description": "Pitting corrosion observed on lower section of leg",
  "severity": "MODERATE",
  "recommended_action": "Repair and recoat affected area",
  "action_priority": "HIGH",
  "action_deadline": "2026-03-31",
  "follow_up_required": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "anomaly_id": 1,
    "anomaly_ref_no": "ANO-00000001",
    ...
  }
}
```

### 7.2 Get Anomalies
**GET** `/api/inspection/anomalies?inspection_id=5&status=OPEN`

**Query Parameters:**
- `inspection_id` (optional)
- `structure_id` (optional)
- `priority_code` (optional)
- `status` (optional)
- `severity` (optional)
- `defect_category_code` (optional)
- `page` (optional)
- `pageSize` (optional)

### 7.3 Get Anomaly by ID
**GET** `/api/inspection/anomalies/[id]`

### 7.4 Update Anomaly
**PATCH** `/api/inspection/anomalies/[id]`

### 7.5 Review Anomaly
**POST** `/api/inspection/anomalies/[id]/review`

### 7.6 Approve Anomaly
**POST** `/api/inspection/anomalies/[id]/approve`

### 7.7 Close Anomaly
**POST** `/api/inspection/anomalies/[id]/close`

---

## 8. Media Routes

### 8.1 Upload Media (Snapshot)
**POST** `/api/inspection/media/snapshot`

**Request (Multipart Form Data):**
- `file`: Image file
- `inspection_id`: number
- `anomaly_id`: number (optional)
- `description`: string (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "media_id": 1,
    "file_path": "inspections/2026/02/snapshot_123.jpg",
    "thumbnail_path": "inspections/2026/02/thumb_snapshot_123.jpg"
  }
}
```

### 8.2 Upload Media (Video Clip)
**POST** `/api/inspection/media/video-clip`

**Request (Multipart Form Data):**
- `file`: Video file
- `inspection_id`: number
- `anomaly_id`: number (optional)
- `description`: string (optional)

### 8.3 Upload Media (General)
**POST** `/api/inspection/media/upload`

**Request (Multipart Form Data):**
- `file`: File
- `media_type`: PHOTO | VIDEO | DOCUMENT
- `inspection_id`: number (optional)
- `anomaly_id`: number (optional)
- `source`: UPLOAD
- `description`: string (optional)

### 8.4 Get Media
**GET** `/api/inspection/media?inspection_id=5`

**Query Parameters:**
- `inspection_id` (optional)
- `anomaly_id` (optional)
- `media_type` (optional)

### 8.5 Delete Media
**DELETE** `/api/inspection/media/[id]`

---

## 9. Component Selection & AI Suggestion Routes

### 9.1 Get Component Suggestions
**POST** `/api/inspection/components/suggest`

**Request Body:**
```json
{
  "structure_id": 1,
  "jobpack_id": 5,
  "current_component_id": 25,
  "sow_only": true,
  "not_inspected_only": true
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "component_id": 26,
      "comp_name": "LEG-A-002",
      "comp_type": "PRIMARY_LEG",
      "distance_meters": 5.2,
      "is_inspected": false,
      "in_sow": true,
      "priority_score": 95
    },
    ...
  ]
}
```

### 9.2 Search Components
**GET** `/api/inspection/components/search?structure_id=1&q=LEG`

**Query Parameters:**
- `structure_id`: number (required)
- `q`: string (search term)
- `jobpack_id` (optional)
- `sow_only` (optional)
- `not_inspected_only` (optional)

### 9.3 Get Component Specifications
**GET** `/api/inspection/components/[id]/spec`

---

## 10. Live Video Routes

### 10.1 Connect to Live Video
**POST** `/api/inspection/live-video/connect`

**Request Body:**
```json
{
  "camera_id": "camera-1",
  "camera_name": "Underwater Camera 1"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "stream_url": "rtsp://...",
    "status": "connected"
  }
}
```

### 10.2 Disconnect Live Video
**POST** `/api/inspection/live-video/disconnect`

### 10.3 Get Live Video Status
**GET** `/api/inspection/live-video/status`

---

## 11. Library Integration Routes

### 11.1 Get Defect Types
**GET** `/api/inspection/library/defect-types`

### 11.2 Get Priorities
**GET** `/api/inspection/library/priorities`

### 11.3 Get Defect Categories
**GET** `/api/inspection/library/defect-categories`

### 11.4 Get Inspection Type Configurations
**GET** `/api/inspection/library/inspection-types`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "code": "GVI",
      "name": "General Visual Inspection",
      "description": "Overall visual assessment of component condition",
      "fields": [
        {
          "field_name": "overall_condition",
          "display_label": "Overall Condition",
          "field_type": "select",
          "required": true,
          "options": ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"]
        },
        ...
      ],
      "requires_video": true,
      "requires_photos": true
    }
  ]
}
```

---

## 12. Reporting Routes

### 12.1 Generate Inspection Report
**POST** `/api/inspection/reports/inspection`

**Request Body:**
```json
{
  "inspection_id": 5,
  "format": "PDF"
}
```

### 12.2 Generate Anomaly Report
**POST** `/api/inspection/reports/anomalies`

**Request Body:**
```json
{
  "structure_id": 1,
  "date_from": "2026-01-01",
  "date_to": "2026-02-28",
  "priority_codes": ["P1", "P2"],
  "format": "PDF"
}
```

### 12.3 Generate Dive Job Summary
**POST** `/api/inspection/reports/dive-job-summary`

**Request Body:**
```json
{
  "dive_job_id": 1,
  "include_inspections": true,
  "include_anomalies": true,
  "format": "PDF"
}
```

---

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Error type or code",
  "message": "Human-readable error message"
}
```

**Common HTTP Status Codes:**
- `200 OK` - Success
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate)
- `422 Unprocessable Entity` - Validation error
- `500 Internal Server Error` - Server error

---

## Authentication & Authorization

All API routes require authentication. Include the authentication token in the request headers:

```
Authorization: Bearer <token>
```

Role-based permissions:
- **Inspector**: Create/update own inspections, register anomalies
- **Supervisor**: Review inspections, approve anomalies
- **Admin**: Full access to all operations
- **Viewer**: Read-only access

---

## Rate Limiting

- Rate limit: 100 requests per minute per user
- Exceeding the limit returns `429 Too Many Requests`

---

## Pagination

For paginated endpoints, use the following query parameters:
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 20, max: 100)

Response includes pagination metadata:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 150,
    "page": 1,
    "pageSize": 20,
    "totalPages": 8
  }
}
```

---

## WebSocket Events (Real-time)

For real-time updates (auto-save, live collaboration):

**Connection:**
```javascript
const socket = io('/inspection');
```

**Events:**
- `inspection:updated` - Inspection record updated
- `anomaly:created` - New anomaly registered
- `dive:movement` - Dive movement logged
- `video:event` - Video log event
- `media:uploaded` - Media uploaded

---

## Notes

1. All timestamps are in ISO 8601 format
2. All dates are in `YYYY-MM-DD` format
3. All times are in `HH:MM:SS` format
4. File uploads have a maximum size of 100MB per file
5. Video clips from live streams are limited to 30 seconds
6. Auto-save triggers every 30 seconds during active inspection
