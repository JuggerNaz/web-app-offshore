async function test() {
  console.log('Fetching /api/mgi-profiles...');
  const start = Date.now();
  try {
    const res = await fetch('http://localhost:3000/api/mgi-profiles');
    console.log('Status:', res.status);
    console.log('Headers:', Object.fromEntries(res.headers.entries()));
    const text = await res.text();
    console.log('Time taken:', Date.now() - start, 'ms');
    console.log('Body:', text.substring(0, 1000));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
test();
