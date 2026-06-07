# Add Reports Menu Item

## Quick Instructions

Add the Reports menu item to `components/menu.tsx`:

### Step 1: Add FileText import

In the imports section (around line 3-14), add `FileText` to the lucide-react imports:

```tsx
import {
  Home,
  Package,
  BrickWall,
  Layers2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  MapPin,
  Settings,
  FileText,  // Add this line
} from "lucide-react";
```

### Step 2: Add Reports menu link

After the "Inspection Planning" menu item (around line 115), add:

```tsx
{/* Reports */}
<MenuLink
  href="/dashboard/reports"
  isCollapsed={isCollapsed}
  label="Reports"
  icon={<FileText className="h-4 w-4" />}
  text="Reports"
/>
```

That's it! The Reports menu will now appear in the sidebar.

## Menu Order

The menu will be:
1. Dashboard
2. Field
3. Job Pack
4. Inspection Planning
5. **Reports** ← New!
6. Settings (at bottom)
