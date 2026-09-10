# Password Reset (One-Time Temporary Password) & Backend User Creation Guide

This document contains full technical references, database schemas, migration details, API endpoints, and direct SQL templates for:
1. **Admin Temporary Password Reset with Compulsory First-Login Password Change**
2. **Direct Backend Database User Creation in PostgreSQL/Supabase**

---

## Part 1: Temporary Password Reset & Compulsory First-Login Change

### Architecture & Data Flow

```
[ Admin in User Management ]
          │
          ▼
Clicks "Reset Pass" ──► POST /api/admin/users/[id]/reset-password
                              │
                              ├─► 1. Generates strong temporary password (e.g. `Offshore#4829!`)
                              ├─► 2. Updates `auth.users` password via admin client
                              ├─► 3. Sets `must_change_password: true` in user metadata
                              └─► 4. Updates `public.profiles.must_change_password = true`
                                            │
                                            ▼
[ User logs in with Temporary Password ]
          │
          ▼
[ Next.js Middleware / Auth Actions ]
          │
          ├─► Checks `profile.must_change_password === true`
          └─► Blocks access to `/dashboard/*` and redirects to `/force-change-password`
                    │
                    ▼
[ User Submits New Permanent Password on `/force-change-password` ]
          │
          ▼
`forceChangePasswordAction` (app/actions.ts)
          │
          ├─► Updates user password via `supabase.auth.updateUser({ password })`
          ├─► Sets `must_change_password = false` in `auth.users` metadata
          ├─► Sets `must_change_password = false` in `public.profiles`
          └─► Unlocks access and redirects to `/dashboard`
```

---

### Database Migration

File: `supabase/migrations/20260910_add_must_change_password.sql`

```sql
-- Add must_change_password to public.profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'must_change_password'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- RLS Policy: Users can update their own password status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'Users can update own password status'
  ) THEN
    CREATE POLICY "Users can update own password status" 
      ON public.profiles 
      FOR UPDATE 
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;
```

---

### API Reference

#### Reset User Password (Admin Only)
- **Method:** `POST`
- **Path:** `/api/admin/users/[id]/reset-password`
- **Protected by Roles:** `company_admin`, `super_admin`
- **Request Body (optional):**
  ```json
  {
    "customPassword": "OptionalCustomPassword123!" 
  }
  ```
  *(If omitted or blank, a secure 12+ character password like `Offshore#7381!` is generated automatically)*
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "userId": "uuid-here",
      "email": "user@example.com",
      "temporaryPassword": "Offshore#7381!",
      "mustChangePassword": true,
      "message": "Password reset successfully. The user will be required to change this password on their next login."
    }
  }
  ```

---

### Key Code Artifacts

| Component / File | Purpose |
| :--- | :--- |
| [`components/admin/reset-password-dialog.tsx`](file:///c:/Users/nq352/Documents/GitHub/web-app-offshore/components/admin/reset-password-dialog.tsx) | Modal dialog with 1-click clipboard copy of temporary password and password mode selection. |
| [`app/force-change-password/page.tsx`](file:///c:/Users/nq352/Documents/GitHub/web-app-offshore/app/force-change-password/page.tsx) | Compulsory first-login password change page with real-time validation. |
| [`app/actions.ts`](file:///c:/Users/nq352/Documents/GitHub/web-app-offshore/app/actions.ts) | Contains `forceChangePasswordAction`, updated `signInAction`, and updated `resetPasswordAction`. |
| [`utils/supabase/middleware.ts`](file:///c:/Users/nq352/Documents/GitHub/web-app-offshore/utils/supabase/middleware.ts) | Intercepts navigation to `/dashboard/*` if `must_change_password` is true. |
| [`app/dashboard/admin/users/page.tsx`](file:///c:/Users/nq352/Documents/GitHub/web-app-offshore/app/dashboard/admin/users/page.tsx) | User Administration panel with Reset Password trigger. |
| [`components/user-data-table.tsx`](file:///c:/Users/nq352/Documents/GitHub/web-app-offshore/components/user-data-table.tsx) | User Data Directory with integrated Reset Password action for admins. |

---

## Part 2: Backend Database User Creation (SQL Reference)

To create a user directly at the database layer (e.g. using Supabase SQL Editor, `psql`, or migration scripts):

```sql
-- ==============================================================================
-- SQL Template: Direct Backend User Creation
-- Creates user in auth.users, public.profiles, company_memberships, and user_roles
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  -- Configure user parameters here:
  new_user_id UUID := gen_random_uuid();
  user_email TEXT := 'inspector.demo@company.com';
  user_password TEXT := 'InitialPass#2026!'; -- Plain text password (hashed automatically below)
  user_fullname TEXT := 'Inspection Engineer';
  user_designation TEXT := 'Senior Subsea Inspector';
  user_system_role TEXT := 'Operator'; -- Options: 'Admin', 'Operator', 'Viewer', 'User'
  user_company_role public.user_role := 'inspector'; -- Options: 'super_admin', 'company_admin', 'manager', 'inspector', 'viewer'
  force_first_login_change BOOLEAN := true; -- Set true to force password change on first login
  
  target_company_id UUID;
BEGIN
  -- 1. Locate company (defaults to first company or specify UUID)
  SELECT id INTO target_company_id FROM public.companies LIMIT 1;

  -- 2. Insert into auth.users (Supabase core auth table)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    user_email,
    extensions.crypt(user_password, extensions.gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', user_fullname,
      'designation', user_designation,
      'must_change_password', force_first_login_change
    ),
    now(),
    now(),
    '',
    ''
  );

  -- 3. Upsert into public.profiles
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    designation,
    is_active,
    must_change_password,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    user_email,
    user_fullname,
    user_designation,
    true,
    force_first_login_change,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      designation = EXCLUDED.designation,
      is_active = EXCLUDED.is_active,
      must_change_password = EXCLUDED.must_change_password;

  -- 4. Assign Company Membership (Multi-Tenant RBAC)
  IF target_company_id IS NOT NULL THEN
    INSERT INTO public.company_memberships (
      user_id,
      company_id,
      role,
      is_active
    ) VALUES (
      new_user_id,
      target_company_id,
      user_company_role,
      true
    )
    ON CONFLICT (user_id, company_id) DO UPDATE
    SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;
  END IF;

  -- 5. Assign Module Access in public.user_roles
  INSERT INTO public.user_roles (
    user_id,
    role,
    modules,
    updated_at
  ) VALUES (
    new_user_id::text,
    user_system_role,
    '["Field Assets", "Planning", "Inspection", "Work Packages", "Reports", "Platform 3D", "Smart Query"]'::jsonb,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET role = EXCLUDED.role, modules = EXCLUDED.modules;

  RAISE NOTICE 'Successfully created user % with UUID %', user_email, new_user_id;
END $$;
```
