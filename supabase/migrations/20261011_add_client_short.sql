-- Migration: Add client_short to company_settings and companies
-- Description: Supports explicit client short code (e.g. PCSB) for DOC report templates

ALTER TABLE IF EXISTS public.company_settings 
ADD COLUMN IF NOT EXISTS client_short TEXT;

ALTER TABLE IF EXISTS public.companies 
ADD COLUMN IF NOT EXISTS short_name TEXT;

COMMENT ON COLUMN public.company_settings.client_short IS 'Client short abbreviation/code (e.g. PCSB) used for DOC report templates {CLIENT_SHORT}';
