
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  const { data: settings, error: settingsError } = await supabase
    .from('company_settings')
    .select('*')
    .single()

  console.log('Company Settings:', settings)
  if (settingsError) console.error('Settings Error:', settingsError)

  const { data: platform, error: platformError } = await supabase
    .from('platform')
    .select('*')
    .limit(1)
    .single()

  console.log('Platform columns:', Object.keys(platform || {}))
  if (platformError) console.error('Platform Error:', platformError)
}

checkSchema()
