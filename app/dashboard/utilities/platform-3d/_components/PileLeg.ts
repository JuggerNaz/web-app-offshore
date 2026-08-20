import * as THREE from 'three';

export interface PileLegOptions {
    length?: number;
    radius?: number;
    color?: string | number;
    isSelected?: boolean;
    isHovered?: boolean;
    flipCrowns?: boolean;
}

export class PileLeg extends THREE.Group {
    constructor(options: PileLegOptions = {}) {
        super();
        this.name = 'PileLeg';

        const length = options.length ?? 4.0;
        const radius = options.radius ?? 0.4;

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

        // 1. Central Main Sleeve Cylinder
        const mainCylinderGeom = new THREE.CylinderGeometry(radius, radius, length, 32);
        const mainCylinderMesh = new THREE.Mesh(mainCylinderGeom, bodyMaterial);
        this.add(mainCylinderMesh);

        // Calculate Y offsets (centered at y = 0)
        let yTop = length / 2;
        let yBot = -length / 2;
        let topSign = 1;
        let botSign = -1;
        
        if (options.flipCrowns) {
            yTop = -length / 2;
            yBot = length / 2;
            topSign = -1;
            botSign = 1;
        }

        // ----------------------------------------------------
        // 2. TOP MAIN CROWN BOX (At Top Node)
        // ----------------------------------------------------
        const crownGroup = new THREE.Group();
        const crownHeight = Math.min(1.2, length * 0.3);
        const crownCenterY = yTop - topSign * (crownHeight / 2);
        crownGroup.position.set(0, crownCenterY, 0);

        // A. Square Outer Collar / Box Wrapper
        const boxSize = radius * 2.6;
        const boxGeom = new THREE.BoxGeometry(boxSize, crownHeight, boxSize);
        const boxMesh = new THREE.Mesh(boxGeom, bodyMaterial);
        crownGroup.add(boxMesh);

        // B. Stacked Horizontal Stiffener Flanges (3 Ring Plates)
        const flangeCount = 3;
        const flangeThickness = 0.04;
        const flangeRadius = radius * 1.5;
        for (let i = 0; i < flangeCount; i++) {
            const t = i / (flangeCount - 1);
            const fy = -crownHeight / 2 + t * crownHeight;
            const flangeGeom = new THREE.CylinderGeometry(flangeRadius, flangeRadius, flangeThickness, 32);
            const flangeMesh = new THREE.Mesh(flangeGeom, bodyMaterial);
            flangeMesh.position.set(0, fy, 0);
            crownGroup.add(flangeMesh);
        }

        // C. Top Rim Lip Flange
        const topLipGeom = new THREE.CylinderGeometry(flangeRadius * 1.05, flangeRadius * 1.05, 0.08, 32);
        const topLipMesh = new THREE.Mesh(topLipGeom, bodyMaterial);
        topLipMesh.position.set(0, crownHeight / 2 + 0.04, 0);
        crownGroup.add(topLipMesh);

        // D. Vertical Stiffener Gusset Plates (Grid Pattern - 8 Radial Fins)
        const numGussets = 8;
        const gussetThickness = 0.04;
        const gussetDepth = (boxSize - radius * 2) / 2 + 0.15;
        const gussetGeom = new THREE.BoxGeometry(gussetThickness, crownHeight * 0.95, gussetDepth);

        for (let i = 0; i < numGussets; i++) {
            const angle = (i / numGussets) * Math.PI * 2;
            const gussetMesh = new THREE.Mesh(gussetGeom, bodyMaterial);
            
            const dist = radius + gussetDepth / 2;
            const gx = Math.cos(angle) * dist;
            const gz = Math.sin(angle) * dist;
            
            gussetMesh.position.set(gx, 0, gz);
            gussetMesh.rotation.y = -angle + Math.PI / 2;
            crownGroup.add(gussetMesh);
        }

        // E. Shear Key Pin Bosses (Protruding Pins on Box Faces)
        const pinRadius = 0.08;
        const pinLength = 0.2;
        const pinGeom = new THREE.CylinderGeometry(pinRadius, pinRadius, pinLength, 16);
        pinGeom.rotateX(Math.PI / 2);

        const pinOffsetsX = [-boxSize * 0.25, boxSize * 0.25];
        pinOffsetsX.forEach(px => {
            const frontPin = new THREE.Mesh(pinGeom, darkMaterial);
            frontPin.position.set(px, 0, boxSize / 2 + pinLength / 2 - 0.02);
            crownGroup.add(frontPin);

            const backPin = new THREE.Mesh(pinGeom, darkMaterial);
            backPin.position.set(px, 0, -(boxSize / 2 + pinLength / 2 - 0.02));
            crownGroup.add(backPin);
        });

        this.add(crownGroup);

        // ----------------------------------------------------
        // 3. BOTTOM SMALLER CROWN COLLAR (At Bottom Node)
        // ----------------------------------------------------
        const botCrownGroup = new THREE.Group();
        const botCrownHeight = Math.min(0.6, length * 0.15);
        const botCrownCenterY = yBot - botSign * (botCrownHeight / 2);
        botCrownGroup.position.set(0, botCrownCenterY, 0);

        // A. Lower Flange Collar Plate
        const botFlangeRadius = radius * 1.35;
        const botFlangeGeom = new THREE.CylinderGeometry(botFlangeRadius, botFlangeRadius, 0.06, 32);
        const botFlangeMesh = new THREE.Mesh(botFlangeGeom, bodyMaterial);
        botCrownGroup.add(botFlangeMesh);

        // B. Smaller Vertical Gussets (4 Fins)
        const numBotGussets = 4;
        const botGussetDepth = (botFlangeRadius - radius) + 0.05;
        const botGussetGeom = new THREE.BoxGeometry(0.03, botCrownHeight, botGussetDepth);

        for (let i = 0; i < numBotGussets; i++) {
            const angle = (i / numBotGussets) * Math.PI * 2;
            const gMesh = new THREE.Mesh(botGussetGeom, bodyMaterial);
            const dist = radius + botGussetDepth / 2;
            gMesh.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
            gMesh.rotation.y = -angle + Math.PI / 2;
            botCrownGroup.add(gMesh);
        }

        // C. Lower Curved Guardrail / Bracket Tube
        const railRadius = botFlangeRadius + 0.08;
        const railTubeRadius = 0.025;
        const railGeom = new THREE.TorusGeometry(railRadius, railTubeRadius, 12, 32, Math.PI * 1.5);
        railGeom.rotateX(Math.PI / 2);
        const railMesh = new THREE.Mesh(railGeom, bodyMaterial);
        railMesh.position.set(0, 0.1, 0);
        botCrownGroup.add(railMesh);

        // Vertical Handrail Supports
        const railSupportGeom = new THREE.CylinderGeometry(railTubeRadius, railTubeRadius, 0.25, 8);
        for (let i = 0; i < 4; i++) {
            const angle = (i / 3) * Math.PI * 1.5 - Math.PI * 0.75;
            const supMesh = new THREE.Mesh(railSupportGeom, bodyMaterial);
            supMesh.position.set(Math.cos(angle) * railRadius, 0.05, Math.sin(angle) * railRadius);
            botCrownGroup.add(supMesh);
        }

        this.add(botCrownGroup);
    }
}
