import * as THREE from 'three';

export interface CaissonSupportOptions {
  innerRadius?: number;
  outerRadius?: number;
  height?: number;
  lugProtrusion?: number;
  lugWidth?: number;
  lugHeight?: number;
  color?: string | number;
  isSelected?: boolean;
  isHovered?: boolean;
}

export class CaissonSupport extends THREE.Group {
  constructor(options: CaissonSupportOptions = {}) {
    super();
    this.name = 'CaissonSupport';

    const outerRadius = options.outerRadius ?? 0.33;
    const height = options.height ?? 0.35;
    const lugProtrusion = options.lugProtrusion ?? 0.16;
    const lugWidth = options.lugWidth ?? 0.14;
    const lugHeight = options.lugHeight ?? 0.28;

    let baseColorHex = options.color ?? '#facc15'; // Safety Yellow
    if (options.isSelected) {
      baseColorHex = '#f97316';
    } else if (options.isHovered) {
      baseColorHex = '#fef08a';
    }

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseColorHex),
      metalness: 0.5,
      roughness: 0.3,
      emissive: options.isSelected ? new THREE.Color('#ea580c') : options.isHovered ? new THREE.Color('#eab308') : new THREE.Color('#000000'),
      emissiveIntensity: options.isSelected ? 0.7 : options.isHovered ? 0.3 : 0,
    });

    const darkMaterial = new THREE.MeshStandardMaterial({
      color: options.isSelected ? new THREE.Color('#ea580c') : new THREE.Color('#1e293b'),
      metalness: 0.8,
      roughness: 0.2,
    });

    // 1. Central Sleeve Collar (Cylinder wrapping caisson)
    const sleeveGeom = new THREE.CylinderGeometry(outerRadius, outerRadius, height, 32);
    const sleeveMesh = new THREE.Mesh(sleeveGeom, material);
    this.add(sleeveMesh);

    // Top and bottom flange rings for sleeve collar
    const flangeGeom = new THREE.CylinderGeometry(outerRadius + 0.02, outerRadius + 0.02, 0.04, 32);
    const topFlange = new THREE.Mesh(flangeGeom, darkMaterial);
    topFlange.position.set(0, height / 2 - 0.02, 0);
    this.add(topFlange);

    const botFlange = new THREE.Mesh(flangeGeom, darkMaterial);
    botFlange.position.set(0, -height / 2 + 0.02, 0);
    this.add(botFlange);

    // 2. 4 Radial Protruding Guide Lugs (North, South, East, West)
    const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

    angles.forEach((angle) => {
      const lugGroup = new THREE.Group();
      lugGroup.rotation.y = angle;

      const centerDist = outerRadius + lugProtrusion / 2;
      const lugGeom = new THREE.BoxGeometry(lugWidth, lugHeight, lugProtrusion);
      const lugMesh = new THREE.Mesh(lugGeom, material);
      lugMesh.position.set(0, 0, centerDist);
      lugGroup.add(lugMesh);

      const tipGeom = new THREE.BoxGeometry(lugWidth * 0.88, lugHeight * 0.9, 0.04);
      const tipMesh = new THREE.Mesh(tipGeom, darkMaterial);
      tipMesh.position.set(0, 0, outerRadius + lugProtrusion + 0.02);
      lugGroup.add(tipMesh);

      this.add(lugGroup);
    });
  }
}
