import fs from 'fs';
import path from 'path';

function searchDir(dir, pattern) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        if (file.name === 'node_modules' || file.name === '.next' || file.name === '.git') continue;
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            searchDir(fullPath, pattern);
        } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx') || file.name.endsWith('.sql') || file.name.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes(pattern)) {
                console.log(`Found "${pattern}" in: ${fullPath}`);
            }
        }
    }
}

searchDir('.', 'registered_devices');
searchDir('.', 'device_token');
searchDir('.', 'device_restriction_type');

