const fs = require('fs');
const path = require('path');

async function main() {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envText = fs.readFileSync(envPath, 'utf8');
    const key = envText.split('NEXT_PUBLIC_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim();
    const url = envText.split('NEXT_PUBLIC_SUPABASE_URL=')[1].split('\n')[0].trim();

    console.log('Connecting to Supabase at:', url);

    const headers = {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
    };

    const sql = `
        ALTER TABLE public.insp_rov_jobs DISABLE ROW LEVEL SECURITY;
        ALTER TABLE public.insp_dive_jobs DISABLE ROW LEVEL SECURITY;
        ALTER TABLE public.insp_rov_movements DISABLE ROW LEVEL SECURITY;
        ALTER TABLE public.insp_dive_movements DISABLE ROW LEVEL SECURITY;
        ALTER TABLE public.insp_video_tapes DISABLE ROW LEVEL SECURITY;
        ALTER TABLE public.insp_video_logs DISABLE ROW LEVEL SECURITY;
        ALTER TABLE public.insp_records DISABLE ROW LEVEL SECURITY;
        ALTER TABLE public.insp_anomalies DISABLE ROW LEVEL SECURITY;
        ALTER TABLE public.insp_media DISABLE ROW LEVEL SECURITY;
        ALTER TABLE public.inspection_type DISABLE ROW LEVEL SECURITY;
        ALTER TABLE public.structure_components DISABLE ROW LEVEL SECURITY;
        ALTER TABLE public.comment DISABLE ROW LEVEL SECURITY;

        GRANT ALL ON public.insp_rov_jobs TO anon, authenticated;
        GRANT ALL ON public.insp_dive_jobs TO anon, authenticated;
        GRANT ALL ON public.insp_rov_movements TO anon, authenticated;
        GRANT ALL ON public.insp_dive_movements TO anon, authenticated;
        GRANT ALL ON public.insp_video_tapes TO anon, authenticated;
        GRANT ALL ON public.insp_video_logs TO anon, authenticated;
        GRANT ALL ON public.insp_records TO anon, authenticated;
        GRANT ALL ON public.insp_anomalies TO anon, authenticated;
        GRANT ALL ON public.insp_media TO anon, authenticated;
        GRANT ALL ON public.inspection_type TO anon, authenticated;
        GRANT ALL ON public.structure_components TO anon, authenticated;
        GRANT ALL ON public.comment TO anon, authenticated;

        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
    `;

    const body = {
        sql_query: sql
    };

    const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    const result = await res.json();
    console.log('Result from disabling RLS:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
