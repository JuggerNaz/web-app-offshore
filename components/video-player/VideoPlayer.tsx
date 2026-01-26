/**
 * Custom Video Player Component
 * Full-featured video player with seeking, speed control, and format conversion
 */

'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useVideoPlayer } from './useVideoPlayer';
import { SeekBar } from './SeekBar';
import { SpeedControl } from './SpeedControl';
import { FormatConverter } from './FormatConverter';
import { formatTime } from './utils';

interface VideoPlayerProps {
    src: string;
    filename?: string;
    poster?: string;
    autoPlay?: boolean;
    className?: string;
}

export function VideoPlayer({ src, filename = 'video.webm', poster, autoPlay = false, className = '' }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { state, controls } = useVideoPlayer(videoRef);
    const [showControls, setShowControls] = useState(true);
    const [volumeSliderVisible, setVolumeSliderVisible] = useState(false);
    const hideControlsTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    // Auto-hide controls after 3 seconds of inactivity
    const resetHideControlsTimer = () => {
        setShowControls(true);
        if (hideControlsTimeoutRef.current) {
            clearTimeout(hideControlsTimeoutRef.current);
        }
        hideControlsTimeoutRef.current = setTimeout(() => {
            if (state.playing) {
                setShowControls(false);
            }
        }, 3000);
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!videoRef.current) return;

            // Prevent default for video-related keys
            const videoKeys = [' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'f', 'm', ',', '.', '<', '>'];
            if (videoKeys.includes(e.key.toLowerCase())) {
                e.preventDefault();
            }

            switch (e.key.toLowerCase()) {
                case ' ':
                    controls.togglePlay();
                    break;
                case 'arrowleft':
                    controls.skip(-10);
                    break;
                case 'arrowright':
                    controls.skip(10);
                    break;
                case 'arrowup':
                    controls.setVolume(Math.min(1, state.volume + 0.1));
                    break;
                case 'arrowdown':
                    controls.setVolume(Math.max(0, state.volume - 0.1));
                    break;
                case 'm':
                    controls.toggleMute();
                    break;
                case 'f':
                    controls.toggleFullscreen();
                    break;
                case ',':
                    // Previous frame (1/30 second)
                    controls.skip(-1 / 30);
                    break;
                case '.':
                    // Next frame (1/30 second)
                    controls.skip(1 / 30);
                    break;
                case '<':
                    // Decrease speed
                    const lowerSpeed = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].reverse().find(s => s < state.playbackRate);
                    if (lowerSpeed) controls.setPlaybackRate(lowerSpeed);
                    break;
                case '>':
                    // Increase speed
                    const higherSpeed = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].find(s => s > state.playbackRate);
                    if (higherSpeed) controls.setPlaybackRate(higherSpeed);
                    break;
                default:
                    // Number keys 0-9 for seeking to percentage
                    if (e.key >= '0' && e.key <= '9') {
                        const percent = parseInt(e.key) / 10;
                        controls.seekTo(state.duration * percent);
                    }
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [controls, state.volume, state.playbackRate, state.duration]);

    return (
        <div
            ref={containerRef}
            className={`relative bg-black rounded-lg overflow-hidden ${className}`}
            onMouseMove={resetHideControlsTimer}
            onMouseLeave={() => state.playing && setShowControls(false)}
        >
            {/* Video Element */}
            <video
                ref={videoRef}
                src={src}
                poster={poster}
                autoPlay={autoPlay}
                className="w-full h-full"
                onClick={controls.togglePlay}
            />

            {/* Loading Spinner */}
            {state.loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
            )}

            {/* Controls Overlay */}
            <div
                className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'
                    }`}
            >
                {/* Seek Bar */}
                <div className="pt-4">
                    <SeekBar
                        currentTime={state.currentTime}
                        duration={state.duration}
                        buffered={state.buffered}
                        onSeek={controls.seekTo}
                        seeking={state.seeking}
                    />
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between px-4 py-3">
                    {/* Left Controls */}
                    <div className="flex items-center gap-2">
                        {/* Play/Pause */}
                        <button
                            onClick={controls.togglePlay}
                            className="text-white hover:bg-white/20 rounded p-2 transition-colors"
                            title={state.playing ? 'Pause (Space)' : 'Play (Space)'}
                        >
                            {state.playing ? (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            )}
                        </button>

                        {/* Skip Backward */}
                        <button
                            onClick={() => controls.skip(-10)}
                            className="text-white hover:bg-white/20 rounded p-2 transition-colors"
                            title="Rewind 10s (←)"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                            </svg>
                        </button>

                        {/* Skip Forward */}
                        <button
                            onClick={() => controls.skip(10)}
                            className="text-white hover:bg-white/20 rounded p-2 transition-colors"
                            title="Forward 10s (→)"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                            </svg>
                        </button>

                        {/* Volume */}
                        <div
                            className="relative flex items-center gap-2"
                            onMouseEnter={() => setVolumeSliderVisible(true)}
                            onMouseLeave={() => setVolumeSliderVisible(false)}
                        >
                            <button
                                onClick={controls.toggleMute}
                                className="text-white hover:bg-white/20 rounded p-2 transition-colors"
                                title={state.muted ? 'Unmute (M)' : 'Mute (M)'}
                            >
                                {state.muted || state.volume === 0 ? (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                                    </svg>
                                )}
                            </button>

                            {/* Volume Slider */}
                            {volumeSliderVisible && (
                                <div className="absolute left-full ml-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={state.volume}
                                        onChange={(e) => controls.setVolume(parseFloat(e.target.value))}
                                        className="w-20 accent-blue-500"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Time Display */}
                        <div className="text-white text-sm font-mono">
                            {formatTime(state.currentTime)} / {formatTime(state.duration)}
                        </div>
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-2">
                        {/* Speed Control */}
                        <SpeedControl
                            currentSpeed={state.playbackRate}
                            onSpeedChange={controls.setPlaybackRate}
                        />

                        {/* Format Converter */}
                        <FormatConverter videoSrc={src} filename={filename} />

                        {/* Fullscreen */}
                        <button
                            onClick={controls.toggleFullscreen}
                            className="text-white hover:bg-white/20 rounded p-2 transition-colors"
                            title="Fullscreen (F)"
                        >
                            {state.fullscreen ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
