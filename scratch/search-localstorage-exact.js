const fs = require('fs');
const path = require('path');

function searchFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > 50 * 1024 * 1024) return; // Skip files larger than 50MB
    const content = fs.readFileSync(filePath);
    
    // Check if it has 'migration_db_config'
    const idx = content.indexOf('migration_db_config');
    if (idx !== -1) {
      console.log(`\n========================================`);
      console.log(`FOUND 'migration_db_config' in file: ${filePath}`);
      
      // Extract printable characters around the match
      const start = Math.max(0, idx - 200);
      const end = Math.min(content.length, idx + 1000);
      const slice = content.slice(start, end);
      const cleanString = slice.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      console.log("DUMP:");
      console.log(cleanString);
    }
  } catch (err) {}
}

function traverse(dir, depth = 0) {
  if (depth > 8) return;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          traverse(fullPath, depth + 1);
        } else if (stats.isFile()) {
          if (file.endsWith('.ldb') || file.endsWith('.log')) {
            searchFile(fullPath);
          }
        }
      } catch (err) {}
    }
  } catch (err) {}
}

const localAppData = process.env.LOCALAPPDATA;
if (localAppData) {
  const bases = [
    path.join(localAppData, 'Google/Chrome/User Data'),
    path.join(localAppData, 'Microsoft/Edge/User Data')
  ];
  for (const base of bases) {
    if (fs.existsSync(base)) {
      console.log("Scanning base:", base);
      traverse(base);
    }
  }
}
console.log("Finished exact Local Storage search!");
