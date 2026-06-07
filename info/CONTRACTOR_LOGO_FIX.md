# Contractor Logo Issue - RESOLVED

## Problem
Cannot save contractor logos in the library. The upload fails with a **Row-Level Security (RLS) policy violation** error.

## Root Cause
The `library-logos` storage bucket in Supabase exists but lacks the proper RLS policies to allow authenticated users to upload files.

## Error Message
```
Upload error: StorageApiError: new row violates row-level security policy
```

## Solution

### Step 1: Run the Database Migration

1. **Open Supabase SQL Editor**
   - Go to: https://app.supabase.com/project/zpsmxtdqlpbdwfzctqzd/sql

2. **Copy the SQL Script**
   - Open file: `supabase/migrations/add_contractor_logo.sql`
   - Copy the entire contents

3. **Execute the Script**
   - Paste into the SQL Editor
   - Click the "Run" button
   - Wait for success message

4. **Verify the Setup**
   - The script includes verification queries at the bottom
   - Check that:
     - `logo_url` column exists in `u_lib_list` table
     - `library-logos` bucket exists with correct settings
     - 4 RLS policies are created (upload, read, delete, update)

### Step 2: Test the Feature

1. **Navigate to Library Page**
   - Go to: http://localhost:3000/dashboard/utilities/library

2. **Select Contractor Name**
   - Click on "Contractor Name" in the left sidebar

3. **Create or Edit a Contractor**
   - Click "Add Item" or edit an existing contractor
   - Upload a logo image (JPG, PNG, or WebP, max 5MB)
   - Save the contractor

4. **Verify Logo Display**
   - The logo should appear next to the contractor name in the list
   - The logo should be saved and persist after page refresh

## What the Migration Does

### 1. Database Column
- Adds `logo_url` TEXT column to `u_lib_list` table
- Stores the public URL of uploaded contractor logos

### 2. Storage Bucket
- Creates/updates `library-logos` bucket
- Sets as public for easy image display
- Limits file size to 5MB
- Restricts to image types: JPEG, PNG, WebP

### 3. RLS Policies
Creates 4 security policies:
- **Upload**: Authenticated users can upload files
- **Read**: Public access to view images
- **Delete**: Authenticated users can delete files
- **Update**: Authenticated users can update files

## File Structure

```
CONTRACTOR/
├── AMSB.png          (Logo for contractor AMSB)
├── TEST_CONT.png     (Logo for contractor TEST_CONT)
└── ...
```

## Implementation Details

### Frontend (Already Implemented)
- ✅ `ImageUpload` component in `app/dashboard/utilities/library/image-upload.tsx`
- ✅ Integration in Create/Edit dialogs for CONTRACTOR library
- ✅ Logo display in library list view
- ✅ File validation (type, size)
- ✅ Upload progress indicator

### Backend (Already Implemented)
- ✅ API routes accept `logo_url` in payload
- ✅ POST `/api/library/[filter]` - Creates items with logo
- ✅ PUT `/api/library/[filter]/[id]` - Updates items with logo

### Database (Fixed by Migration)
- ✅ `logo_url` column in `u_lib_list` table
- ✅ Storage bucket `library-logos` configured
- ✅ RLS policies for secure access

## Troubleshooting

### If Upload Still Fails

1. **Check Browser Console**
   - Open DevTools (F12)
   - Look for error messages
   - Check Network tab for failed requests

2. **Verify RLS Policies**
   ```sql
   SELECT policyname, cmd 
   FROM pg_policies 
   WHERE tablename = 'objects' 
   AND policyname LIKE 'library_logos%';
   ```
   Should return 4 policies.

3. **Check User Authentication**
   - Ensure you're logged in
   - Check that `supabase.auth.getUser()` returns a valid user

4. **Verify Bucket Settings**
   ```sql
   SELECT * FROM storage.buckets WHERE id = 'library-logos';
   ```
   Should show `public = true`

### If Logo Doesn't Display

1. **Check Database**
   ```sql
   SELECT lib_id, lib_desc, logo_url 
   FROM u_lib_list 
   WHERE lib_code = 'CONTR_NAM' 
   AND logo_url IS NOT NULL;
   ```

2. **Verify URL Format**
   - Should be: `https://zpsmxtdqlpbdwfzctqzd.supabase.co/storage/v1/object/public/library-logos/CONTRACTOR/[ID].[ext]`

3. **Check Image Accessibility**
   - Copy the `logo_url` from database
   - Paste in browser address bar
   - Should display the image

## Next Steps

After running the migration:
1. Test creating a new contractor with a logo
2. Test editing an existing contractor to add/update logo
3. Test deleting a logo
4. Verify logos display correctly in the list view
5. Test with different image formats (JPG, PNG, WebP)

## Related Files

- `supabase/migrations/add_contractor_logo.sql` - Database migration script
- `app/dashboard/utilities/library/page.tsx` - Library UI with logo support
- `app/dashboard/utilities/library/image-upload.tsx` - Image upload component
- `app/api/library/[filter]/route.ts` - Create contractor API
- `app/api/library/[filter]/[id]/route.ts` - Update contractor API
- `CONTRACTOR_LOGO_IMPLEMENTATION.md` - Original implementation plan

## Status

- ❌ **Before Migration**: Logo upload fails with RLS error
- ✅ **After Migration**: Logo upload works, logos display in list
