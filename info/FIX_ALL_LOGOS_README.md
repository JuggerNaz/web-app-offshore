# COMPLETE FIX - All Logo Upload Issues

## Problem
Cannot upload logos in two places:
1. ❌ **Company Logo** in Settings page
2. ❌ **Contractor Logo** in Library page

Both fail with storage/RLS errors.

## Root Cause
Two different storage buckets need RLS policies:
- `company-assets` - for company logo (Settings page)
- `library-logos` - for contractor logos (Library page)

## SOLUTION - One SQL Script Fixes Everything

### File: `FIX_ALL_LOGO_UPLOADS.sql`

This script will set up BOTH buckets and all necessary RLS policies.

### Steps to Fix:

1. **Open Supabase SQL Editor**
   - Go to: https://app.supabase.com/project/zpsmxtdqlpbdwfzctqzd/sql

2. **Run the SQL Script**
   - Open file: `FIX_ALL_LOGO_UPLOADS.sql`
   - Copy ALL contents
   - Paste into SQL Editor
   - Click "Run"

3. **Verify Success**
   You should see:
   - ✅ Buckets Created: 2 buckets
   - ✅ company-assets policies: 5 policies
   - ✅ library-logos policies: 5 policies
   - A list of all 10 policies created

4. **Test Both Features**

   **Test 1: Company Logo**
   - Go to: http://localhost:3000/dashboard/settings
   - Click "Upload Logo" under Company Information
   - Select an image (PNG, JPG, SVG, max 2MB)
   - Should upload successfully! ✅

   **Test 2: Contractor Logo**
   - Go to: http://localhost:3000/dashboard/utilities/library
   - Select "Contractor Name"
   - Create or edit a contractor
   - Upload a logo (PNG, JPG, WebP, max 5MB)
   - Should upload successfully! ✅

## What This Script Does

### Creates 2 Storage Buckets:

1. **company-assets**
   - For company logo in Settings
   - Max size: 2MB
   - Allowed: JPG, PNG, WebP, SVG
   - Public access for display

2. **library-logos**
   - For contractor logos in Library
   - Max size: 5MB
   - Allowed: JPG, PNG, WebP
   - Public access for display

### Creates 10 RLS Policies:

**For company-assets (5 policies):**
- ✅ INSERT - authenticated users can upload
- ✅ SELECT (auth) - authenticated users can view
- ✅ SELECT (public) - anyone can view
- ✅ UPDATE - authenticated users can update
- ✅ DELETE - authenticated users can delete

**For library-logos (5 policies):**
- ✅ INSERT - authenticated users can upload
- ✅ SELECT (auth) - authenticated users can view
- ✅ SELECT (public) - anyone can view
- ✅ UPDATE - authenticated users can update
- ✅ DELETE - authenticated users can delete

## Expected Results

After running the script, you should see output like:

```
check_name                    | status
------------------------------|-------------
Buckets Created               | 2 buckets
company-assets policies       | 5 policies
library-logos policies        | 5 policies
```

And a list of all policies:

```
policyname                      | operation | bucket
--------------------------------|-----------|----------------
company_assets_delete           | DELETE    | company-assets
company_assets_insert           | INSERT    | company-assets
company_assets_select_auth      | SELECT    | company-assets
company_assets_select_public    | SELECT    | company-assets
company_assets_update           | UPDATE    | company-assets
library_logos_delete            | DELETE    | library-logos
library_logos_insert            | INSERT    | library-logos
library_logos_select_auth       | SELECT    | library-logos
library_logos_select_public     | SELECT    | library-logos
library_logos_update            | UPDATE    | library-logos
```

## Troubleshooting

### If Company Logo Upload Still Fails:

1. Check browser console for specific error
2. Verify you're logged in
3. Check that `company-assets` bucket exists in Supabase Storage dashboard
4. Verify file is under 2MB and is an image

### If Contractor Logo Upload Still Fails:

1. Check browser console for specific error
2. Verify you're logged in
3. Check that `library-logos` bucket exists in Supabase Storage dashboard
4. Verify file is under 5MB and is JPG/PNG/WebP

### Manual Bucket Check:

Go to: https://app.supabase.com/project/zpsmxtdqlpbdwfzctqzd/storage/buckets

You should see:
- ✅ company-assets (Public)
- ✅ library-logos (Public)

### Manual Policy Check:

Go to: https://app.supabase.com/project/zpsmxtdqlpbdwfzctqzd/auth/policies

Look for policies on `storage.objects` table - should see 10 policies total.

## Files Reference

- `FIX_ALL_LOGO_UPLOADS.sql` - **USE THIS** ⭐ (Fixes both issues)
- `SIMPLE_FIX_LOGO.sql` - Old (only fixes contractor logos)
- `ULTIMATE_FIX_LOGO_RLS.sql` - Old (only fixes contractor logos)

## Summary

**Before Fix:**
- ❌ Company logo upload fails
- ❌ Contractor logo upload fails

**After Fix:**
- ✅ Company logo upload works
- ✅ Contractor logo upload works
- ✅ Both buckets have proper RLS policies
- ✅ Public access for displaying logos
- ✅ Secure uploads (authenticated only)

Run the script and test both features!
