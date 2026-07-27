const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  let url = '';
  let key = '';

  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      url = trimmed.split('=')[1].trim().replace(/^["']|["']$/g, '');
    }
    if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
      key = trimmed.split('=')[1].trim().replace(/^["']|["']$/g, '');
    }
  });

  const supabase = createClient(url, key);

  const { data, count, error } = await supabase
    .from('u_obj3d_param')
    .select('*', { count: 'exact' })
    .limit(20);

  if (error) {
    console.error('Error reading u_obj3d_param:', error);
    return;
  }

  console.log(`Total rows accessible via API: ${count}`);
  console.log('Sample 5 rows:');
  console.log(JSON.stringify(data.slice(0, 5), null, 2));

  // Check unique values of str_name and orient
  const { data: strNames } = await supabase.from('u_obj3d_param').select('str_name').limit(100);
  const uniqueStrNames = [...new Set((strNames || []).map(r => r.str_name))];
  console.log('Sample unique str_name values:', uniqueStrNames);
}

main().catch(console.error);
