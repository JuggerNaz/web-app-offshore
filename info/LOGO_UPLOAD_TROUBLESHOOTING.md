# CONTRACTOR LOGO UPLOAD - TROUBLESHOOTING GUIDE

## Current Issue
Still getting "new row violates row-level security policy" error after running the first SQL script.

## Root Cause
The RLS policies may not have been created correctly, or RLS might not be enabled on the storage.objects table.

## SOLUTION - Run This SQL Script

### File: `ULTIMATE_FIX_LOGO_RLS.sql`

This script will:
1. ✅ Add logo_url column (if missing)
2. ✅ Create/update library-logos bucket
3. ✅ **Enable RLS on storage.objects table**
4. ✅ Remove any conflicting policies
5. ✅ Create 5 fresh RLS policies
6. ✅ Verify everything is set up correctly

### Steps:

1. **Open Supabase SQL Editor**
   - URL: https://app.supabase.com/project/zpsmxtdqlpbdwfzctqzd/sql

2. **Copy the SQL**
   - Open: `ULTIMATE_FIX_LOGO_RLS.sql`
   - Copy ALL contents

3. **Paste and Run**
   - Paste into SQL Editor
   - Click "Run"

4. **Check Results**
   - You should see a table with 3 checks (all should show ✅ PASS)
   - You should see a list of 5 policies created

5. **Test Upload**
   - Go to: http://localhost:3000/dashboard/utilities/library
   - Select "Contractor Name"
   - Try uploading a logo
   - Should work now! ✅

## What's Different in This Fix?

The new script includes:
- `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;` - This was likely missing!
- Better policy names with clear descriptions
- Verification queries to confirm setup
- Cleanup of any conflicting policies

## Expected Output After Running

You should see something like:

```
check_type      | status    | description
----------------|-----------|------------------------------------------
Bucket Check    | ✅ PASS   | library-logos bucket exists and is public
Column Check    | ✅ PASS   | logo_url column exists in u_lib_list
Policy Check    | ✅ PASS   | At least 5 RLS policies exist for library-logos
```

And a list of policies:
```
policyname                                              | operation | for_role
--------------------------------------------------------|-----------|---------------
Enable delete for authenticated users on library-logos  | DELETE    | {authenticated}
Enable insert for authenticated users on library-logos  | INSERT    | {authenticated}
Enable select for anon users on library-logos          | SELECT    | {anon}
Enable select for authenticated users on library-logos  | SELECT    | {authenticated}
Enable update for authenticated users on library-logos  | UPDATE    | {authenticated}
```

## If It Still Doesn't Work

1. **Check your Supabase authentication**
   - Make sure you're logged in to the app
   - Check browser console for auth errors

2. **Verify the bucket exists manually**
   - Go to: https://app.supabase.com/project/zpsmxtdqlpbdwfzctqzd/storage/buckets
   - Look for "library-logos" bucket
   - Make sure it's marked as "Public"

3. **Check RLS policies manually**
   - Go to: https://app.supabase.com/project/zpsmxtdqlpbdwfzctqzd/auth/policies
   - Look for policies on "storage.objects" table
   - Should see 5 policies for library-logos

4. **Try creating the bucket manually**
   - Go to Storage in Supabase dashboard
   - Click "New bucket"
   - Name: `library-logos`
   - Make it Public
   - Then run the SQL script again

## Alternative: Disable RLS (Quick Test Only)

**WARNING: Only for testing! Not recommended for production!**

If you want to quickly test if RLS is the issue:

```sql
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

Try uploading. If it works, then RLS is definitely the issue. Then re-enable it:

```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

And run the ULTIMATE_FIX_LOGO_RLS.sql script again.

## Files Created

1. `FIX_CONTRACTOR_LOGO_RLS.sql` - First attempt (didn't work)
2. `FIX_CONTRACTOR_LOGO_COMPLETE.sql` - Second attempt (didn't work)
3. `ULTIMATE_FIX_LOGO_RLS.sql` - **USE THIS ONE** ⭐

## Next Steps After Fix

Once the upload works:
1. Test creating a new contractor with logo
2. Test editing existing contractor to add logo
3. Test deleting a logo
4. Verify logos display in the list view
5. Test with different image formats (JPG, PNG, WebP)
