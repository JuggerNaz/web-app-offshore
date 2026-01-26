/**
 * WebM Duration Fix - Using webm-duration-fix library
 * This library properly injects duration metadata without corrupting the file
 */

import fixWebmDuration from 'webm-duration-fix';

/**
 * Fix WebM duration metadata for proper seeking
 * This uses the webm-duration-fix library which is more reliable
 */
export async function fixWebMDuration(blob: Blob, durationMs: number): Promise<Blob> {
    if (!blob.type.includes('webm')) {
        return blob;
    }

    try {
        // Convert duration from milliseconds to seconds (library expects seconds)
        const durationSeconds = durationMs / 1000;

        // Apply the fix
        const fixedBlob = await (fixWebmDuration as any)(blob, durationSeconds);

        console.log(`✅ WebM duration fixed: ${durationSeconds}s`);
        return fixedBlob;

    } catch (error) {
        console.error('❌ WebM duration fix failed:', error);
        return blob; // Return original if fix fails
    }
}

/**
 * Check if WebM fix is needed
 */
export function needsWebMFix(mimeType: string): boolean {
    return mimeType.includes('webm');
}
