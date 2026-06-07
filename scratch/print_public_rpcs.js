const fs = require('fs');

if (fs.existsSync('supabase/schema.ts')) {
  const content = fs.readFileSync('supabase/schema.ts', 'utf8');
  
  // Find "public:" first, then find "Functions:" inside it
  const publicStart = content.indexOf('public: {');
  if (publicStart !== -1) {
    const publicContent = content.substring(publicStart);
    const functionsStart = publicContent.indexOf('Functions: {');
    if (functionsStart !== -1) {
      console.log('--- Public Schema RPC Functions ---');
      console.log(publicContent.substring(functionsStart, functionsStart + 2000));
    } else {
      console.log('Functions section in public schema not found');
    }
  } else {
    console.log('Public schema section not found');
  }
} else {
  console.log('supabase/schema.ts does not exist');
}
