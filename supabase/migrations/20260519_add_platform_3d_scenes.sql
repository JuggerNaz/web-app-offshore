CREATE TABLE IF NOT EXISTS public.platform_3d_scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id UUID NOT NULL, 
    name TEXT NOT NULL,
    description TEXT,
    scene_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_3d_scenes_platform_id ON public.platform_3d_scenes(platform_id);

ALTER TABLE public.platform_3d_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON public.platform_3d_scenes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON public.platform_3d_scenes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON public.platform_3d_scenes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete access for authenticated users" ON public.platform_3d_scenes FOR DELETE TO authenticated USING (true);
