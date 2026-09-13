-- ==============================================================================
-- Backend SQL Script: Reset User Password & Set Compulsory Change Flag
-- ==============================================================================

-- 1. Ensure required extensions and column exist (Self-healing / Idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- 2. Execute Password Reset and Set Compulsory Flag
DO $$
DECLARE
  target_user_email TEXT := 'user@example.com';   -- <--- CHANGE THIS to target user email
  new_temp_password TEXT := 'Offshore#Temp2026!';  -- <--- CHANGE THIS (or keep default temporary password)
  target_user_id UUID;
BEGIN
  -- 1. Find user ID by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE lower(email) = lower(target_user_email);

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email "%" was not found in auth.users', target_user_email;
  END IF;

  -- 2. Update password in auth.users and set must_change_password flag in user_metadata
  UPDATE auth.users
  SET 
    encrypted_password = extensions.crypt(new_temp_password, extensions.gen_salt('bf')),
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'must_change_password', true,
      'password_reset_at', now()
    ),
    updated_at = now()
  WHERE id = target_user_id;

  -- 3. Update public.profiles table
  UPDATE public.profiles
  SET 
    must_change_password = true,
    updated_at = now()
  WHERE id = target_user_id;

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'SUCCESS: Password reset for user: %', target_user_email;
  RAISE NOTICE 'User ID: %', target_user_id;
  RAISE NOTICE 'Temporary Password: %', new_temp_password;
  RAISE NOTICE 'Must change password on first login: TRUE';
  RAISE NOTICE '=======================================================';
END $$;
