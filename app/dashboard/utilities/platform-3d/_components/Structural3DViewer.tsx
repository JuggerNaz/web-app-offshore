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
    selectedCompId?: number;
    onSelectComponent: (component: Component3D) => void;
}

const ComponentMesh = ({ 
    component, 
    isSelected, 
    onClick,
    position,
    rotation,
    scale = [1, 1, 1]
}: { 
    component: Component3D; 
    isSelected: boolean; 
    onClick: () => void;
    position: [number, number, number];
    rotation: [number, number, number];
    scale?: [number, number, number];
}) => {
    const [hovered, setHovered] = useState(false);
    
    // Determine shape based on component code
    const code = (component.code || "").toUpperCase();
    const isNode = code.includes("NODE") || component.q_id.includes("NODE") || code === "ND";
    
    return (
        <group position={position} rotation={rotation} scale={scale}>
            {/* Visual Mesh */}
            <mesh castShadow receiveShadow>
                {isNode ? (
                    <sphereGeometry args={[0.3, 16, 16]} />
                ) : (
                    <cylinderGeometry args={[0.15, 0.15, 1, 12]} />
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
                    thickness={isSelected ? 2 : 0.5}
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
                {isNode ? (
                    <sphereGeometry args={[0.5, 8, 8]} />
                ) : (
                    <cylinderGeometry args={[0.3, 0.3, 1.1, 8]} />
                )}
                <meshBasicMaterial transparent opacity={0} />
            </mesh>

            {(hovered || isSelected) && (
                <Html distanceFactor={15} position={[0, 0.8, 0]} center>
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
    selectedCompId, 
    onSelectComponent 
}: Structural3DViewerProps) {
    const [showGrid, setShowGrid] = useState(true);
    
    const componentLayouts = useMemo(() => {
        // This is a simplified procedural structural assembly
        // In a real scenario, this would use Easting/Northing/Depth coordinates
        return components.map((c, i) => {
            const md = c.metadata || {};
            
            // Try to extract coordinates
            let x = parseFloat(md.easting || "0") / 100 || 0;
            let y = parseFloat(md.northing || "0") / 100 || 0;
            let z = -parseFloat(md.depth || md.elv_1 || "0") / 10 || 0;

            // If no coordinates, do a procedural layout (tower-like)
            if (x === 0 && y === 0 && z === 0) {
                const layer = Math.floor(i / 16);
                const posInLayer = i % 16;
                const radius = 5 + layer * 0.5;
                const angle = (posInLayer / 16) * Math.PI * 2;
                x = Math.cos(angle) * radius;
                y = Math.sin(angle) * radius;
                z = -layer * 4;
            }

            // Determine rotation for members (simplified)
            const rotation: [number, number, number] = [0, 0, 0];
            const code = (c.code || "").toUpperCase();
            if (code.includes("VD") || code.includes("VM") || code.includes("LG")) {
                // Vertical members
            } else if (code.includes("HD") || code.includes("HM")) {
                rotation[0] = Math.PI / 2;
            }

            return {
                component: c,
                position: [x, z, y] as [number, number, number],
                rotation,
                scale: [1, code.includes("HD") || code.includes("HM") ? 4 : 4, 1] as [number, number, number]
            };
        });
    }, [components]);

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
                                position={layout.position}
                                rotation={layout.rotation}
                                scale={layout.scale}
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
