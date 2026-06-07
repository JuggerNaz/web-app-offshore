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
            if (content.includes('ON public.platform') || content.includes('ON platform') || content.includes('ON "platform"')) {
              console.log('FOUND PLATFORM POLICY IN:', fullPath);
              const lines = content.split('\n');
              lines.forEach((l, idx) => {
                if (l.includes('platform')) {
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

console.log('Searching...');
walk('.');
console.log('Finished.');
