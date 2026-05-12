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
    Float
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
    
    // Determine shape based on component code
    const code = (component.code || "").toUpperCase();
    const isNode = code.includes("NODE") || component.q_id.includes("NODE") || code === "ND";
    
    // calculate position, rotation, length
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);
    const length = startVec.distanceTo(endVec);
    const position = startVec.clone().add(endVec).multiplyScalar(0.5);
    
    const direction = endVec.clone().sub(startVec).normalize();
    // Default cylinder is along Y axis, set orientation
    const quaternion = new THREE.Quaternion();
    if (length > 0.001) {
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    }
    const euler = new THREE.Euler().setFromQuaternion(quaternion);

    return (
        <group position={[position.x, position.y, position.z]} rotation={[euler.x, euler.y, euler.z]}>
            {/* Visual Mesh */}
            <mesh castShadow receiveShadow>
                {isNode || length <= 0.001 ? (
                    <sphereGeometry args={[thickness * 1.5, 16, 16]} />
                ) : (
                    <cylinderGeometry args={[thickness, thickness, length, 12]} />
                )}
                <meshStandardMaterial 
                    color={isSelected ? "#2563eb" : hovered ? "#3b82f6" : "#94a3b8"} 
                    metalness={0.5}
                    roughness={0.5}
                    emissive={isSelected ? "#3b82f6" : "#000000"}
                    emissiveIntensity={isSelected ? 0.5 : 0}
                />
                <Edges 
                    threshold={15} 
                    color={isSelected ? "#ffffff" : hovered ? "#ffffff" : "#475569"} 
                />
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
                {isNode || length <= 0.001 ? (
                    <sphereGeometry args={[thickness * 2, 8, 8]} />
                ) : (
                    <cylinderGeometry args={[thickness * 2, thickness * 2, length + 0.5, 8]} />
                )}
                <meshBasicMaterial transparent opacity={0} />
            </mesh>

            {(hovered || isSelected) && (
                <Html distanceFactor={15} position={[0, length / 2 + 0.5, 0]} center>
                    <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest whitespace-nowrap border pointer-events-none transition-all shadow-xl ${
                        isSelected 
                            ? "bg-blue-600 text-white border-blue-400 scale-110" 
                            : "bg-white/90 text-blue-900 border-blue-200"
                    }`}>
                        {component.q_id}
                    </div>
                </Html>
            )}
        </group>
    );
};

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
    selectedCompId, 
    onSelectComponent 
}: Structural3DViewerProps) {
    const [showGrid, setShowGrid] = useState(true);
    
    const componentLayouts = useMemo(() => {
        // 1. Determine Leg Footprints from Platform Details
        const legMap: Record<string, { x: number, z: number }> = {};
        if (platformDetails) {
            for (let i = 1; i <= 20; i++) {
                const legName = platformDetails[`leg_t${i}`];
                if (legName && typeof legName === "string") {
                    // Try to parse typical naming convention e.g. "A1", "B2"
                    const match = legName.match(/([A-Za-z]+)(\d+)/);
                    let x = 0;
                    let z = 0;
                    if (match) {
                        const letter = match[1].toUpperCase();
                        const num = parseInt(match[2], 10);
                        // Convert Letter to column index (A=0, B=1, etc.)
                        const col = letter.charCodeAt(0) - 65;
                        const row = num - 1;
                        // Use a default visual spacing of 15 units (meters)
                        x = col * 15;
                        z = row * 15;
                    } else {
                        // Fallback sequential placement if naming is arbitrary
                        x = i * 5;
                        z = 0;
                    }
                    legMap[legName] = { x, z };
                }
            }
        }

        // 2. Build 3D Node Map using Legs and Elevations
        const nodeMap = new Map<string, THREE.Vector3>();
        
        components.forEach(c => {
            const md = c.metadata || {};
            
            const processNode = (nodeName: string | undefined, legName: string | undefined, elv: string | undefined) => {
                if (!nodeName || nodeMap.has(nodeName)) return;
                
                let x = 0, y = 0, z = 0;
                
                // Determine horizontal coordinates
                if (legName && legMap[legName]) {
                    x = legMap[legName].x;
                    z = legMap[legName].z;
                } else if (md.easting || md.northing) {
                    x = parseFloat(md.easting || "0") / 100 || 0;
                    z = parseFloat(md.northing || "0") / 100 || 0;
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

        // 3. Resolve Structural Layouts based on connections
        return components.map((c, i) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            
            let start = new THREE.Vector3();
            let end = new THREE.Vector3();
            
            // Determine thickness based on structural importance
            let thickness = 0.15;
            if (code.includes("LG")) thickness = 0.5;
            else if (code.includes("HM") || code.includes("HD")) thickness = 0.25;
            else if (code.includes("VM") || code.includes("VD")) thickness = 0.20;

            const hasStartNode = md.s_node && nodeMap.has(md.s_node);
            const hasEndNode = md.f_node && nodeMap.has(md.f_node);

            if (hasStartNode) {
                start.copy(nodeMap.get(md.s_node)!);
            }
            if (hasEndNode) {
                end.copy(nodeMap.get(md.f_node)!);
            }

            // Fallback for missing nodes (e.g., purely procedural or orphan components)
            if (!hasStartNode && !hasEndNode) {
                // Procedural scatter to prevent stacking at origin
                const layer = Math.floor(i / 16);
                const posInLayer = i % 16;
                const radius = 5 + layer * 0.5;
                const angle = (posInLayer / 16) * Math.PI * 2;
                start.set(Math.cos(angle) * radius, -layer * 4, Math.sin(angle) * radius);
                
                if (code.includes("HD") || code.includes("HM")) {
                    end.set(start.x + 5, start.y, start.z);
                } else {
                    end.set(start.x, start.y + 4, start.z);
                }
            } else if (hasStartNode && !hasEndNode) {
                // Points / Appurtenances
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
    }, [components, platformDetails]);

    return (
        <div className="w-full h-full bg-blue-50 relative rounded-3xl overflow-hidden border border-blue-100 shadow-2xl">
            <Canvas shadows gl={{ antialias: true }} dpr={[1, 2]}>
                <color attach="background" args={["#f8fafc"]} />
                <PerspectiveCamera makeDefault position={[30, 30, 30]} fov={45} />
                <OrbitControls makeDefault minDistance={2} maxDistance={500} />
                
                <ambientLight intensity={1} />
                <hemisphereLight intensity={0.5} groundColor="#f0f9ff" />
                <pointLight position={[50, 50, 50]} intensity={1.5} castShadow />
                <spotLight position={[-50, 50, 50]} angle={0.3} penumbra={1} intensity={1.5} castShadow />
                
                <Bounds fit clip observe margin={1.2}>
                    <SelectToZoom>
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
