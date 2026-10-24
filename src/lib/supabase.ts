import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

// Keep the starter and offline demo usable before a hosted project is configured.
export const supabase = url && key ? createClient(url, key) : null

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local to connect community chat.')
  }
  return supabase
}
