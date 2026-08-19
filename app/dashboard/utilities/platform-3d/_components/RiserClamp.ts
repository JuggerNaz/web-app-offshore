import * as THREE from 'three';

export interface RiserClampOptions {
    outerRadius?: number;
    height?: number;
    flangeWidth?: number;
    flangeThickness?: number;
    color?: string | number;
    isSelected?: boolean;
    isHovered?: boolean;
}

export class RiserClamp extends THREE.Group {
    constructor(options: RiserClampOptions = {}) {
        super();
        this.name = 'RiserClamp';

        const outerRadius = options.outerRadius ?? 0.28;
        const height = options.height ?? 0.7;
        const flangeWidth = options.flangeWidth ?? 0.22;
        const flangeThickness = options.flangeThickness ?? 0.05;

        let baseColorHex = options.color ?? '#eab308'; // Bright Safety Gold/Yellow
        if (options.isSelected) {
            baseColorHex = '#3b82f6'; // Bright selection blue
        } else if (options.isHovered) {
            baseColorHex = '#fef08a';
        }

        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(baseColorHex),
            metalness: 0.6,
            roughness: 0.25,
            emissive: options.isSelected ? new THREE.Color('#1d4ed8') : options.isHovered ? new THREE.Color('#ca8a04') : new THREE.Color('#000000'),
            emissiveIntensity: options.isSelected ? 0.5 : options.isHovered ? 0.2 : 0,
            side: THREE.DoubleSide
        });

        // Always keep bolts, brackets, and stiffener hardware dark metallic with high contrast
        const darkMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(options.isSelected ? '#0f172a' : '#1e293b'),
            metalness: 0.9,
            roughness: 0.15,
        });

        // 1. Central Sleeve (Full cylinder)
        const sleeveGeom = new THREE.CylinderGeometry(outerRadius, outerRadius, height, 32);
        const sleeveMesh = new THREE.Mesh(sleeveGeom, bodyMaterial);
        this.add(sleeveMesh);

        // 2. Stiffener Ribs (Top, Mid, and Bottom rings)
        const ribThickness = 0.04;
        const ribProtrusion = 0.05;
        const ribGeom = new THREE.CylinderGeometry(outerRadius + ribProtrusion, outerRadius + ribProtrusion, ribThickness, 32);
        
        const topRib = new THREE.Mesh(ribGeom, darkMaterial);
        topRib.position.set(0, height / 2 - 0.08, 0);
        this.add(topRib);

        const botRib = new THREE.Mesh(ribGeom, darkMaterial);
        botRib.position.set(0, -height / 2 + 0.08, 0);
        this.add(botRib);

        const midRib = new THREE.Mesh(ribGeom, darkMaterial);
        midRib.position.set(0, 0, 0);
        this.add(midRib);

        // 3. Side Bolting Flanges (Left and Right - prominently extended)
        const flangeGeom = new THREE.BoxGeometry(flangeWidth, height * 0.92, flangeThickness * 2 + 0.03); // x, y, z
        
        const rightFlange = new THREE.Mesh(flangeGeom, bodyMaterial);
        rightFlange.position.set(outerRadius + flangeWidth / 2 - 0.01, 0, 0);
        this.add(rightFlange);

        const leftFlange = new THREE.Mesh(flangeGeom, bodyMaterial);
        leftFlange.position.set(-(outerRadius + flangeWidth / 2 - 0.01), 0, 0);
        this.add(leftFlange);

        // 4. Bolts (passing through the flanges along Z axis)
        const boltRadius = 0.022;
        const boltLength = flangeThickness * 2 + 0.12;
        const boltGeom = new THREE.CylinderGeometry(boltRadius, boltRadius, boltLength, 16);
        // Rotate bolt to align with Z axis
        boltGeom.rotateX(Math.PI / 2);

        const boltPositionsY = [height * 0.32, 0, -height * 0.32];
        const boltOffsetX = outerRadius + flangeWidth * 0.55;

        boltPositionsY.forEach(y => {
            // Right flange bolts
            const rightBolt = new THREE.Mesh(boltGeom, darkMaterial);
            rightBolt.position.set(boltOffsetX, y, 0);
            this.add(rightBolt);

            // Left flange bolts
            const leftBolt = new THREE.Mesh(boltGeom, darkMaterial);
            leftBolt.position.set(-boltOffsetX, y, 0);
            this.add(leftBolt);
        });

        // 5. Back Mounting Bracket (attaches to structure)
        const mountGeom = new THREE.BoxGeometry(0.14, height * 0.7, 0.18);
        const mountMesh = new THREE.Mesh(mountGeom, darkMaterial);
        mountMesh.position.set(0, 0, -(outerRadius + 0.06));
        this.add(mountMesh);
    }
}
