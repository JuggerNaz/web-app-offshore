const fs = require('fs');
try {
  const content = fs.readFileSync('dev_output.log', 'utf16le');
  const lines = content.split('\n');
  console.log("Last 100 lines of dev_output.log:");
  lines.slice(-100).forEach(l => console.log(l.trim()));
} catch (err) {
  console.error("Error:", err);
}
