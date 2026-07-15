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
          console.log(fullPath);
        }
      } catch (e) {}
    });
  } catch (e) {}
}

walk('C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain');
