# 🚀 Quick Setup Guide - Company Settings

## The Problem
You're getting "Failed to upload logo" because the database table doesn't exist yet.

## The Solution (5 minutes)

### Step 1: Create the Database Table

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click on **SQL Editor** in the left sidebar (icon looks like `</>`)
   - Click **New Query**

3. **Run the Setup Script**
   - Open the file: `supabase/QUICK_SETUP.sql`
   - Copy ALL the SQL code
   - Paste it into the Supabase SQL Editor
   - Click **Run** (or press Ctrl+Enter)

4. **Verify Success**
   - You should see a success message
   - The last line will show: `SELECT * FROM public.company_settings`
   - You should see 1 row with default values

### Step 2: Create the Storage Bucket

1. **Go to Storage**
   - Click on **Storage** in the left sidebar (bucket icon)

2. **Create New Bucket**
   - Click **New bucket** button
   - Name: `company-assets`
   - **Make it Public**: Toggle ON
   - Click **Create bucket**

3. **Set Bucket Policies** (Important!)
   - Click on the `company-assets` bucket
   - Go to **Policies** tab
   - Click **New Policy**
   - Select **For full customization**
   - Add these 4 policies:

   **Policy 1: Allow SELECT**
   ```sql
   CREATE POLICY "Allow authenticated users to read"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'company-assets');
   ```

   **Policy 2: Allow INSERT**
   ```sql
   CREATE POLICY "Allow authenticated users to upload"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'company-assets');
   ```

   **Policy 3: Allow UPDATE**
   ```sql
   CREATE POLICY "Allow authenticated users to update"
   ON storage.objects FOR UPDATE
   TO authenticated
   USING (bucket_id = 'company-assets');
   ```

   **Policy 4: Allow DELETE**
   ```sql
   CREATE POLICY "Allow authenticated users to delete"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (bucket_id = 'company-assets');
   ```

### Step 3: Test It!

1. **Refresh your app** (Ctrl+R or F5)
2. Go to **Settings** in the sidebar
3. Try uploading a logo again
4. It should work now! ✅

---

## Quick Checklist

- [ ] Ran `QUICK_SETUP.sql` in Supabase SQL Editor
- [ ] Created `company-assets` storage bucket (Public)
- [ ] Added 4 storage policies for authenticated users
- [ ] Refreshed the app
- [ ] Tested logo upload

---

## Troubleshooting

### Still getting "Failed to upload logo"?

**Check the browser console:**
1. Press F12 to open DevTools
2. Go to Console tab
3. Look for error messages
4. Share the error message

**Common issues:**
- ❌ Storage bucket not created → Create `company-assets` bucket
- ❌ Bucket is private → Make it **Public**
- ❌ Missing policies → Add all 4 policies above
- ❌ Table doesn't exist → Run `QUICK_SETUP.sql`

### Need Help?

Check the browser console (F12) and look for the actual error message. It will tell you exactly what's wrong!

---

## Alternative: Manual Table Creation

If SQL Editor doesn't work, you can create the table manually:

1. Go to **Database** → **Tables**
2. Click **New table**
3. Name: `company_settings`
4. Add columns:
   - `id` (int4, primary key, default: 1)
   - `company_name` (text, default: 'OFFSHORE DATA MANAGEMENT')
   - `department_name` (text)
   - `logo_path` (text)
   - `storage_provider` (text, default: 'Supabase')
   - `created_at` (timestamptz, default: now())
   - `updated_at` (timestamptz, default: now())
5. Enable RLS
6. Add policies (same as above)
