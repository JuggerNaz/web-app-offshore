async function test() {
  const id = 27; // visually verified ID
  const url = `http://localhost:3000/api/attachment/url?id=${id}`;
  
  console.log(`Fetching ${url}...`);
  try {
    const res = await fetch(url);
    console.log("Status:", res.status);
    console.log("Headers:", JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2));
    const text = await res.text();
    console.log("Body length:", text.length);
    console.log("Body snippet:", text.substring(0, 200));
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}

test();
