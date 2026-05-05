const fs = require('fs');
const lines = fs.readFileSync('app/dashboard/inspection-v2/workspace/page.tsx', 'utf8').split('\n');

let braces = 0;
let parens = 0;

for (let i = 5440; i < 6800; i++) {
    const line = lines[i];
    if (!line) continue;
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '{') braces++;
        if (char === '}') braces--;
        if (char === '(') parens++;
        if (char === ')') parens--;
    }
}

console.log(`Braces: ${braces}, Parens: ${parens}`);
