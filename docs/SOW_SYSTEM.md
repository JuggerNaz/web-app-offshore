# Scope of Work (SOW) System - Redesigned Structure

## Overview
The SOW system has been redesigned with a proper relational database structure to track component-inspection relationships for each structure in a job pack. This new design supports elevation breakup for inspections and provides better data integrity.

## Database Structure

### Table 1: `u_sow` (SOW Header)
Stores one record per structure in a job pack.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Sequential ID (primary key) |
| `jobpack_id` | UUID | Reference to job pack |
| `structure_id` | UUID | Reference to structure (platform/pipeline) |
| `structure_type` | VARCHAR(50) | 'PLATFORM' or 'PIPELINE' |
| `structure_title` | VARCHAR(255) | Structure name (denormalized) |
| `report_numbers` | JSONB | Array of report numbers |
| `metadata` | JSONB | Additional metadata |
| `total_items` | INTEGER | Total SOW items count |
| `completed_items` | INTEGER | Completed items count |
| `incomplete_items` | INTEGER | Incomplete items count |
| `pending_items` | INTEGER | Pending items count |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `created_by` | VARCHAR(255) | Creator user |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |
| `updated_by` | VARCHAR(255) | Last updater user |

**Unique Constraint:** `(jobpack_id, structure_id)`

### Table 2: `u_sow_items` (SOW Items)
Stores individual component-inspection combinations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Sequential ID (primary key) |
| `sow_id` | INTEGER | Reference to parent SOW (foreign key) |
| `component_id` | UUID | From `structure_components` table |
| `inspection_type_id` | UUID | From `u_lib_list` table |
| `component_qid` | VARCHAR(255) | Component QID (denormalized) |
| `component_type` | VARCHAR(100) | Component type (denormalized) |
| `inspection_code` | VARCHAR(50) | Inspection code (denormalized) |
| `inspection_name` | VARCHAR(255) | Inspection name (denormalized) |
| `elevation_required` | BOOLEAN | If true, needs elevation breakup |
| `elevation_data` | JSONB | Array of elevation-specific data |
| `status` | VARCHAR(20) | 'pending', 'completed', or 'incomplete' |
| `inspection_count` | INTEGER | Number of inspections performed |
| `last_inspection_date` | TIMESTAMPTZ | Last inspection date |
| `notes` | TEXT | Additional notes |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `created_by` | VARCHAR(255) | Creator user |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |
| `updated_by` | VARCHAR(255) | Last updater user |

**Unique Constraint:** `(sow_id, component_id, inspection_type_id)`
**Check Constraint:** `status IN ('pending', 'completed', 'incomplete')`

## Data Structures

### Report Numbers (JSONB)
```json
[
  {
    "number": "RPT-2024-001",
    "contractor_ref": "CNT-ABC-123",
    "date": "2024-01-15",
    "notes": "Phase 1 inspection"
  },
  {
    "number": "RPT-2024-002",
    "contractor_ref": "CNT-ABC-124",
    "date": "2024-02-01"
  }
]
```

### Elevation Data (JSONB)
```json
[
  {
    "elevation": "EL +10.5",
    "status": "completed",
    "inspection_count": 3,
    "last_inspection_date": "2024-01-15T10:30:00Z",
    "notes": "All inspections completed successfully"
  },
  {
    "elevation": "EL +5.0",
    "status": "in_progress",
    "inspection_count": 1,
    "last_inspection_date": "2024-01-10T14:20:00Z"
  },
  {
    "elevation": "EL 0.0",
    "status": "pending",
    "inspection_count": 0
  }
]
```

## Key Features

### 1. Sequential IDs
- Both tables use `SERIAL` for auto-incrementing integer IDs
- Easier to reference and more efficient than UUIDs for internal relationships

### 2. Denormalized Data
- Component QID, type, inspection code, and name are stored in `u_sow_items`
- Improves query performance by avoiding joins
- Data is copied from source tables when SOW items are created

### 3. Elevation Breakup Support
- `elevation_required` flag indicates if component needs elevation-specific tracking
- `elevation_data` JSONB array stores status for each elevation level
- Each elevation can have its own status, count, and last inspection date

### 4. Automatic Count Updates
- Trigger function `update_sow_counts()` automatically updates header counts
- Runs on INSERT, UPDATE, or DELETE of SOW items
- Keeps `total_items`, `completed_items`, `incomplete_items`, `pending_items` in sync

### 5. Cascade Deletion
- Deleting a SOW header automatically deletes all related SOW items
- Maintains referential integrity

## Usage Examples

### Create SOW Header
```sql
INSERT INTO u_sow (
  jobpack_id,
  structure_id,
  structure_type,
  structure_title,
  report_numbers
) VALUES (
  'jobpack-uuid',
  'structure-uuid',
  'PLATFORM',
  'PLAT-A',
  '[{"number": "RPT-001", "contractor_ref": "CNT-123"}]'::jsonb
) RETURNING id;
```

