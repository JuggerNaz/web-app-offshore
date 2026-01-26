-- Count rows to verify data exists
SELECT 'Priorities Count (AMLY_TYP)' as check_name, COUNT(*) as count FROM u_lib_list WHERE lib_code = 'AMLY_TYP';

SELECT 'Defect Codes Count (AMLY_COD)' as check_name, COUNT(*) as count FROM u_lib_list WHERE lib_code = 'AMLY_COD';

SELECT 'Defect Types Count (AMLY_FND)' as check_name, COUNT(*) as count FROM u_lib_list WHERE lib_code = 'AMLY_FND';

SELECT 'Combo Relationships Count (AMLYCODFND)' as check_name, COUNT(*) as count FROM u_lib_combo WHERE lib_code = 'AMLYCODFND';

-- Show a sample of data to check casing/formatting
SELECT * FROM u_lib_list WHERE lib_code = 'AMLY_TYP' LIMIT 5;
