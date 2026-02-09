# SOW Integration Guide - Job Pack Page

## Step-by-Step Integration

### Step 1: Add Imports

Add these imports at the top of `app/dashboard/jobpack/[id]/page.tsx`:

```tsx
import { SOWDialog } from "@/components/jobpack/sow-dialog";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
```

### Step 2: Add State Variables

Add these state variables with your other useState declarations (around line 90):

```tsx
// SOW Dialog state
const [sowDialogOpen, setSOWDialogOpen] = useState(false);
const [sowStructure, setSOWStructure] = useState<any>(null);
const [sowComponents, setSOWComponents] = useState<any[]>([]);
```

### Step 3: Fetch Components When Structure Selected

Add this effect to fetch components when a structure is selected:

```tsx
// Fetch components for SOW
useEffect(() => {
  const fetchComponents = async () => {
    if (sowStructure) {
      try {
        const response = await fetch(`/api/structure-components?structure_id=${sowStructure.id}`);
        const { data } = await response.json();
        setSOWComponents(data || []);
      } catch (error) {
        console.error("Error fetching components:", error);
        setSOWComponents([]);
      }
    }
  };

  if (sowDialogOpen && sowStructure) {
    fetchComponents();
  }
}, [sowDialogOpen, sowStructure]);
```

### Step 4: Add SOW Button

Find the "Finalize & Release" button section (around line 560) and add the SOW button after it:

```tsx
{/* Finalize & Release Button */}
<Button
  type="submit"
  disabled={isSaving || !selectedStructures.length}
  className="rounded-xl h-12 px-6 font-bold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all gap-2"
>
  {isSaving ? (
    <div className="h-4 w-4 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
  ) : (
    <ShieldCheck className="h-4 w-4" />
  )}
  Finalize & Release
</Button>

{/* SOW Button - NEW */}
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
    className="rounded-xl h-12 px-6 font-bold border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all gap-2"
  >
    <FileText className="h-4 w-4" />
    SOW
  </Button>
)}
```

### Step 5: Add SOW Dialog Component

Add this at the very end of the component, just before the closing `</div>` and `);`:

```tsx
      </Form>
    </div>
  </div>

  {/* SOW Dialog */}
  {sowStructure && sowDialogOpen && (
    <SOWDialog
      open={sowDialogOpen}
      onOpenChange={setSOWDialogOpen}
      jobpackId={Number(id)}
      structure={{
        id: sowStructure.id,
        type: sowStructure.type,
        title: sowStructure.title,
      }}
      inspectionTypes={inspectionsByStruct[`${sowStructure.type}-${sowStructure.id}`] || []}
      components={sowComponents}
      onSave={() => {
        // Optionally refresh data
        setSOWDialogOpen(false);
      }}
    />
  )}
);
```

## Complete Code Snippets

### Import Section (Top of File)
```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams, useParams, usePathname } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Trash2, 
  Search, 
  X, 
  ShieldCheck, 
  FileText,  // Add this
  Ship, 
  Calendar, 
  User, 
  Building2 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { JobpackSchema } from "@/utils/schemas/zod";
import { FormFieldWrap } from "@/components/forms/form-field-wrap";
import moment from "moment";
import { VesselManager, VesselRecord } from "@/components/jobpack/vessel-manager";
import { SOWDialog } from "@/components/jobpack/sow-dialog";  // Add this
```

### State Variables Section
```tsx
// Existing state variables...
const [isSaving, setIsSaving] = useState(false);
const [vesselHistory, setVesselHistory] = useState<VesselRecord[]>([]);

// SOW Dialog state - ADD THESE
const [sowDialogOpen, setSOWDialogOpen] = useState(false);
const [sowStructure, setSOWStructure] = useState<any>(null);
const [sowComponents, setSOWComponents] = useState<any[]>([]);
```

### Effect for Fetching Components
```tsx
// Fetch components for SOW - ADD THIS
useEffect(() => {
  const fetchComponents = async () => {
    if (sowStructure) {
      try {
        const response = await fetch(`/api/structure-components?structure_id=${sowStructure.id}`);
        const { data } = await response.json();
        setSOWComponents(data || []);
      } catch (error) {
        console.error("Error fetching components:", error);
        setSOWComponents([]);
      }
    }
  };

  if (sowDialogOpen && sowStructure) {
    fetchComponents();
  }
}, [sowDialogOpen, sowStructure]);
```

## Testing the Integration

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Navigate to a Job Pack
- Go to `/dashboard/jobpack/[id]`
- Make sure the job pack has structures added
- Select a structure from the list

### 3. Click the SOW Button
- The SOW button should appear next to "Finalize & Release"
- Click it to open the SOW dialog

### 4. Test SOW Dialog Features
- [ ] Dialog opens successfully
- [ ] Structure information displays correctly
- [ ] Add report numbers
- [ ] Remove report numbers
- [ ] View component-inspection matrix
- [ ] Select/deselect component-inspection combinations
- [ ] View statistics (should all be 0 initially)
- [ ] Save SOW
- [ ] Close and reopen - data should persist
- [ ] Update selections and save again

### 5. Verify in Database
```sql
-- Check SOW was created
SELECT * FROM u_sow WHERE jobpack_id = YOUR_JOBPACK_ID;

-- Check SOW items were created
SELECT 
  si.*,
  s.structure_title
FROM u_sow_items si
JOIN u_sow s ON s.id = si.sow_id
WHERE s.jobpack_id = YOUR_JOBPACK_ID;

-- Check counts are correct
SELECT 
  id,
  structure_title,
  total_items,
  completed_items,
  incomplete_items,
  pending_items
FROM u_sow
WHERE jobpack_id = YOUR_JOBPACK_ID;
```

## Troubleshooting

### SOW Button Not Appearing
- Check that `!isNew` is true (job pack must be saved)
- Check that `selectedStructures.length > 0`
- Check that a structure is selected (`activeStructKey` is set)

### Dialog Not Opening
- Check browser console for errors
- Verify `SOWDialog` component is imported correctly
- Check that `sowStructure` is set correctly

### Components Not Loading
- Verify `/api/structure-components` route exists
- Check that `structure_id` is being passed correctly
- Verify components exist in `structure_components` table

### Save Not Working
- Check browser console for API errors
- Verify `/api/sow` and `/api/sow/items` routes are working
- Check network tab for failed requests
- Verify foreign key values are correct (BIGINT)

### Data Not Persisting
- Check that SOW ID is being returned from create
- Verify items are being created with correct `sow_id`
- Check database for actual records

## Next Steps

After successful integration:

1. **Add Elevation Breakup UI** - Enhance dialog to support elevation data
2. **Status Management** - Add UI to update item status
3. **Inspection Integration** - Link to actual inspection records
4. **Export/Print** - Generate SOW reports
5. **Bulk Operations** - Select all components/inspections at once

## Notes

- SOW can only be created for saved job packs (not new ones)
- Structure must be selected to open SOW dialog
- Components are fetched dynamically based on structure
- Inspection types come from job pack metadata
- All IDs use BIGINT (number type in TypeScript)
- Trigger automatically updates counts in header table
