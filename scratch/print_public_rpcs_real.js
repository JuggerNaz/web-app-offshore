const fs = require('fs');

if (fs.existsSync('supabase/schema.ts')) {
  const content = fs.readFileSync('supabase/schema.ts', 'utf8');
  
  // Find public schema Tables section
  const publicStart = content.indexOf('public: {');
  if (publicStart !== -1) {
    const publicContent = content.substring(publicStart);
    // Find Functions: after Tables
    const tablesEnd = publicContent.indexOf('Views: {');
    if (tablesEnd !== -1) {
      const postTablesContent = publicContent.substring(tablesEnd);
      const functionsStart = postTablesContent.indexOf('Functions: {');
      if (functionsStart !== -1) {
        console.log('--- Public Schema RPC Functions ---');
        console.log(postTablesContent.substring(functionsStart, functionsStart + 1500));
      } else {
        console.log('Functions section in public schema not found after tables');
      }
    } else {
      console.log('Views section not found');
    }
  } else {
    console.log('Public schema section not found');
  }
} else {
  console.log('supabase/schema.ts does not exist');
}
