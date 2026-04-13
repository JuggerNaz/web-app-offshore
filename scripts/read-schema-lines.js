const fs = require('fs');
const lines = fs.readFileSync('supabase/schema.ts', 'utf8').split('\n');

for (let i = 1370; i < 1520; i++) {
    console.log(`${i}: ${lines[i-1]}`);
}
