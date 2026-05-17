-- Migration to create executive summary templates table
CREATE TABLE IF NOT EXISTS public.exec_summary_templates (
    id BIGSERIAL PRIMARY KEY,
    template_name TEXT NOT NULL,
    section_id TEXT NOT NULL, -- e.g. 'intro', 'cp', 'fmd'
    content TEXT NOT NULL,
    client_name TEXT, -- Optional, to filter by client
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for faster lookups by section
CREATE INDEX IF NOT EXISTS idx_exec_summary_templates_section ON public.exec_summary_templates(section_id);

-- Enable RLS
ALTER TABLE public.exec_summary_templates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and write
CREATE POLICY "Allow all for authenticated users" ON public.exec_summary_templates
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
