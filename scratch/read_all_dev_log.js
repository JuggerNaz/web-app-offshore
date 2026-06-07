const fs = require('fs');

if (fs.existsSync('dev_output.log')) {
    const content = fs.readFileSync('dev_output.log', 'utf16le');
    console.log('--- ENTIRE DEV LOG ---');
    console.log(content);
    console.log('--- END OF DEV LOG ---');
} else {
    console.log('dev_output.log does not exist');
}
