/**
 * Settings Manager - Workstation-specific settings persistence
 * Saves and loads video recorder settings from localStorage
 */

export interface WorkstationSettings {
    video: {
        deviceId: string;
        resolution: string;
        frameRate: number;
        aspectRatio: string;
    };
    audio: {
        deviceId: string;
        sampleRate: number;
        channels: number;
        echoCancellation: boolean;
        noiseSuppression: boolean;
        autoGainControl: boolean;
    };
    recording: {
        video: {
            format: string;
            filenamePrefix: string;
            storagePath: string;
            autoSplit: boolean;
            splitBySize: boolean;
            splitSizeMB: number;
            splitByTime: boolean;
            splitTimeMinutes: number;
        };
        photo: {
            format: string;
            filenamePrefix: string;
            storagePath: string;
        };
    };
    lastModified: string;
    workstationId: string;
}

const SETTINGS_KEY = 'video-recorder-settings-v1';

/**
 * Generate a unique workstation ID based on browser fingerprint
 */
function getWorkstationId(): string {
    let id = localStorage.getItem('workstation-id');
    if (!id) {
        id = `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('workstation-id', id);
    }
    return id;
}

/**
 * Migrate old settings structure to new separated video/photo structure
 */
function migrateSettings(oldSettings: any): WorkstationSettings {
    // Check if already in new format
    if (oldSettings.recording?.video && oldSettings.recording?.photo) {
        return oldSettings as WorkstationSettings;
    }

    // Migrate from old format
    const defaults = getDefaultSettings();

    return {
        ...oldSettings,
        recording: {
            video: {
                format: oldSettings.recording?.videoFormat || defaults.recording.video.format,
                filenamePrefix: oldSettings.recording?.filenamePrefix || defaults.recording.video.filenamePrefix,
                storagePath: oldSettings.recording?.saveLocation || defaults.recording.video.storagePath,
                autoSplit: oldSettings.recording?.autoSplit || defaults.recording.video.autoSplit,
                splitBySize: defaults.recording.video.splitBySize,
                splitSizeMB: oldSettings.recording?.splitSizeMB || defaults.recording.video.splitSizeMB,
                splitByTime: defaults.recording.video.splitByTime,
                splitTimeMinutes: defaults.recording.video.splitTimeMinutes,
            },
            photo: {
                format: oldSettings.recording?.photoFormat || defaults.recording.photo.format,
                filenamePrefix: oldSettings.recording?.filenamePrefix || defaults.recording.photo.filenamePrefix,
                storagePath: oldSettings.recording?.saveLocation || defaults.recording.photo.storagePath,
            },
        },
    };
}

/**
 * Get default settings
 */
export function getDefaultSettings(): WorkstationSettings {
    return {
        video: {
            deviceId: '',
            resolution: '1920x1080',
            frameRate: 30,
            aspectRatio: '16:9',
        },
        audio: {
            deviceId: '',
            sampleRate: 48000,
            channels: 2,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        },
        recording: {
            video: {
                format: 'webm-vp9',
                filenamePrefix: 'video',
                storagePath: '',
                autoSplit: false,
                splitBySize: true,
                splitSizeMB: 500,
                splitByTime: false,
                splitTimeMinutes: 10,
            },
            photo: {
                format: 'jpeg-95',
                filenamePrefix: 'photo',
                storagePath: '',
            },
        },
        lastModified: new Date().toISOString(),
        workstationId: getWorkstationId(),
    };
}

/**
 * Load settings from localStorage
 */
export function loadSettings(): WorkstationSettings {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Migrate old settings structure to new format
            const migrated = migrateSettings(parsed);
            // Don't save here - causes infinite loop!
            // Migration will be saved when user makes changes
            return migrated;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
    return getDefaultSettings();
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings: Partial<WorkstationSettings>): void {
    try {
        const current = loadSettings();
        const updated = {
            ...current,
            ...settings,
            lastModified: new Date().toISOString(),
            workstationId: getWorkstationId(),
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

/**
 * Reset settings to defaults
 */
export function resetSettings(): void {
    try {
        localStorage.removeItem(SETTINGS_KEY);
    } catch (error) {
        console.error('Error resetting settings:', error);
    }
}

/**
 * Export settings as JSON
 */
export function exportSettings(): string {
    const settings = loadSettings();
    return JSON.stringify(settings, null, 2);
}

/**
 * Import settings from JSON
 */
export function importSettings(json: string): boolean {
    try {
        const settings = JSON.parse(json);
        saveSettings(settings);
        return true;
    } catch (error) {
        console.error('Error importing settings:', error);
        return false;
    }
}

/**
 * Get smart defaults based on available devices
 */
export async function getSmartDefaults(
    videoDevices: Array<{ deviceId: string; label: string }>,
    audioDevices: Array<{ deviceId: string; label: string }>
): Promise<Partial<WorkstationSettings>> {
    const defaults: Partial<WorkstationSettings> = {};

    // Select best video device (prefer USB cameras over built-in)
    if (videoDevices.length > 0) {
        const usbCamera = videoDevices.find(d =>
            d.label.toLowerCase().includes('usb') ||
            d.label.toLowerCase().includes('external')
        );
        defaults.video = {
            deviceId: usbCamera?.deviceId || videoDevices[0].deviceId,
            resolution: '1920x1080',
            frameRate: 30,
            aspectRatio: '16:9',
        };
    }

    // Select best audio device (prefer USB mics over built-in)
    if (audioDevices.length > 0) {
        const usbMic = audioDevices.find(d =>
            d.label.toLowerCase().includes('usb') ||
            d.label.toLowerCase().includes('external')
        );
        defaults.audio = {
            deviceId: usbMic?.deviceId || audioDevices[0].deviceId,
            sampleRate: 48000,
            channels: 2,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        };
    }

    return defaults;
}
