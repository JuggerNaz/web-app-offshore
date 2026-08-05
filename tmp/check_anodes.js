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
    console.log("Inspecting structure_components for structure_id = 234...");
    
    const { data, error } = await supabase
        .from('structure_components')
        .select('id, q_id, code, is_deleted, metadata')
        .eq('structure_id', 234)
        .ilike('q_id', 'BAN%');
        
    if (error) {
        console.error("Error:", error);
        return;
    }
    
    console.log(`Found ${data.length} BAN% rows for structure_id 234:`);
    data.forEach(r => {
        const delMeta = r.metadata ? r.metadata.del : undefined;
        console.log(`id: ${r.id}, q_id: ${r.q_id}, code: ${r.code}, is_deleted: ${r.is_deleted}, metadata.del: ${delMeta}`);
    });
}

run();
