const fs = require('fs');

const f = 'C:\\Users\\nq352\\Documents\GitHub\\web-app-offshore\\supabase\\migrations\\20260211_inspection_module_schema_corrected.sql';
const content = fs.readFileSync(f, 'utf-8');
const lines = content.split('\n');

console.log("Searching CREATE TABLE in corrected schema...");
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('create table')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
