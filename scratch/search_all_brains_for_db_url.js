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
          walk(fullPath);
        } else {
          if (file.endsWith('.jsonl') || file.endsWith('.md') || file.endsWith('.json') || file.endsWith('.txt')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('zpsmxtdqlpbdwfzctqzd') && (content.includes('postgresql://') || content.includes('SERVICE_ROLE')) && !content.includes('YOUR_DATABASE_PASSWORD')) {
              console.log('FOUND IN BRAIN FILE:', fullPath);
              const lines = content.split('\n');
              lines.forEach((l, idx) => {
                if ((l.includes('postgresql://') || l.includes('SERVICE_ROLE')) && !l.includes('YOUR_DATABASE_PASSWORD')) {
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

console.log('Searching all brains for DB URL with password...');
walk('C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain');
console.log('Finished search.');
