const fs = require('fs');
const content = fs.readFileSync('app/dashboard/inspection-v2/workspace/page.tsx', 'utf8');

let braces = 0;
let parens = 0;
let brackets = 0;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '{') braces++;
    if (char === '}') braces--;
    if (char === '(') parens++;
    if (char === ')') parens--;
    if (char === '[') brackets++;
    if (char === ']') brackets--;
    
    if (braces < 0) console.log(`Extra } at char ${i}`);
    if (parens < 0) console.log(`Extra ) at char ${i}`);
    if (brackets < 0) console.log(`Extra ] at char ${i}`);
}

console.log(`Final counts: braces=${braces}, parens=${parens}, brackets=${brackets}`);
