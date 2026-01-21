/**
 * Speed Control Component
 * Playback speed selector dropdown
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';

interface SpeedControlProps {
    currentSpeed: number;
    onSpeedChange: (speed: number) => void;
}

const SPEED_OPTIONS = [
    { value: 0.25, label: '0.25x (Slow)' },
    { value: 0.5, label: '0.5x (Slow)' },
    { value: 0.75, label: '0.75x' },
    { value: 1, label: '1x (Normal)' },
    { value: 1.25, label: '1.25x' },
    { value: 1.5, label: '1.5x (Fast)' },
    { value: 2, label: '2x (Fast)' },
];

export function SpeedControl({ currentSpeed, onSpeedChange }: SpeedControlProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const currentLabel = SPEED_OPTIONS.find(opt => opt.value === currentSpeed)?.label || '1x';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="px-3 py-1.5 text-white hover:bg-white/20 rounded transition-colors text-sm font-medium flex items-center gap-1"
                title="Playback Speed"
            >
                <span>{currentSpeed}x</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute bottom-full mb-2 right-0 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
                    {SPEED_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => {
                                onSpeedChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-800 transition-colors ${option.value === currentSpeed
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-300'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
