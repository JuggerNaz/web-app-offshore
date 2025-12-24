# Structure Image Feature

## Overview

The Structure Image feature allows users to upload, view, and manage structure diagrams for platforms and pipelines. This feature is integrated into the existing Structure detail pages under the "Structure Image" tab.

## Features

### 1. **Image Upload**
- **Drag & Drop**: Drag an image file directly onto the upload area
- **Click to Browse**: Click the "Select Image" button to choose a file from your device
- **Supported Formats**: JPEG, JPG, PNG, WEBP, GIF
- **File Size Limit**: 10MB maximum

### 2. **Image Display**
- Full-width responsive image viewer
- Image metadata display (filename and file size)
- High-quality image rendering with Next.js Image optimization

### 3. **Image Management**
- **Replace Image**: Upload a new image to replace the existing one
- **Delete Image**: Remove the current structure image with a single click
- Automatic cleanup of old images when uploading new ones

### 4. **Visual Feedback**
- Drag-and-drop visual indicators
- Upload progress indicator
- Error messages for failed uploads or validation issues
- Loading states during operations

## Technical Implementation

### Storage Architecture
- **Storage Location**: Supabase Storage bucket `attachments`
- **Folder Structure**: `structure-images/structure-{type}-{id}-{timestamp}.{ext}`
- **Database**: Uses the existing `attachment` table
- **Source Type**: `platform_structure_image` or `pipeline_structure_image`
- **Source ID**: The platform or pipeline ID

### Component Structure
```
components/
└── structure-image/
    └── structure-image.tsx    # Main component
```

### Data Flow
1. User uploads an image via drag-and-drop or file selection
2. Image is validated (type and size)
3. If an existing image exists, it's deleted from storage and database
4. New image is uploaded to Supabase Storage
5. Metadata is saved to the `attachment` table
6. Component state is updated to display the new image

### Integration
The component is integrated into:
- `app/dashboard/field/[type]/[id]/page.tsx`
- Appears as the "Structure Image" tab in platform and pipeline detail pages

## Usage

### For Users

1. **Navigate** to any platform or pipeline detail page
2. **Click** on the "Structure Image" tab
3. **Upload** an image:
   - Drag and drop an image file onto the upload area, OR
   - Click "Select Image" and choose a file from your device
4. **View** the uploaded structure diagram
5. **Replace** or **Delete** as needed using the buttons provided

### For Developers

#### Using the Component
```tsx
import StructureImage from "@/components/structure-image/structure-image";

<StructureImage />
```

The component automatically detects:
- Current page type (platform/pipeline) via `urlType` atom
- Current item ID via `urlId` atom

#### Storage Configuration
The component uses the existing `attachments` bucket. Ensure the bucket:
- Exists in Supabase Storage
- Has proper access policies set up
- Allows public read access for viewing images

#### API Endpoints Used
- `GET /api/attachment/{sourceType}/{id}` - Fetch existing structure image
- Database operations via Supabase client for insert/delete

## Configuration

### Next.js Image Configuration
The `next.config.js` has been updated to allow images from Supabase:

```js
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '*.supabase.co',
    },
  ],
}
```

### Environment Variables
Uses existing Supabase configuration:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Database Schema

Uses the existing `attachment` table with the following fields:
- `id`: Primary key
- `name`: Original filename
- `path`: Storage file path
- `source_id`: Platform or pipeline ID
- `source_type`: `platform_structure_image` or `pipeline_structure_image`
- `meta`: JSON object containing:
  - `file_url`: Public URL of the image
  - `original_file_name`: Original name of the uploaded file
  - `file_path`: Path in storage
  - `file_size`: File size in bytes
  - `file_type`: MIME type

## Error Handling

The component handles various error scenarios:
- Invalid file types
- Files exceeding size limit
- Upload failures
- Storage deletion errors
- Database operation errors

All errors are displayed to the user with clear, actionable messages.

## Future Enhancements

Potential improvements:
- Image annotation tools
- Multiple structure images (different views)
- Image versioning/history
- Zoom and pan controls for large diagrams
- Image comparison between versions
- PDF support for engineering drawings
- Automatic image optimization/compression
