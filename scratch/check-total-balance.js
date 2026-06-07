const fs = require('fs');
const content = fs.readFileSync('app/dashboard/inspection-v2/workspace/page.tsx', 'utf-8');

let balance = 0;
for (let i = 0; i < content.length; i++) {
  if (content[i] === '{') balance++;
  if (content[i] === '}') balance--;
}

console.log('Total file balance:', balance);
