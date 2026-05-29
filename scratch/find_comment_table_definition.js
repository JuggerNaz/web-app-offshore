const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.next') {
        searchDir(filePath);
      }
    } else if (file.endsWith('.sql')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('create table') && line.toLowerCase().includes('comment')) {
          console.log(`Found on-line match in ${filePath} at line ${idx + 1}: ${line.trim()}`);
        }
      });
    }
  });
}

searchDir(process.cwd());