### Add SOW Item
```sql
INSERT INTO u_sow_items (
  sow_id,
  component_id,
  inspection_type_id,
  component_qid,
  component_type,
  inspection_code,
  inspection_name,
  elevation_required,
  status
) VALUES (
  1,  -- sow_id from previous insert
  'component-uuid',
  'inspection-type-uuid',
  'LEG-A1',
  'LEG',
  'CVINS',
  'CP Calibration',
  false,
  'pending'
);
```

### Add SOW Item with Elevation Breakup
```sql
INSERT INTO u_sow_items (
  sow_id,
  component_id,
  inspection_type_id,
  component_qid,
  component_type,
  inspection_code,
  inspection_name,
  elevation_required,
  elevation_data,
  status
) VALUES (
  1,
  'component-uuid',
  'inspection-type-uuid',
  'LEG-A1',
  'LEG',
  'GVINS',
  'General Visual Inspection',
  true,
  '[
    {"elevation": "EL +10.5", "status": "pending", "inspection_count": 0},
    {"elevation": "EL +5.0", "status": "pending", "inspection_count": 0},
    {"elevation": "EL 0.0", "status": "pending", "inspection_count": 0}
  ]'::jsonb,
  'pending'
);
```

### Query SOW with Items
```sql
SELECT 
  s.*,
  json_agg(
    json_build_object(
      'id', si.id,
      'component_qid', si.component_qid,
      'component_type', si.component_type,
      'inspection_code', si.inspection_code,
      'inspection_name', si.inspection_name,
      'status', si.status,
      'elevation_required', si.elevation_required,
      'elevation_data', si.elevation_data,
      'inspection_count', si.inspection_count
    )
  ) as items
FROM u_sow s
LEFT JOIN u_sow_items si ON si.sow_id = s.id
WHERE s.jobpack_id = 'jobpack-uuid'
  AND s.structure_id = 'structure-uuid'
GROUP BY s.id;
```

### Update Item Status
```sql
UPDATE u_sow_items
SET 
  status = 'completed',
  inspection_count = inspection_count + 1,
  last_inspection_date = NOW(),
  updated_at = NOW()
WHERE id = 123;

-- Counts in u_sow will be automatically updated by trigger
```

### Update Elevation Status
```sql
UPDATE u_sow_items
SET 
  elevation_data = jsonb_set(
    elevation_data,
    '{0,status}',  -- Update first elevation's status
    '"completed"'
  ),
  elevation_data = jsonb_set(
    elevation_data,
    '{0,inspection_count}',
    to_jsonb((elevation_data->0->>'inspection_count')::int + 1)
  ),
  elevation_data = jsonb_set(
    elevation_data,
    '{0,last_inspection_date}',
    to_jsonb(NOW()::text)
  ),
  updated_at = NOW()
WHERE id = 123;
```

## Status Workflow

### Status Types
1. **pending**: Not started, no inspections performed
2. **completed**: All required inspections completed successfully
3. **incomplete**: Inspections started but not completed or have issues

### Status Transitions
```
pending → completed (all inspections done)
pending → incomplete (issues found)
incomplete → completed (issues resolved)
completed → incomplete (re-inspection needed)
```

### Elevation Status Logic
- If `elevation_required = true`, overall status depends on all elevations
- Overall status is `completed` only if ALL elevations are `completed`
- Overall status is `incomplete` if ANY elevation is `incomplete`
- Overall status is `pending` if all elevations are `pending`

## Integration Points

### 1. Job Pack Table
- `u_sow.jobpack_id` references job pack
- Fetch job pack details for SOW context

### 2. Structure Tables
- `u_sow.structure_id` references platform/pipeline
- Fetch structure title and metadata

### 3. Structure Components Table
- `u_sow_items.component_id` references components
- Fetch component QID, type, and details

### 4. Inspection Types Library
- `u_sow_items.inspection_type_id` references `u_lib_list`
- Fetch inspection code, name, and metadata

### 5. Inspection Data (Future)
- Link actual inspection records to SOW items
- Auto-update status based on inspection completion
- Prevent deletion of inspection types with existing data

## Migration Path

### From Old Structure (if applicable)
```sql
-- If migrating from old JSONB matrix structure
-- 1. Create new tables
-- 2. Extract data from old sow_matrix JSONB
-- 3. Insert into new u_sow and u_sow_items tables
-- 4. Verify data integrity
-- 5. Drop old structure
```

## Performance Considerations

1. **Indexes**: Created on all foreign keys and frequently queried columns
2. **Denormalization**: Component and inspection data copied to avoid joins
3. **Trigger Efficiency**: Count updates use simple aggregations
4. **JSONB**: Used only for flexible data (elevations, report numbers)

## Future Enhancements

1. **Inspection Data Integration**
   - Link to actual inspection records
   - Auto-update status from inspection data
   - Calculate completion percentage

2. **Validation Rules**
   - Require minimum inspections per component
   - Validate elevation data format
   - Check for duplicate elevations

3. **Reporting**
   - Generate SOW reports
   - Export to PDF/Excel
   - Progress tracking dashboards

4. **Audit Trail**
   - Track all status changes
   - Record who changed what and when
   - Maintain history of modifications
