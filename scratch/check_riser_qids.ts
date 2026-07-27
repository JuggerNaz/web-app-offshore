import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function checkRiserQids() {
  const { data: comps } = await supabase
    .from('structure_components')
    .select('id, q_id, code')
    .eq('structure_id', 243)
    .eq('is_deleted', false);

  const riserPipes: any[] = [];
  const riserSupports: any[] = [];

  (comps || []).forEach(c => {
    const qid = (c.q_id || "").toUpperCase().trim();
    const code = (c.code || "").toUpperCase().trim();
    const isSupport = qid.includes("SUPP") || qid.includes("CLP") || code === "CL";
    const isPipe = !isSupport && (code === "RS" || /^R\d+[-_]/.test(qid) || (qid.startsWith("R") && !qid.startsWith("RIS-")));

    if (isSupport) riserSupports.push(c);
    if (isPipe) riserPipes.push(c);
  });

  console.log('Total Riser Pipes (Rx-xxxx):', riserPipes.length);
  console.log('Sample Riser Pipes:', riserPipes.slice(0, 10));

  console.log('Total Riser Supports (RIS-x-SUPP-xx):', riserSupports.length);
  console.log('Sample Riser Supports:', riserSupports.slice(0, 10));
}

checkRiserQids();
