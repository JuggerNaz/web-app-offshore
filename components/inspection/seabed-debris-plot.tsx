'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { motion, useDragControls } from 'framer-motion';

interface Point {
    x: number;
    y: number;
}

interface DebrisItem {
    id: string | number;
    x: number; // Normalized 0-100
    y: number; // Normalized 0-100
    label: string;
    isMetallic: boolean;
    face?: string;
    distance?: number;
}

interface SeabedDebrisPlotProps {
    layoutType?: 'rectangular' | 'triangular';
    legCount?: 3 | 4 | 6 | 8 | 16;
    gridDistances?: number[]; // e.g. [3, 6, 9, 12, 15, 18, 21]
    debrisItems?: DebrisItem[];
    onDebrisMove?: (id: string | number, x: number, y: number, geometry: { distance: number, angle: number, face: string }) => void;
    onAddDebris?: (x: number, y: number, geometry: { distance: number, angle: number, face: string }) => void;
    readOnly?: boolean;

    activeDebrisId?: string | number | null;
}

const VIEW_SIZE = 600;
const CENTER = VIEW_SIZE / 2;
const MAX_RADIUS = (VIEW_SIZE / 2) - 40;

export const SeabedDebrisPlot: React.FC<SeabedDebrisPlotProps> = ({
    layoutType = 'rectangular',
    legCount = 4,
    gridDistances = [3, 6, 9, 12, 15, 18, 21],
    debrisItems = [],
    onDebrisMove,
    onAddDebris,
    readOnly = false,
    activeDebrisId = null,
}) => {
    // 1. Calculate Leg Positions
    const legPositions = useMemo(() => {
        const positions: Point[] = [];
        const padding = 80;
        const innerSize = VIEW_SIZE - (padding * 2);

        if (layoutType === 'triangular' || legCount === 3) {
            // Triangle Layout
            const radius = 100;
            for (let i = 0; i < 3; i++) {
                const angle = (i * 120 - 90) * (Math.PI / 180);
                positions.push({
                    x: CENTER + radius * Math.cos(angle),
                    y: CENTER + radius * Math.sin(angle),
                });
            }
        } else {
            // Rectangular Layout
            let rows = 2;
            let cols = 2;

            if (legCount === 6) { rows = 2; cols = 3; }
            else if (legCount === 8) { rows = 2; cols = 4; }
            else if (legCount === 16) { rows = 4; cols = 4; }

            const dx = innerSize / (cols - 1 || 1) * 0.4;
            const dy = innerSize / (rows - 1 || 1) * 0.4;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    positions.push({
                        x: CENTER + (c - (cols - 1) / 2) * dx,
                        y: CENTER + (r - (rows - 1) / 2) * dy,
                    });
                }
            }
        }
        return positions;
    }, [layoutType, legCount]);

    // 2. Normalize and Denormalize utils
    const toScreen = (v: number) => (v / 100) * VIEW_SIZE;
    const fromScreen = (v: number) => (v / VIEW_SIZE) * 100;

    const maxDistValue = useMemo(() => Math.max(...gridDistances, 21), [gridDistances]);

    // 3. Coordinate mapping logic
    const calculateGeometry = (x: number, y: number) => {
        const screenX = toScreen(x);
        const screenY = toScreen(y);
        const dx = screenX - CENTER;
        const dy = screenY - CENTER;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        
        // Logical distance in meters
        const logicalDist = (distPx / MAX_RADIUS) * maxDistValue;
        
        // Angle in degrees (0 = North, Clockwise)
        let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
        if (angle < 0) angle += 360;

        // Determine Face (Sector)
        let face = 'Unknown';
        if (angle >= 315 || angle < 45) face = 'NORTH';
        else if (angle >= 45 && angle < 135) face = 'EAST';
        else if (angle >= 135 && angle < 225) face = 'SOUTH';
        else face = 'WEST';

        return { distance: logicalDist, angle, face };
    };

    // 4. Render Distance Markers
    const renderGridLines = () => {
        return gridDistances.map((dist, i) => {
            const scale = (dist / maxDistValue) * MAX_RADIUS;
            
            if (layoutType === 'rectangular') {
                const halfSize = scale;
                return (
                    <rect
                        key={`grid-${i}`}
                        x={CENTER - halfSize}
                        y={CENTER - halfSize}
                        width={halfSize * 2}
                        height={halfSize * 2}
                        fill="none"
                        stroke="rgba(100, 116, 139, 0.3)"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                    />
                );
            } else {
                // Triangle grid lines
                const outerPoints = [];
                for (let j = 0; j < 3; j++) {
                    const angle = (j * 120 - 90) * (Math.PI / 180);
                    outerPoints.push(`${CENTER + scale * Math.cos(angle)},${CENTER + scale * Math.sin(angle)}`);
                }
                return (
                    <polygon
                        key={`grid-${i}`}
                        points={outerPoints.join(' ')}
                        fill="none"
                        stroke="rgba(100, 116, 139, 0.3)"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                    />
                );
            }
        });
    };

    return (
        <div className="relative w-full aspect-square bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700 select-none">
            <svg
                viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
                className="w-full h-full cursor-crosshair"
                onClick={(e) => {
                    if (readOnly) return;
                    const svg = e.currentTarget;
                    const pt = svg.createSVGPoint();
                    pt.x = e.clientX;
                    pt.y = e.clientY;
                    const transformed = pt.matrixTransform(svg.getScreenCTM()?.inverse());
                    const nx = fromScreen(transformed.x);
                    const ny = fromScreen(transformed.y);
                    onAddDebris?.(nx, ny, calculateGeometry(nx, ny));
                }}

            >
                {/* Background Compass Labels */}
                <g className="text-[10px] fill-slate-500 font-bold pointer-events-none">
                    <text x={CENTER} y={20} textAnchor="middle">NORTH</text>
                    <text x={CENTER} y={VIEW_SIZE - 10} textAnchor="middle">SOUTH</text>
                    <text x={VIEW_SIZE - 35} y={CENTER + 4} textAnchor="start">EAST</text>
                    <text x={5} y={CENTER + 4} textAnchor="start">WEST</text>
                </g>

                {/* Grid Lines */}
                <g>{renderGridLines()}</g>

                {/* Grid Labels */}
                <g className="text-[9px] fill-slate-600 pointer-events-none">
                    {gridDistances.map((dist, i) => {
                        const scale = (dist / maxDistValue) * MAX_RADIUS;
                        return (
                            <text key={`lbl-${i}`} x={CENTER + scale + 4} y={CENTER - 4}>
                                {dist}m
                            </text>
                        );
                    })}
                </g>

                {/* Platform Legs */}
                <g>
                    {legPositions.map((pos, i) => (
                        <g key={`leg-${i}`}>
                            <circle
                                cx={pos.x}
                                cy={pos.y}
                                r="8"
                                className="fill-slate-800 stroke-slate-400 stroke-2"
                            />
                            <text
                                x={pos.x}
                                y={pos.y + 20}
                                textAnchor="middle"
                                className="text-[8px] fill-slate-400 font-bold"
                            >
                                L{i + 1}
                            </text>
                        </g>
                    ))}
                </g>

                {/* Plot Lines connecting legs (Visual only) */}
                {layoutType === 'rectangular' ? (
                    <rect
                        x={Math.min(...legPositions.map(p => p.x))}
                        y={Math.min(...legPositions.map(p => p.y))}
                        width={Math.max(...legPositions.map(p => p.x)) - Math.min(...legPositions.map(p => p.x))}
                        height={Math.max(...legPositions.map(p => p.y)) - Math.min(...legPositions.map(p => p.y))}
                        fill="none"
                        stroke="rgba(148, 163, 184, 0.2)"
                        strokeWidth="1"
                        pointerEvents="none"
                    />
                ) : (
                    <polygon
                        points={legPositions.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="rgba(148, 163, 184, 0.2)"
                        strokeWidth="1"
                        pointerEvents="none"
                    />
                )}

                {/* Debris Markers */}
                {debrisItems.map((item) => (
                    <motion.g
                        key={item.id}
                        drag={!readOnly}
                        dragMomentum={false}
                        onDragEnd={(e, info) => {
                            // On drag end, we calculate finalize position
                            // For this simple SVG, we need a refined drag logic,
                            // but for now we'll trigger movement if the parent provides x/y storage
                        }}
                        style={{ x: toScreen(item.x) - CENTER, y: toScreen(item.y) - CENTER }}

                        className={activeDebrisId === item.id ? 'z-10' : 'z-0'}
                    >
                        {/* Circle Shadow/Glow */}
                        <circle
                            cx={CENTER}
                            cy={CENTER}
                            r="12"
                            className={item.isMetallic ? 'fill-blue-500/20' : 'fill-amber-500/20'}
                        />
                        {/* Circle Border */}
                        <circle
                            cx={CENTER}
                            cy={CENTER}
                            r="10"
                            className={`stroke-2 ${item.isMetallic ? 'fill-blue-600 stroke-blue-200' : 'fill-amber-600 stroke-amber-200'} ${activeDebrisId === item.id ? 'stroke-[3px]' : ''}`}
                        />
                        {/* Number */}
                        <text
                            x={CENTER}
                            y={CENTER + 4}
                            textAnchor="middle"
                            className="fill-white text-[10px] font-bold pointer-events-none"
                        >
                            {item.label}
                        </text>
                    </motion.g>
                ))}
            </svg>

            {/* Hint Overlay */}
            {!readOnly && (
                <div className="absolute top-2 left-2 bg-slate-800/80 backdrop-blur px-2 py-1 rounded text-[10px] text-slate-300 border border-slate-700 pointer-events-none">
                    Click to add marker • Drag to reposition
                </div>
            )}
        </div>
    );
};

export default SeabedDebrisPlot;
