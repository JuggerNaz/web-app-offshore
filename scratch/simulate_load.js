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
    try {
        console.log("Simulating loadJobPacks...");
        const { data, error } = await supabase
            .from("jobpack")
            .select(`
      id,
      name,
      metadata,
      status
    `)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error from Supabase:", error);
            throw error;
        }

        console.log(`Fetched ${data?.length} jobpacks.`);

        if (data && data.length > 0) {
            // Extract structure IDs from metadata.structures array
            const structureIds = [];
            data.forEach((jp) => {
                const structures = jp.metadata?.structures || [];
                if (Array.isArray(structures)) {
                    structures.forEach((s) => {
                        if (s.id && typeof s.id === 'number') {
                            structureIds.push(s.id);
                        }
                    });
                }
            });

            const uniqueStructureIds = Array.from(new Set(structureIds));
            console.log("Extracted structure IDs from metadata count:", uniqueStructureIds.length);
            console.log("Extracted structure IDs:", uniqueStructureIds);

            let structureMap = new Map();

            if (uniqueStructureIds.length > 0) {
                const res = await supabase
                    .from("structure")
                    .select("str_id, str_title")
                    .in("str_id", uniqueStructureIds);

                console.log("Structure query error:", res.error);
                console.log("Structure query data count:", res.data?.length);
                
                structureMap = new Map(
                    res.data?.map((s) => [s.str_id, s.str_title]) || []
                );
            }

            const formatted = data.map((jp) => {
                const structures = jp.metadata?.structures || [];
                const structureList = Array.isArray(structures)
                    ? structures
                        .map((s) => ({
                            id: s.id,
                            name: structureMap.get(s.id) || s.title || s.code || s.name || ""
                        }))
                        .filter((s) => s.name !== "")
                    : [];

                const structureNames = structureList
                    .map((s) => s.name)
                    .join(", ");

                return {
                    id: jp.id,
                    jobpack_no: jp.name || `JP-${jp.id}`,
                    jobpack_title: jp.metadata?.plantype || jp.name || "Untitled",
                    structure_name: structureNames || "No structure",
                    status: jp.status || "OPEN",
                    structures: structureList,
                };
            });

            console.log("Formatted jobpacks count:", formatted.length);
            console.log("First 5 formatted jobpacks:", JSON.stringify(formatted.slice(0, 5), null, 2));
            
            // Let's filter jobpacks exactly like in page.tsx
            const searchJP = "";
            const filteredJobPacks = formatted.filter((jp) => {
                const search = searchJP.toLowerCase();
                return (
                    jp.jobpack_no?.toLowerCase().includes(search) ||
                    jp.jobpack_title?.toLowerCase().includes(search) ||
                    jp.structure_name?.toLowerCase().includes(search)
                );
            });
            console.log("Filtered jobpacks count (with empty search):", filteredJobPacks.length);
        }
    } catch (e) {
        console.error("Simulation failed:", e);
    }
})();
