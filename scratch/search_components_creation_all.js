const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'supabase', 'migrations', '20260211_inspection_module_schema.sql');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('structure_components')) {
      console.log(`20260211_inspection_module_schema.sql line ${idx + 1}: ${line.trim()}`);
    }
  });
}
