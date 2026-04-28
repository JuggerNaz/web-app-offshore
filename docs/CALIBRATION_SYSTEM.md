# Dive Calibration System Documentation

This document outlines the architecture, data flow, and workflow for **Cathodic Protection (CP) Calibration** and **Ultrasonic Testing (UT) Calibration** within the Diving Inspection Module.

## Overview

Calibration data ensures the accuracy of measurements taken underwater. Unlike standard inspections, calibration is **linked to the Dive Deployment (Dive No)**, not to specific components. 

Calibration involves capturing data:
1. **Pre-Dive:** Before the diver enters the water (e.g., equipment checks).
2. **Post-Dive:** After the diver returns (e.g., verification checks).

## Data Structure

Calibration data is stored in the `insp_records` table with the following specifics:
- **Component ID:** Omitted (`NULL`).
- **Inspection Type Codes:** 
  - `CPCLB` for CP Calibration.
  - `UTCLB` for UT Calibration.
- **Data Storage:** Specific metrics are stored as a JSON payload in the `inspection_data` field.

### CP Calibration (`CPCLB`)
Fields defined in `utils/types/inspection-types.json`:
- `calib_equipment_type`: Combo (EQUP_TYP)
- `serial_number`: Text
- `calib_block`: Text
- `pre_dive_cp_rdg`: Voltage (mV)
- `in_water1`, `in_water2`, `in_water3`: Voltage (mV)
- `post_dive_cp_rdg`: Voltage (mV)

### UT Calibration (`UTCLB`)
Fields defined in `utils/types/inspection-types.json`:
- `calib_equipment_type`: Combo (EQUP_TYP)
- `serial_number`: Text
- `probe`, `probe_size`, `probe_frequency`: Text
- `calib_block`: Text
- `label01` - `label06`: Text
- `reading01` - `reading06`: Number

## Workflow

### 1. Data Entry
- **Location:** The Calibration entry point is located in the **Deployment Banner** on the Dive Workspace page (`app/dashboard/inspection/dive/page.tsx`).
- **Action:** Clicking the "Calibration Setup" button opens a dialog allowing users to enter Pre-Dive and Post-Dive metrics.

### 2. Contextual Reference
- When a user performs a component inspection (e.g., `CPSURV` or `UTWTK`), the system fetches the relevant calibration record for the active dive.
- A read-only panel displays the calibration data at the top of the inspection form.

### 3. Reporting
- Inspection reports automatically embed the associated calibration data for the dive.
