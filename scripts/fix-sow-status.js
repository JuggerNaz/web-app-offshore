const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Minimal env parser
const envPath = path.resolve(__dirname, '../.env.local');
let envs = {};
try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            let key = match[1];
            let value = match[2] ? match[2].trim() : '';
            // Remove quotes if present
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
            envs[key] = value;
        }
    });
} catch (e) {
    console.error("Could not read .env.local file", e);
}

const supabaseUrl = envs['NEXT_PUBLIC_SUPABASE_URL'] || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envs['SUPABASE_SERVICE_ROLE_KEY'] || envs['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE URL or KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSowItemsStatus() {
    console.log("Starting SOW items status cleanup...");

    // 1. Fetch SOW items that have a report_number assigned
    const { data: sowItems, error: sowError } = await supabase
        .from('u_sow_items')
        .select('*')
        .not('report_number', 'is', null);

    if (sowError) {
        console.error("Error fetching SOW items:", sowError);
        return;
    }

    console.log(`Found ${sowItems.length} SOW items with a report_number assigned. Checking against inspection records...`);

    let fixedCount = 0;

    for (const item of sowItems) {
        // We match based on component_id and report_number (which is sow_report_no in insp_records)
        if (!item.component_id || !item.report_number) {
            continue;
        }

        const { count, error: inspError } = await supabase
            .from('insp_records')
            .select('*', { count: 'exact', head: true })
            .eq('component_id', item.component_id)
            .eq('sow_report_no', item.report_number);

        if (inspError) {
            console.error(`Error checking records for component ${item.component_id}, report ${item.report_number}:`, inspError);
            continue;
        }

        if (count === 0) {
            // No inspection records exist! Reset status for this SOW item
            console.log(`- Fixing: Component [${item.component_qid || item.component_id}] in Scope [${item.report_number}] — Type: ${item.inspection_code || item.inspection_type_id} (was ${item.status})`);
            
            const { error: updateError } = await supabase
                .from('u_sow_items')
                .update({ 
                    status: 'pending',
                    notes: null,
                    last_inspection_date: null
                })
                .eq('id', item.id);

            if (updateError) {
                console.error(`  -> Failed to update SOW item ${item.id}:`, updateError);
            } else {
                console.log(`  -> Successfully reset to 'pending'`);
                fixedCount++;
            }
        }
    }

    console.log(`\nCleanup complete! Fixed ${fixedCount} orphaned SOW items.`);
}

fixSowItemsStatus();
