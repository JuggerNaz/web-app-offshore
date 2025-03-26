# Attachments Component Implementation Guide

This document provides instructions for implementing the file upload functionality in the Attachments component using Supabase Storage.

## Current Implementation

The current implementation in `attachments.tsx` includes:

- A UI for uploading, viewing, and downloading files
- Simulated file upload, view, and download functionality
- Loading and error states
- Toast notifications for user feedback

## Steps to Enable Real File Storage

To enable actual file storage with Supabase, follow these steps:

### 1. Set Up Supabase Storage Bucket

Run the setup script to create the necessary storage bucket:

```bash
node scripts/setup-storage.js
```

This script:
- Creates an 'attachments' bucket if it doesn't exist
- Sets up appropriate access policies for authenticated users
- Configures file size limits (50MB)

### 2. Uncomment Real Implementation Code

In `attachments.tsx`, uncomment and use the real implementation code:

1. Uncomment the `fetchFiles` function and its `useEffect` hook to load files from Supabase Storage
2. Uncomment the Supabase Storage upload code in `handleFileChange`
3. Uncomment the download functionality in `handleDownload`
4. Uncomment the view functionality in `handleView`

### 3. Required Environment Variables

Ensure these environment variables are set in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (for admin operations)
```

## File Storage Structure

Files in the attachments bucket will be stored with the following naming convention:
- `{timestamp}-{filename}` (e.g., `1648123456789-document.pdf`)

This prevents filename collisions and provides chronological ordering.

## Security Considerations

- The bucket is configured as private by default
- Only authenticated users can upload and download files
- File access requires proper authentication
- Consider implementing additional access controls based on user roles if needed

## Troubleshooting

If you encounter issues:

1. Check browser console for errors
2. Verify Supabase credentials are correct
3. Ensure the storage bucket exists
4. Check file size limits (max 50MB)
5. Verify user authentication status

## Future Enhancements

Consider these enhancements for the file upload functionality:

1. Progress indicators for large file uploads
2. File type validation and restrictions
3. Bulk upload capabilities
4. File deletion functionality
5. Thumbnail previews for images
6. Version control for documents
