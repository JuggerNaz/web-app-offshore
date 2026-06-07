async function test() {
  console.log('Testing elevation endpoint...');
  try {
    const res = await fetch('http://127.0.0.1:3000/api/platform/elevation/1061');
    console.log('Elevation Status:', res.status);
    const text = await res.text();
    console.log('Elevation Body:', text.substring(0, 1000));
  } catch (err) {
    console.error('Elevation Fetch error:', err);
  }

  console.log('\nTesting comment endpoint...');
  try {
    const res = await fetch('http://127.0.0.1:3000/api/comment/platform/1061');
    console.log('Comment Status:', res.status);
    const text = await res.text();
    console.log('Comment Body:', text.substring(0, 1000));
  } catch (err) {
    console.error('Comment Fetch error:', err);
  }
}

test();
