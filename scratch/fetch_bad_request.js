const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const targetUrl = `${supabaseUrl}/rest/v1/insp_video_tapes?select=chapter_no&tape_no=eq.16001%2FB11DR-A%2FV001D&order=chapter_no.desc&limit=1`;

console.log('Fetching:', targetUrl);

fetch(targetUrl, {
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  }
})
.then(async res => {
  console.log('Status:', res.status, res.statusText);
  const text = await res.text();
  console.log('Response Body:', text);
})
.catch(err => {
  console.error('Fetch Error:', err);
});
