-- Drop the restrictive check constraint on movement_type
-- The frontend logs human-readable strings ('Left Surface', 'Diver at Worksite') 
-- which conflict with the rigid database codes ('LEAVING_SURFACE', etc.)
-- Dropping this constraint allows the application to define its own action labels.

ALTER TABLE insp_dive_movements DROP CONSTRAINT IF EXISTS chk_movement_type;
