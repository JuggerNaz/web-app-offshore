const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length > 1) env[parts[0]] = parts.slice(1).join('=').trim();
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
    console.log("Analyzing metadata.structures items format...");
    const { data, error } = await supabase.from('jobpack').select('id, name, metadata');
    if (error) {
        console.error("Error fetching:", error);
        return;
    }
    
    let samples = [];
    data.forEach(jp => {
        const metadata = jp.metadata;
        if (metadata && metadata.structures && Array.isArray(metadata.structures)) {
            samples.push({
                id: jp.id,
                name: jp.name,
                structures: metadata.structures
            });
        }
    });
    
    console.log(`Found ${samples.length} jobpacks with structures array.`);
    if (samples.length > 0) {
        console.log("Sample metadata.structures arrays:");
        console.log(JSON.stringify(samples.slice(0, 10), null, 2));
    }
})();
