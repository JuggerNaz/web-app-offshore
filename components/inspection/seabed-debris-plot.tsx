'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { cn } from "@/lib/utils";

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
    onDebrisMove?: (id: string | number, x: number, y: number, geometry: { distance: number, angle: number, face: string, startLeg?: string, endLeg?: string, nearestDistance?: number, nearestLeg?: string, distToNearestLeg?: number }) => void;
    onAddDebris?: (x: number, y: number, geometry: { distance: number, angle: number, face: string, startLeg?: string, endLeg?: string, nearestDistance?: number, nearestLeg?: string, distToNearestLeg?: number }) => void;
    onHover?: (x: number, y: number, geometry: { distance: number, angle: number, face: string, startLeg?: string, endLeg?: string, nearestDistance?: number, nearestLeg?: string, distToNearestLeg?: number } | null) => void;
    onSelectDebris?: (id: string | number | null) => void;
    readOnly?: boolean;

    activeDebrisId?: string | number | null;
    manualEntry?: {
        leg?: string;
        face?: string;
        distance?: number;
    };
    distanceOffset?: number;
    referenceItems?: DebrisItem[];
    registeredQids?: string[];
    legsMetadata?: any[];
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
    referenceItems = [],
    registeredQids = [],
    legsMetadata = [],
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

        // Find nearest leg and distance to it
        let nearestLeg = startLeg;
        let distToNearestLeg = 0;
        
        const startPos = legPositions.find(p => p.name === startLeg);
        const endPos = legPositions.find(p => p.name === endLeg);
        
        if (startPos && endPos) {
            const dStart = Math.sqrt(Math.pow(screenX - startPos.x, 2) + Math.pow(screenY - startPos.y, 2));
            const dEnd = Math.sqrt(Math.pow(screenX - endPos.x, 2) + Math.pow(screenY - endPos.y, 2));
            
            if (dStart < dEnd) {
                nearestLeg = startLeg;
                distToNearestLeg = dStart / pxPerMeter;
            } else {
                nearestLeg = endLeg;
                distToNearestLeg = dEnd / pxPerMeter;
            }
        }

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

        return { 
            distance: logicalDist, 
            angle, 
            face, 
            startLeg, 
            endLeg, 
            nearestDistance,
            nearestLeg,
            distToNearestLeg: distToNearestLeg + distanceOffset
        };
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
                const x1 = bounds.minX - offsetPx;
                const x2 = bounds.maxX + offsetPx;
                const y1 = bounds.minY - offsetPx;
                const y2 = bounds.maxY + offsetPx;

                // Identify 4 faces for this distance
                const outCols = 2;
                const outRows = 2;
                const tl = 'A1';
                const tr = `A${outCols}`;
                const bl = `${String.fromCharCode(64 + outRows)}1`;
                const br = `${String.fromCharCode(64 + outRows)}${outCols}`;

                const qidN = `S/BED(${tl}-${tr})-${dist}M`.toUpperCase();
                const qidS = `S/BED(${bl}-${br})-${dist}M`.toUpperCase();
                const qidE = `S/BED(${tr}-${br})-${dist}M`.toUpperCase();
                const qidW = `S/BED(${tl}-${bl})-${dist}M`.toUpperCase();

                const colorActive = "rgba(100, 116, 139, 0.4)";
                const colorInactive = "rgba(239, 68, 68, 0.15)"; // Light red for unregistered

                const hasN = registeredQids.length === 0 || registeredQids.includes(qidN);
                const hasS = registeredQids.length === 0 || registeredQids.includes(qidS);
                const hasE = registeredQids.length === 0 || registeredQids.includes(qidE);
                const hasW = registeredQids.length === 0 || registeredQids.includes(qidW);

                return (
                    <g key={`grid-${i}`}>
                        <line x1={x1} y1={y1} x2={x2} y2={y1} stroke={hasN ? colorActive : colorInactive} strokeDasharray={hasN ? "4 4" : "2 2"} strokeWidth="1" />
                        <line x1={x1} y1={y2} x2={x2} y2={y2} stroke={hasS ? colorActive : colorInactive} strokeDasharray={hasS ? "4 4" : "2 2"} strokeWidth="1" />
                        <line x1={x2} y1={y1} x2={x2} y2={y2} stroke={hasE ? colorActive : colorInactive} strokeDasharray={hasE ? "4 4" : "2 2"} strokeWidth="1" />
                        <line x1={x1} y1={y1} x2={x1} y2={y2} stroke={hasW ? colorActive : colorInactive} strokeDasharray={hasW ? "4 4" : "2 2"} strokeWidth="1" />
                    </g>
                );
            } else {
                // Triangle/Polygon - Fallback to full polygon if registeredQids logic not yet complex enough for 3+ legs
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
                            const x1 = bounds.minX - offsetPx;
                            const x2 = bounds.maxX + offsetPx;
                            const y1 = bounds.minY - offsetPx;
                            const y2 = bounds.maxY + offsetPx;

                            const tl = 'A1';
                            const tr = `A${legCount / 2}`;
                            const bl = `${String.fromCharCode(64 + 2)}1`;
                            const br = `${String.fromCharCode(64 + 2)}${legCount / 2}`;

                            const qidN = `S/BED(${tl}-${tr})-${dist}M`.toUpperCase();
                            const qidS = `S/BED(${bl}-${br})-${dist}M`.toUpperCase();
                            const qidE = `S/BED(${tr}-${br})-${dist}M`.toUpperCase();
                            const qidW = `S/BED(${tl}-${bl})-${dist}M`.toUpperCase();

                            const hasN = registeredQids.length === 0 || registeredQids.includes(qidN);
                            const hasS = registeredQids.length === 0 || registeredQids.includes(qidS);
                            const hasE = registeredQids.length === 0 || registeredQids.includes(qidE);
                            const hasW = registeredQids.length === 0 || registeredQids.includes(qidW);

                            const colorActive = "fill-slate-500";
                            const colorInactive = "fill-red-400/40";

                            return (
                                <React.Fragment key={`lbl-${i}`}>
                                    {/* Corners (Distances) */}
                                    <text x={x1 - 4} y={y1 - 4} textAnchor="end" className={hasN || hasW ? colorActive : colorInactive}>{dist}m</text>
                                    <text x={x2 + 4} y={y1 - 4} textAnchor="start" className={hasN || hasE ? colorActive : colorInactive}>{dist}m</text>
                                    <text x={x1 - 4} y={y2 + 10} textAnchor="end" className={hasS || hasW ? colorActive : colorInactive}>{dist}m</text>
                                    <text x={x2 + 4} y={y2 + 10} textAnchor="start" className={hasS || hasE ? colorActive : colorInactive}>{dist}m</text>

                                    {/* Box Sector QIDs */}
                                    <text x={CENTER} y={y1 + 12} textAnchor="middle" className={cn("text-[10px] font-mono uppercase transition-opacity", hasN ? "fill-slate-400 opacity-40" : "fill-red-400 opacity-20")}>
                                        {qidN}
                                    </text>
                                    <text x={CENTER} y={y2 - 4} textAnchor="middle" className={cn("text-[10px] font-mono uppercase transition-opacity", hasS ? "fill-slate-400 opacity-40" : "fill-red-400 opacity-20")}>
                                        {qidS}
                                    </text>
                                    <text x={x2 - 4} y={CENTER} textAnchor="middle" transform={`rotate(90, ${x2 - 4}, ${CENTER})`} className={cn("text-[10px] font-mono uppercase transition-opacity", hasE ? "fill-slate-400 opacity-40" : "fill-red-400 opacity-20")}>
                                        {qidE}
                                    </text>
                                    <text x={x1 + 4} y={CENTER} textAnchor="middle" transform={`rotate(-90, ${x1 + 4}, ${CENTER})`} className={cn("text-[10px] font-mono uppercase transition-opacity", hasW ? "fill-slate-400 opacity-40" : "fill-red-400 opacity-20")}>
                                        {qidW}
                                    </text>
                                </React.Fragment>
                            );
                        })}
                    </g>

                    {/* Platform Legs */}
                    <g>
                        {legPositions.map((pos, i) => {
                            // Find matching metadata using the business rules
                            const meta = legsMetadata.find(c => {
                                const m = c.metadata || {};
                                const isNotDeleted = m.del === 0 || m.del === null || m.del === undefined;
                                const matchesLegName = (m.f_leg === pos.name && m.s_leg === pos.name) || 
                                                     c.q_id.toUpperCase() === `LEG ${pos.name.toUpperCase()}` ||
                                                     c.q_id.toUpperCase() === pos.name.toUpperCase();
                                const nodesDifferent = m.f_node && m.s_node && m.f_node !== m.s_node;
                                return isNotDeleted && matchesLegName && nodesDifferent;
                            })?.metadata;

                            let nodeInfo = '';
                            let elevInfo = '';
                            if (meta) {
                                const e1 = parseFloat(meta.elv_1 || meta.elevation_1 || '0');
                                const e2 = parseFloat(meta.elv_2 || meta.elevation_2 || '0');
                                
                                // Identify the bottom elevation (minimum value) and its corresponding node
                                if (e2 <= e1) {
                                    nodeInfo = meta.f_node || meta.start_node || '';
                                    elevInfo = `${e2}m`;
                                } else {
                                    nodeInfo = meta.s_node || meta.end_node || '';
                                    elevInfo = `${e1}m`;
                                }
                            }

                            return (
                                <g key={`leg-${i}`}>
                                    <circle
                                        cx={pos.x}
                                        cy={pos.y}
                                        r="8"
                                        className="fill-white dark:fill-slate-800 stroke-slate-500 stroke-2 shadow-sm"
                                    />
                                    <g transform={`translate(${pos.x}, ${pos.y + 20})`}>
                                        <text
                                            x={0}
                                            y={0}
                                            textAnchor="middle"
                                            className="text-[9px] fill-blue-600 dark:fill-blue-400 font-black uppercase"
                                        >
                                            {pos.name}
                                        </text>
                                        {nodeInfo && (
                                            <text
                                                x={0}
                                                y={10}
                                                textAnchor="middle"
                                                className="text-[7px] fill-slate-400 font-bold"
                                            >
                                                N:{nodeInfo}
                                            </text>
                                        )}
                                        {elevInfo && (
                                            <text
                                                x={0}
                                                y={18}
                                                textAnchor="middle"
                                                className="text-[7px] fill-slate-400 font-bold"
                                            >
                                                EL:{elevInfo}
                                            </text>
                                        )}
                                    </g>
                                    <title>{`Leg: ${pos.name}${nodeInfo ? `\nNodes: ${nodeInfo}` : ''}${elevInfo ? `\nBottom Elevation: ${elevInfo}` : ''}`}</title>
                                </g>
                            );
                        })}
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

                    {/* Reference / Comparison Markers (Ghost) */}
                    <g>
                        {referenceItems.map((item) => {
                            const colorClass = item.type === 'Gas Seepage' 
                                ? 'stroke-green-500' 
                                : item.type === 'Crater' 
                                    ? 'stroke-purple-500' 
                                    : item.isMetallic 
                                        ? 'stroke-blue-500' 
                                        : 'stroke-orange-500';

                            return (
                                <g 
                                    key={`ref-${item.id}`} 
                                    transform={`translate(${toScreen(item.x) - CENTER}, ${toScreen(item.y) - CENTER})`}
                                    className="cursor-pointer group"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectDebris?.(item.id);
                                    }}
                                >
                                    {/* Halo for visibility */}
                                    <circle
                                        cx={CENTER}
                                        cy={CENTER}
                                        r="12"
                                        className={cn(
                                            "fill-white/40 dark:fill-slate-800/40 transition-all",
                                            activeDebrisId === item.id ? "fill-cyan-400/20 r-15" : "group-hover:fill-white/60"
                                        )}
                                    />
                                    <circle
                                        cx={CENTER}
                                        cy={CENTER}
                                        r="10"
                                        className={cn(
                                            `fill-none ${colorClass} stroke-[2px] transition-all`,
                                            activeDebrisId === item.id ? "opacity-100 stroke-[3px]" : "opacity-60"
                                        )}
                                        strokeDasharray="3 2"
                                    />
                                    <circle
                                        cx={CENTER}
                                        cy={CENTER}
                                        r="2"
                                        className={`fill-current ${colorClass} opacity-80`}
                                    />
                                    <text
                                        x={CENTER}
                                        y={CENTER + 20}
                                        textAnchor="middle"
                                        className={cn(
                                            `fill-current ${colorClass} text-[9px] font-black uppercase tracking-tighter transition-all`,
                                            activeDebrisId === item.id ? "opacity-100 scale-110" : "opacity-80"
                                        )}
                                    >
                                        REF#{item.label}
                                    </text>
                                </g>
                            );
                        })}
                    </g>

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
