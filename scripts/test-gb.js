const THREE = require('three');
const fs = require('fs');

// Simple test to ensure Three.js Group constructor works and GuideBucket class definition is valid
class GuideBucket extends THREE.Group {
  constructor(options = {}) {
    super();
    this.name = 'GuideBucket';
    const outerRadius = options.outerRadius ?? 0.28;
    const height = options.height ?? 0.50;
    const topFlareRadius = options.flareRadius ?? (outerRadius * 1.55);
    const botFlareRadius = options.flareRadius ? (options.flareRadius * 0.9) : (outerRadius * 1.42);
    const flareHeight = options.flareHeight ?? 0.14;
    const stubRadius = options.stubRadius ?? 0.13;
    const stubLength = options.stubLength ?? 0.40;

    let baseColorHex = options.color ?? '#facc15';
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseColorHex),
      side: THREE.DoubleSide,
    });

    const barrelGeom = new THREE.CylinderGeometry(outerRadius, outerRadius, height, 32, 1, true);
    const barrelMesh = new THREE.Mesh(barrelGeom, material);
    this.add(barrelMesh);
  }
}

const gb = new GuideBucket();
console.log('GuideBucket created successfully:', gb.name, 'Children:', gb.children.length);
