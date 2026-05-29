const fs = require('fs');

const f = 'C:\\Users\\nq352\\Documents\\GitHub\\web-app-offshore\\supabase\\migrations\\20260204_create_sow_table.sql';
const content = fs.readFileSync(f, 'utf-8');
const lines = content.split('\n');

console.log("Searching CREATE TABLE in sow table migration...");
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('create table')) {
    console.log(`\n=== Match at line ${idx + 1} ===`);
    for (let i = idx; i < idx + 25; i++) {
      if (lines[i]) console.log(`  ${i + 1}: ${lines[i]}`);
    }
  }
});
