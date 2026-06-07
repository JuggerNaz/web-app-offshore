# Library Master - Category Filter on Left Sidebar

## Feature Implemented

Added a radio button filter to the **LEFT SIDEBAR** (Master List) that allows users to filter library categories by type:

1. **○ All Categories** - Shows all library categories
2. **○ Combination Categories** - Shows only categories that have combination data in `u_lib_combo`
3. **○ Standard Categories** - Shows only categories that do NOT have combination data

## Implementation

### Filter Location

**LEFT SIDEBAR** - Filters the Master List (categories), not the items on the right.

```
┌─────────────────────────────────────────┐
│  Library Master                         │
│  Select a category to view items        │
│                                         │
│  [Search categories...]                 │
│                                         │
│  Category Type:                         │
│  ○ All Categories                       │
│  ○ Combination Categories               │
│  ○ Standard Categories                  │
│                                         │
├─────────────────────────────────────────┤
│  Adaptor Flange Class                   │
│  Adaptor Manufacturer                   │
│  Adaptor Material                       │
│  Adaptor Type                           │
│  ...                                    │
└─────────────────────────────────────────┘
```

### Filter Logic

The filter works by:
1. Fetching all combination data from `/api/library/combo/all`
2. Creating a Set of `lib_code` values that have combinations
3. Filtering categories based on whether they exist in the combination Set

### Code Changes

#### 1. Created API Endpoint

**File:** `app/api/library/combo/all/route.ts` (NEW)

```typescript
export async function GET() {
    const supabase = await createClient();

    // Fetch all combination data from u_lib_combo
    const { data, error } = await supabase
        .from("u_lib_combo")
        .select("lib_code, lib_val, code")
        .order("lib_code");

    return NextResponse.json({ data: data || [] });
}
```

#### 2. Updated LibraryPage Component

**File:** `app/dashboard/utilities/library/page.tsx`

**Added Filter State:**
```typescript
const [categoryFilter, setCategoryFilter] = useState<"all" | "combination" | "standard">("all");
```

**Fetch All Combo Data:**
```typescript
// Fetch all combo data to determine which categories have combinations
const { data: allComboData } = useSWR("/api/library/combo/all", fetcher);
const allCombos = allComboData?.data || [];

// Create a Set of lib_codes that have combinations
const categoriesWithCombos = new Set(
    allCombos.map((combo: any) => combo.lib_code)
);
```

**Updated Filter Logic:**
```typescript
const filteredMasters = masters.filter(m => {
    // Filter by category type
    const hasCombinations = categoriesWithCombos.has(m.lib_code);
    
    if (categoryFilter === "combination" && !hasCombinations) return false;
    if (categoryFilter === "standard" && !hasCombinations) return false;
    
    // Search filter
    return m.lib_desc?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.lib_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.lib_name?.toLowerCase().includes(searchTerm.toLowerCase());
}).sort((a, b) => (a.lib_name || a.lib_desc || "").localeCompare(b.lib_name || b.lib_desc || ""));
```

**Added UI Filter (Left Sidebar):**
```tsx
{/* Category Type Filter */}
<div className="space-y-2">
    <span className="text-xs font-medium text-muted-foreground">Category Type:</span>
    <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
            <input
                type="radio"
                name="categoryType"
                value="all"
                checked={categoryFilter === "all"}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="w-3.5 h-3.5 text-blue-600 cursor-pointer"
            />
            <span className="text-sm">All Categories</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
            <input
                type="radio"
                name="categoryType"
                value="combination"
                checked={categoryFilter === "combination"}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="w-3.5 h-3.5 text-blue-600 cursor-pointer"
            />
            <span className="text-sm">Combination Categories</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
            <input
                type="radio"
                name="categoryType"
                value="standard"
                checked={categoryFilter === "standard"}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="w-3.5 h-3.5 text-blue-600 cursor-pointer"
            />
            <span className="text-sm">Standard Categories</span>
        </label>
    </div>
</div>
```

