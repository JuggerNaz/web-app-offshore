"use client";

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';
import { useSceneStore } from '../../store/useSceneStore';
import { useEditorStore } from '../../store/useEditorStore';
import { GeometryFactory } from '../../core/GeometryFactory';
import { SnapEngine } from '../../core/SnapEngine';

export function ComponentRenderer() {
  const components = useSceneStore((state) => state.components);
  const updateComponent = useSceneStore((state) => state.updateComponent);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);
  const activeTool = useEditorStore((state) => state.activeTool);
  const transformMode = useEditorStore((state) => state.transformMode);
  
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
                mode={transformMode}
                onChange={() => {
                  const mesh = meshRefs.current[comp.id];
                  if (!mesh) return;

                  // Only snap if we are translating (moving) the component
                  if (transformMode !== 'translate') return;

                  const snapMode = useEditorStore.getState().snapMode;
                  const settings = useEditorStore.getState().settings;

                  if (snapMode === 'NODE') {
                    // Filter out the selected component itself to avoid self-snapping
                    const otherComponents = { ...components };
                    delete otherComponents[comp.id];

                    // Resolve or generate ghost nodes for the dragged component
                    const ghostNodes = comp.nodes && comp.nodes.length > 0
                      ? comp.nodes
                      : (comp.shape === 'CYLINDER'
                          ? [
                              { id: 'top', localPos: [0, (comp.properties?.length || 5) / 2, 0] as [number, number, number] },
                              { id: 'bottom', localPos: [0, -(comp.properties?.length || 5) / 2, 0] as [number, number, number] }
                            ]
                          : (comp.shape === 'BOX'
                              ? [
                                  { id: 'top', localPos: [0, (comp.properties?.height || 1) / 2, 0] as [number, number, number] },
                                  { id: 'bottom', localPos: [0, -(comp.properties?.height || 1) / 2, 0] as [number, number, number] },
                                  { id: 'left', localPos: [-(comp.properties?.width || 1) / 2, 0, 0] as [number, number, number] },
                                  { id: 'right', localPos: [(comp.properties?.width || 1) / 2, 0, 0] as [number, number, number] },
                                  { id: 'front', localPos: [0, 0, (comp.properties?.depth || 1) / 2] as [number, number, number] },
                                  { id: 'back', localPos: [0, 0, -(comp.properties?.depth || 1) / 2] as [number, number, number] }
                                ]
                              : [{ id: 'center', localPos: [0, 0, 0] as [number, number, number] }]));

                    // Snap calculations (incorporates rotation of the mesh)
                    const snapPos = SnapEngine.calculateSnap(
                      mesh.position,
                      ghostNodes,
                      otherComponents,
                      settings.nodeSnapRadius || 1.5,
                      [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z]
                    );

                    if (snapPos) {
                      mesh.position.copy(snapPos);
                    }
                  } else if (snapMode === 'GRID') {
                    const gridSize = settings.gridSnap || 1;
                    mesh.position.x = Math.round(mesh.position.x / gridSize) * gridSize;
                    mesh.position.z = Math.round(mesh.position.z / gridSize) * gridSize;
                  }
                }}
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
