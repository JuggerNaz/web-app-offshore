-- Update the attachments bucket to allow video files and larger sizes
UPDATE storage.buckets
SET 
  public = true,
  file_size_limit = 524288000, -- 500MB
  allowed_mime_types = ARRAY[
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'image/webp',
    'application/pdf',
    'video/mp4',
    'video/mpeg',
    'video/ogg',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-flv',
    'video/3gpp',
    'video/3gpp2',
    'video/x-ms-wmv',
    'video/x-ms-asf',
    'video/mp2t',
    'video/x-matroska'
  ]
WHERE id = 'attachments';

-- If it doesn't exist, create it (fallback)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'attachments', 'attachments', true, 524288000, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-flv', 'video/3gpp', 'video/3gpp2', 'video/x-ms-wmv', 'video/x-ms-asf', 'video/mp2t', 'video/x-matroska']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'attachments');
