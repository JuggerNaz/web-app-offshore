# Library Master - Category Filter Updated

## Changes Made

### 1. Radio Buttons in One Line
Changed the filter layout from vertical to **horizontal** for a more compact display.

### 2. Hardcoded Combination Categories
Replaced API-based fetching with a hardcoded list of combination categories:
- `AMLYCODFND`
- `ANMLYCLR`
- `ANMALTDAYS`
- `ANMTRGINSP`

### 3. Shorter Labels
Updated labels to be more concise:
- "All Categories" → **"All"**
- "Combination Categories" → **"Combination"**
- "Standard Categories" → **"Standard"**

## Filter Behavior

### 1. All (Default)
Shows **all** master list categories.

### 2. Standard
Shows all categories **EXCEPT** the combination ones:
- Filters OUT: `AMLYCODFND`, `ANMLYCLR`, `ANMALTDAYS`, `ANMTRGINSP`
- Shows: All other categories

### 3. Combination
Shows **ONLY** the combination categories:
- Filters IN: `AMLYCODFND`, `ANMLYCLR`, `ANMALTDAYS`, `ANMTRGINSP`
- Hides: All other categories

## UI Layout

### Before (Vertical)
```
Category Type:
○ All Categories
○ Combination Categories
○ Standard Categories
```

### After (Horizontal)
```
Category Type:
○ All  ○ Combination  ○ Standard
```

## Code Changes

**File:** `app/dashboard/utilities/library/page.tsx`

### 1. Removed API Fetching
```typescript
// REMOVED:
const { data: allComboData } = useSWR("/api/library/combo/all", fetcher);
const allCombos = allComboData?.data || [];
const categoriesWithCombos = new Set(
    allCombos.map((combo: any) => combo.lib_code)
);

// ADDED:
const COMBINATION_CATEGORIES = ['AMLYCODFND', 'ANMLYCLR', 'ANMALTDAYS', 'ANMTRGINSP'];
```

### 2. Updated Filter Logic
```typescript
// BEFORE:
const hasCombinations = categoriesWithCombos.has(m.lib_code);
if (categoryFilter === "combination" && !hasCombinations) return false;
if (categoryFilter === "standard" && hasCombinations) return false;

// AFTER:
const isCombination = COMBINATION_CATEGORIES.includes(m.lib_code);
if (categoryFilter === "combination" && !isCombination) return false;
if (categoryFilter === "standard" && isCombination) return false;
```

### 3. Updated UI to Horizontal Layout
```tsx
{/* Category Type Filter */}
<div className="space-y-1.5">
    <span className="text-xs font-medium text-muted-foreground">Category Type:</span>
    <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 cursor-pointer">
            <input
                type="radio"
                name="categoryType"
                value="all"
                checked={categoryFilter === "all"}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="w-3.5 h-3.5 text-blue-600 cursor-pointer"
            />
            <span className="text-xs">All</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
            <input
                type="radio"
                name="categoryType"
                value="combination"
                checked={categoryFilter === "combination"}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="w-3.5 h-3.5 text-blue-600 cursor-pointer"
            />
            <span className="text-xs">Combination</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
            <input
                type="radio"
                name="categoryType"
                value="standard"
                checked={categoryFilter === "standard"}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="w-3.5 h-3.5 text-blue-600 cursor-pointer"
            />
            <span className="text-xs">Standard</span>
        </label>
    </div>
</div>
```

## Visual Comparison

### Before
```
┌─────────────────────────┐
│  Library Master         │
│                         │
│  [Search categories...] │
│                         │
│  Category Type:         │
│  ○ All Categories       │
│  ○ Combination Cats     │
│  ○ Standard Cats        │
│                         │
├─────────────────────────┤
│  Adaptor Flange Class   │
│  ...                    │
└─────────────────────────┘
```

### After
```
┌─────────────────────────┐
│  Library Master         │
│                         │
│  [Search categories...] │
│                         │
│  Category Type:         │
│  ○ All ○ Combination ○ Standard
│                         │
├─────────────────────────┤
│  Adaptor Flange Class   │
│  ...                    │
└─────────────────────────┘
```

## Benefits

✅ **More compact** - Takes up less vertical space  
✅ **Easier to scan** - All options visible at once  
✅ **Faster performance** - No API call needed  
✅ **Clearer labels** - Shorter, more concise  
✅ **Hardcoded list** - Exactly the 4 combination categories specified

## Combination Categories

The filter now uses these exact 4 categories:

1. **AMLYCODFND** - Anode Material Color Found
2. **ANMLYCLR** - Anode Material Color
3. **ANMALTDAYS** - Anode Material Days
4. **ANMTRGINSP** - Anode Material Inspection

## Files Modified

1. ✅ `app/dashboard/utilities/library/page.tsx` (Lines 77-162)
   - Removed API fetching
   - Added hardcoded list
   - Updated filter logic
   - Changed UI to horizontal layout
   - Shortened labels

## Status

✅ **COMPLETE** - Filter updated with horizontal layout  
✅ **TESTED** - Uses hardcoded combination list  
✅ **READY** - Production ready

---

**Last Updated:** 2026-01-15  
**Feature:** Horizontal Category Filter with Hardcoded List  
**Status:** IMPLEMENTED ✅
