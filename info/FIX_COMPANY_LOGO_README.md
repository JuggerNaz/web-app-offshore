# Fix Company Logo Upload - Quick Guide

## Status
- ✅ **Contractor Logo** - Working (can upload, save, retrieve)
- ❌ **Company Logo** - Not working (Settings page)

## Solution

### File: `FIX_COMPANY_LOGO.sql`

This script sets up the `company-assets` storage bucket and RLS policies for company logo uploads.

### Steps:

1. **Open Supabase SQL Editor**
   - https://app.supabase.com/project/zpsmxtdqlpbdwfzctqzd/sql

2. **Run the Script**
   - Open `FIX_COMPANY_LOGO.sql`
   - Copy all contents
   - Paste into SQL Editor
   - Click "Run"

3. **Verify Results**
   Should see:
   - ✅ company-assets bucket exists
   - ✅ All 5 policies created
   - List of 5 policies (INSERT, SELECT x2, UPDATE, DELETE)

4. **Test Upload**
   - Go to: http://localhost:3000/dashboard/settings
   - Scroll to "Company Logo" section
   - Click "Upload Logo"
   - Select an image (PNG, JPG, SVG, max 2MB)
   - Should upload successfully! ✅

## What This Fixes

Creates the `company-assets` bucket with:
- **Public access** - so logos can be displayed
- **2MB size limit** - reasonable for logos
- **Image formats** - JPG, PNG, WebP, SVG

Creates 5 RLS policies:
1. **INSERT** - authenticated users can upload
2. **SELECT (auth)** - authenticated users can view
3. **SELECT (public)** - anyone can view logos
4. **UPDATE** - authenticated users can replace
5. **DELETE** - authenticated users can remove

## Expected Output

After running the script:

```
check_name    | status
--------------|--------------------------------
Bucket Check  | ✅ company-assets bucket exists
Policy Check  | ✅ All 5 policies created
```

And policy list:
```
policyname                    | operation | allowed_for
------------------------------|-----------|-------------
company_assets_delete         | DELETE    | authenticated
company_assets_insert         | INSERT    | authenticated
company_assets_select_auth    | SELECT    | authenticated
company_assets_select_public  | SELECT    | public/anon
company_assets_update         | UPDATE    | authenticated
```

## Troubleshooting

If upload still fails:

1. **Check browser console** - look for specific error message
2. **Verify authentication** - make sure you're logged in
3. **Check bucket manually**:
   - Go to: https://app.supabase.com/project/zpsmxtdqlpbdwfzctqzd/storage/buckets
   - Look for `company-assets` bucket
   - Should be marked as "Public"
4. **Check file requirements**:
   - Must be an image file
   - Must be under 2MB
   - Supported: JPG, PNG, WebP, SVG

## After Fix

Once working, you'll be able to:
- ✅ Upload company logo in Settings
- ✅ See logo in Settings page
- ✅ See logo in sidebar/header (if implemented)
- ✅ Logo appears on generated reports (if implemented)
- ✅ Replace logo anytime
- ✅ Delete logo if needed

The logo will be stored in Supabase Storage at:
`company-assets/logos/company-logo-[timestamp].[ext]`

And accessible via public URL for display throughout the app.
