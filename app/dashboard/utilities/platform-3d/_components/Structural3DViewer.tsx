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
    const length = startVec.distanceTo(endVec);
    const position = startVec.clone().add(endVec).multiplyScalar(0.5);
    const direction = endVec.clone().sub(startVec).normalize();
    
    // Scale thickness based on type
    const baseThickness = isAnode ? 0.1 : isClamp ? thickness * 1.8 : thickness;
    const meshLength = isAnode ? Math.max(length, 1.5) : isClamp ? 0.8 : length;

    const quaternion = new THREE.Quaternion();
    if (length > 0.001) {
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    }
    const euler = new THREE.Euler().setFromQuaternion(quaternion);

    // Zoom-based visibility logic removed as per user request
    // Labels now only show on hover or selection
    const showLabel = hovered || isSelected;

    return (
        <group position={[position.x, position.y, position.z]} rotation={[euler.x, euler.y, euler.z]}>
            {/* Visual Mesh */}
            <mesh castShadow receiveShadow>
                {isNode || isWeld || length <= 0.001 ? (
                    <sphereGeometry args={[thickness * 1.5, 16, 16]} />
                ) : isAnode ? (
                    <boxGeometry args={[0.2, 0.2, meshLength]} />
                ) : isClamp ? (
                    <boxGeometry args={[baseThickness, 0.8, baseThickness]} />
                ) : (
                    <cylinderGeometry args={[baseThickness, baseThickness, meshLength, 12]} />
                )}
                <meshStandardMaterial 
                    color={isSelected ? "#2563eb" : hovered ? "#3b82f6" : isAnode ? "#f97316" : isClamp ? "#b45309" : "#94a3b8"} 
                    metalness={0.7}
                    roughness={0.3}
                    emissive={isSelected ? "#3b82f6" : isAnode ? "#ea580c" : "#000000"}
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
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                {isNode || isWeld || length <= 0.001 ? (
                    <sphereGeometry args={[thickness * 2, 8, 8]} />
                ) : (
                    <cylinderGeometry args={[thickness * 2, thickness * 2, length + 0.5, 8]} />
                )}
                <meshBasicMaterial transparent opacity={0} />
            </mesh>

            {showLabel && (
                <Html distanceFactor={15} position={[0, length / 2 + 0.5, 0]} center>
                    <div 
                        className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest whitespace-nowrap border pointer-events-none transition-all shadow-xl ${
                            isSelected 
                                ? "bg-blue-600 text-white border-blue-400 scale-110 opacity-100" 
                                : "bg-white/90 text-blue-900 border-blue-200"
                        }`}
                    >
                        {component.q_id}
                    </div>
                </Html>
            )}
        </group>
    );
};

const FoundationMember = ({ 
    start, 
    end, 
    thickness, 
    color, 
    label,
    showLabel = true
}: { 
    start: [number, number, number]; 
    end: [number, number, number]; 
    thickness: number; 
    color: string;
    label?: string;
    showLabel?: boolean;
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
            <mesh castShadow receiveShadow>
                <cylinderGeometry args={[thickness, thickness, length, 8]} />
                <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} transparent opacity={0.4} />
            </mesh>
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

        // 2. Determine Elevation Levels
        const elvValues = elevations.map(e => parseFloat(e.elv || "0")).sort((a, b) => b - a);
        const maxElv = elvValues.length > 0 ? Math.max(...elvValues) : 5;
        const minElv = elvValues.length > 0 ? Math.min(...elvValues) : -30;

        // 3. Generate Foundation Members (Legs and Rows)
        const foundationMembers: any[] = [];
        const elvMarkers: any[] = [];
        
        // Render Vertical Legs
        Object.entries(legMap).forEach(([name, pos]) => {
            foundationMembers.push({
                id: `leg-${name}`,
                start: [pos.x, maxElv + 5, pos.z], // Extend slightly above max
                end: [pos.x, minElv, pos.z],
                thickness: 0.8,
                color: "#94a3b8", // slate-400 (galvanized look)
                label: name
            });
        });

        // Render Horizontal Rows (Faces) at each elevation
        faces.forEach(face => {
            const fromPos = legMap[face.face_from?.toUpperCase()];
            const toPos = legMap[face.face_to?.toUpperCase()];
            
            if (fromPos && toPos) {
                elvValues.forEach((elv, idx) => {
                    foundationMembers.push({
                        id: `face-${face.face}-${idx}`,
                        start: [fromPos.x, elv, fromPos.z],
                        end: [toPos.x, elv, toPos.z],
                        thickness: 0.4,
                        color: "#64748b", // slate-500
                        label: face.face
                    });
                });
            }
        });

        // Generate Elevation Markers
        elevations.forEach(e => {
            elvMarkers.push({
                y: parseFloat(e.elv || "0"),
                label: `${e.elv}m`
            });
        });

        // 4. Build 3D Node Map for existing components
        const nodeMap = new Map<string, THREE.Vector3>();
        
        components.forEach(c => {
            const md = c.metadata || {};
            
            const processNode = (nodeName: string | undefined, legName: string | undefined, elv: string | undefined) => {
                if (!nodeName || nodeMap.has(nodeName)) return;
                
                let x = 0, y = 0, z = 0;
                
                // Determine base horizontal coordinates
                const legKey = legName?.toUpperCase();
                if (legKey && legMap[legKey]) {
                    x = legMap[legKey].x;
                    z = legMap[legKey].z;
                } else if (md.easting || md.northing) {
                    x = parseFloat(md.easting || "0") / 100 || 0;
                    z = parseFloat(md.northing || "0") / 100 || 0;
                }
                
                // Apply Distance and Clock Position Offsets
                if (md.dist) {
                    const distance = parseFloat(md.dist);
                    const clockPos = parseFloat(md.clk_pos || "12");
                    const angle = (clockPos / 12) * Math.PI * 2;
                    x += Math.sin(angle) * distance;
                    z += Math.cos(angle) * distance;
                }
                
                // Determine vertical coordinate (elevation)
                if (elv) {
                    y = parseFloat(elv);
                } else if (md.depth) {
                    y = -parseFloat(md.depth || "0") / 10 || 0;
                }
                
                nodeMap.set(nodeName, new THREE.Vector3(x, y, z));
            };

            processNode(md.s_node, md.s_leg, md.elv_1);
            processNode(md.f_node, md.f_leg, md.elv_2);
        });

        // 5. Resolve Structural Layouts for components
        const componentLayouts = components.map((c, i) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            
            let start = new THREE.Vector3();
            let end = new THREE.Vector3();
            
            let thickness = 0.15;
            if (code.includes("LG")) thickness = 0.5;
            else if (code.includes("HM") || code.includes("HD")) thickness = 0.25;
            else if (code.includes("VM") || code.includes("VD")) thickness = 0.20;

            const hasStartNode = md.s_node && nodeMap.has(md.s_node);
            const hasEndNode = md.f_node && nodeMap.has(md.f_node);

            if (hasStartNode) start.copy(nodeMap.get(md.s_node)!);
            if (hasEndNode) end.copy(nodeMap.get(md.f_node)!);

            if (!hasStartNode && !hasEndNode) {
                const layer = Math.floor(i / 16);
                const posInLayer = i % 16;
                const radius = 20 + layer * 2;
                const angle = (posInLayer / 16) * Math.PI * 2;
                start.set(Math.cos(angle) * radius, -layer * 4, Math.sin(angle) * radius);
                end.set(start.x, start.y + 4, start.z);
            } else if (hasStartNode && !hasEndNode) {
                end.copy(start);
            } else if (!hasStartNode && hasEndNode) {
                start.copy(end);
            }

            return {
                component: c,
                start: [start.x, start.y, start.z] as [number, number, number],
                end: [end.x, end.y, end.z] as [number, number, number],
                thickness
            };
        });

        return { componentLayouts, foundationMembers, elvMarkers };
    }, [components, platformDetails, elevations, faces]);

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

            <div className="absolute top-6 right-6 flex items-center gap-3">
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
