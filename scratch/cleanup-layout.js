const fs = require('fs');
const path = 'app/dashboard/inspection-v2/workspace/page.tsx';
const lines = fs.readFileSync(path, 'utf-8').split('\n');

const startTag = '      {/* MAIN DOCKABLE LAYOUT */}';
const endTag = '      <WorkspaceDialogs';

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(startTag)) startIndex = i;
  if (lines[i].includes(endTag)) {
    endIndex = i;
    break;
  }
}

console.log('Start:', startIndex, 'End:', endIndex);

if (startIndex !== -1 && endIndex !== -1) {
  // We want to keep the Layout and styles which were inserted at startIndex
  // The Layout part is from startIndex to startIndex + 8 approx
  
  const layoutLines = lines.slice(startIndex, startIndex + 9);
  
  const newLines = [
    ...lines.slice(0, startIndex),
    ...layoutLines,
    ...lines.slice(endIndex)
  ];
  
  fs.writeFileSync(path, newLines.join('\n'));
  console.log('Cleaned up redundant layout');
} else {
  console.log('Tags not found');
}
