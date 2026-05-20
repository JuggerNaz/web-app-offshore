"use client";

import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useEditorStore } from '../../store/useEditorStore';
import { GeometryFactory } from '../../core/GeometryFactory';
import { SnapEngine } from '../../core/SnapEngine';
import { useSceneStore } from '../../store/useSceneStore';
import { ComponentNode } from '../../types/3d-designer';

export function PlacementGhost() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const activeTool = useEditorStore((state) => state.activeTool);
  const placementGhost = useEditorStore((state) => state.placementGhost);
  const snapMode = useEditorStore((state) => state.snapMode);
  const settings = useEditorStore((state) => state.settings);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const setPlacementGhost = useEditorStore((state) => state.setPlacementGhost);
  const addComponent = useSceneStore((state) => state.addComponent);
  
  const { raycaster, camera, scene, pointer } = useThree();
  
  const factory = useMemo(() => GeometryFactory.getInstance(), []);
  const ghostMaterial = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: 0x4ade80, // green
    transparent: true,
    opacity: 0.5,
    roughness: 0.2
  }), []);

  // Update ghost position on mouse move
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (activeTool !== 'PLACE' || !placementGhost || !meshRef.current) return;
      
      const floor = scene.children.find((c) => c.name === 'floorPlane');
      if (!floor) return;

      const intersects = raycaster.intersectObject(floor);
      if (intersects.length > 0) {
        let point = intersects[0].point;
        
        let snapped = false;

        // Node Snapping Priority
        if (snapMode === 'NODE') {
          const ghostNodes = placementGhost.nodes && placementGhost.nodes.length > 0
            ? placementGhost.nodes
            : (placementGhost.shape === 'CYLINDER'
                ? [
                    { id: 'top', localPos: [0, (placementGhost.properties?.length || 5) / 2, 0] as [number, number, number] },
                    { id: 'bottom', localPos: [0, -(placementGhost.properties?.length || 5) / 2, 0] as [number, number, number] }
                  ]
                : (placementGhost.shape === 'BOX'
                    ? [
                        { id: 'top', localPos: [0, (placementGhost.properties?.height || 1) / 2, 0] as [number, number, number] },
                        { id: 'bottom', localPos: [0, -(placementGhost.properties?.height || 1) / 2, 0] as [number, number, number] },
                        { id: 'left', localPos: [-(placementGhost.properties?.width || 1) / 2, 0, 0] as [number, number, number] },
                        { id: 'right', localPos: [(placementGhost.properties?.width || 1) / 2, 0, 0] as [number, number, number] },
                        { id: 'front', localPos: [0, 0, (placementGhost.properties?.depth || 1) / 2] as [number, number, number] },
                        { id: 'back', localPos: [0, 0, -(placementGhost.properties?.depth || 1) / 2] as [number, number, number] }
                      ]
                    : [{ id: 'center', localPos: [0, 0, 0] as [number, number, number] }]));

          const sceneComponents = useSceneStore.getState().components;
          const snapOffset = SnapEngine.calculateSnap(point, ghostNodes, sceneComponents, settings.nodeSnapRadius || 1.5);
          
          if (snapOffset) {
            point = snapOffset;
            snapped = true;
          }
        }

        // Grid Snapping (if not node snapped)
        if (!snapped && snapMode === 'GRID') {
          const s = settings.gridSnap;
          point.x = Math.round(point.x / s) * s;
          point.y = Math.round(point.y / s) * s;
          point.z = Math.round(point.z / s) * s;
        }

        meshRef.current.position.copy(point);
      }
    };

    // We attach to window to catch moves over the whole canvas
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [activeTool, placementGhost, snapMode, settings, raycaster, scene]);

  // Handle Placement Click
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      // Only left click, and only if tool is PLACE
      if (e.button !== 0 || activeTool !== 'PLACE' || !placementGhost || !meshRef.current) return;
      
      // Prevent placing if clicking UI (we assume the canvas takes full space, but good to be careful)
      // The actual canvas click is handled better by R3F events on the floor, but we'll use a global listener here for simplicity
      // and checking if we actually hit the floor.
      const floor = scene.children.find((c) => c.name === 'floorPlane');
      if (!floor) return;

      const intersects = raycaster.intersectObject(floor);
      if (intersects.length > 0) {
        // Determine component ID (use QID if available, fallback to code or random ID, ensuring uniqueness)
        const qid = placementGhost.sourceData?.q_id || placementGhost.sourceData?.qid || placementGhost.sourceData?.code || placementGhost.sourceData?.component_name;
        const baseId = qid ? String(qid).trim() : `comp_${Math.random().toString(36).substr(2, 9)}`;
        
        let newId = baseId;
        let counter = 1;
        const existingComponents = useSceneStore.getState().components;
        while (existingComponents[newId]) {
          newId = `${baseId}_${counter}`;
          counter++;
        }
        
        const newComponent: ComponentNode = {
          id: newId,
          type: placementGhost.type,
          shape: placementGhost.shape,
          properties: { ...placementGhost.properties },
          transform: {
            position: [meshRef.current.position.x, meshRef.current.position.y, meshRef.current.position.z],
            rotation: [0, 0, 0]
          },
          nodes: placementGhost.nodes ? [...placementGhost.nodes] : [],
          sourceData: placementGhost.sourceData
        };
        
        addComponent(newComponent);
        
        // Reset tool to select after placing
        setActiveTool('SELECT');
        setPlacementGhost(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [activeTool, placementGhost, raycaster, scene, addComponent, setActiveTool, setPlacementGhost]);

  if (activeTool !== 'PLACE' || !placementGhost) return null;

  const geometry = factory.getGeometry(placementGhost.shape, placementGhost.properties);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={ghostMaterial}
      // Initial position far away until first pointer move
      position={[0, 9999, 0]} 
    />
  );
}
