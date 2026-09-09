-- Add 'CONDUCTOR / CAISSON GUIDES' (CB) to components master table
INSERT INTO components (name, code, descrip, is_active, plat, pipe, comp_ico, brdg, sbm, tank)
VALUES ('CONDUCTOR / CAISSON GUIDES', 'CB', 'conductor guide bucket', true, 1, 0, 'comp_others.ico', 0, 0, 0)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, 
    descrip = EXCLUDED.descrip, 
    is_active = true, 
    plat = 1;
