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

async function testLoadJobPacks() {
  try {
    console.log("1. Querying jobpack...");
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
      console.error("Jobpack query error:", error);
      return;
    }

    console.log("Jobpack data length:", data.length);

    // Extract structure IDs from metadata.structures array
    const structureIds = [];
    data.forEach((jp) => {
      const structures = jp.metadata?.structures || [];
      if (Array.isArray(structures)) {
        structures.forEach((s) => {
          if (s.id && (typeof s.id === 'number' || typeof s.id === 'string')) {
            structureIds.push(Number(s.id));
          }
        });
      }
    });

    const uniqueStructureIds = Array.from(new Set(structureIds));
    console.log("2. Extracted unique structure IDs:", uniqueStructureIds.slice(0, 10), "... total:", uniqueStructureIds.length);

    let structureMap = new Map();

    if (uniqueStructureIds.length > 0) {
      console.log("3. Querying structure table...");
      const { data: structureData, error: structureError } = await supabase
        .from("structure")
        .select("str_id, str_title")
        .in("str_id", uniqueStructureIds);

      if (structureError) {
        console.error("Structure query error:", structureError);
      } else {
        console.log("Structure data returned count:", structureData ? structureData.length : 0);
        console.log("Structure data samples:", structureData ? structureData.slice(0, 5) : null);
        structureMap = new Map(
          structureData?.map((s) => [s.str_id, s.str_title]) || []
        );
      }
    }

    const formatted = data.map((jp) => {
      const structures = jp.metadata?.structures || [];
      const structureList = Array.isArray(structures)
        ? structures
            .map((s) => ({
              id: s.id,
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

    console.log("4. Formatted data count:", formatted.length);
    console.log("Formatted sample 1:", formatted[0]);
  } catch (err) {
    console.error("Caught error:", err);
  }
}

testLoadJobPacks();
