-- Drop the old constraint
ALTER TABLE public.u_sow_items DROP CONSTRAINT IF EXISTS unique_component_inspection;

-- Create a new unique index that includes report_number
-- Using COALESCE to handle NULLs effectively for uniqueness if needed, 
-- but a standard multi-column index is cleaner. 
-- However, standard UNIQUE allows multiple (A, B, NULL).
-- We likely want (sow_id, component_id, inspection_type_id, report_number) to be unique.
-- If report_number is NULL, strict uniqueness isn't enforced by standard constraint.
-- We can use a unique index with COALESCE.

CREATE UNIQUE INDEX idx_unique_sow_item 
ON public.u_sow_items (sow_id, component_id, inspection_type_id, COALESCE(report_number, 'Global'));
