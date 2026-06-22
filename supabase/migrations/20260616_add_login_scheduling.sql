-- Migration to support time-based login restrictions
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS login_restriction_type VARCHAR(20) NOT NULL DEFAULT 'always',
ADD COLUMN IF NOT EXISTS allowed_start_time TIME WITHOUT TIME ZONE NOT NULL DEFAULT '08:00:00',
ADD COLUMN IF NOT EXISTS allowed_end_time TIME WITHOUT TIME ZONE NOT NULL DEFAULT '17:00:00',
ADD COLUMN IF NOT EXISTS allowed_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5], -- 1 = Mon, 7 = Sun
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kuala_Lumpur';

-- Add check constraint for restriction type
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS chk_login_restriction_type,
ADD CONSTRAINT chk_login_restriction_type 
CHECK (login_restriction_type IN ('always', 'scheduled'));
