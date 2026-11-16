-- Migration: Add allowed_start_date and allowed_end_date to profiles for scheduled access periods
ALTER TABLE IF EXISTS public.profiles 
ADD COLUMN IF NOT EXISTS allowed_start_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS allowed_end_date DATE DEFAULT NULL;

COMMENT ON COLUMN public.profiles.allowed_start_date IS 'Optional scheduled access beginning date (YYYY-MM-DD)';
COMMENT ON COLUMN public.profiles.allowed_end_date IS 'Optional scheduled access expiration date (YYYY-MM-DD)';

