const fs = require('fs');
const path = require('path');
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

const files = fs.readdirSync(migrationsDir);
files.forEach(file => {
  if (!file.endsWith('.sql')) return;
  const filePath = path.join(migrationsDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('create table') && (line.toLowerCase().includes('structure') || line.toLowerCase().includes('platform') || line.toLowerCase().includes('pipeline'))) {
      if (!line.toLowerCase().includes('components') && !line.toLowerCase().includes('movements') && !line.toLowerCase().includes('jobs') && !line.toLowerCase().includes('type')) {
        console.log(`Found in ${file} at line ${idx + 1}: ${line.trim()}`);
      }
    }
  });
});
