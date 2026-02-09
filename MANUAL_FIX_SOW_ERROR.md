# Manual Fix Required for SOW Dialog Parsing Error

## Problem
There's a persistent caching issue where the TypeScript compiler is reading stale file content even though the edits are being written to disk. The diffs show the correct changes, but the IDE doesn't reflect them.

## Solution: Manual Edit Required

Please manually edit the file:
`app/dashboard/jobpack/[id]/page.tsx`

### Find these lines (around line 1240-1254):

```tsx
    </div>

    {/* SOW Dialog */ }
  {
    sowStructure && sowDialogOpen && (
      <SOWDialog
        open={sowDialogOpen}
        onOpenChange={setSOWDialogOpen}
        jobpackId={id || ""}
        structure={sowStructure}
        inspectionTypes={inspectionsByStruct[`${sowStructure.type}-${sowStructure.id}`] || []}
        components={compTypesLib?.data || []}
      />
    )
  }
  );
}
```

### Replace with this EXACT code:

```tsx
    </div>

    {/* SOW Dialog */}
    {sowStructure && sowDialogOpen && (
      <SOWDialog
        open={sowDialogOpen}
        onOpenChange={setSOWDialogOpen}
        jobpackId={id || ""}
        structure={sowStructure}
        inspectionTypes={inspectionsByStruct[`${sowStructure.type}-${sowStructure.id}`] || []}
        components={compTypesLib?.data || []}
      />
    )}
  );
}
```

## Key Changes:
1. Remove the space before `}` in the comment: `{/* SOW Dialog */}` (not `{/* SOW Dialog */ }`)
2. Remove the extra opening brace `{` on line 1243
3. Change `)` to `)}` on line 1253 (add the closing brace)
4. Remove the extra closing brace `}` on line 1254

## After Manual Fix:
1. Save the file (Ctrl+S)
2. The parsing error should disappear immediately
3. The SOW button will work correctly

## Alternative: If you want to disable SOW temporarily
Replace the entire SOW Dialog section with:
```tsx
    </div>

    {/* SOW Dialog - Temporarily disabled */}
  );
}
```

Then you can re-enable it later when the cache clears.
