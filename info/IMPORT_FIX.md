# Fix Data Import Error
The error `SQL Error [42601]: syntax error at or near ","` typically happens during import for 3 reasons.

## 1. Column Mismatch (Most Likely)
Your Excel/CSV file probably has columns that **do not exist** in the `u_lib_combo` table.
*   **Check Table Columns**: The `u_lib_combo` table typically expects:
    *   `lib_code`
    *   `code_1`
    *   `code_2`
    *   `lib_delete` (optional)
*   **Check CSV**: If your CSV has columns like `lib_desc` or `lib_val` or `description`, **remove them** from the CSV before importing. The combo table is a "Link Table" and doesn't store descriptions.

## 2. Bad Data / formatting
*   **Commas in Values**: Ensure fields with commas are wrapped in quotes.
*   **Empty Header**: Ensure the first row of your CSV has names for **every** column.

## 3. Verify Table Schema
Run this SQL to see exact columns required:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'u_lib_combo';
```

**Solution:**
1.  Run the SQL above to list valid columns.
2.  Edit your Excel file to **only keep those columns**. Delete all others.
3.  Save as CSV.
4.  Try Import again.
