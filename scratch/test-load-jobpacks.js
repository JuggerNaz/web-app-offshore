const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...value] = line.split('=');
    if (key && value) acc[key.trim()] = value.join('=').trim();
    return acc;
  }, {});

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testLoad() {
  try {
    console.log("1. Fetching jobpacks...");
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
      console.error("Supabase jobpack query error:", error);
      return;
    }

    console.log(`Found ${data.length} jobpacks.`);

    if (data && data.length > 0) {
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
      console.log(`Extracted ${uniqueStructureIds.length} unique structure IDs.`);

      let structureMap = new Map();

      if (uniqueStructureIds.length > 0) {
        console.log("2. Fetching platforms and pipelines...");
        const [platformsRes, pipelinesRes] = await Promise.all([
          supabase
            .from("platform")
            .select("plat_id, title")
            .in("plat_id", uniqueStructureIds),
          supabase
            .from("u_pipeline")
            .select("pipe_id, title")
            .in("pipe_id", uniqueStructureIds)
        ]);

        if (platformsRes.error) {
          console.error("Platforms query error:", platformsRes.error);
        }
        if (pipelinesRes.error) {
          console.error("Pipelines query error:", pipelinesRes.error);
        }

        const platforms = platformsRes.data || [];
        const pipelines = pipelinesRes.data || [];

        console.log(`Retrieved ${platforms.length} platforms and ${pipelines.length} pipelines.`);

        platforms.forEach((p) => {
          structureMap.set(p.plat_id, p.title);
        });

        pipelines.forEach((p) => {
          structureMap.set(p.pipe_id, p.title);
        });
      }

      const formatted = data.map((jp) => {
        const structures = jp.metadata?.structures || [];
        const structureList = Array.isArray(structures)
          ? structures
              .map((s) => ({
                id: Number(s.id),
                name: structureMap.get(Number(s.id)) || s.title || s.code || s.name || ""
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

      console.log("First 3 formatted jobpacks:", formatted.slice(0, 3));
      
      const populatedCount = formatted.filter(jp => jp.structures.length > 0).length;
      console.log(`Total formatted jobpacks with structures: ${populatedCount}`);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

testLoad();
