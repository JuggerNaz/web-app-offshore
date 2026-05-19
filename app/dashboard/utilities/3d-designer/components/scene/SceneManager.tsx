"use client";

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { ComponentRenderer } from './ComponentRenderer';
import { PlacementGhost } from './PlacementGhost';
import { useEditorStore } from '../../store/useEditorStore';

export function SceneManager() {
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      
      {/* 
        A subtle environment map helps with PBR material reflections 
        making the "CAD" feel more realistic.
      */}
      <Environment preset="city" />

      {/* Grid Helper - configured to look like engineering graph paper */}
      <Grid 
        infiniteGrid 
        fadeDistance={50} 
        sectionColor="#444444"
        cellColor="#222222"
        sectionSize={5}
        cellSize={1}
      />

      {/* Controls */}
      <OrbitControls makeDefault />

      {/* 
        Invisible floor plane for un-selecting items when clicking empty space 
        and for raycasting in Phase 4.
      */}
      <mesh 
        name="floorPlane"
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.01, 0]} 
        visible={false}
        onPointerMissed={(e) => {
          if (e.type === 'click') {
            setSelectedIds([]);
          }
        }}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Render the actual structures */}
      <ComponentRenderer />
      
      {/* Render the placement ghost */}
      <PlacementGhost />
    </>
  );
}
