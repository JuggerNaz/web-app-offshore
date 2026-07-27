const fs = require('fs');

let c = fs.readFileSync('app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx', 'utf8');

c = c.replace(
    /import React, \{ useMemo, useState, useRef \} from "react";/, 
    'import React, { useMemo, useState, useRef, useEffect } from "react";'
);

const cameraRigStr = `
import * as THREE from 'three';

function CameraRig({ selectedPos, isActivated }: { selectedPos: THREE.Vector3 | null; isActivated: boolean }) {
    const { camera, controls } = useThree();
    
    useEffect(() => {
        if (!isActivated) return;
        if (selectedPos && controls) {
            const target = new THREE.Vector3(selectedPos.x, selectedPos.y, selectedPos.z);
            const offset = new THREE.Vector3(15, 10, 15);
            const cameraPos = target.clone().add(offset);
            
            (controls as any).target.copy(target);
            camera.position.copy(cameraPos);
            if (typeof (controls as any).update === 'function') {
                (controls as any).update();
            }
        }
    }, [selectedPos, camera, controls, isActivated]);

    return null;
}
`;

if (!c.includes('function CameraRig')) {
    c = c.replace(/export function Structural3DViewer/, cameraRigStr + '\nexport function Structural3DViewer');
}

fs.writeFileSync('app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx', c);
console.log('Injected CameraRig');
