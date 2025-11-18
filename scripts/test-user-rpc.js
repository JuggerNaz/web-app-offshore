#!/usr/bin/env node

/**
 * Script to test the get_user_info RPC function
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    envContent.split("\n").forEach((line) => {
      const [key, value] = line.split("=");
      if (key && value) {
        process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, "");
      }
    });
  }
}

loadEnvFile();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase configuration");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUserRPC() {
  console.log("🔍 Testing get_user_info RPC function...\n");

  try {
    // First, get the current user
    console.log("1️⃣ Getting current user...");
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log("⚠️  No authenticated user found. Please sign in first.");
      console.log("   You can test with any UUID if needed.\n");
      
      // Test with a dummy UUID
      console.log("2️⃣ Testing RPC with a dummy UUID...");
      const testUuid = "00000000-0000-0000-0000-000000000000";
      const { data, error } = await supabase.rpc('get_user_info', {
        user_ids: [testUuid]
      });
      
      console.log("RPC Response:", { data, error });
    } else {
      console.log("✅ Current user:", user.email);
      console.log("   User ID:", user.id);
      console.log("   Metadata:", user.user_metadata);
      
      // Test the RPC function with current user ID
      console.log("\n2️⃣ Calling get_user_info RPC...");
      const { data, error } = await supabase.rpc('get_user_info', {
        user_ids: [user.id]
      });
      
      if (error) {
        console.error("❌ RPC Error:", error);
      } else {
        console.log("✅ RPC Success!");
        console.log("   Response:", JSON.stringify(data, null, 2));
      }
    }
    
    // Now test fetching a comment to see the full flow
    console.log("\n3️⃣ Testing comment API...");
    console.log("   Note: You need to have at least one comment in your database");
    
  } catch (error) {
    console.error("❌ Unexpected error:", error.message);
  }
}

testUserRPC();
