/**
 * Video Player Demo Page
 * Test the custom video player with all features
 */

'use client';

import React, { useState } from 'react';
import { VideoPlayer } from '@/components/video-player';

export default function VideoPlayerDemo() {
    const [videoSrc, setVideoSrc] = useState<string>('');
    const [filename, setFilename] = useState<string>('demo-video.webm');

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setVideoSrc(url);
            setFilename(file.name);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold text-white">Custom Video Player Demo</h1>
                    <p className="text-slate-400">
                        Full-featured video player with seeking, playback speed, and format conversion
                    </p>
                </div>

                {/* File Upload */}
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
                    <label className="block text-white font-medium mb-2">
                        Select a video file to test
                    </label>
                    <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileSelect}
                        className="block w-full text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                    />
                    <p className="mt-2 text-sm text-slate-400">
                        Supports WebM, MP4, and other video formats
                    </p>
                </div>

                {/* Video Player */}
                {videoSrc && (
                    <div className="space-y-4">
                        <VideoPlayer
                            src={videoSrc}
                            filename={filename}
                            className="w-full max-w-4xl mx-auto"
                        />

                        {/* Keyboard Shortcuts Reference */}
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
                            <h2 className="text-xl font-bold text-white mb-4">⌨️ Keyboard Shortcuts</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-blue-400">Playback</h3>
                                    <div className="space-y-1 text-slate-300">
                                        <div><kbd className="px-2 py-1 bg-slate-800 rounded">Space</kbd> Play/Pause</div>
                                        <div><kbd className="px-2 py-1 bg-slate-800 rounded">←</kbd> Rewind 10s</div>
                                        <div><kbd className="px-2 py-1 bg-slate-800 rounded">→</kbd> Forward 10s</div>
                                        <div><kbd className="px-2 py-1 bg-slate-800 rounded">,</kbd> Previous frame</div>
                                        <div><kbd className="px-2 py-1 bg-slate-800 rounded">.</kbd> Next frame</div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-blue-400">Audio</h3>
                                    <div className="space-y-1 text-slate-300">
                                        <div><kbd className="px-2 py-1 bg-slate-800 rounded">↑</kbd> Volume up</div>
                                        <div><kbd className="px-2 py-1 bg-slate-800 rounded">↓</kbd> Volume down</div>
                                        <div><kbd className="px-2 py-1 bg-slate-800 rounded">M</kbd> Mute/Unmute</div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-blue-400">Speed & View</h3>
                                    <div className="space-y-1 text-slate-300">
                                        <div><kbd className="px-2 py-1 bg-slate-800 rounded">&lt;</kbd> Decrease speed</div>
                                        <div><kbd className="px-2 py-1 bg-slate-800 rounded">&gt;</kbd> Increase speed</div>
                                        <div><kbd className="px-2 py-1 bg-slate-800 rounded">F</kbd> Fullscreen</div>
                                        <div><kbd className="px-2 py-1 bg-slate-800 rounded">0-9</kbd> Seek to %</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Features List */}
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
                            <h2 className="text-xl font-bold text-white mb-4">✨ Features</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-green-400">✓</span>
                                        <span>Full seeking support (click, drag, keyboard)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-green-400">✓</span>
                                        <span>Playback speed: 0.25x - 2x</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-green-400">✓</span>
                                        <span>WebM → MP4 conversion (lazy-loaded)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-green-400">✓</span>
                                        <span>Frame-by-frame navigation</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-green-400">✓</span>
                                        <span>Fullscreen support</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-green-400">✓</span>
                                        <span>Volume control with slider</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-green-400">✓</span>
                                        <span>Auto-hiding controls</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-green-400">✓</span>
                                        <span>Touch/mobile support</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!videoSrc && (
                    <div className="text-center py-16 text-slate-400">
                        <svg className="w-24 h-24 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <p className="text-lg">Select a video file to start testing</p>
                    </div>
                )}
            </div>
        </div>
    );
}
