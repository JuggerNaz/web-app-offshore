/**
 * Seek Bar Component
 * Progress bar with seeking functionality
 */

'use client';

import React, { useRef, useState, MouseEvent, TouchEvent } from 'react';
import { formatTime } from './utils';

interface SeekBarProps {
    currentTime: number;
    duration: number;
    buffered: number;
    onSeek: (time: number) => void;
    seeking: boolean;
}

export function SeekBar({ currentTime, duration, buffered, onSeek, seeking }: SeekBarProps) {
    const seekBarRef = useRef<HTMLDivElement>(null);
    const [hovering, setHovering] = useState(false);
    const [hoverTime, setHoverTime] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

    const calculateTime = (clientX: number): number => {
        if (!seekBarRef.current) return 0;
        const rect = seekBarRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return percent * duration;
    };

    const handleMouseDown = (e: MouseEvent) => {
        setIsDragging(true);
        const time = calculateTime(e.clientX);
        onSeek(time);
    };

    const handleMouseMove = (e: MouseEvent) => {
        const time = calculateTime(e.clientX);
        setHoverTime(time);

        if (isDragging) {
            onSeek(time);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleTouchStart = (e: TouchEvent) => {
        setIsDragging(true);
        const time = calculateTime(e.touches[0].clientX);
        onSeek(time);
    };

    const handleTouchMove = (e: TouchEvent) => {
        if (isDragging) {
            const time = calculateTime(e.touches[0].clientX);
            onSeek(time);
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
    };

    React.useEffect(() => {
        if (isDragging) {
            const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
                const time = calculateTime(e.clientX);
                onSeek(time);
            };
            const handleGlobalMouseUp = () => {
                setIsDragging(false);
            };

            document.addEventListener('mousemove', handleGlobalMouseMove);
            document.addEventListener('mouseup', handleGlobalMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleGlobalMouseMove);
                document.removeEventListener('mouseup', handleGlobalMouseUp);
            };
        }
    }, [isDragging, onSeek]);

    return (
        <div className="w-full px-4">
            <div
                ref={seekBarRef}
                className="relative h-1.5 bg-slate-700 rounded-full cursor-pointer group hover:h-2 transition-all"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Buffered progress */}
                <div
                    className="absolute top-0 left-0 h-full bg-slate-600 rounded-full"
                    style={{ width: `${bufferedProgress}%` }}
                />

                {/* Current progress */}
                <div
                    className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                />

                {/* Seek handle */}
                <div
                    className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg transition-all ${isDragging || hovering ? 'scale-125' : 'scale-0 group-hover:scale-100'
                        }`}
                    style={{ left: `${progress}%`, marginLeft: '-6px' }}
                />

                {/* Hover time tooltip */}
                {hovering && !isDragging && (
                    <div
                        className="absolute bottom-full mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded whitespace-nowrap pointer-events-none"
                        style={{
                            left: `${(hoverTime / duration) * 100}%`,
                            transform: 'translateX(-50%)',
                        }}
                    >
                        {formatTime(hoverTime)}
                    </div>
                )}
            </div>
        </div>
    );
}
