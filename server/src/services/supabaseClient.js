import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey || supabaseKey === 'your_supabase_service_role_key_here') {
  console.warn('⚠️  Supabase Storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
}

export const supabase = supabaseUrl && supabaseKey && supabaseKey !== 'your_supabase_service_role_key_here'
  ? createClient(supabaseUrl, supabaseKey)
  : null

export const PROFILE_BUCKET = 'student-profiles'
