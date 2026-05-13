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

### C. Active Sector Highlighting
When an inspection task is active for a specific Seabed Survey QID (e.g., `S/BED(A2-B2)-27M`):
*   **Visual Feedback**: The matching QID text on the map is highlighted in bold blue.
*   **Spatial Overlay**: A semi-transparent blue pulse is rendered over the corresponding sector area (e.g., the zone between legs A2 and B2 at the 27M boundary).
*   **Label Emphasis**: Distance markers associated with the active sector are scaled up and colored blue for better visibility.

### D. Automatic Pagination
The survey map supports extended distance ranges by paging the 21m grid:
*   **Distance Detection**: The system parses the distance from the active inspection QID (e.g., `27M` from `S/BED(A2-B2)-27M`).
*   **Auto-Switching**: If the distance exceeds the current 21m view, the map automatically flips to the correct "page" (e.g., Page 2 for 21m–42m, Page 3 for 42m–63m).
*   **Seamless Context**: This ensures that when an operator starts a task at a far distance, the map is already focused on the correct sector without manual paging.
