const fs = require('fs');
const readline = require('readline');

async function main() {
  const filePath = "C:\\Users\\nq352\\.gemini\\antigravity-ide\\brain\\22e867e5-416e-4d71-b5aa-6a3aa29279e1\\.system_generated\\logs\\transcript.jsonl";
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes("migrateInspectionsForType") && line.includes("tool_calls")) {
      const obj = JSON.parse(line);
      if (obj.step_index === 1396) {
        console.log(`Found step 1396!`);
        if (obj.tool_calls) {
          obj.tool_calls.forEach(tc => {
            if (tc.args && tc.args.ReplacementContent) {
              const content = tc.args.ReplacementContent;
              fs.writeFileSync("scratch/route_step_1396.ts", content, "utf8");
              console.log("Successfully wrote full ReplacementContent to scratch/route_step_1396.ts");
            }
          });
        }
      }
    }
  }
}

main().catch(console.error);
