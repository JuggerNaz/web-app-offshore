/**
 * Device Capabilities Detection and Compatibility Checking
 * Detects available cameras, microphones, and browser capabilities
 */

export interface DeviceInfo {
    deviceId: string;
    label: string;
    kind: 'videoinput' | 'audioinput';
    capabilities?: MediaTrackCapabilities;
}

export interface CodecSupport {
    name: string;
    mimeType: string;
    supported: boolean;
}

export interface BrowserCapabilities {
    mediaDevices: boolean;
    mediaRecorder: boolean;
    fileSystemAccess: boolean;
    canvas: boolean;
}

export interface MissingDependency {
    type: 'codec' | 'driver' | 'browser' | 'api';
    name: string;
    reason: string;
    recommendation: string;
    downloadUrl?: string;
}

/**
 * Enumerate all available video and audio devices
 */
export async function enumerateDevices(): Promise<{
    videoDevices: DeviceInfo[];
    audioDevices: DeviceInfo[];
}> {
    try {
        // Don't request permissions here - it auto-starts the camera!
        // Just enumerate devices - labels will be generic until user grants permission
        const devices = await navigator.mediaDevices.enumerateDevices();

        const videoDevices: DeviceInfo[] = [];
        const audioDevices: DeviceInfo[] = [];

        for (const device of devices) {
            if (device.kind === 'videoinput') {
                videoDevices.push({
                    deviceId: device.deviceId,
                    label: device.label || `Camera ${videoDevices.length + 1}`,
                    kind: device.kind,
                });
            } else if (device.kind === 'audioinput') {
                audioDevices.push({
                    deviceId: device.deviceId,
                    label: device.label || `Microphone ${audioDevices.length + 1}`,
                    kind: device.kind,
                });
            }
        }

        return { videoDevices, audioDevices };
    } catch (error) {
        console.error('Error enumerating devices:', error);
        return { videoDevices: [], audioDevices: [] };
    }
}

/**
 * Get capabilities for a specific device
 */
export async function getDeviceCapabilities(
    deviceId: string,
    kind: 'videoinput' | 'audioinput'
): Promise<MediaTrackCapabilities | null> {
    try {
        const constraints = kind === 'videoinput'
            ? { video: { deviceId: { exact: deviceId } } }
            : { audio: { deviceId: { exact: deviceId } } };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const track = kind === 'videoinput' ? stream.getVideoTracks()[0] : stream.getAudioTracks()[0];

        const capabilities = track.getCapabilities();

        // Stop the stream
        stream.getTracks().forEach(track => track.stop());

        return capabilities;
    } catch (error) {
        console.error('Error getting device capabilities:', error);
        return null;
    }
}

/**
 * Check which video/audio codecs are supported
 */
export function checkCodecSupport(): CodecSupport[] {
    const codecs = [
        { name: 'WebM VP9', mimeType: 'video/webm;codecs=vp9,opus' },
        { name: 'WebM VP8', mimeType: 'video/webm;codecs=vp8,vorbis' },
        { name: 'MP4 H.264', mimeType: 'video/mp4;codecs=h264,aac' },
        { name: 'MP4 H.265', mimeType: 'video/mp4;codecs=h265,aac' },
        { name: 'WebM AV1', mimeType: 'video/webm;codecs=av1,opus' },
    ];

    return codecs.map(codec => ({
        ...codec,
        supported: MediaRecorder.isTypeSupported(codec.mimeType),
    }));
}

/**
 * Check browser API support
 */
export function checkBrowserSupport(): BrowserCapabilities {
    return {
        mediaDevices: !!navigator.mediaDevices,
        mediaRecorder: !!window.MediaRecorder,
        fileSystemAccess: 'showSaveFilePicker' in window,
        canvas: !!document.createElement('canvas').getContext('2d'),
    };
}

/**
 * Detect missing dependencies and provide recommendations
 */
export function detectMissingDependencies(): MissingDependency[] {
    const dependencies: MissingDependency[] = [];
    const browserSupport = checkBrowserSupport();
    const codecSupport = checkCodecSupport();

    // Check MediaRecorder support
    if (!browserSupport.mediaRecorder) {
        dependencies.push({
            type: 'browser',
            name: 'MediaRecorder API',
            reason: 'Your browser doesn\'t support video recording',
            recommendation: 'Update to Chrome 47+, Firefox 25+, or Edge 79+',
        });
    }

    // Check File System Access API
    if (!browserSupport.fileSystemAccess) {
        dependencies.push({
            type: 'api',
            name: 'File System Access API',
            reason: 'Direct file saving not available',
            recommendation: 'Update to Chrome 86+ for better file management. Files will download to Downloads folder.',
        });
    }

    // Check if at least one codec is supported
    const hasCodec = codecSupport.some(c => c.supported);
    if (!hasCodec) {
        dependencies.push({
            type: 'codec',
            name: 'Video Codec',
            reason: 'No supported video codecs found',
            recommendation: 'Update your browser to the latest version',
        });
    }

    return dependencies;
}

/**
 * Validate settings against device capabilities
 */
export async function validateSettings(settings: {
    videoDeviceId: string;
    resolution: string;
    frameRate: number;
}): Promise<{ valid: boolean; warnings: string[] }> {
    const warnings: string[] = [];

    try {
        const capabilities = await getDeviceCapabilities(settings.videoDeviceId, 'videoinput');

        if (!capabilities) {
            warnings.push('Unable to verify device capabilities');
            return { valid: false, warnings };
        }

        // Check resolution
        const [width, height] = settings.resolution.split('x').map(Number);
        if (capabilities.width && capabilities.width.max && width > capabilities.width.max) {
            warnings.push(`Resolution ${settings.resolution} exceeds device maximum (${capabilities.width.max}x${capabilities.height?.max})`);
        }

        // Check frame rate
        if (capabilities.frameRate && capabilities.frameRate.max && settings.frameRate > capabilities.frameRate.max) {
            warnings.push(`Frame rate ${settings.frameRate}fps exceeds device maximum (${capabilities.frameRate.max}fps)`);
        }

        // Performance warning for high settings
        if (width >= 3840 && settings.frameRate >= 60) {
            warnings.push('4K @ 60fps may cause frame drops on this device. Consider 1080p @ 60fps or 4K @ 30fps.');
        }

        return { valid: warnings.length === 0, warnings };
    } catch (error) {
        warnings.push('Error validating settings');
        return { valid: false, warnings };
    }
}

/**
 * Monitor device connect/disconnect events
 */
export function monitorDeviceChanges(callback: () => void): () => void {
    const handleDeviceChange = () => {
        callback();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    // Return cleanup function
    return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
}
