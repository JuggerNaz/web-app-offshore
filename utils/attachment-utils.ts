/**
 * Safely resolves the public URL for an attachment, 
 * handling both full URLs (multi-cloud), local proxies, and relative storage paths.
 */
export function getAttachmentUrl(attachment: any, supabase?: any): string {
    if (!attachment) return "";
    
    // Direct URL strings
    if (typeof attachment === 'string') {
        const str = attachment.trim();
        if (str.startsWith('blob:') || str.startsWith('data:')) {
            return str;
        }
        if (str.includes('backblazeb2.com') || str.includes('amazonaws.com')) {
            return `/api/attachment/download?path=${encodeURIComponent(str)}`;
        }
        if (str.startsWith('http://') || str.startsWith('https://')) {
            return str;
        }
        return `/api/attachment/download?path=${encodeURIComponent(str)}`;
    }

    const rawPath = attachment.path || attachment.file_path || attachment.url || attachment.file_url || attachment.storage_path || attachment.meta?.file_url || attachment.meta?.file_path;

    // If we have an ID, always prefer the backend proxy endpoint `/api/attachment/url` which handles Supabase & S3/Backblaze streaming
    if (attachment.id) {
        const pathParam = rawPath ? `&path=${encodeURIComponent(rawPath)}` : '';
        return `/api/attachment/url?id=${encodeURIComponent(attachment.id)}${pathParam}`;
    }

    // Direct blob or data URL
    if (typeof rawPath === 'string') {
        const clean = rawPath.trim();
        if (clean.startsWith('blob:') || clean.startsWith('data:')) {
            return clean;
        }
        if (clean.includes('backblazeb2.com') || clean.includes('amazonaws.com')) {
            return `/api/attachment/download?path=${encodeURIComponent(clean)}`;
        }
        if (clean.startsWith('http://') || clean.startsWith('https://')) {
            return clean;
        }
    }

    // Fallback for attachments without IDs
    if (rawPath) {
        const bucket = attachment.meta?.bucket || attachment.bucket || 'attachments';
        return `/api/attachment/download?path=${encodeURIComponent(rawPath)}&bucket=${bucket}`;
    }

    return "";
}
