-- =====================================================
-- MGI Profile Management System
-- =====================================================

-- 1. Create MGI Profiles Table
CREATE TABLE IF NOT EXISTS public.mgi_profiles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Thresholds configuration
    -- Format: [{"from_elevation": "MSL", "max_thickness": 127}, {"from_elevation": -30, "max_thickness": 127}, {"from_elevation": "Mudline", "max_thickness": 25}]
    thresholds JSONB DEFAULT '[]'::jsonb,
    
    -- Status flags
    is_active BOOLEAN DEFAULT false,
    is_job_specific BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- 2. Add foreign key to jobpack table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobpack' AND column_name='mgi_profile_id') THEN
        ALTER TABLE public.jobpack ADD COLUMN mgi_profile_id INTEGER REFERENCES public.mgi_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Row Level Security
ALTER TABLE public.mgi_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for everyone" ON public.mgi_profiles
    FOR SELECT USING (NOT is_archived);

CREATE POLICY "Enable write for authenticated users" ON public.mgi_profiles
    FOR ALL USING (auth.role() = 'authenticated');

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_mgi_profiles_active ON public.mgi_profiles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_jobpack_mgi_profile ON public.jobpack(mgi_profile_id);

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mgi_profiles_updated_at
    BEFORE UPDATE ON public.mgi_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.mgi_profiles IS 'Library of MGI inspection rules and thickness thresholds based on elevation.';
COMMENT ON COLUMN public.mgi_profiles.thresholds IS 'Array of elevation-based thickness rules. Supports labels like MSL, Mudline, and fractions of WD.';
