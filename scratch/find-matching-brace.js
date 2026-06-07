const fs = require('fs');
const lines = fs.readFileSync('app/dashboard/inspection-v2/workspace/page.tsx', 'utf-8').split('\n');

let targetLine = 6796; // 0-indexed
let balance = 0;
for (let i = targetLine; i >= 0; i--) {
  const line = lines[i];
  for (let j = line.length - 1; j >= 0; j--) {
    if (line[j] === '}') balance++;
    if (line[j] === '{') balance--;
    if (balance === 0) {
      console.log('Matching opening brace found at line:', i + 1, 'Content:', line.trim());
      process.exit(0);
    }
  }
}
