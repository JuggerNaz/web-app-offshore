# SOW Status and Synchronization Rules

This document outlines the rules for Scope of Work (SOW) status updates and synchronization within the offshore inspection system.

## 1. Status Definitions

*   **Pending**: No inspection record exists for the component and task, or all associated elevation ranges are pending.
*   **Completed**: At least one inspection record exists for the component and task, and its status is "COMPLETE". For elevation-bound items, all required elevation ranges must have at least one "COMPLETE" record.
*   **Incomplete**: At least one inspection record exists with a status of "INCOMPLETE", or (for elevation-bound items) some ranges are completed while others are still pending.

## 2. Synchronization Triggers

SOW status is automatically synchronized in the following scenarios:

### A. New Record Creation
When a new inspection record is saved, the system identifies the associated SOW item and updates its status based on the new record.
*   If the record is "COMPLETE", the SOW item status moves to "completed" (unless other elevation ranges are still pending).
*   If the record is "INCOMPLETE", the SOW item status moves to "incomplete".

### B. Record Deletion
When an inspection record is deleted:
*   The system checks if any other records exist for the same component and task.
*   If **no other records exist**, the SOW item status is reset to **Pending**.
*   If other records exist, the status is recalculated based on the remaining records (following the rules in Section 1).

### C. Manual Correction (Correction Tool)
The "Correct Status" button in the SOW module triggers a full reconciliation:
*   **Status Update**: Iterates through all SOW items and verifies their status against the `insp_records` table.
*   **Missing Item Insertion**: If an inspection record exists for a component/task that is NOT currently in the SOW, the tool will automatically insert a new SOW item to ensure the scope is comprehensive.

## 3. Elevation-Bound Logic
For components requiring multi-point inspections (e.g., Risers, Caissons):
*   Status is tracked per elevation range.
*   An elevation range is "Completed" if a record exists within that specific range (min/max elevation).
*   The overall SOW item status is only "Completed" if **all** defined ranges are completed.

## 4. Database Parity
*   **insp_records**: The source of truth for all offshore observations.
*   **u_sow_items**: The tracking layer for project progress.
*   Any manual changes to `insp_records` (via DB or Admin) may require running the **Correction Tool** to restore parity.

## 5. Seabed Survey Spatial Rules

The Seabed Survey map and debris registration follow specific spatial and business rules for leg identification:

### A. Leg Metadata Selection (LG Components)
When identifying a leg (e.g., "A1") for spatial calculations or display, the system selects the "LG" component from `structure_components` using these criteria:
*   **Active Status**: The `del` field must be `null` or `0`.
*   **Identity Match**: The `f_leg` and `s_leg` fields in the component metadata must both match the leg name (e.g., `f_leg: "A1", s_leg: "A1"`). Fallback: QID matches "LEG A1" or "A1".
*   **Vertical Span**: The component must have different start and end nodes (`f_node !== s_node`).
*   **Elevation Range**: `elv_1` and `elv_2` define the vertical span. The system identifies the "bottom" by picking the minimum value between the two.
*   **Display**: On the survey map, the system dynamically identifies the lowest elevation (e.g., -29m) and displays its corresponding node number (**f_node** for `elv_2` or **s_node** for `elv_1`).

### B. SD Component Inheritance
When a new Seabed Debris (SD) component is registered between two legs:
*   **Nodes**: Inherits `f_node` and `s_node` from the selected "LG" segments of the adjacent legs.
*   **Elevation**: Inherits the bottom elevation (`elv_2`) from the legs to populate its own spatial metadata.
