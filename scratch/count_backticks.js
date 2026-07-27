const fs = require('fs');
let c = fs.readFileSync('app/dashboard/utilities/platform-3d/_components/Structural3DViewer.tsx', 'utf8');
let count = (c.match(/`/g) || []).length;
console.log('Backticks:', count);
