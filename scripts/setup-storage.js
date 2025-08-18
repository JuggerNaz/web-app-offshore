#!/usr/bin/env node

/**
 * Script to verify and setup Supabase storage bucket for attachments
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=')
      if (key && value) {
        process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '')
      }
    })
  }
}

loadEnvFile()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorage() {
  console.log('🔍 Checking Supabase storage configuration...\n');

  try {
    // List all buckets
    console.log('📋 Fetching existing buckets...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError.message);
      return;
    }

    console.log('✅ Found buckets:', buckets.map(b => b.name).join(', ') || 'none');

    // Check if attachments bucket exists
    const attachmentsBucket = buckets.find(bucket => bucket.name === 'attachments');
    
    if (!attachmentsBucket) {
      console.log('\n📦 Creating "attachments" bucket...');
      
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('attachments', {
        public: true,  // Make bucket public for easy access
        allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        fileSizeLimit: 5242880, // 5MB
      });

      if (createError) {
        console.error('❌ Error creating bucket:', createError.message);
        console.log('\n💡 You may need to create the bucket manually in your Supabase dashboard:');
        console.log('   1. Go to Storage in your Supabase dashboard');
        console.log('   2. Click "Create bucket"');
        console.log('   3. Name it "attachments"');
        console.log('   4. Make it public');
        return;
      }

      console.log('✅ Successfully created "attachments" bucket');
    } else {
      console.log('✅ "attachments" bucket already exists');
      console.log('   Public:', attachmentsBucket.public);
    }

    // Test upload and URL generation
    console.log('\n🧪 Testing file URL generation...');
    
    // Create a test file path
    const testFilePath = 'uploads/test-file.jpg';
    const { data: { publicUrl } } = supabase.storage
      .from('attachments')
      .getPublicUrl(testFilePath);

    console.log('✅ Test public URL:', publicUrl);
    
    // Verify the URL format
    const expectedPattern = new RegExp(`${supabaseUrl}/storage/v1/object/public/attachments/`);
    if (expectedPattern.test(publicUrl)) {
      console.log('✅ URL format is correct');
    } else {
      console.log('⚠️  URL format might be incorrect');
    }

    console.log('\n✅ Storage setup verification complete!');
    console.log('\n💡 If you\'re still getting "bucket not found" errors:');
    console.log('   1. Check your bucket permissions in the Supabase dashboard');
    console.log('   2. Ensure RLS policies allow public access to the attachments bucket');
    console.log('   3. Verify your Supabase URL and keys are correct');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the setup
setupStorage();
