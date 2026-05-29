const fs = require('fs');
const path = require('path');
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

const files = fs.readdirSync(migrationsDir);
files.sort().forEach(file => {
  if (!file.endsWith('.sql')) return;
  const filePath = path.join(migrationsDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.toLowerCase().includes('create table') && content.toLowerCase().includes('comment')) {
    console.log(`Found comment table creation in ${file}`);
  }
});
