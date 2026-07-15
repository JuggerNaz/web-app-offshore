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
            // Search for any occurrence of component mappings
            if (content.includes('oracleCol') && content.includes('pgCol')) {
              // Let's check if the file contains component codes like "AN" or "BB" or "CL"
              if (content.includes('"AN"') || content.includes('"BB"') || content.includes('"CD"') || content.includes('"CL"')) {
                console.log('FOUND POSSIBLE MAPPING IN:', fullPath);
                
                // Let's find index of "AN" or "BB" and print a snippet
                const lines = content.split('\n');
                lines.forEach((l, idx) => {
                  if ((l.includes('"AN"') || l.includes('"BB"') || l.includes('"CD"') || l.includes('"CL"')) && l.includes('oracleCol')) {
                    console.log(`  Line ${idx+1}:`, l.trim().substring(0, 400));
                  }
                });
              }
            }
          }
        }
      } catch (e) {}
    });
  } catch (e) {}
}

console.log('Searching all brains for mappings JSON...');
walk('C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain');
console.log('Finished.');
