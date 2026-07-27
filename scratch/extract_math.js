const fs = require('fs');
const content = fs.readFileSync('app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx', 'utf8');
const lines = content.split('\n');
const mathCode = lines.slice(799, 2442).join('\n');
const newFileContent = `import * as THREE from 'three';

export function generatePlatform3DCoordinates(platformDetails: any, elevations: any[], faces: any[], components: any[]) {
${mathCode}

  return { componentLayouts, foundationMembers, elvMarkers };
}
`;
fs.writeFileSync('utils/platform-3d-math.ts', newFileContent);
console.log('Math extracted!');
