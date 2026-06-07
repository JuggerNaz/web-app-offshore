const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  files.forEach(f => {
    const fullPath = path.join(dir, f);
    if (fs.statSync(fullPath).isDirectory()) {
      searchDir(fullPath);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('migration/execute') || content.includes('/execute')) {
        console.log(`Found call in file: ${fullPath}`);
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('migration/execute') || line.includes('fetch(') || line.includes('axios.')) {
            console.log(`  Line ${idx+1}: ${line.trim()}`);
          }
        });
      }
    }
  });
}

searchDir('./app');
searchDir('./components');
