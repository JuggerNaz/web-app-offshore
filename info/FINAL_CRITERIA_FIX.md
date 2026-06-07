# Defect Criteria Display Fixed

I have fixed the issue where Rules displayed "Unknown - Unknown" and the Edit form appeared empty.

## The Cause
The Setup was mismatched:
*   The Database returns **snake_case** (e.g. `priority_id`).
*   The Application expects **camelCase** (e.g. `priorityId`).

## The Fix
I updated the API (`api/defect-criteria/rules/route.ts`) to automatically transform the data. Now, when the app asks for rules, the server converts `priority_id` to `priorityId` before sending it.

## Verification
1.  **Refresh your browser**.
2.  The existing rules should now show their correct Priority and Defect names.
3.  Clicking "Edit" should now correctly populate the form with the saved data.
