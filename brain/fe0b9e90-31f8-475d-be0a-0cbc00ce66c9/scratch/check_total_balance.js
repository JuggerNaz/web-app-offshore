const fs = require('fs');
const content = fs.readFileSync('app/dashboard/inspection-v2/workspace/page.tsx', 'utf8');

let braces = 0;
for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') braces++;
    if (content[i] === '}') braces--;
}
console.log(`Total Braces: ${braces}`);
