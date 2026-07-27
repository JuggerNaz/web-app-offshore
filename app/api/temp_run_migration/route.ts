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
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
      ADD COLUMN IF NOT EXISTS device_restriction_type VARCHAR(20) NOT NULL DEFAULT 'none';

      ALTER TABLE public.profiles 
      DROP CONSTRAINT IF EXISTS chk_login_restriction_type,
      ADD CONSTRAINT chk_login_restriction_type 
      CHECK (login_restriction_type IN ('always', 'scheduled'));

      CREATE TABLE IF NOT EXISTS public.registered_devices (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        device_name     VARCHAR(100) NOT NULL,
        device_token    VARCHAR(255) NOT NULL UNIQUE,
        is_active       BOOLEAN NOT NULL DEFAULT true,
        registered_by   UUID NOT NULL REFERENCES public.profiles(id),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      ALTER TABLE public.registered_devices ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Admins can manage devices" ON public.registered_devices;
      CREATE POLICY "Admins can manage devices"
        ON public.registered_devices FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.company_memberships cm
            WHERE cm.user_id = auth.uid()
            AND cm.role IN ('super_admin', 'company_admin')
            AND cm.is_active = true
          )
        );

      ALTER TABLE public.profiles 
      DROP CONSTRAINT IF EXISTS chk_device_restriction_type,
      ADD CONSTRAINT chk_device_restriction_type 
      CHECK (device_restriction_type IN ('none', 'enforced'));

      ALTER TABLE public.defect_criteria_rules 
      ADD COLUMN IF NOT EXISTS findings TEXT,
      ADD COLUMN IF NOT EXISTS reference_no VARCHAR(100);

      -- Enable replication for defect_criteria_rules
      ALTER TABLE public.defect_criteria_rules REPLICA IDENTITY FULL;

      -- Add defect_criteria_rules to the supabase_realtime publication
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
          IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND schemaname = 'public' 
            AND tablename = 'defect_criteria_rules'
          ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.defect_criteria_rules;
          END IF;
        END IF;
      END $$;
    `;
    await client.query(sql);
    await client.end();
    return NextResponse.json({ success: true, message: "Migration ran successfully! Column and device tables have been created." });
  } catch (err: any) {
    try {
      await client.end();
    } catch (e) {}
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
