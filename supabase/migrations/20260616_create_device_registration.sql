-- Add device restriction setting to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS device_restriction_type VARCHAR(20) NOT NULL DEFAULT 'none';

-- Create registered_devices table
CREATE TABLE IF NOT EXISTS public.registered_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  device_name     VARCHAR(100) NOT NULL,
  device_token    VARCHAR(255) NOT NULL UNIQUE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  registered_by   UUID NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.registered_devices ENABLE ROW LEVEL SECURITY;

-- Allow super_admins and company_admins to manage devices
DROP POLICY IF EXISTS "Admins can manage devices" ON public.registered_devices;
CREATE POLICY "Admins can manage devices"
  ON public.registered_devices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.user_id = auth.uid()
      AND cm.role IN ('super_admin', 'company_admin')
      AND cm.is_active = true
    )
  );

-- Add check constraint for device restriction type
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS chk_device_restriction_type,
ADD CONSTRAINT chk_device_restriction_type 
CHECK (device_restriction_type IN ('none', 'enforced'));
