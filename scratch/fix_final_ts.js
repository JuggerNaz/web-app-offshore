const fs = require('fs');

// Fix API Route
let routeFile = 'app/api/platform/webapp-3d/[structure_id]/route.ts';
let routeC = fs.readFileSync(routeFile, 'utf8');
routeC = routeC.replace(
    /\.from\("u_lib_list"\)\.select\("\*"\)\.eq\("structure_id", structureIdNum\)/,
    '.from("u_lib_list").select("*").eq("lib_id", structureIdNum)'
);
fs.writeFileSync(routeFile, routeC);

// Fix Viewer File
let viewerFile = 'app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx';
let viewerC = fs.readFileSync(viewerFile, 'utf8');

// Fix {} types
viewerC = viewerC.replace(
    /const comp = rawComponents.find\(\(c: any\) => c.id === dbItem.component_id\) \|\| \{\};/,
    'const comp: any = rawComponents.find((c: any) => c.id === dbItem.component_id) || {};'
);

// Fix duplicate THREE - remove all imports of THREE, then add one at the top
viewerC = viewerC.replace(/import \* as THREE from "three";\n/g, '');
viewerC = viewerC.replace(/import \* as THREE from 'three';\n/g, '');
viewerC = "import * as THREE from 'three';\n" + viewerC;

fs.writeFileSync(viewerFile, viewerC);
console.log('Fixed API route lib_id, Viewer {} types, and Viewer duplicate THREE');
