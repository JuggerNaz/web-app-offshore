/**
 * WebM Duration Fix - Inline Implementation
 * No external dependencies required
 */

export async function fixWebMDuration(blob: Blob, durationMs: number): Promise<Blob> {
    try {
        if (!blob.type.includes('webm')) {
            return blob;
        }

        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        // Find Duration element (EBML ID: 0x4489)
        let durationOffset = -1;
        for (let i = 0; i < bytes.length - 10; i++) {
            if (bytes[i] === 0x44 && bytes[i + 1] === 0x89) {
                durationOffset = i;
                break;
            }
        }

        if (durationOffset === -1) {
            console.warn('Duration element not found in WebM');
            return blob;
        }

        // Create a copy of the bytes
        const fixedBytes = new Uint8Array(bytes);

        // Write duration as IEEE 754 double (8 bytes, big-endian)
        const view = new DataView(fixedBytes.buffer);
        // Skip element ID (2 bytes) and size indicator (typically 1 byte)
        const valueOffset = durationOffset + 3;
        view.setFloat64(valueOffset, durationMs, false);

        return new Blob([fixedBytes], { type: blob.type });
    } catch (error) {
        console.error('WebM duration fix error:', error);
        return blob;
    }
}
