/**
 * Codec Support Detection
 * Check which video/audio codecs are supported by the browser
 */

export interface CodecSupport {
    format: string;
    supported: boolean;
    mimeType: string;
}

/**
 * Check if a specific MIME type is supported for recording
 */
export function isCodecSupported(mimeType: string): boolean {
    if (typeof MediaRecorder === 'undefined') {
        return false;
    }
    return MediaRecorder.isTypeSupported(mimeType);
}

/**
 * Get all supported video formats
 */
export function getSupportedFormats(): CodecSupport[] {
    const formats = [
        { format: 'webm-vp9', mimeType: 'video/webm;codecs=vp9,opus' },
        { format: 'webm-vp8', mimeType: 'video/webm;codecs=vp8,vorbis' },
        { format: 'mp4-h264', mimeType: 'video/mp4' }, // Simplified - browser will use default codecs
        { format: 'mp4-h265', mimeType: 'video/mp4;codecs=hvc1' },
        { format: 'webm-av1', mimeType: 'video/webm;codecs=av1,opus' },
    ];

    return formats.map(f => ({
        ...f,
        supported: isCodecSupported(f.mimeType),
    }));
}

/**
 * Get the best supported format (fallback logic)
 */
export function getBestSupportedFormat(): string {
    const supported = getSupportedFormats();

    // Prefer VP9 > VP8 > H.264 > H.265 > AV1
    const preference = ['webm-vp9', 'webm-vp8', 'mp4-h264', 'mp4-h265', 'webm-av1'];

    for (const format of preference) {
        const codec = supported.find(c => c.format === format);
        if (codec?.supported) {
            return format;
        }
    }

    // Fallback to first supported format
    const firstSupported = supported.find(c => c.supported);
    return firstSupported?.format || 'webm-vp9';
}

/**
 * Validate if selected format is supported, return fallback if not
 */
export function validateFormat(selectedFormat: string): string {
    const supported = getSupportedFormats();
    const codec = supported.find(c => c.format === selectedFormat);

    if (codec?.supported) {
        return selectedFormat;
    }

    // Return best supported format as fallback
    return getBestSupportedFormat();
}
