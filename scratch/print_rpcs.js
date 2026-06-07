const fs = require('fs');

if (fs.existsSync('supabase/schema.ts')) {
  const content = fs.readFileSync('supabase/schema.ts', 'utf8');
  const start = content.indexOf('Functions: {');
  if (start !== -1) {
    console.log('--- RPC Functions ---');
    console.log(content.substring(start, start + 2000));
  } else {
    console.log('Functions section not found');
  }
} else {
  console.log('supabase/schema.ts does not exist');
}
