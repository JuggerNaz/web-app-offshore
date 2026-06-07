# Inspection Type Specification & Unit Management System

This document outlines the architecture for a centralized, JSON-driven inspection specification system that includes robust unit management (Metric/Imperial) with hierarchical preferences.

## 1. Overview
The goal is to move away from storing complex field definitions in the database (`inspection_type.default_properties`) and instead use a versioned JSON specification. This system also handles tiered unit preferences:
1. **Inspection Session**: Overrides all other settings.
2. **Structure Default**: Defined per Platform/Pipeline.
3. **System Default**: Global fallback (METRIC).

## 2. Data Structure

### `utils/types/inspection-types.json`
Central registry of inspection codes and their fields.
```json
{
  "inspectionTypes": [
    {
      "code": "GVI",
      "fields": [
        {
          "name": "avg_mg_thickness",
          "label": "Avg MG Thickness",
          "type": "number",
          "unitCategory": "LENGTH"
        },
        {
          "name": "marine_growth_type",
          "label": "Marine Growth Type",
          "type": "combo",
          "lib_code": "MGI"
        }
      ]
    }
  ]
}
```

### `utils/types/units.json`
Defines available units per category.
```json
{
  "LENGTH": {
    "metric": ["mm", "cm", "m"],
    "imperial": ["in", "ft"],
    "defaultMetric": "mm",
    "defaultImperial": "in"
  },
  "MASS": {
    "metric": ["g", "kg"],
    "imperial": ["lb"],
    "defaultMetric": "kg",
    "defaultImperial": "lb"
  }
}
```

## 3. Tiered Preference Logic
The application determines the active unit system using the following priority:
- `currentSessionUnit`: Set by the user in the Cockpit/Workspace.
- `structureUnit`: Fetched from `structure.unit_system` (stored in `platform.unit` or `u_pipeline.def_unit`).
- **Default**: `METRIC`.

## 4. UI Implementation
- **InspectionField**: Automatically detects `unitCategory`.
- **Unit Selector**: Displays a small toggle/dropdown next to numeric inputs.
- **Persistence**: 
    - Value: `field_name` (e.g., `12.5`)
    - Unit: `field_name_unit` (e.g., `"mm"`)

## 5. Synchronization
A utility script `scripts/seed_inspection_types_from_json.js` allows syncing this JSON specification back to the `inspection_type` database table for reporting and legacy compatibility.
