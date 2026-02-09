# SOW System - Implementation Guide

## ✅ Completed Steps

### 1. Database Setup
- ✅ Created sequences: `u_sow_id_seq`, `u_sow_items_id_seq`
- ✅ Created table: `u_sow` (SOW header)
- ✅ Created table: `u_sow_items` (SOW items)
- ✅ Added indexes for performance
- ✅ Set up Row Level Security (RLS)
- ✅ Created trigger for automatic count updates

### 2. TypeScript Types
- ✅ Defined all interfaces in `types/sow.ts`
- ✅ Updated to use BIGINT (number) for foreign keys

### 3. API Routes
- ✅ Created `/api/sow` - SOW header operations
- ✅ Created `/api/sow/items` - SOW items operations

## 📋 Next Steps

### Step 1: Create SOW Dialog Component

Create a new file: `components/jobpack/sow-dialog.tsx`

This component will:
- Display a modal dialog for managing SOW
- Show structure information
- Allow adding/removing report numbers
- Display a matrix of components × inspection types
- Support elevation breakup for selected items
- Show statistics (total, completed, incomplete, pending)
- Save SOW data via API

**Key Features:**
1. **Report Number Management**
   - Add multiple report numbers
   - Include contractor references
   - Date tracking

2. **Component-Inspection Matrix**
   - Rows: Components from `structure_components` table
   - Columns: Inspection types from job pack metadata
   - Checkboxes to select/deselect combinations
   - Color-coded status indicators

3. **Elevation Breakup**
   - Toggle elevation requirement per item
   - Add multiple elevation levels
   - Track status per elevation

4. **Status Management**
   - Pending (gray)
   - Completed (green)
   - Incomplete (red)

### Step 2: Integrate SOW Button in Job Pack Page

Add to `app/dashboard/jobpack/[id]/page.tsx`:

```tsx
// Add state
const [sowDialogOpen, setSOWDialogOpen] = useState(false);
const [sowStructure, setSOWStructure] = useState<any>(null);

// Add button in header (next to Finalize & Release)
{!isNew && selectedStructures.length > 0 && (
  <Button
    type="button"
    variant="outline"
    onClick={() => {
      if (activeStructKey) {
        const activeStruct = selectedStructures.find(
          (s) => `${s.type}-${s.id}` === activeStructKey
        );
        if (activeStruct) {
          setSOWStructure(activeStruct);
          setSOWDialogOpen(true);
        }
      } else {
        toast.error("Please select a structure first");
      }
    }}
  >
    <FileText className="h-4 w-4" />
    SOW
  </Button>
)}

// Add dialog at end of component
{sowStructure && sowDialogOpen && (
  <SOWDialog
    open={sowDialogOpen}
    onOpenChange={setSOWDialogOpen}
    jobpackId={Number(id)}
    structure={sowStructure}
    inspectionTypes={inspectionsByStruct[`${sowStructure.type}-${sowStructure.id}`] || []}
    onSave={() => {
      // Refresh data if needed
      setSOWDialogOpen(false);
    }}
  />
)}
```

### Step 3: Fetch Components for Structure

You'll need to fetch components from the `structure_components` table:

```tsx
// In SOW Dialog component
const { data: components } = useSWR(
  structureId ? `/api/components?structure_id=${structureId}` : null,
  fetcher
);
```

Create API route: `app/api/components/route.ts`

```tsx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const structureId = searchParams.get("structure_id");
  
  const { data, error } = await supabase
    .from("structure_components")
    .select("id, qid, type")
    .eq("structure_id", structureId)
    .order("qid");
    
  return NextResponse.json({ data });
}
```

### Step 4: Create SOW Data Flow

**When opening SOW Dialog:**
1. Fetch existing SOW: `GET /api/sow?jobpack_id=X&structure_id=Y`
2. If exists, load SOW header and items
3. If not exists, create new SOW on first save

**When saving SOW:**
1. Create/update SOW header: `POST /api/sow`
2. For each selected component-inspection combination:
   - Create SOW item: `POST /api/sow/items`
3. For deselected items:
   - Delete SOW item: `DELETE /api/sow/items?id=X`

**When updating status:**
1. Update item: `POST /api/sow/items` with new status
2. Trigger will automatically update counts in header

### Step 5: Add Elevation Breakup UI

For items with `elevation_required = true`:

```tsx
{item.elevation_required && (
  <div className="ml-4 mt-2">
    {item.elevation_data.map((elev, idx) => (
      <div key={idx} className="flex items-center gap-2">
        <input
          type="text"
          value={elev.elevation}
          placeholder="e.g., EL +10.5"
          className="input"
        />
        <select
          value={elev.status}
          onChange={(e) => updateElevationStatus(item.id, idx, e.target.value)}
        >
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="incomplete">Incomplete</option>
        </select>
      </div>
    ))}
    <button onClick={() => addElevation(item.id)}>
      + Add Elevation
    </button>
  </div>
)}
```

