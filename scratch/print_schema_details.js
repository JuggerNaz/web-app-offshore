const fs = require('fs');

if (fs.existsSync('supabase/schema.ts')) {
  const content = fs.readFileSync('supabase/schema.ts', 'utf8');
  
  // Find str_elv section
  const elvStart = content.indexOf('str_elv: {');
  if (elvStart !== -1) {
    console.log('--- str_elv Schema ---');
    console.log(content.substring(elvStart, elvStart + 1500));
  }

  // Find comment section
  const commentStart = content.indexOf('comment: {');
  if (commentStart !== -1) {
    console.log('\n--- comment Schema ---');
    console.log(content.substring(commentStart, commentStart + 1500));
  }
} else {
  console.log('supabase/schema.ts does not exist');
}
