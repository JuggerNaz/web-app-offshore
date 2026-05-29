const fs = require('fs');
const file = 'C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain\\99bb6b55-b82b-4546-93aa-dd51a396a2a7\\.system_generated\\logs\\transcript.jsonl';

if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('zpsmxtdqlpbdwfzctqzd') && line.includes('postgresql://') && !line.includes('YOUR_DATABASE_PASSWORD')) {
      // Find the postgresql:// url and print 100 characters around it
      const startIdx = line.indexOf('postgresql://');
      if (startIdx !== -1) {
        console.log(`Line ${idx+1}:`, line.substring(startIdx, startIdx + 150));
      }
    }
  });
} else {
  console.log('File does not exist');
}
