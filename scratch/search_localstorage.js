const fs = require('fs');
const path = require('path');

function searchLevelDB(dir) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.endsWith('.log') || file.endsWith('.ldb')) {
        const filePath = path.join(dir, file);
        try {
          const content = fs.readFileSync(filePath);
          const idx = content.indexOf('wincairs');
          if (idx !== -1) {
            console.log(`Found 'wincairs' in ${filePath}`);
            const start = Math.max(0, idx - 100);
            const end = Math.min(content.length, idx + 500);
            const slice = content.slice(start, end);
            const str = slice.toString('utf8');
            console.log("Extracted content:\n", str.replace(/[^\x20-\x7E\n\r\t]/g, ''));
          }
        } catch (err) {
          // Ignore read errors
        }
      }
    }
  } catch (err) {
    // Ignore dir errors
  }
}

function findLevelDBDirs(currentDir, depth = 0) {
  if (depth > 5) return;
  try {
    const stats = fs.statSync(currentDir);
    if (!stats.isDirectory()) return;

    if (currentDir.endsWith(path.join('Local Storage', 'leveldb'))) {
      searchLevelDB(currentDir);
      return;
    }

    const children = fs.readdirSync(currentDir);
    for (const child of children) {
      findLevelDBDirs(path.join(currentDir, child), depth + 1);
    }
  } catch (err) {
    // Ignore
  }
}

function main() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    console.error("LOCALAPPDATA not defined");
    return;
  }

  const bases = [
    path.join(localAppData, 'Google/Chrome/User Data'),
    path.join(localAppData, 'Microsoft/Edge/User Data')
  ];

  for (const base of bases) {
    if (fs.existsSync(base)) {
      console.log("Scanning base:", base);
      findLevelDBDirs(base);
    }
  }
}

main();
