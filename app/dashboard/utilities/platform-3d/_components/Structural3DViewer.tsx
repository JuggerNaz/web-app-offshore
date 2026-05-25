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
    thickness = 0.3,
    showWeldLabels = false
}: { 
    component: Component3D; 
    isSelected: boolean; 
    onClick: () => void;
    start: [number, number, number];
    end: [number, number, number];
    thickness?: number;
    showWeldLabels?: boolean;
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
    const length = startVec.distanceTo(endVec);
    const position = startVec.clone().add(endVec).multiplyScalar(0.5);
    const direction = endVec.clone().sub(startVec).normalize();
    
    // Scale thickness based on type
    let baseThickness = thickness;
    if (isAnode) baseThickness = 0.15;
    else if (isClamp) baseThickness = thickness * 1.8;
    else if (isWeld) {
        baseThickness = thickness * 1.15;
        if (baseThickness < 0.25) {
            baseThickness = component.metadata?.s_leg ? 0.55 : 0.3;
        }
    }
    const meshLength = isAnode ? 0.8 : isClamp ? 0.8 : isWeld ? 1.2 : length;

    const quaternion = new THREE.Quaternion();
    if (length > 0.001) {
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    }
    const euler = new THREE.Euler().setFromQuaternion(quaternion);

    // Zoom-based visibility logic removed as per user request
    // Labels now only show on hover or selection, or persistent weld labels if toggled
    const showLabel = hovered || isSelected || (showWeldLabels && isWeld);
    
    let labelText = component.q_id;
    if (isWeld) {
        const match = component.q_id.match(/WN\s*N?([A-Za-z0-9]+)/i) || component.q_id.match(/N?([A-Za-z0-9]+)/);
        if (match) {
            labelText = match[1];
        }
    }
    
    // Offset anodes from the center of the member so they sit on the surface
    const offsetPos = isAnode ? [0.4, 0, 0] : [0, 0, 0];

    return (
        <group position={[position.x, position.y, position.z]} rotation={[euler.x, euler.y, euler.z]}>
            <group position={offsetPos as [number, number, number]}>
                {/* Visual Mesh */}
                <mesh castShadow receiveShadow>
                {isNode || (length <= 0.001 && !isAnode && !isWeld) ? (
                    <sphereGeometry args={[thickness * 1.5, 16, 16]} />
                ) : isAnode ? (
                    <boxGeometry args={[0.2, meshLength, 0.2]} />
                ) : isClamp ? (
                    <boxGeometry args={[baseThickness, 0.8, baseThickness]} />
                ) : (
                    <cylinderGeometry args={[baseThickness, baseThickness, meshLength, 12]} />
                )}
                <meshStandardMaterial 
                    color={isSelected ? "#2563eb" : hovered ? "#3b82f6" : isAnode ? "#f97316" : isWeld ? "#d946ef" : isClamp ? "#b45309" : "#94a3b8"} 
                    metalness={0.7}
                    roughness={0.3}
                    emissive={isSelected ? "#3b82f6" : isAnode ? "#ea580c" : isWeld ? "#c026d3" : "#000000"}
                    emissiveIntensity={isSelected ? 0.5 : hovered ? 0.2 : 0}
                />
                <Edges 
                    threshold={15} 
                    color={isSelected ? "#ffffff" : hovered ? "#ffffff" : "#475569"} 
                />
                {isClamp && (
                    <mesh position={[0, 0, 0]}>
                        <boxGeometry args={[baseThickness + 0.4, 0.6, 0.05]} />
                        <meshStandardMaterial color="#b45309" metalness={0.8} />
                    </mesh>
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
                    <sphereGeometry args={[thickness * 2, 8, 8]} />
                ) : isAnode ? (
                    <boxGeometry args={[0.5, meshLength + 0.2, 0.5]} />
                ) : (
                    <cylinderGeometry args={[baseThickness + 0.3, baseThickness + 0.3, isWeld ? meshLength + 0.5 : length + 0.5, 8]} />
                )}
                <meshBasicMaterial transparent opacity={0} />
            </mesh>

            {showLabel && (
                <Html distanceFactor={15} position={[0, (isAnode || isWeld ? meshLength : length) / 2 + 0.5, 0]} center>
                    <div 
                        className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest whitespace-nowrap border pointer-events-none transition-all shadow-xl ${
                            isSelected 
                                ? "bg-blue-600 text-white border-blue-400 scale-110 opacity-100" 
                                : isWeld && showWeldLabels
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
    const length = startVec.distanceTo(endVec);
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
                <mesh castShadow receiveShadow>
                    <cylinderGeometry args={[thickness, thickness, length, 8]} />
                    <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} transparent opacity={0.4} />
                </mesh>
            )}
            {showLabel && label && (
                <Html distanceFactor={20} position={[0, length / 2 + 1, 0]} center>
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
    components, 
    platformDetails,
    elevations = [],
    faces = [],
    selectedCompId, 
    onSelectComponent 
}: Structural3DViewerProps) {
    const [showGrid, setShowGrid] = useState(true);
    const [showWeldLabels, setShowWeldLabels] = useState(false);
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

    const availableFaces = useMemo(() => {
        return faces.map(f => f.face).filter(Boolean);
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
            }
        });

        const isD21JT = platformDetails?.title?.toUpperCase().includes('D21JT') || false;

        const getLegCoordsAtElv = (legName: string, yVal: number) => {
            const key = legName.toUpperCase();
            if (isD21JT) {
                const L = 13.91 - 0.12489 * (yVal - 2.872);
                const W = 12.45 - 0.16665 * (yVal - 2.872);
                
                if (key === 'A1') return { x: -L/2, z: W/2 };
                if (key === 'B1') return { x: L/2, z: W/2 };
                if (key === 'A2') return { x: -L/2, z: -W/2 };
                if (key === 'B2') return { x: L/2, z: -W/2 };
            }
            if (legMap[key]) {
                return legMap[key];
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
        
        components.forEach(c => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            const isPrimary = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM", "LG", "LEG", "WN", "CF", "CG", "CD", "CO", "CA"].includes(code);
            
            const processNode = (nodeName: string | undefined, legName: string | undefined, elv: string | undefined) => {
                if (!nodeName || nodeMap.has(nodeName)) return;
                
                let x = 0, y = 0, z = 0;
                
                // Determine vertical coordinate (elevation) first
                if (elv) {
                    y = sanitizeElevation(elv);
                } else if (md.depth) {
                    y = -sanitizeElevation(md.depth) / 10 || 0;
                }
                
                // Determine base horizontal coordinates
                const legKey = legName?.toUpperCase();
                if (legKey) {
                    const coords = getLegCoordsAtElv(legKey, y);
                    x = coords.x;
                    z = coords.z;
                    nodeLegMap.set(nodeName, legKey);
                } else if (md.easting || md.northing) {
                    x = parseFloat(md.easting || "0") / 100 || 0;
                    z = parseFloat(md.northing || "0") / 100 || 0;
                }
                
                // Only apply distance/clock position offsets for non-primary components (like clamps/anodes)
                // and only if the distance is small (e.g. less than 3 meters)
                if (md.dist && !isPrimary) {
                    const distance = parseFloat(md.dist);
                    if (distance < 3.0) {
                        const clockPos = parseFloat(md.clk_pos || "12");
                        const angle = (clockPos / 12) * Math.PI * 2;
                        x += Math.sin(angle) * distance;
                        z += Math.cos(angle) * distance;
                    }
                }
                
                nodeMap.set(nodeName, new THREE.Vector3(x, y, z));
            };

            processNode(md.s_node, md.s_leg, md.elv_1);
            processNode(md.f_node, md.f_leg, md.elv_2);
        });

        // 5. Resolve Structural Layouts for components
        const intermediateLayouts = new Map<number, { component: any, start: THREE.Vector3, end: THREE.Vector3, thickness: number }>();
        const pendingAttachments: typeof components = [];

        components.forEach((c, i) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            
            let thickness = 0.15;
            if (code.includes("LG")) thickness = 0.5;
            else if (code.includes("HM") || code.includes("HD")) thickness = 0.25;
            else if (code.includes("VM") || code.includes("VD")) thickness = 0.20;
            else if (code === "CO" || code === "CA" || code.includes("COND") || code.includes("CAIS")) thickness = 0.35;

            const hasStartNode = md.s_node && nodeMap.has(md.s_node);
            const hasEndNode = md.f_node && nodeMap.has(md.f_node);

            let start = new THREE.Vector3();
            let end = new THREE.Vector3();
            let resolved = false;

            if (hasStartNode || hasEndNode) {
                if (hasStartNode) start.copy(nodeMap.get(md.s_node)!);
                if (hasEndNode) end.copy(nodeMap.get(md.f_node)!);
                
                if (hasStartNode && !hasEndNode) end.copy(start);
                else if (!hasStartNode && hasEndNode) start.copy(end);
                
                resolved = true;
            } else if (md.associated_comp_id) {
                pendingAttachments.push(c);
                return; // Skip to next, resolve in Pass 2
            } else if (md.s_leg) {
                const y = sanitizeElevation(md.elv_1 || (md.depth ? -parseFloat(md.depth)/10 : 0));
                const coords = getLegCoordsAtElv(md.s_leg, y);
                start.set(coords.x, y, coords.z);
                end.copy(start);
                resolved = true;
            } else if (md.easting || md.northing) {
                // Vertical drops (conductors, caissons)
                const x = parseFloat(md.easting || "0") / 100 || 0;
                const z = parseFloat(md.northing || "0") / 100 || 0;
                start.set(x, maxElv + 2, z);
                end.set(x, minElv, z);
                resolved = true;
            }

            if (!resolved) {
                // Fallback circle for components with absolutely no location data
                const layer = Math.floor(i / 16);
                const posInLayer = i % 16;
                const radius = 20 + layer * 2;
                const angle = (posInLayer / 16) * Math.PI * 2;
                start.set(Math.cos(angle) * radius, -layer * 4, Math.sin(angle) * radius);
                end.set(start.x, start.y + 4, start.z);
            }

            intermediateLayouts.set(c.id, { component: c, start, end, thickness });
        });

        // Pass 2: Resolve attachments relative to their parents
        pendingAttachments.forEach((c, index) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            let thickness = 0.15;
            
            const parentId = md.associated_comp_id;
            const parentLayout = intermediateLayouts.get(parentId);
            
            let start = new THREE.Vector3();
            let end = new THREE.Vector3();

            if (parentLayout) {
                const { start: pStart, end: pEnd } = parentLayout;
                thickness = parentLayout.thickness; // Inherit parent thickness for proper relative scaling
                start.copy(pStart).add(pEnd).multiplyScalar(0.5); // Midpoint default
                
                if (md.depth || md.elv_1) {
                    const targetY = sanitizeElevation(md.elv_1 || (-parseFloat(md.depth) / 10));
                    if (Math.abs(pEnd.y - pStart.y) > 0.001) {
                        const t = (targetY - pStart.y) / (pEnd.y - pStart.y);
                        const clampedT = Math.max(0, Math.min(1, t));
                        start.copy(pStart).lerp(pEnd, clampedT);
                    } else {
                        start.setY(targetY); // Parent is horizontal, just match Y
                    }
                }
                
                // Preserve parent direction so the attachment aligns parallel to the parent
                const direction = pEnd.clone().sub(pStart).normalize();
                if (direction.lengthSq() > 0.1) {
                    end.copy(start).add(direction.multiplyScalar(0.1));
                } else {
                    end.copy(start);
                }
            } else {
                // Parent not found in rendering context, fallback to circle
                const layer = Math.floor(index / 16);
                const radius = 25 + layer * 2;
                const angle = (index / 16) * Math.PI * 2;
                start.set(Math.cos(angle) * radius, maxElv, Math.sin(angle) * radius);
                end.copy(start);
            }
            
            intermediateLayouts.set(c.id, { component: c, start, end, thickness });
        });

        const resolvedLayouts = Array.from(intermediateLayouts.values()).map(layout => ({
            component: layout.component,
            start: [layout.start.x, layout.start.y, layout.start.z] as [number, number, number],
            end: [layout.end.x, layout.end.y, layout.end.z] as [number, number, number],
            thickness: layout.thickness
        }));

        const getComponentLegs = (comp: any) => {
            const compMd = comp.metadata || {};
            const sLeg = (compMd.s_leg || nodeLegMap.get(compMd.s_node) || "").toUpperCase();
            const fLeg = (compMd.f_leg || nodeLegMap.get(compMd.f_node) || "").toUpperCase();
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
                
                const matchesStart = selectedElevations.some(selElv => Math.abs(startY - selElv) < 0.1);
                const matchesEnd = selectedElevations.some(selElv => Math.abs(endY - selElv) < 0.1);
                
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
                const legName = m.label;
                if (selectedFaces.length > 0) {
                    const matchesFace = selectedFaces.some(faceName => {
                        const faceObj = faces.find(f => f.face?.toUpperCase() === faceName.toUpperCase());
                        if (faceObj) {
                            return faceObj.face_from?.toUpperCase() === legName.toUpperCase() || 
                                   faceObj.face_to?.toUpperCase() === legName.toUpperCase();
                        }
                        return false;
                    });
                    if (!matchesFace) return false;
                }
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
        <div className="w-full h-full bg-blue-50 relative rounded-3xl overflow-hidden border border-blue-100 shadow-2xl">
            <Canvas shadows gl={{ antialias: true }} dpr={[1, 2]}>
                <color attach="background" args={["#f8fafc"]} />
                <PerspectiveCamera makeDefault position={[45, 45, 45]} fov={45} />
                <OrbitControls makeDefault minDistance={2} maxDistance={500} />
                
                <ambientLight intensity={1} />
                <hemisphereLight intensity={0.5} groundColor="#f0f9ff" />
                <pointLight position={[50, 50, 50]} intensity={1.5} castShadow />
                <spotLight position={[-50, 50, 50]} angle={0.3} penumbra={1} intensity={1.5} castShadow />
                
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
                                    showWeldLabels={showWeldLabels}
                                />
                        ))}
                    </SelectToZoom>
                </Bounds>

                {/* Environment Planes - Outside Bounds to prevent zooming out */}
                <group>
                    {/* Sea Surface */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                        <planeGeometry args={[1000, 1000]} />
                        <meshStandardMaterial color="#0ea5e9" transparent opacity={0.15} metalness={0.8} roughness={0.1} />
                    </mesh>

                    {/* Seabed */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -50, 0]} receiveShadow>
                        <planeGeometry args={[1000, 1000]} />
                        <meshStandardMaterial color="#b45309" transparent opacity={0.1} metalness={0.1} roughness={0.9} />
                    </mesh>
                </group>

                {showGrid && (
                    <Grid 
                        infiniteGrid 
                        fadeDistance={150} 
                        sectionSize={10} 
                        sectionColor="#94a3b8" 
                        cellColor="#cbd5e1" 
                        cellThickness={1}
                        sectionThickness={1.5}
                        position={[0, 0, 0]}
                    />
                )}
                
                <ContactShadows 
                    resolution={1024} 
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
                    onClick={() => setShowGrid(!showGrid)}
                    className={cn(
                        "bg-white/90 backdrop-blur-md h-9 px-4 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest",
                        showGrid ? "border-blue-200 text-blue-600" : "border-slate-200 text-slate-400"
                    )}
                >
                    {showGrid ? "Grid: ON" : "Grid: OFF"}
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowWeldLabels(!showWeldLabels)}
                    className={cn(
                        "bg-white/90 backdrop-blur-md h-9 px-4 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest",
                        showWeldLabels ? "border-orange-200 text-orange-600 shadow-[0_0_15px_rgba(249,115,22,0.15)]" : "border-slate-200 text-slate-400"
                    )}
                >
                    {showWeldLabels ? "Weld Labels: ON" : "Weld Labels: OFF"}
                </Button>

                <div className="bg-white/90 backdrop-blur-md h-9 px-4 rounded-xl border border-blue-100 shadow-lg flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{components.length} Assets Rendered</span>
                </div>
            </div>
        </div>
    );
}
