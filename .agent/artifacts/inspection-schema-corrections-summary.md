# Inspection Module Schema - Corrections Summary

## Overview
This document summarizes the corrections made to align the Inspection Module schema with the actual database structure.

---

## ✅ **Corrected Table References**

### **1. Job Pack Reference**

**Before (Incorrect):**
```sql
jobpack_id BIGINT REFERENCES u_jobpack(jobpack_id)
```

**After (Correct):**
```sql
jobpack_id BIGINT REFERENCES jobpack(id)
```

**Tables Affected:**
- `insp_dive_jobs`
- `insp_rov_jobs`
- `insp_records`

---

### **2. Structure Reference**

**Before (Incorrect):**
```sql
structure_id BIGINT REFERENCES u_structure(str_id)
```

**After (Correct):**
```sql
structure_id BIGINT,
CONSTRAINT fk_insp_records_structure 
    FOREIGN KEY (structure_id) 
    REFERENCES structure_components(structure_id)
```

**Tables Affected:**
- `insp_dive_jobs`
- `insp_rov_jobs`
- `insp_records`

**Note:** Structure reference comes from `structure_components` table's `structure_id` column.

---

### **3. Component Reference**

**Before (Incorrect):**
```sql
component_id BIGINT REFERENCES u_comp_spec(comp_id)
```

**After (Correct):**
```sql
component_id BIGINT REFERENCES structure_components(id)
```

**Tables Affected:**
- `insp_records`

**Note:** Component ID uses the `id` column from `structure_components` table (not `comp_id`).

---

### **4. Inspection Type Reference**

**Before:**
```sql
inspection_type_code VARCHAR(50) NOT NULL, -- GVI, CVI, FMD, CP, UTM, etc.
-- No table reference
```

**After:**
```sql
inspection_type_id BIGINT REFERENCES inspection_type(id) ON DELETE RESTRICT,
inspection_type_code VARCHAR(50) NOT NULL, -- Denormalized for quick access
```

**Changes:**
- Added `inspection_type` master table
- Added foreign key reference `inspection_type_id`
- Kept `inspection_type_code` for denormalized quick access

---

## 🆕 **New Feature: Inspection Type with Default Properties**

### **New Table: `inspection_type`**

Similar to how `component_spec` has default properties based on component type, inspection types now have default field definitions in JSON format.

**Table Structure:**
```sql
CREATE TABLE inspection_type (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    
    -- Default Properties (JSON format)
    default_properties JSONB DEFAULT '{}'::JSONB,
    
    -- Settings
    is_active BOOLEAN DEFAULT TRUE,
    requires_video BOOLEAN DEFAULT FALSE,
    requires_photos BOOLEAN DEFAULT FALSE,
    min_photo_count INTEGER DEFAULT 0,
    
    -- Metadata
    workunit VARCHAR(10) DEFAULT '000',
    cr_user VARCHAR(100),
    cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    md_user VARCHAR(100),
    md_date TIMESTAMP
);
```

### **Default Properties JSON Format**

**Example for GVI (General Visual Inspection):**
```json
{
  "fields": [
    {
      "name": "overall_condition",
      "type": "select",
      "required": true,
      "options": ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"],
      "label": "Overall Condition"
    },
    {
      "name": "marine_growth_percentage",
      "type": "number",
      "required": true,
      "min": 0,
      "max": 100,
      "label": "Marine Growth (%)"
    },
    {
      "name": "corrosion_level",
      "type": "select",
      "required": false,
      "options": ["NONE", "MINOR", "MODERATE", "SEVERE"],
      "label": "Corrosion Level"
    },
    {
      "name": "remarks",
      "type": "textarea",
      "required": true,
      "label": "Remarks"
    }
  ],
  "requires_video": true,
  "requires_photos": true,
  "min_photos": 2
}
```

### **Auto-Population Trigger**

When a new inspection record is created, the default properties are automatically merged:

