const fs = require('fs');
const lines = fs.readFileSync('app/dashboard/inspection-v2/workspace/page.tsx', 'utf-8').split('\n');

let balance = 0;
for (let i = 6336; i < 7008; i++) {
  const line = lines[i];
  // Simple check for JSX braces
  for (let char of line) {
    if (char === '{') balance++;
    if (char === '}') balance--;
  }
}

console.log('JSX block brace balance:', balance);
