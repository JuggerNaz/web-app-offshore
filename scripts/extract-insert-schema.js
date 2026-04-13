const fs = require('fs');
const content = fs.readFileSync('supabase/schema.ts', 'utf8');

const regex = /structure_components: \{[\s\n]+Row: \{[\s\S]+?\}[\s\n]+Insert: \{([\s\S]+?)\}/;
const match = content.match(regex);

if (match) {
    console.log('Insert schema for structure_components:');
    console.log(match[1].trim());
} else {
    console.log('Could not find Insert schema for structure_components');
}
