
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkStorage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  console.log('Checking company_settings...');
  const { data: settings, error: settingsError } = await supabase
    .from('company_settings')
    .select('storage_provider, storage_config')
    .eq('id', 1)
    .single();

  if (settingsError) {
    console.error('Error fetching settings:', settingsError);
  } else {
    console.log('Active Storage Provider:', settings.storage_provider);
    // console.log('Config Keys:', Object.keys(settings.storage_config || {}));
  }

  console.log('\nChecking recent attachments...');
  const { data: attachments, error: attachError } = await supabase
    .from('attachment')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (attachError) {
    console.error('Error fetching attachments:', attachError);
  } else {
    attachments.forEach(a => {
      console.log(`ID: ${a.id}, Name: ${a.name}, Type: ${a.source_type}, Provider: ${a.meta?.storage_provider}`);
      console.log(`URL: ${a.path}`);
      console.log(`Meta File Path: ${a.meta?.file_path}`);
      console.log('---');
    });
  }
}

checkStorage();
