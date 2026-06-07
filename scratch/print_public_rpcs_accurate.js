const fs = require('fs');

if (fs.existsSync('supabase/schema.ts')) {
  const content = fs.readFileSync('supabase/schema.ts', 'utf8');
  
  // Find "public: {" which is not "graphql_public:"
  const parts = content.split('public: {');
  // The first part is everything before public:
  // The second part is after public: {
  // Let's see: the third part (index 2) might be the actual public schema or second match
  for (let i = 1; i < parts.length; i++) {
    const subContent = parts[i];
    if (subContent.includes('Tables: {') && subContent.includes('get_user_info: {')) {
      console.log(`--- Match ${i} has tables and get_user_info ---`);
      const functionsIdx = subContent.indexOf('Functions: {');
      if (functionsIdx !== -1) {
        console.log(subContent.substring(functionsIdx, functionsIdx + 1500));
      }
    }
  }
} else {
  console.log('supabase/schema.ts does not exist');
}
