-- Check if lib_com column exists in u_lib_combo
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'u_lib_combo' 
ORDER BY ordinal_position;
