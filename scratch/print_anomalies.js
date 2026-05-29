const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'supabase', 'migrations', '20260211_inspection_module_schema_corrected.sql');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log("Printing lines 510 to 570...");
for (let i = 509; i < 570; i++) {
  if (lines[i]) console.log(`${i + 1}: ${lines[i]}`);
}
