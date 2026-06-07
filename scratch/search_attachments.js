const fs = require('fs');
const path = require('path');
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

const files = fs.readdirSync(migrationsDir);
files.forEach(file => {
  if (!file.endsWith('.sql')) return;
  const filePath = path.join(migrationsDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.toLowerCase().includes('create table') && content.toLowerCase().includes('attachment')) {
    console.log(`Found attachment table creation in ${file}`);
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes('create table') && line.toLowerCase().includes('attachment')) {
        for (let i = idx; i < idx + 25; i++) {
          console.log(`  ${i + 1}: ${lines[i]}`);
        }
      }
    });
  }
});
