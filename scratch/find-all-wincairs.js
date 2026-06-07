const fs = require('fs');
const path = require('path');

function search(dir) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (file === 'node_modules' || file === '.git' || file === '.next') continue;
        search(fullPath);
      } else {
        if (stat.size < 5000000) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('wincairs')) {
              console.log("========================================");
              console.log("Found wincairs in:", fullPath);
              const lines = content.split(/\r?\n/);
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('wincairs') || lines[i].includes('password') || lines[i].includes('connectString') || lines[i].includes('host')) {
                  console.log(`Line ${i+1}: ${lines[i].trim().slice(0, 300)}`);
                }
              }
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
}

search("C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain");
