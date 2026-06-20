import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function fixColumn() {
  console.log('🚀 Connecting to database to change platform_id type in platform_3d_scenes...');
  const client = new Client({ connectionString });

  try {
    await client.connect();
    
    const queries = [
      'DROP INDEX IF EXISTS public.idx_platform_3d_scenes_platform_id;',
      'ALTER TABLE public.platform_3d_scenes DROP COLUMN IF EXISTS platform_id;',
      'ALTER TABLE public.platform_3d_scenes ADD COLUMN platform_id INTEGER NOT NULL;',
      'CREATE INDEX IF NOT EXISTS idx_platform_3d_scenes_platform_id ON public.platform_3d_scenes(platform_id);'
    ];

    for (const q of queries) {
      console.log(`Executing: ${q}`);
      await client.query(q);
      console.log('✅ Success');
    }
    console.log('✨ Database schema updated successfully!');
  } catch (err) {
    console.error('❌ Database update failed:', err);
  } finally {
    await client.end();
  }
}

fixColumn();
