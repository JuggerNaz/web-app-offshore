/**
 * FFmpeg Hook - Lazy-loaded format conversion
 * Only loads FFmpeg when user clicks convert
 */

import { useState, useCallback, useRef } from 'react';
import type { FFmpeg } from '@ffmpeg/ffmpeg';

export interface ConversionProgress {
    progress: number;
    status: 'idle' | 'loading' | 'converting' | 'complete' | 'error';
    error?: string;
}

export function useFFmpeg() {
    const [conversionState, setConversionState] = useState<ConversionProgress>({
        progress: 0,
        status: 'idle',
    });

    const ffmpegRef = useRef<FFmpeg | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // Lazy load FFmpeg
    const loadFFmpeg = useCallback(async () => {
        if (ffmpegRef.current) return ffmpegRef.current;

        try {
            setConversionState({ progress: 0, status: 'loading' });

            // Dynamic import - only loads when called
            const { FFmpeg } = await import('@ffmpeg/ffmpeg');
            const { toBlobURL } = await import('@ffmpeg/util');

            const ffmpeg = new FFmpeg();

            // Load FFmpeg core
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });

            ffmpegRef.current = ffmpeg;
            setIsLoaded(true);
            setConversionState({ progress: 0, status: 'idle' });

            return ffmpeg;
        } catch (error) {
            console.error('Failed to load FFmpeg:', error);
            setConversionState({
                progress: 0,
                status: 'error',
                error: 'Failed to load converter. Please try again.',
            });
            throw error;
        }
    }, []);

    // Convert WebM to MP4
    const convertToMP4 = useCallback(async (videoBlob: Blob, filename: string): Promise<Blob> => {
        try {
            setConversionState({ progress: 0, status: 'loading' });

            // Load FFmpeg if not already loaded
            const ffmpeg = await loadFFmpeg();
            if (!ffmpeg) throw new Error('FFmpeg not loaded');

            setConversionState({ progress: 10, status: 'converting' });

            // Import fetchFile
            const { fetchFile } = await import('@ffmpeg/util');

            // Write input file
            await ffmpeg.writeFile('input.webm', await fetchFile(videoBlob));

            setConversionState({ progress: 20, status: 'converting' });

            // Set up progress tracking
            ffmpeg.on('progress', ({ progress }) => {
                setConversionState({
                    progress: 20 + (progress * 70), // 20-90%
                    status: 'converting',
                });
            });

            // Convert with optimized settings
            await ffmpeg.exec([
                '-i', 'input.webm',
                '-c:v', 'libx264',      // H.264 video codec
                '-preset', 'fast',       // Fast encoding
                '-crf', '23',            // Quality (lower = better, 18-28 range)
                '-c:a', 'aac',           // AAC audio codec
                '-b:a', '128k',          // Audio bitrate
                '-movflags', '+faststart', // Enable streaming
                'output.mp4'
            ]);

            setConversionState({ progress: 95, status: 'converting' });

            // Read output file
            const data = await ffmpeg.readFile('output.mp4');
            const mp4Blob = new Blob([data], { type: 'video/mp4' });

            // Cleanup
            await ffmpeg.deleteFile('input.webm');
            await ffmpeg.deleteFile('output.mp4');

            setConversionState({ progress: 100, status: 'complete' });

            return mp4Blob;
        } catch (error) {
            console.error('Conversion error:', error);
            setConversionState({
                progress: 0,
                status: 'error',
                error: error instanceof Error ? error.message : 'Conversion failed',
            });
            throw error;
        }
    }, [loadFFmpeg]);

    // Reset conversion state
    const resetConversion = useCallback(() => {
        setConversionState({ progress: 0, status: 'idle' });
    }, []);

    return {
        convertToMP4,
        conversionState,
        isLoaded,
        resetConversion,
    };
}