### Step 6: Display Statistics

Show real-time counts from SOW header:

```tsx
<div className="stats">
  <div className="stat">
    <div className="stat-title">Total Items</div>
    <div className="stat-value">{sow?.total_items || 0}</div>
  </div>
  <div className="stat">
    <div className="stat-title">Completed</div>
    <div className="stat-value text-green-600">{sow?.completed_items || 0}</div>
  </div>
  <div className="stat">
    <div className="stat-title">Incomplete</div>
    <div className="stat-value text-red-600">{sow?.incomplete_items || 0}</div>
  </div>
  <div className="stat">
    <div className="stat-title">Pending</div>
    <div className="stat-value text-gray-600">{sow?.pending_items || 0}</div>
  </div>
</div>
```

## 🔄 Data Flow Example

### Creating a New SOW

```typescript
// 1. Create SOW header
const sowResponse = await fetch('/api/sow', {
  method: 'POST',
  body: JSON.stringify({
    jobpack_id: 123,
    structure_id: 456,
    structure_type: 'PLATFORM',
    structure_title: 'PLAT-A',
    report_numbers: [
      { number: 'RPT-001', contractor_ref: 'CNT-123', date: '2024-01-01' }
    ]
  })
});
const { data: sow } = await sowResponse.json();

// 2. Create SOW items for selected component-inspection combinations
for (const selection of selectedItems) {
  await fetch('/api/sow/items', {
    method: 'POST',
    body: JSON.stringify({
      sow_id: sow.id,
      component_id: selection.component_id,
      inspection_type_id: selection.inspection_type_id,
      component_qid: selection.component_qid,
      component_type: selection.component_type,
      inspection_code: selection.inspection_code,
      inspection_name: selection.inspection_name,
      elevation_required: selection.elevation_required,
      elevation_data: selection.elevation_data,
      status: 'pending'
    })
  });
}
```

### Updating Item Status

```typescript
await fetch('/api/sow/items', {
  method: 'POST',
  body: JSON.stringify({
    id: itemId,
    status: 'completed',
    notes: 'All inspections completed successfully'
  })
});

// Trigger will automatically update counts in u_sow table
```

### Updating Elevation Status

```typescript
const updatedElevationData = item.elevation_data.map((elev, idx) => 
  idx === elevationIndex 
    ? { ...elev, status: 'completed', inspection_count: elev.inspection_count + 1 }
    : elev
);

await fetch('/api/sow/items', {
  method: 'POST',
  body: JSON.stringify({
    id: itemId,
    elevation_data: updatedElevationData
  })
});
```

## 🎨 UI Design Recommendations

### Matrix Layout
```
┌─────────────┬──────────┬──────────┬──────────┐
│ Component   │ GVINS    │ CVINS    │ CPINS    │
├─────────────┼──────────┼──────────┼──────────┤
│ LEG-A1      │ ☑ 🟢     │ ☐        │ ☑ 🟡     │
│ LEG-A2      │ ☑ 🟢     │ ☑ 🔴     │ ☐        │
│ BRACE-A1-A2 │ ☑ ⚪     │ ☐        │ ☐        │
└─────────────┴──────────┴──────────┴──────────┘

Legend:
☑ = Selected
☐ = Not selected
🟢 = Completed
🟡 = Incomplete
🔴 = Incomplete
⚪ = Pending
```

### Color Scheme
- **Pending**: Gray (#6B7280)
- **Completed**: Green (#10B981)
- **Incomplete**: Red (#EF4444)

## 📊 Future Enhancements

1. **Inspection Data Integration**
   - Link actual inspection records to SOW items
   - Auto-update status when inspections are completed
   - Show inspection count from actual data

2. **Bulk Operations**
   - Select all components for an inspection type
   - Select all inspection types for a component
   - Copy SOW from another structure

3. **Export/Print**
   - Generate PDF report
   - Export to Excel
   - Print-friendly view

4. **Validation**
   - Prevent deletion if inspections exist
   - Require minimum inspections per component
   - Validate elevation data format

5. **History/Audit**
   - Track all status changes
   - Show who changed what and when
   - Revert to previous versions

## 🐛 Testing Checklist

- [ ] Create new SOW for a structure
- [ ] Add report numbers
- [ ] Select component-inspection combinations
- [ ] Enable elevation breakup for an item
- [ ] Add multiple elevations
- [ ] Update item status
- [ ] Update elevation status
- [ ] View statistics
- [ ] Save and reload SOW
- [ ] Delete SOW item
- [ ] Delete entire SOW
- [ ] Test with multiple structures
- [ ] Test cascade deletion

## 📝 Notes

- SOW IDs are sequential integers, not UUIDs
- All foreign keys use BIGINT to match existing schema
- Trigger automatically updates counts in header
- Cascade deletion removes all items when SOW is deleted
- Denormalized data improves query performance
- JSONB used only for flexible data (elevations, reports)
