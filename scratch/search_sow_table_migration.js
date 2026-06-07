const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'supabase', 'migrations', '20260204_create_sow_table.sql');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log("Searching structure_components in 20260204_create_sow_table.sql...");
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('structure_components')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
