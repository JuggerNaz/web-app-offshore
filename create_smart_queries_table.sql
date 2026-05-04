-- ============================================================================
-- Smart Query: Saved Query Templates Table
-- Run this in Supabase SQL Editor to create the table
-- ============================================================================

CREATE TABLE IF NOT EXISTS smart_queries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    config      JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for fast user-scoped lookups
CREATE INDEX IF NOT EXISTS idx_smart_queries_user_id ON smart_queries(user_id);

-- Enable Row Level Security
ALTER TABLE smart_queries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own saved queries
CREATE POLICY "Users can view own saved queries"
    ON smart_queries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own saved queries"
    ON smart_queries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved queries"
    ON smart_queries FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved queries"
    ON smart_queries FOR DELETE
    USING (auth.uid() = user_id);
