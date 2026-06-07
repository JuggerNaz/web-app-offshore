const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'api', 'migration', 'execute', 'route.ts');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log("=== Matching lines for parseAnodeDetails ===");
lines.forEach((line, idx) => {
  if (line.includes('parseAnodeDetails') || line.includes('anode_type') || line.includes('anode_depletion')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
