const fs = require('fs');

if (fs.existsSync('dev_output.log')) {
    const content = fs.readFileSync('dev_output.log', 'utf16le');
    const lines = content.split('\n');
    console.log('Searching for errors in dev server log...');
    
    let found = false;
    lines.forEach((line, index) => {
        if (line.includes('500') || line.toLowerCase().includes('error') || line.includes('elevation') || line.includes('comment')) {
            console.log(`[Line ${index}] ${line.trim()}`);
            found = true;
        }
    });
    if (!found) {
        console.log('No matching error lines found in log.');
    }
} else {
    console.log('dev_output.log does not exist');
}
