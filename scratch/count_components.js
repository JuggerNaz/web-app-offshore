const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  const { count, error } = await supabase
    .from("structure_components")
    .select("*", { count: 'exact', head: true });

  if (error) {
    console.error(error);
  } else {
    console.log("Total components in database:", count);
  }

  const { count: nonNullCount, error: err2 } = await supabase
    .from("structure_components")
    .select("*", { count: 'exact', head: true })
    .not("q_id", "is", null);

  console.log("Components with non-null q_id:", nonNullCount);
}

run();
