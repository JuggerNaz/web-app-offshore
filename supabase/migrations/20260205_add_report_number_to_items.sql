-- Add report_number column to u_sow_items table
ALTER TABLE public.u_sow_items ADD COLUMN IF NOT EXISTS report_number VARCHAR(50);

-- Add comment
COMMENT ON COLUMN public.u_sow_items.report_number IS 'Report number associated with this specific inspection scope item';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_sow_items_report_number ON public.u_sow_items(report_number);
