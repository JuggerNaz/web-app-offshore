const fs = require('fs');
const path = require('path');

function searchFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > 20 * 1024 * 1024) return; // Skip files larger than 20MB
    const content = fs.readFileSync(filePath);
    
    // Check if it has '1522' or 'orcl10' or 'nq-35' or 'wincairs'
    const has1522 = content.includes('1522');
    const hasOrcl = content.includes('orcl10');
    const hasNq35 = content.includes('nq-35');
    const hasUser = content.includes('wincairs');
    
    if (has1522 || hasOrcl || hasNq35 || hasUser) {
      console.log(`FOUND potential match in browser file: ${filePath}`);
      const lines = content.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').split('\n');
      for (const line of lines) {
        if (line.includes('1522') || line.includes('orcl10') || line.includes('nq-35') || line.includes('wincairs') || line.toLowerCase().includes('password')) {
          if (line.trim().length > 5 && line.trim().length < 1000) {
            console.log("  Line:", line.trim());
          }
        }
      }
    }
  } catch (err) {}
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
          if (file === 'Cache' || file === 'node_modules' || file === '.git' || file === '.next') continue;
          traverse(fullPath, depth + 1);
        } else if (stats.isFile()) {
          if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.exe') || file.endsWith('.dll')) continue;
          searchFile(fullPath);
        }
      } catch (err) {}
    }
  } catch (err) {}
}

const localAppData = process.env.LOCALAPPDATA;
if (localAppData) {
  const bases = [
    path.join(localAppData, 'Google/Chrome/User Data'),
    path.join(localAppData, 'Microsoft/Edge/User Data')
  ];
  for (const base of bases) {
    if (fs.existsSync(base)) {
      console.log("Scanning base:", base);
      traverse(base);
    }
  }
}
console.log("Finished browser search!");
