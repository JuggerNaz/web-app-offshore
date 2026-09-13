-- Migration to add must_change_password to public.profiles
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

-- Policy to allow authenticated users to view and update their own must_change_password column
DO $$
BEGIN
  -- Re-confirm user self-update policy covers must_change_password
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
