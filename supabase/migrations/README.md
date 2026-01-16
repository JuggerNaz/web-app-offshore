# Company Settings - Database Migration Guide

## Overview
This migration creates the infrastructure for storing company settings (company name, department name, and logo) in Supabase, making them accessible to all users.

## What Gets Created

### 1. Database Table: `company_settings`
- Stores company name, department name, and logo path
- Single row table (singleton pattern)
- Automatically tracks created_at and updated_at timestamps

### 2. Storage Bucket: `company-assets`
- Public bucket for storing company logo
- All authenticated users can read, upload, update, and delete

## Running the Migration

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `supabase/migrations/create_company_settings.sql`
5. Click **Run** to execute the migration

### Option 2: Using Supabase CLI
```bash
# If you have Supabase CLI installed
supabase db push

# Or apply the specific migration file
supabase db execute --file supabase/migrations/create_company_settings.sql
```

### Option 3: Manual SQL Execution
1. Open your Supabase project
2. Go to **Database** → **SQL Editor**
3. Run the SQL commands from the migration file

## Verification

After running the migration, verify:

1. **Table exists**: Check that `company_settings` table is created
   ```sql
   SELECT * FROM company_settings;
   ```

2. **Storage bucket exists**: Go to **Storage** in Supabase dashboard and verify `company-assets` bucket exists

3. **Policies are active**: Check that RLS policies are enabled

## Post-Migration

After the migration:
1. The settings page will automatically work with the database
2. All users will see the same company logo and settings
3. Logo uploads will be stored in Supabase storage
4. Settings are shared across all users in real-time

## Troubleshooting

### If the table already exists
The migration uses `IF NOT EXISTS` and `ON CONFLICT` clauses, so it's safe to run multiple times.

### If you get permission errors
Make sure you're logged in as a user with database admin privileges.

### If the storage bucket fails to create
You can manually create it:
1. Go to **Storage** in Supabase dashboard
2. Click **New bucket**
3. Name it `company-assets`
4. Make it **Public**
5. Save

## Next Steps

Once the migration is complete:
1. Go to **Settings** in your app
2. Upload a company logo
3. Set company name and department name
4. Click **Save Settings**
5. All users will see the updated information!
