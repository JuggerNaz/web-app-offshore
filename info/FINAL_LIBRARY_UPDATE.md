# Library Logic Updated

I have updated the filter logic for Priorities, Defect Codes, and Defect Types as requested:

1.  **Filter Logic**: Now explicitly checks that `lib_delete` is either **NULL** or **'0'**. This ensures items are listed unless they are explicitly marked as deleted ('1'), and handles cases where the delete flag is missing (NULL).
2.  **Dynamic Refresh**: The "Defect Type" list will automatically refresh whenever you select a "Defect Code".

## Action Item
1.  **Refresh your browser** (`Ctrl + F5`).
2.  Open the "Add Criteria Rule" dialog.
3.  Select a Defect Code -> The Defect Types should load immediately.
