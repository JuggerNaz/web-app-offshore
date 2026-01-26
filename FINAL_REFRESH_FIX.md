# Defect Type Refresh Fixed

I have applied the `lib_delete` filter to the internal **Combo Table** (`u_lib_combo`) as well. This ensures that the link between "Defect Code" and "Defect Type" respects the deleted status properly.

## Action Item
1.  **Refresh your browser**.
2.  **Select a Defect Code**.
3.  The **Defect Type** list should now appear.

## Troubleshooting
If the list is **still empty**, it likely means the database links "Codes" by their **Name** (e.g., 'PHY') rather than their **ID** (e.g., '101').

If that happens, please run the SQL script I provided earlier (`INSPECT_RELATIONS.sql`) and share the output so I can adjust the code to match your database structure.
