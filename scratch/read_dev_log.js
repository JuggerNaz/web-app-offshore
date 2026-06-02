const fs = require('fs');

try {
    const fileContent = fs.readFileSync('dev_output.log', 'utf16le');
    const lines = fileContent.split('\n');
    console.log(`dev_output.log has ${lines.length} lines.`);
    console.log("Last 100 lines:");
    lines.slice(-100).forEach(line => console.log(line.trim()));
} catch (e) {
    console.error("Failed to read dev_output.log:", e);
}