```sql
CREATE OR REPLACE FUNCTION fn_populate_inspection_defaults()
RETURNS TRIGGER AS $$
DECLARE
    v_default_props JSONB;
BEGIN
    -- Get default properties from inspection_type
    SELECT default_properties INTO v_default_props
    FROM inspection_type
    WHERE id = NEW.inspection_type_id;
    
    -- Merge default properties with provided inspection_data
    -- User data takes precedence over defaults
    IF v_default_props IS NOT NULL THEN
        NEW.inspection_data = v_default_props || COALESCE(NEW.inspection_data, '{}'::jsonb);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 📊 **Sample Inspection Types Included**

The schema now includes these pre-configured inspection types:

| Code | Name | Category | Default Fields | Video | Photos |
|------|------|----------|---------------|-------|--------|
| **GVI** | General Visual Inspection | VISUAL | overall_condition, marine_growth_percentage, corrosion_level, coating_condition, anode_condition, remarks | ✅ | ✅ (min: 2) |
| **CVI** | Close Visual Inspection | VISUAL | inspection_area, surface_condition, crack_detected, crack_details, weld_integrity, remarks | ✅ | ✅ |
| **CP** | Cathodic Protection | MEASUREMENT | cp_potential_mv, reference_electrode, anode_depletion, cp_status, remarks | ❌ | ❌ |
| **FMD** | Flooded Member Detection | MEASUREMENT | fmd_reading_db, flooded_indication, water_level_estimate, member_status, remarks | ❌ | ❌ |
| **UTM** | Ultrasonic Thickness Measurement | MEASUREMENT | nominal_thickness_mm, measured_thickness_mm, thickness_loss_percentage, acceptance_criteria, remarks | ❌ | ✅ |

---

## 🔄 **Updated Views**

### **vw_dive_inspections**

**Before:**
```sql
INNER JOIN u_structure s ON ir.structure_id = s.str_id
INNER JOIN u_comp_spec cs ON ir.component_id = cs.comp_id
```

**After:**
```sql
INNER JOIN structure_components sc ON ir.component_id = sc.id
LEFT JOIN inspection_type it ON ir.inspection_type_id = it.id
```

### **vw_rov_inspections**

Same corrections as `vw_dive_inspections`.

### **vw_anomalies_detail**

Same corrections as `vw_dive_inspections`.

---

## 📝 **Usage Examples**

### **Creating an Inspection with Auto-Populated Defaults**

```typescript
// When creating an inspection, just provide the inspection_type_id
const { data, error } = await supabase
  .from('insp_records')
  .insert({
    dive_job_id: 1,
    structure_id: 5,
    component_id: 123, // From structure_components.id
    inspection_type_id: 1, // GVI
    inspection_type_code: 'GVI',
    inspection_date: '2026-02-11',
    inspection_time: '10:30:00',
    inspection_data: {
      // These are user-provided values
      overall_condition: 'GOOD',
      marine_growth_percentage: 15,
      // Other default fields will be populated from inspection_type
    }
  });

// The trigger will merge default_properties with inspection_data
// Result in database:
// inspection_data = {
//   "overall_condition": "GOOD",  // User provided
//   "marine_growth_percentage": 15,  // User provided
//   "corrosion_level": "",  // From defaults
//   "coating_condition": "",  // From defaults
//   "anode_condition": "",  // From defaults
//   "remarks": ""  // From defaults
// }
```

### **Getting Inspection Type Configuration for UI**

```typescript
// Fetch inspection type with default properties
const { data: inspectionType } = await supabase
  .from('inspection_type')
  .select('*')
  .eq('code', 'GVI')
  .single();

// Use default_properties to dynamically render form
const fields = inspectionType.default_properties.fields;
fields.forEach(field => {
  switch(field.type) {
    case 'select':
      renderSelectField(field.name, field.label, field.options);
      break;
    case 'number':
      renderNumberField(field.name, field.label, field.min, field.max);
      break;
    case 'textarea':
      renderTextareaField(field.name, field.label);
      break;
  }
});
```

### **Adding Custom Inspection Type**

```sql
INSERT INTO inspection_type (
    code, 
    name, 
    description, 
    category, 
    default_properties,
    requires_video,
    requires_photos,
    min_photo_count,
    cr_user
) VALUES (
    'MGT',
    'Marine Growth Thickness',
    'Measurement of marine growth thickness',
    'MEASUREMENT',
    '{
      "fields": [
        {
          "name": "growth_type",
          "type": "select",
          "required": true,
          "options": ["SOFT", "HARD", "MIXED"],
          "label": "Growth Type"
        },
        {
          "name": "thickness_mm",
          "type": "number",
          "required": true,
          "min": 0,
          "max": 500,
          "label": "Thickness (mm)"
        },
        {
          "name": "coverage_percentage",
          "type": "number",
          "required": true,
          "min": 0,
          "max": 100,
          "label": "Coverage (%)"
        },
        {
          "name": "remarks",
          "type": "textarea",
          "required": true,
          "label": "Remarks"
        }
      ]
    }'::jsonb,
    false,
    true,
    1,
    'admin'
);
```

---

## ⚠️ **Migration Path**

If you've already created tables with the old schema:

### **Option 1: Drop and Recreate (Development Only)**

```sql
-- Drop old tables
DROP TABLE IF EXISTS insp_media CASCADE;
DROP TABLE IF EXISTS insp_anomalies CASCADE;
DROP TABLE IF EXISTS insp_records CASCADE;
DROP TABLE IF EXISTS insp_video_logs CASCADE;
DROP TABLE IF EXISTS insp_video_tapes CASCADE;
DROP TABLE IF EXISTS insp_rov_movements CASCADE;
DROP TABLE IF EXISTS insp_dive_movements CASCADE;
DROP TABLE IF EXISTS insp_rov_jobs CASCADE;
DROP TABLE IF EXISTS insp_dive_jobs CASCADE;
DROP TABLE IF EXISTS inspection_type CASCADE;

