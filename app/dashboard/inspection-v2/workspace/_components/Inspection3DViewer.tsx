"use client";

import React, { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Grid,
  Html,
  ContactShadows,
  Edges,
} from "@react-three/drei";
import * as THREE from "three";

interface Component3D {
  id: number;
  name: string;
  depth?: string | number;
  startNode?: string;
  endNode?: string;
  raw?: {
    code?: string;
  };
}

interface Inspection3DViewerProps {
  componentsSow: Component3D[];
  componentsNonSow: Component3D[];
  selectedCompId?: number;
  onSelectComponent: (component: Component3D) => void;
}

const ComponentModel = ({
  component,
  isSelected,
  onClick,
  position,
}: {
  component: Component3D;
  isSelected: boolean;
  onClick: () => void;
  position: [number, number, number];
}) => {
  const [hovered, setHovered] = useState(false);

  // Determine shape based on component code
  const code = component.raw?.code?.toUpperCase() || "";
  const isNode = code.includes("NODE") || component.name.includes("NODE");

  return (
    <group position={position}>
      {/* Visual Mesh */}
      <mesh castShadow receiveShadow>
        {isNode ? (
          <sphereGeometry args={[0.4, 32, 32]} />
        ) : (
          <cylinderGeometry args={[0.2, 0.2, 2, 32]} />
        )}
        <meshStandardMaterial
          color={isSelected ? "#2563eb" : hovered ? "#3b82f6" : "#64748b"}
          metalness={0.6}
          roughness={0.4}
          emissive={isSelected ? "#3b82f6" : "#000000"}
          emissiveIntensity={isSelected ? 0.8 : 0}
          opacity={isSelected ? 1 : 0.9}
          transparent={!isSelected}
        />
        {/* Visible Edges for better definition */}
        <Edges
          scale={1.05}
          threshold={15}
          color={isSelected ? "#ffffff" : hovered ? "#ffffff" : "#1e293b"}
        />
      </mesh>

      {/* Invisible Hit Box (Larger for easier clicking) */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {isNode ? (
          <sphereGeometry args={[0.6, 16, 16]} />
        ) : (
          <cylinderGeometry args={[0.4, 0.4, 2.2, 16]} />
        )}
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Label on Hover or Selection */}
      {(hovered || isSelected) && (
        <Html distanceFactor={10} position={[0, 1.2, 0]} center>
          <div
            className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest whitespace-nowrap border pointer-events-none transition-all shadow-xl ${
              isSelected
                ? "bg-blue-600 text-white border-blue-400 scale-110"
                : "bg-white/90 text-blue-900 border-blue-200"
            }`}
          >
            {component.name}
          </div>
        </Html>
      )}

      {/* Selection Aura */}
      {isSelected && (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
            <ringGeometry args={[0.6, 0.8, 32]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
          <pointLight distance={3} intensity={5} color="#3b82f6" />
        </group>
      )}
    </group>
  );
};

export function Inspection3DViewer({
  componentsSow,
  componentsNonSow,
  selectedCompId,
  onSelectComponent,
}: Inspection3DViewerProps) {
  // Combine components for rendering
  const allComponents = useMemo(() => {
    return [...componentsSow, ...componentsNonSow];
  }, [componentsSow, componentsNonSow]);

  // Generate procedural positions if no real coordinates are provided
  const componentPositions = useMemo(() => {
    return allComponents.map((c, i) => {
      // Try to parse depth for Z axis
      let z = 0;
      if (c.depth) {
        const parsed = parseFloat(String(c.depth).replace(/[^0-9.-]/g, ""));
        if (!isNaN(parsed)) z = -parsed / 10; // Scale down depth
      }

      // Procedural X/Y for layout (forming a grid or jacket-like structure)
      const row = Math.floor(i / 4);
      const col = i % 4;
      const x = (col - 1.5) * 4;
      const y = (row - 1.5) * 4;

      return {
        component: c,
        position: [x, z, y] as [number, number, number],
      };
    });
  }, [allComponents]);

  return (
    <div className="w-full h-full bg-blue-50 relative rounded-lg overflow-hidden border border-blue-100 shadow-inner">
      <Canvas shadows gl={{ antialias: true }}>
        <color attach="background" args={["#f0f9ff"]} />

        <PerspectiveCamera makeDefault position={[20, 20, 20]} fov={45} />
        <OrbitControls makeDefault minDistance={5} maxDistance={150} />

        {/* Enhanced Lighting */}
        <ambientLight intensity={1.5} />
        <hemisphereLight intensity={0.5} groundColor="#f0f9ff" />
        <pointLight position={[20, 20, 20]} intensity={2} castShadow />
        <spotLight position={[-20, 20, 20]} angle={0.3} penumbra={1} intensity={2} castShadow />

        {/* Environment */}
        <Grid
          infiniteGrid
          fadeDistance={100}
          sectionSize={5}
          sectionColor="#bfdbfe"
          cellColor="#dbeafe"
          cellThickness={1}
          position={[0, -10, 0]}
        />

        {/* Components */}
        {componentPositions.map(({ component, position }) => (
          <ComponentModel
            key={component.id}
            component={component}
            isSelected={selectedCompId === component.id}
            onClick={() => onSelectComponent(component)}
            position={position}
          />
        ))}

        <ContactShadows
          resolution={1024}
          scale={100}
          blur={2.5}
          opacity={0.15}
          far={20}
          color="#1e3a8a"
        />
      </Canvas>

      {/* Controls Overlay */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1 pointer-events-none">
        <span className="text-[10px] font-black uppercase tracking-widest text-blue-900/40">
          3D Navigation
        </span>
        <span className="text-[9px] text-blue-800/50 font-bold">
          Rotate: Left Click | Pan: Right Click | Zoom: Scroll
        </span>
      </div>

      <div className="absolute top-4 right-4 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-blue-100 pointer-events-none flex items-center gap-2 shadow-sm">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-[11px] font-black text-blue-900 uppercase tracking-tight">
          {allComponents.length} Structures Mapped
        </span>
      </div>
    </div>
  );
}
