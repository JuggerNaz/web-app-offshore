/**
 * Quick fix script to set up contractor logo storage bucket
 * This script creates the storage bucket and sets up RLS policies
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('Make sure .env.local has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🚀 Setting up contractor logo storage...\n');

async function setupStorage() {
    try {
        // Check if bucket exists
        console.log('📦 Checking storage bucket...');
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();

        if (listError) {
            console.error('❌ Error listing buckets:', listError.message);
            throw listError;
        }

        const bucketExists = buckets?.some(b => b.id === 'library-logos');

        if (!bucketExists) {
            console.log('📦 Creating library-logos bucket...');
            const { data, error } = await supabase.storage.createBucket('library-logos', {
                public: true,
                fileSizeLimit: 5242880, // 5MB
                allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
            });

            if (error) {
                console.error('❌ Error creating bucket:', error.message);
                throw error;
            }
            console.log('✅ Bucket created successfully!');
        } else {
            console.log('✅ Bucket already exists');

            // Update bucket to ensure it's public
            const { error: updateError } = await supabase.storage.updateBucket('library-logos', {
                public: true,
                fileSizeLimit: 5242880,
                allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
            });

            if (updateError) {
                console.warn('⚠️  Could not update bucket settings:', updateError.message);
            } else {
                console.log('✅ Bucket settings updated');
            }
        }

        console.log('\n📋 Storage bucket is ready!');
        console.log('\n⚠️  IMPORTANT: RLS Policies');
        console.log('The storage bucket needs RLS policies to allow uploads.');
        console.log('Please run the following SQL in Supabase SQL Editor:');
        console.log('https://app.supabase.com/project/zpsmxtdqlpbdwfzctqzd/sql\n');

        const sqlScript = `
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "library_logos_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "library_logos_authenticated_update" ON storage.objects;

-- Allow authenticated users to upload
CREATE POLICY "library_logos_authenticated_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'library-logos');

-- Allow public read access
CREATE POLICY "library_logos_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'library-logos');

-- Allow authenticated users to delete
CREATE POLICY "library_logos_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'library-logos');

-- Allow authenticated users to update
CREATE POLICY "library_logos_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'library-logos')
WITH CHECK (bucket_id = 'library-logos');
`;

        console.log('--- COPY THIS SQL ---');
        console.log(sqlScript);
        console.log('--- END SQL ---\n');

    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        process.exit(1);
    }
}

setupStorage();
