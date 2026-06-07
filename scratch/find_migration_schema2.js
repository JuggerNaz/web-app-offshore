const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'supabase', 'migrations', '20260211_inspection_module_schema_corrected.sql');
if (!fs.existsSync(filePath)) {
  console.log("File not found:", filePath);
  return;
}
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log("Searching in migration file...");
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('create table') && line.toLowerCase().includes('structure_components')) {
    console.log(`Match at line ${idx + 1}: ${line}`);
    // Print 30 lines after the match
    for (let i = idx; i < idx + 35; i++) {
      if (lines[i]) console.log(`${i + 1}: ${lines[i]}`);
    }
  }
});
