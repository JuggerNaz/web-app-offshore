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
      if (content.toLowerCase().includes('create table') && content.toLowerCase().includes('structure_components')) {
        console.log(`Found in ${filePath}`);
      }
    }
  });
}

console.log("Searching all SQL files in workspace...");
searchDir(process.cwd());
