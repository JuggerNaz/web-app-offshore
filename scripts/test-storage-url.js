#!/usr/bin/env node

/**
 * Simple test to verify storage URL generation
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
      }
    });
  }
}

loadEnvFile();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

console.log('🔗 Testing Storage URL Generation\n');

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL not found in environment variables');
  process.exit(1);
}

console.log('✅ Supabase URL:', supabaseUrl);

// Test URL generation
const testFilePath = 'uploads/test-file.jpg';
const expectedUrl = `${supabaseUrl}/storage/v1/object/public/attachments/${testFilePath}`;

console.log('✅ Test file path:', testFilePath);
console.log('✅ Generated URL:', expectedUrl);

console.log('\n🧪 Testing URL accessibility...');

// Test if we can reach the bucket (this will fail until bucket is created)
const https = require('https');
const http = require('http');

const urlObj = new URL(expectedUrl);
const client = urlObj.protocol === 'https:' ? https : http;

const req = client.request({
  hostname: urlObj.hostname,
  port: urlObj.port,
  path: urlObj.pathname,
  method: 'HEAD'
}, (res) => {
  if (res.statusCode === 404) {
    console.log('⚠️  Bucket or file not found (expected if bucket doesn\'t exist yet)');
  } else if (res.statusCode === 400) {
    console.log('✅ Bucket exists! (400 means bucket exists but file not found)');
  } else {
    console.log(`ℹ️  Response status: ${res.statusCode}`);
  }
});

req.on('error', (err) => {
  console.log('❌ Connection error:', err.message);
});

req.setTimeout(5000, () => {
  console.log('⏱️  Request timeout (this is normal)');
  req.destroy();
});

req.end();

console.log('\n💡 Next steps:');
console.log('   1. Create the "attachments" bucket in your Supabase dashboard');
console.log('   2. Make sure it\'s set to PUBLIC');
console.log('   3. Run this script again to verify');
