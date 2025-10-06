import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('[Supabase] Missing env: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

export const supabase: SupabaseClient = createClient(
  url ?? 'https://invalid.invalid',
  key ?? 'invalid',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,  
      flowType: 'pkce'           
    }
  }
)