import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

export function createClientComponentClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
  
  return createClient<Database>(supabaseUrl, supabaseKey)
}
