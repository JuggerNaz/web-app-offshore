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
          if (file.endsWith('.jsonl') || file.endsWith('.md') || file.endsWith('.txt')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            // Look for any occurrences of component mappings like "AN": or "BB": with oracleCol
            if (content.includes('oracleCol') && (content.includes('"AN":') || content.includes('"BB":') || content.includes('"CL":'))) {
              console.log('FOUND MATCH IN LOG FILE:', fullPath);
              // Print around matching lines
              const lines = content.split('\n');
              lines.forEach((l, idx) => {
                if (l.includes('"AN":') || l.includes('"BB":') || l.includes('oracleCol')) {
                  // If it looks like a JSON block, print it
                  if (l.length > 50 && l.length < 2000) {
                    console.log(`  Line ${idx+1}:`, l.trim());
                  }
                }
              });
            }
          }
        }
      } catch (e) {}
    });
  } catch (e) {}
}

console.log('Scanning all conversation history logs for component mappings...');
walk('C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain');
console.log('Finished scan.');
