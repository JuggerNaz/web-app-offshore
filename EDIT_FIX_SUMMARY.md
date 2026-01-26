# Fix Summary: Edit Procedure Errors

## 1. Fixed API Error (500 Internal Server Error)

**Issue:** The frontend sends data in camelCase (e.g., `procedureName`), but the database expects snake_case (e.g., `procedure_name`). This mismatch caused the database update to fail.

**Fix Applied:**
Updated `app/api/defect-criteria/procedures/[id]/route.ts` to map the fields correctly before sending to Supabase:

```typescript
// Map camelCase to snake_case
const updates: any = {};
if (body.procedureNumber) updates.procedure_number = body.procedureNumber;
if (body.procedureName) updates.procedure_name = body.procedureName;
if (body.effectiveDate) updates.effective_date = body.effectiveDate;
if (body.status) updates.status = body.status;
if (body.notes !== undefined) updates.notes = body.notes;
```

## 2. Fixed React Error (Uncontrolled Input)

**Issue:** When opening the edit dialog, if fields like `notes` were `null` or `undefined` in the database, the React inputs became "uncontrolled". Changing them later caused the error "A component is changing an uncontrolled input to be controlled".

**Fix Applied:**
Updated `handleEditProcedure` in `app/dashboard/settings/defect-criteria/page.tsx` to ensure all fields have default empty string values:

```typescript
setProcedureForm({
    procedureNumber: activeProcedure.procedureNumber || '',
    procedureName: activeProcedure.procedureName || '',
    effectiveDate: activeProcedure.effectiveDate ? ... : ...,
    status: activeProcedure.status || 'draft',
    // Fixed: Ensure notes is empty string if null
    notes: activeProcedure.notes || '',
});
```

---

## Status
✅ Both issues are resolved. You can now edit procedure details without errors.
