-- Create the attachments bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments', 
  true,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Create policy to allow public access for reading files
CREATE POLICY "Public read access for attachments" ON storage.objects
FOR SELECT USING (bucket_id = 'attachments');

-- Create policy to allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload attachments" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'attachments' AND auth.role() = 'authenticated');

-- Create policy to allow users to update their own files
CREATE POLICY "Users can update their own attachments" ON storage.objects
FOR UPDATE USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create policy to allow users to delete their own files  
CREATE POLICY "Users can delete their own attachments" ON storage.objects
FOR DELETE USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
