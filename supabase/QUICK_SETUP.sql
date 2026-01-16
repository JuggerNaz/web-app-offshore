-- Quick Setup for Company Settings
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Step 1: Create the company_settings table
CREATE TABLE IF NOT EXISTS public.company_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    company_name TEXT NOT NULL DEFAULT 'OFFSHORE DATA MANAGEMENT',
    department_name TEXT DEFAULT '',
    serial_no TEXT DEFAULT '',
    logo_path TEXT,
    storage_provider TEXT NOT NULL DEFAULT 'Supabase',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT company_settings_single_row CHECK (id = 1)
);

-- Step 2: Insert the default row
INSERT INTO public.company_settings (id, company_name, department_name)
VALUES (1, 'OFFSHORE DATA MANAGEMENT', '')
ON CONFLICT (id) DO NOTHING;

-- Step 3: Enable Row Level Security
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Step 4: Create policies for authenticated users
DROP POLICY IF EXISTS "Allow authenticated users to read settings" ON public.company_settings;
CREATE POLICY "Allow authenticated users to read settings"
    ON public.company_settings
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to update settings" ON public.company_settings;
CREATE POLICY "Allow authenticated users to update settings"
    ON public.company_settings
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Step 5: Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.company_settings;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.company_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Verify the table was created
SELECT * FROM public.company_settings;
