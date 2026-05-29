const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'supabase', 'migrations', '20260211_inspection_module_schema_corrected.sql');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log("Searching comment in corrected schema...");
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('create table') && line.toLowerCase().includes('comment')) {
    console.log(`Match at line ${idx + 1}: ${line.trim()}`);
    for (let i = Math.max(0, idx - 5); i < Math.min(lines.length, idx + 20); i++) {
      console.log(`  ${i + 1}: ${lines[i]}`);
    }
  }
});
