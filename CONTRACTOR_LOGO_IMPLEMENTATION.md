# Contractor Logo Feature - Implementation Plan

## Overview
Add logo upload, storage, and display functionality to the Contractor Name library, following the same pattern used for structure photos in the platform.

---

## 1. Database Changes

### Add logo_url column to u_lib_list table

**SQL Migration:**
```sql
-- Add logo_url column to u_lib_list table
ALTER TABLE u_lib_list 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add comment
COMMENT ON COLUMN u_lib_list.logo_url IS 'URL to contractor logo image (for CONTRACTOR library)';
```

**File location:** `supabase/migrations/add_contractor_logo.sql`

---

## 2. File Upload Component

### Create ImageUpload component for library items

**File:** `app/dashboard/utilities/library/image-upload.tsx`

**Features:**
- Image preview
- Upload to Supabase Storage
- Delete existing image
- Drag & drop support
- File size validation (max 5MB)
- Image format validation (jpg, png, webp)

**Storage bucket:** `library-logos` (needs to be created in Supabase)

**Storage path pattern:** `{lib_code}/{lib_id}.{extension}`
Example: `CONTRACTOR/AMSB.png`

---

## 3. API Updates

### Update Library API Routes

**Files to modify:**
1. `app/api/library/[lib_code]/route.ts` (POST - create with logo)
2. `app/api/library/[lib_code]/[id]/route.ts` (PUT - update logo)

**Changes needed:**
- Accept `logo_url` in request payload
- Return `logo_url` in response
- Handle logo deletion when item is deleted

**Example API payload:**
```json
{
  "lib_id": "AMSB",
  "lib_desc": "ALAM Maritim (M) Sdn. Bhd.",
  "lib_com": "38F Level 4, Jalan Radin Anum...",
  "logo_url": "https://[supabase-url]/storage/v1/object/public/library-logos/CONTRACTOR/AMSB.png"
}
```

---

## 4. UI Updates

### A. Library List Display

**File:** `app/dashboard/utilities/library/page.tsx`

**Component:** `LibraryItemRow`

**Changes:**
- Add logo display (40x40px) next to ID/Code
- Show placeholder icon if no logo
- Add conditional rendering for CONTRACTOR library only

**Layout:**
```
[Logo] ID (CODE)     DESCRIPTION              COMMENTS
[40px] AMSB          ALAM Maritim (M)...     38F Level 4...
```

### B. Create Item Dialog

**File:** `app/dashboard/utilities/library/page.tsx`

**Component:** `CreateItemDialog`

**Changes:**
- Add ImageUpload component for CONTRACTOR library
- Upload image before creating item
- Store logo_url in database

### C. Edit Item Dialog

**File:** `app/dashboard/utilities/library/page.tsx`

**Component:** `EditItemDialog`

**Changes:**
- Show current logo with preview
- Allow logo replacement
- Allow logo deletion
- Update logo_url on save

---

## 5. Supabase Storage Setup

### Create storage bucket

**Bucket name:** `library-logos`

**Settings:**
- Public: Yes (for easy display)
- File size limit: 5MB
- Allowed MIME types: image/jpeg, image/png, image/webp

**RLS Policies:**
```sql
-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'library-logos');

-- Allow public read access
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'library-logos');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Allow authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'library-logos');
```

---

## 6. Implementation Steps (Recommended Order)

### Step 1: Database Setup
1. Run SQL migration to add `logo_url` column
2. Create `library-logos` storage bucket in Supabase
3. Set up RLS policies

### Step 2: Create Upload Component
1. Create `image-upload.tsx` component
2. Implement upload to Supabase Storage
3. Add image preview and delete functionality
4. Add validation (size, format)

### Step 3: Update API Routes
1. Modify POST endpoint to accept `logo_url`
2. Modify PUT endpoint to update `logo_url`
3. Add logo cleanup on DELETE

### Step 4: Update UI - Display
1. Add logo display to `LibraryItemRow`
2. Add conditional rendering for CONTRACTOR library
3. Style logo with proper sizing and borders

### Step 5: Update UI - Create/Edit
1. Add ImageUpload to `CreateItemDialog` for CONTRACTOR
2. Add ImageUpload to `EditItemDialog` for CONTRACTOR
3. Handle logo upload before form submission
4. Update form payload to include `logo_url`

### Step 6: Testing
1. Test logo upload for new contractor
2. Test logo display in list
3. Test logo update for existing contractor
4. Test logo deletion
5. Test with different image formats and sizes

---

## 7. Code Patterns to Follow

### Image Upload Pattern (from structure photos)
```typescript
// Upload to Supabase Storage
const uploadImage = async (file: File, lib_code: string, lib_id: string) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${lib_id}.${fileExt}`;
  const filePath = `${lib_code}/${fileName}`;

  const { data, error } = await supabase.storage
    .from('library-logos')
    .upload(filePath, file, { upsert: true });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('library-logos')
    .getPublicUrl(filePath);

  return publicUrl;
};
```

### Display Pattern
```tsx
{master.lib_code === "CONTRACTOR" && item.logo_url && (
  <img 
    src={item.logo_url} 
    alt={item.lib_desc}
    className="w-10 h-10 rounded border object-cover"
  />
)}
```

---

## 8. Additional Considerations

### Performance
- Lazy load images in list view
- Use image optimization (Next.js Image component)
- Cache logos in browser

### UX Enhancements
- Show upload progress
- Display image dimensions after upload
- Allow image cropping before upload
- Show file size in preview

### Error Handling
- Handle upload failures gracefully
- Show clear error messages
- Validate file before upload
- Handle missing/broken images

---

## 9. Files to Create/Modify

### New Files:
1. `app/dashboard/utilities/library/image-upload.tsx` - Upload component
2. `supabase/migrations/add_contractor_logo.sql` - Database migration

### Modified Files:
1. `app/dashboard/utilities/library/page.tsx` - UI updates
2. `app/api/library/[lib_code]/route.ts` - POST endpoint
3. `app/api/library/[lib_code]/[id]/route.ts` - PUT/DELETE endpoints

---

## 10. Estimated Effort

- **Database setup:** 15 minutes
- **Upload component:** 1-2 hours
- **API updates:** 30 minutes
- **UI updates:** 1-2 hours
- **Testing:** 30 minutes

**Total:** ~4-5 hours

---

## 11. Success Criteria

✅ Users can upload contractor logos when creating new contractors
✅ Logos display next to contractor names in the list
✅ Users can view and update logos when editing contractors
✅ Users can delete logos
✅ Only CONTRACTOR library shows logo functionality
✅ Images are properly validated (size, format)
✅ Broken/missing images show placeholder icon
✅ Upload progress is visible to users

---

## Notes

- This implementation follows the same pattern as structure photos
- Logo storage uses Supabase Storage (same as structure images)
- The feature is specific to CONTRACTOR library (lib_code = "CONTRACTOR")
- Logos are publicly accessible for easy display
- File naming convention ensures uniqueness per contractor
