-- Add findings column to defect_criteria_rules table
ALTER TABLE public.defect_criteria_rules 
ADD COLUMN IF NOT EXISTS findings TEXT;

COMMENT ON COLUMN public.defect_criteria_rules.findings IS 'Suggested findings notes to populate on matched inspection records';

-- Enable replication for defect_criteria_rules
ALTER TABLE public.defect_criteria_rules REPLICA IDENTITY FULL;

-- Add defect_criteria_rules to the supabase_realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'defect_criteria_rules'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.defect_criteria_rules;
    END IF;
  END IF;
END $$;
