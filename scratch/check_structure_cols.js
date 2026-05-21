import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Parse .env.local
try {
  const envFile = readFileSync('.env.local', 'utf-8');
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

async function check() {
  console.log('--- Sample from structure table ---');
  const { data: structures, error: err1 } = await supabase.from('structure').select('*').limit(1);
  if (err1) console.error(err1);
  else console.log(JSON.stringify(structures, null, 2));

  console.log('--- Sample from platform table ---');
  const { data: platforms, error: err2 } = await supabase.from('platform').select('*').limit(1);
  if (err2) console.error(err2);
  else console.log(JSON.stringify(platforms, null, 2));
}

check();
