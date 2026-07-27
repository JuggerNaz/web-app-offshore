const fs = require('fs');
const readline = require('readline');

const transcriptPath = 'C:\\Users\\nq262\\.gemini\\antigravity-ide\\brain\\6c79b644-8b0e-42de-9079-62450872aefe\\.system_generated\\logs\\transcript.jsonl';

async function run() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let step = 0;
  for await (const line of rl) {
    step++;
    const obj = JSON.parse(line);
    if (obj.tool_calls) {
      for (const call of obj.tool_calls) {
        if (call.name === 'replace_file_content' || call.name === 'multi_replace_file_content' || call.name === 'write_to_file') {
          const target = call.args.TargetFile;
          if (target && target.includes('page.tsx')) {
            console.log(`=== Step ${step} (${call.name}) ===`);
            console.log(`File: ${target}`);
            console.log(JSON.stringify(call.args, null, 2));
            console.log('===================================\n');
          }
        }
      }
    }
  }
}

run();
