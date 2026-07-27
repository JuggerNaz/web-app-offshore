async function test() {
  console.log('Testing PATCH /api/admin/users/some-uuid...');
  try {
    const res = await fetch('http://127.0.0.1:3000/api/admin/users/123e4567-e89b-12d3-a456-426614174000', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemRole: 'User',
      }),
    });
    console.log('PATCH Status:', res.status);
    const text = await res.text();
    console.log('PATCH Body:', text.substring(0, 1000));
  } catch (err) {
    console.error('PATCH Fetch error:', err);
  }
}

test();
