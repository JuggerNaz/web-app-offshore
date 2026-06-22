import { NextResponse } from 'next/server';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

export async function GET() {
  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    // Try to read from .env.local
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const dbUrlMatch = envContent.match(/^\s*DATABASE_URL\s*=\s*(.*)/m);
        if (dbUrlMatch) {
          databaseUrl = dbUrlMatch[1].trim();
        }
      }
    } catch (e) {
      // ignore
    }
  }

  if (!databaseUrl) {
    return NextResponse.json({ error: "DATABASE_URL is not set in environment or .env.local" }, { status: 500 });
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const sql = `
      ALTER TABLE public.profiles 
      ADD COLUMN IF NOT EXISTS login_restriction_type VARCHAR(20) NOT NULL DEFAULT 'always',
      ADD COLUMN IF NOT EXISTS allowed_start_time TIME WITHOUT TIME ZONE NOT NULL DEFAULT '08:00:00',
      ADD COLUMN IF NOT EXISTS allowed_end_time TIME WITHOUT TIME ZONE NOT NULL DEFAULT '17:00:00',
      ADD COLUMN IF NOT EXISTS allowed_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kuala_Lumpur';

      ALTER TABLE public.profiles 
      DROP CONSTRAINT IF EXISTS chk_login_restriction_type,
      ADD CONSTRAINT chk_login_restriction_type 
      CHECK (login_restriction_type IN ('always', 'scheduled'));
    `;
    await client.query(sql);
    await client.end();
    return NextResponse.json({ success: true, message: "Migration ran successfully!" });
  } catch (err: any) {
    try {
      await client.end();
    } catch (e) {}
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
