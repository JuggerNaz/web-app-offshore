import * as THREE from 'three';
import { ComponentNode } from '../types/3d-designer';

export class SnapEngine {
  public static calculateSnap(
    ghostPosition: THREE.Vector3,
    ghostNodes: { id: string, localPos: [number, number, number] }[],
    sceneComponents: Record<string, ComponentNode>,
    snapRadius: number,
    ghostRotation?: [number, number, number]
  ): THREE.Vector3 | null {
    
    let closestTargetPos: THREE.Vector3 | null = null;
    let closestDistance = snapRadius;
    let matchingGhostNodeLocalRotated: THREE.Vector3 | null = null;

    const ghostEuler = ghostRotation 
      ? new THREE.Euler(...ghostRotation) 
      : new THREE.Euler(0, 0, 0);

    // We check every node of every placed component
    for (const comp of Object.values(sceneComponents)) {
      // Calculate world matrix of the placed component
      const compMatrix = new THREE.Matrix4();
      compMatrix.makeRotationFromEuler(new THREE.Euler(...comp.transform.rotation));
      compMatrix.setPosition(...comp.transform.position);

      const targetNodes = comp.nodes && comp.nodes.length > 0
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

      for (const targetNode of targetNodes) {
        const targetWorldPos = new THREE.Vector3(...targetNode.localPos).applyMatrix4(compMatrix);

        // Check against every node of the ghost
        for (const ghostNode of ghostNodes) {
          const ghostNodeLocalPos = new THREE.Vector3(...ghostNode.localPos);
          // Rotate the local position of the ghost node by ghost rotation
          const ghostNodeWorldPos = ghostNodeLocalPos.clone()
            .applyEuler(ghostEuler)
            .add(ghostPosition);

          const distance = ghostNodeWorldPos.distanceTo(targetWorldPos);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestTargetPos = targetWorldPos;
            matchingGhostNodeLocalRotated = ghostNodeLocalPos.clone().applyEuler(ghostEuler);
          }
        }
      }
    }

    if (closestTargetPos && matchingGhostNodeLocalRotated) {
      // Return the new required position of the ghost center 
      // so that matchingGhostNodeLocalRotated aligns with closestTargetPos
      return closestTargetPos.clone().sub(matchingGhostNodeLocalRotated);
    }

    return null; // No snap found
  }
}
