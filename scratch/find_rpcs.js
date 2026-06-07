const fs = require('fs');

if (fs.existsSync('supabase/schema.ts')) {
  const content = fs.readFileSync('supabase/schema.ts', 'utf8');
  const lines = content.split('\n');
  console.log('--- RPC Functions in Schema ---');
  
  lines.forEach(l => {
    if (l.includes('Args:') || l.includes('Returns:') || l.includes('rpc(') || l.includes('FunctionNames:')) {
      console.log(l.trim());
    }
  });
} else {
  console.log('supabase/schema.ts does not exist');
}
