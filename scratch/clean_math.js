const fs = require('fs');
let content = fs.readFileSync('utils/platform-3d-math.ts', 'utf8');
const lines = content.split('\n');

const newLines = [];
let skipBlock = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('const wincairsParam = useWincairsMode')) {
    newLines.push(line.replace('useWincairsMode ? wincairsParamsMap.get(c.comp_id || c.id) : null', 'null'));
    continue;
  }
  
  if (line.includes('if (selectedElevations.length > 0)') || line.includes('if (selectedFaces.length > 0)')) {
    skipBlock = 1; // start skipping block
  }
  
  if (skipBlock > 0) {
    if (line.includes('{')) skipBlock += (line.match(/\{/g) || []).length;
    if (line.includes('}')) skipBlock -= (line.match(/\}/g) || []).length;
    
    // if block just ended
    if (skipBlock === 1 && line.includes('}')) {
       skipBlock = 0;
    }
    continue; // skip pushing
  }

  newLines.push(line);
}

fs.writeFileSync('utils/platform-3d-math.ts', newLines.join('\n'));
console.log('Cleaned math utility.');
