-- ============================================================================
-- Populate Required Library Items for Defect Criteria System
-- ============================================================================
-- This migration adds the required library items for the defect criteria system
-- LIB_CODE values: AMLY_TYP (Priority), AMLY_COD (Defect Code), AMLY_FND (Defect Type)
-- ============================================================================

-- ============================================================================
-- AMLY_TYP: Anomaly/Defect Priority Types
-- ============================================================================
INSERT INTO u_lib_list (lib_code, lib_desc, lib_delete, cr_user, cr_date, workunit, platform_type)
VALUES
    ('AMLY_TYP', 'Critical', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_TYP', 'High', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_TYP', 'Medium', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_TYP', 'Low', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_TYP', 'Informational', '0', 'system', NOW(), '000', 'PLATFORM')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- AMLY_COD: Anomaly/Defect Codes
-- ============================================================================
INSERT INTO u_lib_list (lib_code, lib_desc, lib_delete, cr_user, cr_date, workunit, platform_type)
VALUES
    -- Corrosion Related
    ('AMLY_COD', 'Corrosion', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_COD', 'Pitting', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_COD', 'General Corrosion', '0', 'system', NOW(), '000', 'PLATFORM'),
    
    -- Structural Damage
    ('AMLY_COD', 'Crack', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_COD', 'Dent', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_COD', 'Deformation', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_COD', 'Buckling', '0', 'system', NOW(), '000', 'PLATFORM'),
    
    -- Coating/Protection
    ('AMLY_COD', 'Coating Damage', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_COD', 'Anode Depletion', '0', 'system', NOW(), '000', 'PLATFORM'),
    
    -- Mechanical
    ('AMLY_COD', 'Loose Connection', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_COD', 'Missing Component', '0', 'system', NOW(), '000', 'PLATFORM'),
    
    -- Marine Growth
    ('AMLY_COD', 'Marine Growth', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_COD', 'Biofouling', '0', 'system', NOW(), '000', 'PLATFORM'),
    
    -- Other
    ('AMLY_COD', 'Other', '0', 'system', NOW(), '000', 'PLATFORM')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- AMLY_FND: Anomaly/Defect Findings (Types)
-- ============================================================================
-- These will be populated via U_LIB_COMBO to link specific types to defect codes
-- For now, we'll add common finding types
INSERT INTO u_lib_list (lib_code, lib_desc, lib_delete, cr_user, cr_date, workunit, platform_type)
VALUES
    -- Corrosion Findings
    ('AMLY_FND', 'Surface Corrosion', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_FND', 'Deep Pitting', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_FND', 'Shallow Pitting', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_FND', 'Uniform Corrosion', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_FND', 'Localized Corrosion', '0', 'system', NOW(), '000', 'PLATFORM'),
    
    -- Crack Findings
    ('AMLY_FND', 'Hairline Crack', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_FND', 'Structural Crack', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_FND', 'Weld Crack', '0', 'system', NOW(), '000', 'PLATFORM'),
    
    -- Dent Findings
    ('AMLY_FND', 'Minor Dent', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_FND', 'Major Dent', '0', 'system', NOW(), '000', 'PLATFORM'),
    
    -- Coating Findings
    ('AMLY_FND', 'Coating Disbondment', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_FND', 'Coating Blistering', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_FND', 'Coating Peeling', '0', 'system', NOW(), '000', 'PLATFORM'),
    
    -- Anode Findings
    ('AMLY_FND', 'Anode Depleted >75%', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_FND', 'Anode Depleted 50-75%', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_FND', 'Anode Depleted <50%', '0', 'system', NOW(), '000', 'PLATFORM'),
    
    -- Marine Growth Findings
    ('AMLY_FND', 'Light Marine Growth', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_FND', 'Moderate Marine Growth', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_FND', 'Heavy Marine Growth', '0', 'system', NOW(), '000', 'PLATFORM'),
    
    -- Deformation Findings
    ('AMLY_FND', 'Minor Deformation', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_FND', 'Severe Deformation', '0', 'system', NOW(), '000', 'PLATFORM'),
    
    -- Generic
    ('AMLY_FND', 'Visual Observation', '0', 'system', NOW(), '000', 'PLATFORM'),
    ('AMLY_FND', 'Requires Further Investigation', '0', 'system', NOW(), '000', 'PLATFORM')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- U_LIB_COMBO: Link Defect Codes to Defect Types
-- ============================================================================
-- This creates relationships between AMLY_COD and AMLY_FND
-- Format: parent_id (AMLY_COD) -> child_id (AMLY_FND)

-- First, we need to get the IDs, so we'll use a function to populate combos
DO $$
DECLARE
    corrosion_id UUID;
    pitting_id UUID;
    general_corrosion_id UUID;
    crack_id UUID;
    dent_id UUID;
    coating_damage_id UUID;
    anode_depletion_id UUID;
    marine_growth_id UUID;
    deformation_id UUID;
BEGIN
    -- Get Defect Code IDs
    SELECT lib_id INTO corrosion_id FROM u_lib_list WHERE lib_code = 'AMLY_COD' AND lib_desc = 'Corrosion' LIMIT 1;
    SELECT lib_id INTO pitting_id FROM u_lib_list WHERE lib_code = 'AMLY_COD' AND lib_desc = 'Pitting' LIMIT 1;
    SELECT lib_id INTO general_corrosion_id FROM u_lib_list WHERE lib_code = 'AMLY_COD' AND lib_desc = 'General Corrosion' LIMIT 1;
    SELECT lib_id INTO crack_id FROM u_lib_list WHERE lib_code = 'AMLY_COD' AND lib_desc = 'Crack' LIMIT 1;
    SELECT lib_id INTO dent_id FROM u_lib_list WHERE lib_code = 'AMLY_COD' AND lib_desc = 'Dent' LIMIT 1;
    SELECT lib_id INTO coating_damage_id FROM u_lib_list WHERE lib_code = 'AMLY_COD' AND lib_desc = 'Coating Damage' LIMIT 1;
    SELECT lib_id INTO anode_depletion_id FROM u_lib_list WHERE lib_code = 'AMLY_COD' AND lib_desc = 'Anode Depletion' LIMIT 1;
    SELECT lib_id INTO marine_growth_id FROM u_lib_list WHERE lib_code = 'AMLY_COD' AND lib_desc = 'Marine Growth' LIMIT 1;
    SELECT lib_id INTO deformation_id FROM u_lib_list WHERE lib_code = 'AMLY_COD' AND lib_desc = 'Deformation' LIMIT 1;

    -- Link Corrosion to its types
    IF corrosion_id IS NOT NULL THEN
        INSERT INTO u_lib_combo (parent_id, child_id, workunit, platform_type)
        SELECT corrosion_id, lib_id, '000', 'PLATFORM'
        FROM u_lib_list
        WHERE lib_code = 'AMLY_FND' AND lib_desc IN ('Surface Corrosion', 'Uniform Corrosion', 'Localized Corrosion')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Link Pitting to its types
    IF pitting_id IS NOT NULL THEN
        INSERT INTO u_lib_combo (parent_id, child_id, workunit, platform_type)
        SELECT pitting_id, lib_id, '000', 'PLATFORM'
        FROM u_lib_list
        WHERE lib_code = 'AMLY_FND' AND lib_desc IN ('Deep Pitting', 'Shallow Pitting')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Link General Corrosion to its types
    IF general_corrosion_id IS NOT NULL THEN
        INSERT INTO u_lib_combo (parent_id, child_id, workunit, platform_type)
        SELECT general_corrosion_id, lib_id, '000', 'PLATFORM'
        FROM u_lib_list
        WHERE lib_code = 'AMLY_FND' AND lib_desc IN ('Surface Corrosion', 'Uniform Corrosion')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Link Crack to its types
    IF crack_id IS NOT NULL THEN
        INSERT INTO u_lib_combo (parent_id, child_id, workunit, platform_type)
        SELECT crack_id, lib_id, '000', 'PLATFORM'
        FROM u_lib_list
        WHERE lib_code = 'AMLY_FND' AND lib_desc IN ('Hairline Crack', 'Structural Crack', 'Weld Crack')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Link Dent to its types
    IF dent_id IS NOT NULL THEN
        INSERT INTO u_lib_combo (parent_id, child_id, workunit, platform_type)
        SELECT dent_id, lib_id, '000', 'PLATFORM'
        FROM u_lib_list
        WHERE lib_code = 'AMLY_FND' AND lib_desc IN ('Minor Dent', 'Major Dent')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Link Coating Damage to its types
    IF coating_damage_id IS NOT NULL THEN
        INSERT INTO u_lib_combo (parent_id, child_id, workunit, platform_type)
        SELECT coating_damage_id, lib_id, '000', 'PLATFORM'
        FROM u_lib_list
        WHERE lib_code = 'AMLY_FND' AND lib_desc IN ('Coating Disbondment', 'Coating Blistering', 'Coating Peeling')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Link Anode Depletion to its types
    IF anode_depletion_id IS NOT NULL THEN
        INSERT INTO u_lib_combo (parent_id, child_id, workunit, platform_type)
        SELECT anode_depletion_id, lib_id, '000', 'PLATFORM'
        FROM u_lib_list
        WHERE lib_code = 'AMLY_FND' AND lib_desc IN ('Anode Depleted >75%', 'Anode Depleted 50-75%', 'Anode Depleted <50%')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Link Marine Growth to its types
    IF marine_growth_id IS NOT NULL THEN
        INSERT INTO u_lib_combo (parent_id, child_id, workunit, platform_type)
        SELECT marine_growth_id, lib_id, '000', 'PLATFORM'
        FROM u_lib_list
        WHERE lib_code = 'AMLY_FND' AND lib_desc IN ('Light Marine Growth', 'Moderate Marine Growth', 'Heavy Marine Growth')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Link Deformation to its types
    IF deformation_id IS NOT NULL THEN
        INSERT INTO u_lib_combo (parent_id, child_id, workunit, platform_type)
        SELECT deformation_id, lib_id, '000', 'PLATFORM'
        FROM u_lib_list
        WHERE lib_code = 'AMLY_FND' AND lib_desc IN ('Minor Deformation', 'Severe Deformation')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify the data was inserted correctly
SELECT 
    lib_code,
    COUNT(*) as item_count
FROM u_lib_list
WHERE lib_code IN ('AMLY_TYP', 'AMLY_COD', 'AMLY_FND')
    AND lib_delete = '0'
GROUP BY lib_code
ORDER BY lib_code;

-- Show sample combos
SELECT 
    parent.lib_desc as defect_code,
    child.lib_desc as defect_type
FROM u_lib_combo combo
JOIN u_lib_list parent ON combo.parent_id = parent.lib_id
JOIN u_lib_list child ON combo.child_id = child.lib_id
WHERE parent.lib_code = 'AMLY_COD'
    AND child.lib_code = 'AMLY_FND'
ORDER BY parent.lib_desc, child.lib_desc
LIMIT 20;
