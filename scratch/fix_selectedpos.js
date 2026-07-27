const fs = require('fs');

let c = fs.readFileSync('app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx', 'utf8');

const rigCode = `
    const selectedLayout = componentLayouts.find((l: any) => l.id === selectedCompId);
    const selectedPos = selectedLayout ? new THREE.Vector3(selectedLayout.position[0], selectedLayout.position[1], selectedLayout.position[2]) : null;

    return (`;

if (!c.includes('const selectedPos =')) {
    c = c.replace(/return \(\s*<div className="w-full h-full bg-white dark:bg-slate-950/, rigCode + '\n        <div className="w-full h-full bg-white dark:bg-slate-950');
}

fs.writeFileSync('app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx', c);
console.log('Fixed selectedPos');
