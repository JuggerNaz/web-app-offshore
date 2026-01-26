/**
 * Custom Video Player Hook
 * Manages video player state and controls
 */

import { useState, useRef, useEffect, useCallback } from 'react';

export interface VideoPlayerState {
    playing: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    muted: boolean;
    playbackRate: number;
    fullscreen: boolean;
    buffered: number;
    seeking: boolean;
    loading: boolean;
}

export function useVideoPlayer(videoRef: React.RefObject<HTMLVideoElement>) {
    const [state, setState] = useState<VideoPlayerState>({
        playing: false,
        currentTime: 0,
        duration: 0,
        volume: 1,
        muted: false,
        playbackRate: 1,
        fullscreen: false,
        buffered: 0,
        seeking: false,
        loading: true,
    });

    // Play/Pause
    const togglePlay = useCallback(() => {
        if (!videoRef.current) return;

        if (state.playing) {
            videoRef.current.pause();
        } else {
            videoRef.current.play();
        }
    }, [state.playing, videoRef]);

    // Seek to time
    const seekTo = useCallback((time: number) => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = time;
    }, [videoRef]);

    // Change volume
    const setVolume = useCallback((volume: number) => {
        if (!videoRef.current) return;
        videoRef.current.volume = Math.max(0, Math.min(1, volume));
    }, [videoRef]);

    // Toggle mute
    const toggleMute = useCallback(() => {
        if (!videoRef.current) return;
        videoRef.current.muted = !videoRef.current.muted;
    }, [videoRef]);

    // Change playback speed
    const setPlaybackRate = useCallback((rate: number) => {
        if (!videoRef.current) return;
        videoRef.current.playbackRate = rate;
    }, [videoRef]);

    // Toggle fullscreen
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            videoRef.current?.parentElement?.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }, [videoRef]);

    // Skip forward/backward
    const skip = useCallback((seconds: number) => {
        if (!videoRef.current) return;
        videoRef.current.currentTime += seconds;
    }, [videoRef]);

    // Video event handlers
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePlay = () => setState(s => ({ ...s, playing: true }));
        const handlePause = () => setState(s => ({ ...s, playing: false }));
        const handleTimeUpdate = () => setState(s => ({ ...s, currentTime: video.currentTime }));
        const handleDurationChange = () => setState(s => ({ ...s, duration: video.duration, loading: false }));
        const handleVolumeChange = () => setState(s => ({ ...s, volume: video.volume, muted: video.muted }));
        const handleRateChange = () => setState(s => ({ ...s, playbackRate: video.playbackRate }));
        const handleSeeking = () => setState(s => ({ ...s, seeking: true }));
        const handleSeeked = () => setState(s => ({ ...s, seeking: false }));
        const handleProgress = () => {
            if (video.buffered.length > 0) {
                const buffered = video.buffered.end(video.buffered.length - 1);
                setState(s => ({ ...s, buffered }));
            }
        };
        const handleLoadStart = () => setState(s => ({ ...s, loading: true }));
        const handleCanPlay = () => setState(s => ({ ...s, loading: false }));

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('durationchange', handleDurationChange);
        video.addEventListener('volumechange', handleVolumeChange);
        video.addEventListener('ratechange', handleRateChange);
        video.addEventListener('seeking', handleSeeking);
        video.addEventListener('seeked', handleSeeked);
        video.addEventListener('progress', handleProgress);
        video.addEventListener('loadstart', handleLoadStart);
        video.addEventListener('canplay', handleCanPlay);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('durationchange', handleDurationChange);
            video.removeEventListener('volumechange', handleVolumeChange);
            video.removeEventListener('ratechange', handleRateChange);
            video.removeEventListener('seeking', handleSeeking);
            video.removeEventListener('seeked', handleSeeked);
            video.removeEventListener('progress', handleProgress);
            video.removeEventListener('loadstart', handleLoadStart);
            video.removeEventListener('canplay', handleCanPlay);
        };
    }, [videoRef]);

    // Fullscreen change handler
    useEffect(() => {
        const handleFullscreenChange = () => {
            setState(s => ({ ...s, fullscreen: !!document.fullscreenElement }));
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    return {
        state,
        controls: {
            togglePlay,
            seekTo,
            setVolume,
            toggleMute,
            setPlaybackRate,
            toggleFullscreen,
            skip,
        },
    };
}
