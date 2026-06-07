const fs = require('fs');

const file1 = 'C:\\Users\\nq352\\Documents\\GitHub\\web-app-offshore\\supabase\\migrations\\20260204_create_sow_table.sql';
const file2 = 'C:\\Users\\nq352\\Documents\\GitHub\\web-app-offshore\\supabase\\migrations\\20260211_inspection_module_schema_corrected.sql';

[file1, file2].forEach(f => {
  const content = fs.readFileSync(f, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('create table') && line.toLowerCase().includes('structure_components')) {
      console.log(`\n=== Match in ${f} at line ${idx + 1} ===`);
      for (let i = idx; i < idx + 25; i++) {
        console.log(`  ${i + 1}: ${lines[i]}`);
      }
    }
  });
});
