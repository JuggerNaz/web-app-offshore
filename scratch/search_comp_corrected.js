const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'supabase', 'migrations', '20260211_inspection_module_schema_corrected.sql');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log("Searching structure_components in 20260211_inspection_module_schema_corrected.sql...");
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('structure_components')) {
    console.log(`\nMatch at line ${idx + 1}: ${line.trim()}`);
    for (let i = Math.max(0, idx - 5); i < Math.min(lines.length, idx + 10); i++) {
      console.log(`  ${i + 1}: ${lines[i]}`);
    }
  }
});
