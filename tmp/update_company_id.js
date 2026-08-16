const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n');
let url = '', key = '', serviceKey = '';

env.forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) serviceKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(url, serviceKey || key);

async function run() {
    console.log("Checking u_sow_items company_id values...");
    
    // Find default company_id from non-null rows
    const { data: validRows, error: validErr } = await supabase
        .from('u_sow_items')
        .select('company_id')
        .not('company_id', 'is', null)
        .limit(10);
        
    if (validErr) {
        console.error("Error fetching valid rows:", validErr);
        return;
    }
    
    console.log("Found sample valid company_ids:", validRows?.map(r => r.company_id));
    
    const defaultCompanyId = validRows && validRows[0] ? validRows[0].company_id : 'a13fb356-6131-4b78-8fe1-e7c8bcc31ab2';
    console.log("Default company_id to set:", defaultCompanyId);
    
    // Find rows with null company_id
    const { data: nullRows, error: nullErr } = await supabase
        .from('u_sow_items')
        .select('id, sow_id, report_number, updated_by')
        .is('company_id', null);
        
    if (nullErr) {
        console.error("Error fetching null company_id rows:", nullErr);
        return;
    }
    
    console.log(`Found ${nullRows.length} rows with NULL company_id.`);
    if (nullRows.length === 0) {
        console.log("No rows to update.");
        return;
    }
    
    console.log("Updating NULL company_id rows to:", defaultCompanyId);
    
    const { data: updateData, error: updateErr } = await supabase
        .from('u_sow_items')
        .update({ company_id: defaultCompanyId })
        .is('company_id', null)
        .select();
        
    if (updateErr) {
        console.error("Error updating u_sow_items:", updateErr);
    } else {
        console.log(`Successfully updated ${updateData?.length || nullRows.length} rows in u_sow_items with company_id = ${defaultCompanyId}`);
    }
}

run();
