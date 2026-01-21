/**
 * Format Converter Component
 * WebM to MP4 conversion with FFmpeg (lazy-loaded)
 */

'use client';

import React, { useState } from 'react';
import { useFFmpeg } from './useFFmpeg';
import { downloadBlob, changeFileExtension } from './utils';

interface FormatConverterProps {
    videoSrc: string;
    filename: string;
}

export function FormatConverter({ videoSrc, filename }: FormatConverterProps) {
    const { convertToMP4, conversionState, resetConversion } = useFFmpeg();
    const [isConverting, setIsConverting] = useState(false);
    const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);

    const handleConvert = async () => {
        try {
            setIsConverting(true);

            // Fetch the video blob
            const response = await fetch(videoSrc);
            const blob = await response.blob();

            // Convert to MP4
            const mp4Blob = await convertToMP4(blob, filename);
            setConvertedBlob(mp4Blob);

        } catch (error) {
            console.error('Conversion failed:', error);
        } finally {
            setIsConverting(false);
        }
    };

    const handleDownload = () => {
        if (convertedBlob) {
            const mp4Filename = changeFileExtension(filename, 'mp4');
            downloadBlob(convertedBlob, mp4Filename);
        }
    };

    const handleReset = () => {
        setConvertedBlob(null);
        resetConversion();
    };

    return (
        <div className="relative group">
            {conversionState.status === 'idle' && !convertedBlob && (
                <button
                    onClick={handleConvert}
                    disabled={isConverting}
                    className="px-3 py-1.5 text-white hover:bg-white/20 rounded transition-colors text-sm font-medium flex items-center gap-1.5"
                    title="Convert to MP4"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Convert</span>
                </button>
            )}

            {(conversionState.status === 'loading' || conversionState.status === 'converting') && (
                <div className="px-3 py-1.5 text-white text-sm font-medium flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{Math.round(conversionState.progress)}%</span>
                </div>
            )}

            {conversionState.status === 'complete' && convertedBlob && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownload}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors text-sm font-medium flex items-center gap-1.5"
                        title="Download MP4"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Download MP4</span>
                    </button>
                    <button
                        onClick={handleReset}
                        className="px-2 py-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors text-sm"
                        title="Convert Another"
                    >
                        ✕
                    </button>
                </div>
            )}

            {conversionState.status === 'error' && (
                <div className="flex items-center gap-2">
                    <span className="text-red-400 text-sm">Conversion failed</span>
                    <button
                        onClick={handleReset}
                        className="px-2 py-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors text-sm"
                    >
                        Retry
                    </button>
                </div>
            )}
        </div>
    );
}
