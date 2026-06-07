const fs = require('fs');
const path = require('path');

const targetFile = "C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain\\36b67ed6-713f-4e8c-a154-0225f7e3b6d8\\.system_generated\\logs\\overview.txt";
if (fs.existsSync(targetFile)) {
  const content = fs.readFileSync(targetFile, 'utf8');
  console.log('File size:', content.length);
  // Look for postgresql://
  const idx = content.indexOf('postgresql://');
  if (idx !== -1) {
    console.log('Found postgresql:// at index', idx);
    console.log(content.substring(idx - 50, idx + 150));
  } else {
    console.log('postgresql:// not found in overview.txt');
  }
} else {
  console.log('File does not exist:', targetFile);
}
