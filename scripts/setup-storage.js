// Script to set up Supabase storage bucket for attachments
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or key. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

// Create a Supabase client with service role key for admin privileges
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupStorage() {
  try {
    console.log('Checking for existing storage buckets...');
    
    // Check if the bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      throw new Error(`Error listing buckets: ${listError.message}`);
    }
    
    console.log(`Found ${buckets.length} existing buckets`);
    
    // Check if attachments bucket already exists
    const attachmentsBucket = buckets.find(bucket => bucket.name === 'attachments');
    
    if (attachmentsBucket) {
      console.log('✅ Attachments bucket already exists');
    } else {
      console.log('Creating attachments bucket...');
      
      // Create the attachments bucket
      const { data, error } = await supabase.storage.createBucket('attachments', {
        public: false, // Files are not publicly accessible by default
        fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
      });
      
      if (error) {
        throw new Error(`Error creating bucket: ${error.message}`);
      }
      
      console.log('✅ Successfully created attachments bucket');
      
      // Set up bucket policies
      console.log('Setting up bucket policies...');
      
      // Allow authenticated users to upload files
      const { error: policyError } = await supabase.storage.from('attachments').createPolicy(
        'authenticated can upload',
        {
          name: 'authenticated can upload',
          definition: {
            role: 'authenticated',
            operation: 'INSERT',
          },
        }
      );
      
      if (policyError) {
        console.warn(`Warning: Could not create upload policy: ${policyError.message}`);
      }
      
      // Allow authenticated users to download files
      const { error: downloadPolicyError } = await supabase.storage.from('attachments').createPolicy(
        'authenticated can download',
        {
          name: 'authenticated can download',
          definition: {
            role: 'authenticated',
            operation: 'SELECT',
          },
        }
      );
      
      if (downloadPolicyError) {
        console.warn(`Warning: Could not create download policy: ${downloadPolicyError.message}`);
      }
      
      console.log('✅ Storage setup complete');
    }
  } catch (error) {
    console.error('Error setting up storage:', error.message);
    process.exit(1);
  }
}

// Run the setup function
setupStorage();
