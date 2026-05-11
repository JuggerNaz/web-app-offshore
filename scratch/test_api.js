
async function testApi() {
  const platId = 234;
  const res = await fetch(`http://localhost:3000/api/attachment/inspection?platform_id=${platId}`);
  const json = await res.json();
  console.log("API Result count:", json.data?.length);
  console.log("Sample items:", JSON.stringify(json.data?.slice(0, 3), null, 2));
}
testApi();
