# Library Combo Implementation

## Overview
This implementation adds support for combo library items that link two codes from different library lists.

## Combo Libraries Configured

1. **AMLYCODFND** (Anomaly Code/Findings)
   - Code 1: AMLY_COD (Anomaly Code)
   - Code 2: AMLY_FND (Anomaly Findings)

2. **ANMLYCLR** (Anomaly Color)
   - Code 1: AMLY_TYP (Anomaly Type)
   - Code 2: COLOR (Color)

3. **ANMTRGINSP** (Anomaly Target Inspection)
   - Code 1: AMLY_COD (Anomaly Code)
   - Code 2: INSPTYPE (Inspection Type)

4. **ANMALTDAYS** (Anomaly Alert Days)
   - Code 1: AMLY_TYP (Anomaly Type)
   - Code 2: ALTDAYS (Alert Days)

## Features

### User Interface
- **Dropdown Selection**: Users select code_1 and code_2 from dropdown lists populated from u_lib_list
- **Dynamic Labels**: Column headers show the actual library names (e.g., "Anomaly Code" instead of "AMLY_COD")
- **Duplicate Prevention**: System prevents creating duplicate combinations of code_1 and code_2
- **Search**: Search across both codes and their descriptions
- **Visual Feedback**: Same styling as regular library items with hover effects and selection indicators

### CRUD Operations
- **Create**: Add new combinations via dialog with dropdown selectors
- **Edit**: Modify comments only (codes are read-only to maintain data integrity)
- **Delete**: Soft delete with restore option
- **List**: View all combinations with descriptions

### Data Integrity
- **No Duplicates**: Validates that code_1 + code_2 combination doesn't already exist
- **Read-only Codes**: In edit mode, codes cannot be changed (only comments)
- **Referential Integrity**: Codes must exist in their respective u_lib_list tables

## API Endpoints

### GET `/api/library/combo/[lib_code]`
Fetch all combo items for a specific library code

### POST `/api/library/combo/[lib_code]`
Create a new combo item
- Validates required fields
- Checks for duplicates
- Returns 409 if combination exists

### GET `/api/library/combo/[lib_code]/options`
Fetch dropdown options for code_1 and code_2
- Returns options from u_lib_list
- Returns proper labels from u_lib_master
- Returns configuration for the specific combo library

### PUT `/api/library/combo/[lib_code]/[id]`
Update combo item (comments or delete status only)

### DELETE `/api/library/combo/[lib_code]/[id]`
Hard delete combo item (admin use)

## Files Created

1. `/app/api/library/combo/[lib_code]/route.ts` - Main combo CRUD operations
2. `/app/api/library/combo/[lib_code]/[id]/route.ts` - Individual item operations
3. `/app/api/library/combo/[lib_code]/options/route.ts` - Dropdown options
4. `/app/dashboard/utilities/library/combo-library.tsx` - UI component

## Files Modified

1. `/app/dashboard/utilities/library/page.tsx` - Added combo library detection and routing

## Database Tables Used

- `u_lib_combo` - Stores combo combinations
  - id (primary key)
  - lib_code (master library code)
  - code_1 (first code from u_lib_list)
  - code_2 (second code from u_lib_list)
  - lib_com (comments)
  - lib_delete (soft delete flag)

- `u_lib_list` - Source of dropdown options
- `u_lib_master` - Source of label names

## Usage

1. Navigate to Library > Select a combo library (e.g., "Anomaly Code/Findings")
2. Click "Add Combination"
3. Select values from both dropdowns
4. Add optional comments
5. Click "Create"

The system will:
- Validate the combination doesn't exist
- Save to u_lib_combo table
- Display in the list with proper descriptions
- Allow editing comments or soft deletion
