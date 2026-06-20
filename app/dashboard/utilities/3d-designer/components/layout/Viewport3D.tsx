"use client";

import { Canvas } from '@react-three/fiber';
import { SceneManager } from '../scene/SceneManager';

export function Viewport3D() {
  return (
    <div className="flex-1 relative bg-[#1a1a1a] overflow-hidden">
      <Canvas
        shadows
        camera={{ position: [15, 15, 15], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#1a1a1a']} />
        <SceneManager />
      </Canvas>
    </div>
  );
}
