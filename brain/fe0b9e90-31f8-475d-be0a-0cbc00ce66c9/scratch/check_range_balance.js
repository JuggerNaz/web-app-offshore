const fs = require('fs');
const lines = fs.readFileSync('app/dashboard/inspection-v2/workspace/page.tsx', 'utf8').split('\n');

const start = 5753;
const end = 6775;

let braces = 0;
let parens = 0;

for (let i = start - 1; i < end; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '{') braces++;
        if (char === '}') braces--;
        if (char === '(') parens++;
        if (char === ')') parens--;
    }
}

console.log(`Braces: ${braces}, Parens: ${parens}`);
