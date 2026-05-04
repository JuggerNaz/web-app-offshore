const fs = require('fs');
const content = fs.readFileSync('app/dashboard/inspection-v2/workspace/page.tsx', 'utf8');
const lines = content.split('\n');

function check(startLine, endLine) {
    let braces = 0;
    let parens = 0;
    let tags = [];
    
    for (let i = startLine - 1; i < endLine; i++) {
        const line = lines[i];
        if (!line) continue;
        
        // Match tags
        const tagMatches = line.matchAll(/<([a-zA-Z0-9]+)|<\/([a-zA-Z0-9]+)>/g);
        for (const match of tagMatches) {
            if (match[1]) {
                if (!line.includes('/>') && !match[0].endsWith('/>')) {
                     tags.push(match[1]);
                }
            } else if (match[2]) {
                const last = tags.pop();
                if (last !== match[2]) {
                    console.log(`Tag mismatch at line ${i+1}: expected ${last}, got ${match[2]}`);
                }
            }
        }

        for (let j = 0; j < line.length; j++) {
            if (line[j] === '{') braces++;
            if (line[j] === '}') braces--;
            if (line[j] === '(') parens++;
            if (line[j] === ')') parens--;
        }
    }
    return { braces, parens, tags };
}

console.log('Checking COL 2 (5753 - 6775):', check(5753, 6775));
console.log('Checking COL 1 (5608 - 5750):', check(5608, 5750));
