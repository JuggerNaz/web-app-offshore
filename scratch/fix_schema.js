import fs from 'fs';
const content = fs.readFileSync('supabase/schema_utf8.ts', 'utf8');
fs.writeFileSync('supabase/schema.ts', content, 'utf8');
console.log('Successfully copied schema_utf8.ts to schema.ts');
