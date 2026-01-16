/**
 * Local Storage Utilities
 * Functions for managing file storage on local or network drives
 */

export interface LocalStorageConfig {
    basePath: string;
    enabled: boolean;
    mode: 'local' | 'cloud' | 'hybrid';
}

/**
 * Get local storage configuration from environment variables
 */
export const getLocalStorageConfig = (): LocalStorageConfig => {
    return {
        basePath: process.env.LOCAL_STORAGE_PATH || 'C:\\OffshoreData\\Attachments',
        enabled: process.env.LOCAL_STORAGE_ENABLED === 'true',
        mode: (process.env.STORAGE_MODE as any) || 'cloud',
    };
};

/**
 * Format file path for local storage
 */
export const formatLocalPath = (category: string, filename: string): string => {
    const config = getLocalStorageConfig();
    return `${config.basePath}\\${category}\\${filename}`;
};

/**
 * Validate local storage path
 */
export const validateLocalPath = (path: string): {
    valid: boolean;
    message: string;
} => {
    // Check if path is empty
    if (!path || path.trim() === '') {
        return {
            valid: false,
            message: 'Path cannot be empty',
        };
    }

    // Check for invalid characters
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(path)) {
        return {
            valid: false,
            message: 'Path contains invalid characters',
        };
    }

    // Check if it's a valid Windows path or UNC path
    const windowsPath = /^[a-zA-Z]:\\/;
    const uncPath = /^\\\\/;

    if (!windowsPath.test(path) && !uncPath.test(path)) {
        return {
            valid: false,
            message: 'Path must be a valid Windows path (C:\\...) or UNC path (\\\\server\\...)',
        };
    }

    return {
        valid: true,
        message: 'Path is valid',
    };
};

/**
 * Get storage mode (cloud, local, or hybrid)
 */
export const getStorageMode = (): 'cloud' | 'local' | 'hybrid' => {
    const mode = process.env.STORAGE_MODE;
    if (mode === 'local' || mode === 'hybrid') {
        return mode;
    }
    return 'cloud';
};

/**
 * Determine if a category should use local storage
 */
export const shouldUseLocalStorage = (category: string): boolean => {
    const mode = getStorageMode();

    if (mode === 'cloud') return false;
    if (mode === 'local') return true;

    // Hybrid mode - check category configuration
    const localCategories = process.env.LOCAL_STORAGE_CATEGORIES?.split(',') || [];
    return localCategories.includes(category);
};

/**
 * Get file URL for local storage
 * Note: This returns a file path, not a URL
 */
export const getLocalFileUrl = (category: string, filename: string): string => {
    return formatLocalPath(category, filename);
};

/**
 * Generate unique filename
 */
export const generateUniqueFilename = (originalName: string): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const ext = originalName.split('.').pop();
    const nameWithoutExt = originalName.replace(`.${ext}`, '');
    const sanitized = nameWithoutExt.replace(/[^a-z0-9]/gi, '_');

    return `${timestamp}_${random}_${sanitized}.${ext}`;
};

/**
 * Get storage statistics
 */
export interface StorageStats {
    totalFiles: number;
    totalSize: number;
    categories: {
        [key: string]: {
            fileCount: number;
            size: number;
        };
    };
}

// Note: Actual file system operations should be done server-side
// These are helper functions for the client

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Get file extension
 */
export const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
};

/**
 * Check if file type is allowed
 */
export const isAllowedFileType = (filename: string, allowedTypes: string[]): boolean => {
    const ext = getFileExtension(filename);
    return allowedTypes.includes(ext);
};

/**
 * Storage category definitions
 */
export const STORAGE_CATEGORIES = {
    STRUCTURES: 'structures',
    PLATFORMS: 'structures/platforms',
    PIPELINES: 'structures/pipelines',
    JOBPACKS: 'jobpacks',
    INSPECTIONS: 'inspections',
    VISUAL: 'inspections/visual',
    ULTRASONIC: 'inspections/ultrasonic',
    MAGNETIC: 'inspections/magnetic',
    RADIOGRAPHIC: 'inspections/radiographic',
    REPORTS: 'reports',
    TEMP: 'temp',
} as const;

/**
 * Allowed file types by category
 */
export const ALLOWED_FILE_TYPES = {
    images: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
    documents: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'],
    cad: ['dwg', 'dxf', 'step', 'stp', 'iges', 'igs'],
    reports: ['pdf', 'docx', 'xlsx'],
    all: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'dwg', 'dxf'],
};

/**
 * Max file sizes by category (in bytes)
 */
export const MAX_FILE_SIZES = {
    image: 5 * 1024 * 1024, // 5MB
    document: 10 * 1024 * 1024, // 10MB
    cad: 50 * 1024 * 1024, // 50MB
    default: 10 * 1024 * 1024, // 10MB
};
