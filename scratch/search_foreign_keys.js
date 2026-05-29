const fs = require('fs');
const path = require('path');
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

const files = fs.readdirSync(migrationsDir);
files.sort().forEach(file => {
  if (!file.endsWith('.sql')) return;
  const filePath = path.join(migrationsDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  let printedFile = false;
  lines.forEach((line, idx) => {
    const lLower = line.toLowerCase();
    if (lLower.includes('references') && lLower.includes('delete')) {
      if (!printedFile) {
        console.log(`\n=== References in ${file} ===`);
        printedFile = true;
      }
      console.log(`  ${idx + 1}: ${line.trim()}`);
    }
  });
});
