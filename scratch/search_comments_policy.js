const fs = require('fs');
const path = require('path');

const dir = './';
try {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (file.endsWith('.sql')) {
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      const lines = content.split('\n');
      
      let printedFile = false;
      lines.forEach((l, idx) => {
        const lowerLine = l.toLowerCase();
        if (lowerLine.includes('policy') && (lowerLine.includes('comment') || lowerLine.includes('str_elv'))) {
          if (!printedFile) {
            console.log('\nMatch in file:', file);
            printedFile = true;
          }
          console.log(`  Line ${idx+1}:`, l.trim());
        }
        if (lowerLine.includes('row level security') && (lowerLine.includes('comment') || lowerLine.includes('str_elv'))) {
          if (!printedFile) {
            console.log('\nMatch in file:', file);
            printedFile = true;
          }
          console.log(`  Line ${idx+1}:`, l.trim());
        }
      });
    }
  });
} catch (e) {
  console.error(e);
}
