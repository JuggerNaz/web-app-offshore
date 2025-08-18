/**
 * Utility functions for handling Supabase storage URLs and attachments
 */

/**
 * Get the Supabase URL from environment variables
 */
export const getSupabaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // Client-side: access from window object if set by Next.js
    return process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  }
  // Server-side: access normally
  return process.env.NEXT_PUBLIC_SUPABASE_URL || '';
};

/**
 * Generate a public storage URL for a file path
 * @param bucketName - The storage bucket name
 * @param filePath - The file path within the bucket
 * @returns The complete public URL
 */
export const getStoragePublicUrl = (bucketName: string, filePath: string): string => {
  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl || !filePath) return '';
  
  return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${filePath}`;
};

/**
 * Check if a string is already a complete URL
 * @param url - The URL to check
 * @returns boolean indicating if it's a complete URL
 */
export const isCompleteUrl = (url: string): boolean => {
  return url.startsWith('http://') || url.startsWith('https://');
};

/**
 * Extract filename from a file path or URL
 * @param pathOrUrl - The file path or URL
 * @returns The filename
 */
export const extractFilename = (pathOrUrl: string): string => {
  if (!pathOrUrl) return 'File';
  
  // Remove query parameters and hash
  const cleanPath = pathOrUrl.split('?')[0].split('#')[0];
  
  // Extract filename
  const parts = cleanPath.split('/');
  return parts[parts.length - 1] || 'File';
};

/**
 * Process attachment data to get the correct file URL and filename
 * @param attachment - The attachment object from the database
 * @returns Object containing the processed fileUrl and fileName
 */
export const processAttachmentUrl = (attachment: any): { fileUrl: string | null; fileName: string } => {
  let fileUrl = attachment.path;
  let fileName = attachment.name || 'File';

  // If meta exists, try to get URL and original filename from there
  if (attachment.meta && typeof attachment.meta === 'object') {
    const meta = attachment.meta as any;
    if (meta.file_url) {
      fileUrl = meta.file_url;
    }
    if (meta.original_file_name) {
      fileName = meta.original_file_name;
    }
  }

  // If path looks like a filename (no http/https), construct the proper URL
  if (fileUrl && !isCompleteUrl(fileUrl)) {
    fileUrl = getStoragePublicUrl('attachments', fileUrl);
  }

  return { fileUrl, fileName };
};

/**
 * Truncate text to specified length with ellipsis
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};
