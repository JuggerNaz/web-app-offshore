const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parse .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        let value = trimmed.substring(idx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    }
  });
} catch (e) {
  console.log('No .env.local found:', e.message);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verify() {
  console.log('--- Sample from structure table ---');
  const { data: structures, error: err1 } = await supabase.from('structure').select('*').limit(1);
  if (err1) console.error(err1);
  else console.log(JSON.stringify(structures, null, 2));

  console.log('--- Sample from platform table ---');
  const { data: platforms, error: err2 } = await supabase.from('platform').select('*').limit(1);
  if (err2) console.error(err2);
  else console.log(JSON.stringify(platforms, null, 2));

  console.log('--- Sample from platform_3d_scenes table ---');
  const { data: scenes, error: err3 } = await supabase.from('platform_3d_scenes').select('*').limit(1);
  if (err3) console.error(err3);
  else console.log(JSON.stringify(scenes, null, 2));

  console.log('--- Sample from platform_3d_scenes table ---');
  const { data: scenes, error: err3 } = await supabase.from('platform_3d_scenes').select('*').limit(1);
  if (err3) console.error(err3);
  else console.log(JSON.stringify(scenes, null, 2));
}

verify();

