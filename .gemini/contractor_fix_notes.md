# Contractor Field Fix Summary

## Problem
The contractor field is not persisting after save and reload. The value shows as `undefined` even after selecting a contractor.

## Root Cause
The contractor value is not being properly saved to `metadata.contrac` in the database.

## Solution Steps

1. **Verify the form value is set**: Add logging to confirm the Select onChange is working
2. **Verify the submission payload**: Confirm `metadata.contrac` contains the value
3. **Verify the database save**: Check if the API is actually saving the metadata
4. **Verify the data load**: Confirm the value is being loaded back from the database

## Current Status
- ✅ Contractor options are loading correctly
- ✅ Select component onChange is being called  
- ❌ Form value (`values.contrac`) is `undefined` when saving
- ❌ Contractor not persisting to database

## Next Steps
Need to debug why `field.onChange(value)` in the Select component is not updating the form state.
