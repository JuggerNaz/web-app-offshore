const fs = require('fs');
const path = require('path');
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

const files = fs.readdirSync(migrationsDir);
files.forEach(file => {
  if (!file.endsWith('.sql')) return;
  const filePath = path.join(migrationsDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.toLowerCase().includes('structure_components')) {
    console.log(`Found mention of structure_components in ${file}`);
  }
});
