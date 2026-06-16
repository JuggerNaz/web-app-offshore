"use client";

import React, { useMemo, useState, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
    OrbitControls,
    PerspectiveCamera,
    Grid,
    Html,
    ContactShadows,
    Edges,
    Bounds,
    useBounds,
    Float,
    useHelper
} from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Play, Box, Radio, Compass } from "lucide-react";

interface Component3D {
    id: number;
    q_id: string;
    code: string | null;
    metadata: any;
}

interface Structural3DViewerProps {
    components: Component3D[];
    platformDetails?: any;
    elevations?: any[];
    faces?: any[];
    selectedCompId?: number;
    onSelectComponent: (component: Component3D) => void;
}

const ComponentMesh = ({
    component,
    isSelected,
    onClick,
    start,
    end,
    thickness = 0.3
}: {
    component: Component3D;
    isSelected: boolean;
    onClick: () => void;
    start: [number, number, number];
    end: [number, number, number];
    thickness?: number;
}) => {
    const [hovered, setHovered] = useState(false);
    const labelRef = useRef<HTMLDivElement>(null);

    // Determine shape based on component code
    const code = (component.code || "").toUpperCase();
    const isNode = code.includes("NODE") || component.q_id.includes("NODE") || code === "ND";
    const isAnode = code === "AN" || code.includes("ANOD");
    const isWeld = code === "WN" || code === "WP" || code.includes("WELD");
    const isClamp = code === "CL" || code.includes("CLAM");

    // calculate position, rotation, length
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);

    // Scale thickness based on type, guarding against undefined/NaN values
    let baseThickness = thickness;
    if (isNaN(baseThickness) || baseThickness === null || baseThickness === undefined) {
        baseThickness = 0.3;
    }

    const length = startVec.distanceTo(endVec);
    const position = startVec.clone().add(endVec).multiplyScalar(0.5);
    const direction = endVec.clone().sub(startVec).normalize();

    if (isAnode) baseThickness = 0.15;
    else if (isClamp) baseThickness = baseThickness * 1.8;
    else if (isWeld) {
        baseThickness = baseThickness * 1.15;
        if (baseThickness < 0.25) {
            baseThickness = component.metadata?.s_leg ? 0.55 : 0.3;
        }
    }
    const meshLength = isAnode ? 0.8 : isClamp ? 0.8 : isWeld ? 1.2 : length;
    // Clamp to safe minimum to prevent zero-height geometry (causes NaN bounds)
    const safeMeshLength = Math.max(meshLength, 0.01);

    const quaternion = new THREE.Quaternion();
    if (length > 0.001) {
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    }
    const euler = new THREE.Euler().setFromQuaternion(quaternion);

    // Zoom-based visibility logic removed as per user request
    // Labels now only show on hover or selection, or persistently for welds
    const showLabel = hovered || isSelected || isWeld;

    let labelText = component.q_id;
    if (isWeld) {
        const match = component.q_id.match(/WN\s*N?([A-Za-z0-9]+)/i) || component.q_id.match(/N?([A-Za-z0-9]+)/);
        if (match) {
            labelText = match[1];
        }
    }

    // Offset anodes from the center of the member so they sit on the surface
    const md = component.metadata || {};
    let clockPos = parseFloat(md.clk_pos || "12");
    if (isNaN(clockPos)) clockPos = 12;
    const angle = (clockPos / 12) * Math.PI * 2;
    const memberRadius = baseThickness < 0.2 ? 0.25 : baseThickness;
    const offsetDistance = memberRadius + 0.15;
    let ox = Math.sin(angle) * offsetDistance;
    let oz = Math.cos(angle) * offsetDistance;
    if (isNaN(ox)) ox = 0;
    if (isNaN(oz)) oz = 0;

    const offsetPos: [number, number, number] = isAnode ? [ox, 0, oz] : [0, 0, 0];

    // Guard against NaN coordinates — skip render entirely if bad data
    const hasNaN = [
        startVec.x, startVec.y, startVec.z,
        endVec.x, endVec.y, endVec.z,
        offsetPos[0], offsetPos[1], offsetPos[2]
    ].some(v => !isFinite(v));

    // Skip rendering entirely if coordinates are invalid — prevents NaN from poisoning Bounds
    if (hasNaN) return null;

    return (
        <group position={[position.x, position.y, position.z]} rotation={[euler.x, euler.y, euler.z]}>
            <group position={offsetPos as [number, number, number]}>
                {/* Visual Mesh */}
                <mesh>
                    {isNode || (length <= 0.001 && !isAnode && !isWeld) ? (
                        <sphereGeometry args={[Math.max(thickness * 1.5, 0.01), 16, 16]} />
                    ) : isAnode ? (
                        <boxGeometry args={[0.2, safeMeshLength, 0.2]} />
                    ) : isClamp ? (
                        <boxGeometry args={[baseThickness, 0.8, baseThickness]} />
                    ) : (
                        <cylinderGeometry args={[baseThickness, baseThickness, safeMeshLength, 12]} />
                    )}
                    <meshStandardMaterial
                        color={isSelected ? "#3b82f6" : hovered ? "#60a5fa" : isAnode ? "#f97316" : isWeld ? "#d946ef" : isClamp ? "#b45309" : "#e2e8f0"}
                        metalness={0.5}
                        roughness={0.4}
                        emissive={isSelected ? "#2563eb" : isAnode ? "#ea580c" : isWeld ? "#c026d3" : "#000000"}
                        emissiveIntensity={isSelected ? 0.3 : hovered ? 0.1 : 0}
                    />
                    {isClamp && (
                        <mesh position={[0, 0, 0]}>
                            <boxGeometry args={[baseThickness + 0.4, 0.6, 0.05]} />
                            <meshStandardMaterial color="#b45309" metalness={0.8} />
                        </mesh>
                    )}
                    {isAnode && (
                        <group>
                            {/* Top Stub */}
                            <mesh position={[0, safeMeshLength / 2 + 0.05, 0]}>
                                <cylinderGeometry args={[0.03, 0.03, 0.1, 8]} />
                                <meshStandardMaterial color="#ef4444" roughness={0.4} />
                            </mesh>
                            <mesh position={[-ox / 2, safeMeshLength / 2 + 0.1, -oz / 2]} rotation={[Math.PI / 2, angle, 0]}>
                                <cylinderGeometry args={[0.03, 0.03, offsetDistance, 8]} />
                                <meshStandardMaterial color="#ef4444" roughness={0.4} />
                            </mesh>
                            {/* Bottom Stub */}
                            <mesh position={[0, -safeMeshLength / 2 - 0.05, 0]}>
                                <cylinderGeometry args={[0.03, 0.03, 0.1, 8]} />
                                <meshStandardMaterial color="#ef4444" roughness={0.4} />
                            </mesh>
                            <mesh position={[-ox / 2, -safeMeshLength / 2 - 0.1, -oz / 2]} rotation={[Math.PI / 2, angle, 0]}>
                                <cylinderGeometry args={[0.03, 0.03, offsetDistance, 8]} />
                                <meshStandardMaterial color="#ef4444" roughness={0.4} />
                            </mesh>
                        </group>
                    )}
                </mesh>

                {/* Invisible Hit Box */}
                <mesh
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick();
                    }}
                    onPointerOver={(e) => {
                        e.stopPropagation();
                        setHovered(true);
                    }}
                    onPointerOut={(e) => {
                        e.stopPropagation();
                        setHovered(false);
                    }}
                >
                    {isNode || (length <= 0.001 && !isAnode && !isWeld) ? (
                        <sphereGeometry args={[Math.max(thickness * 2, 0.01), 8, 8]} />
                    ) : isAnode ? (
                        <boxGeometry args={[0.5, safeMeshLength + 0.2, 0.5]} />
                    ) : (
                        <cylinderGeometry args={[baseThickness + 0.3, baseThickness + 0.3, Math.max(isWeld ? safeMeshLength + 0.5 : length + 0.5, 0.01), 8]} />
                    )}
                    <meshBasicMaterial transparent opacity={0} />
                </mesh>

                {showLabel && (
                    <Html distanceFactor={15} position={[0, (isAnode || isWeld ? safeMeshLength : length) / 2 + 0.5, 0]} center>
                        <div
                            className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest whitespace-nowrap border pointer-events-none transition-all shadow-xl ${isSelected
                                ? "bg-blue-600 text-white border-blue-400 scale-110 opacity-100"
                                : isWeld
                                    ? "bg-orange-500 text-white border-orange-400 scale-100 opacity-90 font-bold shadow-[0_0_10px_rgba(249,115,22,0.4)]"
                                    : "bg-white/90 text-blue-900 border-blue-200"
                                }`}
                        >
                            {labelText}
                        </div>
                    </Html>
                )}
            </group>
        </group>
    );
};

const FoundationMember = ({
    start,
    end,
    thickness,
    color,
    label,
    showLabel = true,
    renderMesh = true
}: {
    start: [number, number, number];
    end: [number, number, number];
    thickness: number;
    color: string;
    label?: string;
    showLabel?: boolean;
    renderMesh?: boolean;
}) => {
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);

    // Skip if any coordinate is NaN/Infinite
    const hasNaN = [startVec.x, startVec.y, startVec.z, endVec.x, endVec.y, endVec.z].some(v => !isFinite(v));
    if (hasNaN) return null;

    const length = startVec.distanceTo(endVec);
    const safeLength = Math.max(length, 0.01);
    const position = startVec.clone().add(endVec).multiplyScalar(0.5);
    const direction = endVec.clone().sub(startVec).normalize();

    const quaternion = new THREE.Quaternion();
    if (length > 0.001) {
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    }
    const euler = new THREE.Euler().setFromQuaternion(quaternion);

    return (
        <group position={[position.x, position.y, position.z]} rotation={[euler.x, euler.y, euler.z]}>
            {renderMesh && (
                <mesh>
                    <cylinderGeometry args={[thickness, thickness, safeLength, 8]} />
                    <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
                </mesh>
            )}
            {showLabel && label && (
                <Html distanceFactor={20} position={[0, safeLength / 2 + 1, 0]} center>
                    <div className="px-3 py-1 bg-white/10 backdrop-blur-md text-[14px] font-black text-slate-900 dark:text-white rounded-full border border-white/20 shadow-2xl pointer-events-none uppercase tracking-[0.2em]">
                        {label}
                    </div>
                </Html>
            )}
        </group>
    );
};

const ElevationMarker = ({ y, label }: { y: number, label: string }) => (
    <group position={[0, y, 0]}>
        <Html position={[-30, 0, 0]} center distanceFactor={20}>
            <div className="flex items-center gap-3">
                <div className="h-[1px] w-12 bg-blue-500/50" />
                <div className="px-2 py-1 bg-blue-600/90 backdrop-blur text-[10px] font-black text-white rounded border border-blue-400/50 shadow-lg whitespace-nowrap">
                    EL {label}
                </div>
            </div>
        </Html>
    </group>
);

// Component to handle auto-framing
function SelectToZoom({ children }: { children: React.ReactNode }) {
    const api = useBounds();
    return (
        <group onClick={(e) => (e.stopPropagation(), e.delta <= 2 && api.refresh(e.object).fit())} onPointerMissed={(e) => e.button === 0 && api.refresh().fit()}>
            {children}
        </group>
    );
}

export function Structural3DViewer({
    components: rawComponents,
    platformDetails,
    elevations = [],
    faces = [],
    selectedCompId,
    onSelectComponent
}: Structural3DViewerProps) {
    const components = useMemo(() => {
        return rawComponents.filter(c => {
            const code = (c.code || "").toUpperCase();
            const isNodeWeld = code === "WN";
            if (isNodeWeld && c.q_id && c.q_id.includes("-")) {
                return false;
            }
            return true;
        });
    }, [rawComponents]);

    const [showGrid, setShowGrid] = useState(true);
    const [showWater, setShowWater] = useState(true);
    const [selectedElevations, setSelectedElevations] = useState<number[]>([]);
    const [selectedFaces, setSelectedFaces] = useState<string[]>([]);
    const [openDropdown, setOpenDropdown] = useState<"elevation" | "face" | null>(null);
    const [isActivated, setIsActivated] = useState(false);
    const [isActivating, setIsActivating] = useState(false);

    const handleActivate = () => {
        setIsActivating(true);
        setTimeout(() => {
            setIsActivated(true);
            setIsActivating(false);
        }, 1200);
    };

    // Helper to sanitize elevation typos
    const sanitizeElevation = (elvVal: any): number => {
        if (elvVal === undefined || elvVal === null) return 0;
        let val = typeof elvVal === 'number' ? elvVal : parseFloat(elvVal);
        if (isNaN(val)) return 0;
        if (val === 50.772) return -50.772; // Fix 50m spike typo
        if (val < -1000) return val / 1000;  // Fix -21424m typo
        return val;
    };

    const availableElevations = useMemo(() => {
        const values = elevations.map(e => sanitizeElevation(e.elv));
        return Array.from(new Set(values)).sort((a, b) => b - a);
    }, [elevations]);

    // Derived level markers from real elevation data
    const { seabedY, waterSurfaceY, waterDepth } = useMemo(() => {
        const elvValues = elevations.map(e => sanitizeElevation(e.elv));
        // Lowest elevation minus a 5m buffer = seabed
        const minElv = elvValues.length > 0 ? Math.min(...elvValues) : -30;
        const seabedY = minElv - 5;
        // Water surface is always MSL = 0
        const waterSurfaceY = 0;
        // Water column depth from surface to seabed
        const waterDepth = Math.abs(waterSurfaceY - seabedY);
        return { seabedY, waterSurfaceY, waterDepth };
    }, [elevations]);

    const availableFaces = useMemo(() => {
        return Array.from(new Set(faces.map(f => f.face).filter(Boolean)));
    }, [faces]);

    const { componentLayouts, foundationMembers, elvMarkers } = useMemo(() => {
        // 1. Determine Leg Footprints and Grid Centering
        const SPACING = 15; // default spacing between rows/cols
        const legMap: Record<string, { x: number, z: number }> = {};

        // Collect all leg names from details and faces
        const allLegNamesSet = new Set<string>();
        if (platformDetails) {
            for (let i = 1; i <= 20; i++) {
                const name = platformDetails[`leg_t${i}`];
                if (name) allLegNamesSet.add(name.toString().toUpperCase());
            }
        }
        faces.forEach(f => {
            if (f.face_from) allLegNamesSet.add(f.face_from.toUpperCase());
            if (f.face_to) allLegNamesSet.add(f.face_to.toUpperCase());
        });

        const allLegNames = Array.from(allLegNamesSet);

        // Extract unique rows (letters) and columns (numbers)
        const rowLetters = Array.from(new Set(allLegNames.map(n => n.match(/([A-Z]+)/)?.[1] || "")))
            .filter(Boolean).sort();
        const colNumbers = Array.from(new Set(allLegNames.map(n => n.match(/(\d+)/)?.[1] || "")))
            .filter(Boolean).sort((a, b) => parseInt(a) - parseInt(b));

        const centerRow = (rowLetters.length - 1) / 2;
        const centerCol = (colNumbers.length - 1) / 2;

        const legRowCol: Record<string, { row: number, col: number }> = {};

        allLegNames.forEach(name => {
            const match = name.match(/([A-Z]+)(\d+)/);
            if (match) {
                const letter = match[1];
                const num = match[2];
                const rowIndex = rowLetters.indexOf(letter);
                const colIndex = colNumbers.indexOf(num);

                // Map to centered coordinates
                // Letter (A, B...) -> Z-axis (A is top/positive)
                // Number (1, 2...) -> X-axis (1 is left/negative)
                legMap[name] = {
                    x: (colIndex - centerCol) * SPACING,
                    z: -(rowIndex - centerRow) * SPACING
                };
                legRowCol[name.toUpperCase()] = { row: rowIndex, col: colIndex };
            }
        });

        // Extract horizontal member length data points to compute splay factor at different elevations
        interface MemberDataPoint {
            y: number;
            length: number;
            type: "X" | "Z";
        }
        const dataPoints: MemberDataPoint[] = [];

        components.forEach(c => {
            const code = (c.code || "").toUpperCase();
            if (!["HM", "HOM", "HD", "HDM"].includes(code)) return;
            const md = c.metadata || {};
            if (!md.s_leg || !md.f_leg) return;
            const sLeg = md.s_leg.toUpperCase();
            const fLeg = md.f_leg.toUpperCase();
            if (sLeg === fLeg) return;
            
            const sInfo = legRowCol[sLeg];
            const fInfo = legRowCol[fLeg];
            if (!sInfo || !fInfo) return;

            // Make sure it's horizontal
            const y1 = sanitizeElevation(md.elv_1 || (md.depth ? -parseFloat(md.depth)/10 : undefined));
            const y2 = sanitizeElevation(md.elv_2 || (md.depth ? -parseFloat(md.depth)/10 : undefined));
            if (Math.abs(y1 - y2) > 0.01) return; // not horizontal

            const lengthVal = parseFloat(md.length || md.additionalInfo?.length || "0");
            if (isNaN(lengthVal) || lengthVal <= 0.1) return;

            const colDiff = Math.abs(fInfo.col - sInfo.col);
            const rowDiff = Math.abs(fInfo.row - sInfo.row);

            if (sInfo.row === fInfo.row && colDiff > 0) {
                dataPoints.push({ y: y1, length: lengthVal / colDiff, type: "X" });
            } else if (sInfo.col === fInfo.col && rowDiff > 0) {
                dataPoints.push({ y: y1, length: lengthVal / rowDiff, type: "Z" });
            }
        });

        const xScalesByY = new Map<number, number[]>();
        const zScalesByY = new Map<number, number[]>();

        dataPoints.forEach(p => {
            if (p.type === "X") {
                if (!xScalesByY.has(p.y)) xScalesByY.set(p.y, []);
                xScalesByY.get(p.y)!.push(p.length / SPACING);
            } else if (p.type === "Z") {
                if (!zScalesByY.has(p.y)) zScalesByY.set(p.y, []);
                zScalesByY.get(p.y)!.push(p.length / SPACING);
            }
        });

        const xPoints: { y: number, scale: number }[] = [];
        const zPoints: { y: number, scale: number }[] = [];

        xScalesByY.forEach((scales, y) => {
            const avg = scales.reduce((a, b) => a + b, 0) / scales.length;
            xPoints.push({ y, scale: avg });
        });

        zScalesByY.forEach((scales, y) => {
            const avg = scales.reduce((a, b) => a + b, 0) / scales.length;
            zPoints.push({ y, scale: avg });
        });

        xPoints.sort((a, b) => a.y - b.y);
        zPoints.sort((a, b) => a.y - b.y);

        const getScaleAtY = (points: { y: number, scale: number }[], yVal: number): number => {
            if (points.length === 0) return 1.0;
            if (points.length === 1) return points[0].scale;
            
            // Extrapolate below lowest elevation
            if (yVal <= points[0].y) {
                const p0 = points[0];
                const p1 = points[1];
                const slope = (p1.scale - p0.scale) / (p1.y - p0.y);
                return p0.scale + slope * (yVal - p0.y);
            }
            // Extrapolate above highest elevation
            if (yVal >= points[points.length - 1].y) {
                const p0 = points[points.length - 2];
                const p1 = points[points.length - 1];
                const slope = (p1.scale - p0.scale) / (p1.y - p0.y);
                return p1.scale + slope * (yVal - p1.y);
            }
            // Interpolate between surrounding elevations
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[i];
                const p1 = points[i + 1];
                if (yVal >= p0.y && yVal <= p1.y) {
                    const t = (yVal - p0.y) / (p1.y - p0.y);
                    return p0.scale + (p1.scale - p0.scale) * t;
                }
            }
            return 1.0;
        };

        const isD21JT = platformDetails?.title?.toUpperCase().includes('D21JT') || false;

        const getLegCoordsAtElv = (legName: string, yVal: number) => {
            const key = legName.toUpperCase();
            if (isD21JT) {
                const L = 13.91 - 0.12489 * (yVal - 2.872);
                const W = 12.45 - 0.16665 * (yVal - 2.872);

                if (key === 'A1') return { x: -L / 2, z: W / 2 };
                if (key === 'B1') return { x: L / 2, z: W / 2 };
                if (key === 'A2') return { x: -L / 2, z: -W / 2 };
                if (key === 'B2') return { x: L / 2, z: -W / 2 };
            }
            if (legMap[key]) {
                const nominal = legMap[key];
                const scaleX = getScaleAtY(xPoints, yVal);
                const scaleZ = getScaleAtY(zPoints, yVal);
                return { x: nominal.x * scaleX, z: nominal.z * scaleZ };
            }
            return { x: 0, z: 0 };
        };

        // 2. Determine Elevation Levels
        const elvValues = elevations.map(e => sanitizeElevation(e.elv)).sort((a, b) => b - a);
        const maxElv = elvValues.length > 0 ? Math.max(...elvValues) : 5;
        const minElv = elvValues.length > 0 ? Math.min(...elvValues) : -30;

        // 3. Generate Foundation Members (Legs and Rows)
        const foundationMembers: any[] = [];
        const elvMarkers: any[] = [];

        // Render Vertical Legs (Tapered/Splayed)
        Object.keys(legMap).forEach((name) => {
            const startCoords = getLegCoordsAtElv(name, maxElv + 5);
            const endCoords = getLegCoordsAtElv(name, minElv);
            foundationMembers.push({
                id: `leg-${name}`,
                start: [startCoords.x, maxElv + 5, startCoords.z], // Extend slightly above max
                end: [endCoords.x, minElv, endCoords.z],
                thickness: 0.8,
                color: "#94a3b8", // slate-400 (galvanized look)
                label: name,
                renderMesh: false
            });
        });

        // Render Horizontal Rows (Faces) at each elevation
        faces.forEach(face => {
            elvValues.forEach((elv, idx) => {
                const fromCoords = getLegCoordsAtElv(face.face_from, elv);
                const toCoords = getLegCoordsAtElv(face.face_to, elv);
                foundationMembers.push({
                    id: `face-${face.face}-${idx}`,
                    start: [fromCoords.x, elv, fromCoords.z],
                    end: [toCoords.x, elv, toCoords.z],
                    thickness: 0.4,
                    color: "#64748b", // slate-500
                    label: face.face,
                    renderMesh: false
                });
            });
        });

        // Generate Elevation Markers
        elevations.forEach(e => {
            const y = sanitizeElevation(e.elv);
            elvMarkers.push({
                y: y,
                label: `${y.toFixed(3)}m`
            });
        });

        // 4. Build 3D Node Map for existing components
        const nodeMap = new Map<string, THREE.Vector3>();
        const nodeLegMap = new Map<string, string>();

        // Helper to scan nodeMap for any existing aliases of the target node and return its vector reference
        const getExistingNodeVector = (nodeId: string): THREE.Vector3 | undefined => {
            const normalized = nodeId.toUpperCase().trim();
            const aliases = [normalized];
            if (/^N\d+$/.test(normalized)) aliases.push(normalized.slice(1));
            if (/^\d+$/.test(normalized)) aliases.push(`N${normalized}`);
            if (!normalized.startsWith("WN")) {
                aliases.push(`WN ${normalized}`);
                aliases.push(`WN${normalized}`);
            }
            for (const alias of aliases) {
                if (nodeMap.has(alias)) {
                    const vec = nodeMap.get(alias)!;
                    if (vec.x !== 0 || vec.z !== 0) return vec;
                }
            }
            return undefined;
        };

        // Helper to register a vector under multiple alias keys in nodeMap
        const registerNodeAlias = (alias: string, vec: THREE.Vector3, legKey: string) => {
            const key = alias.toUpperCase();
            
            // Look for any existing vector instance for this node name to share reference
            const existingVec = getExistingNodeVector(key);
            const activeVec = existingVec || vec;
            
            if (!nodeMap.has(key) || (nodeMap.get(key)!.x === 0 && nodeMap.get(key)!.z === 0)) {
                nodeMap.set(key, activeVec);
                if (legKey) nodeLegMap.set(key, legKey);
            }
            if (legKey) {
                const compositeKey = `${key}|${legKey}`;
                if (!nodeMap.has(compositeKey) || (nodeMap.get(compositeKey)!.x === 0 && nodeMap.get(compositeKey)!.z === 0)) {
                    nodeMap.set(compositeKey, activeVec);
                    nodeLegMap.set(compositeKey, legKey);
                }
            }
        };

        const processNode = (nodeName: string | undefined, legName: string | undefined, elv: string | undefined, depth: string | undefined, easting: string | undefined, northing: string | undefined, isPrimary: boolean) => {
            if (!nodeName) return;

            const normalizedNodeName = nodeName.toUpperCase();
            const legKey = legName?.toUpperCase() || "";
            const mapKey = legKey ? `${normalizedNodeName}|${legKey}` : normalizedNodeName;

            let x = 0, y = 0, z = 0;

            if (elv) {
                y = sanitizeElevation(elv);
            } else if (depth) {
                y = -sanitizeElevation(depth) / 10 || 0;
            }

            if (legKey) {
                const coords = getLegCoordsAtElv(legKey, y);
                x = coords.x;
                z = coords.z;
            } else if (easting || northing) {
                x = parseFloat(easting || "0") / 100 || 0;
                z = parseFloat(northing || "0") / 100 || 0;
            }

            const vec = new THREE.Vector3(x, y, z);
            registerNodeAlias(normalizedNodeName, vec, legKey);
        };

        // Helper to extract bare node from q_id
        const extractBareNode = (q_id: string): string => {
            const matchFull = q_id.match(/WN\s*(N?[A-Za-z0-9]+)/i);
            const matchBare = q_id.match(/(?:WN\s*)?(N?(\d+))$/i);
            if (matchFull) return matchFull[1].toUpperCase();
            if (matchBare) return matchBare[1].toUpperCase();
            return q_id.toUpperCase();
        };

        // PASS 1: Authoritative Root Node Providers (WN, ND, NODE that define their own absolute coords)
        const intermediateWelds: typeof components = [];

        components.forEach(c => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            const isWeld = code === "WN" || code === "WP" || code.includes("WELD");
            
            if (isWeld || code.includes("NODE") || code === "ND") {
                const bareNode = extractBareNode(c.q_id);
                const sNode = (md.s_node || "").toUpperCase();
                const fNode = (md.f_node || "").toUpperCase();
                
                // If it has s_node and f_node, and neither is itself, it's an intermediate weld on a member!
                const isIntermediate = sNode && fNode && sNode !== bareNode && fNode !== bareNode;

                if (isIntermediate) {
                    intermediateWelds.push(c);
                    return; // Process in Pass 2
                }

                // Root Node Weld Processing
                const leg = (md.s_leg || md.f_leg || md.leg || "").toUpperCase();
                const elv = md.elv_1 || md.elv_2 || md.depth;
                const ePlainNum = md.elv_1 || md.elv_2;

                let y = 0;
                if (ePlainNum) y = sanitizeElevation(ePlainNum);
                else if (md.depth) y = -sanitizeElevation(md.depth) / 10;

                let x = 0, z = 0;
                if (leg) {
                    const coords = getLegCoordsAtElv(leg, y);
                    x = coords.x;
                    z = coords.z;
                } else if (md.easting || md.northing) {
                    x = parseFloat(md.easting || "0") / 100 || 0;
                    z = parseFloat(md.northing || "0") / 100 || 0;
                }

                if (leg || md.easting || md.northing || ePlainNum || md.depth) {
                    const vec = new THREE.Vector3(x, y, z);
                    
                    registerNodeAlias(c.q_id, vec, leg);

                    const matchFull = c.q_id.match(/WN\s*(N?[A-Za-z0-9]+)/i);
                    const matchBare = c.q_id.match(/(?:WN\s*)?(N?(\d+))$/i);
                    if (matchFull) {
                        const withN = matchFull[1].toUpperCase();
                        registerNodeAlias(withN, vec, leg);
                        const numOnly = withN.replace(/^N/, "");
                        registerNodeAlias(numOnly, vec, leg);
                        registerNodeAlias(`N${numOnly}`, vec, leg);
                    } else if (matchBare) {
                        const withN = matchBare[1].toUpperCase();
                        registerNodeAlias(withN, vec, leg);
                        registerNodeAlias(matchBare[2], vec, leg);
                    }
                }
            }
        });

        // lookupNode tries multiple alias forms so that whatever format s_node/f_node uses,
        // it resolves correctly ("N164", "164", "WN N164", etc.)
        const lookupNode = (nodeId: string | undefined, legName: string | undefined): THREE.Vector3 | undefined => {
            if (!nodeId) return undefined;
            const normalizedNodeId = nodeId.toUpperCase().trim();
            const legKey = legName?.toUpperCase() || "";

            const aliases: string[] = [normalizedNodeId];
            if (/^N\d+$/.test(normalizedNodeId)) aliases.push(normalizedNodeId.slice(1));
            if (/^\d+$/.test(normalizedNodeId)) aliases.push(`N${normalizedNodeId}`);
            if (!normalizedNodeId.startsWith("WN")) {
                aliases.push(`WN ${normalizedNodeId}`);
                aliases.push(`WN${normalizedNodeId}`);
                if (/^\d+$/.test(normalizedNodeId)) {
                    aliases.push(`WN N${normalizedNodeId}`);
                    aliases.push(`WNN${normalizedNodeId}`);
                }
            }

            for (const alias of aliases) {
                if (legKey) {
                    const compositeKey = `${alias}|${legKey}`;
                    if (nodeMap.has(compositeKey)) return nodeMap.get(compositeKey);
                }
                if (nodeMap.has(alias)) return nodeMap.get(alias);
            }
            return undefined;
        };

        // PASS 1.2: Register endpoints for all primary member components
        components.forEach(c => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            const isPrimary = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM", "LG", "LEG"].includes(code);
            if (isPrimary) {
                processNode(md.s_node, md.s_leg, md.elv_1, md.depth, md.easting, md.northing, true);
                processNode(md.f_node, md.f_leg, md.elv_2, md.depth, md.easting, md.northing, true);
            }
        });

        // PASS 1.5: Adjust primary member endpoint positions based on metadata length
        // (Commented out to prevent cumulative in-place coordinate distortion on closed loop frames)
        /*
        components.forEach(c => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            const isMember = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM"].includes(code);
            if (isMember && md.s_node && md.f_node) {
                const sPos = lookupNode(md.s_node, md.s_leg);
                const fPos = lookupNode(md.f_node, md.f_leg);
                if (sPos && fPos) {
                    const originalDist = sPos.distanceTo(fPos);
                    if (originalDist > 0.001) {
                        const lengthStr = md.length || md.additionalInfo?.length;
                        if (lengthStr) {
                            const memberLength = parseFloat(lengthStr);
                            if (!isNaN(memberLength) && memberLength > 0) {
                                const dir = fPos.clone().sub(sPos).normalize();
                                const newFPos = sPos.clone().add(dir.multiplyScalar(memberLength));
                                fPos.copy(newFPos);
                            }
                        }
                    }
                }
            }
        });
        */

        // PASS 2: Intermediate Node Welds (e.g. WN N170 sitting on HOM N166-N164)
        // Group by endpoints, interpolate, and REGISTER back to nodeMap!
        const intermediateWeldGroups = new Map<string, typeof intermediateWelds>();
        intermediateWelds.forEach(c => {
            const md = c.metadata || {};
            const sNode = lookupNode(md.s_node, md.s_leg);
            const fNode = lookupNode(md.f_node, md.f_leg);
            if (sNode && fNode) {
                const key = `${sNode.x.toFixed(3)},${sNode.y.toFixed(3)},${sNode.z.toFixed(3)}|${fNode.x.toFixed(3)},${fNode.y.toFixed(3)},${fNode.z.toFixed(3)}`;
                if (!intermediateWeldGroups.has(key)) intermediateWeldGroups.set(key, []);
                intermediateWeldGroups.get(key)!.push(c);
            }
        });

        intermediateWeldGroups.forEach((items, key) => {
            const md0 = items[0].metadata || {};
            const sNode = lookupNode(md0.s_node, md0.s_leg)!;
            const fNode = lookupNode(md0.f_node, md0.f_leg)!;
            
            items.sort((a, b) => a.q_id.localeCompare(b.q_id));
            const count = items.length;
            
            items.forEach((item, idx) => {
                const md = item.metadata || {};
                let pos = new THREE.Vector3();
                
                if ((md.elv_1 || md.depth) && Math.abs(fNode.y - sNode.y) > 0.001) {
                    const targetY = sanitizeElevation(md.elv_1 || (-parseFloat(md.depth) / 10));
                    const t = (targetY - sNode.y) / (fNode.y - sNode.y);
                    pos.copy(sNode).lerp(fNode, Math.max(0, Math.min(1, t)));
                } else {
                    // For horizontal members, distribute them evenly
                    const t = (idx + 1) / (count + 1);
                    pos.copy(sNode).lerp(fNode, t);
                }
                
                if (md.dist) {
                    const distance = parseFloat(md.dist);
                    if (distance > 0 && distance < 3.0) {
                        const clockPos = parseFloat(md.clk_pos || "12");
                        const angle = (clockPos / 12) * Math.PI * 2;
                        pos.x += Math.sin(angle) * distance;
                        pos.z += Math.cos(angle) * distance;
                    }
                }

                // Register interpolated position to nodeMap so HDM members can use it!
                const bareNode = extractBareNode(item.q_id);
                registerNodeAlias(item.q_id, pos, "");
                registerNodeAlias(bareNode, pos, "");
                if (/^N\d+$/.test(bareNode)) {
                    registerNodeAlias(bareNode.slice(1), pos, "");
                } else if (/^\d+$/.test(bareNode)) {
                    registerNodeAlias(`N${bareNode}`, pos, "");
                }
            });
        });

        // PASS 3: Fallback registrations for endpoints on non-node and non-primary components
        components.forEach(c => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            const isWeld = code === "WN" || code === "WP" || code.includes("WELD");
            const isNode = isWeld || code.includes("NODE") || code === "ND";
            const isPrimary = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM", "LG", "LEG"].includes(code);
            
            if (!isNode && !isPrimary) {
                const isPrimaryFallback = ["CF", "CG", "CD", "CO", "CA"].includes(code);
                processNode(md.s_node, md.s_leg, md.elv_1, md.depth, md.easting, md.northing, isPrimaryFallback);
                processNode(md.f_node, md.f_leg, md.elv_2, md.depth, md.easting, md.northing, isPrimaryFallback);
            }
        });



        // 5. Resolve Structural Layouts for components
        const intermediateLayouts = new Map<number, { component: any, start: THREE.Vector3, end: THREE.Vector3, thickness: number }>();

        // PASS 1.7: Interpolate and register child node welds (WN) on parent members
        const childWeldGroups = new Map<number, typeof components>();
        components.forEach(c => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            if (code === "WN" && md.associated_comp_id) {
                const parentId = md.associated_comp_id;
                if (!childWeldGroups.has(parentId)) {
                    childWeldGroups.set(parentId, []);
                }
                childWeldGroups.get(parentId)!.push(c);
            }
        });

        // Run interpolation multiple times (3 iterations) to resolve dependency ordering
        // (e.g. child welds whose parent endpoints themselves depend on other child welds)
        for (let iter = 0; iter < 3; iter++) {
            childWeldGroups.forEach((children, parentId) => {
                // Find parent component
                const parentComp = components.find(c => c.id === parentId);
                if (!parentComp) return;

                const parentMd = parentComp.metadata || {};
                const pStart = lookupNode(parentMd.s_node, parentMd.s_leg);
                const pEnd = lookupNode(parentMd.f_node, parentMd.f_leg);
                if (!pStart || !pEnd) return;

                const direction = pEnd.clone().sub(pStart).normalize();

                // Sort children by dist ascending
                children.sort((a, b) => {
                    const distA = parseFloat(a.metadata?.dist || "0");
                    const distB = parseFloat(b.metadata?.dist || "0");
                    if (distA !== distB) return distA - distB;
                    return (a.q_id || "").localeCompare(b.q_id || "");
                });

                const count = children.length;
                children.forEach((c, idx) => {
                    const t = (idx + 1) / (count + 1);
                    const pos = pStart.clone().lerp(pEnd, t);

                    // Update position in nodeMap
                    const nodeName = (c.metadata?.s_node || "").toUpperCase();
                    if (nodeName) {
                        const nodeVec = lookupNode(nodeName, "");
                        if (nodeVec) {
                            nodeVec.copy(pos);
                        } else {
                            registerNodeAlias(nodeName, pos, "");
                            registerNodeAlias(c.q_id, pos, "");
                        }
                    }

                    // Add layout to intermediateLayouts immediately
                    let thickness = 0.15; // default weld thickness
                    const start = pos.clone();
                    const end = pos.clone();
                    if (direction.lengthSq() > 0.1) {
                        end.add(direction.clone().multiplyScalar(0.1));
                    }
                    intermediateLayouts.set(c.id, { component: c, start, end, thickness });
                });
            });
        }

        const pendingAttachments: typeof components = [];
        const pendingSpanAccessories: { component: any, sNode: THREE.Vector3, fNode: THREE.Vector3 }[] = [];

        components.forEach((c, i) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();

            // Skip child welds already resolved in PASS 1.7
            if (code === "WN" && md.associated_comp_id) {
                return;
            }

            const isAnode = code === "AN" || code.includes("ANOD");
            const isWeld = code === "WN" || code === "WP" || code.includes("WELD");
            const isClamp = code === "CL" || code.includes("CLAM");
            const isPointAccessory = isAnode || isWeld || isClamp;

            let thickness = 0.15;
            if (code.includes("LG")) thickness = 0.5;
            else if (code.includes("HM") || code.includes("HD")) thickness = 0.25;
            else if (code.includes("VM") || code.includes("VD")) thickness = 0.20;
            else if (code === "CO" || code === "CA" || code.includes("COND") || code.includes("CAIS")) thickness = 0.35;

            const startNode = lookupNode(md.s_node, md.s_leg);
            const endNode = lookupNode(md.f_node, md.f_leg);
            const hasStartNode = !!startNode;
            const hasEndNode = !!endNode;

            let start = new THREE.Vector3();
            let end = new THREE.Vector3();
            let resolved = false;

            if (md.associated_comp_id) {
                pendingAttachments.push(c);
                return;
            } else if (isPointAccessory && hasStartNode && hasEndNode && startNode!.distanceTo(endNode!) > 0.001) {
                pendingSpanAccessories.push({ component: c, sNode: startNode!, fNode: endNode! });
                return;
            } else if (isPointAccessory && (hasStartNode || hasStartNode !== hasEndNode || md.s_leg)) {
                const y = md.elv_1 ? sanitizeElevation(md.elv_1) : (startNode?.y ?? endNode?.y ?? 0);
                if (startNode) {
                    start.set(startNode.x, y, startNode.z);
                } else if (md.s_leg) {
                    const coords = getLegCoordsAtElv(md.s_leg.toUpperCase(), y);
                    start.set(coords.x, y, coords.z);
                } else if (endNode) {
                    start.set(endNode.x, y, endNode.z);
                }
                if (md.dist && !isAnode) {
                    const distance = parseFloat(md.dist);
                    if (distance > 0 && distance < 3.0) {
                        const clockPos = parseFloat(md.clk_pos || "12");
                        const angle = (clockPos / 12) * Math.PI * 2;
                        start.x += Math.sin(angle) * distance;
                        start.z += Math.cos(angle) * distance;
                    }
                }
                end.copy(start);
                resolved = true;
            } else if (hasStartNode || hasEndNode) {
                if (hasStartNode) start.copy(startNode!);
                if (hasEndNode) end.copy(endNode!);

                if (hasStartNode && !hasEndNode) end.copy(start);
                else if (!hasStartNode && hasEndNode) start.copy(end);

                resolved = true;
            } else if (md.s_leg) {
                const y = sanitizeElevation(md.elv_1 || (md.depth ? -parseFloat(md.depth) / 10 : 0));
                const coords = getLegCoordsAtElv(md.s_leg, y);
                start.set(coords.x, y, coords.z);
                if (md.f_leg && md.elv_2) {
                    const y2 = sanitizeElevation(md.elv_2);
                    const coords2 = getLegCoordsAtElv(md.f_leg, y2);
                    end.set(coords2.x, y2, coords2.z);
                } else {
                    end.copy(start);
                }
                resolved = true;
            } else if (md.easting || md.northing) {
                const x = parseFloat(md.easting || "0") / 100 || 0;
                const z = parseFloat(md.northing || "0") / 100 || 0;
                start.set(x, maxElv + 2, z);
                end.set(x, minElv, z);
                resolved = true;
            }

            if (!resolved) {
                const layer = Math.floor(i / 16);
                const posInLayer = i % 16;
                const radius = 20 + layer * 2;
                const angle = (posInLayer / 16) * Math.PI * 2;
                start.set(Math.cos(angle) * radius, -layer * 4, Math.sin(angle) * radius);
                end.set(start.x, start.y + 4, start.z);
            }

            intermediateLayouts.set(c.id, { component: c, start, end, thickness });
        });

        const spanMap = new Map<string, typeof pendingSpanAccessories>();
        pendingSpanAccessories.forEach(item => {
            const key = `${item.sNode.x.toFixed(3)},${item.sNode.y.toFixed(3)},${item.sNode.z.toFixed(3)}|${item.fNode.x.toFixed(3)},${item.fNode.y.toFixed(3)},${item.fNode.z.toFixed(3)}`;
            if (!spanMap.has(key)) spanMap.set(key, []);
            spanMap.get(key)!.push(item);
        });

        spanMap.forEach((items, key) => {
            const sNode = items[0].sNode;
            const fNode = items[0].fNode;
            
            items.sort((a, b) => a.component.q_id.localeCompare(b.component.q_id));
            const count = items.length;
            
            items.forEach((item, idx) => {
                const md = item.component.metadata || {};
                let start = new THREE.Vector3();
                let end = new THREE.Vector3();
                
                if ((md.elv_1 || md.depth) && Math.abs(fNode.y - sNode.y) > 0.001) {
                    const targetY = sanitizeElevation(md.elv_1 || (-parseFloat(md.depth) / 10));
                    const t = (targetY - sNode.y) / (fNode.y - sNode.y);
                    const clampedT = Math.max(0, Math.min(1, t));
                    start.copy(sNode).lerp(fNode, clampedT);
                } else {
                    const t = (idx + 1) / (count + 1);
                    start.copy(sNode).lerp(fNode, t);
                }
                
                const itemCode = (item.component.code || "").toUpperCase();
                const isAnode = itemCode === "AN" || itemCode.includes("ANOD");
                if (md.dist && !isAnode) {
                    const distance = parseFloat(md.dist);
                    if (distance > 0 && distance < 3.0) {
                        const clockPos = parseFloat(md.clk_pos || "12");
                        const angle = (clockPos / 12) * Math.PI * 2;
                        start.x += Math.sin(angle) * distance;
                        start.z += Math.cos(angle) * distance;
                    }
                }
                
                const direction = fNode.clone().sub(sNode).normalize();
                if (direction.lengthSq() > 0.1) {
                    end.copy(start).add(direction.clone().multiplyScalar(0.8));
                } else {
                    end.copy(start);
                }
                
                intermediateLayouts.set(item.component.id, { 
                    component: item.component, 
                    start, 
                    end, 
                    thickness: 0.15 
                });
            });
        });

        // Pass 2: Resolve attachments relative to their parents
        const pendingAttachmentsByParent = new Map<number, typeof components>();
        pendingAttachments.forEach(c => {
            const parentId = c.metadata?.associated_comp_id;
            if (parentId) {
                if (!pendingAttachmentsByParent.has(parentId)) {
                    pendingAttachmentsByParent.set(parentId, []);
                }
                pendingAttachmentsByParent.get(parentId)!.push(c);
            } else {
                const fallbackId = -1;
                if (!pendingAttachmentsByParent.has(fallbackId)) {
                    pendingAttachmentsByParent.set(fallbackId, []);
                }
                pendingAttachmentsByParent.get(fallbackId)!.push(c);
            }
        });

        let unattachedIndex = 0;
        pendingAttachmentsByParent.forEach((children, parentId) => {
            if (parentId === -1) {
                children.forEach(c => {
                    let start = new THREE.Vector3();
                    const layer = Math.floor(unattachedIndex / 16);
                    const radius = 25 + layer * 2;
                    const angle = (unattachedIndex / 16) * Math.PI * 2;
                    start.set(Math.cos(angle) * radius, maxElv, Math.sin(angle) * radius);
                    let end = start.clone();
                    intermediateLayouts.set(c.id, { component: c, start, end, thickness: 0.15 });
                    unattachedIndex++;
                });
                return;
            }

            const parentLayout = intermediateLayouts.get(parentId);
            if (!parentLayout) {
                children.forEach(c => {
                    let start = new THREE.Vector3();
                    const layer = Math.floor(unattachedIndex / 16);
                    const radius = 25 + layer * 2;
                    const angle = (unattachedIndex / 16) * Math.PI * 2;
                    start.set(Math.cos(angle) * radius, maxElv, Math.sin(angle) * radius);
                    let end = start.clone();
                    intermediateLayouts.set(c.id, { component: c, start, end, thickness: 0.15 });
                    unattachedIndex++;
                });
                return;
            }

            const { start: pStart, end: pEnd, thickness: pThickness } = parentLayout;
            const direction = pEnd.clone().sub(pStart).normalize();

            const childrenWithPos = children.filter(c => c.metadata?.depth || c.metadata?.elv_1);
            const childrenWithoutPos = children.filter(c => !c.metadata?.depth && !c.metadata?.elv_1);

            childrenWithoutPos.sort((a, b) => a.q_id.localeCompare(b.q_id));

            childrenWithPos.forEach(c => {
                const md = c.metadata || {};
                let thickness = pThickness;
                let start = new THREE.Vector3();
                let end = new THREE.Vector3();

                const targetY = sanitizeElevation(md.elv_1 || (-parseFloat(md.depth) / 10));
                if (Math.abs(pEnd.y - pStart.y) > 0.001) {
                    const t = (targetY - pStart.y) / (pEnd.y - pStart.y);
                    const clampedT = Math.max(0, Math.min(1, t));
                    start.copy(pStart).lerp(pEnd, clampedT);
                } else {
                    start.copy(pStart).add(pEnd).multiplyScalar(0.5);
                    start.setY(targetY);
                }

                if (direction.lengthSq() > 0.1) {
                    end.copy(start).add(direction.multiplyScalar(0.1));
                } else {
                    end.copy(start);
                }
                intermediateLayouts.set(c.id, { component: c, start, end, thickness });
            });

            const count = childrenWithoutPos.length;
            childrenWithoutPos.forEach((c, idx) => {
                let thickness = pThickness;
                let start = new THREE.Vector3();
                let end = new THREE.Vector3();

                const t = (idx + 1) / (count + 1);
                start.copy(pStart).lerp(pEnd, t);

                if (direction.lengthSq() > 0.1) {
                    end.copy(start).add(direction.multiplyScalar(0.1));
                } else {
                    end.copy(start);
                }
                intermediateLayouts.set(c.id, { component: c, start, end, thickness });
            });
        });

        // Align endpoint welds with connecting members
        intermediateLayouts.forEach((layout) => {
            const c = layout.component;
            const code = (c.code || "").toUpperCase();
            const isWeld = code === "WN" || code === "WP" || code.includes("WELD");
            
            if (isWeld && layout.start.distanceTo(layout.end) < 0.001) {
                const nodeName = String(c.metadata?.s_node || "").toUpperCase().trim();
                if (nodeName) {
                    let foundMemberLayout: any = null;
                    for (const otherLayout of Array.from(intermediateLayouts.values())) {
                        const otherComp = otherLayout.component;
                        const otherCode = (otherComp.code || "").toUpperCase();
                        const isMember = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM"].includes(otherCode);
                        if (isMember) {
                            const otherMd = otherComp.metadata || {};
                            const sNodeStr = String(otherMd.s_node || "").toUpperCase().trim();
                            const fNodeStr = String(otherMd.f_node || "").toUpperCase().trim();
                            if (sNodeStr === nodeName || fNodeStr === nodeName) {
                                foundMemberLayout = otherLayout;
                                break;
                            }
                        }
                    }
                    
                    if (foundMemberLayout) {
                        const mStart = foundMemberLayout.start;
                        const mEnd = foundMemberLayout.end;
                        const mDist = mStart.distanceTo(mEnd);
                        if (mDist > 0.001) {
                            const dir = mEnd.clone().sub(mStart).normalize();
                            layout.end.copy(layout.start.clone().add(dir.multiplyScalar(0.1)));
                        }
                    }
                }
            }
        });

        const resolvedLayouts = Array.from(intermediateLayouts.values())
            // Filter out any layouts where coordinates are NaN or non-finite
            .filter(layout => {
                const coords = [layout.start.x, layout.start.y, layout.start.z, layout.end.x, layout.end.y, layout.end.z];
                return coords.every(v => isFinite(v));
            })
            // Filter out leg components from the 3D visualization to keep only the vertical member structures
            .filter(layout => {
                const code = (layout.component.code || "").toUpperCase();
                const qId = (layout.component.q_id || "").toUpperCase();
                return !(code === "LG" || code === "LEG" || qId.includes("LEG"));
            })
            .map(layout => ({
                component: layout.component,
                start: [layout.start.x, layout.start.y, layout.start.z] as [number, number, number],
                end: [layout.end.x, layout.end.y, layout.end.z] as [number, number, number],
                thickness: layout.thickness
            }));

        const getComponentLegs = (comp: any) => {
            const compMd = comp.metadata || {};
            let targetComp = comp;
            if (compMd.associated_comp_id) {
                const parent = components.find(c => c.id === compMd.associated_comp_id);
                if (parent) {
                    targetComp = parent;
                }
            }
            const targetMd = targetComp.metadata || {};
            const sNodeKey = (targetMd.s_node || "").toUpperCase();
            const fNodeKey = (targetMd.f_node || "").toUpperCase();
            const sLeg = (targetMd.s_leg || nodeLegMap.get(sNodeKey) || nodeLegMap.get(`N${sNodeKey}`) || "").toUpperCase();
            const fLeg = (targetMd.f_leg || nodeLegMap.get(fNodeKey) || nodeLegMap.get(`N${fNodeKey}`) || "").toUpperCase();
            return { sLeg, fLeg };
        };

        // Helper to check if component belongs strictly to the face plane (outermost members only)
        const isComponentOnFace = (comp: any, faceName: string) => {
            const compMd = comp.metadata || {};
            const faceObj = faces.find(f => f.face?.toUpperCase() === faceName.toUpperCase());
            if (!faceObj) return false;

            const fFrom = (faceObj.face_from || "").toUpperCase();
            const fTo = (faceObj.face_to || "").toUpperCase();
            const faceLegs = [fFrom, fTo].filter(Boolean);
            if (faceLegs.length !== 2) return false;

            const { sLeg, fLeg } = getComponentLegs(comp);
            if (!sLeg || !fLeg) return false;

            const sMatch = faceLegs.includes(sLeg);
            const fMatch = faceLegs.includes(fLeg);

            // Outermost face members only: both ends must belong to the face's leg set {fFrom, fTo}
            if (sMatch && fMatch) return true;

            // If explicit face metadata is present, still require the component to be on the face legs
            if (compMd.face?.toUpperCase() === faceName.toUpperCase()) {
                return sMatch && fMatch;
            }

            return false;
        };

        const filteredLayouts = resolvedLayouts.filter(layout => {
            const c = layout.component;
            const md = c.metadata || {};

            if (selectedElevations.length > 0) {
                const startY = layout.start[1];
                const endY = layout.end[1];

                const matchesStart = selectedElevations.some(selElv => Math.abs(startY - selElv) < 0.5);
                const matchesEnd = selectedElevations.some(selElv => Math.abs(endY - selElv) < 0.5);

                // Both start and end coordinates must match one of the selected elevations
                // (keeps only the horizontal members/components at this level slice)
                if (!matchesStart || !matchesEnd) return false;
            }

            if (selectedFaces.length > 0) {
                const matchesFace = selectedFaces.some(faceName => isComponentOnFace(c, faceName));
                if (!matchesFace) return false;
            }

            return true;
        });

        const filteredFoundationMembers = foundationMembers.filter(m => {
            if (m.id.startsWith("leg-")) {
                return true;
            }

            if (m.id.startsWith("face-")) {
                const faceName = m.label;
                if (selectedFaces.length > 0) {
                    if (!selectedFaces.includes(faceName)) return false;
                }
            }

            // Both start and end coordinates of foundation members must match selected elevations
            if (selectedElevations.length > 0) {
                const startY = m.start[1];
                const endY = m.end[1];

                const matchesStart = selectedElevations.some(selElv => Math.abs(startY - selElv) < 0.1);
                const matchesEnd = selectedElevations.some(selElv => Math.abs(endY - selElv) < 0.1);

                if (!matchesStart || !matchesEnd) return false;
            }

            return true;
        });

        const filteredElvMarkers = elvMarkers.filter(m => {
            if (selectedElevations.length > 0) {
                return selectedElevations.some(selElv => Math.abs(m.y - selElv) < 0.1);
            }
            return true;
        });

        return {
            componentLayouts: filteredLayouts,
            foundationMembers: filteredFoundationMembers,
            elvMarkers: filteredElvMarkers
        };
    }, [components, platformDetails, elevations, faces, selectedElevations, selectedFaces]);

    if (!isActivated) {
        return (
            <div className="w-full h-full min-h-[450px] relative rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 shadow-2xl flex flex-col items-center justify-center p-8 transition-all duration-500">
                <style>{`
                  @keyframes loading-bar {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                  }
                `}</style>
                {/* Technical Blueprint Grid Pattern background */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-30 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900/90 to-blue-950/40 pointer-events-none" />

                {isActivating ? (
                    /* SCANNING / TELEMETRY LOADING STATE */
                    <div className="relative z-10 flex flex-col items-center justify-center space-y-6 max-w-md text-center animate-in fade-in zoom-in duration-500">
                        {/* Scanning Hologram Ring */}
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-4 border-blue-500/10 border-t-blue-500 animate-spin" />
                            <div className="absolute inset-2 rounded-full border-4 border-indigo-500/10 border-b-indigo-500 animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
                            <Box className="w-10 h-10 text-blue-400 animate-pulse" />
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-sm font-black uppercase tracking-[0.25em] text-blue-400 animate-pulse flex items-center justify-center gap-2">
                                <Radio className="h-4 w-4 animate-ping text-blue-500" />
                                Connecting Telemetry
                            </h3>
                            <div className="flex flex-col gap-1 items-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse delay-100">
                                    Allocating WebGL Buffer...
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse delay-300">
                                    Parsing {components.length} Structural Nodes...
                                </span>
                            </div>
                        </div>

                        {/* Fake Progress Bar */}
                        <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden relative">
                            <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-500 animate-[loading-bar_1.2s_ease-in-out_infinite]" style={{ width: '60%' }} />
                        </div>
                    </div>
                ) : (
                    /* DEFER ACTIVATION / INITIAL PLACEHOLDER */
                    <div className="relative z-10 flex flex-col items-center justify-center space-y-8 max-w-xl text-center p-4">
                        {/* Top Decorative Tag */}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-400 uppercase tracking-[0.3em] shadow-sm shadow-blue-500/5 animate-pulse">
                            <Compass className="w-3.5 h-3.5 stroke-[2] text-blue-400 animate-[spin_8s_linear_infinite]" />
                            3D Modeling Utility Ready
                        </div>

                        {/* Title & Info */}
                        <div className="space-y-3">
                            <h2 className="text-2xl font-black uppercase tracking-tight text-white leading-none">
                                {platformDetails?.title || "INTERACTIVE PLATFORM"}
                            </h2>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider max-w-md mx-auto">
                                Run diagnostics, view elevations, and inspect structural jacket anodes/welds in interactive 3D.
                            </p>
                        </div>

                        {/* Telemetry Stats Grid */}
                        <div className="grid grid-cols-3 gap-6 w-full max-w-md py-4 px-6 rounded-2xl bg-slate-950/50 border border-slate-800/80 backdrop-blur-sm shadow-inner">
                            <div className="flex flex-col items-center justify-center text-center">
                                <span className="text-xl font-black text-blue-400 leading-none mb-1">
                                    {components.length}
                                </span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                    Assets
                                </span>
                            </div>
                            <div className="flex flex-col items-center justify-center text-center border-x border-slate-800/80">
                                <span className="text-xl font-black text-indigo-400 leading-none mb-1">
                                    {availableElevations.length}
                                </span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                    Elevations
                                </span>
                            </div>
                            <div className="flex flex-col items-center justify-center text-center">
                                <span className="text-xl font-black text-emerald-400 leading-none mb-1">
                                    {availableFaces.length}
                                </span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                    Faces
                                </span>
                            </div>
                        </div>

                        {/* Action Trigger Card */}
                        <button
                            onClick={handleActivate}
                            className="group relative flex flex-col items-center justify-center p-6 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:scale-[0.98] border border-blue-400/30 rounded-2xl shadow-lg hover:shadow-blue-500/20 transition-all duration-300 w-full max-w-sm overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-radial-gradient from-blue-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 border border-white/20 text-white mb-3 group-hover:scale-110 transition-transform duration-300 shadow-md">
                                <Play className="w-5 h-5 fill-current text-white stroke-[1.5]" />
                            </div>

                            <span className="relative z-10 text-xs font-black uppercase tracking-[0.25em] text-white">
                                Load 3D Platform Model
                            </span>
                            <span className="relative z-10 text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-1 opacity-80">
                                Click to initialize GPU rendering
                            </span>
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-slate-900 relative rounded-3xl overflow-hidden shadow-2xl">
            <Canvas gl={{ antialias: true }} dpr={[1, 2]}>
                <color attach="background" args={["#bce1f1"]} />
                <fog attach="fog" args={["#bce1f1", 50, 250]} />
                <PerspectiveCamera makeDefault position={[45, 45, 45]} fov={45} />
                <OrbitControls makeDefault minDistance={5} maxDistance={100} maxPolarAngle={Math.PI / 2} />

                <ambientLight intensity={1} />
                <hemisphereLight intensity={0.5} groundColor="#f0f9ff" />
                <pointLight position={[50, 50, 50]} intensity={1.5} />
                <spotLight position={[-50, 50, 50]} angle={0.3} penumbra={1} intensity={1.5} />

                <Bounds fit clip observe margin={1.0}>
                    <SelectToZoom>
                        {/* Elevation Markers */}
                        {elvMarkers.map((m, i) => (
                            <ElevationMarker key={i} y={m.y} label={m.label} />
                        ))}

                        {/* Foundation Members (Skeleton) */}
                        {foundationMembers.map((m) => (
                            <FoundationMember
                                key={m.id}
                                start={m.start}
                                end={m.end}
                                thickness={m.thickness}
                                color={m.color}
                                label={m.label}
                                showLabel={m.start[1] !== m.end[1]} // only show labels for vertical legs
                                renderMesh={m.renderMesh}
                            />
                        ))}

                        {/* Existing Components */}
                        {componentLayouts.map((layout) => (
                            <ComponentMesh
                                key={layout.component.id}
                                component={layout.component}
                                isSelected={selectedCompId === layout.component.id}
                                onClick={() => onSelectComponent(layout.component)}
                                start={layout.start}
                                end={layout.end}
                                thickness={layout.thickness}
                            />
                        ))}
                    </SelectToZoom>
                </Bounds>

                {/* Environment Planes - Outside Bounds to prevent zooming out */}
                {showWater && (
                    <group>
                        {/* Sea Surface plane at MSL (y=0) */}
                        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, waterSurfaceY, 0]} receiveShadow={false}>
                            <planeGeometry args={[2000, 2000]} />
                            <meshStandardMaterial color="#38bdf8" transparent opacity={0.35} metalness={0.6} roughness={0.2} depthWrite={false} />
                        </mesh>

                        {/* Seabed floor plane, positioned below lowest elevation */}
                        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, seabedY, 0]} receiveShadow={false}>
                            <planeGeometry args={[2000, 2000]} />
                            <meshStandardMaterial color="#78350f" transparent opacity={0.85} metalness={0.1} roughness={0.9} depthWrite={false} />
                        </mesh>

                        {/* Seabed label */}
                        <group position={[0, seabedY, 0]}>
                            <Html position={[35, 1, 0]} center distanceFactor={20}>
                                <div className="flex items-center gap-2">
                                    <div className="h-[1px] w-8 bg-amber-600/60" />
                                    <div className="px-2 py-0.5 bg-amber-900/80 backdrop-blur text-[9px] font-black text-amber-300 rounded border border-amber-600/40 shadow-lg whitespace-nowrap uppercase tracking-widest">
                                        Seabed · {seabedY.toFixed(1)}m
                                    </div>
                                </div>
                            </Html>
                        </group>

                        {/* Water line label at MSL */}
                        <group position={[0, waterSurfaceY, 0]}>
                            <Html position={[35, 1, 0]} center distanceFactor={20}>
                                <div className="flex items-center gap-2">
                                    <div className="h-[1px] w-8 bg-sky-400/60" />
                                    <div className="px-2 py-0.5 bg-sky-900/80 backdrop-blur text-[9px] font-black text-sky-300 rounded border border-sky-500/40 shadow-lg whitespace-nowrap uppercase tracking-widest">
                                        MSL · 0.0m
                                    </div>
                                </div>
                            </Html>
                        </group>
                    </group>
                )}

                {showGrid && (
                    <Grid
                        infiniteGrid
                        fadeDistance={250}
                        sectionSize={10}
                        sectionColor="#451a03"
                        cellColor="#78350f"
                        cellThickness={0.8}
                        sectionThickness={1.2}
                        position={[0, seabedY + 0.1, 0]}
                    />
                )}

                <ContactShadows
                    resolution={256}
                    scale={150}
                    blur={2}
                    opacity={0.1}
                    far={40}
                    color="#1e293b"
                />
            </Canvas>

            {/* UI Overlay */}
            <div className="absolute bottom-6 left-6 flex flex-col gap-1 pointer-events-none">
                <div className="flex items-center gap-2 mb-2">
                    <div className="px-2 py-1 bg-white/80 backdrop-blur rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">Click component for details</span>
                    </div>
                    <div className="px-2 py-1 bg-white/80 backdrop-blur rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">Double-click to focus</span>
                    </div>
                </div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Left: Orbit | Right: Pan | Scroll: Zoom</span>
            </div>

            {/* Click-outside backdrop */}
            {openDropdown && (
                <div
                    className="absolute inset-0 z-40 cursor-default bg-transparent"
                    onClick={() => setOpenDropdown(null)}
                />
            )}

            <div className="absolute top-6 right-6 flex items-center gap-3 z-50">
                {/* Elevation Filter */}
                <div className="relative">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenDropdown(openDropdown === "elevation" ? null : "elevation")}
                        className={cn(
                            "bg-white/90 backdrop-blur-md h-9 px-4 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest",
                            selectedElevations.length > 0 ? "border-blue-400 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.15)]" : "border-slate-200 text-slate-500"
                        )}
                    >
                        Elevation {selectedElevations.length > 0 ? `(${selectedElevations.length})` : ""} ▼
                    </Button>

                    {openDropdown === "elevation" && (
                        <div className="absolute right-0 mt-2 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl p-4 w-56 flex flex-col gap-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Elevation</span>
                                {selectedElevations.length > 0 && (
                                    <button
                                        onClick={() => setSelectedElevations([])}
                                        className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto py-1">
                                {availableElevations.map((elv) => {
                                    const isChecked = selectedElevations.includes(elv);
                                    return (
                                        <label key={elv} className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-lg cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {
                                                    if (isChecked) {
                                                        setSelectedElevations(selectedElevations.filter(e => e !== elv));
                                                    } else {
                                                        setSelectedElevations([...selectedElevations, elv]);
                                                    }
                                                }}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                            />
                                            <span className="text-xs font-bold text-slate-700">{elv.toFixed(3)}m</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Face Filter */}
                <div className="relative">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenDropdown(openDropdown === "face" ? null : "face")}
                        className={cn(
                            "bg-white/90 backdrop-blur-md h-9 px-4 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest",
                            selectedFaces.length > 0 ? "border-blue-400 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.15)]" : "border-slate-200 text-slate-500"
                        )}
                    >
                        Face {selectedFaces.length > 0 ? `(${selectedFaces.length})` : ""} ▼
                    </Button>

                    {openDropdown === "face" && (
                        <div className="absolute right-0 mt-2 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl p-4 w-48 flex flex-col gap-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Face</span>
                                {selectedFaces.length > 0 && (
                                    <button
                                        onClick={() => setSelectedFaces([])}
                                        className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto py-1">
                                {availableFaces.map((face) => {
                                    const isChecked = selectedFaces.includes(face);
                                    return (
                                        <label key={face} className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-lg cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {
                                                    if (isChecked) {
                                                        setSelectedFaces(selectedFaces.filter(f => f !== face));
                                                    } else {
                                                        setSelectedFaces([...selectedFaces, face]);
                                                    }
                                                }}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                            />
                                            <span className="text-xs font-bold text-slate-700">{face}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowWater(!showWater)}
                    className={cn(
                        "bg-white/90 backdrop-blur-md h-9 px-4 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest",
                        showWater ? "border-sky-300 text-sky-600 shadow-[0_0_15px_rgba(14,165,233,0.15)]" : "border-slate-200 text-slate-400"
                    )}
                >
                    {showWater ? "Water: ON" : "Water: OFF"}
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowGrid(!showGrid)}
                    className={cn(
                        "bg-white/90 backdrop-blur-md h-9 px-4 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest",
                        showGrid ? "border-blue-200 text-blue-600" : "border-slate-200 text-slate-400"
                    )}
                >
                    {showGrid ? "Grid: ON" : "Grid: OFF"}
                </Button>

                <div className="bg-white/90 backdrop-blur-md h-9 px-4 rounded-xl border border-blue-100 shadow-lg flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{components.length} Assets Rendered</span>
                </div>
            </div>
        </div>
    );
}
