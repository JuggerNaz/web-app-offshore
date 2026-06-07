# 🔧 QUICK FIX - Company Settings Setup

## ⚠️ You're seeing "Failed to upload logo" because the database isn't set up yet.

### Follow these 3 simple steps:

---

## Step 1: Create Database Table (2 minutes)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click **SQL Editor** in left sidebar (looks like `</>`)
   - Click **+ New query**

3. **Copy and Run This SQL:**

```sql
-- Create company_settings table
CREATE TABLE IF NOT EXISTS public.company_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    company_name TEXT NOT NULL DEFAULT 'OFFSHORE DATA MANAGEMENT',
    department_name TEXT DEFAULT '',
    logo_path TEXT,
    storage_provider TEXT NOT NULL DEFAULT 'Supabase',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT company_settings_single_row CHECK (id = 1)
);

-- Insert default row
INSERT INTO public.company_settings (id, company_name, department_name)
VALUES (1, 'OFFSHORE DATA MANAGEMENT', '')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read" ON public.company_settings
FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to update
CREATE POLICY "Allow authenticated update" ON public.company_settings
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.company_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
```

4. **Click RUN** (or press Ctrl+Enter)

---

## Step 2: Create Storage Bucket (1 minute)

1. **Go to Storage**
   - Click **Storage** in left sidebar

2. **Create Bucket**
   - Click **+ New bucket**
   - Name: `company-assets`
   - **Toggle "Public bucket" to ON** ← IMPORTANT!
   - Click **Create bucket**

3. **Add Policies** (in the bucket settings)
   - Go to **Policies** tab
   - Click **New policy** → **For full customization**
   - Add these 4 policies:

```sql
-- Allow read
CREATE POLICY "Allow authenticated read" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'company-assets');

-- Allow upload
CREATE POLICY "Allow authenticated upload" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-assets');

-- Allow update
CREATE POLICY "Allow authenticated update" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'company-assets');

-- Allow delete
CREATE POLICY "Allow authenticated delete" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'company-assets');
```

---

## Step 3: Test (30 seconds)

1. **Refresh your app** (Press F5)
2. Go to **Settings**
3. Try uploading a logo
4. ✅ It should work now!

---

## ✅ Checklist

- [ ] Ran SQL in Supabase SQL Editor
- [ ] Created `company-assets` bucket (Public = ON)
- [ ] Added 4 storage policies
- [ ] Refreshed the app
- [ ] Logo upload works!

---

## 🆘 Still Not Working?

1. Press **F12** in browser
2. Go to **Console** tab
3. Look for error messages
4. Share the error message

---

## 💡 What This Does

- Creates a database table to store company name, department, and logo path
- Creates a storage bucket for the logo file
- Sets up permissions so authenticated users can upload/view logos
- Makes settings shared across all users!

---

**Total time: ~3 minutes** ⏱️
