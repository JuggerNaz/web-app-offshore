const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'supabase', 'migrations', '20260211_inspection_module_schema_corrected.sql');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log("Searching CREATE TABLE in corrected schema...");
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('create table')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
