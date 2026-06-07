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
            if (content.includes('zpsmxtdqlpbdwfzctqzd') && (content.includes('postgresql://') || content.includes('sb-') || content.includes('eyJ'))) {
              console.log('FOUND MATCH IN BRAIN FILE:', fullPath);
              const lines = content.split('\n');
              lines.forEach((l, idx) => {
                if (l.includes('postgresql://') || l.includes('eyJ') || l.includes('zpsmxtdqlpbdwfzctqzd')) {
                  console.log(`  Line ${idx+1}:`, l.substring(0, 300).trim());
                }
              });
            }
          }
        }
      } catch (e) {}
    });
  } catch (e) {}
}

console.log('Searching all brains...');
walk('C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain');
console.log('Finished search.');
