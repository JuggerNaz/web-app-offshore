async function run() {
  console.log('Sending POST to /api/sow/correct for SOW ID 1 and Structure ID 234...');
  try {
    const res = await fetch('http://127.0.0.1:3000/api/sow/correct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sow_id: 1,
        structure_id: 234,
        structure_type: 'PLATFORM'
      })
    });
    
    console.log('Response Status:', res.status);
    const data = await res.json();
    console.log('Response Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

run();
