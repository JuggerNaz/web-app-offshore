# RSEAB (ROV Seabed Inspection) GUI Plotting & Inspection Plan

## 1. Objective
To provide a graphical interface for ROV Seabed Inspections (`RSEAB`) that enables users to visually plot debris around an offshore platform. The interface must support dynamic layouts, constrained interaction, and automatic data synchronization.

## 2. GUI Design Specifications

### 2.1 Survey Grid
- **Geometry**: Supports both **Rectangular/Square** (standard) and **Triangular** (3-leg/Mono) survey grids.
- **Distance Markers**: Rendered as concentric lines at intervals defined by the SOW (e.g., 3m, 6m, 9m, ..., 21m).
- **Leg Representation**: Supports 3, 4, 6, 8, and 16 legged platforms in corresponding grid configurations.
- **Responsiveness**: SVG-based rendering with `viewBox` for fluid scaling across all screen sizes.

### 2.2 Debris Markers (Flags)
- **Visuals**: Numbered circles (1, 2, 3...).
- **Color Coding**: 
    - **Blue**: Metallic debris.
    - **Orange/Yellow**: Non-metallic debris.
- **Properties**: Stores item number, type, material, distance from leg, angle, face/sector, and normalized X/Y coordinates.

## 3. Interaction Logic (Constrained UI)

### 3.1 Drag-and-Drop
- Users can drag markers to refine positioning.
- **Radial Constraint**: Marker cannot be moved beyond the distance range of its assigned QID/SOW Item.
- **Sector Constraint**: Marker cannot be moved to a different Face or Side than its assigned sector.

### 3.2 Two-Way Workflows
- **Workflow A (Form-First)**: Enter data in the form -> GUI plots approx -> User drags to final spot -> X/Y saved.
- **Workflow B (GUI-First/Auto)**: User clicks grid -> System identifies QID/Face/Range -> Popover asks for Debris/Material -> Record auto-inserted.

## 4. Data Persistence
Data is stored in the `inspection_data` JSON column of `insp_records`:
- `debris`: String (Debris description)
- `debris_material`: String (Material description)
- `distance_from_leg`: Numeric (Calculated)
- `x`: Numeric (Normalized X coordinate, 0-100)
- `y`: Numeric (Normalized Y coordinate, 0-100)
- `face_area`: String (Sector identification)

## 5. Mockup

![RSEAB GUI Mockup](file:///C:/Users/nq352/.gemini/antigravity/brain/9ec1987b-3884-4e44-a1e6-dd345cefc265/seabed_debris_plot_rectangular_mockup_1776004564343.png)

## 6. Implementation Task List
- [ ] Create `SeabedDebrisPlot` SVG component with responsive scaling.
- [ ] Implement multi-leg coordinate generation logic.
- [ ] Implement `framer-motion` constrained drag handlers.
- [ ] Integrate with `ROVInspectionRecordingDialog` for dual workflows.
- [ ] Add auto-pickup logic for Workflow B (Reverse coordinate mapping).
- [ ] Finalize data persistence and reporting structure.
