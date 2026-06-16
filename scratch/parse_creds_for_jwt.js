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

async function main() {
  const filePath = path.join(__dirname, 'creds_utf8.txt');
  if (!fs.existsSync(filePath)) {
    console.error("creds_utf8.txt does not exist");
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  // Match JWT strings
  const regex = /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;
  let match;
  const found = new Set();
  while ((match = regex.exec(content)) !== null) {
    const token = match[0];
    if (found.has(token)) continue;
    found.add(token);
    
    const decoded = decodeJWT(token);
    if (decoded) {
      console.log('--- Decoded JWT ---');
      console.log('Role:', decoded.role);
      console.log('Decoded Payload:', JSON.stringify(decoded, null, 2));
      console.log('Token:', token);
    }
  }
}

main().catch(console.error);
