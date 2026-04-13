-- Add def_unit to company_settings
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='company_settings' AND column_name='def_unit') THEN
        ALTER TABLE company_settings ADD COLUMN def_unit VARCHAR(20) DEFAULT 'METRIC' NOT NULL;
        
        -- Add constraint
        ALTER TABLE company_settings ADD CONSTRAINT chr_def_unit CHECK (def_unit IN ('METRIC', 'IMPERIAL'));
    END IF;
END $$;
