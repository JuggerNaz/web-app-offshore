const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'supabase', 'migrations', '20260211_inspection_module_schema_corrected.sql');
if (!fs.existsSync(filePath)) {
  console.log("File not found:", filePath);
  return;
}
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

let start = -1;
let openBrackets = 0;
lines.forEach((line, idx) => {
  if (line.includes('CREATE TABLE public.structure_components') || line.includes('CREATE TABLE structure_components')) {
    start = idx;
    console.log(`Found start on line ${idx + 1}`);
  }
  if (start !== -1 && idx >= start && idx < start + 60) {
    console.log(`${idx + 1}: ${line}`);
  }
});
