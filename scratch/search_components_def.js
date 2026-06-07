const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'supabase', 'migrations', '20260211_inspection_module_schema_corrected.sql');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log("Searching structure_components table creation...");
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('create table') && line.toLowerCase().includes('components')) {
    console.log(`${idx + 1}: ${line.trim()}`);
    for (let i = idx; i < idx + 25; i++) {
      console.log(`  ${i + 1}: ${lines[i]}`);
    }
  }
});
