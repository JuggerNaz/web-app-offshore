-- SQL Script to set up user roles and module permissions

CREATE TABLE IF NOT EXISTS public.user_roles (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'User', -- 'Admin', 'Operator', 'Viewer', etc.
    modules JSONB DEFAULT '[]'::jsonb, -- Array of allowed module names like '["ROV", "Diving", "User Data"]'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Turn on RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow authenticated to read user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- Allow admins to insert/update user roles
-- (We use a subquery to see if the current user requesting the update is an Admin)
CREATE POLICY "Allow admins to insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()::text AND role = 'Admin'
    )
);

CREATE POLICY "Allow admins to update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()::text AND role = 'Admin'
    )
);

-- Automatically create a default role for the first user (making them Admin)
CREATE OR REPLACE FUNCTION set_initial_admin()
RETURNS jsonb AS $$
DECLARE
    first_user_id VARCHAR(255);
BEGIN
    -- Only do this if table is empty
    IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
        SELECT id::text INTO first_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
        
        IF first_user_id IS NOT NULL THEN
            INSERT INTO public.user_roles (user_id, role, modules)
            VALUES (first_user_id, 'Admin', '["ROV", "Diving", "Settings", "Planning", "Reports", "User Data"]'::jsonb);
            RETURN jsonb_build_object('success', true, 'admin', first_user_id);
        END IF;
    END IF;
    RETURN jsonb_build_object('success', false, 'reason', 'Already has roles or no users exist');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Quick execute
SELECT set_initial_admin();
