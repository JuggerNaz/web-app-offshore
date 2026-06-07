const fs = require('fs');
const content = fs.readFileSync('app/api/migration/execute/route.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('createClient')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
