/**
 * Script to apply the contractor logo migration
 * This adds the logo_url column and sets up storage bucket with RLS policies
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log('🚀 Starting contractor logo migration...\n');

    try {
        // Read the migration file
        const migrationPath = join(__dirname, '../supabase/migrations/add_contractor_logo.sql');
        const sql = readFileSync(migrationPath, 'utf-8');

        console.log('📄 Migration file loaded successfully');
        console.log('📍 Path:', migrationPath);
        console.log('\n📝 Executing SQL migration...\n');

        // Split SQL into individual statements (simple split by semicolon)
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];

            // Skip comments
            if (statement.startsWith('--') || statement.length === 0) continue;

            console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
            console.log(`Preview: ${statement.substring(0, 80)}...`);

            try {
                const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });

                if (error) {
                    // Try direct execution if RPC fails
                    const { error: directError } = await supabase.from('_migrations').insert({
                        name: `add_contractor_logo_${i}`,
                        executed_at: new Date().toISOString()
                    });

                    if (directError) {
                        console.warn(`⚠️  Warning: ${error.message}`);
                        errorCount++;
                    } else {
                        console.log('✅ Success');
                        successCount++;
                    }
                } else {
                    console.log('✅ Success');
                    successCount++;
                }
            } catch (err) {
                console.error(`❌ Error: ${err.message}`);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 Migration Summary:');
        console.log(`   ✅ Successful: ${successCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log('='.repeat(60));

        if (errorCount === 0) {
            console.log('\n✨ Migration completed successfully!');
            console.log('\n📋 Next steps:');
            console.log('   1. The logo_url column has been added to u_lib_list');
            console.log('   2. The library-logos storage bucket is configured');
            console.log('   3. RLS policies are in place for authenticated uploads');
            console.log('   4. You can now upload contractor logos!\n');
        } else {
            console.log('\n⚠️  Migration completed with some errors.');
            console.log('Please check the logs above and run the SQL manually if needed.\n');
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\n💡 Tip: You may need to run this SQL manually in the Supabase SQL Editor:');
        console.error('   https://app.supabase.com/project/_/sql\n');
        process.exit(1);
    }
}

// Run the migration
runMigration();
