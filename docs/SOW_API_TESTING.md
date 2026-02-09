# SOW API Testing Guide

## Test the API endpoints using curl or your browser's fetch console

### 1. Test SOW Header API

#### Create a new SOW
```bash
curl -X POST http://localhost:3000/api/sow \
  -H "Content-Type: application/json" \
  -d '{
    "jobpack_id": 1,
    "structure_id": 1,
    "structure_type": "PLATFORM",
    "structure_title": "PLAT-A",
    "report_numbers": [
      {
        "number": "RPT-2024-001",
        "contractor_ref": "CNT-ABC-123",
        "date": "2024-01-15"
      }
    ]
  }'
```

#### Get SOW by jobpack and structure
```bash
curl "http://localhost:3000/api/sow?jobpack_id=1&structure_id=1"
```

#### Get SOW by ID
```bash
curl "http://localhost:3000/api/sow?sow_id=1"
```

#### Update SOW
```bash
curl -X POST http://localhost:3000/api/sow \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "report_numbers": [
      {
        "number": "RPT-2024-001",
        "contractor_ref": "CNT-ABC-123",
        "date": "2024-01-15"
      },
      {
        "number": "RPT-2024-002",
        "contractor_ref": "CNT-ABC-124",
        "date": "2024-02-01"
      }
    ]
  }'
```

#### Delete SOW
```bash
curl -X DELETE "http://localhost:3000/api/sow?id=1"
```

### 2. Test SOW Items API

#### Create a new SOW item
```bash
curl -X POST http://localhost:3000/api/sow/items \
  -H "Content-Type: application/json" \
  -d '{
    "sow_id": 1,
    "component_id": 100,
    "inspection_type_id": 200,
    "component_qid": "LEG-A1",
    "component_type": "LEG",
    "inspection_code": "GVINS",
    "inspection_name": "General Visual Inspection",
    "elevation_required": false,
    "status": "pending"
  }'
```

#### Create SOW item with elevation breakup
```bash
curl -X POST http://localhost:3000/api/sow/items \
  -H "Content-Type: application/json" \
  -d '{
    "sow_id": 1,
    "component_id": 101,
    "inspection_type_id": 200,
    "component_qid": "LEG-A2",
    "component_type": "LEG",
    "inspection_code": "GVINS",
    "inspection_name": "General Visual Inspection",
    "elevation_required": true,
    "elevation_data": [
      {
        "elevation": "EL +10.5",
        "status": "pending",
        "inspection_count": 0
      },
      {
        "elevation": "EL +5.0",
        "status": "pending",
        "inspection_count": 0
      },
      {
        "elevation": "EL 0.0",
        "status": "pending",
        "inspection_count": 0
      }
    ],
    "status": "pending"
  }'
```

#### Get all items for a SOW
```bash
curl "http://localhost:3000/api/sow/items?sow_id=1"
```

#### Get specific item
```bash
curl "http://localhost:3000/api/sow/items?id=1"
```

#### Update item status
```bash
curl -X POST http://localhost:3000/api/sow/items \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "status": "completed",
    "notes": "All inspections completed successfully"
  }'
```

#### Update elevation status
```bash
curl -X POST http://localhost:3000/api/sow/items \
  -H "Content-Type: application/json" \
  -d '{
    "id": 2,
    "elevation_data": [
      {
        "elevation": "EL +10.5",
        "status": "completed",
        "inspection_count": 3,
        "last_inspection_date": "2024-01-15T10:30:00Z"
      },
      {
        "elevation": "EL +5.0",
        "status": "pending",
        "inspection_count": 0
      },
      {
        "elevation": "EL 0.0",
        "status": "pending",
        "inspection_count": 0
      }
    ]
  }'
```

#### Bulk update items
```bash
curl -X PUT http://localhost:3000/api/sow/items \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "id": 1,
        "status": "completed"
      },
      {
        "id": 2,
        "status": "incomplete",
        "notes": "Issues found during inspection"
      }
    ]
  }'
```

