import * as THREE from 'three';

export interface CaissonSupportOptions {
  innerRadius?: number;
  outerRadius?: number;
  height?: number;
  color?: string | number;
  isSelected?: boolean;
  isHovered?: boolean;
}

export class CaissonSupport extends THREE.Group {
  constructor(options: CaissonSupportOptions = {}) {
    super();
    this.name = 'CaissonSupport';

    const outerRadius = options.outerRadius ?? 0.25;
    const height = options.height ?? 0.45;

    let baseColorHex = options.color ?? '#facc15'; // Safety Yellow
    if (options.isSelected) {
      baseColorHex = '#f97316'; // Orange when selected
    } else if (options.isHovered) {
      baseColorHex = '#fef08a'; // Light yellow when hovered
    }

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseColorHex),
      metalness: 0.4,
      roughness: 0.35,
      emissive: options.isSelected ? new THREE.Color('#ea580c') : options.isHovered ? new THREE.Color('#eab308') : new THREE.Color('#000000'),
      emissiveIntensity: options.isSelected ? 0.7 : options.isHovered ? 0.3 : 0,
      side: THREE.DoubleSide,
    });

    const weldBeadMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseColorHex),
      metalness: 0.55,
      roughness: 0.25,
      emissive: options.isSelected ? new THREE.Color('#ea580c') : options.isHovered ? new THREE.Color('#eab308') : new THREE.Color('#000000'),
      emissiveIntensity: options.isSelected ? 0.7 : options.isHovered ? 0.3 : 0,
    });

    // 1. Central Main Node Weld Sleeve (Cylinder wrapping caisson)
    const sleeveGeom = new THREE.CylinderGeometry(outerRadius, outerRadius, height, 32);
    const sleeveMesh = new THREE.Mesh(sleeveGeom, material);
    this.add(sleeveMesh);

    // 2. Central Raised Circumferential Weld Bead Seam
    const centerWeldGeom = new THREE.CylinderGeometry(outerRadius * 1.07, outerRadius * 1.07, height * 0.28, 32);
    const centerWeldMesh = new THREE.Mesh(centerWeldGeom, weldBeadMaterial);
    this.add(centerWeldMesh);

    // 3. Top Tapered Weld Bevel Ring
    const topBevelGeom = new THREE.CylinderGeometry(outerRadius * 1.02, outerRadius * 1.06, 0.08, 32);
    const topBevelMesh = new THREE.Mesh(topBevelGeom, weldBeadMaterial);
    topBevelMesh.position.set(0, height / 2 + 0.04, 0);
    this.add(topBevelMesh);

    // 4. Bottom Tapered Weld Bevel Ring
    const botBevelGeom = new THREE.CylinderGeometry(outerRadius * 1.06, outerRadius * 1.02, 0.08, 32);
    const botBevelMesh = new THREE.Mesh(botBevelGeom, weldBeadMaterial);
    botBevelMesh.position.set(0, -height / 2 - 0.04, 0);
    this.add(botBevelMesh);

    // 5. Upper & Lower Circumferential Weld Accent Bands
    const bandGeom = new THREE.CylinderGeometry(outerRadius * 1.04, outerRadius * 1.04, 0.04, 32);
    
    const topBand = new THREE.Mesh(bandGeom, material);
    topBand.position.set(0, height * 0.28, 0);
    this.add(topBand);

    const botBand = new THREE.Mesh(bandGeom, material);
    botBand.position.set(0, -height * 0.28, 0);
    this.add(botBand);
  }
}
