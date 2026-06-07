const fs = require('fs');
const path = require('path');

function readLogs() {
    const logPath = path.join(__dirname, '..', 'dev_output.log');
    if (fs.existsSync(logPath)) {
        const text = fs.readFileSync(logPath, 'utf16le');
        const lines = text.split('\n');
        console.log(`Total log lines: ${lines.length}`);
        console.log('--- LAST 100 LINES OF DEV LOGS ---');
        lines.slice(-100).forEach(line => console.log(line));
    } else {
        console.log('dev_output.log does not exist');
    }
}

readLogs();
