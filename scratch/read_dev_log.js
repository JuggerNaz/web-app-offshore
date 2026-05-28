const fs = require('fs');

if (fs.existsSync('dev_output.log')) {
    const content = fs.readFileSync('dev_output.log', 'utf16le');
    const lines = content.split('\n');
    console.log('--- Last 50 lines of dev server log ---');
    lines.slice(-50).forEach(l => console.log(l.trim()));
} else {
    console.log('dev_output.log does not exist');
}
