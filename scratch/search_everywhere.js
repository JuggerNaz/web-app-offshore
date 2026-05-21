const fs = require('fs');
const path = require('path');

function searchFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > 10 * 1024 * 1024) return; // Skip files larger than 10MB
    const content = fs.readFileSync(filePath);
    const idx = content.indexOf('wincairs');
    if (idx !== -1) {
      console.log(`FOUND 'wincairs' in file: ${filePath}`);
      const start = Math.max(0, idx - 100);
      const end = Math.min(content.length, idx + 500);
      const slice = content.slice(start, end);
      console.log("Snippet:\n", slice.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ''));
    }
  } catch (err) {
    // Ignore
  }
}

function traverse(dir, depth = 0) {
  if (depth > 8) return;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          // Avoid scanning huge system directories that are irrelevant
          if (file === 'node_modules' || file === '.git' || file === 'Cache' || file === 'System Volume Information' || file === 'Windows') continue;
          traverse(fullPath, depth + 1);
        } else if (stats.isFile()) {
          // Skip common binary types that won't contain credentials
          if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.gif') || file.endsWith('.exe') || file.endsWith('.dll') || file.endsWith('.zip')) continue;
          searchFile(fullPath);
        }
      } catch (err) {
        // Ignore
      }
    }
  } catch (err) {
    // Ignore
  }
}

function main() {
  const localAppData = process.env.LOCALAPPDATA;
  const appData = process.env.APPDATA;
  
  if (localAppData) {
    console.log("Searching LOCALAPPDATA:", localAppData);
    traverse(localAppData);
  }
  if (appData) {
    console.log("Searching APPDATA:", appData);
    traverse(appData);
  }
}

main();
