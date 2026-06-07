const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function main() {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envText = fs.readFileSync(envPath, 'utf8');
    const key = envText.split('NEXT_PUBLIC_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim().replace(/^['"]|['"]$/g, '');
    const url = envText.split('NEXT_PUBLIC_SUPABASE_URL=')[1].split('\n')[0].trim().replace(/^['"]|['"]$/g, '');

    const supabase = createClient(url, key);

    const sql = `
        ALTER TABLE public.mgi_profiles DISABLE ROW LEVEL SECURITY;
        GRANT ALL ON public.mgi_profiles TO anon, authenticated;
        
        ALTER TABLE public.jobpack DISABLE ROW LEVEL SECURITY;
        GRANT ALL ON public.jobpack TO anon, authenticated;
    `;

    console.log("Trying supabase.rpc('exec_sql', { sql }) ...");
    const { data: d1, error: e1 } = await supabase.rpc('exec_sql', { sql });
    if (e1) {
        console.log("Failed with { sql }:", e1.message);
        
        console.log("Trying supabase.rpc('exec_sql', { sql_query }) ...");
        const { data: d2, error: e2 } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (e2) {
            console.log("Failed with { sql_query }:", e2.message);
        } else {
            console.log("Success with { sql_query }!", d2);
        }
    } else {
        console.log("Success with { sql }!", d1);
    }
}

main().catch(console.error);
