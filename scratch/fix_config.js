const fs = require('fs');
const content = fs.readFileSync('utils/spec-ui-config.json', 'utf-8');
const json = JSON.parse(content.replace(/\}[\s\n]*\},/g, '},')); // Attempt a quick fix or just re-parse

// Actually, let's just parse it and see.
try {
    const data = JSON.parse(content);
    console.log('JSON is already valid');
} catch (e) {
    console.log('JSON is invalid, fixing...');
    // The issue is the extra brace
    const fixedContent = content.replace(/    \}\n    \},/g, '    },');
    fs.writeFileSync('utils/spec-ui-config.json', fixedContent);
    // Try parsing again
    try {
        JSON.parse(fixedContent);
        console.log('Successfully fixed spec-ui-config.json');
    } catch (e2) {
        console.error('Failed to fix spec-ui-config.json:', e2.message);
    }
}
