import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { generatePlatform3DCoordinates } from '../utils/platform-3d-math';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function checkWeldsInLayouts() {
  const { data: platformDetails } = await supabase.from('platform').select('*').eq('plat_id', 243).maybeSingle();
  const { data: elevations } = await supabase.from('platform_elevation').select('*').eq('plat_id', 243);
  const { data: faces } = await supabase.from('platform_faces').select('*').eq('plat_id', 243);
  const { data: rawComponents } = await supabase.from('structure_components').select('*').eq('structure_id', 243).eq('is_deleted', false);

  const excludeCodes = ["IT", "CU", "FV", "HS", "GP", "PG", "PC", "RC", "RB", "SD"];
  const filteredRawComponents = (rawComponents || [])
    .filter((c: any) => {
      const code = (c.code || "").trim().toUpperCase();
      const qIdUpper = (c.q_id || "").toUpperCase();
      const isRiserSupport = qIdUpper.includes("SUPP") || qIdUpper.includes("CLP");
      if (excludeCodes.includes(code) && !isRiserSupport) return false;
      if (/^FEND\s+\d+-SUPP-/i.test(qIdUpper)) return false;
      if (qIdUpper.endsWith("TERM")) return false;
      return true;
    })
    .map((c: any) => ({ ...c.metadata, ...c }));

  const mathResult = generatePlatform3DCoordinates(platformDetails || {}, elevations || [], faces || [], filteredRawComponents);
  
  const weldLayouts = mathResult.componentLayouts.filter((l: any) => {
    const code = (l.component?.code || "").toUpperCase();
    return code === "WN" || code === "WP" || code.includes("WELD");
  });

  console.log('Total layouts generated:', mathResult.componentLayouts.length);
  console.log('Total WN (Node Weld) layouts generated:', weldLayouts.length);
  if (weldLayouts.length > 0) {
    console.log('Sample WN layout 0:', weldLayouts[0]);
    console.log('Sample WN layout 1:', weldLayouts[1]);
  }
}

checkWeldsInLayouts();