#### Delete item
```bash
curl -X DELETE "http://localhost:3000/api/sow/items?id=1"
```

## Browser Console Testing

Open your browser console (F12) and run these commands:

### Create SOW
```javascript
const createSOW = async () => {
  const response = await fetch('/api/sow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobpack_id: 1,
      structure_id: 1,
      structure_type: 'PLATFORM',
      structure_title: 'PLAT-A',
      report_numbers: [
        { number: 'RPT-2024-001', contractor_ref: 'CNT-ABC-123', date: '2024-01-15' }
      ]
    })
  });
  const data = await response.json();
  console.log('Created SOW:', data);
  return data;
};

await createSOW();
```

### Get SOW
```javascript
const getSOW = async (jobpackId, structureId) => {
  const response = await fetch(`/api/sow?jobpack_id=${jobpackId}&structure_id=${structureId}`);
  const data = await response.json();
  console.log('SOW Data:', data);
  return data;
};

await getSOW(1, 1);
```

### Create SOW Item
```javascript
const createSOWItem = async (sowId) => {
  const response = await fetch('/api/sow/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sow_id: sowId,
      component_id: 100,
      inspection_type_id: 200,
      component_qid: 'LEG-A1',
      component_type: 'LEG',
      inspection_code: 'GVINS',
      inspection_name: 'General Visual Inspection',
      status: 'pending'
    })
  });
  const data = await response.json();
  console.log('Created SOW Item:', data);
  return data;
};

await createSOWItem(1);
```

### Update Item Status
```javascript
const updateItemStatus = async (itemId, status) => {
  const response = await fetch('/api/sow/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: itemId,
      status: status
    })
  });
  const data = await response.json();
  console.log('Updated Item:', data);
  return data;
};

await updateItemStatus(1, 'completed');
```

## Expected Responses

### Successful SOW Creation
```json
{
  "data": {
    "id": 1,
    "jobpack_id": 1,
    "structure_id": 1,
    "structure_type": "PLATFORM",
    "structure_title": "PLAT-A",
    "report_numbers": [...],
    "total_items": 0,
    "completed_items": 0,
    "incomplete_items": 0,
    "pending_items": 0,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### Successful Item Creation
```json
{
  "data": {
    "id": 1,
    "sow_id": 1,
    "component_id": 100,
    "inspection_type_id": 200,
    "component_qid": "LEG-A1",
    "component_type": "LEG",
    "inspection_code": "GVINS",
    "inspection_name": "General Visual Inspection",
    "elevation_required": false,
    "elevation_data": [],
    "status": "pending",
    "inspection_count": 0,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### Error Response
```json
{
  "error": "Error message here"
}
```

## Verification Queries

Run these in your database to verify the data:

```sql
-- Check SOW records
SELECT * FROM u_sow ORDER BY id DESC LIMIT 10;

-- Check SOW items
SELECT * FROM u_sow_items ORDER BY id DESC LIMIT 10;

-- Check counts are updating correctly
SELECT 
  s.*,
  (SELECT COUNT(*) FROM u_sow_items WHERE sow_id = s.id) as actual_total,
  (SELECT COUNT(*) FROM u_sow_items WHERE sow_id = s.id AND status = 'completed') as actual_completed
FROM u_sow s;

-- Check trigger is working
UPDATE u_sow_items SET status = 'completed' WHERE id = 1;
SELECT * FROM u_sow WHERE id = 1; -- Check if counts updated
```

## Testing Checklist

- [ ] Create SOW header
- [ ] Get SOW by jobpack and structure
- [ ] Get SOW by ID
- [ ] Update SOW (report numbers)
- [ ] Create SOW item
- [ ] Create SOW item with elevation breakup
- [ ] Get all items for SOW
- [ ] Get specific item
- [ ] Update item status
- [ ] Update elevation data
- [ ] Bulk update items
- [ ] Delete item (verify counts update)
- [ ] Delete SOW (verify cascade deletion)
- [ ] Verify trigger updates counts
- [ ] Test with non-existent IDs
- [ ] Test with invalid data
