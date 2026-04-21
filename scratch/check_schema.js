import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSchema() {
  const { data, error } = await supabase.from('insp_records').select('*').limit(1);
  if (error) {
    console.error("Error fetching insp_records:", error);
    return;
  }
  console.log("insp_records Columns:", Object.keys(data[0] || {}));
}

checkSchema();
