import * as THREE from 'three';
import { ComponentNode } from '../types/3d-designer';

export class SnapEngine {
  public static calculateSnap(
    ghostPosition: THREE.Vector3,
    ghostNodes: { id: string, localPos: [number, number, number] }[],
    sceneComponents: Record<string, ComponentNode>,
    snapRadius: number
  ): THREE.Vector3 | null {
    
    let closestTargetPos: THREE.Vector3 | null = null;
    let closestDistance = snapRadius;
    let matchingGhostNodeLocal: THREE.Vector3 | null = null;

    // We check every node of every placed component
    for (const comp of Object.values(sceneComponents)) {
      // Calculate world matrix of the placed component
      const compMatrix = new THREE.Matrix4();
      compMatrix.makeRotationFromEuler(new THREE.Euler(...comp.transform.rotation));
      compMatrix.setPosition(...comp.transform.position);

      for (const targetNode of comp.nodes) {
        const targetWorldPos = new THREE.Vector3(...targetNode.localPos).applyMatrix4(compMatrix);

        // Check against every node of the ghost
        for (const ghostNode of ghostNodes) {
          const ghostNodeLocalPos = new THREE.Vector3(...ghostNode.localPos);
          // Assuming ghost has no rotation during placement for simplicity right now
          const ghostNodeWorldPos = ghostNodeLocalPos.clone().add(ghostPosition);

          const distance = ghostNodeWorldPos.distanceTo(targetWorldPos);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestTargetPos = targetWorldPos;
            matchingGhostNodeLocal = ghostNodeLocalPos;
          }
        }
      }
    }

    if (closestTargetPos && matchingGhostNodeLocal) {
      // Return the new required position of the ghost center 
      // so that matchingGhostNodeLocal aligns with closestTargetPos
      return closestTargetPos.clone().sub(matchingGhostNodeLocal);
    }

    return null; // No snap found
  }
}
