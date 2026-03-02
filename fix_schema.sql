-- Alter tape_count_no to allow string values (timecodes)
ALTER TABLE insp_records ALTER COLUMN tape_count_no TYPE VARCHAR(50);
