const fs = require('fs');
const content = fs.readFileSync('app/dashboard/inspection-v2/workspace/page.tsx', 'utf-8');

let braces = 0;
for (let char of content) {
  if (char === '{') braces++;
  if (char === '}') braces--;
}

console.log('Final brace count (should be 0):', braces);
