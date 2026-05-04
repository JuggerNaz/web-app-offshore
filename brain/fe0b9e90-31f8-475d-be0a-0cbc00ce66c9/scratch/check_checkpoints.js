const fs = require('fs');
const lines = fs.readFileSync('app/dashboard/inspection-v2/workspace/page.tsx', 'utf8').split('\n');

function checkBalance(start, end) {
    let braces = 0;
    for (let i = start; i < end; i++) {
        const line = lines[i];
        if (!line) continue;
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '{') braces++;
            if (char === '}') braces--;
        }
    }
    return braces;
}

console.log(`Balance 0 to 5440: ${checkBalance(0, 5440)}`);
console.log(`Balance 5440 to 6120: ${checkBalance(5440, 6120)}`);
console.log(`Balance 6120 to 6500: ${checkBalance(6120, 6500)}`);
console.log(`Balance 6500 to 6800: ${checkBalance(6500, 6800)}`);
