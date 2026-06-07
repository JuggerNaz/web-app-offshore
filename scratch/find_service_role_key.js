const fs = require('fs');
const path = require('path');

function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
}

function searchFile(fullPath) {
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    // Find all JWT-like strings starting with eyJ
    const regex = /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const token = match[0];
      const decoded = decodeJWT(token);
      if (decoded && decoded.role === 'service_role') {
        console.log('FOUND SERVICE ROLE KEY IN:', fullPath);
        console.log('Key:', token);
        console.log('Decoded Payload:', JSON.stringify(decoded, null, 2));
      }
    }
  } catch (e) {}
}

function walk(dir) {
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (file === 'node_modules' || file === '.git' || file === '.next') return;
          walk(fullPath);
        } else {
          if (file.endsWith('.jsonl') || file.endsWith('.md') || file.endsWith('.json') || file.endsWith('.txt') || file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.local')) {
            searchFile(fullPath);
          }
        }
      } catch (e) {}
    });
  } catch (e) {}
}

console.log('Searching for service role key...');
walk('c:\\Users\\nq352\\Documents\\GitHub\\web-app-offshore');
walk('C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain');
console.log('Search complete.');
