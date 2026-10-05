-- Enable Supabase Realtime for the attachment module so that edits made in the
-- Attachment Module are pushed live (cross-user / cross-machine) to the
-- Captured Events log in the inspection workspace.
-- Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attachment'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attachment;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'insp_media'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.insp_media;
  END IF;
END $$;
