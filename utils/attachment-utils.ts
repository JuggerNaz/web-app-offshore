/**
 * Safely resolves the public URL for an attachment, 
 * handling both full URLs (multi-cloud), local proxies, and relative storage paths.
 */
export function getAttachmentUrl(attachment: any, supabase?: any): string {
    if (!attachment) return "";
    
    // Direct URL strings
    if (typeof attachment === 'string') {
        const str = attachment.trim();
        if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('blob:') || str.startsWith('data:')) {
            return str;
        }
        return `/api/attachment/download?path=${encodeURIComponent(str)}`;
    }

    const rawPath = attachment.path || attachment.file_path || attachment.url || attachment.file_url || attachment.storage_path;

    // If it's already a full URL or blob URL or data URL
    if (typeof rawPath === 'string') {
        const clean = rawPath.trim();
        if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('blob:') || clean.startsWith('data:')) {
            return clean;
        }
    }

    // If we have an ID, route through URL proxy which handles both database IDs and media IDs
    if (attachment.id) {
        const pathParam = rawPath ? `&path=${encodeURIComponent(rawPath)}` : '';
        return `/api/attachment/url?id=${encodeURIComponent(attachment.id)}${pathParam}`;
    }

    // Fallback for attachments without IDs
    if (rawPath) {
        const bucket = attachment.meta?.bucket || attachment.bucket || 'attachments';
        return `/api/attachment/download?path=${encodeURIComponent(rawPath)}&bucket=${bucket}`;
    }

    return "";
}
