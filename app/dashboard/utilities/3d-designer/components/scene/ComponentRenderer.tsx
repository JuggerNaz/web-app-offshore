"use client";

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';
import { useSceneStore } from '../../store/useSceneStore';
import { useEditorStore } from '../../store/useEditorStore';
import { GeometryFactory } from '../../core/GeometryFactory';

export function ComponentRenderer() {
  const components = useSceneStore((state) => state.components);
  const updateComponent = useSceneStore((state) => state.updateComponent);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);
  const activeTool = useEditorStore((state) => state.activeTool);
  
  const factory = useMemo(() => GeometryFactory.getInstance(), []);

  // We maintain refs to all meshes to attach TransformControls
  const meshRefs = useRef<Record<string, THREE.Mesh>>({});

  return (
    <>
      {Object.values(components).map((comp) => {
        const isSelected = selectedIds.includes(comp.id);
        const geometry = factory.getGeometry(comp.shape, comp.properties);
        const material = isSelected ? factory.highlightMaterial : factory.defaultMaterial;

        return (
          <group key={comp.id}>
            <mesh
              ref={(el) => {
                if (el) meshRefs.current[comp.id] = el;
              }}
              geometry={geometry}
              material={material}
              position={comp.transform.position}
              rotation={comp.transform.rotation}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIds([comp.id]);
              }}
            />
            {isSelected && activeTool === 'SELECT' && (
              <TransformControls
                object={meshRefs.current[comp.id]}
                mode="translate" // Can be switched to 'rotate' via top toolbar later
                onMouseUp={() => {
                  // When user finishes dragging, save the new position to the store
                  const mesh = meshRefs.current[comp.id];
                  if (mesh) {
                    updateComponent(comp.id, {
                      transform: {
                        position: [mesh.position.x, mesh.position.y, mesh.position.z],
                        rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z]
                      }
                    });
                  }
                }}
              />
            )}
          </group>
        );
      })}
    </>
  );
}
