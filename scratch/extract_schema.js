const fs = require('fs');
const content = fs.readFileSync('supabase/schema_utf8.ts', 'utf8');
const lines = content.split('\n');
let found = false;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('u_sow_items: {')) {
        console.log(lines.slice(i, i + 50).join('\n'));
        found = true;
        break;
    }
}
if (!found) console.log('u_sow_items not found in schema file');