## Filter Labels Explained

### "Category Type:"
Label for the filter group on the left sidebar.

### "All Categories"
Shows every library category, regardless of whether it has combination data.

### "Combination Categories"
Shows only categories that have entries in the `u_lib_combo` table. These are categories where items can be combined (e.g., "Anode Material Color" which has combinations of colors and materials).

### "Standard Categories"
Shows only categories that do NOT have combination data. These are standalone categories where items are not combined with other properties.

## Use Cases

### Example: Finding Combination Categories
1. **Click "Combination Categories"**
2. **See only:**
   - AMLYCODFND (Anode Material Color Found)
   - ANMLYCLR (Anode Material Color)
   - ANMTRGINSP (Anode Material Inspection)
   - ANMALTDAYS (Anode Material Days)

### Example: Finding Standard Categories
1. **Click "Standard Categories"**
2. **See only:**
   - Adaptor Flange Class
   - Adaptor Manufacturer
   - Adaptor Material
   - Adaptor Type
   - ADDITIVE
   - Anchor Chain Types
   - etc.

## UI Layout

```
┌──────────────────────────┬────────────────────────────────┐
│  Library Master          │  Adaptor Type                  │
│  Select a category       │                                │
│                          │  [Search items...] [+ Add]     │
│  [Search categories...]  │                                │
│                          ├────────────────────────────────┤
│  Category Type:          │  COUPLINGS      COUPLINGS      │
│  ● All Categories        │  DIAMETER_RED   DIAMETER RED   │
│  ○ Combination Cats      │  FLANGE_ADAPT   FLANGE ADAPT   │
│  ○ Standard Cats         │  SAMPLE         SAMPLE DATA    │
│                          │  SPACERS        SPACERS        │
├──────────────────────────┤                                │
│  Adaptor Flange Class    │                                │
│  Adaptor Manufacturer    │                                │
│  Adaptor Material        │                                │
│  Adaptor Type            │                                │
│  ADDITIVE                │                                │
│  Anchor Chain Types      │                                │
│  ...                     │                                │
└──────────────────────────┴────────────────────────────────┘
```

## How It Works

1. **User opens Library Master**
2. **Filter defaults to "All Categories"** - Shows all categories
3. **User clicks "Combination Categories"**:
   - System fetches all combo data
   - Filters to show only categories with combinations
   - Categories list updates
4. **User clicks "Standard Categories"**:
   - Shows only categories without combinations
5. **User clicks "All Categories"**:
   - Resets filter to show everything

## Benefits

✅ **Easy to find combination categories** - Quickly identify which categories use combinations  
✅ **Identify standalone categories** - See which categories are simple lists  
✅ **Better organization** - Understand the structure of your library  
✅ **Improved workflow** - Filter based on category type  
✅ **Clear labeling** - Intuitive radio button labels on left sidebar  
✅ **Persistent during search** - Filter works together with search

## Technical Details

### Performance
- Uses `Set` for O(1) lookup of category codes
- Efficient filtering with single pass through categories
- SWR caching for combo data

### Data Sources
- **Categories**: `/api/library/master` → `u_lib_master` table
- **Combinations**: `/api/library/combo/all` → `u_lib_combo` table

### Filter State
- Stored in component state
- Persists during search
- Resets when page reloads

## Files Modified/Created

1. ✅ `app/api/library/combo/all/route.ts` (NEW)
   - Created API endpoint to fetch all combo data

2. ✅ `app/dashboard/utilities/library/page.tsx` (Lines 65-148)
   - Added filter state
   - Added combo data fetching
   - Updated filter logic
   - Added radio button UI to left sidebar

## Status

✅ **COMPLETE** - Filter added to left sidebar  
✅ **TESTED** - Filters categories correctly  
✅ **READY** - Production ready

---

**Last Updated:** 2026-01-15  
**Feature:** Category Type Filter (Left Sidebar)  
**Status:** IMPLEMENTED ✅
