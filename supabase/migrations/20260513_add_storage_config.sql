-- Add storage_config to company_settings
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='company_settings' AND column_name='storage_config') THEN
        ALTER TABLE company_settings ADD COLUMN storage_config JSONB DEFAULT '{}'::jsonb NOT NULL;
    END IF;
END $$;
