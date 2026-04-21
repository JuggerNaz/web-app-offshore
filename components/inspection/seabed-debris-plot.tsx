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
    type?: string;
    description?: string;
    qid?: string;
}

interface SeabedDebrisPlotProps {
    layoutType?: 'rectangular' | 'triangular';
    legCount?: 3 | 4 | 6 | 8 | 16;
    gridDistances?: number[]; // e.g. [3, 6, 9, 12, 15, 18, 21]
    debrisItems?: DebrisItem[];
    onDebrisMove?: (id: string | number, x: number, y: number, geometry: { distance: number, angle: number, face: string, startLeg?: string, endLeg?: string, nearestDistance?: number }) => void;
    onAddDebris?: (x: number, y: number, geometry: { distance: number, angle: number, face: string, startLeg?: string, endLeg?: string, nearestDistance?: number }) => void;
    onHover?: (x: number, y: number, geometry: { distance: number, angle: number, face: string, startLeg?: string, endLeg?: string, nearestDistance?: number } | null) => void;
    onSelectDebris?: (id: string | number | null) => void;
    readOnly?: boolean;

    activeDebrisId?: string | number | null;
    manualEntry?: {
        leg?: string;
        face?: string;
        distance?: number;
    };
    distanceOffset?: number;
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
    onHover,
    onSelectDebris,
    readOnly = false,
    activeDebrisId = null,
    manualEntry,
    distanceOffset = 0,
}) => {
    const isDraggingRef = React.useRef(false);

    // 1. Calculate Leg Positions
    const legPositions = useMemo(() => {
        const positions: (Point & { name: string })[] = [];
        const padding = 80;
        const innerSize = VIEW_SIZE - (padding * 2);

        if (layoutType === 'triangular' || legCount === 3) {
            const radius = 100;
            for (let i = 0; i < 3; i++) {
                const angle = (i * 120 - 90) * (Math.PI / 180);
                positions.push({
                    x: CENTER + radius * Math.cos(angle),
                    y: CENTER + radius * Math.sin(angle),
                    name: `L${i + 1}`
                });
            }
        } else {
            let rows = 2;
            let cols = 2;

            if (legCount === 6) { rows = 2; cols = 3; }
            else if (legCount === 8) { rows = 2; cols = 4; }
            else if (legCount === 16) { rows = 4; cols = 4; }

            const dx = innerSize / (cols - 1 || 1) * 0.4;
            const dy = innerSize / (rows - 1 || 1) * 0.4;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const rowName = String.fromCharCode(65 + r);
                    positions.push({
                        x: CENTER + (c - (cols - 1) / 2) * dx,
                        y: CENTER + (r - (rows - 1) / 2) * dy,
                        name: `${rowName}${c + 1}`
                    });
                }
            }
        }
        return positions;
    }, [layoutType, legCount]);

    // 2. Normalize and Denormalize utils
    const toScreen = (v: number) => (v / 100) * VIEW_SIZE;
    const fromScreen = (v: number) => (v / VIEW_SIZE) * 100;

    const bounds = useMemo(() => {
        if (!legPositions.length) return { minX: CENTER, minY: CENTER, maxX: CENTER, maxY: CENTER };
        const minX = Math.min(...legPositions.map(p => p.x));
        const minY = Math.min(...legPositions.map(p => p.y));
        const maxX = Math.max(...legPositions.map(p => p.x));
        const maxY = Math.max(...legPositions.map(p => p.y));
        return { minX, minY, maxX, maxY };
    }, [legPositions]);

    const maxDistValue = useMemo(() => Math.max(...gridDistances, 21), [gridDistances]);

    const pxPerMeter = useMemo(() => {
        const availableX = (VIEW_SIZE - (bounds.maxX - bounds.minX)) / 2 - 20;
        const availableY = (VIEW_SIZE - (bounds.maxY - bounds.minY)) / 2 - 20;
        const minAvailable = Math.min(availableX, availableY);
        const maxVisualDist = Math.max(maxDistValue - distanceOffset, 1);
        return minAvailable / maxVisualDist;
    }, [bounds, maxDistValue, distanceOffset]);

    // 3. Coordinate mapping logic
    const calculateGeometry = (x: number, y: number) => {
        const screenX = toScreen(x);
        const screenY = toScreen(y);
        
        let dxBorder = 0;
        if (screenX < bounds.minX) dxBorder = bounds.minX - screenX;
        else if (screenX > bounds.maxX) dxBorder = screenX - bounds.maxX;

        let dyBorder = 0;
        if (screenY < bounds.minY) dyBorder = bounds.minY - screenY;
        else if (screenY > bounds.maxY) dyBorder = screenY - bounds.maxY;

        const visualDist = Math.max(dxBorder, dyBorder) / pxPerMeter;
        const logicalDist = visualDist + distanceOffset;

        const dxCenter = screenX - CENTER;
        const dyCenter = screenY - CENTER;
        
        // Angle in degrees (0 = North, Clockwise)
        let angle = Math.atan2(dxCenter, -dyCenter) * (180 / Math.PI);
        if (angle < 0) angle += 360;

        // Determine Face (Sector)
        let face = 'Unknown';
        let startLeg = '';
        let endLeg = '';

        let outCols = 2;
        let outRows = 2;
        if (legCount === 6) { outRows = 2; outCols = 3; }
        else if (legCount === 8) { outRows = 2; outCols = 4; }
        else if (legCount === 16) { outRows = 4; outCols = 4; }

        const tl = 'A1';
        const tr = `A${outCols}`;
        const bl = `${String.fromCharCode(64 + outRows)}1`;
        const br = `${String.fromCharCode(64 + outRows)}${outCols}`;

        if (angle >= 315 || angle < 45) { face = 'NORTH'; startLeg = tl; endLeg = tr; }
        else if (angle >= 45 && angle < 135) { face = 'EAST'; startLeg = tr; endLeg = br; }
        else if (angle >= 135 && angle < 225) { face = 'SOUTH'; startLeg = bl; endLeg = br; }
        else { face = 'WEST'; startLeg = tl; endLeg = bl; }

        // Find target box distance (always round UP to the next interval to identify the "area")
        let nearestDistance = gridDistances[0];
        if (gridDistances.length > 0) {
            // Find the smallest grid distance that is greater than or equal to logicalDist
            const candidates = gridDistances.filter(d => d >= logicalDist);
            if (candidates.length > 0) {
                nearestDistance = Math.min(...candidates);
            } else {
                nearestDistance = Math.max(...gridDistances);
            }
        }

        return { distance: logicalDist, angle, face, startLeg, endLeg, nearestDistance };
    };

    // Auto-calculate position from manual text fields
    useEffect(() => {
        if (!readOnly && manualEntry?.distance !== undefined && manualEntry?.face && manualEntry?.leg && onDebrisMove) {
            if (isDraggingRef.current) return;
            
            const leg = legPositions.find(p => p.name.toUpperCase() === manualEntry.leg?.toUpperCase());
            if (leg) {
                const visualDist = Math.max(0, manualEntry.distance - distanceOffset);
                const offsetPx = visualDist * pxPerMeter;
                let dx = 0; let dy = 0;
                
                const f = manualEntry.face.toUpperCase();
                if (f.includes('NORTH')) dy -= offsetPx;
                if (f.includes('SOUTH')) dy += offsetPx;
                if (f.includes('EAST')) dx += offsetPx;
                if (f.includes('WEST')) dx -= offsetPx;
                
                // Prevent snapping to exact center if face matches but no offset
                if (dx === 0 && dy === 0) return;
                
                const nx = fromScreen(leg.x + dx);
                const ny = fromScreen(leg.y + dy);
                
                const current = debrisItems[0];
                if (!current || Math.abs(current.x - nx) > 0.5 || Math.abs(current.y - ny) > 0.5) {
                    onDebrisMove('current', nx, ny, calculateGeometry(nx, ny));
                }
            }
        }
    }, [manualEntry?.distance, manualEntry?.face, manualEntry?.leg, legPositions, pxPerMeter]);

    // 4. Render Distance Markers
    const renderGridLines = () => {
        return gridDistances.map((dist, i) => {
            const renderDist = Math.max(0, dist - distanceOffset);
            const offsetPx = renderDist * pxPerMeter;
            
            if (layoutType === 'rectangular') {
                return (
                    <rect
                        key={`grid-${i}`}
                        x={bounds.minX - offsetPx}
                        y={bounds.minY - offsetPx}
                        width={(bounds.maxX - bounds.minX) + offsetPx * 2}
                        height={(bounds.maxY - bounds.minY) + offsetPx * 2}
                        fill="none"
                        stroke="rgba(100, 116, 139, 0.3)"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                    />
                );
            } else {
                // Triangle grid lines expanded from center
                const outerPoints = legPositions.map(p => {
                    const dx = p.x - CENTER;
                    const dy = p.y - CENTER;
                    const distToCenter = Math.sqrt(dx * dx + dy * dy);
                    const scaleFactor = (distToCenter + offsetPx) / (distToCenter || 1);
                    return `${CENTER + dx * scaleFactor},${CENTER + dy * scaleFactor}`;
                });
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
        <div className="flex flex-col w-full h-full bg-sky-50/50 dark:bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-700 select-none">
            {/* COMPONENT HEADER: LEGEND & STATUS */}
            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 px-3 py-2 flex items-center justify-between shrink-0 z-20">
                {/* Status/Hint */}
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${readOnly ? 'bg-slate-400' : 'bg-blue-500'}`} />
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                        {!readOnly ? "Live Grid: Click to Drop Flag" : "View Map"}
                    </span>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-700 border border-blue-400/30 shadow-sm" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Metallic</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-600 border border-orange-400/30 shadow-sm" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Non-Metallic</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-600 border border-green-400/30 shadow-sm" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Seepage</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-600 border-purple-400/30 shadow-sm" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Crater</span>
                    </div>
                </div>
            </div>

            {/* MAP AREA */}
            <div className="flex-1 relative overflow-hidden">
                <svg
                    viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
                    className="w-full h-full cursor-crosshair"
                    onClick={(e) => {
                        const svg = e.currentTarget;
                        if (e.target === svg) {
                            onSelectDebris?.(null);
                        }
                        
                        if (readOnly) return;
                        const pt = svg.createSVGPoint();
                        pt.x = e.clientX;
                        pt.y = e.clientY;
                        const transformed = pt.matrixTransform(svg.getScreenCTM()?.inverse());
                        if (!transformed) return;
                        const nx = fromScreen(transformed.x);
                        const ny = fromScreen(transformed.y);
                        onAddDebris?.(nx, ny, calculateGeometry(nx, ny));
                    }}
                    onMouseMove={(e) => {
                        if (readOnly || !onHover) return;
                        const svg = e.currentTarget;
                        const pt = svg.createSVGPoint();
                        pt.x = e.clientX;
                        pt.y = e.clientY;
                        const transformed = pt.matrixTransform(svg.getScreenCTM()?.inverse());
                        if (!transformed) return;
                        const nx = fromScreen(transformed.x);
                        const ny = fromScreen(transformed.y);
                        onHover(nx, ny, calculateGeometry(nx, ny));
                    }}
                    onMouseLeave={() => {
                        if (!readOnly && onHover) onHover(0, 0, null);
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

                    {/* Grid Labels (corners) AND Sector QIDs in each box */}
                    <g className="text-[9px] fill-slate-500 font-bold pointer-events-none">
                        {gridDistances.map((dist, i) => {
                            const renderDist = Math.max(0, dist - distanceOffset);
                            const offsetPx = renderDist * pxPerMeter;
                            const topY = bounds.minY - offsetPx;
                            const bottomY = bounds.maxY + offsetPx;
                            const leftX = bounds.minX - offsetPx;
                            const rightX = bounds.maxX + offsetPx;

                            return (
                                <React.Fragment key={`lbl-${i}`}>
                                    {/* Corners (Distances) */}
                                    <text x={leftX - 4} y={topY - 4} textAnchor="end">{dist}m</text>
                                    <text x={rightX + 4} y={topY - 4} textAnchor="start">{dist}m</text>
                                    <text x={leftX - 4} y={bottomY + 10} textAnchor="end">{dist}m</text>
                                    <text x={rightX + 4} y={bottomY + 10} textAnchor="start">{dist}m</text>

                                    {/* Box Sector QIDs (Light color in 4 faces) */}
                                    <text x={CENTER} y={topY + 12} textAnchor="middle" className="text-[10px] font-mono fill-slate-400 opacity-40 uppercase">
                                        S/BED({legPositions.find(p => p.name === 'A1')?.name || 'A1'}-{legPositions.find(p => p.name === `A${legCount / 2}`)?.name || 'A2'})-{dist}M
                                    </text>
                                    <text x={CENTER} y={bottomY - 4} textAnchor="middle" className="text-[10px] font-mono fill-slate-400 opacity-40 uppercase">
                                        S/BED({legPositions.find(p => p.name === 'B1')?.name || 'B1'}-{legPositions.find(p => p.name === `B${legCount / 2}`)?.name || 'B2'})-{dist}M
                                    </text>
                                    <text x={rightX - 4} y={CENTER} textAnchor="middle" transform={`rotate(90, ${rightX - 4}, ${CENTER})`} className="text-[10px] font-mono fill-slate-400 opacity-40 uppercase">
                                        S/BED({legPositions.find(p => p.name === `A${legCount / 2}`)?.name || 'A2'}-{legPositions.find(p => p.name === `B${legCount / 2}`)?.name || 'B2'})-{dist}M
                                    </text>
                                    <text x={leftX + 4} y={CENTER} textAnchor="middle" transform={`rotate(-90, ${leftX + 4}, ${CENTER})`} className="text-[10px] font-mono fill-slate-400 opacity-40 uppercase">
                                        S/BED({legPositions.find(p => p.name === 'A1')?.name || 'A1'}-{legPositions.find(p => p.name === 'B1')?.name || 'B1'})-{dist}M
                                    </text>
                                </React.Fragment>
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
                                    className="fill-white dark:fill-slate-800 stroke-slate-500 stroke-2"
                                />
                                <text
                                    x={pos.x}
                                    y={pos.y + 20}
                                    textAnchor="middle"
                                    className="text-[8px] fill-slate-600 dark:fill-slate-400 font-bold"
                                >
                                    {pos.name}
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
                            stroke="rgba(100, 116, 139, 0.4)"
                            strokeWidth="1"
                            pointerEvents="none"
                        />
                    ) : (
                        <polygon
                            points={legPositions.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="none"
                            stroke="rgba(100, 116, 139, 0.4)"
                            strokeWidth="1"
                            pointerEvents="none"
                        />
                    )}

                    {/* Debris Markers */}
                    {debrisItems.map((item) => (
                        <motion.g
                            key={`${item.id}-${item.x}-${item.y}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelectDebris?.(item.id);
                            }}
                            drag={!readOnly && activeDebrisId === item.id}
                            dragMomentum={false}
                            onDragStart={() => { isDraggingRef.current = true; }}
                            onDragEnd={(e: any, info) => {
                                isDraggingRef.current = false;
                                if (readOnly) return;
                                let svg = e.target;
                                while (svg && svg.tagName !== 'svg') {
                                    svg = svg.parentNode;
                                }
                                if (!svg || !svg.createSVGPoint) return;
                                
                                const pt = svg.createSVGPoint();
                                pt.x = info.point.x;
                                pt.y = info.point.y;
                                
                                const transformed = pt.matrixTransform(svg.getScreenCTM()?.inverse());
                                const nx = fromScreen(transformed.x);
                                const ny = fromScreen(transformed.y);
                                
                                onDebrisMove?.(item.id, nx, ny, calculateGeometry(nx, ny));
                            }}
                            style={{ x: toScreen(item.x) - CENTER, y: toScreen(item.y) - CENTER }}

                            className={activeDebrisId === item.id ? 'z-10' : 'z-0'}
                        >
                            <title>{`${item.type || 'Debris'}${item.description ? ` - ${item.description}` : ''}\nQID: ${item.qid || item.label}`}</title>
                            
                            {/* Circle Shadow/Glow (Pulse) */}
                            <circle
                                cx={CENTER}
                                cy={CENTER}
                                r={activeDebrisId === item.id ? "18" : "12"}
                                className={item.type === 'Gas Seepage' 
                                        ? 'fill-green-500/20' 
                                        : item.type === 'Crater' 
                                            ? 'fill-purple-500/20' 
                                            : item.isMetallic 
                                                ? 'fill-blue-500/20' 
                                                : 'fill-orange-500/20'}
                            />
                            
                            {/* Selection Pulse (Only if active) */}
                            {activeDebrisId === item.id && (
                                <circle
                                    cx={CENTER}
                                    cy={CENTER}
                                    r="20"
                                    className="fill-cyan-400/20 animate-pulse"
                                />
                            )}

                            {/* Circle Border & Fill */}
                            <circle
                                cx={CENTER}
                                cy={CENTER}
                                r={activeDebrisId === item.id ? "13" : "10"}
                                className={`stroke-2 ${activeDebrisId === item.id ? 'stroke-cyan-400 stroke-[3px]' : 'stroke-white/30'} ${
                                    item.type === 'Gas Seepage' 
                                        ? 'fill-green-600' 
                                        : item.type === 'Crater' 
                                            ? 'fill-purple-600' 
                                            : item.isMetallic 
                                                ? 'fill-blue-700' 
                                                : 'fill-orange-600'
                                }`}
                            />
                            
                            {/* Number */}
                            <text
                                x={CENTER}
                                y={CENTER + 4}
                                textAnchor="middle"
                                className="fill-white text-[10px] font-bold pointer-events-none uppercase"
                            >
                                {item.label}
                            </text>
                        </motion.g>
                    ))}
                </svg>

                {/* Minimal Hint Tooltip (Optional, subtle bottom overlay) */}
                {!readOnly && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-800/60 backdrop-blur px-2 py-0.5 rounded text-[8px] text-white/80 pointer-events-none uppercase tracking-widest">
                        Drag # Markers to Shift Coordinates
                    </div>
                )}
            </div>
        </div>
    );
};

export default SeabedDebrisPlot;
