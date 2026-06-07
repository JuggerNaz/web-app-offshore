const fs = require('fs');
const content = fs.readFileSync('app/dashboard/inspection-v2/workspace/page.tsx', 'utf-8');

// Find the main layout wrapper
const layoutStart = content.indexOf('// ======== COL 1: OPERATIONS (Diver/ROV + Video) ========');
if (layoutStart === -1) console.log("Not found COL 1");

console.log("COL 1 found at index", layoutStart);

// Let's print the text around it to understand the structure
console.log(content.substring(layoutStart - 200, layoutStart + 500));
