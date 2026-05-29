const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'api', 'migration', 'execute', 'route.ts');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log("=== Matching lines for components migration ===");
lines.forEach((line, idx) => {
  if (line.includes('structure_components') || line.includes('insert(')) {
    if (line.toLowerCase().includes('comp') || line.toLowerCase().includes('structure_components')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  }
});
