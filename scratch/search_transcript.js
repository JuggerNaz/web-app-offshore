const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function search() {
  const filePath = "C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain\\a27290a1-4b6b-4ca1-b1b0-c71c1c879d7e\\.system_generated\\logs\\transcript.jsonl";
  
  if (!fs.existsSync(filePath)) {
    console.error("File does not exist:", filePath);
    return;
  }
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    // Search for keywords
    if (line.includes('DATABASE_URL') || line.includes('SERVICE_ROLE') || line.includes('password') || line.includes('postgresql://')) {
      // Print first 500 characters of matching line
      console.log(`[Line ${lineNum}] Match:`, line.substring(0, 300));
    }
  }
}

search().catch(console.error);
