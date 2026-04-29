const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Initialize Supabase client
// Replace these with your actual Supabase URL and SERVICE ROLE key if needed to bypass RLS
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrateLegacyDeletedFlags() {
    console.log("Starting migration of legacy 'del: 1' metadata flags to 'is_deleted = true'...");

    let hasMore = true;
    let offset = 0;
    const pageSize = 1000;
    let totalUpdated = 0;
    let totalScanned = 0;

    while (hasMore) {
        console.log(`Scanning batch ${offset} to ${offset + pageSize - 1}...`);
        
        // Fetch all components in chunks
        const { data, error } = await supabase
            .from('structure_components')
            .select('id, metadata, is_deleted')
            .range(offset, offset + pageSize - 1);

        if (error) {
            console.error("Error fetching components:", error);
            break;
        }

        if (data && data.length > 0) {
            totalScanned += data.length;
            
            // Find components that need updating
            const toUpdate = data.filter(c => {
                const isLegacyDeleted = c.metadata && (c.metadata.del === 1 || c.metadata.del === '1' || c.metadata.del === true);
                const needsMigration = isLegacyDeleted && c.is_deleted !== true;
                return needsMigration;
            });

            if (toUpdate.length > 0) {
                console.log(`Found ${toUpdate.length} components to update in this batch.`);
                
                // Update them in parallel chunks or one by one
                // Since this is a one-off script, doing them sequentially or with Promise.all is fine
                const updatePromises = toUpdate.map(comp => 
                    supabase
                        .from('structure_components')
                        .update({ is_deleted: true })
                        .eq('id', comp.id)
                );

                const results = await Promise.all(updatePromises);
                
                const errors = results.filter(r => r.error);
                if (errors.length > 0) {
                    console.error(`Encountered ${errors.length} errors while updating.`);
                    console.error(errors[0].error);
                } else {
                    totalUpdated += toUpdate.length;
                    console.log(`Successfully migrated ${toUpdate.length} records.`);
                }
            }

            offset += pageSize;
            if (data.length < pageSize) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }

    console.log("\n--- Migration Complete ---");
    console.log(`Total records scanned: ${totalScanned}`);
    console.log(`Total records migrated: ${totalUpdated}`);
}

migrateLegacyDeletedFlags();
