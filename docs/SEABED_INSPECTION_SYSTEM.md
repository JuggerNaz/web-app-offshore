# Seabed Survey Inspection System (RSEAB)

This document outlines the technical implementation, visual logic, and operational procedures for the ROV Seabed Inspection module.

## 1. Categorization & Visual Logic

The system uses a standardized color-coding scheme across the interactive GUI and the generated PDF reports to ensure immediate visual identification of seabed findings.

| Category | Primary Field | Logic | Color | Hex / Class |
| :--- | :--- | :--- | :--- | :--- |
| **Metallic Debris** | `material` | Strict match: `'Metallic'` | **Blue** | `#1d4ed8` / `blue-700` |
| **Non-Metallic** | `material` | Strict match: `'Non-Metallic'` | **Orange** | `#ea580c` / `orange-600` |
| **Gas Seepage** | `category` | Match: `'Gas Seepage'` | **Green** | `#16a34a` / `green-600` |
| **Crater** | `category` | Match: `'Crater'` | **Purple** | `#9333ea` / `purple-600` |

### 1.1 Marker States
- **Normal**: Solid colored circle with white label/number.
- **Active/Selected**: Maintains category color but adds a **Cyan (#22d3ee)** stroke and a pulsing glow effect to indicate selection.
- **List Identity**: The registered items list on the left uses the same color indicators (Blue, Orange, Green, Purple) to ensure one-to-one visual mapping with the map markers.
- **Hover**: Tooltip appears showing QID, description, and exact coordinates.

---

## 2. Interactive Features

### 2.1 Live Mode Constraints
- **Registration**: Inserting a new survey flag (Click-to-Drop) is **ONLY** allowed when the Video Log is in **Active Recording** state.
- **Validation**: If the video is "Stopped" or "Paused," the system will prevent marker creation and alert the user.
- **Post-Refinement**: Moving/Dragging existing markers is permitted regardless of video state to allow for precise coordinate adjustments after the event is captured.

### 2.2 Coordinate Mapping
- The GUI uses a normalized mapping system (0-100) on an SVG canvas.
- It automatically calculates **Distance from Leg**, **Angle**, and **Face/Sector** based on the marker's proximity to the platform legs.
- Supports both **Rectangular** (4, 6, 8, 16 legs) and **Triangular** (3 legs) layouts.

---

## 3. Data Schema (RSEAB)

The system persists data into the `inspection_data` JSONB column of `insp_records`.

| Field | Description | Type |
| :--- | :--- | :--- |
| `category` | Primary classification (Debris, Gas Seepage, Crater). | String |
| `material` | Material type for Debris only (Metallic, Non-Metallic). | Enum |
| `size_dimensions` | Dimensions of the object (e.g., "2m x 1m"). | String |
| `seepage_intensity` | Intensity level for Gas Seepage findings. | String |
| `crater_diameter` | Diameter of the seabed crater. | Float |
| `crater_depth` | Depth of the seabed crater. | Float |
| `x` / `y` | Normalized canvas coordinates. | 0.00 - 100.00 |

---

## 4. Reporting Procedures

### 4.1 Synchronized PDF Reports
The `seabed-survey-report.ts` generator is hard-coded to mirror the GUI logic:
1. **Map Re-generation**: Every PDF page includes a graphical map plot showing the markers in their relative positions.
2. **Legend Implementation**: A static legend is printed above each map to define the color codes.
3. **Strict Evaluation**: The reporting engine uses strict equality for material checks to ensure finding metadata (like "Fishing Net") correctly routes to the "Non-Metallic" orange markers.

---

## 5. Maintenance & Updates
- **Schema Sync**: When updating the `inspection-types.json` master spec, ensure the `sync-specs.mjs` script is executed using the Service Role key to propagate field changes to the Supabase backend.
- **Coordinate Calibration**: If the grid distance intervals change in the SOW, update the `gridDistances` prop in the `SeabedSurveyGuiInline` component.
