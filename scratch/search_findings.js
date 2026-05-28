const fs = require('fs');
const content = fs.readFileSync('app/api/migration/execute/route.ts', 'utf8');
const lines = content.split('\n');
const terms = ['findings', 'COMMENTS', 'CMNTS', 'INSP_COND', 'INSPCOND', 'insp_cond', 'comments', 'platgi', 'PLATGI', 'Phase 4', 'Phase 5'];
for (const term of terms) {
  console.log(`\n=== ${term} ===`);
  lines.forEach((l, i) => {
    if (l.includes(term)) console.log(`  L${i+1}: ${l.trim().substring(0, 150)}`);
  });
}
