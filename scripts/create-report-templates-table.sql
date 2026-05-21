-- Table to store report templates metadata for Executive Summaries
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- 'preliminary', 'final', or 'standard'
    storage_path TEXT NOT NULL, -- Path in Supabase Storage bucket 'report-templates'
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookup by type
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(type);

-- Policy to allow authenticated users to read templates
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read report templates" 
ON report_templates FOR SELECT 
TO authenticated 
USING (true);

-- Policy to allow authenticated users to manage templates (can be restricted further if needed)
CREATE POLICY "Allow authenticated users to manage report templates" 
ON report_templates FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);
