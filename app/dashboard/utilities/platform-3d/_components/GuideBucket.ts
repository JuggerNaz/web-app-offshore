import * as THREE from 'three';

export interface GuideBucketOptions {
  outerRadius?: number;
  innerRadius?: number;
  height?: number;
  flareRadius?: number;
  flareHeight?: number;
  stubRadius?: number;
  stubLength?: number;
  color?: string | number;
  isSelected?: boolean;
  isHovered?: boolean;
}

export class GuideBucket extends THREE.Group {
  constructor(options: GuideBucketOptions = {}) {
    super();
    this.name = 'GuideBucket';

    const outerRadius = options.outerRadius ?? 0.28;
    const height = options.height ?? 0.55;
    const flareHeight = options.flareHeight ?? 0.14;
    const topFlareRadius = options.flareRadius ?? (outerRadius * 1.52);

    let baseColorHex = options.color ?? '#facc15'; // Safety Yellow
    if (options.isSelected) {
      baseColorHex = '#f97316'; // Orange when selected
    } else if (options.isHovered) {
      baseColorHex = '#fef08a'; // Light yellow when hovered
    }

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseColorHex),
      metalness: 0.5,
      roughness: 0.35,
      emissive: options.isSelected
        ? new THREE.Color('#ea580c')
        : options.isHovered
        ? new THREE.Color('#eab308')
        : new THREE.Color('#000000'),
      emissiveIntensity: options.isSelected ? 0.7 : options.isHovered ? 0.3 : 0,
      side: THREE.DoubleSide,
    });

    const weldBeadMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseColorHex),
      metalness: 0.6,
      roughness: 0.25,
      emissive: options.isSelected
        ? new THREE.Color('#ea580c')
        : options.isHovered
        ? new THREE.Color('#eab308')
        : new THREE.Color('#000000'),
      emissiveIntensity: options.isSelected ? 0.7 : options.isHovered ? 0.3 : 0,
    });

    const barrelHeight = Math.max(0.1, height - flareHeight);

    // 1. Central Straight Barrel Cylinder (Lower portion)
    const barrelGeom = new THREE.CylinderGeometry(outerRadius, outerRadius, barrelHeight, 32, 1, true);
    const barrelMesh = new THREE.Mesh(barrelGeom, material);
    barrelMesh.position.set(0, -flareHeight / 2, 0);
    this.add(barrelMesh);

    // 2. Top Conical Entry Flare / Bell Funnel (Curve only on the top side)
    // Top radius = topFlareRadius, Bottom radius = outerRadius
    const topFlareGeom = new THREE.CylinderGeometry(topFlareRadius, outerRadius, flareHeight, 32, 1, true);
    const topFlareMesh = new THREE.Mesh(topFlareGeom, material);
    topFlareMesh.position.set(0, height / 2 - flareHeight / 2, 0);
    this.add(topFlareMesh);

    // Top Flare Lip / Rim Ring
    const topRimGeom = new THREE.TorusGeometry(topFlareRadius, 0.02, 8, 32);
    topRimGeom.rotateX(Math.PI / 2);
    const topRimMesh = new THREE.Mesh(topRimGeom, weldBeadMaterial);
    topRimMesh.position.set(0, height / 2, 0);
    this.add(topRimMesh);
  }
}
