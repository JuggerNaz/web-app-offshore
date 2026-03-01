-- The records already exist, so we use UPDATE instead of INSERT
UPDATE components
SET
  sblm = 0,
  tank = 0,
  comp_ico = 'comp_others.ico',
  brdg = 0
WHERE code IN ('FV', 'WD', 'YP', 'GP', 'GS', 'CT');
