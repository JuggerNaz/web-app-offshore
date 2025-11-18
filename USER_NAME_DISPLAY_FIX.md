# User Name Display Fix

## Problem
The comments and attachments tables were showing user IDs instead of user names.

## Solution
Created a Postgres function that securely fetches user information from the `auth.users` table and updated the API routes to use this function.

## Steps to Apply the Fix

### 1. Run the SQL Migration

You need to create the `get_user_info` function in your Supabase database. You have two options:

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://app.supabase.com/project/zpsmxtdqlpbdwfzctqzd
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of `supabase/migrations/add_get_user_info_function.sql`
5. Click **Run** or press `Cmd/Ctrl + Enter`

#### Option B: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Make sure you're in the project directory
cd /Users/juggernaz/SourceCode/web-app-offshore

# Apply the migration
supabase db push
```

### 2. Restart Your Development Server

After applying the migration, restart your development server:

```bash
# Stop the current server (Ctrl+C)
# Then restart
yarn dev
```

### 3. Clear Browser Cache

Clear your browser cache or do a hard refresh:
- **Chrome/Edge**: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- **Safari**: `Cmd+Option+R`
- **Firefox**: `Cmd+Shift+R` (Mac) or `Ctrl+F5` (Windows)

## What Changed

### Files Modified:
1. **`app/api/comment/[type]/[id]/route.ts`** - Updated to use RPC function
2. **`app/api/attachment/[type]/[id]/route.ts`** - Updated to use RPC function
3. **`components/data-table/columns.tsx`** - Changed column accessor from `user_id` to `user_name`

### Files Created:
1. **`supabase/migrations/add_get_user_info_function.sql`** - Database function

## How It Works

1. The API routes fetch comments/attachments as usual
2. They extract all unique user IDs from the results
3. They call the `get_user_info()` Postgres function via RPC
4. The function queries `auth.users` securely and returns user names
5. The API enriches the data with a `user_name` field
6. The data table displays the `user_name` instead of `user_id`

## User Name Priority

The system displays user names in this priority order:
1. Full Name (from `raw_user_meta_data.full_name`)
2. Name (from `raw_user_meta_data.name`)
3. Email username (part before @)
4. Full email address
5. "Unknown User" (fallback)

## Verification

After applying the fix:
1. Navigate to any platform or pipeline detail page
2. Click on the **Comments** or **Attachments** tab
3. The **User** column should now show names/emails instead of UUIDs

## Troubleshooting

### Still seeing user IDs?

1. **Verify the function was created:**
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_name = 'get_user_info';
   ```
   
2. **Check function permissions:**
   ```sql
   SELECT * FROM pg_proc 
   WHERE proname = 'get_user_info';
   ```

3. **Test the function directly:**
   ```sql
   SELECT * FROM get_user_info(ARRAY['your-user-id-here']::uuid[]);
   ```

4. **Check server logs** for any RPC errors

### Permission Errors?

If you see permission errors, make sure the GRANT statements in the migration were executed:
```sql
GRANT EXECUTE ON FUNCTION get_user_info(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_info(uuid[]) TO anon;
```

## Security Note

The `get_user_info` function is marked as `SECURITY DEFINER`, which means it runs with the privileges of the user who created it (typically a superuser). This allows it to access the `auth.users` table while still being callable by regular users. The function only returns basic user information (id, email, name) and cannot be used to access sensitive data.
