import * as THREE from 'three';

export interface FenderOptions {
  height?: number;
  widthBack?: number;
  widthFront?: number;
  depth?: number;
  mainRadius?: number;
  secondaryRadius?: number;
  braceRadius?: number;
  color?: string | number;
  isSelected?: boolean;
  isHovered?: boolean;
  localLeftTop?: THREE.Vector3;
  localRightTop?: THREE.Vector3;
}

export class Fender extends THREE.Group {
  constructor(options: FenderOptions = {}) {
    super();
    this.name = 'Fender';

    const height = options.height ?? 6.0;
    const widthBack = options.widthBack ?? 3.2;
    const widthFront = options.widthFront ?? 2.2;
    const depth = options.depth ?? 1.0;
    
    const mainRadius = options.mainRadius ?? 0.08;
    const secondaryRadius = options.secondaryRadius ?? 0.025;
    const braceRadius = options.braceRadius ?? 0.04;

    // Default color is the same color as the members, unless hovered or selected
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

    // Calculate vertical coordinates (centered at y=0)
    const yBot = -height / 2;
    const yTop = height / 2;
    const yLowPlat = -height / 6;
    const yUppPlat = height / 6;
    const yHandrail = yUppPlat + 0.8;

    // Define corner points for the levels + handrail
    const getCornerPoints = (y: number) => {
      return {
        rl: new THREE.Vector3(-widthBack / 2, y, -depth / 2),
        rr: new THREE.Vector3(widthBack / 2, y, -depth / 2),
        fl: new THREE.Vector3(-widthFront / 2, y, depth / 2),
        fr: new THREE.Vector3(widthFront / 2, y, depth / 2),
      };
    };

    const pBot = getCornerPoints(yBot);
    const pLowPlat = getCornerPoints(yLowPlat);
    const pUppPlat = getCornerPoints(yUppPlat);
    const pTop = getCornerPoints(yTop);
    const pHand = getCornerPoints(yHandrail);

    // 1. Vertical Columns (running bottom to top)
    addTube(pBot.rl, pTop.rl, mainRadius);
    addTube(pBot.rr, pTop.rr, mainRadius);
    addTube(pBot.fl, pTop.fl, mainRadius);
    addTube(pBot.fr, pTop.fr, mainRadius);

    // 2. Horizontal Rails
    const addHorizontalFrame = (p: ReturnType<typeof getCornerPoints>, radius: number) => {
      addTube(p.rl, p.rr, radius); // Rear rail
      addTube(p.fl, p.fr, radius); // Front rail
      addTube(p.fl, p.rl, radius); // Left side rail
      addTube(p.fr, p.rr, radius); // Right side rail
    };

    addHorizontalFrame(pBot, mainRadius);
    addHorizontalFrame(pLowPlat, mainRadius);
    addHorizontalFrame(pUppPlat, mainRadius);
    addHorizontalFrame(pTop, mainRadius);

    // 3. Transverse Top and Bottom Support Bars
    const addTransverseBars = (y: number, radius: number) => {
      const frontX1 = -widthFront / 4;
      const frontX2 = widthFront / 4;
      const backX1 = -widthBack / 4;
      const backX2 = widthBack / 4;

      addTube(new THREE.Vector3(frontX1, y, depth / 2), new THREE.Vector3(backX1, y, -depth / 2), radius);
      addTube(new THREE.Vector3(frontX2, y, depth / 2), new THREE.Vector3(backX2, y, -depth / 2), radius);
    };
    addTransverseBars(yBot, braceRadius);
    addTransverseBars(yTop, braceRadius);

    // 4. Grated Floor (Lower & Upper Platforms)
    const addGrateFloor = (y: number) => {
      const numGrates = 14;
      for (let i = 1; i < numGrates; i++) {
        const t = i / numGrates;
        const xFront = -widthFront / 2 + t * widthFront;
        const xBack = -widthBack / 2 + t * widthBack;
        
        const p1 = new THREE.Vector3(xFront, y, depth / 2);
        const p2 = new THREE.Vector3(xBack, y, -depth / 2);
        addTube(p1, p2, secondaryRadius);
      }
    };
    addGrateFloor(yLowPlat);
    addGrateFloor(yUppPlat);

    // 5. Handrails (running front and sides of upper platform)
    addTube(pHand.fl, pHand.fr, braceRadius); // Front handrail
    addTube(pHand.fl, pHand.rl, braceRadius); // Left handrail
    addTube(pHand.fr, pHand.rr, braceRadius); // Right handrail

    // 6. Vertical Guard Rails / Safety bars in front
    const numVerticalBars = 8;
    for (let i = 1; i <= numVerticalBars; i++) {
      const t = i / (numVerticalBars + 1);
      const x = -widthFront / 2 + t * widthFront;
      const p1 = new THREE.Vector3(x, yBot, depth / 2);
      const p2 = new THREE.Vector3(x, yHandrail, depth / 2);
      addTube(p1, p2, secondaryRadius);
    }

    // 7. Diagonal Side Braces (parallel truss pattern)
    // Left Side Lower Diagonal (rear bot -> front lower platform)
    addTube(pBot.rl, pLowPlat.fl, braceRadius);
    // Right Side Lower Diagonal (rear bot -> front lower platform)
    addTube(pBot.rr, pLowPlat.fr, braceRadius);
    // Left Side Upper Diagonal (rear upper platform -> front top)
    addTube(pUppPlat.rl, pTop.fl, braceRadius);
    // Right Side Upper Diagonal (rear upper platform -> front top)
    addTube(pUppPlat.rr, pTop.fr, braceRadius);

    // 8. Visual Connection Brackets from Nodes to Upper Platform
    if (options.localLeftTop) {
      const isLegInFront = options.localLeftTop.z >= 0;
      const target = isLegInFront ? pUppPlat.fl : pUppPlat.rl;
      addTube(options.localLeftTop, target, braceRadius);
    }
    if (options.localRightTop) {
      const isLegInFront = options.localRightTop.z >= 0;
      const target = isLegInFront ? pUppPlat.fr : pUppPlat.rr;
      addTube(options.localRightTop, target, braceRadius);
    }
  }

  /**
   * Procedural tube generator
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

    // Add outline edges to make it more seen
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
