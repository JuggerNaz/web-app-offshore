const fs = require('fs');

const f = 'C:\\Users\\nq352\\Documents\\GitHub\\web-app-offshore\\supabase\\migrations\\20260211_inspection_module_schema_corrected.sql';
const content = fs.readFileSync(f, 'utf-8');
const lines = content.split('\n');

console.log("Searching table creation in corrected schema...");
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('create table') && line.toLowerCase().includes('component')) {
    console.log(`\n=== Match at line ${idx + 1} ===`);
    for (let i = idx; i < idx + 25; i++) {
      console.log(`  ${i + 1}: ${lines[i]}`);
    }
  }
});
