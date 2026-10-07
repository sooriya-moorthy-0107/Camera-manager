import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

export function createClientComponentClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  
  return createClient<Database>(supabaseUrl, supabaseKey)
}
