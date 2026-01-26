/**
 * Format time in seconds to MM:SS or HH:MM:SS format
 */
export function formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
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
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * Change file extension
 */
export function changeFileExtension(filename: string, newExtension: string): string {
    const parts = filename.split('.');
    if (parts.length > 1) {
        parts[parts.length - 1] = newExtension;
        return parts.join('.');
    }
    return `${filename}.${newExtension}`;
}
