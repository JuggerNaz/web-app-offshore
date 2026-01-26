import fixWebmDuration from 'fix-webm-duration';

/**
 * Apply WebM duration fix to a blob
 */
export async function applyWebMFix(blob: Blob, durationMs: number): Promise<Blob> {
    if (!blob.type.includes('webm')) {
        return blob;
    }

    try {
        const fixed = fixWebmDuration(blob, durationMs);
        console.log(`WebM duration fixed: ${durationMs}ms`);
        return fixed;
    } catch (error) {
        console.error('WebM fix error:', error);
        return blob;
    }
}
