const fs = require('fs');
const dotenv = require('dotenv');

console.log('--- checking .env files ---');
['.env', '.env.local', '.env.development', '.env.production'].forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`File ${file} exists!`);
        const content = fs.readFileSync(file, 'utf8');
        const parsed = dotenv.parse(content);
        console.log(`Keys in ${file}:`, Object.keys(parsed));
    } else {
        console.log(`File ${file} does not exist.`);
    }
});
