# Dynamic Inspection System Implementation

This document outlines the architecture, logic, and workflow for the Dynamic Inspection Specification system implemented in the Offshore Web App.

## 1. Architecture Overview

The system transitions from a static, file-based configuration to a fully dynamic, database-driven architecture:
- **Source of Truth**: The `inspection_type` table in the database.
- **Editing Tool**: Local `utils/types/inspection-types.json` for easy development.
- **Bridge**: `scripts/sync-specs.mjs` synchronization utility.
- **Consumer**: `WorkspaceV2Page.tsx` fetches and resolves specifications in real-time.

## 2. Dynamic Spec Resolution (The "Union" Strategy)

To ensure high data integrity and prevent "losing" fields during updates, the system uses a three-tier field resolution strategy:

1. **Current Spec**: Loaded from the `inspection_type.default_properties`.
2. **Component Overrides**: If the selected component matches a specific type (e.g., `ANODE` or `PIPELINE`), fields can be added, replaced, or hidden on a per-component basis.
3. **Legacy Data Recovery**: If a record is being edited and contains data for a field no longer in the current spec, that field is **dynamically restored** as a "Legacy" field labeled in the UI.

## 3. Unit Management System

Numerical fields support categorization and dual-unit selection (Metric & Imperial).

### Configuration
In `inspection-types.json`, numerical fields are tagged with a `unitCategory`:
```json
{
  "name": "avg_mg_thickness",
  "label": "Avg MG Thickness",
  "type": "number",
  "unitCategory": "LENGTH"
}
```

### Features
- **Global Preference**: Initial units are set based on `company_settings.def_unit`.
- **Manual Selection**: Users can select any unit within the category (e.g., `m`, `cm`, `mm`, `in`, `ft` for `LENGTH`) directly in the property sheet.
- **Persistence**: Both the numerical value and the chosen unit are saved (e.g., `avg_mg_thickness` and `avg_mg_thickness_unit`).
- **Standard ISO**: Conversions and calculations follow standard ISO mappings.

## 4. Component-Specific Overrides

Specifications can be customized per component type. This uses a **Replace/Hide** basis:
- If a component override section provides a `fields` list, it replaces the standard fields for that component.
- This allows for highly specialized forms without creating hundreds of different inspection type codes.

## 5. Developer Workflow

To update inspection specifications:
1. Edit `utils/types/inspection-types.json` in VS Code.
2. You can simply run `npm run sync-specs` whenever you update your local `inspection-types.json` to push those changes to the database instantly.
   ```bash
   npm run sync-specs
   ```
3. The script will upsert the changes into the `inspection_type` table.
4. Refresh the Workspace page—the changes will appear instantly via the database fetch.

## 6. Shared Fields and References ($ref)

To avoid repetition of common fields (like coordinates, CP readings, or environmental conditions), the system supports a reference system.

### Configuration
1. Define common fields in the `sharedFields` object at the top of `inspection-types.json`.
2. Reference them in any `fields` list using `{ "$ref": "field_name" }`.

```json
{
  "sharedFields": {
    "northing": { "name": "northing", "label": "Northing", "type": "text" }
  },
  "inspectionTypes": [
    {
      "code": "RGVI",
      "fields": [
        { "$ref": "northing" },
        { "name": "debris", "$ref": "debris", "type": "combo" } 
      ]
    }
  ]
}
```

### Overrides within Refs
You can override specific properties of a shared field by adding them alongside the `$ref` key. The local property will take precedence over the shared definition.

## 7. UI/UX: Spec Morphing

---
**Maintained by**: AI Engineering Team
**Last Integrated**: 2026-04-10
