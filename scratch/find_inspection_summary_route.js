const fs = require('fs');

if (fs.existsSync('app/api/inspection-summary/route.ts')) {
  const content = fs.readFileSync('app/api/inspection-summary/route.ts', 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('anomalies') || line.includes('priority') || line.includes('query')) {
      console.log(idx + 1, line.trim());
    }
  });
} else {
  console.log("File does not exist!");
}
