# Add Serial Number Field to Settings UI (Read-Only)

## Quick Instructions

Add this code to `app/dashboard/settings/page.tsx` after the Department Name field (around line 270):

```tsx
{/* Serial Number - Read Only */}
<div className="space-y-2">
    <Label htmlFor="serialNo">Serial Number</Label>
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border border-border rounded-md">
        <span className="font-mono text-sm">
            {serialNo || "Not assigned"}
        </span>
    </div>
    <p className="text-xs text-muted-foreground">
        Company serial number (auto-generated, read-only)
    </p>
</div>
```

Insert it between the Department Name `</div>` and the `{/* Company Logo */}` comment.

The serial number will be displayed as read-only text that users cannot edit.
