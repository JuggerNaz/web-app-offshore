const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\nq352\\Documents\\GitHub\\web-app-offshore\\app\\dashboard\\inspection-v2\\workspace\\components\\InspectionForm.tsx', 'utf8');

let curly = 0;
let round = 0;
let square = 0;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '{') curly++;
    else if (char === '}') curly--;
    else if (char === '(') round++;
    else if (char === ')') round--;
    else if (char === '[') square++;
    else if (char === ']') square--;
    
    if (curly < 0 || round < 0 || square < 0) {
        console.log(`Mismatch at index ${i} (char: ${char}): curly=${curly}, round=${round}, square=${square}`);
        // Log the surrounding text
        console.log(content.substring(i - 50, i + 50));
        process.exit(1);
    }
}

console.log(`Final counts: curly=${curly}, round=${round}, square=${square}`);
if (curly !== 0 || round !== 0 || square !== 0) {
    console.log('UNBALANCED!');
} else {
    console.log('Balanced!');
}
