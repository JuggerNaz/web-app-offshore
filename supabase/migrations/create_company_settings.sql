-- Create company_settings table
CREATE TABLE IF NOT EXISTS public.company_settings (
    id SERIAL PRIMARY KEY,
    company_name TEXT NOT NULL DEFAULT 'OFFSHORE DATA MANAGEMENT',
    department_name TEXT,
    logo_path TEXT,
    storage_provider TEXT NOT NULL DEFAULT 'Supabase',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create a single row for company settings (singleton pattern)
INSERT INTO public.company_settings (id, company_name, department_name)
VALUES (1, 'OFFSHORE DATA MANAGEMENT', '')
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to read
CREATE POLICY "Allow all authenticated users to read company settings"
    ON public.company_settings
    FOR SELECT
    TO authenticated
    USING (true);

-- Create policy to allow all authenticated users to update
CREATE POLICY "Allow all authenticated users to update company settings"
    ON public.company_settings
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.company_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create storage bucket for company assets if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for company-assets bucket
CREATE POLICY "Allow authenticated users to read company assets"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'company-assets');

CREATE POLICY "Allow authenticated users to upload company assets"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'company-assets');

CREATE POLICY "Allow authenticated users to update company assets"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'company-assets');

CREATE POLICY "Allow authenticated users to delete company assets"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'company-assets');
