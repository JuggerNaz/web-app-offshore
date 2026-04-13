const fs = require('fs');
const content = fs.readFileSync('supabase/schema.ts', 'utf8');

const regex = /structure_components: \{[\s\n]+Row: \{([\s\S]+?)\}/;
const match = content.match(regex);

if (match) {
    console.log('--- Row Columns ---');
    console.log(match[1]);
} else {
    console.log('Not found');
}
