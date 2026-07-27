const fs = require('fs');
let c = fs.readFileSync('app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx', 'utf8');
c = "import * as THREE from 'three';\n" + c;
fs.writeFileSync('app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx', c);
console.log('Added THREE back');
