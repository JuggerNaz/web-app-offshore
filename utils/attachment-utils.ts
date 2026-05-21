/**
 * Safely resolves the public URL for an attachment, 
 * handling both full URLs (multi-cloud) and relative paths (legacy Supabase).
 */
export function getAttachmentUrl(attachment: any, supabase?: any): string {
    if (!attachment) return "";
    
    // If we have an ID, use our secure redirect proxy
    // This handles private buckets by generating signed URLs on the fly
    if (attachment.id) {
        return `/api/attachment/url?id=${attachment.id}`;
    }

    // Fallback for attachments without IDs (e.g., unsaved previews)
    const path = attachment.path;
    if (!path) return "";

    // If it's already a full URL or local proxy, return it
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('local://')) {
        return path;
    }

    // Legacy Supabase fallback
    if (supabase) {
        try {
            const { data } = supabase.storage.from('attachments').getPublicUrl(path);
            return data?.publicUrl || "";
        } catch (err) {
            return "";
        }
    }

    return path;
}
