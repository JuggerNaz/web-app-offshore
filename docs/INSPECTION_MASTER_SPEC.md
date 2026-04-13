# Inspection Module - Master Specification

## 1. Overview
The Inspection Module is a multi-tier system designed to facilitate the recording, monitoring, and reporting of offshore inspections (ROV and Diving). It bridges the gap between the **Scope of Work (SOW)** planning and the actual **Inspection Data** acquisition.

## 2. System Architecture

### 2.1 Landing & Selection Logic
The landing page (`/dashboard/inspection` and `/dashboard/inspection-v2`) handles the context selection for any inspection session.
- **Job Pack Selection**: Loads active job packs from `jobpack` table.
- **Structure Selection**: Filters structures based on job pack metadata.
- **SOW Report Selection**: Dynamically fetches report numbers from `u_sow` and `u_sow_items`.
- **State Persistence**: All selections are saved to `sessionStorage` (e.g., `inspection_jobpack`, `inspection_structure`) so users don't lose context when navigating back from a session.

### 2.2 Workspace Layout (v2)
The Workspace follows a multi-panel dashboard approach:
- **Header**: Displays persistent session info (Job Pack No, Structure, Tooling Mode).
- **Sidebar**: Contextual navigation (Component Selection, Task Lists).
- **Main Area**: The primary inspection form where data entry occurs.
- **Resource Panel**: Video feeds, live telemetry monitoring, and tape management.

## 3. Data Schema & Persistence

### 3.1 SOW Tracking (Planning)
- **`u_sow`**: Header record per structure in a job pack.
- **`u_sow_items`**: Individual component-inspection combinations.
- **Storage**: Sequential IDs (SERIAL) for efficiency; denormalized QIDs and Types for performance.

### 3.2 Inspection Records (Acquisition)
- **ROV Jobs (`insp_rov_jobs`)**: Stores deployment details (Serial No, Team, Timestamp).
- **Diving Jobs (`insp_dive_jobs`)**: Stores dive parameters (Max Depth, Diver Name, Team).
- **Inspection Data (`insp_rov_data` / `insp_dive_data`)**: Stores the actual measurements, conditions, and observations.

### 3.3 Unit Management & Hierarchical Preferences
Inspections use a tiered unit system:
1. **Session Preference**: Set manually in the workspace.
2. **Structure Default**: Defined in the Platform/Pipeline settings.
3. **System Default**: Metric (mm, kg, m).
- **Persistence**: Data is stored as `field_name` (numeric value) and `field_name_unit` (the unit string at capture time).

## 4. Inspection Specification (JSON Driven)
The module utilizes a centralized JSON specification (`utils/types/inspection-types.json`) to define fields for different inspection types (GVI, CVI, UT, CP, etc.).
- **Dynamic Forms**: `InspectionForm` renders inputs based on the JSON spec.
- **Unit Categories**: Fields define their unit category (e.g., LENGTH, MASS) to trigger appropriate unit selectors.

## 5. ROV vs. Diving Modules

| Feature | ROV Module | Diving Module |
|---------|------------|---------------|
| **Primary Data** | Depth, Heading, Altitude | Depth, Dive Duration, Temperature |
| **Telemetry** | Serial/Network stream | Manual/Timer based |
| **Team Roles** | Operator, Supervisor | Diver, Standby Diver, Supervisor |
| **Visuals** | ROV Feed Overlays | Diver Camera Overlays |

## 6. Logic Workflows

### 6.1 Deployment Workflow
1. **Selection**: User selects JP/Str/SOW.
2. **Landing Dashboard**: Shows historical records and "New Deployment" button.
3. **Session Start**: Opens `SetupDialog` to create the Job record in DB.
4. **Recording**: Enables video feed, live data, and inspection forms.

### 6.2 Inspection Recording
1. **Component Selection**: Select from structural tree or denormalized list.
2. **Type Mapping**: Inspection type is pulled from the SOW report context.
3. **Data Entry**: Fields are generated from the Master JSON spec.
4. **Validation**: Checks for required fields and proper unit selection.
5. **Auto-Update**: Saving a record triggers `u_sow_items` status updates via database triggers.

## 7. Reference Documentation
For deep dives into specific subsystems, refer to:
- [SOW System Details](../docs/SOW_SYSTEM.md)
- [Unit Specification Logic](../INSPECTION_UNIT_SPEC.md)
- [Dashboard Redesign Guide](../INSPECTION_DASHBOARD_REDESIGN.md)
- [Diving Module Implementation](../DIVING_INSPECTION_MODULE.md)
