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
          // Check files for postgresql or pooler.supabase.com or any postgres password
          if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.json') || file.endsWith('.env') || file.endsWith('.local') || file.endsWith('.sql') || file.endsWith('.mjs') || file.endsWith('.txt')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('postgresql://') || content.includes('pooler.supabase') || content.includes('supabase.com:6543')) {
              console.log('FOUND postgresql URL in:', fullPath);
              const lines = content.split('\n');
              lines.forEach((l, idx) => {
                if (l.includes('postgresql://') || l.includes('pooler.supabase') || l.includes('supabase.com:6543')) {
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

console.log('Scanning workspace...');
walk('c:\\Users\\nq352\\Documents\\GitHub\\web-app-offshore');
console.log('Finished scanning workspace.');