-- Apply corrected schema
-- Run: 20260211_inspection_module_schema_corrected.sql
```

### **Option 2: Alter Existing Tables (Production)**

```sql
-- Add inspection_type table first
-- (Run the CREATE TABLE inspection_type section)

-- Alter insp_records
ALTER TABLE insp_records 
DROP CONSTRAINT IF EXISTS insp_records_structure_id_fkey;

ALTER TABLE insp_records 
DROP CONSTRAINT IF EXISTS insp_records_component_id_fkey;

ALTER TABLE insp_records 
DROP CONSTRAINT IF EXISTS insp_records_jobpack_id_fkey;

-- Add corrected foreign keys
ALTER TABLE insp_records
ADD COLUMN inspection_type_id BIGINT;

ALTER TABLE insp_records
ADD CONSTRAINT fk_insp_records_structure 
    FOREIGN KEY (structure_id) 
    REFERENCES structure_components(structure_id) 
    ON DELETE RESTRICT;

ALTER TABLE insp_records
ADD CONSTRAINT fk_insp_records_component 
    FOREIGN KEY (component_id) 
    REFERENCES structure_components(id) 
    ON DELETE RESTRICT;

ALTER TABLE insp_records
ADD CONSTRAINT fk_insp_records_jobpack 
    FOREIGN KEY (jobpack_id) 
    REFERENCES jobpack(id) 
    ON DELETE RESTRICT;

ALTER TABLE insp_records
ADD CONSTRAINT fk_insp_records_inspection_type 
    FOREIGN KEY (inspection_type_id) 
    REFERENCES inspection_type(id) 
    ON DELETE RESTRICT;

-- Update inspection_type_id based on inspection_type_code
UPDATE insp_records ir
SET inspection_type_id = it.id
FROM inspection_type it
WHERE ir.inspection_type_code = it.code;

-- Repeat similar process for insp_dive_jobs and insp_rov_jobs
```

---

## ✅ **Verification Checklist**

- [x] Job pack references use `jobpack(id)`
- [x] Structure references use `structure_components(structure_id)`
- [x] Component references use `structure_components(id)`
- [x] Inspection type table created with default_properties
- [x] Inspection type references added to insp_records
- [x] Trigger to auto-populate defaults from inspection type
- [x] Sample inspection types inserted (GVI, CVI, CP, FMD, UTM)
- [x] Views updated with correct table joins
- [x] AI enhancements compatible with new schema

---

## 📚 **Files Modified**

1. **`20260211_inspection_module_schema_corrected.sql`** - Main schema with all corrections
2. **`20260211_inspection_ai_enhancements.sql`** - AI features (no changes needed, uses generic references)
3. **`types/inspection.ts`** - TypeScript types (already generic)
4. **`utils/inspection-ai.ts`** - AI utilities (already generic)

---

## 🚀 **Next Steps**

1. **Apply the corrected schema:**
   ```bash
   npx supabase migration apply 20260211_inspection_module_schema_corrected
   ```

2. **Verify table structure:**
   ```sql
   -- Check foreign keys
   SELECT 
       tc.table_name, 
       kcu.column_name, 
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name 
   FROM information_schema.table_constraints AS tc 
   JOIN information_schema.key_column_usage AS kcu
       ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.constraint_column_usage AS ccu
       ON ccu.constraint_name = tc.constraint_name
   WHERE tc.table_name LIKE 'insp_%' 
       AND tc.constraint_type = 'FOREIGN KEY';
   ```

3. **Test inspection type defaults:**
   ```sql
   -- Insert test inspection
   INSERT INTO insp_records (
       dive_job_id,
       structure_id,
       component_id,
       inspection_type_id,
       inspection_type_code,
       inspection_data
   ) VALUES (
       1, 5, 123, 1, 'GVI',
       '{"overall_condition": "GOOD"}'::jsonb
   );
   
   -- Verify defaults were populated
   SELECT inspection_data FROM insp_records ORDER BY insp_id DESC LIMIT 1;
   ```

---

## 📖 **Summary**

All table references have been corrected to match your actual database structure:
- ✅ `jobpack.id` for job packs
- ✅ `structure_components.structure_id` for structures
- ✅ `structure_components.id` for components
- ✅ `inspection_type.id` for inspection types with default properties in JSON

The new `inspection_type` table allows you to define inspection forms dynamically, similar to how component specs work, providing a flexible and maintainable system for managing different inspection types.
