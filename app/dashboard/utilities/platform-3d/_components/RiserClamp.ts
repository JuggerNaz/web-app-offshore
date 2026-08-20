import * as THREE from 'three';

export interface RiserClampOptions {
    outerRadius?: number;
    height?: number;
    flangeWidth?: number;
    flangeThickness?: number;
    color?: string | number;
    isSelected?: boolean;
    isHovered?: boolean;
    rodLength?: number;
}

export class RiserClamp extends THREE.Group {
    constructor(options: RiserClampOptions = {}) {
        super();
        this.name = 'RiserClamp';

        const outerRadius = options.outerRadius ?? 0.25;
        const height = options.height ?? 0.6;
        const flangeWidth = options.flangeWidth ?? 0.15;
        const flangeThickness = options.flangeThickness ?? 0.04;
        const rodLength = options.rodLength ?? 0.85;

        let baseColorHex = options.color ?? '#facc15'; // Safety Yellow
        if (options.isSelected) {
            baseColorHex = '#f97316';
        } else if (options.isHovered) {
            baseColorHex = '#fef08a';
        }

        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(baseColorHex),
            metalness: 0.5,
            roughness: 0.3,
            emissive: options.isSelected ? new THREE.Color('#ea580c') : options.isHovered ? new THREE.Color('#eab308') : new THREE.Color('#000000'),
            emissiveIntensity: options.isSelected ? 0.7 : options.isHovered ? 0.3 : 0,
            side: THREE.DoubleSide
        });

        const darkMaterial = new THREE.MeshStandardMaterial({
            color: options.isSelected ? new THREE.Color('#ea580c') : new THREE.Color('#1e293b'),
            metalness: 0.8,
            roughness: 0.2,
        });

        // Helper function to create a single clamp assembly
        const createClampAssembly = () => {
            const clampGroup = new THREE.Group();

            // 1. Central Sleeve (Full cylinder)
            const sleeveGeom = new THREE.CylinderGeometry(outerRadius, outerRadius, height, 32);
            const sleeveMesh = new THREE.Mesh(sleeveGeom, bodyMaterial);
            clampGroup.add(sleeveMesh);

            // 2. Stiffener Ribs (Top and Bottom rings)
            const ribThickness = 0.03;
            const ribProtrusion = 0.04;
            const ribGeom = new THREE.CylinderGeometry(outerRadius + ribProtrusion, outerRadius + ribProtrusion, ribThickness, 32);
            
            const topRib = new THREE.Mesh(ribGeom, bodyMaterial);
            topRib.position.set(0, height / 2 - 0.08, 0);
            clampGroup.add(topRib);

            const botRib = new THREE.Mesh(ribGeom, bodyMaterial);
            botRib.position.set(0, -height / 2 + 0.08, 0);
            clampGroup.add(botRib);

            const midRib = new THREE.Mesh(ribGeom, bodyMaterial);
            midRib.position.set(0, 0, 0);
            clampGroup.add(midRib);

            // 3. Side Bolting Flanges (Left and Right)
            // Flanges protrude out along the X axis
            const flangeGeom = new THREE.BoxGeometry(flangeWidth, height * 0.9, flangeThickness * 2 + 0.02); // x, y, z
            
            const rightFlange = new THREE.Mesh(flangeGeom, bodyMaterial);
            rightFlange.position.set(outerRadius + flangeWidth / 2 - 0.02, 0, 0);
            clampGroup.add(rightFlange);

            const leftFlange = new THREE.Mesh(flangeGeom, bodyMaterial);
            leftFlange.position.set(-(outerRadius + flangeWidth / 2 - 0.02), 0, 0);
            clampGroup.add(leftFlange);

            // 4. Bolts (passing through the flanges along Z axis)
            const boltRadius = 0.015;
            const boltLength = flangeThickness * 2 + 0.1;
            const boltGeom = new THREE.CylinderGeometry(boltRadius, boltRadius, boltLength, 12);
            // Rotate bolt to align with Z axis
            boltGeom.rotateX(Math.PI / 2);

            const boltPositionsY = [height * 0.3, 0, -height * 0.3];
            const boltOffsetX = outerRadius + flangeWidth * 0.5;

            boltPositionsY.forEach(y => {
                // Right flange bolts
                const rightBolt = new THREE.Mesh(boltGeom, darkMaterial);
                rightBolt.position.set(boltOffsetX, y, 0);
                clampGroup.add(rightBolt);

                // Left flange bolts
                const leftBolt = new THREE.Mesh(boltGeom, darkMaterial);
                leftBolt.position.set(-boltOffsetX, y, 0);
                clampGroup.add(leftBolt);
            });

            return clampGroup;
        };

        // A. Front Clamp (Vertical)
        const frontClamp = createClampAssembly();
        this.add(frontClamp);

        // B. Connecting Tube (Matching clamp body material & yellow color, bigger radius)
        const rodRadius = 0.085;
        const rodGeom = new THREE.CylinderGeometry(rodRadius, rodRadius, rodLength, 32);
        rodGeom.rotateX(Math.PI / 2); // Align with Z axis
        
        const rodMesh = new THREE.Mesh(rodGeom, bodyMaterial);
        // The rod starts at the back surface of the front clamp (z = -outerRadius)
        // and extends by rodLength towards negative Z.
        const rodCenterZ = -(outerRadius + rodLength / 2);
        rodMesh.position.set(0, 0, rodCenterZ);
        this.add(rodMesh);

        // C. Back Clamp (Horizontal)
        const backClamp = createClampAssembly();
        // The back clamp is at the end of the rod.
        const backClampCenterZ = -(outerRadius + rodLength + outerRadius);
        backClamp.position.set(0, 0, backClampCenterZ);
        
        // Rotate back clamp 90 degrees around Z axis so it clamps a horizontal member (along X axis)
        backClamp.rotation.z = Math.PI / 2;

        this.add(backClamp);
    }
}
