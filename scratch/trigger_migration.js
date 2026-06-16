async function run() {
  try {
    const res = await fetch('http://localhost:3000/api/temp_run_migration');
    const json = await res.json();
    console.log("Response Status:", res.status);
    console.log("Response JSON:", JSON.stringify(json, null, 2));
  } catch (e) {
    console.error("Fetch failed:", e.message);
  }
}
run();
