const fs = require('fs');

const content = fs.readFileSync('app/dashboard/reports/executive-summary/page.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('fetch(') || line.includes('insight')) {
    console.log(idx + 1, line.trim());
  }
});
