#!/usr/bin/env node

/**
 * Backend CLI Script: Reset User Password
 * 
 * Supports both:
 * 1. Supabase Admin API (via SUPABASE_SERVICE_ROLE_KEY)
 * 2. Direct PostgreSQL Database Connection (via DATABASE_URL / POSTGRES_URL)
 * 
 * Usage:
 *   node scripts/reset-user-password.mjs <user_email> [new_password]
 *   npm run reset-password -- <user_email> [new_password]
 */

import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local and .env
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function generateTemporaryPassword() {
  const words = ["Offshore", "DeepSea", "Subsea", "Anchor", "Platform", "Energy", "Horizon"];
  const randomWord = words[Math.floor(Math.random() * words.length)];
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  const symbols = ["!", "@", "#", "$", "%", "*"];
  const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
  return `${randomWord}#${randomDigits}${randomSymbol}`;
}

async function main() {
  const args = process.argv.slice(2);
  const targetEmail = args[0]?.trim()?.toLowerCase();
  const specifiedPassword = args[1]?.trim();

  if (!targetEmail) {
    console.log(`
\x1b[36m============================================================\x1b[0m
\x1b[36m   Offshore Platform - Backend Password Reset CLI Tool     \x1b[0m
\x1b[36m============================================================\x1b[0m

\x1b[1mUsage:\x1b[0m
  node scripts/reset-user-password.mjs <email> [optional_password]
  npm run reset-password -- <email> [optional_password]

\x1b[1mExamples:\x1b[0m
  node scripts/reset-user-password.mjs inspector@example.com
  node scripts/reset-user-password.mjs inspector@example.com "CustomPass#2026!"
`);
    process.exit(0);
  }

  const newPassword = specifiedPassword || generateTemporaryPassword();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

  console.log(`\n\x1b[34m[INFO]\x1b[0m Attempting to reset password for: \x1b[1m${targetEmail}\x1b[0m...`);

  // Mode 1: Supabase Admin API
  if (supabaseUrl && serviceRoleKey) {
    try {
      console.log(`\x1b[34m[INFO]\x1b[0m Using Supabase Admin API client...`);
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
      if (listError) throw listError;

      const user = usersData?.users?.find((u) => u.email?.toLowerCase() === targetEmail);
      if (!user) {
        console.error(`\x1b[31m[ERROR]\x1b[0m User with email "${targetEmail}" was not found in auth.users.`);
        process.exit(1);
      }

      const existingMeta = user.user_metadata || {};
      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(user.id, {
        password: newPassword,
        user_metadata: {
          ...existingMeta,
          must_change_password: true,
          password_reset_at: new Date().toISOString(),
          password_reset_source: "backend_cli_script",
        },
      });
      if (updateAuthError) throw updateAuthError;

      await adminClient
        .from("profiles")
        .update({
          must_change_password: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      printSuccess(targetEmail, user.id, newPassword);
      process.exit(0);
    } catch (apiErr) {
      console.warn(`\x1b[33m[WARN]\x1b[0m Admin API failed (${apiErr.message}). Trying direct PostgreSQL connection...`);
    }
  }

  // Mode 2: Direct PostgreSQL Connection
  if (databaseUrl) {
    console.log(`\x1b[34m[INFO]\x1b[0m Connecting directly to PostgreSQL database...`);
    const pgClient = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
    try {
      await pgClient.connect();
      
      // Ensure column exists
      await pgClient.query(`
        ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
      `);

      const res = await pgClient.query(`
        UPDATE auth.users
        SET 
          encrypted_password = extensions.crypt($1, extensions.gen_salt('bf')),
          raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
            'must_change_password', true,
            'password_reset_at', now()
          ),
          updated_at = now()
        WHERE lower(email) = lower($2)
        RETURNING id;
      `, [newPassword, targetEmail]);

      if (res.rows.length === 0) {
        console.error(`\x1b[31m[ERROR]\x1b[0m User "${targetEmail}" not found in auth.users.`);
        await pgClient.end();
        process.exit(1);
      }

      const userId = res.rows[0].id;

      // Update profiles
      await pgClient.query(`
        UPDATE public.profiles
        SET must_change_password = true, updated_at = now()
        WHERE id = $1;
      `, [userId]);

      await pgClient.end();
      printSuccess(targetEmail, userId, newPassword);
      process.exit(0);
    } catch (pgErr) {
      console.error(`\x1b[31m[ERROR]\x1b[0m PostgreSQL direct reset failed:`, pgErr.message);
      process.exit(1);
    }
  }

  // If neither credential is configured
  console.error(`
\x1b[31m[ERROR]\x1b[0m Neither SUPABASE_SERVICE_ROLE_KEY nor DATABASE_URL is configured in .env.local.
Please provide one of them, or execute the SQL script directly:
\x1b[36mscripts/reset_user_password.sql\x1b[0m
`);
  process.exit(1);
}

function printSuccess(email, userId, password) {
  console.log(`
\x1b[32m========================================================\x1b[0m
\x1b[32m✔ SUCCESS: User password has been reset successfully!\x1b[0m
\x1b[32m========================================================\x1b[0m

  \x1b[1mTarget Email:\x1b[0m        ${email}
  \x1b[1mUser ID:\x1b[0m             ${userId}
  \x1b[1mTemporary Password:\x1b[0m  \x1b[33;1m${password}\x1b[0m
  \x1b[1mMandatory Change:\x1b[0m    \x1b[32mTRUE\x1b[0m (Compulsory change upon first login)

\x1b[36mInstructions:\x1b[0m
Provide this password to the user. When they log in with it, the system will
automatically redirect them to \x1b[1m/force-change-password\x1b[0m to set their permanent password.
`);
}

main();
