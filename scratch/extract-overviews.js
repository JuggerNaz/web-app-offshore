const fs = require('fs');
const path = require('path');

const overviewPaths = [
  "C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain\\23e101b4-d381-40b0-aaee-5e902839946b\\.system_generated\\logs\\overview.txt",
  "C:\\Users\\nq352\\.gemini\antigravity-ide\\brain\\2a7d41c7-4027-4362-82d9-b74dca537b9e\\.system_generated\\logs\\overview.txt",
  "C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain\\49cbfff8-315a-48ad-800a-2877d4f03c83\\.system_generated\\logs\\overview.txt",
  "C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain\\551e57b2-c5fd-4466-8661-7f47308ed2a7\\.system_generated\\logs\\overview.txt",
  "C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain\\a5901efc-2858-4a40-8f55-9288e9335df0\\.system_generated\\logs\\overview.txt",
  "C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain\\e7142489-515b-40d5-b3e1-309c513b3cc5\\.system_generated\\logs\\overview.txt",
  "C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain\\ec506823-4627-472f-9fe0-d3e3c160db06\\.system_generated\\logs\\overview.txt"
];

for (const p of overviewPaths) {
  if (fs.existsSync(p)) {
    console.log("\n==================================================");
    console.log("FILE:", p);
    const content = fs.readFileSync(p, 'utf8');
    console.log(content);
  }
}
