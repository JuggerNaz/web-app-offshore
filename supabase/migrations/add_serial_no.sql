-- Add serial_no column to existing company_settings table
-- Run this if you already created the table without serial_no

ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS serial_no TEXT DEFAULT '';
