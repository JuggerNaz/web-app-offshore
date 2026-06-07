const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'api', 'migration', 'execute', 'route.ts');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log("=== Matching lines in route.ts ===");
lines.forEach((line, idx) => {
  if (line.includes('inspectionDataObj') || line.includes('const inspectionDataObj') || line.includes('inspectionDataObj =')) {
    if (line.trim().startsWith('const inspectionDataObj') || line.trim().includes('.from(\'insp_records\')') || line.trim().includes('insert(')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  }
});
