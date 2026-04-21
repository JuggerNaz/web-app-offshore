# Marine Growth Inspection (MGI) Profiler Guide

## Overview
The Marine Growth Inspection (MGI) Profiler is a specialized system designed to manage and validate thickness measurements for marine growth during subsea inspections. It allows operators to define depth-dependent thresholds that automatically trigger anomalies when exceeded.

## Core Concepts

### 1. MGI Profiles
Profiles are collections of depth thresholds and maximum allowable thickness values.
*   **Global Profile**: A default set of rules that apply across the entire asset unless overridden. Only one global profile can be "Active" at a time.
*   **Job-Specific Profile**: A profile linked to a particular Jobpack. This override is useful for specific surveys where localized environmental conditions or engineering requirements differ from the global standard.

### 2. Elevation Label Resolution
To simplify operation, the system supports natural language elevation labels which are resolved in real-time based on the platform's **Water Depth (WD)**:

| Label | Description | Calculation |
| :--- | :--- | :--- |
| **MSL** | Mean Sea Level | Resolves to 0.0m |
| **1/4 WD** | One-quarter Water Depth | Resolves to 0.25 * WD |
| **1/3 WD** | One-third Water Depth | Resolves to 0.33 * WD |
| **1/2 WD** | Half Water Depth | Resolves to 0.50 * WD |
| **2/3 WD** | Two-thirds Water Depth | Resolves to 0.67 * WD |
| **3/4 WD** | Three-quarters Water Depth | Resolves to 0.75 * WD |
| **Mudline** | Seabed / Bottom | Resolves to 1.00 * WD |

> [!NOTE]
> All labels are resolved using the `water_depth` value defined in the Platform metadata.

### 3. Custom Depth Entry
If a specific threshold is required at a depth not covered by presets (e.g., -125.5m), the operator can select **"Custom Value..."**. This enables a numeric input field to specify the exact depth in meters.

---

## Technical Integration

### Inspection Form Validation
During an ROV inspection (MGI or RMGI task type):
1.  The system identifies the **Active MGI Profile**.
2.  It monitors the **Verification Depth** input.
3.  It resolves the profile's thresholds into absolute numbers.
4.  If the measured `Soft Thickness` or `Hard Thickness` exceeds the threshold for that depth, the inspection status is automatically switched to **Anomaly**.

### SOW Progress Synchronization
MGI tasks often involve multiple elevations for a single component (e.g., Leg A1).
*   **Elevation Breakups**: SOW items can be configured with `elevation_required: true`.
*   **Automatic Progress**: When a record is committed at a specific depth, the system searches the SOW item's `elevation_data` and marks the matching range as completed.
*   **Audit Trail**: The active `mgi_profile_id` is stored within every inspection record's metadata for historical verification.

---

## Configuration Workflow
1.  Navigate to **Settings > MGI Profiler**.
2.  Create a **New Profile**.
3.  Add **Segments** (Elevation and Max Thickness).
4.  Set the profile as **Active** or link it to a **Jobpack** via the "Jobwise" tab.
5.  In the **Inspection Workspace**, ensure the Platform header displays the correct `Water Depth` for accurate label resolution.
