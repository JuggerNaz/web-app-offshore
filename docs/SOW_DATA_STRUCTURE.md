# SOW Data Structure - Important Notes

## Database Schema Clarification

### `structure_components` Table
- **`id`** → This is the **component_id** (primary key)
- **`structure_id`** → This is the **structure_id** (foreign key)
- **`qid`** → Component QID (e.g., "LEG-A1")
- **`type`** → Component type (e.g., "Leg", "Brace")

### API Response Format

When fetching components via `/api/structure-components?structure_id=X`:

```json
{
  "data": [
    {
      "id": 123,          // This is the component_id
      "qid": "LEG-A1",
      "type": "Leg",
      "elv_1": 10.5,
      "elv_2": 20.0
    }
  ]
}
```

### SOW Dialog Component Props

```typescript
components: Array<{
  id: number;      // component_id from structure_components.id
  qid: string;     // Component QID
  type: string;    // Component type
}>
```

### SOW Items Table

When saving SOW items, the `component_id` field stores the `id` from `structure_components`:

```typescript
{
  sow_id: 1,
  component_id: 123,           // From structure_components.id
  inspection_type_id: 456,
  component_qid: "LEG-A1",     // Denormalized for quick access
  component_type: "Leg",       // Denormalized for quick access
  status: "pending"
}
```

## Data Flow

```
structure_components table
├── id (component_id) ──────────┐
├── structure_id                │
├── qid                         │
└── type                        │
                                │
                                ↓
                    /api/structure-components
                                │
                                ↓
                        SOW Dialog Component
                                │
                                ↓
                        User selects components
                                │
                                ↓
                    POST /api/sow/items
                                │
                                ↓
                        u_sow_items table
                        ├── component_id (from structure_components.id)
                        ├── inspection_type_id
                        └── status
```

## Important Points

1. ✅ **`structure_components.id`** is the **component_id** used throughout the SOW system
2. ✅ **`structure_components.structure_id`** links components to structures
3. ✅ The API correctly selects `id` as the component identifier
4. ✅ The SOW dialog correctly uses `component.id` for selections
5. ✅ SOW items correctly store `component_id` from `structure_components.id`

## Current Implementation Status

- ✅ API route correctly fetches components with `id` field
- ✅ SOW dialog interface correctly defines `id` as component identifier
- ✅ Component selection uses `comp.id` correctly
- ✅ SOW item creation uses `component_id` from the component's `id` field
- ✅ All foreign key relationships are correct

**No changes needed** - the implementation is already correct! 🎉
