const fs = require('fs');
const path = require('path');

function walk(dir) {
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (file === 'node_modules' || file === '.git' || file === '.next') return;
          walk(fullPath);
        } else {
          if (file.endsWith('.sql') || file.endsWith('.js') || file.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('ON public.comment') || content.includes('ON comment') || content.includes('ON "comment"')) {
              console.log('FOUND COMMENT POLICY IN:', fullPath);
              const lines = content.split('\n');
              lines.forEach((l, idx) => {
                if (l.includes('comment')) {
                  console.log(`  Line ${idx+1}:`, l.trim());
                }
              });
            }
          }
        }
      } catch (e) {}
    });
  } catch (e) {}
}

console.log('Searching all SQL/JS/TS files...');
walk('.');
console.log('Finished.');
