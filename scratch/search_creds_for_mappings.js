const fs = require('fs');
const path = require('path');

const credsPath = path.join(__dirname, 'creds.txt');

if (fs.existsSync(credsPath)) {
  const content = fs.readFileSync(credsPath, 'utf8');
  console.log("Searching creds.txt...");
  
  // Find any lines mentioning mappings or containing component codes with oracleCol
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    if (l.includes('oracleCol') && (l.includes('"AN"') || l.includes('"BB"') || l.includes('"CD"') || l.includes('"CL"'))) {
      console.log(`FOUND in Line ${idx+1}:`, l.substring(0, 400));
    }
  });
} else {
  console.log("creds.txt not found");
}
