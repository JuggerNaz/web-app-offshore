async function test() {
  console.log('Testing auth profile endpoint...');
  try {
    const res = await fetch('http://127.0.0.1:3000/api/auth/profile');
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text.substring(0, 1000));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

test();
