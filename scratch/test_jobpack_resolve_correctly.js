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
    console.log("1. Fetching jobpack...");
    const { data: jobpacks, error: jpError } = await supabase
      .from("jobpack")
      .select("id, name, metadata, status")
      .order("created_at", { ascending: false });

    if (jpError) {
      console.error("Jobpack query failed:", jpError);
      return;
    }

    console.log("Total jobpacks:", jobpacks.length);

    // Extract unique structure IDs
    const structureIds = [];
    jobpacks.forEach(jp => {
      const structures = jp.metadata?.structures || [];
      if (Array.isArray(structures)) {
        structures.forEach(s => {
          if (s.id) {
            structureIds.push(Number(s.id));
          }
        });
      }
    });

    const uniqueStructureIds = Array.from(new Set(structureIds));
    console.log("Unique structure IDs:", uniqueStructureIds.length);

    const structureMap = new Map();

    if (uniqueStructureIds.length > 0) {
      console.log("2. Querying platforms & pipelines...");
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
        console.error("Platforms error:", platformsRes.error);
      } else {
        console.log(`Platforms found: ${platformsRes.data.length}`);
        platformsRes.data.forEach(p => {
          structureMap.set(p.plat_id, p.title);
        });
      }

      if (pipelinesRes.error) {
        console.error("Pipelines error:", pipelinesRes.error);
      } else {
        console.log(`Pipelines found: ${pipelinesRes.data.length}`);
        pipelinesRes.data.forEach(p => {
          structureMap.set(p.pipe_id, p.title);
        });
      }
    }

    const formatted = jobpacks.map(jp => {
      const structures = jp.metadata?.structures || [];
      const structureList = Array.isArray(structures)
        ? structures
            .map(s => ({
              id: Number(s.id),
              name: structureMap.get(Number(s.id)) || s.title || s.code || s.name || `Structure ${s.id}`
            }))
        : [];

      const structureNames = structureList
        .map(s => s.name)
        .join(", ");

      return {
        id: jp.id,
        jobpack_no: jp.name || `JP-${jp.id}`,
        jobpack_title: jp.metadata?.plantype || jp.name || "Untitled",
        structure_name: structureNames || "No structure",
        status: jp.status || "OPEN",
        structures: structureList
      };
    });

    console.log("Formatted count:", formatted.length);
    console.log("Sample formatted jobpacks:", formatted.slice(0, 5));

  } catch (err) {
    console.error("Caught error:", err);
  }
}

testLoad();
