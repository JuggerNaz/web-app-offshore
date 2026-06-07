-- Query to check the structure of u_lib_combo table
-- Run this in Supabase SQL Editor to see the columns

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'u_lib_combo'
ORDER BY 
    ordinal_position;

-- Also check if there's any data
SELECT COUNT(*) as total_rows FROM u_lib_combo;

-- Check a sample row if exists
SELECT * FROM u_lib_combo LIMIT 5;
