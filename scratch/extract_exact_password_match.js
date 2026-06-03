const fs = require('fs');
const path = require('path');

const logFiles = [
  "C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain\\36b67ed6-713f-4e8c-a154-0225f7e3b6d8\\.system_generated\\logs\\overview.txt",
  "C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain\\99bb6b55-b82b-4546-93aa-dd51a396a2a7\\.system_generated\\logs\\transcript.jsonl",
  "C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain\\dc56bc48-86b0-42be-86de-c010c7981e17\\.system_generated\\logs\\transcript.jsonl",
  "C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain\\e7e9de78-677c-4d7d-8258-75f08f69aca3\\.system_generated\\logs\\transcript.jsonl",
  "C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain\\ea3d496d-46d5-41a4-b865-1411215de6eb\\.system_generated\\logs\\transcript.jsonl"
];

logFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(/postgresql:\/\/[^\s"'`]+/g);
    if (matches) {
      console.log(`Matches in ${file}:`);
      matches.forEach(m => console.log("  ", m));
    }
  }
});
