const fs = require('fs');

if (fs.existsSync('dev_output.log')) {
    const content = fs.readFileSync('dev_output.log', 'utf16le'); // Read as UTF-16LE as seen earlier
    const lines = content.split('\n');
    console.log('--- Last 20 lines of dev server ---');
    lines.slice(-20).forEach(l => console.log(l.trim()));
    
    // Look for port
    const match = content.match(/http:\/\/localhost:(\d+)/);
    if (match) {
        console.log('Detected Dev Server Port:', match[1]);
    } else {
        console.log('No dev server URL pattern found in log.');
    }
} else {
    console.log('dev_output.log does not exist');
}
