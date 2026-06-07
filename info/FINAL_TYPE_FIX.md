# Fixed Defect Type Refresh & Filters

I have updated the logic to be more intelligent about how it finds the Defect Types.

1.  **Correct Filtering**: I've applied the filter `lib_delete is null OR 0` to the combo table as requested.
2.  **Smarter Matching**: I also updated the code to check BOTH the **ID** (e.g., 415) and the **Value** (e.g., "PHY"). This means the list will populate correctly regardless of how the database links the records.

## Action Item
1.  **Refresh your browser** (`Ctrl + F5`).
2.  Select a Defect Code.
3.  The Defect Type list should now appear correctly.
