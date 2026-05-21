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
        if (file.toLowerCase().endsWith('.txt') || file.toLowerCase().endsWith('.json') || file.toLowerCase().endsWith('.jsonl')) {
          if (stat.size < 2000000) {
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              if (content.includes('wincairs')) {
                // Let's print any connection code or passwords or configs!
                const lines = content.split(/\r?\n/);
                for (let i = 0; i < lines.length; i++) {
                  const line = lines[i];
                  if (line.includes('password') || line.includes('wincairs') || line.includes('connectString')) {
                    // Match line with connectString, password, or user
                    if (line.includes('password') && !line.includes('password123')) {
                      console.log(`[FOUND LINE] ${file} (Line ${i+1}): ${line.trim().slice(0, 300)}`);
                    }
                  }
                }
              }
            } catch (e) {}
          }
        }
      }
    }
  } catch (e) {}
}

const target = "C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain";
console.log("Searching in:", target);
search(target);
