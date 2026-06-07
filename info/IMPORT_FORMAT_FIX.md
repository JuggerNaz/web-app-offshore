# Fix Import Parse Error
The error `Can't parse numeric value [ ]` happens because your `LIB_DELETE` column contains a **Space** character instead of being empty or `0`. The database expects a Number, but " " (Space) is text.

## Solution

1.  **Open your CSV file** in a Text Editor (Not Excel, use Notepad or VS Code).
2.  **Look for spaces between commas**:
    *   **Bad**: `...,04/23/21, , ,` (See the space between commas?)
    *   **Good**: `...,04/23/21,,,` (No spaces)
    *   **Also Good**: `...,04/23/21,0,,` (Using explicit 0)
3.  **Search & Replace**:
    *   Replace `, ,` with `,,` (to remove spaces)
    *   OR Replace `, ,` with `,0,` for the `LIB_DELETE` column.

## Quick Fix for LIB_DELETE
If `LIB_DELETE` is the column failing (it usually is numeric):
*   Fill all empty cells in that column with `0`.
