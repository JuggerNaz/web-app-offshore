/**
 * Media Recorder Utilities
 * Core recording logic and file management
 */

export interface RecordingConfig {
    videoFormat: string;
    videoBitsPerSecond?: number;
    audioBitsPerSecond?: number;
}

export interface FormatConfig {
    mimeType: string;
    videoBitsPerSecond: number;
    audioBitsPerSecond: number;
    extension: string;
}

// Format configurations
export const FORMAT_CONFIGS: Record<string, FormatConfig> = {
    'webm-vp9': {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000, // 2.5 Mbps for 1080p
        audioBitsPerSecond: 128000,
        extension: '.webm',
    },
    'webm-vp8': {
        mimeType: 'video/webm;codecs=vp8,vorbis',
        videoBitsPerSecond: 3000000, // 3 Mbps for 1080p
        audioBitsPerSecond: 128000,
        extension: '.webm',
    },
    'mp4-h264': {
        mimeType: 'video/mp4;codecs=h264,aac',
        videoBitsPerSecond: 4000000, // 4 Mbps for 1080p
        audioBitsPerSecond: 192000,
        extension: '.mp4',
    },
    'mp4-h265': {
        mimeType: 'video/mp4;codecs=h265,aac',
        videoBitsPerSecond: 2000000, // 2 Mbps for 1080p (better compression)
        audioBitsPerSecond: 192000,
        extension: '.mp4',
    },
    'webm-av1': {
        mimeType: 'video/webm;codecs=av1,opus',
        videoBitsPerSecond: 1500000, // 1.5 Mbps for 1080p (best compression)
        audioBitsPerSecond: 128000,
        extension: '.webm',
    },
};

/**
 * Create a MediaRecorder instance with the specified configuration
 */
export function createMediaRecorder(
    stream: MediaStream,
    config: RecordingConfig
): MediaRecorder | null {
    try {
        const formatConfig = FORMAT_CONFIGS[config.videoFormat];
        if (!formatConfig) {
            console.error('Invalid video format:', config.videoFormat);
            return null;
        }

        // Check if format is supported
        if (!MediaRecorder.isTypeSupported(formatConfig.mimeType)) {
            console.error('Format not supported:', formatConfig.mimeType);
            return null;
        }

        const options = {
            mimeType: formatConfig.mimeType,
            videoBitsPerSecond: config.videoBitsPerSecond || formatConfig.videoBitsPerSecond,
            audioBitsPerSecond: config.audioBitsPerSecond || formatConfig.audioBitsPerSecond,
        };

        return new MediaRecorder(stream, options);
    } catch (error) {
        console.error('Error creating MediaRecorder:', error);
        return null;
    }
}

/**
 * Start recording and collect chunks
 * Now tracks duration for metadata purposes
 */
export function startRecording(
    mediaRecorder: MediaRecorder,
    onDataAvailable: (blob: Blob) => void,
    onStop: (blob: Blob, duration: number) => void
): void {
    const chunks: Blob[] = [];
    const startTime = Date.now();

    mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            chunks.push(event.data);
            onDataAvailable(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        const duration = Date.now() - startTime;
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
        onStop(blob, duration);
    };

    mediaRecorder.start(1000); // Collect data every second
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(
    prefix: string,
    extension: string,
    context?: {
        platformId?: string;
        componentId?: string;
    }
): string {
    const now = new Date();
    const date = now.toISOString().split('T')[0].replace(/-/g, '');
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '');

    if (context?.platformId && context?.componentId) {
        return `${context.platformId}_${context.componentId}_${date}_${time}${extension}`;
    }

    return `${prefix}_${date}_${time}${extension}`;
}

/**
 * Save file using File System Access API (Chrome/Edge)
 */
export async function saveFileWithPicker(
    blob: Blob,
    suggestedName: string
): Promise<boolean> {
    try {
        // @ts-ignore - File System Access API
        const handle = await window.showSaveFilePicker({
            suggestedName,
            types: [{
                description: 'Video Files',
                accept: {
                    'video/webm': ['.webm'],
                    'video/mp4': ['.mp4'],
                },
            }],
        });

        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();

        return true;
    } catch (error) {
        console.error('Error saving file with picker:', error);
        return false;
    }
}

/**
 * Save file using download (fallback for all browsers)
 */
export function saveFileWithDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Save file (tries File System Access API first, falls back to download)
 */
export async function saveFile(
    blob: Blob,
    filename: string,
    directoryHandle?: FileSystemDirectoryHandle | null
): Promise<void> {
    // If directory handle provided, save to that directory
    if (directoryHandle) {
        try {
            const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        } catch (error) {
            console.error('Error saving to directory:', error);
            // Fall through to default download
        }
    }

    // Direct download without prompting (no showSaveFilePicker)
    saveFileWithDownload(blob, filename);
}

/**
 * Capture snapshot from video element
 */
export function captureSnapshot(
    videoElement: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    format: string = 'jpeg-95'
): Blob | null {
    try {
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Set canvas size to match video
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;

        // Draw video frame
        ctx.drawImage(videoElement, 0, 0);

        // Determine format and quality
        let mimeType = 'image/jpeg';
        let quality = 0.95;

        if (format.startsWith('jpeg-')) {
            const qualityPercent = parseInt(format.split('-')[1]);
            quality = qualityPercent / 100;
        } else if (format === 'png') {
            mimeType = 'image/png';
        } else if (format.startsWith('webp')) {
            mimeType = 'image/webp';
            quality = format === 'webp-lossless' ? 1.0 : 0.9;
        }

        // Convert to blob
        return new Promise<Blob | null>((resolve) => {
            canvas.toBlob(
                (blob) => resolve(blob),
                mimeType,
                quality
            );
        }) as any;
    } catch (error) {
        console.error('Error capturing snapshot:', error);
        return null;
    }
}

/**
 * Get file extension for photo format
 */
export function getPhotoExtension(format: string): string {
    if (format.startsWith('jpeg')) return '.jpg';
    if (format === 'png') return '.png';
    if (format.startsWith('webp')) return '.webp';
    if (format === 'bmp') return '.bmp';
    return '.jpg';
}
