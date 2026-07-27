const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function testApiLogic() {
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

  const { data, error } = await supabase
    .from('u_obj3d_param')
    .select(`str_id, comp_id, elv, s_point3d_x, s_point3d_y, s_point3d_z, e_point3d_x, e_point3d_y, e_point3d_z, orient`)
    .eq('str_id', 982)
    .limit(5);

  if (error) {
    console.error('Test query failed:', error);
  } else {
    console.log(`Success! Fetched ${data.length} sample rows for str_id 982:`);
    console.log(data);
  }
}

testApiLogic();
