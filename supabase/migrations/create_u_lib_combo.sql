-- Create u_lib_combo table for library combinations
-- This table stores combinations of two codes from u_lib_list

CREATE TABLE IF NOT EXISTS u_lib_combo (
    id SERIAL PRIMARY KEY,
    lib_code VARCHAR(50) NOT NULL,
    code_1 VARCHAR(50) NOT NULL,
    code_2 VARCHAR(50) NOT NULL,
    lib_com TEXT,
    lib_delete INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique combinations
    CONSTRAINT unique_combo UNIQUE (lib_code, code_1, code_2)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_lib_combo_lib_code ON u_lib_combo(lib_code);
CREATE INDEX IF NOT EXISTS idx_lib_combo_delete ON u_lib_combo(lib_delete);

-- Add comment
COMMENT ON TABLE u_lib_combo IS 'Stores combinations of library codes for specific library types';
COMMENT ON COLUMN u_lib_combo.lib_code IS 'Master library code (e.g., AMLYCODFND)';
COMMENT ON COLUMN u_lib_combo.code_1 IS 'First code from u_lib_list';
COMMENT ON COLUMN u_lib_combo.code_2 IS 'Second code from u_lib_list';
COMMENT ON COLUMN u_lib_combo.lib_com IS 'Comments for this combination';
COMMENT ON COLUMN u_lib_combo.lib_delete IS 'Soft delete flag: 0=active, 1=deleted';
