const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envConfig = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    envConfig[match[1]] = value;
  }
});

const url = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const key = envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function fixElevationData() {
  console.log("=== Starting Elevation Data Correction ===");
  const { data: rows, error } = await supabase.from('str_elv').select('*');
  if (error) {
    console.error("Error fetching rows:", error);
    return;
  }

  let updatedCount = 0;

  for (const r of rows) {
    let needsUpdate = false;
    let newOrient = r.orient;
    let newElv = Number(r.elv);

    // If orient is null / missing
    if (!newOrient) {
      needsUpdate = true;
      if (newElv < 0) {
        newOrient = 'BELOW';
      } else {
        newOrient = 'ABOVE';
      }
    }

    // Ensure sign consistency based on orient
    if (newOrient === 'ABOVE' && newElv < 0) {
      needsUpdate = true;
      newElv = Math.abs(newElv);
    } else if (newOrient === 'BELOW' && newElv > 0) {
      needsUpdate = true;
      newElv = -Math.abs(newElv);
    }

    if (needsUpdate) {
      console.log(`Updating plat_id ${r.plat_id}, old elv: ${r.elv}, old orient: ${r.orient} --> new elv: ${newElv}, new orient: ${newOrient}`);
      const { error: updateError } = await supabase
        .from('str_elv')
        .update({ orient: newOrient, elv: newElv })
        .eq('plat_id', r.plat_id)
        .eq('elv', r.elv);

      if (updateError) {
        console.error(`Failed to update plat_id ${r.plat_id}, elv ${r.elv}:`, updateError.message);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`=== Done! Updated ${updatedCount} elevation records. ===`);
}

fixElevationData();
