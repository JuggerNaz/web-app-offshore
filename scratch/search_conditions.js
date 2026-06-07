const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'api', 'migration', 'execute', 'route.ts');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log("=== Matching lines in route.ts ===");
lines.forEach((line, idx) => {
  if (line.includes('component_condition') || line.includes('coating_condition')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
