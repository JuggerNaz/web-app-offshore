-- Fix missing columns in inspection_type causing trigger error
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='inspection_type' AND column_name='md_date') THEN
        ALTER TABLE inspection_type ADD COLUMN md_date TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='inspection_type' AND column_name='md_user') THEN
        ALTER TABLE inspection_type ADD COLUMN md_user VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='inspection_type' AND column_name='cr_date') THEN
        ALTER TABLE inspection_type ADD COLUMN cr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='inspection_type' AND column_name='cr_user') THEN
        ALTER TABLE inspection_type ADD COLUMN cr_user VARCHAR(100);
    END IF;
END $$;

-- Add description (findings) column to insp_records if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='insp_records' AND column_name='description') THEN
        ALTER TABLE insp_records ADD COLUMN description TEXT;
    END IF;
END $$;

-- Update status check constraint to include 'INCOMPLETE'
ALTER TABLE insp_records DROP CONSTRAINT IF EXISTS chk_insp_status;
ALTER TABLE insp_records ADD CONSTRAINT chk_insp_status CHECK (status IN ('DRAFT', 'COMPLETED', 'REVIEWED', 'APPROVED', 'INCOMPLETE'));

-- Add incomplete_reason column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='insp_records' AND column_name='incomplete_reason') THEN
        ALTER TABLE insp_records ADD COLUMN incomplete_reason TEXT;
    END IF;
END $$;

-- Populate default_properties for common inspection types
-- GVI (General Visual Inspection)
UPDATE inspection_type 
SET default_properties = '[
    {"name": "general_condition", "label": "General Condition", "type": "select", "options": ["Good", "Fair", "Poor", "Damaged"], "required": true},
    {"name": "marine_growth_type", "label": "Marine Growth Type", "type": "select", "options": ["Hard", "Soft", "Mixed", "None"], "required": false},
    {"name": "avg_mg_thickness", "label": "Avg MG Thickness (mm)", "type": "number", "required": false},
    {"name": "coating_condition", "label": "Coating Condition", "type": "select", "options": ["Intact", "Blistered", "Peeling", "Missing", "N/A"], "required": false},
    {"name": "corrosion_level", "label": "Corrosion Level", "type": "select", "options": ["None", "Light", "Moderate", "Severe"], "required": false},
    {"name": "coating_breakdown_percent", "label": "Coating Breakdown %", "type": "number", "min": 0, "max": 100, "required": false},
    {"name": "debris_observed", "label": "Debris Observed", "type": "boolean", "required": false}
]'::jsonb
WHERE code IN ('GVI', 'GVINS');

-- CVI (Close Visual Inspection)
UPDATE inspection_type 
SET default_properties = '[
    {"name": "specific_defect_type", "label": "Defect Type", "type": "select", "options": ["Crack", "Dent", "Gouge", "Pitting", "Weld Defect", "Other"], "required": true},
    {"name": "dimensions_l_w_d", "label": "Dimensions (LxWxD mm)", "type": "text", "required": true},
    {"name": "orientation", "label": "Orientation (o''clock)", "type": "text", "required": false},
    {"name": "cleaning_status", "label": "Cleaning Status", "type": "select", "options": ["As Found", "Cleaned to Sa2.5", "Cleaned to Sa3", "Wire Brushed"], "required": true},
    {"name": "photographed", "label": "Photographed", "type": "boolean", "required": true}
]'::jsonb
WHERE code IN ('CVI', 'CVINS');

-- CP (Cathodic Protection)
UPDATE inspection_type 
SET default_properties = '[
    {"name": "cp_reading_mv", "label": "CP Reading (-mV)", "type": "number", "required": true},
    {"name": "reference_electrode", "label": "Reference Electrode", "type": "select", "options": ["Ag/AgCl", "Zn", "Unknown"], "default": "Ag/AgCl", "required": true},
    {"name": "contact_type", "label": "Contact Type", "type": "select", "options": ["Probed", "Remote", "Stabbed"], "required": false},
    {"name": "calibration_checked", "label": "Calibration Checked", "type": "boolean", "required": false}
]'::jsonb
WHERE code IN ('CP', 'CPINS', 'CPROB');

-- UT (Ultrasonic Thickness)
UPDATE inspection_type 
SET default_properties = '[
    {"name": "avg_reading_mm", "label": "Avg Thickness (mm)", "type": "number", "required": true},
    {"name": "min_reading_mm", "label": "Min Thickness (mm)", "type": "number", "required": true},
    {"name": "nominal_thickness", "label": "Nominal Thickness (mm)", "type": "number", "required": false},
    {"name": "scan_type", "label": "Scan Type", "type": "select", "options": ["Spot", "Scan", "Grid"], "required": true},
    {"name": "surface_condition", "label": "Surface Condition", "type": "select", "options": ["Smooth", "Rough", "Pitted"], "required": false}
]'::jsonb
WHERE code IN ('UT', 'UTINS', 'UTW');

-- MPI (Magnetic Particle Inspection)
UPDATE inspection_type 
SET default_properties = '[
    {"name": "indication_found", "label": "Indication Found", "type": "boolean", "required": true},
    {"name": "indication_type", "label": "Indication Type", "type": "select", "options": ["Linear", "Rounded", "Crack", "Inclusion", "None"], "required": false},
    {"name": "indication_length_mm", "label": "Length (mm)", "type": "number", "required": false},
    {"name": "magnetization_method", "label": "Magnetization Method", "type": "select", "options": ["Yoke", "Prod", "Coil"], "required": true},
    {"name": "particles_type", "label": "Particles", "type": "select", "options": ["Wet Fluorescent", "Dry Powder", "Contrast Paint"], "required": true}
]'::jsonb
WHERE code IN ('MPI', 'MPINS');

-- FMD (Flooded Member Detection)
UPDATE inspection_type 
SET default_properties = '[
    {"name": "member_status", "label": "Member Status", "type": "select", "options": ["Flooded", "Dry", "Inconclusive"], "required": true},
    {"name": "reading_value", "label": "Reading Value", "type": "number", "required": false},
    {"name": "unit", "label": "Unit", "type": "text", "default": "counts/sec", "required": false},
     {"name": "test_point_location", "label": "Test Point Location", "type": "text", "required": true}
]'::jsonb
WHERE code IN ('FMD', 'FMDINS');
