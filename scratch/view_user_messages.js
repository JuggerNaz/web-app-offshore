const fs = require('fs');
const readline = require('readline');

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
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'USER_INPUT' || obj.source === 'USER_EXPLICIT') {
        console.log(`[Line ${lineNum} - Step ${obj.step_index}] USER:`, obj.content);
        console.log('-'.repeat(40));
      }
    } catch (e) {}
  }
}

search().catch(console.error);
