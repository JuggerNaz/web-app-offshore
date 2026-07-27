import * as THREE from 'three';

export interface RiserGuardOptions {
  height?: number;
  width?: number;
  mainRadius?: number;
  braceRadius?: number;
  color?: string | number;
  isSelected?: boolean;
  isHovered?: boolean;
  localLeftTop?: THREE.Vector3;
  localRightTop?: THREE.Vector3;
  localLeftMid?: THREE.Vector3;
  localRightMid?: THREE.Vector3;
}

export class RiserGuard extends THREE.Group {
  constructor(options: RiserGuardOptions = {}) {
    super();
    this.name = 'RiserGuard';

    const height = options.height ?? 4.0;
    const width = options.width ?? 8.0;
    const mainRadius = options.mainRadius ?? 0.06;
    const braceRadius = options.braceRadius ?? 0.05;

    // Highlight colors on hover or selection
    let baseColorHex = options.color ?? '#cbd5e1';
    if (options.isSelected) {
      baseColorHex = '#f97316';
    } else if (options.isHovered) {
      baseColorHex = '#60a5fa';
    }

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseColorHex),
      metalness: 0.7,
      roughness: 0.3,
      emissive: options.isSelected ? new THREE.Color('#ea580c') : new THREE.Color('#000000'),
      emissiveIntensity: options.isSelected ? 0.6 : options.isHovered ? 0.1 : 0,
    });

    const addTube = (p1: THREE.Vector3, p2: THREE.Vector3, radius: number) => {
      const mesh = this.createTube(p1, p2, radius, material);
      this.add(mesh);
    };

    // 1. 12 Vertical Posts (evenly spaced along width)
    const numVerticalBars = 12;
    for (let i = 0; i < numVerticalBars; i++) {
      const x = -width / 2 + (i * width) / (numVerticalBars - 1);
      // Run from slightly below bottom rail to slightly above top rail
      const pStart = new THREE.Vector3(x, -height / 2 - 0.2, 0);
      const pEnd = new THREE.Vector3(x, height / 2 + 0.2, 0);
      addTube(pStart, pEnd, mainRadius);
    }

    // 2. 3 Horizontal Rails
    const yTop = height / 2;
    const yMid = height / 6;
    const yBot = -height / 2;

    addTube(new THREE.Vector3(-width / 2, yTop, 0), new THREE.Vector3(width / 2, yTop, 0), mainRadius);
    addTube(new THREE.Vector3(-width / 2, yMid, 0), new THREE.Vector3(width / 2, yMid, 0), mainRadius);
    addTube(new THREE.Vector3(-width / 2, yBot, 0), new THREE.Vector3(width / 2, yBot, 0), mainRadius);

    // 3. Support Brackets
    // Top-Left connection
    if (options.localLeftTop) {
      addTube(options.localLeftTop, new THREE.Vector3(-width / 2, yTop, 0), braceRadius);
    }
    // Top-Right connection
    if (options.localRightTop) {
      addTube(options.localRightTop, new THREE.Vector3(width / 2, yTop, 0), braceRadius);
    }
    // Middle-Left connection
    if (options.localLeftMid) {
      addTube(options.localLeftMid, new THREE.Vector3(-width / 2, yMid, 0), braceRadius);
    }
    // Middle-Right connection
    if (options.localRightMid) {
      addTube(options.localRightMid, new THREE.Vector3(width / 2, yMid, 0), braceRadius);
    }
  }

  /**
   * Procedural tube generator with edges outline
   */
  private createTube(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    radius: number,
    material: THREE.Material
  ): THREE.Mesh {
    const direction = new THREE.Vector3().subVectors(p2, p1);
    const length = direction.length();
    const safeLength = Math.max(length, 0.001);

    const geometry = new THREE.CylinderGeometry(radius, radius, safeLength, 8);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Position at midpoint
    const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mesh.position.copy(midpoint);

    // Rotate to align
    direction.normalize();
    const up = new THREE.Vector3(0, 1, 0);
    if (direction.distanceTo(up) > 0.0001 && direction.distanceTo(up.clone().negate()) > 0.0001) {
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
      mesh.setRotationFromQuaternion(quaternion);
    } else if (direction.distanceTo(up.clone().negate()) <= 0.0001) {
      mesh.rotation.x = Math.PI;
    }

    // Add outline edges
    const edgesGeom = new THREE.EdgesGeometry(geometry, 15);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5
    });
    const line = new THREE.LineSegments(edgesGeom, lineMat);
    mesh.add(line);

    return mesh;
  }
}
