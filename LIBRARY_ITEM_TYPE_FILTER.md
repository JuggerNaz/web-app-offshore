# Library Master - Item Type Filter Added

## Feature Added

Added a radio button filter to the Library Master page that allows users to filter items by type:
1. **All Items** - Shows all items from `u_lib_list`
2. **Combination Items** - Shows only items that exist in `u_lib_combo` (items used in combinations)
3. **Standard Items** - Shows only items that are NOT in `u_lib_combo` (regular items)

## Implementation

### Filter Logic

The filter works by:
1. Fetching all items from `/api/library/{lib_code}`
2. Fetching combination items from `/api/library/combo/{lib_code}`
3. Creating a Set of combination item IDs for quick lookup
4. Filtering items based on whether they exist in the combination Set

### Code Changes

**File:** `app/dashboard/utilities/library/page.tsx`

#### 1. Added Filter State
```typescript
const [itemTypeFilter, setItemTypeFilter] = useState<"all" | "combination" | "standard">("all");
```

#### 2. Fetch Combination Data
```typescript
// Fetch combination items to determine which items are combinations
const { data: comboData } = useSWR(
    master ? `/api/library/combo/${encodeURIComponent(master.lib_code)}` : null,
    fetcher
);

const comboItems = comboData?.data || [];

// Create a Set of combination item IDs for quick lookup
const combinationIds = new Set(
    comboItems.map((combo: any) => combo.lib_val || combo.code)
);
```

#### 3. Updated Filter Logic
```typescript
const filteredItems = items.filter(item => {
    // Filter by item type
    const itemId = item.lib_val || item.code;
    const isCombination = combinationIds.has(itemId);
    
    if (itemTypeFilter === "combination" && !isCombination) return false;
    if (itemTypeFilter === "standard" && isCombination) return false;
    
    // Search in all string values
    const searchStr = searchTerm.toLowerCase();
    return Object.values(item).some(val =>
        typeof val === 'string' && val.toLowerCase().includes(searchStr)
    );
});
```

#### 4. Added UI Filter
```tsx
{/* Item Type Filter */}
<div className="flex items-center gap-4 px-1">
    <span className="text-sm font-medium text-muted-foreground">Item Type:</span>
    <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
            <input
                type="radio"
                name="itemType"
                value="all"
                checked={itemTypeFilter === "all"}
                onChange={(e) => setItemTypeFilter(e.target.value as any)}
                className="w-4 h-4 text-blue-600 cursor-pointer"
            />
            <span className="text-sm">All Items</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
            <input
                type="radio"
                name="itemType"
                value="combination"
                checked={itemTypeFilter === "combination"}
                onChange={(e) => setItemTypeFilter(e.target.value as any)}
                className="w-4 h-4 text-blue-600 cursor-pointer"
            />
            <span className="text-sm">Combination Items</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
            <input
                type="radio"
                name="itemType"
                value="standard"
                checked={itemTypeFilter === "standard"}
                onChange={(e) => setItemTypeFilter(e.target.value as any)}
                className="w-4 h-4 text-blue-600 cursor-pointer"
            />
            <span className="text-sm">Standard Items</span>
        </label>
    </div>
</div>
```

## Filter Labels Explained

### "Item Type:"
This is the label for the filter group, indicating what the radio buttons control.

### "All Items"
Shows every item in the library category, regardless of whether it's used in combinations or not.

### "Combination Items"
Shows only items that are referenced in the `u_lib_combo` table. These are items that can be combined with other items (e.g., colors, materials, types that can be mixed and matched).

### "Standard Items"
Shows only items that are NOT in `u_lib_combo`. These are standalone items that don't participate in combinations.

## Use Cases

### Example 1: Anode Material Color
- **All Items**: Shows all colors (RED, BLUE, GREEN, YELLOW, etc.)
- **Combination Items**: Shows only colors used in anode combinations
- **Standard Items**: Shows colors not used in combinations

### Example 2: Adaptor Type
- **All Items**: Shows all adaptor types
- **Combination Items**: Shows types that can be combined with other properties
- **Standard Items**: Shows standalone adaptor types

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  Library Master                                         │
│  Select a category to view items                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Adaptor Type                    [Search] [+ Add Item] │
│                                                         │
│  Item Type: ○ All Items  ○ Combination Items  ○ Standard Items
│                                                         │
├─────────────────────────────────────────────────────────┤
│  COUPLINGS          COUPLINGS                      —    │
│  DIAMETER_RED       DIAMETER REDUCERS              —    │
│  FLANGE_ADAPT       FLANGE ADAPTORS                —    │
│  SAMPLE             SAMPLE DATA                    —    │
│  SPACERS            SPACERS                        —    │
└─────────────────────────────────────────────────────────┘
```

## How It Works

1. **User selects a library category** (e.g., "Adaptor Type")
2. **Filter defaults to "All Items"** - Shows everything
3. **User clicks "Combination Items"**:
   - System fetches combination data from `u_lib_combo`
   - Filters to show only items in combinations
4. **User clicks "Standard Items"**:
   - Shows only items NOT in combinations
5. **User clicks "All Items"**:
   - Resets filter to show everything

## Benefits

✅ **Easy to find combination items** - Quickly see which items are used in combinations  
✅ **Identify standalone items** - See which items are not part of combinations  
✅ **Better organization** - Understand the structure of your library data  
✅ **Improved workflow** - Filter based on how items are used  
✅ **Clear labeling** - Intuitive radio button labels

## Technical Details

### Performance
- Uses `Set` for O(1) lookup of combination IDs
- Efficient filtering with single pass through items
- SWR caching for both items and combo data

### Data Sources
- **Items**: `/api/library/{lib_code}` → `u_lib_list` table
- **Combinations**: `/api/library/combo/{lib_code}` → `u_lib_combo` table

### Filter State
- Stored in component state
- Persists during search
- Resets when changing categories

## Files Modified

1. ✅ `app/dashboard/utilities/library/page.tsx` (Lines 171-275)
   - Added filter state
   - Added combo data fetching
   - Updated filter logic
   - Added radio button UI

## Status

✅ **COMPLETE** - Filter added and working  
✅ **TESTED** - Filters items correctly  
✅ **READY** - Production ready

---

**Last Updated:** 2026-01-15  
**Feature:** Item Type Filter  
**Status:** IMPLEMENTED ✅
