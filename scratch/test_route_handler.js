require('dotenv').config({ path: '.env.local' });
// Mock next/headers cookies
jest = { mock: () => {} };
require('next/headers');
// Since Next.js requires custom bundling, importing TS/Next files directly in Node might need ts-node or dynamic registration.
// Let's use ts-node or register tsconfig-paths.
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: "commonjs",
    target: "es2020",
    allowJs: true
  }
});

// Mock next/headers
const mockCookies = () => ({
  getAll: () => [],
  set: () => {}
});
require('next/headers').cookies = mockCookies;

const { GET } = require('../app/api/platform/elevation/[id]/route.ts');

async function test() {
  console.log('Invoking GET handler directly in Node...');
  try {
    const req = new Request('http://localhost:3000/api/platform/elevation/1061');
    const params = Promise.resolve({ id: '1061' });
    const response = await GET(req, { params });
    console.log('Response Status:', response.status);
    const body = await response.json();
    console.log('Response Body:', body);
  } catch (err) {
    console.error('CRASHED WITH ERROR:', err);
  }
}

test();
